import {createHash} from 'node:crypto';import {api,readJson,AppError} from '@/lib/errors';import {requireSession} from '@/lib/auth/server';import {requireFinancialMode,assertSameOrigin} from '@/lib/runtime';import {launchInput} from '@/lib/data/validation';import {uploadPublic} from '@/lib/data/supabase';import {prepareLaunch} from '@/lib/raydium/service';import {saveDraft} from '@/lib/data/drafts';
export const POST=(r:Request)=>api(async()=>{
 assertSameOrigin(r);const runtime=requireFinancialMode();const s=await requireSession(r);const input=launchInput.parse(await readJson(r));
 const key=r.headers.get('idempotency-key');if(!key||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new AppError('IDEMPOTENCY_KEY_REQUIRED','需要 UUID Idempotency-Key 以恢复同一草稿');
 if(input.imageUrl){const prefix=`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_ASSET_BUCKET||'stonklaunch-assets'}/icons/${s.userId}/`;if(!input.imageUrl.startsWith(prefix))throw new AppError('UNTRUSTED_IMAGE_URL','请使用当前登录账户上传的持久图标');}
 const metadata=JSON.stringify({name:input.name,symbol:input.symbol,description:input.description,image:input.imageUrl||undefined});const hash=createHash('sha256').update(metadata).digest('hex');
 const metadataUri=await uploadPublic(`metadata/${s.userId}/${hash}.json`,metadata,'application/json');
 await saveDraft(key,{...input,metadataUri},s,input.clientMintPublicKey);
 return prepareLaunch({...input,metadataUri},s.wallet);
});
