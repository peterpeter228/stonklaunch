#!/usr/bin/env node
/** Offline, secret-safe deployment manifest validation. Never loads env files or contacts a service. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyEnvironment(m) {
 const errors = [], warnings = [];
 const fail = (code) => errors.push(code);
 if (!m || typeof m !== 'object' || Array.isArray(m)) return { status:'BLOCKED', errors:['MANIFEST_OBJECT_REQUIRED'], warnings };
 const allowed = new Set(['mode','origin','supabaseUrl','assetBucket','browserRpcConfigured','serverRpcConfigured','supabaseAnonKeyConfigured','supabaseServiceRoleConfigured','platformId','platformAdmin','solConfigId','cpmmConfigId','platformFeeWallet','indexerMode','indexerBatchSize','indexerPollIntervalMs','cronSecretAtLeast32Characters','platformFeeBps','creatorFeeBps','shareFeeBps']);
 for (const key of Object.keys(m)) if (!allowed.has(key)) fail('UNKNOWN_OR_SECRET_FIELD_NOT_ALLOWED');
 if (!['mainnet-readonly','mainnet-live','devnet'].includes(m.mode)) fail('NON_DEMO_MODE_REQUIRED');
 const httpsOrigin = (value) => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/' && !['localhost','127.0.0.1','::1','[::1]'].includes(u.hostname) && value === u.origin; } catch { return false; } };
 if (!httpsOrigin(m.origin)) fail('CANONICAL_HTTPS_ORIGIN_REQUIRED');
 if (!httpsOrigin(m.supabaseUrl)) fail('CANONICAL_HTTPS_SUPABASE_URL_REQUIRED');
 if (typeof m.assetBucket !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(m.assetBucket)) fail('INVALID_BUCKET_NAME');
 // Exact application metadata object path: UUID user id + SHA256 hex content id.
 const metadataUri = `${m.supabaseUrl}/storage/v1/object/public/${m.assetBucket}/metadata/${'0'.repeat(36)}/${'0'.repeat(64)}.json`;
 if (Buffer.byteLength(metadataUri, 'utf8') > 200) fail('METADATA_URI_EXCEEDS_200_BYTES');
 for (const key of ['serverRpcConfigured','supabaseAnonKeyConfigured','supabaseServiceRoleConfigured']) if (m[key] !== true) fail(key.toUpperCase() + '_REQUIRED');
 if (m.mode !== 'mainnet-readonly' && m.browserRpcConfigured !== true) fail('BROWSER_RPC_REQUIRED');
 // Validate actual decoded public-key length without printing addresses or loading signing code.
 const validKey = (s) => { if(typeof s !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false; const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n=0n; for(const c of s)n=n*58n+BigInt(alphabet.indexOf(c)); let bytes=0; while(n){bytes++;n>>=8n;} return bytes+(s.match(/^1*/)?.[0].length||0)===32; };
 for (const key of ['platformId','platformAdmin','solConfigId','cpmmConfigId','platformFeeWallet']) if (!validKey(m[key])) fail(key.toUpperCase() + '_PUBLIC_KEY_REQUIRED');
 for (const key of ['platformFeeBps','creatorFeeBps','shareFeeBps']) if (!Number.isInteger(m[key]) || m[key] < 0 || m[key] > 10000) fail('INVALID_' + key.toUpperCase());
 if(m.shareFeeBps!==0) fail('REFERRAL_FEE_MUST_BE_ZERO');
 if(m.platformFeeBps+m.creatorFeeBps>=10000) fail('COMBINED_FEES_TOO_HIGH');
 if(m.platformFeeBps!==50||m.creatorFeeBps!==50) warnings.push('NON_DEFAULT_FEE_POLICY_REQUIRES_EXPLICIT_REVIEW');
 if(!['worker','cron'].includes(m.indexerMode)) fail('SELECT_EXACTLY_ONE_INDEXER_MODE');
 if(!Number.isInteger(m.indexerBatchSize)||m.indexerBatchSize<1||m.indexerBatchSize>100)fail('INVALID_INDEXER_BATCH_SIZE');
 if(!Number.isInteger(m.indexerPollIntervalMs)||m.indexerPollIntervalMs<10000||m.indexerPollIntervalMs>3600000)fail('INVALID_INDEXER_POLL_INTERVAL');
 if(m.indexerMode==='cron'&&m.cronSecretAtLeast32Characters!==true)fail('CRON_SECRET_REQUIREMENT_NOT_DECLARED');
 warnings.push('DECLARATIONS_ONLY_NOT_CREDENTIAL_OR_CONNECTIVITY_VERIFICATION','HOSTED_AUTH_STORAGE_RLS_AND_INDEXER_ACCEPTANCE_REQUIRED','PUBLIC_KEYS_ARE_NOT_ONCHAIN_CONFIGURATION_VERIFICATION');
 return {status:errors.length?'BLOCKED':'CONFIG_SHAPE_VALID',errors:[...new Set(errors)],warnings,metadataUriBytes:Buffer.byteLength(metadataUri,'utf8')};
}
function selfTest(){
 const key='So11111111111111111111111111111111111111112';
 const base={mode:'mainnet-readonly',origin:'https://app.example.com',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',assetBucket:'stonklaunch-assets',browserRpcConfigured:false,serverRpcConfigured:true,supabaseAnonKeyConfigured:true,supabaseServiceRoleConfigured:true,platformId:key,platformAdmin:key,solConfigId:key,cpmmConfigId:key,platformFeeWallet:key,indexerMode:'worker',indexerBatchSize:50,indexerPollIntervalMs:10000,platformFeeBps:50,creatorFeeBps:50,shareFeeBps:0};
 const cases=[['valid shape',base,true],['demo',{...base,mode:'demo'},false],['insecure origin',{...base,origin:'http://app.example.com'},false],['trailing slash',{...base,supabaseUrl:base.supabaseUrl+'/'},false],['oversize metadata',{...base,assetBucket:'a'.repeat(63)},false],['missing service role declaration',{...base,supabaseServiceRoleConfigured:false},false],['live missing browser RPC',{...base,mode:'mainnet-live'},false],['invalid key',{...base,platformId:'1'.repeat(44)},false],['cron no secret',{...base,indexerMode:'cron'},false],['secret field',{...base,SUPABASE_SERVICE_ROLE_KEY:'synthetic-not-a-secret'},false],['nonzero referral',{...base,shareFeeBps:1},false],['fractional batch',{...base,indexerBatchSize:1.5},false]];
 for(const [name,input,pass]of cases){if((verifyEnvironment(input).errors.length===0)!==pass)throw Error('SELF_TEST_FAILED');console.log(`PASS ${name}`);}console.log('12 synthetic manifest checks passed; no services contacted.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv[2]==='--self-test'){selfTest();}else if(process.argv[2]==='--manifest'&&process.argv.length===4){const result=verifyEnvironment(JSON.parse(readFileSync(process.argv[3],'utf8')));console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;}else{console.error('Usage: node scripts/verify-environment.mjs --manifest deploy/production.public.example.json | --self-test');process.exitCode=2;}}
 catch{console.error('MANIFEST_UNREADABLE_OR_INVALID_JSON');process.exitCode=2;}
}
