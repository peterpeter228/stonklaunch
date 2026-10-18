import sharp from 'sharp';import {createHash} from 'node:crypto';import {api,AppError,readBodyLimited} from '@/lib/errors';import {requireSession} from '@/lib/auth/server';import {assertSameOrigin,getRuntime} from '@/lib/runtime';import {uploadPublic} from '@/lib/data/supabase';
export const runtime='nodejs';
export const POST=(r:Request)=>api(async()=>{
 assertSameOrigin(r);if(getRuntime().mode==='demo')throw new AppError('DEMO_LOCAL_PREVIEW_ONLY','演示图标仅保留在浏览器，不会上传至真实存储',403);
 const s=await requireSession(r);if(Number(r.headers.get('content-length')||0)>3*1024*1024)throw new AppError('IMAGE_TOO_LARGE','图片不得超过 2 MB',413);
 const body=await readBodyLimited(r,3*1024*1024);const file=(await new Response(body,{headers:{'Content-Type':r.headers.get('content-type')||''}}).formData()).get('file');if(!(file instanceof File)||file.size>2*1024*1024||file.size===0)throw new AppError('INVALID_IMAGE','请选择不超过 2 MB 的 PNG、JPEG 或 WebP 图片');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new AppError('INVALID_IMAGE_TYPE','仅支持 PNG、JPEG 或 WebP');
 let image:Buffer;try{const decoded=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:16000000,animated:false});const metadata=await decoded.metadata();if(!metadata.format||!['png','jpeg','webp'].includes(metadata.format))throw new Error('Unsupported image bytes');image=await decoded.rotate().resize(512,512,{fit:'cover',withoutEnlargement:true}).png().toBuffer();}catch{throw new AppError('INVALID_IMAGE','图片无法安全解码');}
 const digest=createHash('sha256').update(image).digest('hex');const url=await uploadPublic(`icons/${s.userId}/${digest}.png`,image,'image/png');return {url,contentType:'image/png',bytes:image.length};
});
