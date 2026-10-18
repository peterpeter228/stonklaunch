/** Fixed, single acceptance sequence. Never invoke the legacy ephemeral session here. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Connection, PublicKey} from '@solana/web3.js';
import {readPlatform, sdk, WSOL} from '../src/lib/raydium/chain';
import {getVerifiedLaunch, readFees} from '../src/lib/raydium/service';

const WALLET='AFa5wrbY5ExUjf6qSuC2mtfNGV97Fo7xxBTgtcRouKho';
const PLATFORM='9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz';
const ADMIN='DotkAg6PowGVeqKTax9rYaBtVhYVLkysDJ3ruGLLJ2z2';
const GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const STEPS=['launch','buy','sell','claim-creator'] as const;
type Step=typeof STEPS[number];
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
async function main(){
 if(!['prepare','execute'].includes(mode)||!STEPS.includes(step as Step)||!/^\d+$|^local$/.test(runId)||!/^\d+$/.test(attempt))throw Error('INVALID_INPUT');
 // Evidence directories are unique even across local invocations. No private inputs are serialized.
 outputDirectory=join(process.cwd(),'evidence','durable-creator',`${runId}-${attempt}-${Date.now()}`);mkdirSync(outputDirectory,{recursive:true});
 const input:unknown=JSON.parse(process.env.PUBLIC_RECOVERY_JSON || '{}');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_RECOVERY');
 const recovery=input as Record<string,unknown>;
 if(Object.keys(recovery).some(k=>!['mint','poolId','signatures'].includes(k)))throw Error('INVALID_RECOVERY_FIELDS');
 const signatures=(recovery.signatures||{}) as Record<string,string>;
 if(typeof signatures!=='object'||Array.isArray(signatures)||Object.entries(signatures).some(([k,v])=>!STEPS.includes(k as Step)||typeof v!=='string'||! /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(v)))throw Error('INVALID_SIGNATURES');
 record('validating');
 if(mode==='execute'){record('execution-disabled',{notice:'Prepare-only release. A durable cross-run uniqueness ledger and instruction-level recovery verification are required before signing.'});throw Error('EXECUTION_DISABLED');}
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
main().catch(()=>{delete process.env.STONK_DEVNET_KEYPAIR_JSON;if(outputDirectory)record('blocked',{notice:'Stopped safely. Inspect public snapshots and original signature; never blindly rerun execution.'});console.error('BLOCKED: validation, funding, recovery, or transaction check failed; no automatic retry.');process.exitCode=1;});
