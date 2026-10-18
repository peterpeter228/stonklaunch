import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {getVerifiedSession} from '@/lib/auth/server';
export const GET=()=>api(async()=>({session:await getVerifiedSession()}));
