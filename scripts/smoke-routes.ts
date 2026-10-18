import assert from 'node:assert/strict';
async function main(){
 process.env.APP_MODE='demo';process.env.APP_ORIGIN='http://localhost:3000';
 const runtime=await import('../src/app/api/runtime/route');const r=await runtime.GET();const body=await r.json();assert.equal(body.data.mode,'demo');assert.equal(body.data.walletEnabled,false);console.log('PASS runtime demo mode, wallet disabled');
 for(const path of ['launches/prepare','trades/quote','trades/prepare','fees/prepare-claim','admin/platform/prepare']){
 const route=await import(`../src/app/api/${path}/route.ts`);const response=await route.POST(new Request(`http://localhost:3000/api/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));assert.equal(response.status,403,path);const json=await response.json();assert.equal(json.error.code,'DEMO_NO_REAL_TRANSACTIONS',path);console.log(`PASS ${path} refuses real construction in DEMO`);
 }
 process.env.APP_MODE='mainnet-readonly';
 const prepare=await import('../src/app/api/trades/prepare/route');const readonly=await prepare.POST(new Request('http://localhost:3000/api/trades/prepare',{method:'POST',body:'{}'}));assert.equal(readonly.status,403);assert.equal((await readonly.json()).error.code,'READ_ONLY_MODE');console.log('PASS readonly trade rejection');
 process.env.APP_MODE='demo';
 const actions=await import('../src/app/api/actions/buy/[poolId]/route');const c={params:Promise.resolve({poolId:'demo'})};const get=await actions.GET(new Request('http://localhost:3000'),c);assert.equal((await get.json()).disabled,true);assert.equal(actions.OPTIONS().status,204);const post=await actions.POST(new Request('http://localhost:3000',{method:'POST',body:'{}'}),c);assert.equal(post.status,403);console.log('PASS Actions GET disabled, OPTIONS available, POST mode rejection');
}
main().catch(e=>{console.error(e);process.exitCode=1});
