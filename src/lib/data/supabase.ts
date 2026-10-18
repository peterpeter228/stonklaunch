import { createClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/errors';
import { getRuntime } from '@/lib/runtime';
export function serviceClient(){if(getRuntime().mode==='demo')throw new AppError('DEMO_DATABASE_ISOLATION','演示数据不能写入真实数据库',403);const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new AppError('DATABASE_NOT_CONFIGURED','持久数据库尚未配置',503);return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});}
export async function uploadPublic(path:string,body:Buffer|string,contentType:string){
 const client=serviceClient();const bucket=process.env.SUPABASE_ASSET_BUCKET||'stonklaunch-assets';
 const {error}=await client.storage.from(bucket).upload(path,body,{contentType,upsert:false,cacheControl:'31536000'});
 if(error&& !error.message.toLowerCase().includes('already exists'))throw new AppError('STORAGE_WRITE_FAILED','持久存储写入失败',503);
 const {data}=client.storage.from(bucket).getPublicUrl(path);return data.publicUrl;
}
