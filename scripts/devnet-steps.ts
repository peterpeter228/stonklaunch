import {writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {Keypair,Connection,PublicKey} from '@solana/web3.js';
import {getPdaPlatformId,getPdaPlatformVault,getPdaCreatorVault,getCpmmPdaAmmConfigId,DEVNET_PROGRAM_ID,CpmmConfigInfoLayout} from '@raydium-io/raydium-sdk-v2';
import {getAssociatedTokenAddressSync} from '@solana/spl-token';
import {getRuntime} from '../src/lib/runtime';
import {sdk,programs,readPlatform} from '../src/lib/raydium/chain';
import {preparePlatformConfigChange,prepareLaunch,prepareTrade,prepareFeeClaim,readFees,getVerifiedLaunch,quoteTrade} from '../src/lib/raydium/service';

import {readRecovery,writeRecovery} from '../src/lib/raydium/recovery';
type Context={wallet:Keypair;connection:Connection;mint:Keypair|null;sent:Record<string,string>;evidence:unknown[];configured?:boolean;poolId?:string;storage?:Map<string,string>};
function checkpoint(ctx:Context){
 // Public evidence only. Never serialize ctx.wallet/ctx.mint keypairs or the whole context.
 const directory=process.cwd()+'/evidence';mkdirSync(directory,{recursive:true});const destination=directory+'/DEVNET_PUBLIC_CHECKPOINT.json';
 const data={observedAt:new Date().toISOString(),network:'devnet',privateKeyPersisted:false,keyStorage:'process memory only; not restorable',wallet:ctx.wallet.publicKey.toBase58(),mint:ctx.mint?.publicKey.toBase58()||null,poolId:ctx.poolId||null,signatures:ctx.sent,records:ctx.evidence};
 writeFileSync(destination+'.tmp',JSON.stringify(data,(_k,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');renameSync(destination+'.tmp',destination);
}
async function configure(ctx:Context){
 if(await ctx.connection.getGenesisHash()!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw Error('DEVNET_ONLY');
 process.env.APP_MODE='devnet';process.env.SOLANA_RPC_URL='https://api.devnet.solana.com';process.env.APP_ORIGIN='https://example.invalid/stonklaunch-devnet';const owner=ctx.wallet.publicKey.toBase58();
 for(const k of ['LAUNCHLAB_PLATFORM_ADMIN','LAUNCHLAB_PLATFORM_FEE_WALLET','LAUNCHLAB_PLATFORM_NFT_WALLET','LAUNCHLAB_PLATFORM_VESTING_WALLET','LAUNCHLAB_TRANSFER_FEE_AUTHORITY'])process.env[k]=owner;
 process.env.LAUNCHLAB_PLATFORM_FEE_BPS='50';process.env.LAUNCHLAB_CREATOR_FEE_BPS='50';process.env.LAUNCHLAB_SHARE_FEE_BPS='0';
 // Explicit synthetic-test allocation only, not a production economic decision.
 process.env.LAUNCHLAB_LP_PLATFORM_RATE='0';process.env.LAUNCHLAB_LP_CREATOR_RATE='0';process.env.LAUNCHLAB_LP_BURN_RATE='1000000';
 process.env.LAUNCHLAB_PLATFORM_ID=getPdaPlatformId(programs().launch,ctx.wallet.publicKey).publicKey.toBase58();
 const r=await sdk();const configs=await r.api.fetchLaunchConfigs();const sol=configs.find(x=>x.key.mintB==='So11111111111111111111111111111111111111112');if(!sol)throw Error('No devnet SOL configuration');process.env.LAUNCHLAB_SOL_CONFIG_ID=sol.key.pubKey;
 let cp:string|undefined;for(let i=0;i<5;i++){const id=getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,i).publicKey;const a=await ctx.connection.getAccountInfo(id);if(a?.owner.equals(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM)&&a.data.length>=CpmmConfigInfoLayout.span&&!CpmmConfigInfoLayout.decode(a.data).disableCreatePool){cp=id.toBase58();break;}}
 if(!cp)throw Error('No verified devnet CPMM configuration');process.env.LAUNCHLAB_CPMM_CONFIG_ID=cp;
 if(!ctx.storage){ctx.storage=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>ctx.storage!.get(k)||null,setItem:(k:string,v:string)=>ctx.storage!.set(k,v)}});}
 ctx.configured=true;checkpoint(ctx);return {cluster:'devnet',wallet:owner,platformId:process.env.LAUNCHLAB_PLATFORM_ID,globalConfig:sol.key.pubKey,cpmmConfig:cp,testLpAllocation:'100% burn, test-only',realFunds:false};
}
export async function runStep(step:string,ctx:Context){
 if(!ctx.configured||step==='configure'){const config=await configure(ctx);if(step==='configure')return config;}
 const {buildClientLaunch,signAndSubmitLaunch,signAndSubmitPlan}=await import('../src/lib/raydium/client-transactions.ts?revision='+Date.now());
 const c=ctx.connection,owner=ctx.wallet.publicKey.toBase58();
 if(step==='use-existing-test-platform'){
  if(getRuntime().cluster!=='devnet')throw Error('DEVNET_ONLY');
  const originalAdmin='DotkAg6PowGVeqKTax9rYaBtVhYVLkysDJ3ruGLLJ2z2';
  for(const k of ['LAUNCHLAB_PLATFORM_ADMIN','LAUNCHLAB_PLATFORM_FEE_WALLET','LAUNCHLAB_PLATFORM_NFT_WALLET','LAUNCHLAB_PLATFORM_VESTING_WALLET','LAUNCHLAB_TRANSFER_FEE_AUTHORITY'])process.env[k]=originalAdmin;
  process.env.LAUNCHLAB_PLATFORM_ID='9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz';const existing=await readPlatform();
  const proof={step,platformId:existing.id.toBase58(),admin:originalAdmin,creatorWallet:owner,claimWallet:existing.info.platformClaimFeeWallet.toBase58(),feeRate:existing.info.feeRate.toString(),creatorFeeRate:existing.info.creatorFeeRate.toString(),testOnly:true};ctx.evidence.push(proof);checkpoint(ctx);return proof;
 }
 const runtime=getRuntime();if(runtime.cluster!=='devnet')throw Error('DEVNET_ONLY');
 if(step==='fund-once-more'){if(ctx.sent.airdropRetry)throw Error('Airdrop retry already used');ctx.sent.airdropRetry='attempted';const balance=await c.getBalance(ctx.wallet.publicKey);if(balance>0)return {balanceLamports:balance,noRepeat:true};const signature=await c.requestAirdrop(ctx.wallet.publicKey,1000000000);ctx.sent.airdrop=signature;return {testOnly:true,airdropSignature:signature};}
 if(step==='simulate-original-creator-claim'){
  const original='DotkAg6PowGVeqKTax9rYaBtVhYVLkysDJ3ruGLLJ2z2';
  const plan=await prepareFeeClaim({quoteMint:'So11111111111111111111111111111111111111112',scope:'creator'},original);
  const {assertPlanTransaction}=await import('../src/lib/raydium/transaction-guard');const {VersionedTransaction}=await import('@solana/web3.js');
  await assertPlanTransaction(VersionedTransaction.deserialize(Buffer.from(plan.transactionBase64!,'base64')),plan,new PublicKey(original),runtime,c);
  const proof={step,summary:plan.summary,guardPassed:true,simulationOnly:true,signatureVerified:false,broadcast:false};ctx.evidence.push(proof);checkpoint(ctx);return proof;
 }
 if(step==='platform-readback'){const p=await readPlatform();return {id:p.id.toBase58(),claimWallet:p.info.platformClaimFeeWallet.toBase58(),feeRate:p.info.feeRate.toString(),creatorFeeRate:p.info.creatorFeeRate.toString(),cpmm:p.info.cpConfigId.toBase58(),lp:[p.info.platformScale,p.info.creatorScale,p.info.burnScale].map(x=>x.toString())};}
 if(step==='vaults'){const quote=new PublicKey('So11111111111111111111111111111111111111112');const platform=getPdaPlatformVault(programs().launch,new PublicKey(runtime.platformId!),quote).publicKey;const creator=getPdaCreatorVault(programs().launch,ctx.wallet.publicKey,quote).publicKey;const ata=getAssociatedTokenAddressSync(quote,ctx.wallet.publicKey);const rows=[];for(const [role,address] of [['platform',platform],['creator',creator],['claimant-wsol',ata]] as const){const a=await c.getAccountInfo(address);rows.push({role,address:address.toBase58(),exists:!!a,owner:a?.owner.toBase58(),mint:a&&a.data.length===165?new PublicKey(a.data.subarray(0,32)).toBase58():null,authority:a&&a.data.length===165?new PublicKey(a.data.subarray(32,64)).toBase58():null,amountRaw:a&&a.data.length===165?a.data.readBigUInt64LE(64).toString():null});}const v={step,rows};ctx.evidence.push(v);checkpoint(ctx);return v;}
 if(step==='evidence'||step==='save-evidence'){const transactions=[];for(const name of ['platform','launch','buy','sell','claim-platform','claim-creator']){const sig=ctx.sent[name];if(!sig)continue;const tx=await c.getTransaction(sig,{commitment:'confirmed',maxSupportedTransactionVersion:0});transactions.push({step:name,signature:sig,transaction:tx});}const result={records:ctx.evidence,transactions};if(step==='save-evidence'){const fs=await import('node:fs/promises');const path=process.cwd()+'/evidence/DEVNET_RECEIPTS_20261018.json';await fs.writeFile(path,JSON.stringify(result,(_k,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');return {saved:true,path,transactionCount:transactions.length,recordCount:ctx.evidence.length};}return result;}
 if(step==='negative-claims'){const results=[];for(const [name,input,wallet] of [['unauthorized-platform',{quoteMint:'So11111111111111111111111111111111111111112',scope:'platform'},owner===runtime.platformAdmin?'11111111111111111111111111111111':owner],['empty-platform',{quoteMint:'So11111111111111111111111111111111111111112',scope:'platform'},runtime.platformAdmin!]] as const){try{await prepareFeeClaim(input,wallet);results.push({name,unexpectedPrepared:true});}catch(e){results.push({name,code:(e as {code?:string}).code||'ERROR'});}}ctx.evidence.push({step,results});checkpoint(ctx);return {step,results,noSignatureRequested:true};}
 if(step==='fees')return readFees(owner);
 if(step==='inspect')return {platform:(await readPlatform()).id.toBase58(),mint:ctx.mint?.publicKey.toBase58(),pool:ctx.poolId,signatures:ctx.sent,balanceLamports:await c.getBalance(ctx.wallet.publicKey)};
 if(ctx.sent[step]){const state=(await c.getSignatureStatuses([ctx.sent[step]],{searchTransactionHistory:true})).value[0];const pending=readRecovery('transaction','devnet',owner);if(pending?.signature===ctx.sent[step]&&state&&(state.err||state.confirmationStatus==='confirmed'||state.confirmationStatus==='finalized'))writeRecovery('transaction',{...pending,state:state.err?'failed':'confirmed'});return {alreadySubmitted:true,step,signature:ctx.sent[step],state,noRepeat:true};}
 if(await c.getBalance(ctx.wallet.publicKey)<10000000)throw Error('FREE_DEVNET_TEST_SOL_REQUIRED');
 const signingWallet={publicKey:ctx.wallet.publicKey,signTransaction:async(tx:import('@solana/web3.js').VersionedTransaction)=>{tx.sign([ctx.wallet]);return tx;}};
 const onStage=(state:string,signature?:string)=>{if(signature&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)&&['submitted','confirmed','confirmation_unknown','failed'].includes(state)){ctx.sent[step]=signature;checkpoint(ctx);}};
 let signature:string;
 if(step==='platform')signature=await signAndSubmitPlan(await preparePlatformConfigChange({action:'create'},owner),signingWallet,runtime,c,onStage);
 else if(step==='launch'){
  ctx.mint ||=Keypair.generate();const plan=await prepareLaunch({name:'StonkLaunch Devnet QA',symbol:'STQA',description:'Disposable devnet acceptance only',assetKey:'SOL',clientMintPublicKey:ctx.mint.publicKey.toBase58(),metadataUri:'https://example.invalid/stonklaunch-devnet.json',initialBuyRaw:'0'},owner);
  const built=await buildClientLaunch(plan,ctx.mint,signingWallet,runtime,c);ctx.poolId=built.poolId;const result=await signAndSubmitLaunch(built,signingWallet,runtime,c,onStage);signature=result.signatures[result.signatures.length-1];ctx.evidence.push({step:'verified-launch',launch:await getVerifiedLaunch(ctx.mint.publicKey.toBase58())});
 }else if(step==='buy'||step==='sell'){
  if(!ctx.poolId||!ctx.mint)throw Error('Launch must be verified first');let amountRaw='10000000';if(step==='sell'){const balance=await c.getTokenAccountBalance(getAssociatedTokenAddressSync(ctx.mint.publicKey,ctx.wallet.publicKey));amountRaw=(BigInt(balance.value.amount)/2n).toString();}
  const input={poolId:ctx.poolId,side:step as 'buy'|'sell',amountRaw,slippageBps:50};const quote=await quoteTrade(input);const plan=await prepareTrade({...input,wallet:owner});ctx.evidence.push({step,quote,actualPreparedSummary:plan.summary});signature=await signAndSubmitPlan(plan,signingWallet,runtime,c,onStage);
 }else if(step==='claim-platform'||step==='claim-creator')signature=await signAndSubmitPlan(await prepareFeeClaim({quoteMint:'So11111111111111111111111111111111111111112',scope:step==='claim-platform'?'platform':'creator'},owner),signingWallet,runtime,c,onStage);
 else throw Error('Unknown bounded devnet step');
 const result={step,signature,cluster:'devnet',wallet:owner,mint:ctx.mint?.publicKey.toBase58(),poolId:ctx.poolId,status:(await c.getSignatureStatuses([signature],{searchTransactionHistory:true})).value[0],testOnly:true};ctx.evidence.push(result);checkpoint(ctx);return result;
}
