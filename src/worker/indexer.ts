import {reconcilePlatformClaims,type ClaimCursor} from '@/lib/raydium/reconcile';
import {pathToFileURL} from 'node:url';
import {indexBatch} from '@/lib/raydium/service';import {serviceClient} from '@/lib/data/supabase';import {getRuntime} from '@/lib/runtime';import {AppError} from '@/lib/errors';
/** Bounded snapshot worker. Does not invent swap/claim events from balances. */
export async function runIndexBatch(){
 const runtime=getRuntime();if(runtime.mode==='demo')throw new AppError('DEMO_DATABASE_ISOLATION','演示模式不运行真实索引器',403);
 const db=serviceClient();const stream='platform-pool-snapshots';
 const {data:old,error:readError}=await db.from('indexer_cursors').select('cursor').eq('cluster',runtime.cluster).eq('stream',stream).eq('partition','default').maybeSingle();
 if(readError)throw new AppError('CURSOR_READ_FAILED','无法读取持久游标',503);
 const batch=Number(process.env.INDEXER_BATCH_SIZE||50);if(!Number.isInteger(batch)||batch<1||batch>100)throw new AppError('INVALID_INDEXER_BATCH','索引批次数量必须为 1–100',503);
 try{
  const result=await indexBatch({cursor:old?.cursor,limit:batch});
  for(const p of result.pools){
   if(p.cluster!==runtime.cluster||!p.platformId||p.platformId!==runtime.platformId||p.slot===null)throw new AppError('INDEXER_BINDING_REJECTED','索引数据不符合网络或平台绑定',409);
   const row={cluster:p.cluster,pool_id:p.poolId,mint_a:p.mint,mint_b:p.quoteMint,platform_id:p.platformId,creator:p.creator,name:p.name,symbol:p.symbol,description:p.description,image_url:p.imageUrl,metadata_uri:p.metadataUri,status:p.status,raised_raw:p.raisedRaw,target_raw:p.targetRaw,volume_raw:p.volumeRaw,cpmm_pool_id:p.cpmmPoolId,cpmm_verified:p.cpmmVerified,lp_evidence:p.lpEvidence?{description:p.lpEvidence}:null,confirmed_slot:p.slot,signature:p.signature,observed_at:p.observedAt,data_source:p.dataSource,payload:p,...(p.createdAt?{created_at:p.createdAt}:{})};
   const {error}=await db.from('launches').upsert(row,{onConflict:'cluster,pool_id'});if(error)throw new AppError('INDEXER_WRITE_FAILED','池快照写入失败，游标未推进',503);
  }
  const {error}=await db.from('indexer_cursors').upsert({cluster:runtime.cluster,stream,partition:'default',cursor:result.cursor,slot:result.cursor.slot,last_success_at:new Date().toISOString(),last_error_code:null,updated_at:new Date().toISOString()},{onConflict:'cluster,stream,partition'});
  if(error)throw new AppError('CURSOR_WRITE_FAILED','快照已幂等写入，但持久游标未推进',503);
  const reconciliation=await reconcileClaims();
  return {reconciliation,indexed:result.pools.length,cluster:runtime.cluster,cursor:result.cursor,observedAt:result.observedAt,coverage:result.coverage,blockers:result.blockers,financialEventsWritten:reconciliation.claimsWritten};
 }catch(e){
  await db.from('indexer_cursors').upsert({cluster:runtime.cluster,stream,partition:'default',cursor:old?.cursor||null,last_error_code:e instanceof AppError?e.code:'RPC_UNAVAILABLE',updated_at:new Date().toISOString()},{onConflict:'cluster,stream,partition'});throw e;
 }
}
async function reconcileClaims(){
 const db=serviceClient(),cluster=getRuntime().cluster,stream='finalized-platform-claims';
 const {data,error}=await db.from('indexer_cursors').select('cursor').eq('cluster',cluster).eq('stream',stream).eq('partition','default').maybeSingle();
 if(error)return {claimsWritten:0,blockers:['CLAIM_CURSOR_READ_FAILED']};
 try{
  const result=await reconcilePlatformClaims({cursor:(data?.cursor||{}) as ClaimCursor,limit:20});
  for(const claim of result.claims){
   const {error:writeError}=await db.from('fee_claims').upsert({cluster,signature:claim.signature,event_index:claim.eventIndex,claimant:claim.claimant,quote_mint:claim.quoteMint,amount_raw:claim.amountRaw,destination:claim.destination,status:'finalized',claim_scope:claim.claimScope,attribution_status:claim.attributionStatus,slot:claim.slot,observed_at:claim.observedAt},{onConflict:'cluster,signature,event_index'});
   if(writeError)throw new AppError('CLAIM_WRITE_FAILED','已验证领取证据写入失败',503);
  }
  const {error:cursorError}=await db.from('indexer_cursors').upsert({cluster,stream,partition:'default',cursor:result.cursor,last_success_at:new Date().toISOString(),last_error_code:null,updated_at:new Date().toISOString()},{onConflict:'cluster,stream,partition'});
  if(cursorError)throw new AppError('CLAIM_CURSOR_WRITE_FAILED','领取游标无法保存',503);
  return {claimsWritten:result.claims.length,coverage:result.coverage,blockers:result.blockers};
 }catch(e){return {claimsWritten:0,blockers:[e instanceof AppError?e.code:'CLAIM_RECONCILIATION_UNAVAILABLE']};}
}

async function main(){
 const watch=process.argv.includes('--watch');const interval=Number(process.env.INDEXER_POLL_INTERVAL_MS||10000);if(!Number.isInteger(interval)||interval<10000||interval>3600000)throw new AppError('INVALID_POLL_INTERVAL','轮询间隔须为 10000–3600000 毫秒',503);
 let stop=false;process.once('SIGTERM',()=>{stop=true;});process.once('SIGINT',()=>{stop=true;});
 do{try{console.log(JSON.stringify(await runIndexBatch()));}catch(e){console.error(JSON.stringify({code:e instanceof AppError?e.code:'INDEXER_FAILED',message:'Batch failed. No financial confirmation inferred.'}));if(!watch){process.exitCode=1;return;}}if(watch&&!stop)await new Promise(resolve=>setTimeout(resolve,interval));}while(watch&&!stop);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('INDEXER_CONFIGURATION_ERROR');process.exitCode=1;});
