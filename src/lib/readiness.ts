/** Infrastructure readiness only: no wallet, transaction, storage write or Auth login. */
import { PublicKey } from '@solana/web3.js';
import { loadFeePolicy } from './monetization';
type Environment = Record<string, string | undefined>;
export type Readiness = { status: 'ready' | 'not_ready'; scope: 'infrastructure_only'; codes: string[]; checkedAt: string };
type Options = { env?: () => Environment; fetcher?: typeof fetch; now?: () => number; timeoutMs?: number; ttlMs?: number };
const genesis = {devnet:'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG','mainnet-readonly':'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','mainnet-live':'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'};
function canonicalOrigin(value:string|undefined){try{const u=new URL(value||'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&u.origin===value&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}}
function validKey(value:string|undefined){try{return Boolean(value&&new PublicKey(value));}catch{return false;}}
export function createReadinessProbe(options:Options={}){
 const env=options.env||(()=>process.env), fetcher=options.fetcher||fetch, now=options.now||Date.now, timeoutMs=options.timeoutMs??5000, ttlMs=options.ttlMs??30000;
 let cached:{result:Readiness;expires:number}|undefined,inFlight:Promise<Readiness>|undefined;
 async function check():Promise<Readiness>{
  const e=env(),codes:string[]=[],mode=e.APP_MODE||'demo';
  const result=():Readiness=>({status:codes.length?'not_ready':'ready',scope:'infrastructure_only',codes,checkedAt:new Date(now()).toISOString()});
  if(mode==='demo'){codes.push('DEMO_NOT_PRODUCTION_READY');return result();}
  if(!Object.hasOwn(genesis,mode)){codes.push('INVALID_MODE');return result();}
  if(!canonicalOrigin(e.APP_ORIGIN))codes.push('APP_ORIGIN_INVALID');
  if(!canonicalOrigin(e.NEXT_PUBLIC_SUPABASE_URL))codes.push('SUPABASE_URL_INVALID');
  // RPC can have a provider token in its path/query; it is never returned or logged.
  try{const rpc=new URL(e.SOLANA_RPC_URL||'');if(rpc.protocol!=='https:'||rpc.username||rpc.password||rpc.hash)codes.push('RPC_URL_INVALID');}catch{codes.push('RPC_URL_INVALID');}
  if(!e.NEXT_PUBLIC_SUPABASE_ANON_KEY)codes.push('AUTH_NOT_CONFIGURED');
  if(!e.SUPABASE_SERVICE_ROLE_KEY)codes.push('DATABASE_NOT_CONFIGURED');
  if(mode!=='mainnet-readonly'&&!e.NEXT_PUBLIC_SOLANA_RPC_URL)codes.push('BROWSER_RPC_NOT_CONFIGURED');
  for(const key of ['LAUNCHLAB_PLATFORM_ID','LAUNCHLAB_PLATFORM_ADMIN','LAUNCHLAB_SOL_CONFIG_ID','LAUNCHLAB_CPMM_CONFIG_ID','LAUNCHLAB_PLATFORM_FEE_WALLET'])if(!validKey(e[key]))codes.push(key+'_INVALID');
  try{loadFeePolicy(e);}catch{codes.push('FEE_POLICY_INVALID');}
  const bucket=e.SUPABASE_ASSET_BUCKET||'stonklaunch-assets';
  if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket))codes.push('ASSET_BUCKET_INVALID');
  if(Buffer.byteLength(`${e.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/metadata/${'0'.repeat(36)}/${'0'.repeat(64)}.json`)>200)codes.push('METADATA_URI_TOO_LONG');
  if(codes.length)return result();
  async function rpc(){try{
   const response=await fetcher(e.SOLANA_RPC_URL!,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getGenesisHash'}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok)return 'RPC_UNAVAILABLE';
   const data=await response.json();
   return data.result===genesis[mode as keyof typeof genesis]&&!data.error?null:'RPC_CLUSTER_UNVERIFIED';
  }catch{return 'RPC_UNAVAILABLE';}}
  async function database(){try{
   // Target comes solely from validated server configuration, never request parameters.
   // Private table: unlike a public projection, an anon key cannot satisfy this probe.
   const response=await fetcher(`${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/indexer_cursors?select=cluster&limit=1`,{headers:{apikey:e.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${e.SUPABASE_SERVICE_ROLE_KEY!}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok)return 'DATABASE_UNAVAILABLE';
   return Array.isArray(await response.json())?null:'DATABASE_UNAVAILABLE';
  }catch{return 'DATABASE_UNAVAILABLE';}}
  for(const code of await Promise.all([rpc(),database()]))if(code)codes.push(code);
  return result();
 }
 return function ready():Promise<Readiness>{
  if(cached&&now()<cached.expires)return Promise.resolve(cached.result);
  if(inFlight)return inFlight;
  inFlight=check().catch(()=>({status:'not_ready' as const,scope:'infrastructure_only' as const,codes:['READINESS_CHECK_FAILED'],checkedAt:new Date(now()).toISOString()})).then(result=>{cached={result,expires:now()+ttlMs};return result;}).finally(()=>{inFlight=undefined;});
  return inFlight;
 };
}
export const infrastructureReadiness=createReadinessProbe();
