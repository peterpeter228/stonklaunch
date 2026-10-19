// REVIEW DRAFT. Copy to e2e/ only after root approval; never run against an unready deployment.
// No framework reporter, browser console forwarding, traces, screenshots, HAR or storageState.
import { chromium } from '@playwright/test';
import { PublicKey } from '@solana/web3.js';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import sharp from 'sharp';
const ORIGIN = 'https://stonklaunch-demo.onrender.com';
const root = `${ORIGIN}/`;
const publicURL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const fixture = `hosted-fixture-${Date.now()}`;
let phase = 'preflight', browser, failedAssertion=null;
let preflightDiagnostic = null;
const checks = [], identities = [];
function check(condition, label) { if (!condition) {failedAssertion=label;throw new Error(label);} checks.push(label); }
function ok(label) { checks.push(label); }
function summary(status) {
  console.log(JSON.stringify({status, phase, failedAssertion, fixture, checks, preflightDiagnostic,
    accounts:identities.map(x=>x.address),
    retained:'Two test auth accounts, labelled private drafts and tiny public PNG fixtures. No deletion.'}));
}
function guardRuntime(body) {
  check(body.data?.mode === 'mainnet-readonly', 'mode-mainnet-readonly');
  check(body.data?.cluster === 'mainnet-beta', 'cluster-mainnet-beta');
  check(body.data?.walletEnabled === false && body.data?.actionsEnabled === false, 'financial-guards-disabled');
  check(new URL(body.data.origin).origin === ORIGIN, 'canonical-app-origin');
  check(body.data.authConfigured && body.data.storageConfigured, 'hosted-auth-storage-configured');
}
async function app(page, path, wallet, body) {
  return page.evaluate(async ({path,wallet,body})=>{
    const r = await fetch(path,{cache:'no-store', method:body===undefined?'GET':'POST',
      headers:{...(wallet?{'x-wallet-address':wallet}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status, body:await r.json()};
  },{path,wallet,body});
}
async function connect(page) {
  await page.getByText('Mainnet · Read-only. Financial actions are disabled.',{exact:true}).waitFor();
  await page.locator('.workflow-page').getByRole('button',{name:'Connect wallet',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Connect Solana wallet',exact:true}).click();
}
async function session(actor) {
  const result = await app(actor.page,'/api/auth/session');
  check(result.status===200 && result.body.data?.session?.wallet===actor.address, `${actor.label}-server-session`);
  actor.userId=result.body.data.session.userId;
  return result.body.data.session;
}
async function waitForm(page) { await page.getByLabel('Private draft name',{exact:true}).waitFor({state:'visible'}); }
async function createActor(label) {
  const pair=generateKeyPairSync('ed25519');
  const address=new PublicKey(pair.publicKey.export({type:'spki',format:'der'}).subarray(-32)).toBase58();
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  const actor={label,address,context,token:null,signatures:0,blocked:0}; identities.push(actor);
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url()), method=req.method();
    const safeApp=url.origin===ORIGIN && (['GET','HEAD'].includes(method) ||
      (method==='POST' && ['/api/drafts','/api/uploads','/api/auth/logout','/api/launches/prepare','/api/trades/prepare','/api/fees/prepare-claim','/api/admin/platform/prepare'].includes(url.pathname)));
    const safeAuth=url.origin===new URL(publicURL).origin && url.pathname.startsWith('/auth/v1/') && ['GET','POST','OPTIONS'].includes(method);
    const safeImage=url.origin===new URL(publicURL).origin && url.pathname.startsWith('/storage/v1/object/public/') && ['GET','HEAD'].includes(method);
    if (!safeApp&&!safeAuth&&!safeImage) {actor.blocked++;return route.abort();}
    return route.continue();
  });
  await context.exposeBinding('__signLoginOnly',({frame},message)=>{
    if(new URL(frame.url()).origin!==ORIGIN)throw new Error('SIGN_ORIGIN_REJECTED');
    const bytes=Buffer.from(message), lines=bytes.toString('utf8').split('\n');
    const exact=[`${new URL(root).host} wants you to sign in with your Solana account:`,address,'',
      'Sign in to StonkLaunch only. This message does not transfer assets or authorize a transaction.','',
      'Version: 1',`URI: ${root}`];
    if(bytes.length>2048||lines.length!==8||!exact.every((v,i)=>lines[i]===v)||!/^Issued At: /.test(lines[7])||
      Math.abs(Date.now()-Date.parse(lines[7].slice(11)))>120000||!Number.isFinite(Date.parse(lines[7].slice(11))))throw new Error('NON_LOGIN_MESSAGE_REJECTED');
    if(++actor.signatures>2)throw new Error('SIGNATURE_BUDGET_EXCEEDED');
    return Array.from(sign(null,bytes,pair.privateKey));
  });
  await context.addInitScript(({address})=>{
    const events=new Map();let current=address;
    const key=()=>({toBase58:()=>current,toString:()=>current});
    const provider={get publicKey(){return key();},isConnected:true,
      connect:async()=>({publicKey:key()}),
      signMessage:async bytes=>new Uint8Array(await window.__signLoginOnly(Array.from(bytes))),
      on:(event,fn)=>{if(!events.has(event))events.set(event,new Set());events.get(event).add(fn);},
      removeListener:(event,fn)=>events.get(event)?.delete(fn)};
    Object.defineProperty(window,'solana',{value:provider});
    window.__switchTestWallet=next=>{current=next;for(const fn of events.get('accountChanged')||[])fn(key());};
    // Deliberately no signTransaction, signAllTransactions, sendTransaction or signAndSendTransaction.
  },{address});
  const page=await context.newPage();actor.page=page;page.setDefaultTimeout(25000);
  page.on('response',async response=>{
    const url=new URL(response.url());
    if(url.origin===new URL(publicURL).origin && url.pathname==='/auth/v1/token' && response.ok()) {
      try {const data=await response.json();if(typeof data.access_token==='string')actor.token=data.access_token;}catch{}
    }
  });
  await page.goto(`${ORIGIN}/drafts`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Your private drafts.'}).waitFor();
  await connect(page);
  const tokenResponse=page.waitForResponse(r=>new URL(r.url()).origin===new URL(publicURL).origin && new URL(r.url()).pathname==='/auth/v1/token');
  await page.getByRole('button',{name:'Sign in with wallet',exact:true}).click();
  const response=await tokenResponse;
  check(response.ok(),`${label}-real-web3-auth-response`);
  const tokenBody=await response.json();actor.token=tokenBody.access_token;
  check(typeof actor.token==='string' && actor.signatures===1,`${label}-one-login-message-signature`);
  check(response.request().headers().apikey===publicKey,`${label}-public-config-matches-site`);
  check(new URL(response.url()).searchParams.get('grant_type')==='web3',`${label}-web3-grant`);
  await waitForm(page);await session(actor);
  return actor;
}
async function save(actor) {
  const name=`${fixture}-${actor.label}`.slice(-32);
  await actor.page.getByLabel('Private draft name',{exact:true}).fill(name);
  await actor.page.getByLabel('Private draft symbol',{exact:true}).fill(`TEST${actor.label}`);
  await actor.page.getByLabel('Private draft description',{exact:true}).fill(`TEST FIXTURE ${fixture}: disposable acceptance data, no funds or transactions.`);
  const pending=actor.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/drafts'&&r.request().method()==='POST');
  await actor.page.getByRole('button',{name:'Save private draft',exact:true}).click();
  const response=await pending, data=await response.json();
  check(response.ok()&&data.data?.saved===true,`${actor.label}-saved-server-draft`);
  actor.draftId=data.data.draftId;actor.name=name;
  await actor.page.getByText('Private draft saved to the server.',{exact:true}).waitFor();
  await actor.page.reload({waitUntil:'domcontentloaded'});await connect(actor.page);await waitForm(actor.page);
  await actor.page.getByRole('button',{name:'Open draft',exact:true}).click();
  check(await actor.page.getByLabel('Private draft name',{exact:true}).inputValue()===name,`${actor.label}-reload-persists-text`);
}
async function rls(actor, target) {
  const response=await fetch(`${publicURL}/rest/v1/launch_drafts?select=draft_id&draft_id=eq.${target}`,{
    headers:{apikey:publicKey,Authorization:`Bearer ${actor.token}`},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('RLS_READ_FAILED');
  return response.json();
}
async function upload(actor, png) {
  const pending=actor.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/uploads'&&r.request().method()==='POST');
  await actor.page.getByLabel('Public artwork upload',{exact:true}).setInputFiles({name:`test-fixture-${actor.label}.png`,mimeType:'image/png',buffer:png});
  const response=await pending, body=await response.json();
  check(response.ok()&&body.data?.contentType==='image/png',`${actor.label}-public-png-upload`);
  const url=new URL(body.data.url);
  check(url.origin===new URL(publicURL).origin && new RegExp(`/storage/v1/object/public/[^/]+/icons/${actor.userId}/[a-f0-9]{64}\\.png$`).test(url.pathname),`${actor.label}-upload-owner-namespace`);
  const result=await fetch(url,{signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await result.arrayBuffer());
  check(result.ok&&result.headers.get('content-type')?.startsWith('image/png')&&bytes.length===body.data.bytes,`${actor.label}-public-image-readable`);
  const expected=await sharp(png,{limitInputPixels:16000000,animated:false}).rotate().resize(512,512,{fit:'cover',withoutEnlargement:true}).png().toBuffer();
  check(createHash('sha256').update(bytes).digest('hex')===createHash('sha256').update(expected).digest('hex'),`${actor.label}-image-bytes-roundtrip`);
  actor.image=url.href;
}
try {
  check(process.env.HOSTED_ACCEPTANCE_APPROVED==='two-ephemeral-wallets-no-transactions','explicit-execution-gate');
  check(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(publicURL),'public-supabase-project-url');
  const isPublishable=publicKey.startsWith('sb_publishable_');
  let isAnon=false;try{isAnon=JSON.parse(Buffer.from(publicKey.split('.')[1],'base64url').toString()).role==='anon';}catch{}
  check(isPublishable||isAnon,'public-not-service-key');
  const preflightStarted = Date.now();
  preflightDiagnostic = { hostname: 'stonklaunch-demo.onrender.com', stage: 'fetch' };
  try {
    const runtime=await fetch(`${ORIGIN}/api/runtime`,{signal:AbortSignal.timeout(30000)});
    const contentType=(runtime.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    Object.assign(preflightDiagnostic, { stage: 'response', status: runtime.status,
      contentType: ['application/json','text/html'].includes(contentType) ? contentType : 'other' });
    // Native fetch Response.ok is a boolean; Playwright APIResponse.ok() below is a method.
    check(runtime.ok,'runtime-readable');
    preflightDiagnostic.stage = 'json';
    guardRuntime(await runtime.json());
    preflightDiagnostic.stage = 'verified';
  } catch (error) {
    const names = ['TypeError','SyntaxError','AbortError','TimeoutError','Error'];
    const codes = ['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ENETUNREACH','EHOSTUNREACH',
      'ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID'];
    preflightDiagnostic.errorName = names.includes(error?.name) ? error.name : 'OTHER';
    preflightDiagnostic.causeCode = codes.includes(error?.cause?.code) ? error.cause.code : 'OTHER';
    // No error message, stack, arbitrary property, response body, cookie or header is logged.
    throw new Error('PREFLIGHT_FAILED');
  } finally { preflightDiagnostic.elapsedMs = Date.now() - preflightStarted; }
  browser=await chromium.launch({headless:true});
  phase='account-A-login-save';const a=await createActor('A');await save(a);
  phase='account-B-login-save';const b=await createActor('B');await save(b);
  check(a.userId!==b.userId&&a.address!==b.address,'distinct-users-and-wallets');
  phase='isolation';
  for(const [owner,other] of [[a,b],[b,a]]) {
    const list=await app(owner.page,'/api/drafts',owner.address);
    check(list.status===200 && list.body.data.items.some(x=>x.draft_id===owner.draftId)&&!list.body.data.items.some(x=>x.draft_id===other.draftId),`${owner.label}-api-private-isolation`);
    check(await owner.page.getByText(`${other.name} · TEST${other.label}`,{exact:true}).count()===0,`${owner.label}-ui-private-isolation`);
    check((await rls(owner,owner.draftId)).length===1&&(await rls(owner,other.draftId)).length===0,`${owner.label}-database-RLS-isolation`);
  }
  const forbiddenUpdate=await app(b.page,'/api/drafts',b.address,{draftId:a.draftId,name:'must-not-overwrite',symbol:'TEST',description:fixture,assetKey:'SOL'});
  check(forbiddenUpdate.status>=400,'foreign-draft-id-write-rejected');
  const intact=await app(a.page,'/api/drafts',a.address);
  check(intact.body.data.items.find(x=>x.draft_id===a.draftId)?.parameters.name===a.name,'foreign-write-leaves-owner-data-intact');
  phase='public-upload';const png=await sharp({create:{width:2,height:2,channels:4,background:{r:80,g:100,b:180,alpha:1}}}).png().toBuffer();
  await upload(a,png);await upload(b,png);check(a.image!==b.image,'same-image-distinct-owner-paths');
  phase='wallet-session-mismatch';
  const mismatch=await app(a.page,'/api/drafts',b.address,{draftId:a.draftId,name:'must-not-save',symbol:'TEST',description:fixture,assetKey:'SOL'});
  check(mismatch.status===403&&mismatch.body.error?.code==='WALLET_SESSION_MISMATCH','mismatched-write-rejected');
  const mismatchRead=await app(a.page,'/api/drafts',b.address);
  check(mismatchRead.status===403&&mismatchRead.body.error?.code==='WALLET_SESSION_MISMATCH','mismatched-read-rejected');
  await a.page.evaluate(address=>window.__switchTestWallet(address),b.address);
  await a.page.getByLabel('Private draft name',{exact:true}).waitFor({state:'hidden'});
  check(await a.page.getByText(`${a.name} · TESTA`,{exact:true}).count()===0,'wallet-change-clears-private-UI');
  phase='readonly-prepare-denials';
  for(const path of ['/api/launches/prepare','/api/trades/prepare','/api/fees/prepare-claim','/api/admin/platform/prepare']) {
    const result=await app(b.page,path,b.address,{});
    check(result.status===403&&result.body.error?.code==='READ_ONLY_MODE',`readonly-denial:${path}`);
  }
  phase='logout';
  for(const actor of [a,b]) {
    const pending=actor.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/logout');
    await actor.page.getByRole('button',{name:'Sign out',exact:true}).click();
    check((await pending).ok(),`${actor.label}-logout-response`);
    await actor.page.getByLabel('Private draft name',{exact:true}).waitFor({state:'hidden'});
    const s=await app(actor.page,'/api/auth/session');check(s.body.data?.session===null,`${actor.label}-session-cleared`);
    const denied=await app(actor.page,'/api/drafts',actor.address);check(denied.status===401&&denied.body.error?.code==='AUTH_REQUIRED',`${actor.label}-logged-out-private-denied`);
    check(actor.signatures===1,`${actor.label}-no-extra-signatures`);
  }
  phase='final-runtime';guardRuntime((await app(b.page,'/api/runtime')).body);
  phase='complete';summary('PASS');
} catch {
  // NEVER print caught Error, stack, request, response, cookie, token or serialized browser state.
  summary('FAIL');process.exitCode=1;
} finally {if(browser)await browser.close().catch(()=>{});for(const actor of identities)actor.token=null;}
