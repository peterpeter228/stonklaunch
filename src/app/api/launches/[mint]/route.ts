import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {launch} from '@/lib/data/repository';
export const GET=(_r:Request,c:{params:Promise<{mint:string}>})=>api(async()=>launch((await c.params).mint));
