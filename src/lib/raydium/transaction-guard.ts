'use client';
import {Buffer} from 'buffer';
import {Connection,PublicKey,VersionedTransaction,SystemProgram,ComputeBudgetProgram,SystemInstruction,TransactionInstruction} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID,NATIVE_MINT,getAssociatedTokenAddressSync} from '@solana/spl-token';
import {LAUNCHPAD_PROGRAM,DEV_LAUNCHPAD_PROGRAM,CREATE_CPMM_POOL_PROGRAM,DEVNET_PROGRAM_ID,anchorDataBuf,getPdaPlatformVault,getPdaCreatorVault} from '@raydium-io/raydium-sdk-v2';
import type {RuntimeConfig,TransactionPlan} from '@/types/domain';
const cpmmSwapPrefix=[143,190,90,218,196,30,51,222]; // installed SDK0.2.74-alpha cpmm/instruction.ts
const same=(data:Uint8Array,prefix:ArrayLike<number>)=>data.length>=8&&Array.from(prefix).every((b,i)=>data[i]===b);
export async function assertPlanTransaction(tx:VersionedTransaction,plan:TransactionPlan,wallet:PublicKey,runtime:RuntimeConfig,c:Connection){
 const launch=runtime.cluster==='devnet'?DEV_LAUNCHPAD_PROGRAM:LAUNCHPAD_PROGRAM,cpmm=runtime.cluster==='devnet'?DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM:CREATE_CPMM_POOL_PROGRAM;
 if(tx.message.addressTableLookups.length>8)throw Error('Too many transaction lookup tables');
 const tables=await Promise.all(tx.message.addressTableLookups.map(async l=>{const a=await c.getAddressLookupTable(l.accountKey);if(!a.value)throw Error('Lookup table unavailable');return a.value;}));
 const keys=tx.message.getAccountKeys({addressLookupTableAccounts:tables});const addresses=Array.from({length:keys.length},(_,i)=>keys.get(i)!.toBase58());
 if(addresses[0]!==wallet.toBase58())throw Error('Transaction payer mismatch');
 const required=plan.kind==='trade'&&plan.summary.route==='cpmm'?cpmm:launch;
 const allowed=new Set([required,SystemProgram.programId,ComputeBudgetProgram.programId,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID].map(x=>x.toBase58()));
 const pool=plan.kind==='trade'?(plan.summary.executionPoolId||plan.summary.poolId):plan.summary.platformId;
 if(pool&&!addresses.includes(String(pool)))throw Error('Transaction pool/platform does not match reviewed summary');
 if(plan.summary.destinationOwner&&plan.summary.destinationOwner!==wallet.toBase58())throw Error('Claim recipient mismatch');
 const ownWsol=getAssociatedTokenAddressSync(NATIVE_MINT,wallet).toBase58(),temporary=new Set<string>(),ownedTokens=new Map<string,string>();let protocolCount=0,wrappedTotal=0n;
 const wsolInput=plan.kind==='trade'&&plan.summary.inputMint===NATIVE_MINT.toBase58()?BigInt(String(plan.summary.amountInRaw)):0n;
 const intendedMints=new Set([plan.summary.inputMint,plan.summary.outputMint,plan.summary.quoteMint].filter(v=>typeof v==='string') as string[]);
 async function userToken(address:string,mint:string){if(ownedTokens.get(address)===mint)return;const a=await c.getAccountInfo(new PublicKey(address),'confirmed');if(!a&&address===getAssociatedTokenAddressSync(new PublicKey(mint),wallet).toBase58())return;if(!a||!a.owner.equals(TOKEN_PROGRAM_ID)||a.data.length!==165||new PublicKey(a.data.subarray(0,32)).toBase58()!==mint||!new PublicKey(a.data.subarray(32,64)).equals(wallet))throw Error('User token-account identity mismatch');}
 for(const ix of tx.message.compiledInstructions){const program=keys.get(ix.programIdIndex)!.toBase58(),accounts=Array.from(ix.accountKeyIndexes,i=>keys.get(i)!.toBase58()),data=ix.data,view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(!allowed.has(program))throw Error('Unexpected transaction program');
  if(program===SystemProgram.programId.toBase58()){
   const instruction=new TransactionInstruction({programId:SystemProgram.programId,keys:Array.from(ix.accountKeyIndexes,i=>({pubkey:keys.get(i)!,isSigner:tx.message.isAccountSigner(i),isWritable:tx.message.isAccountWritable(i)})),data:Buffer.from(data)});
   const type=SystemInstruction.decodeInstructionType(instruction);
   if(type==='CreateWithSeed'){
    const d=SystemInstruction.decodeCreateWithSeed(instruction);const derived=await PublicKey.createWithSeed(wallet,d.seed,TOKEN_PROGRAM_ID);
    if(!d.fromPubkey.equals(wallet)||!d.basePubkey.equals(wallet)||!d.newAccountPubkey.equals(derived)||!d.programId.equals(TOKEN_PROGRAM_ID)||d.space!==165||!intendedMints.has(NATIVE_MINT.toBase58()))throw Error('Unexpected seeded token account');
    const rent=BigInt(await c.getMinimumBalanceForRentExemption(165));const funds=BigInt(d.lamports);if(funds<rent||funds>rent+wsolInput)throw Error('Unexpected wrapped SOL account funding');wrappedTotal+=funds-rent;temporary.add(derived.toBase58());
   }else if(type==='Transfer'){
    const d=SystemInstruction.decodeTransfer(instruction);if(!d.fromPubkey.equals(wallet)||d.toPubkey.toBase58()!==ownWsol||wsolInput===0n)throw Error('Unexpected system transfer');wrappedTotal+=BigInt(d.lamports);
   }else throw Error('Unexpected system instruction');
   if(wrappedTotal>wsolInput)throw Error('Cumulative wrapped SOL exceeds reviewed input');
  }
  if(program===ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()){
   const mint=accounts[3];if(accounts[0]!==wallet.toBase58()||accounts[2]!==wallet.toBase58()||!intendedMints.has(mint)||accounts[1]!==getAssociatedTokenAddressSync(new PublicKey(mint),wallet).toBase58())throw Error('Unexpected associated-token account');ownedTokens.set(accounts[1],mint);
  }
  if(program===TOKEN_PROGRAM_ID.toBase58()){
   if(data[0]===1||data[0]===16||data[0]===18){const owner=data[0]===1?accounts[2]:data.length===33?new PublicKey(data.subarray(1)).toBase58():'';if(!temporary.has(accounts[0])||accounts[1]!==NATIVE_MINT.toBase58()||owner!==wallet.toBase58())throw Error('Unexpected WSOL initialization');ownedTokens.set(accounts[0],NATIVE_MINT.toBase58());}
   else if(data[0]===17){if(accounts[0]!==ownWsol&&!temporary.has(accounts[0]))throw Error('Unexpected wrapped SOL account');}
   else if(data[0]===9){if((accounts[0]!==ownWsol&&!temporary.has(accounts[0]))||accounts[1]!==wallet.toBase58()||accounts[2]!==wallet.toBase58())throw Error('Token close recipient or authority mismatch');}
   else throw Error('Unexpected top-level token instruction');
  }
  if(program===ComputeBudgetProgram.programId.toBase58()&&data[0]===3&&(data.length!==9||view.getBigUint64(1,true)!==0n))throw Error('Unreviewed priority fee is not allowed');
  if(program===required.toBase58()){
   protocolCount++;if(accounts[0]!==wallet.toBase58())throw Error('Protocol signer mismatch');
   if(plan.kind==='trade'){
    const isCpmm=plan.summary.route==='cpmm',prefix=isCpmm?cpmmSwapPrefix:plan.summary.side==='buy'?anchorDataBuf.buyExactIn:anchorDataBuf.sellExactIn;
    if(!same(data,prefix)||data.length!==(isCpmm?24:32)||view.getBigUint64(8,true)!==BigInt(String(plan.summary.amountInRaw))||view.getBigUint64(16,true)!==BigInt(String(plan.summary.minOutRaw))||(!isCpmm&&view.getBigUint64(24,true)!==0n))throw Error('Trade instruction or amounts differ from review');
    if(accounts[isCpmm?3:4]!==String(pool))throw Error('Protocol pool position mismatch');
    if(isCpmm){if(accounts[10]!==plan.summary.inputMint||accounts[11]!==plan.summary.outputMint)throw Error('Trade mint mismatch');await userToken(accounts[4],String(plan.summary.inputMint));await userToken(accounts[5],String(plan.summary.outputMint));}
    else{const buy=plan.summary.side==='buy';if(accounts[buy?10:9]!==plan.summary.inputMint||accounts[buy?9:10]!==plan.summary.outputMint)throw Error('Trade mint mismatch');await userToken(accounts[buy?6:5],String(plan.summary.inputMint));await userToken(accounts[buy?5:6],String(plan.summary.outputMint));}
   }else if(plan.kind==='claim-fees'){
    const creator=String(plan.summary.claimScope).startsWith('creator'),mint=new PublicKey(String(plan.summary.quoteMint));if(!same(data,creator?anchorDataBuf.claimCreatorFee:anchorDataBuf.claimPlatformFeeFromVault)||data.length!==8)throw Error('Claim instruction mismatch');
    const vault=creator?getPdaCreatorVault(launch,wallet,mint).publicKey:getPdaPlatformVault(launch,new PublicKey(runtime.platformId!),mint).publicKey;if(accounts[creator?2:3]!==vault.toBase58()||accounts[creator?4:5]!==mint.toBase58()||(!creator&&accounts[2]!==runtime.platformId))throw Error('Claim vault/mint mismatch');await userToken(accounts[creator?3:4],mint.toBase58());
   }else if(plan.kind==='update-platform'){
    if(!same(data,anchorDataBuf.updatePlaformConfig)||accounts[1]!==runtime.platformId)throw Error('Platform update mismatch');
    if(plan.summary.change==='updateClaimFeeWallet'){if(data.length!==41||data[8]!==0||new PublicKey(data.subarray(9)).toBase58()!==plan.summary.value)throw Error('Claim destination update mismatch');}
    else if(plan.summary.change==='updateFeeRate'){if(data.length!==17||data[8]!==3||view.getBigUint64(9,true)!==BigInt(String(plan.summary.value)))throw Error('Fee update mismatch');}else throw Error('Unsupported platform update');
   }else if(plan.kind==='create-platform'){
    if(!same(data,anchorDataBuf.createPlatformConfig)||accounts[3]!==plan.summary.platformId||accounts[1]!==plan.summary.claimWallet||accounts[2]!==plan.summary.nftWallet||accounts[4]!==plan.summary.cpmmConfigId||accounts[6]!==plan.summary.transferFeeAuthority||accounts[7]!==plan.summary.vestingWallet)throw Error('Platform creation account mismatch');
    const rates=plan.summary.lpDistribution as string[],fee=plan.summary.feePolicy as {platformBps:number;creatorBps:number};for(let i=0;i<3;i++)if(view.getBigUint64(8+i*8,true)!==BigInt(rates[i]))throw Error('LP allocation mismatch');if(view.getBigUint64(32,true)!==BigInt(fee.platformBps)*100n)throw Error('Platform fee mismatch');let pos=40;for(const expected of ['StonkLaunch',runtime.origin,'']){if(pos+4>data.length)throw Error('Platform data truncated');const len=view.getUint32(pos,true);pos+=4;if(len>256||pos+len>data.length||new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(pos,pos+len))!==expected)throw Error('Platform metadata mismatch');pos+=len;}if(pos+16!==data.length||view.getBigUint64(pos,true)!==BigInt(fee.creatorBps)*100n||view.getBigUint64(pos+8,true)!==0n)throw Error('Creator fee or vesting mismatch');
   }else throw Error('Unsupported reviewed operation');
  }
 }
 if(protocolCount!==1)throw Error('Expected exactly one reviewed protocol instruction');
}
