import {api,AppError} from '@/lib/errors';
import {launches} from '@/lib/data/repository';
import {getRuntime} from '@/lib/runtime';
export const dynamic='force-dynamic';
export const GET=(r:Request)=>api(async()=>{
 const q=new URL(r.url).searchParams;const limit=Math.min(50,Math.max(1,Number(q.get('limit')||12)));if(!Number.isInteger(limit))throw new AppError('INVALID_LIMIT','分页数量无效');
 const status=q.get('status');if(status&&!['0','1','2'].includes(status))throw new AppError('INVALID_STATUS','状态筛选无效');
 const creator=q.get('creator');const cursor=q.get('cursor');let items=await launches();
 if(status)items=items.filter(x=>x.status===Number(status));if(creator)items=items.filter(x=>x.creator===creator);
 items=items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.poolId.localeCompare(b.poolId));
 const offset=cursor?items.findIndex(x=>x.poolId===cursor)+1:0;if(cursor&&offset===0)throw new AppError('INVALID_CURSOR','分页游标已失效，请刷新列表');
 const page=items.slice(offset,offset+limit);return {items:page,nextCursor:offset+limit<items.length?page.at(-1)?.poolId:null,coverage:getRuntime().mode==='demo'?'Synthetic demonstration fixtures only':'Verified observed StonkLaunch pools only; not all Solana launches'};
});
