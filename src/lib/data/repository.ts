import { getRuntime } from '@/lib/runtime';
import { demoAssets,demoFees,demoLaunches } from './demo';
import {indexedLaunches} from './cache';
import { AppError } from '@/lib/errors';
export async function assets(){return getRuntime().mode==='demo'?demoAssets:(await import('@/lib/raydium/service')).getAssetCapabilities();}
export async function launches(){if(getRuntime().mode==='demo')return [...demoLaunches];const cached=await indexedLaunches();return cached||(await import('@/lib/raydium/service')).listVerifiedLaunches();}
export async function launch(mint:string){if(getRuntime().mode!=='demo')return (await import('@/lib/raydium/service')).getVerifiedLaunch(mint);const found=demoLaunches.find(x=>x.mint===mint);if(!found)throw new AppError('LAUNCH_NOT_FOUND','未找到发行记录',404);return found;}
export async function fees(wallet?:string){return getRuntime().mode==='demo'?demoFees:(await import('@/lib/raydium/service')).readFees(wallet);}
