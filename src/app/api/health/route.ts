import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {getRuntime} from '@/lib/runtime';
export const GET=()=>api(()=>{const r=getRuntime();return {status:r.blockers.length?'degraded':'ready',mode:r.mode,cluster:r.cluster,authConfigured:r.authConfigured,storageConfigured:r.storageConfigured,blockers:r.blockers,checkedAt:new Date().toISOString()};});
