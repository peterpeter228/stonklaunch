import {timingSafeEqual} from 'node:crypto';import {api,AppError} from '@/lib/errors';import {runIndexBatch} from '@/worker/indexer';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=60;
export const GET=(r:Request)=>api(async()=>{
 const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)throw new AppError('CRON_NOT_CONFIGURED','批处理凭据未配置',503);
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(r.headers.get('authorization')||'');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new AppError('CRON_UNAUTHORIZED','批处理认证失败',401);
 return runIndexBatch();
});
