import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {fees} from '@/lib/data/repository';
import {getVerifiedSession} from '@/lib/auth/server';
export const GET=()=>api(async()=>fees((await getVerifiedSession())?.wallet||undefined));
