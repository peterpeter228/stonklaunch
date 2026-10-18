import { infrastructureReadiness } from '@/lib/readiness';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=10;
/** Public, bounded infrastructure probe. Does not certify financial launch readiness. */
export async function GET(){
 const result=await infrastructureReadiness();
 return Response.json(result,{status:result.status==='ready'?200:503,headers:{'Cache-Control':'no-store'}});
}
