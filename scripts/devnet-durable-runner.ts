/** Fixed, single acceptance sequence. Never invoke the legacy ephemeral session here. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Connection, PublicKey, Keypair, VersionedTransaction, ComputeBudgetProgram} from '@solana/web3.js';
import {anchorDataBuf, DEV_LAUNCHPAD_PROGRAM, getPdaCreatorVault} from '@raydium-io/raydium-sdk-v2';
import {getAssociatedTokenAddressSync} from '@solana/spl-token';
import {getRuntime} from '../src/lib/runtime';
import {buildClientLaunch, signAndSubmitLaunch, signAndSubmitPlan} from '../src/lib/raydium/client-transactions';
import {WALLET, PLATFORM, STEPS, assertClaim, readLedger, transition, verifySource, messageHash, publicSignature, type Identity, type Step, type Claim} from './devnet-claim';
import {readPlatform, sdk, WSOL} from '../src/lib/raydium/chain';
import {getVerifiedLaunch, readFees, prepareLaunch, prepareTrade, prepareFeeClaim} from '../src/lib/raydium/service';

const ADMIN='DotkAg6PowGVeqKTax9rYaBtVhYVLkysDJ3ruGLLJ2z2';
const GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const mode=process.env.RUN_MODE || 'prepare';
const step=process.env.RUN_STEP || 'launch';
const runId=process.env.GITHUB_RUN_ID || 'local';
const attempt=process.env.GITHUB_RUN_ATTEMPT || '1';
const checkpoint:{[key:string]:unknown}={schemaVersion:1,network:'devnet',wallet:WALLET,platformId:PLATFORM,runId,attempt,mode,step,privateKeyPersisted:true,walletSecretAccessed:false,keyStorage:'GitHub Actions repository secret STONK_DEVNET_KEYPAIR_JSON; not accessed by this read-only runner',mint:null,poolId:null,signature:null,status:'initializing'};
let outputDirectory:string;
function record(status:string, fields:Record<string,unknown>={}) {
 Object.assign(checkpoint,fields,{status,observedAt:new Date().toISOString()});
 // Append-only numbered snapshots, never overwrite previous evidence or print arbitrary exceptions.
 writeFileSync(join(outputDirectory,`${String(sequence++).padStart(3,'0')}-${status}.json`),JSON.stringify(checkpoint,(_k,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status,step,runId,mint:checkpoint.mint,signature:checkpoint.signature}));
}
let sequence=0;
const c=new Connection('https://api.devnet.solana.com',{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})});
async function configure(){
 if(await c.getGenesisHash()!==GENESIS)throw Error('NETWORK_MISMATCH');
 process.env.APP_MODE='devnet';process.env.SOLANA_RPC_URL=c.rpcEndpoint;process.env.APP_ORIGIN='https://example.invalid/stonklaunch-devnet';
 for(const k of ['LAUNCHLAB_PLATFORM_ADMIN','LAUNCHLAB_PLATFORM_FEE_WALLET','LAUNCHLAB_PLATFORM_NFT_WALLET','LAUNCHLAB_PLATFORM_VESTING_WALLET','LAUNCHLAB_TRANSFER_FEE_AUTHORITY'])process.env[k]=ADMIN;
 process.env.LAUNCHLAB_PLATFORM_ID=PLATFORM;process.env.LAUNCHLAB_PLATFORM_FEE_BPS='50';process.env.LAUNCHLAB_CREATOR_FEE_BPS='50';process.env.LAUNCHLAB_SHARE_FEE_BPS='0';
 const p=await readPlatform();
 if(p.info.feeRate.toString()!=='5000'||p.info.creatorFeeRate.toString()!=='5000'||p.info.platformClaimFeeWallet.toBase58()!==ADMIN)throw Error('PLATFORM_MISMATCH');
 process.env.LAUNCHLAB_CPMM_CONFIG_ID=p.info.cpConfigId.toBase58();
 const configs=await (await sdk()).api.fetchLaunchConfigs();const sol=configs.find(x=>x.key.mintB===WSOL);if(!sol)throw Error('SOL_CONFIG_MISSING');process.env.LAUNCHLAB_SOL_CONFIG_ID=sol.key.pubKey;
}
function identity():Identity{return {repository:process.env.GITHUB_REPOSITORY||'',ref:process.env.GITHUB_REF||'',runId,attempt,sourceSha:process.env.SOURCE_SHA||'',nonce:process.env.CLAIM_NONCE||'',step:step as Step};}
function assertInstruction(tx:VersionedTransaction,name:Step,mint:string,poolId:string){
 // This fixed acceptance never uses address lookup tables or a graduated CPMM route.
 if(tx.message.addressTableLookups.length)throw Error('LOOKUP_TABLE_NOT_ALLOWED');
 const keys=tx.message.staticAccountKeys;
 if(!keys[0].equals(new PublicKey(WALLET)))throw Error('PAYER_MISMATCH');
 const instructions=tx.message.compiledInstructions.filter(ix=>keys[ix.programIdIndex].equals(DEV_LAUNCHPAD_PROGRAM));
 if(instructions.length!==1)throw Error('EXPECTED_ONE_PROTOCOL_INSTRUCTION');
 const ix=instructions[0],accounts=Array.from(ix.accountKeyIndexes,i=>keys[i].toBase58());
 const prefix=name==='launch'?anchorDataBuf.initializeV2:name==='buy'?anchorDataBuf.buyExactIn:name==='sell'?anchorDataBuf.sellExactIn:anchorDataBuf.claimCreatorFee;
 if(!prefix.every((b,i)=>ix.data[i]===b)||accounts[0]!==WALLET)throw Error('STEP_INSTRUCTION_MISMATCH');
 if(name==='claim-creator'&&(ix.data.length!==8||accounts[2]!==getPdaCreatorVault(DEV_LAUNCHPAD_PROGRAM,new PublicKey(WALLET),new PublicKey(WSOL)).publicKey.toBase58()||accounts[3]!==getAssociatedTokenAddressSync(new PublicKey(WSOL),new PublicKey(WALLET)).toBase58()||accounts[4]!==WSOL))throw Error('CREATOR_CLAIM_ACCOUNTS_MISMATCH');
 if(name==='launch'){
  if(accounts[1]!==WALLET||accounts[3]!==PLATFORM||accounts[5]!==poolId||accounts[6]!==mint||accounts[7]!==WSOL)throw Error('LAUNCH_ACCOUNTS_MISMATCH');
  for(const extra of tx.message.compiledInstructions){const program=keys[extra.programIdIndex];if(!program.equals(DEV_LAUNCHPAD_PROGRAM)&&!program.equals(ComputeBudgetProgram.programId))throw Error('UNEXPECTED_CREATE_INSTRUCTION');if(program.equals(ComputeBudgetProgram.programId)&&extra.data[0]===3&&(extra.data.length!==9||Buffer.from(extra.data).readBigUInt64LE(1)!==0n))throw Error('PRIORITY_FEE_NOT_ALLOWED');}
 }else if(name==='buy'||name==='sell'){
  if(accounts[4]!==poolId||accounts[9]!==mint||accounts[10]!==WSOL||ix.data.length!==32||Buffer.from(ix.data).readBigUInt64LE(24)!==0n)throw Error('TRADE_ACCOUNTS_MISMATCH');
  if(name==='buy'&&Buffer.from(ix.data).readBigUInt64LE(8)!==10000000n)throw Error('BUY_AMOUNT_MISMATCH');
 }
}
async function finalizedReceipt(name:Step,claim:Claim){
 if(!claim.signature||!claim.messageHash||!claim.mint||!claim.poolId)throw Error('RECEIPT_MISSING');
 const status=(await c.getSignatureStatuses([claim.signature],{searchTransactionHistory:true})).value[0];
 const tx=await c.getTransaction(claim.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
 if(!status||status.err||status.confirmationStatus!=='finalized'||!tx||!tx.meta||tx.meta.err||messageHash(tx.transaction.message.serialize())!==claim.messageHash)throw Error('RECEIPT_NOT_FINALIZED_OR_MISMATCH');
 const parsed=new VersionedTransaction(tx.transaction.message);assertInstruction(parsed,name,claim.mint,claim.poolId);
 return {step:name,signature:claim.signature,slot:tx.slot,transaction:tx};
}
async function executeClaim(gateOnly:boolean){
 const id=identity();
 // Gate polls only for the parent's exact run binding, never changes a claim or accesses a secret.
 let current=await readLedger();
 const deadline=Date.now()+(gateOnly?180000:0);
 while(gateOnly&&current.ledger.steps[id.step]?.runId===null&&Date.now()<deadline){
  const pending=current.ledger.steps[id.step];if(pending?.nonce!==id.nonce||pending.sourceSha!==id.sourceSha||pending.state!=='claimed')throw Error('UNEXPECTED_PENDING_CLAIM');
  await new Promise(resolve=>setTimeout(resolve,5000));current=await readLedger();
 }
 assertClaim(current.ledger,id);await verifySource(id.sourceSha);
 if(gateOnly){record('claim-verified',{sourceSha:id.sourceSha});return;}
 if(process.env.PUBLIC_RECOVERY_JSON&&process.env.PUBLIC_RECOVERY_JSON!=='{}')throw Error('EXECUTION_RECOVERY_MUST_USE_LEDGER');
 await configure();
 const index=STEPS.indexOf(id.step),priorReceipts=[];
 const launch=current.ledger.steps.launch;
 let mint=index?launch!.mint!:undefined,poolId=index?launch!.poolId!:undefined;
 const seen=new Set<string>();
 for(const prior of STEPS.slice(0,index)){
  const claim=current.ledger.steps[prior]!;
  if(claim.mint!==mint||claim.poolId!==poolId||seen.has(claim.signature!))throw Error('PRIOR_IDENTITY_MISMATCH');
  seen.add(claim.signature!);priorReceipts.push(await finalizedReceipt(prior,claim));
 }
 if(mint){const launch=await getVerifiedLaunch(mint);if(launch.creator!==WALLET||launch.platformId!==PLATFORM||launch.quoteMint!==WSOL||launch.poolId!==poolId)throw Error('LAUNCH_READBACK_MISMATCH');}
 if(await c.getBalance(new PublicKey(WALLET))<20000000)throw Error('INSUFFICIENT_FREE_DEVNET_FUNDS');
 // Irreversible public claim consumption before key parsing, mint generation or signing.
 current=await transition(current,id,'claimed','signing');record('signing-claimed',{priorReceipts,sourceSha:id.sourceSha});
 const secret=process.env.STONK_DEVNET_KEYPAIR_JSON;delete process.env.STONK_DEVNET_KEYPAIR_JSON;
 const bytes:unknown=JSON.parse(secret||'null');if(!Array.isArray(bytes)||bytes.length!==64||bytes.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('INVALID_SECRET_FORMAT');
 const wallet=Keypair.fromSecretKey(Uint8Array.from(bytes));bytes.fill(0);
 if(wallet.publicKey.toBase58()!==WALLET)throw Error('RECOVERED_WALLET_MISMATCH');
 checkpoint.walletSecretAccessed=true;checkpoint.keyStorage='Existing GitHub Actions secret, recovered in process memory only';
 // Browser helpers need a public in-memory journal; durable uniqueness remains the repository ledger.
 const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
 let signedOnce=false;
 const signingWallet={publicKey:wallet.publicKey,signTransaction:async(tx:VersionedTransaction)=>{
  if(signedOnce||!mint||!poolId)throw Error('ONE_SIGNATURE_ONLY');signedOnce=true;
  assertInstruction(tx,id.step,mint,poolId);
  const fresh=await readLedger();assertClaim(fresh.ledger,id,'signing');
  const before=await c.getAccountInfoAndContext(wallet.publicKey,'confirmed');if(!before.value)throw Error('PAYER_ACCOUNT_MISSING');
  const simulation=await c.simulateTransaction(tx,{sigVerify:false,commitment:'confirmed',minContextSlot:before.context.slot,accounts:{encoding:'base64',addresses:[WALLET]}});
  const after=simulation.value.accounts?.[0]?.lamports,fee=(await c.getFeeForMessage(tx.message,'confirmed')).value;
  const cap=id.step==='launch'?50000000:id.step==='buy'?20000000:10000000;
  if(simulation.value.err||typeof after!=='number'||fee===null||before.value.lamports-after+fee>cap)throw Error('SIMULATION_OR_DEBIT_CAP');
  tx.sign([wallet]);const signature=publicSignature(tx.signatures[0]);
  // The wallet callback is awaited by existing submit helpers; no broadcast happens before this durable write/readback.
  current=await transition(fresh,id,'signing','signed',{mint,poolId,signature,messageHash:messageHash(tx.message.serialize())});
  record('signed-before-broadcast',{mint,poolId,signature,messageHash:messageHash(tx.message.serialize())});
  return tx;
 }};
 const onStage=(state:string,signature?:string)=>record('submission-stage',{submissionState:state,...(signature&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)?{signature}:{})});
 const runtime=getRuntime();let signature:string;
 if(id.step==='launch'){
  const mintSigner=Keypair.generate();mint=mintSigner.publicKey.toBase58();
  const plan=await prepareLaunch({name:'StonkLaunch Devnet QA',symbol:'STQA',description:'Disposable devnet acceptance only',assetKey:'SOL',clientMintPublicKey:mint,metadataUri:'https://example.invalid/stonklaunch-devnet.json',initialBuyRaw:'0'},WALLET);
  const built=await buildClientLaunch(plan,mintSigner,signingWallet,runtime,c);poolId=built.poolId;
  const result=await signAndSubmitLaunch(built,signingWallet,runtime,c,onStage);signature=result.signatures[0];
 }else if(id.step==='buy'||id.step==='sell'){
  let amountRaw='10000000';if(id.step==='sell'){const balance=await c.getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(mint!),wallet.publicKey));amountRaw=(BigInt(balance.value.amount)/2n).toString();if(BigInt(amountRaw)<=0n)throw Error('EMPTY_SELL_BALANCE');}
  const plan=await prepareTrade({poolId:poolId!,side:id.step,amountRaw,slippageBps:50,wallet:WALLET});if(plan.summary.route!=='launchlab')throw Error('ONLY_LAUNCHLAB_ACCEPTANCE');
  signature=await signAndSubmitPlan(plan,signingWallet,runtime,c,onStage);
 }else signature=await signAndSubmitPlan(await prepareFeeClaim({quoteMint:WSOL,scope:'creator'},WALLET),signingWallet,runtime,c,onStage);
 if(signature!==current.ledger.steps[id.step]!.signature)throw Error('SUBMITTED_SIGNATURE_MISMATCH');
 // Confirmation is not finalization. Poll only the original signature; never resubmit.
 const finalDeadline=Date.now()+90000;let receipt:Awaited<ReturnType<typeof finalizedReceipt>>|undefined;
 while(Date.now()<finalDeadline){try{receipt=await finalizedReceipt(id.step,current.ledger.steps[id.step]!);break;}catch{await new Promise(resolve=>setTimeout(resolve,2500));}}
 if(!receipt)throw Error('FINALIZATION_UNKNOWN_RECONCILE_ORIGINAL');
 const verified=await getVerifiedLaunch(mint!);if(verified.creator!==WALLET||verified.platformId!==PLATFORM||verified.quoteMint!==WSOL||verified.poolId!==poolId)throw Error('FINAL_LAUNCH_MISMATCH');
 record('finalized-receipt',{receipt,verifiedLaunch:verified,fees:await readFees(WALLET)});
 current=await transition(current,id,'signed','finalized',{slot:receipt.slot});record('completed',{slot:receipt.slot});
 wallet.secretKey.fill(0);
}
async function main(){
 if(!['prepare','execute','gate'].includes(mode)||!STEPS.includes(step as Step)||!/^\d+$|^local$/.test(runId)||!/^\d+$/.test(attempt))throw Error('INVALID_INPUT');
 // Evidence directories are unique even across local invocations. No private inputs are serialized.
 outputDirectory=join(process.cwd(),'evidence','durable-creator',`${runId}-${attempt}-${Date.now()}`);mkdirSync(outputDirectory,{recursive:true});
 const input:unknown=JSON.parse(process.env.PUBLIC_RECOVERY_JSON || '{}');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_RECOVERY');
 const recovery=input as Record<string,unknown>;
 if(Object.keys(recovery).some(k=>!['mint','poolId','signatures'].includes(k)))throw Error('INVALID_RECOVERY_FIELDS');
 const signatures=(recovery.signatures||{}) as Record<string,string>;
 if(typeof signatures!=='object'||Array.isArray(signatures)||Object.entries(signatures).some(([k,v])=>!STEPS.includes(k as Step)||typeof v!=='string'||! /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(v)))throw Error('INVALID_SIGNATURES');
 record('validating');
 if(mode==='execute'||mode==='gate'){await executeClaim(mode==='gate');return;}
 await configure();
 const index=STEPS.indexOf(step as Step);
 let mint:PublicKey|undefined,poolId:string|undefined;
 if(recovery.mint){mint=new PublicKey(String(recovery.mint));const launch=await getVerifiedLaunch(mint.toBase58());if(launch.creator!==WALLET||launch.platformId!==PLATFORM||launch.quoteMint!==WSOL||launch.poolId!==recovery.poolId)throw Error('RECOVERY_LAUNCH_MISMATCH');poolId=launch.poolId;}
 if(index>0&&(!mint||!poolId))throw Error('RECOVERY_LAUNCH_REQUIRED');
 // Every prior step must have a finalized successful receipt tied to this payer and pool.
 // Caller-supplied evidence is a recovery hint, not proof by itself.
 const receipts:unknown[]=[];
 for(const [name,signature] of Object.entries(signatures)){
  const status=(await c.getSignatureStatuses([signature],{searchTransactionHistory:true})).value[0];
  const tx=await c.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if(!status||status.err||status.confirmationStatus!=='finalized'||!tx||tx.meta?.err||!tx.transaction.message.staticAccountKeys[0].equals(new PublicKey(WALLET)))throw Error('RECOVERY_UNCERTAIN_OR_FAILED');
  const keys=tx.transaction.message.getAccountKeys({accountKeysFromLookups:tx.meta?.loadedAddresses});
  if(name!=='claim-creator'&&(!poolId||!Array.from({length:keys.length},(_,i)=>keys.get(i)?.toBase58()).includes(poolId)))throw Error('RECOVERY_POOL_MISMATCH');
  receipts.push({step:name,signature,transaction:tx});
 }
 if(new Set(Object.values(signatures)).size!==Object.values(signatures).length)throw Error('REUSED_RECOVERY_SIGNATURE');
 for(const prior of STEPS.slice(0,index))if(!signatures[prior])throw Error('PRIOR_FINALIZED_RECEIPT_REQUIRED');
 record('prepared',{mint:mint?.toBase58()||null,poolId:poolId||null,signatures,receipts,balanceLamports:await c.getBalance(new PublicKey(WALLET)),fees:await readFees(WALLET)});
 // Read-only by construction: no signer, keypair parsing, faucet or submission code.

}
// Explicit allowlist only: never print arbitrary SDK/RPC exceptions or raw secret-bearing input.
const SAFE_ERRORS=new Set(['UNTRUSTED_EXECUTION','LEDGER_IDENTITY','CLAIM_NOT_OWNED','CLAIM_ALREADY_CONSUMED','PRIOR_FINALIZED_REQUIRED','OUT_OF_ORDER_CLAIM','TOKEN_REQUIRED','LEDGER_API_FAILED','WORKFLOW_IDENTITY','WORKFLOW_SOURCE_MISMATCH','CHECKOUT_SOURCE_MISMATCH','CAS_OUTCOME_REQUIRES_MANUAL_RECONCILIATION','LEDGER_READBACK_MISMATCH','UNEXPECTED_PENDING_CLAIM','NETWORK_MISMATCH','PLATFORM_MISMATCH','SOL_CONFIG_MISSING','EXECUTION_RECOVERY_MUST_USE_LEDGER','PRIOR_IDENTITY_MISMATCH','RECEIPT_NOT_FINALIZED_OR_MISMATCH','LAUNCH_READBACK_MISMATCH','INSUFFICIENT_FREE_DEVNET_FUNDS','INVALID_SECRET_FORMAT','RECOVERED_WALLET_MISMATCH','ONE_SIGNATURE_ONLY','SIMULATION_OR_DEBIT_CAP','ONLY_LAUNCHLAB_ACCEPTANCE','FINALIZATION_UNKNOWN_RECONCILE_ORIGINAL','FINAL_LAUNCH_MISMATCH','LOOKUP_TABLE_NOT_ALLOWED','EXPECTED_ONE_PROTOCOL_INSTRUCTION','STEP_INSTRUCTION_MISMATCH','LAUNCH_ACCOUNTS_MISMATCH','TRADE_ACCOUNTS_MISMATCH','CREATOR_CLAIM_ACCOUNTS_MISMATCH','UNEXPECTED_CREATE_INSTRUCTION','PRIORITY_FEE_NOT_ALLOWED']);
main().catch((error:unknown)=>{delete process.env.STONK_DEVNET_KEYPAIR_JSON;const code=error instanceof Error&&SAFE_ERRORS.has(error.message)?error.message:'VALIDATION_OR_TRANSACTION_FAILED';if(outputDirectory)try{record('blocked',{code,notice:'Stopped safely. Inspect public snapshots and original signature; never blindly rerun execution.'});}catch{console.error('PUBLIC_CHECKPOINT_WRITE_FAILED');}console.error(`BLOCKED: ${code}; no automatic retry.`);process.exitCode=1;});
