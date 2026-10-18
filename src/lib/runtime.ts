import type { AppMode, RuntimeConfig } from '@/types/domain';
import { loadFeePolicy } from '@/lib/monetization';
import { AppError } from '@/lib/errors';
export function getRuntime():RuntimeConfig{
 const mode=(process.env.APP_MODE||'demo') as AppMode;
 if(!['demo','devnet','mainnet-readonly','mainnet-live'].includes(mode))throw new AppError('INVALID_MODE','APP_MODE 配置无效',503);
 const cluster=mode==='demo'?'demo':mode==='devnet'?'devnet':'mainnet-beta';
 const authConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
 const storageConfigured=authConfigured&&Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
 const blockers:string[]=[];
 if(mode==='demo')blockers.push('DEMO_NO_REAL_TRANSACTIONS');
 if(mode==='mainnet-readonly')blockers.push('READ_ONLY_MODE');
 if(!process.env.SOLANA_RPC_URL&&mode!=='demo')blockers.push('RPC_NOT_CONFIGURED');
 if(!process.env.LAUNCHLAB_PLATFORM_ID)blockers.push('PLATFORM_NOT_CONFIGURED');
 if(!authConfigured)blockers.push('AUTH_NOT_CONFIGURED');
 if(!storageConfigured)blockers.push('STORAGE_NOT_CONFIGURED');
 const policy=loadFeePolicy(process.env);
 return {mode,cluster,origin:process.env.APP_ORIGIN||'http://localhost:3000',platformId:process.env.LAUNCHLAB_PLATFORM_ID||null,platformAdmin:process.env.LAUNCHLAB_PLATFORM_ADMIN||null,walletEnabled:mode==='devnet'||mode==='mainnet-live',authConfigured,storageConfigured,actionsEnabled:process.env.ENABLE_SOLANA_ACTIONS==='true'&&(mode==='devnet'||mode==='mainnet-live'),feePolicy:{platformBps:policy.platformBps,creatorBps:policy.creatorBps,shareBps:policy.shareBps},blockers};
}
export function requireFinancialMode(){const r=getRuntime();if(!r.walletEnabled)throw new AppError(r.mode==='demo'?'DEMO_NO_REAL_TRANSACTIONS':'READ_ONLY_MODE','当前模式禁止真实资金交易构建',403);if(!process.env.SOLANA_RPC_URL)throw new AppError('RPC_NOT_CONFIGURED','尚未配置该网络的 RPC',503);return r;}
export function assertSameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(getRuntime().origin).origin)throw new AppError('ORIGIN_NOT_ALLOWED','请求来源不允许',403);}
export function provenance(source:string){return {cluster:getRuntime().cluster,dataSource:source,observedAt:new Date().toISOString(),slot:null,isStale:false};}
