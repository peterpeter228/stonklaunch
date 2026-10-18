/** Public, fixed four-step acceptance ledger. Never reset a consumed slot. */
import {createHash} from 'node:crypto';
import type {Connection, LoadedAddresses, VersionedTransaction} from '@solana/web3.js';
export const WALLET='AFa5wrbY5ExUjf6qSuC2mtfNGV97Fo7xxBTgtcRouKho';
export const PLATFORM='9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz';
export const REPOSITORY='peterpeter228/stonklaunch';
export const REF='refs/heads/main';
export const LEDGER_PATH='evidence/DURABLE_CREATOR_LEDGER.json';
export const WORKFLOW_PATH='.github/workflows/devnet-creator-acceptance.yml';
export const STEPS=['launch','buy','sell','claim-creator'] as const;
export type Step=typeof STEPS[number];
export type Claim={nonce:string;sourceSha:string;runId:string|null;state:'claimed'|'signing'|'signed'|'finalized';mint?:string;poolId?:string;signature?:string;messageHash?:string;slot?:number;recoveryOfRunId?:string};
export type UnsignedAttemptHistory={step:'launch';claim:Claim;proof:{runUrl:string;runStatus:'completed';runConclusion:'failure';runAttempt:1;errorCode:'LOOKUP_TABLE_NOT_ALLOWED';fundedWalletSigned:false;broadcastAttempted:false;ledgerBlobSha:string;reviewedAt:string;evidencePath:string}};
export type Ledger={schemaVersion:1;network:'devnet';wallet:string;platformId:string;steps:Partial<Record<Step,Claim>>;attemptHistory?:UnsignedAttemptHistory[]};
// Exactly one independently reconciled pre-sign failure, not a general reset mechanism.
export const RECOVERABLE_UNSIGNED_CLAIM:Claim={nonce:'stonk-launch-20261018-174350',sourceSha:'78f91071d443819c999fa0c92754993560ba67fd',runId:'39151038033',state:'signing'};
function assertAttemptHistory(ledger:Ledger){
 const history=ledger.attemptHistory,active=ledger.steps.launch;
 if(!history){if(active?.recoveryOfRunId)throw Error('RECOVERY_HISTORY_REQUIRED');return;}
 if(!Array.isArray(history)||history.length!==1)throw Error('ONE_RECONCILED_RECOVERY_ONLY');
 const archived=history[0],original=archived?.claim,proof=archived?.proof;
 if(archived?.step!=='launch'||!original||Object.keys(original).length!==4||Object.entries(RECOVERABLE_UNSIGNED_CLAIM).some(([key,value])=>original[key as keyof Claim]!==value))throw Error('UNRECONCILED_PRIOR_ATTEMPT');
 if(!proof||proof.runUrl!==`https://github.com/${REPOSITORY}/actions/runs/${original.runId}`||proof.runStatus!=='completed'||proof.runConclusion!=='failure'||proof.runAttempt!==1||proof.errorCode!=='LOOKUP_TABLE_NOT_ALLOWED'||proof.fundedWalletSigned!==false||proof.broadcastAttempted!==false||proof.ledgerBlobSha!=='82253a96d8c0abb419b27d98cd5bc3096b332161'||!Number.isFinite(Date.parse(proof.reviewedAt))||!/^evidence\/[a-zA-Z0-9_-]+\.json$/.test(proof.evidencePath))throw Error('RECOVERY_PROOF_REQUIRED');
 if(!active||active.recoveryOfRunId!==original.runId||active.nonce===original.nonce||active.runId===original.runId||active.sourceSha===original.sourceSha)throw Error('RECOVERY_MUST_USE_NEW_BOUND_CLAIM');
 if(Object.values(ledger.steps).some(claim=>claim?.runId===original.runId||claim?.nonce===original.nonce))throw Error('ARCHIVED_ATTEMPT_REUSED');
}
/** Live checks resolve bounded ALT accounts; receipts must use historical loaded addresses, never current ALT contents. */
export async function resolveAcceptanceKeys(tx:VersionedTransaction,connection:Connection,receiptAddresses?:LoadedAddresses|null){
 if(tx.message.addressTableLookups.length>8)throw Error('TOO_MANY_LOOKUP_TABLES');
 let keys;
 if(receiptAddresses!==undefined){
  if(tx.message.addressTableLookups.length&&!receiptAddresses)throw Error('RECEIPT_LOADED_ADDRESSES_REQUIRED');
  keys=tx.message.getAccountKeys({accountKeysFromLookups:receiptAddresses||{writable:[],readonly:[]}});
 }else{
  const tables=await Promise.all(tx.message.addressTableLookups.map(async lookup=>{const table=await connection.getAddressLookupTable(lookup.accountKey);if(!table.value||!table.value.key.equals(lookup.accountKey))throw Error('LOOKUP_TABLE_UNAVAILABLE');return table.value;}));
  keys=tx.message.getAccountKeys({addressLookupTableAccounts:tables});
 }
 if(keys.length>256)throw Error('TOO_MANY_TRANSACTION_ACCOUNTS');
 for(const ix of tx.message.compiledInstructions){if(!keys.get(ix.programIdIndex)||Array.from(ix.accountKeyIndexes).some(index=>!keys.get(index)))throw Error('UNRESOLVED_INSTRUCTION_ACCOUNT');}
 return keys;
}
export type Identity={repository:string;ref:string;runId:string;attempt:string;sourceSha:string;nonce:string;step:Step};
const sha=/^[a-f0-9]{40}$/;
export function assertClaim(ledger:Ledger,id:Identity,state:Claim['state']='claimed'){
 if(id.repository!==REPOSITORY||id.ref!==REF||id.attempt!=='1'||!/^\d+$/.test(id.runId)||!sha.test(id.sourceSha)||! /^[a-zA-Z0-9_-]{16,80}$/.test(id.nonce)||!STEPS.includes(id.step))throw Error('UNTRUSTED_EXECUTION');
 if(ledger.schemaVersion!==1||ledger.network!=='devnet'||ledger.wallet!==WALLET||ledger.platformId!==PLATFORM||!ledger.steps||Object.keys(ledger.steps).some(k=>!STEPS.includes(k as Step)))throw Error('LEDGER_IDENTITY');
 assertAttemptHistory(ledger);
 const claim=ledger.steps[id.step];
 if(!claim||claim.nonce!==id.nonce||claim.sourceSha!==id.sourceSha||claim.runId!==id.runId||claim.state!==state)throw Error('CLAIM_NOT_OWNED');
 if((state==='claimed'||state==='signing')&&(claim.signature||claim.messageHash||claim.mint||claim.poolId))throw Error('CLAIM_ALREADY_CONSUMED');
 const index=STEPS.indexOf(id.step);
 for(const name of STEPS.slice(0,index)){const prior=ledger.steps[name];if(!prior||prior.state!=='finalized'||!prior.signature||!prior.messageHash||!prior.mint||!prior.poolId||!prior.slot)throw Error('PRIOR_FINALIZED_REQUIRED');}
 if(STEPS.slice(index+1).some(name=>ledger.steps[name]))throw Error('OUT_OF_ORDER_CLAIM');
 return claim;
}
export const messageHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export function publicSignature(bytes:Uint8Array){const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n,out='';for(const b of bytes)n=n*256n+BigInt(b);while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}for(const b of bytes){if(b)break;out='1'+out;}return out;}
async function api(path:string,method='GET',body?:unknown){
 const token=process.env.GH_TOKEN;if(!token)throw Error('TOKEN_REQUIRED');
 const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('LEDGER_API_FAILED');return response.json();
}
export async function readLedger(){const file=await api(`contents/${LEDGER_PATH}?ref=main&nonce=${Date.now()}`);if(file.encoding!=='base64'||typeof file.sha!=='string')throw Error('LEDGER_FILE');return {sha:file.sha as string,ledger:JSON.parse(Buffer.from(file.content,'base64').toString('utf8')) as Ledger};}
export async function verifySource(sourceSha:string){
 if(!sha.test(sourceSha)||process.env.GITHUB_WORKFLOW_REF!==`${REPOSITORY}/${WORKFLOW_PATH}@${REF}`||!sha.test(process.env.GITHUB_WORKFLOW_SHA||''))throw Error('WORKFLOW_IDENTITY');
 // Workflow code at dispatch must be byte-identical to reviewed source, even if public ledger commits advanced main.
 const [source,workflow]=await Promise.all([api(`contents/${WORKFLOW_PATH}?ref=${sourceSha}`),api(`contents/${WORKFLOW_PATH}?ref=${process.env.GITHUB_WORKFLOW_SHA}`)]);
 if(!source.sha||source.sha!==workflow.sha)throw Error('WORKFLOW_SOURCE_MISMATCH');
 const {execFileSync}=await import('node:child_process');if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sourceSha)throw Error('CHECKOUT_SOURCE_MISMATCH');
}
export async function transition(current:Awaited<ReturnType<typeof readLedger>>,id:Identity,from:Claim['state'],to:Claim['state'],fields:Partial<Claim>={}){
 const claim=assertClaim(current.ledger,id,from);
 if(!({claimed:'signing',signing:'signed',signed:'finalized'} as Record<string,string>)[from]||({claimed:'signing',signing:'signed',signed:'finalized'} as Record<string,string>)[from]!==to)throw Error('INVALID_TRANSITION');
 if(Object.keys(fields).some(k=>!['mint','poolId','signature','messageHash','slot'].includes(k))||(['signature','messageHash','mint','poolId'] as const).some(k=>claim[k]!==undefined&&fields[k]!==undefined&&fields[k]!==claim[k]))throw Error('IMMUTABLE_CLAIM');
 const next:Ledger={...current.ledger,steps:{...current.ledger.steps,[id.step]:{...claim,...fields,state:to}}};
 if(to==='signed'&&(!fields.signature||!fields.messageHash||!fields.mint||!fields.poolId))throw Error('SIGNED_EVIDENCE_REQUIRED');
 // One CAS attempt only. A timeout may mean the write landed: caller stops, never signs/rebroadcasts again.
 try{await api(`contents/${LEDGER_PATH}`,'PUT',{message:`Record devnet ${id.step} ${to} for run ${id.runId}`,branch:'main',sha:current.sha,content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64')});}
 catch{await readLedger().catch(()=>null);throw Error('CAS_OUTCOME_REQUIRES_MANUAL_RECONCILIATION');}
 const observed=await readLedger();if(JSON.stringify(observed.ledger)!==JSON.stringify(next))throw Error('LEDGER_READBACK_MISMATCH');return observed;
}
