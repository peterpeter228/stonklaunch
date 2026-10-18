import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {assets} from '@/lib/data/repository';
export const GET=()=>api(async()=>({items:await assets()}));
