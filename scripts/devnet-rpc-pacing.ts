/** Runner-only public devnet pacing. No retries, credential access, or transaction interpretation. */
export function pacedDevnetFetch(raw:typeof fetch,emit:(event:Record<string,unknown>)=>void,clock=Date.now,sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))):typeof fetch{
 const endpoint='https://api.devnet.solana.com';let next=0,queue=Promise.resolve(),stopped=false;const abort=new AbortController();
 const names=new Set(['Error','TypeError','AbortError','TimeoutError','SyntaxError']);
 const codes=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET']);
 return async(input,init)=>{
  // GitHub CAS and SDK metadata requests are untouched. Never log their URL or headers.
  if(String(input)!==endpoint)return raw(input,init);
  let method='UNKNOWN';try{const value=JSON.parse(String(init?.body)).method;if(typeof value==='string'&&/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value))method=value;}catch{}
  const turn=queue.then(async()=>{if(stopped)throw Error('DEVNET_RPC_STOPPED');init?.signal?.throwIfAborted();const wait=Math.max(0,next-clock());if(wait)await sleep(wait);if(stopped)throw Error('DEVNET_RPC_STOPPED');init?.signal?.throwIfAborted();next=clock()+334;});
  queue=turn.catch(()=>{});await turn;
  const started=clock();let httpStatus:number|null=null;
  try{
   const response=await raw(input,{...init,redirect:'error',signal:AbortSignal.any([abort.signal,...(init?.signal?[init.signal]:[])])});httpStatus=response.status;
   // Fail closed across queued reads/submission after provider refusal. Never retry 429, even without Retry-After.
   if(httpStatus===429||httpStatus===403){stopped=true;abort.abort();}
   let rpcErrorCode:number|null=null;
   if(response.ok){try{const body=await response.clone().json();if(Number.isSafeInteger(body?.error?.code))rpcErrorCode=body.error.code;}catch{}}
   emit({method,httpStatus,rpcErrorCode,durationMs:clock()-started});
   if(stopped)throw Error('DEVNET_RPC_STOPPED');
   return response;
  }catch(error){
   const e=error as {name?:string;code?:string;cause?:{code?:string}},code=e.cause?.code??e.code;
   emit({method,httpStatus,durationMs:clock()-started,errorName:names.has(e.name||'')?e.name:'OtherError',errorCode:codes.has(code||'')?code:null});
   throw error;
  }
 };
}
