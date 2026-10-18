import {authClient,registerVerifiedWallet} from '@/lib/auth/server';import {AppError} from '@/lib/errors';import {getRuntime} from '@/lib/runtime';
export async function saveDraft(id:string,parameters:Record<string,unknown>,session:{userId:string;wallet:string},clientMint?:string){
 await registerVerifiedWallet(session);const client=await authClient();
 const {data:old,error:readError}=await client.from('launch_drafts').select('draft_id,client_mint_public_key,confirmed_signature').eq('draft_id',id).eq('owner_user_id',session.userId).maybeSingle();
 if(readError)throw new AppError('DRAFT_READ_FAILED','无法读取原草稿，未覆盖数据',503);
 if(old?.confirmed_signature)throw new AppError('DRAFT_ALREADY_CONFIRMED','草稿已有确认交易，请查看原发行',409);
 if(old?.client_mint_public_key&&clientMint&&old.client_mint_public_key!==clientMint)throw new AppError('IDEMPOTENCY_CONFLICT','同一草稿不能替换原 mint；请先查询原交易',409);
 const values={parameters,...(clientMint?{client_mint_public_key:clientMint}:{})};
 const result=old?await client.from('launch_drafts').update(values).eq('draft_id',id).eq('owner_user_id',session.userId):await client.from('launch_drafts').insert({draft_id:id,owner_user_id:session.userId,owner_wallet:session.wallet,cluster:getRuntime().cluster,...values});
 if(result.error)throw new AppError('DRAFT_SAVE_FAILED','草稿持久保存失败；未构建交易',503);return {draftId:id,saved:true};
}
