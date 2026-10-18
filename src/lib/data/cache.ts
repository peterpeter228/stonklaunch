import type {Launch} from '@/types/domain';import {serviceClient} from './supabase';import {getRuntime} from '@/lib/runtime';import {AppError} from '@/lib/errors';
/** Read-only index snapshots. Never used to quote, build or authenticate. */
export async function indexedLaunches(mint?:string):Promise<Launch[]|null>{
 const runtime=getRuntime();if(runtime.mode==='demo'||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.NEXT_PUBLIC_SUPABASE_URL||!runtime.platformId)return null;
 let query=serviceClient().from('launches').select('payload,observed_at,confirmed_slot').eq('cluster',runtime.cluster).eq('platform_id',runtime.platformId).order('observed_at',{ascending:false}).limit(100);
 if(mint)query=query.eq('mint_a',mint);
 const {data,error}=await query;if(error)throw new AppError('INDEX_READ_FAILED','持久索引暂不可读',503);
 if(!data?.length)return null;
 return data.map(row=>{const value=row.payload as Launch;if(value.cluster!==runtime.cluster||value.platformId!==runtime.platformId||!value.mint||!value.poolId)throw new AppError('INVALID_INDEX_SNAPSHOT','索引记录绑定不一致',503);return {...value,observedAt:row.observed_at,slot:row.confirmed_slot,dataSource:'supabase-index:verified-solana-rpc',isStale:!row.observed_at||Date.now()-Date.parse(row.observed_at)>60000};});
}
