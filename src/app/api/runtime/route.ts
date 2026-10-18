import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {getRuntime} from '@/lib/runtime';
export const GET=()=>api(()=>getRuntime());
