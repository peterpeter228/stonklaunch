import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PublicKey } from '@solana/web3.js';
import { AppError } from '@/lib/errors';
import { getRuntime } from '@/lib/runtime';
export async function authClient(){
 if(!getRuntime().authConfigured)throw new AppError('AUTH_NOT_CONFIGURED','服务器登录尚未配置，请使用本地草稿与公开浏览',503);
 const store=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>store.getAll(),setAll:(values)=>{for(const {name,value,options} of values)store.set(name,value,options);}}});
}
export async function getVerifiedSession(){
 if(!getRuntime().authConfigured)return null;
 const client=await authClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 // Only Auth-server verified identity identifiers, never editable user_metadata.
 const identity=user.identities?.find(i=>i.provider==='web3' && typeof i.identity_data?.sub==='string' && i.identity_data.sub.startsWith('web3:solana:'));
 let wallet:string|null=null;
 if(identity){const candidate=identity.identity_data?.sub.slice('web3:solana:'.length);try{wallet=new PublicKey(candidate).toBase58();}catch{wallet=null;}}
 return {userId:user.id,wallet,role:wallet&&wallet===getRuntime().platformAdmin?'admin' as const:'creator' as const};
}
export async function requireSession(request?:Request){const s=await getVerifiedSession();if(!s)throw new AppError('AUTH_REQUIRED','请先通过 Supabase 钱包登录',401);if(!s.wallet)throw new AppError('VERIFIED_SOLANA_IDENTITY_REQUIRED','登录会话没有可验证的 Solana 钱包身份',403);const connected=request?.headers.get('x-wallet-address');if(request&&request.method!=='GET'&&!connected)throw new AppError('WALLET_CONTEXT_REQUIRED','写入前需要明确当前连接的钱包',403);if(connected&&connected!==s.wallet)throw new AppError('WALLET_SESSION_MISMATCH','当前钱包与登录身份不一致，请重新登录',403);return {...s,wallet:s.wallet};}

export async function registerVerifiedWallet(session:{userId:string;wallet:string}){const {serviceClient}=await import('@/lib/data/supabase');const {error}=await serviceClient().from('verified_wallets').upsert({user_id:session.userId,wallet:session.wallet},{onConflict:'user_id,wallet'});if(error)throw new AppError('WALLET_BINDING_FAILED','无法持久保存已验证的钱包身份',503);}
