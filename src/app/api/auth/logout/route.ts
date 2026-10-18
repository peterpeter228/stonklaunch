import {api} from '@/lib/errors';
export const dynamic='force-dynamic';
import {authClient} from '@/lib/auth/server';
import {assertSameOrigin} from '@/lib/runtime';
export const POST=(r:Request)=>api(async()=>{assertSameOrigin(r);const c=await authClient();const {error}=await c.auth.signOut({scope:'local'});if(error)throw new Error('Logout failed');return {signedOut:true};});
