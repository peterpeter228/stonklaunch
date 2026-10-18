import {api} from '@/lib/errors';import {externalDiscovery} from '@/lib/data/discovery';
export const dynamic='force-dynamic';
export const GET=()=>api(externalDiscovery);
