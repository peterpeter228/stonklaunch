/** Secret-free exact submission-reader diagnostic. Dummy bytes only; stop before broadcast. */
export {};
const ENDPOINT='https://api.devnet.solana.com',WALLET='AFa5wrbY5ExUjf6qSuC2mtfNGV97Fo7xxBTgtcRouKho';
const PLATFORM='9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz',ADMIN='DotkAg6PowGVeqKTax9rYaBtVhYVLkysDJ3ruGLLJ2z2';
const MINT='6cdzhss7UKfcNU9HSqs7kZbv1b6znut3EPDj2iFhdQhU',POOL='DiMsXdpVBZZcL1Vq6YVXNUYyBkD1FjLBtmzSqnEtxerZ';
const methods=new Set(['getGenesisHash','getAccountInfo','getTokenAccountsByOwner','getMultipleAccounts','getMinimumBalanceForRentExemption','getSlot','getLatestBlockhash','simulateTransaction','getFeeForMessage','getBlockHeight']);
const names=new Set(['Error','TypeError','SyntaxError','AbortError','TimeoutError']);
const codes=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET']);
const output=console.log.bind(console),rawFetch=globalThis.fetch.bind(globalThis),abort=new AbortController();
// SDK diagnostics may include raw server messages. Only the allowlisted tracer emits output.
console.log=console.warn=console.error=()=>{};
let requests=0,stopped=false,stage='initialize',stopReason='';
const emit=(value:Record<string,unknown>)=>output(JSON.stringify(value));
function stop(code:string):never{if(!stopReason)stopReason=code;stopped=true;abort.abort();throw Error(code);}
globalThis.fetch=async(input,init)=>{
 if(stopped)throw Error('PROBE_STOPPED');
 if(String(input)!==ENDPOINT||init?.method!=='POST')return stop('UNEXPECTED_ENDPOINT_OR_METHOD');
 let request:{method?:unknown;params?:unknown;id?:unknown};try{request=JSON.parse(String(init.body));}catch{return stop('INVALID_REQUEST');}
 if(!request||typeof request.method!=='string'||!methods.has(request.method)){
  const rejectedMethod=typeof request?.method==='string'&&/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(request.method)?request.method:'UNKNOWN';
  emit({stage,rejectedMethod,requests,stopped:true});return stop('RPC_METHOD_NOT_ALLOWED');
 }
 // Includes production helper genesis/guard/height reads; fixed cap prevents unbounded RPC work.
 if(requests>=35)return stop('RPC_CAP_REACHED');
 const number=++requests,method=request.method,started=Date.now();let status:number|null=null;
 try{
  const response=await rawFetch(ENDPOINT,{...init,redirect:'error',signal:AbortSignal.any([abort.signal,...(init.signal?[init.signal]:[AbortSignal.timeout(15000)])])});
  status=response.status;
  if(!response.ok){emit({stage,number,method,httpStatus:status,durationMs:Date.now()-started,stopped:true});return stop('HTTP_FAILURE');}
  const data=await response.clone().json();
  const hasError=data&&typeof data==='object'&&Object.hasOwn(data,'error');
  const rpcErrorCode=hasError&&Number.isSafeInteger(data.error?.code)?data.error.code:null;
  emit({stage,number,method,httpStatus:status,rpcErrorCode,...(method==='getBlockHeight'&&Number.isSafeInteger(data.result)?{blockHeight:data.result}:{}),durationMs:Date.now()-started,stopped:!!hasError});
  if(hasError)return stop('RPC_ERROR');
  if(data?.jsonrpc!=='2.0'||data.id!==request.id)return stop('INVALID_RPC_ENVELOPE');
  if(method==='getGenesisHash'&&data.result!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')return stop('GENESIS_MISMATCH');
  return response;
 }catch(error){
  if(stopped)throw Error('PROBE_STOPPED');
  const e=error as {name?:string;code?:string;cause?:{code?:string}},candidate=e.cause?.code??e.code;
  emit({stage,number,method,httpStatus:status,durationMs:Date.now()-started,errorName:names.has(e.name||'')?e.name:'OtherError',errorCode:codes.has(candidate||'')?candidate:null,stopped:true});
  return stop('TRANSPORT_FAILURE');
 }
};
async function main(){
 process.env.APP_MODE='devnet';process.env.SOLANA_RPC_URL=ENDPOINT;process.env.LAUNCHLAB_PLATFORM_ID=PLATFORM;process.env.LAUNCHLAB_PLATFORM_ADMIN=ADMIN;
 process.env.LAUNCHLAB_PLATFORM_FEE_WALLET=ADMIN;process.env.LAUNCHLAB_PLATFORM_FEE_BPS='50';process.env.LAUNCHLAB_CREATOR_FEE_BPS='50';process.env.LAUNCHLAB_SHARE_FEE_BPS='0';
 const {Connection,PublicKey,VersionedTransaction}=await import('@solana/web3.js');
 const {prepareTrade}=await import('../src/lib/raydium/service');
 const {signAndSubmitPlan,TransactionValidityError}=await import('../src/lib/raydium/client-transactions');
 const {resolveAcceptanceKeys}=await import('./devnet-claim');
 const {getRuntime}=await import('../src/lib/runtime');
 const c=new Connection(ENDPOINT,{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:(input,init)=>globalThis.fetch(input,{...init,signal:AbortSignal.timeout(15000)})}),wallet=new PublicKey(WALLET);
 stage='prepare-trade';
 // SDK creates only a transient random public seed for its seeded WSOL address. No funding wallet or signing key is supplied, retained or logged.
 const plan=await prepareTrade({poolId:POOL,side:'buy',amountRaw:'10000000',slippageBps:50,wallet:WALLET});
 if(plan.summary.route!=='launchlab'||plan.summary.poolId!==POOL||plan.summary.outputMint!==MINT||!plan.transactionBase64||!plan.blockhash||!plan.lastValidBlockHeight)throw Error('PLAN_MISMATCH');
 const tx=VersionedTransaction.deserialize(Buffer.from(plan.transactionBase64,'base64'));
 if(tx.signatures.some(signature=>signature.some(byte=>byte!==0)))throw Error('SIGNED_TRANSACTION_FORBIDDEN');
 const storage=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 let callbacks=0,beforeHeight:number|undefined;
 const signingWallet={publicKey:wallet,readOnlyBlockheightRetries:2 as const,
  captureValidity:(validity:{observedBlockHeight?:number})=>{beforeHeight=validity.observedBlockHeight;},
  signTransaction:async(...args:[InstanceType<typeof VersionedTransaction>])=>{
   if(args.length!==1||++callbacks!==1)throw Error('CALLBACK_CONTRACT_MISMATCH');
   const transaction=args[0];
   stage='callback-reads';const [,payer,fee]=await Promise.all([resolveAcceptanceKeys(transaction,c),c.getAccountInfoAndContext(wallet,'confirmed'),c.getFeeForMessage(transaction.message,'confirmed')]);
   if(!payer.value||fee.value===null)throw Error('PAYER_OR_FEE_UNAVAILABLE');
   stage='callback-simulation';const simulation=await c.simulateTransaction(transaction,{sigVerify:false,commitment:'confirmed',minContextSlot:payer.context.slot,accounts:{encoding:'base64',addresses:[WALLET]}});
   const after=simulation.value.accounts?.[0]?.lamports;
   if(simulation.value.err||typeof after!=='number'||payer.value.lamports-after+fee.value>20000000)throw Error('SIMULATION_FAILED');
   // No key, cryptographic signing, GitHub ledger reads/writes or signed-transaction export.
   transaction.signatures[0].fill(1);
   stage='helper-after-callback';return transaction;
  }};
 stage='exact-submission-helper';
 try{
  await signAndSubmitPlan(plan,signingWallet,getRuntime(),c,(state,_detail,validity)=>{
   emit({stage,helperStage:state,requests,...(validity?{validity}:{}),synthetic:true,broadcast:false});
   if(state==='submitted')throw Error('STOP_BEFORE_BROADCAST');
  });
  throw Error('UNEXPECTED_HELPER_RETURN');
 }catch(error){
  if(error instanceof Error&&error.message==='STOP_BEFORE_BROADCAST'&&!stopped&&callbacks===1){
   emit({status:'EXACT_SUBMISSION_READERS_COMPLETE',requests,stage,beforeHeight,quoteExpired:Date.now()>=Date.parse(String(plan.summary.expiresAt)),syntheticSignature:true,cryptographicSigning:false,broadcast:false,ledgerWrites:false});
   storage.clear();return;
  }
  if(error instanceof TransactionValidityError)emit({stage,validityCode:error.code,validity:error.validity,requests,syntheticSignature:callbacks===1,broadcast:false});
  throw error;
 }
}
const safe=new Set(['RPC_CAP_REACHED','PROBE_STOPPED','UNEXPECTED_ENDPOINT_OR_METHOD','INVALID_REQUEST','RPC_METHOD_NOT_ALLOWED','HTTP_FAILURE','RPC_ERROR','INVALID_RPC_ENVELOPE','GENESIS_MISMATCH','TRANSPORT_FAILURE','PLAN_MISMATCH','SIGNED_TRANSACTION_FORBIDDEN','HEIGHT_INVALID_OR_EXPIRED','PAYER_OR_FEE_UNAVAILABLE','SIMULATION_FAILED','CALLBACK_CONTRACT_MISMATCH','UNEXPECTED_HELPER_RETURN']);
main().catch((error:unknown)=>{stopped=true;abort.abort();const code=stopReason||(error instanceof Error&&safe.has(error.message)?error.message:'SDK_OR_VALIDATION_FAILURE');emit({status:'EXACT_SUBMISSION_READERS_STOPPED',requests,stage,code,signed:false,broadcast:false});process.exitCode=1;});
