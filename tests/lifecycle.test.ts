import {recoveryKey} from '../src/lib/raydium/recovery';
import test from 'node:test';import assert from 'node:assert/strict';
import {resolveTradeRoute,canResubmit,reconcileSubmission,eventIdentity} from '../src/lib/lifecycle';
test('migration threshold is not confirmed graduation',()=>{assert.equal(resolveTradeRoute(0,false),'launchlab');assert.throws(()=>resolveTradeRoute(1,true),/MIGRATION_PENDING/);assert.throws(()=>resolveTradeRoute(2,false),/CPMM_UNVERIFIED/);assert.equal(resolveTradeRoute(2,true),'cpmm');});
test('unknown confirmation must not create duplicate economic action',()=>{assert.equal(reconcileSubmission('submitted','rpc_error'),'confirmation_unknown');assert.equal(canResubmit('confirmation_unknown'),false);assert.equal(canResubmit('submitted'),false);assert.equal(reconcileSubmission('confirmation_unknown','not_found'),'confirmation_unknown');assert.equal(reconcileSubmission('confirmation_unknown','confirmed'),'confirmed');});
test('event uniqueness includes cluster and instruction, not just signature',()=>{const values=[eventIdentity('devnet','tx',0,0),eventIdentity('mainnet-beta','tx',0,0),eventIdentity('devnet','tx',0,1)];assert.equal(new Set(values).size,3);assert.equal(new Set([...values,values[0]]).size,3);});
import {PublicKey} from '@solana/web3.js';
import {decodeMetadataIdentity} from '../src/lib/raydium/metadata';
test('on-chain metadata prefix validates mint and bounded UTF8 fields',()=>{const mint=new PublicKey('So11111111111111111111111111111111111111112');const h=Buffer.alloc(65);h[0]=4;mint.toBuffer().copy(h,33);const field=(v:string)=>{const b=Buffer.from(v);const n=Buffer.alloc(4);n.writeUInt32LE(b.length);return Buffer.concat([n,b]);};const d=Buffer.concat([h,field('Orbit'),field('ORB'),field('https://example.invalid/metadata')]);assert.equal(decodeMetadataIdentity(d,mint).name,'Orbit');assert.throws(()=>decodeMetadataIdentity(d,new PublicKey('11111111111111111111111111111111')));const bad=Buffer.from(d);bad.writeUInt32LE(999999,65);assert.throws(()=>decodeMetadataIdentity(bad,mint));assert.throws(()=>decodeMetadataIdentity(d.subarray(0,70),mint));});
import {TransactionMessage,VersionedTransaction,TransactionInstruction,Connection,SystemProgram} from '@solana/web3.js';
import {LAUNCHPAD_PROGRAM,anchorDataBuf} from '@raydium-io/raydium-sdk-v2';
import {assertPlanTransaction} from '../src/lib/raydium/transaction-guard';
import type {RuntimeConfig,TransactionPlan} from '../src/types/domain';
import {getAssociatedTokenAddressSync,createAssociatedTokenAccountIdempotentInstruction} from '@solana/spl-token';
test('client guard validates trade discriminator, amounts, pool and extra instructions',async()=>{
 const wallet=SystemProgram.programId,pool=new PublicKey('So11111111111111111111111111111111111111112'),base=new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
 const runtime={cluster:'mainnet-beta'} as RuntimeConfig;const inputAta=getAssociatedTokenAddressSync(pool,wallet),outputAta=getAssociatedTokenAddressSync(base,wallet);
 const plan:TransactionPlan={kind:'trade',cluster:'mainnet-beta',transactionBase64:null,blockhash:null,lastValidBlockHeight:null,requiresWalletSignature:true,blockers:[],summary:{poolId:pool.toBase58(),route:'launchlab',side:'buy',amountInRaw:'1',minOutRaw:'1',inputMint:pool.toBase58(),outputMint:base.toBase58()}};
 const make=(ix:TransactionInstruction[])=>new VersionedTransaction(new TransactionMessage({payerKey:wallet,recentBlockhash:SystemProgram.programId.toBase58(),instructions:ix}).compileToV0Message());
 const data=Buffer.alloc(32);anchorDataBuf.buyExactIn.copy(data);data.writeBigUInt64LE(1n,8);data.writeBigUInt64LE(1n,16);const addresses=[wallet,wallet,wallet,wallet,pool,outputAta,inputAta,wallet,wallet,base,pool];
 const protocol=new TransactionInstruction({programId:LAUNCHPAD_PROGRAM,keys:addresses.map((pubkey,i)=>({pubkey,isSigner:i===0,isWritable:true})),data});
 const setup=[createAssociatedTokenAccountIdempotentInstruction(wallet,inputAta,wallet,pool),createAssociatedTokenAccountIdempotentInstruction(wallet,outputAta,wallet,base)];
 // Instruction identity fixtures only, not a valid on-chain pool or actual execution. No RPC is called.
 await assertPlanTransaction(make([...setup,protocol]),plan,wallet,runtime,{} as Connection);
 await assert.rejects(()=>assertPlanTransaction(make([...setup,protocol]),{...plan,summary:{...plan.summary,poolId:'other'}},wallet,runtime,{} as Connection),/pool\/platform/);
 await assert.rejects(()=>assertPlanTransaction(make([...setup,protocol]),{...plan,summary:{...plan.summary,minOutRaw:'2'}},wallet,runtime,{} as Connection),/amounts/);
 await assert.rejects(()=>assertPlanTransaction(make([...setup,protocol,protocol]),plan,wallet,runtime,{} as Connection),/exactly one/);
 await assert.rejects(()=>assertPlanTransaction(make([SystemProgram.transfer({fromPubkey:wallet,toPubkey:pool,lamports:1}),...setup,protocol]),plan,wallet,runtime,{} as Connection),/Unexpected system transfer/);
});
import {SendTransactionError} from '@solana/web3.js';
import {signAndSubmitPlan} from '../src/lib/raydium/client-transactions';
test('actual submit helper distinguishes typed preflight failure from ambiguous network outcome',async()=>{
 const walletKey=SystemProgram.programId,pool=new PublicKey('So11111111111111111111111111111111111111112');
 const data=Buffer.alloc(17);anchorDataBuf.updatePlaformConfig.copy(data);data[8]=3;data.writeBigUInt64LE(5000n,9);const tx=new VersionedTransaction(new TransactionMessage({payerKey:walletKey,recentBlockhash:SystemProgram.programId.toBase58(),instructions:[new TransactionInstruction({programId:LAUNCHPAD_PROGRAM,keys:[{pubkey:walletKey,isSigner:true,isWritable:true},{pubkey:pool,isSigner:false,isWritable:true}],data})]}).compileToV0Message());
 const plan:TransactionPlan={kind:'update-platform',cluster:'mainnet-beta',transactionBase64:Buffer.from(tx.serialize()).toString('base64'),blockhash:SystemProgram.programId.toBase58(),lastValidBlockHeight:100,requiresWalletSignature:true,blockers:[],summary:{platformId:pool.toBase58(),change:'updateFeeRate',value:'5000',expiresAt:new Date(Date.now()+60000).toISOString()}};
 const runtime={mode:'mainnet-live',cluster:'mainnet-beta',walletEnabled:true,platformId:pool.toBase58()} as RuntimeConfig;
 const records=new Map<string,string>();const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>records.get(k)||null,setItem:(k:string,v:string)=>records.set(k,v)}});
 const originalFetch=globalThis.fetch;let sends=0,signs=0;
 globalThis.fetch=async(_url,init)=>{const req=JSON.parse(String(init?.body));let result:unknown;let error:unknown;
 if(req.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
 else if(req.method==='getBlockHeight')result=1;
 else if(req.method==='getSignatureStatuses')result={context:{slot:1},value:[null]};
 else if(req.method==='sendTransaction'){sends++;if(sends===1)error={code:-32002,message:'Transaction simulation failed: test-only',data:{logs:[]}};else throw Error('test-only network uncertainty');}
 else throw Error('Unexpected RPC in test: '+req.method);
 return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,...(error?{error}:{result})}),{status:200,headers:{'content-type':'application/json'}});
 };
 const wallet={publicKey:walletKey,signTransaction:async(t:VersionedTransaction)=>{signs++;t.signatures[0].fill(1);return t;}};
 // Synthetic signature bytes, no private key, no real RPC and no real transaction are used.
 try{const c=new Connection('https://invalid.test');await assert.rejects(()=>signAndSubmitPlan(plan,wallet,runtime,c,()=>{}),/Simulation failed/);assert.equal(JSON.parse(records.get(recoveryKey('transaction','mainnet-beta',walletKey.toBase58()))!).state,'failed');await assert.rejects(()=>signAndSubmitPlan(plan,wallet,runtime,c,()=>{}),/未知/);assert.equal(JSON.parse(records.get(recoveryKey('transaction','mainnet-beta',walletKey.toBase58()))!).state,'confirmation_unknown');await assert.rejects(()=>signAndSubmitPlan(plan,wallet,runtime,c,()=>{}),/原交易/);assert.equal(sends,2);assert.equal(signs,2);}finally{globalThis.fetch=originalFetch;if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');}
});
import {createInitializeAccountInstruction,createCloseAccountInstruction,TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {readRecovery,writeRecovery} from '../src/lib/raydium/recovery';
test('official seeded WSOL setup and close shape passes the client guard without a real transaction',async()=>{
 const wallet=SystemProgram.programId,quote=new PublicKey('So11111111111111111111111111111111111111112'),base=new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),temp=await PublicKey.createWithSeed(wallet,'fixture-only',TOKEN_PROGRAM_ID),output=getAssociatedTokenAddressSync(base,wallet);
 const data=Buffer.alloc(32);anchorDataBuf.buyExactIn.copy(data);data.writeBigUInt64LE(1n,8);data.writeBigUInt64LE(1n,16);const addresses=[wallet,wallet,wallet,wallet,quote,output,temp,wallet,wallet,base,quote];
 const protocol=new TransactionInstruction({programId:LAUNCHPAD_PROGRAM,keys:addresses.map((pubkey,i)=>({pubkey,isSigner:i===0,isWritable:true})),data});
 const ix=[SystemProgram.createAccountWithSeed({fromPubkey:wallet,basePubkey:wallet,newAccountPubkey:temp,seed:'fixture-only',lamports:2039281,space:165,programId:TOKEN_PROGRAM_ID}),createInitializeAccountInstruction(temp,quote,wallet),createAssociatedTokenAccountIdempotentInstruction(wallet,output,wallet,base),protocol,createCloseAccountInstruction(temp,wallet,wallet)];
 const tx=new VersionedTransaction(new TransactionMessage({payerKey:wallet,recentBlockhash:wallet.toBase58(),instructions:ix}).compileToV0Message());
 const plan={kind:'trade',summary:{route:'launchlab',side:'buy',poolId:quote.toBase58(),amountInRaw:'1',minOutRaw:'1',inputMint:quote.toBase58(),outputMint:base.toBase58()}} as unknown as TransactionPlan;
 await assertPlanTransaction(tx,plan,wallet,{cluster:'mainnet-beta'} as RuntimeConfig,{getMinimumBalanceForRentExemption:async()=>2039280} as unknown as Connection);
});
test('recovery journals remain isolated across wallets and networks; corruption blocks continuation',()=>{
 const records=new Map<string,string>(),old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>records.get(k)||null,setItem:(k:string,v:string)=>records.set(k,v)}});
 try{writeRecovery('transaction',{cluster:'devnet',wallet:'wallet-a',kind:'trade',state:'confirmation_unknown',signature:'a'});writeRecovery('transaction',{cluster:'devnet',wallet:'wallet-b',kind:'trade',state:'confirmed',signature:'b'});assert.equal(readRecovery('transaction','devnet','wallet-a')?.signature,'a');assert.equal(readRecovery('transaction','devnet','wallet-b')?.signature,'b');assert.equal(readRecovery('transaction','mainnet-beta','wallet-a'),null);records.set(recoveryKey('transaction','devnet','wallet-a'),'broken');assert.throws(()=>readRecovery('transaction','devnet','wallet-a'),/damaged/);}finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');}
});
import {launchInput} from '../src/lib/data/validation';
test('Chinese token names follow protocol UTF8-byte limit before upload',()=>{const draft={symbol:'TEST',description:'',assetKey:'SOL',clientMintPublicKey:'So11111111111111111111111111111111111111112'};assert.equal(launchInput.safeParse({...draft,name:'中文测试'}).success,true);assert.equal(launchInput.safeParse({...draft,name:'这是一个用于测试的中文代币名称'}).success,false);});
import {TOKEN_2022_PROGRAM_ID,ExtensionType,TransferFeeConfigLayout,TRANSFER_FEE_CONFIG_SIZE,getMintLen} from '@solana/spl-token';
import {calculateTransferFeeRaw,selectEpochTransferFee,inspectToken} from '../src/lib/raydium/token-inspection';
test('transfer-cost inspection uses capped integer fees and the active epoch, not promised income',()=>{
 const max=(1n<<64n)-1n;
 assert.equal(calculateTransferFeeRaw(100000000n,300,max),3000000n);
 assert.equal(calculateTransferFeeRaw(100000000n,300,2000000n),2000000n);
 assert.equal(calculateTransferFeeRaw(1n,300,max),1n);
 assert.equal(calculateTransferFeeRaw(0n,300,max),0n);
 assert.equal(calculateTransferFeeRaw(max,10000,max),max);
 assert.equal(calculateTransferFeeRaw(100n,300,0n),0n);
 assert.throws(()=>calculateTransferFeeRaw(-1n,300,max));assert.throws(()=>calculateTransferFeeRaw(1n,10001,max));
 const old={epoch:10n,maximumFee:20n,transferFeeBasisPoints:100},next={epoch:12n,maximumFee:30n,transferFeeBasisPoints:300};
 assert.deepEqual(selectEpochTransferFee({olderTransferFee:old,newerTransferFee:next},11n),{current:old,next});
 assert.deepEqual(selectEpochTransferFee({olderTransferFee:old,newerTransferFee:next},12n),{current:next,next:null});
});
test('mint inspection separates demo, verified no-fee, bad owners and epoch rollover without transactions',async()=>{
 const mode=process.env.APP_MODE,originalFetch=globalThis.fetch;let calls=0,epochCalls=0,wrongOwner=false,uninitialized=false,rollover=false,extended=false,badDiscriminator=false,badTlv=false;
 try{
  process.env.APP_MODE='demo';globalThis.fetch=(async()=>{throw Error('Demo must not access network');}) as typeof fetch;
  const demo=await inspectToken('external-demo-orbit');assert.equal(demo.synthetic,true);assert.equal(demo.transferFee?.currentBps,300);assert.equal(demo.verifiedPayouts,null);assert.equal(demo.tradingEnabled,false);
  assert.equal((await inspectToken('external-demo-neon')).feeStatus,'none');await assert.rejects(inspectToken('not-a-mint'),/演示/);
  process.env.APP_MODE='mainnet-readonly';
  globalThis.fetch=(async(_url,init)=>{calls++;const request=JSON.parse(String(init?.body));let result:unknown;
   if(request.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
   else if(request.method==='getEpochInfo'){epochCalls++;result={epoch:rollover&&epochCalls%2===0?101:100,absoluteSlot:1000,slotIndex:20,slotsInEpoch:432000};}
   else if(request.method==='getAccountInfo'){const data=Buffer.alloc(extended?getMintLen([ExtensionType.TransferFeeConfig]):82);data[44]=6;data[45]=uninitialized?0:1;if(extended){data[165]=badDiscriminator?2:1;data.writeUInt16LE(ExtensionType.TransferFeeConfig,166);data.writeUInt16LE(badTlv?65535:TRANSFER_FEE_CONFIG_SIZE,168);TransferFeeConfigLayout.encode({transferFeeConfigAuthority:PublicKey.default,withdrawWithheldAuthority:PublicKey.default,withheldAmount:12n,olderTransferFee:{epoch:90n,maximumFee:2000000n,transferFeeBasisPoints:100},newerTransferFee:{epoch:102n,maximumFee:1000000n,transferFeeBasisPoints:300}},data,170);}result={context:{slot:1000},value:{data:[data.toString('base64'),'base64'],owner:wrongOwner?SystemProgram.programId.toBase58():extended?TOKEN_2022_PROGRAM_ID.toBase58():TOKEN_PROGRAM_ID.toBase58(),executable:false,lamports:1000000,rentEpoch:0}};}
   else throw Error('Unexpected RPC action '+request.method);
   return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}),{headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  const d=await inspectToken('So11111111111111111111111111111111111111112');assert.equal(d.synthetic,false);assert.equal(d.feeStatus,'none');assert.equal(d.transferFee,null);assert.equal(d.verifiedPayouts,null);assert.equal(d.slot,1000);assert.equal(calls,4);
  wrongOwner=true;await assert.rejects(inspectToken(d.mint),/不是受支持/);wrongOwner=false;epochCalls=0;uninitialized=true;await assert.rejects(inspectToken(d.mint),/尚未初始化/);uninitialized=false;epochCalls=0;rollover=true;await assert.rejects(inspectToken(d.mint),/epoch/);
  rollover=false;extended=true;epochCalls=0;const ext=await inspectToken(d.mint);assert.equal(ext.feeStatus,'configured');assert.equal(ext.transferFee?.currentBps,100);assert.equal(ext.transferFee?.nextBps,300);assert.equal(ext.transferFee?.withdrawAuthority,null);assert.equal(ext.transferFee?.withheldRaw,'12');badDiscriminator=true;await assert.rejects(inspectToken(d.mint),/无法安全解析/);badDiscriminator=false;badTlv=true;await assert.rejects(inspectToken(d.mint),/无法安全解析/);
  await assert.rejects(inspectToken('invalid'),/有效/);
 }finally{globalThis.fetch=originalFetch;if(mode===undefined)delete process.env.APP_MODE;else process.env.APP_MODE=mode;}
});
import {confirmByHttp} from '../src/lib/raydium/client-transactions';
test('confirmation uses HTTP status without websocket subscriptions or rebroadcast',async()=>{
 let calls=0;const c={getSignatureStatuses:async()=>({value:[++calls===1?{err:{InstructionError:[0,'InvalidArgument']},confirmationStatus:'processed'}:{err:null,confirmationStatus:'confirmed'}]}),confirmTransaction:()=>{throw Error('Websocket confirmation forbidden in fixture');}} as unknown as Connection;
 assert.deepEqual(await confirmByHttp(c,'fixture-only',100,0),{value:{err:null}});assert.equal(calls,2);
 await assert.rejects(confirmByHttp({getSignatureStatuses:async()=>({value:[null]})} as unknown as Connection,'fixture-only',0,0),/超时/);
});

import {signAndSubmitLaunch, type TransactionStage} from '../src/lib/raydium/client-transactions';
test('post-sign expiry and pending checks prevent broadcast; definitive failure keeps its terminal state',async()=>{
 const walletKey=SystemProgram.programId,pool=new PublicKey('So11111111111111111111111111111111111111112');
 const data=Buffer.alloc(17);anchorDataBuf.updatePlaformConfig.copy(data);data[8]=3;data.writeBigUInt64LE(5000n,9);
 const tx=new VersionedTransaction(new TransactionMessage({payerKey:walletKey,recentBlockhash:walletKey.toBase58(),instructions:[new TransactionInstruction({programId:LAUNCHPAD_PROGRAM,keys:[{pubkey:walletKey,isSigner:true,isWritable:true},{pubkey:pool,isSigner:false,isWritable:true}],data})]}).compileToV0Message());
 const plan:TransactionPlan={kind:'update-platform',cluster:'mainnet-beta',transactionBase64:Buffer.from(tx.serialize()).toString('base64'),blockhash:walletKey.toBase58(),lastValidBlockHeight:100,requiresWalletSignature:true,blockers:[],summary:{platformId:pool.toBase58(),change:'updateFeeRate',value:'5000'}};
 const runtime={mode:'mainnet-live',cluster:'mainnet-beta',walletEnabled:true,platformId:pool.toBase58()} as RuntimeConfig;
 const records=new Map<string,string>(),oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),originalFetch=globalThis.fetch,originalNow=Date.now;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>records.get(k)||null,setItem:(k:string,v:string)=>records.set(k,v)}});
 let scenario='blockheight',heightCalls=0,sends=0,statusCalls=0;const stages:TransactionStage[]=[];
 globalThis.fetch=async(_url,init)=>{const req=JSON.parse(String(init?.body));let result:unknown;
  if(req.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  else if(req.method==='getBlockHeight'){heightCalls++;if(heightCalls>=2&&scenario==='height-rpc')throw Error('429 Too Many Requests');if(heightCalls>=2&&scenario==='height-invalid')result='invalid';else result=scenario==='blockheight'&&heightCalls===2?101:1;}
  else if(req.method==='getLatestBlockhash')result={context:{slot:1},value:{blockhash:walletKey.toBase58(),lastValidBlockHeight:100}};
  else if(req.method==='simulateTransaction')result={context:{slot:1},value:{err:null,logs:[]}};
  else if(req.method==='sendTransaction'){sends++;if(scenario==='processed')throw Error('Ambiguous network outcome');result='fixture-only';}
  else if(req.method==='getSignatureStatuses'){statusCalls++;if(statusCalls>1)throw Error('RPC unavailable after definitive failure');result={context:{slot:1},value:[{slot:1,confirmations:1,err:scenario==='confirmed'?null:{InstructionError:[0,'InvalidArgument']},confirmationStatus:scenario==='processed'?'processed':'confirmed'}]};}
  else throw Error('Unexpected RPC in test: '+req.method);
  return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}),{headers:{'content-type':'application/json'}});
 };
 const pending={cluster:runtime.cluster,wallet:walletKey.toBase58(),kind:'trade',state:'confirmation_unknown',signature:'original-signature'};
 let capturedValidity:TransactionValidity|undefined;
 const wallet={publicKey:walletKey,readOnlyBlockheightRetries:2 as const,captureValidity:(value:TransactionValidity)=>{capturedValidity=value;},signTransaction:async(...args:[VersionedTransaction])=>{assert.equal(args.length,1,'external wallet provider receives only the transaction');const t=args[0];assert.equal(capturedValidity?.phase,'before-sign');t.signatures[0].fill(1);if(scenario==='pending')writeRecovery('transaction',pending);if(scenario==='quote-expiry')Date.now=()=>originalNow()+120000;return t;}};
 // Every RPC is intercepted and signatures are synthetic; these tests never sign or send on-chain.
 try{
  const c=new Connection('https://invalid.test');const run=()=>signAndSubmitPlan(plan,wallet,runtime,c,s=>stages.push(s));
  await assert.rejects(run,/区块哈希已过期/);assert.equal(sends,0);assert.equal(records.size,0);assert.equal(stages.at(-1),'failed');
  for(const [name,code] of [['height-rpc','BLOCKHEIGHT_RPC_FAILED'],['height-invalid','BLOCKHEIGHT_INVALID_RESPONSE']] as const){scenario=name;heightCalls=0;await assert.rejects(run,(error:unknown)=>error instanceof TransactionValidityError&&error.code===code&&error.validity.phase==='after-sign');assert.equal(sends,0);assert.equal(heightCalls,name==='height-rpc'?4:2);}
  scenario='pending';await assert.rejects(run,/原交易/);assert.equal(sends,0);assert.deepEqual(readRecovery('transaction',runtime.cluster,walletKey.toBase58()),pending);
  const originalLaunch={cluster:runtime.cluster,wallet:walletKey.toBase58(),kind:'create-launch',mint:'original-mint',poolId:'original-pool'};writeRecovery('launch',originalLaunch);
  await assert.rejects(()=>signAndSubmitLaunch({expiresAt:new Date(Date.now()+60000).toISOString(),transactions:[],signers:[],mint:'new-mint',poolId:'new-pool'},wallet,runtime,c,()=>{}),/原交易/);
  assert.deepEqual(readRecovery('launch',runtime.cluster,walletKey.toBase58()),originalLaunch);assert.equal(sends,0);
  scenario='quote-expiry';records.clear();stages.length=0;await assert.rejects(()=>signAndSubmitLaunch({expiresAt:new Date(originalNow()+60000).toISOString(),transactions:[tx],signers:[[]],mint:'fixture-mint',poolId:'fixture-pool'},wallet,runtime,c,s=>stages.push(s)),/计划已过期/);Date.now=originalNow;assert.equal(sends,0);assert.equal(readRecovery('transaction',runtime.cluster,walletKey.toBase58()),null);assert.equal(stages.at(-1),'failed');
  scenario='confirmed';records.clear();stages.length=0;assert.equal(typeof await run(),'string');assert.equal(sends,1);assert.equal(statusCalls,1);assert.equal(readRecovery('transaction',runtime.cluster,walletKey.toBase58())?.state,'confirmed');assert.deepEqual(stages,['awaiting_signature','submitted','confirmed']);
  sends=0;statusCalls=0;scenario='failed';records.clear();stages.length=0;await assert.rejects(run,/链上执行失败/);assert.equal(sends,1);assert.equal(statusCalls,1);assert.equal(readRecovery('transaction',runtime.cluster,walletKey.toBase58())?.state,'failed');assert.deepEqual(stages,['awaiting_signature','submitted','failed']);
  scenario='processed';records.clear();stages.length=0;statusCalls=0;await assert.rejects(run,/未知/);assert.equal(readRecovery('transaction',runtime.cluster,walletKey.toBase58())?.state,'confirmation_unknown');assert.deepEqual(stages,['awaiting_signature','submitted','confirmation_unknown']);
 }finally{Date.now=originalNow;globalThis.fetch=originalFetch;if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');}
});

import {Raydium} from '@raydium-io/raydium-sdk-v2';
import {observeTransaction} from '../src/lib/raydium/service';
test('server observation never treats processed or legacy unconfirmed errors as terminal',async()=>{
 const originalFetch=globalThis.fetch,originalLoad=Raydium.load,originalMode=process.env.APP_MODE;
 let confirmationStatus:string|undefined='processed',err:unknown={InstructionError:[0,'InvalidArgument']};
 process.env.APP_MODE='mainnet-readonly';Raydium.load=async()=>({} as Awaited<ReturnType<typeof Raydium.load>>);
 globalThis.fetch=async(_url,init)=>{const req=JSON.parse(String(init?.body));let result:unknown;
  if(req.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  else if(req.method==='getSignatureStatuses')result={context:{slot:1},value:[{slot:1,confirmations:null,err,...(confirmationStatus?{confirmationStatus}:{})}]};
  else if(req.method==='getTransaction')result=null;
  else throw Error('Unexpected RPC in fixture: '+req.method);
  return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}),{headers:{'content-type':'application/json'}});
 };
 try{
  const signature='1'.repeat(88);
  assert.equal((await observeTransaction(signature)).state,'submitted');
  confirmationStatus=undefined;assert.equal((await observeTransaction(signature)).state,'submitted');
  confirmationStatus='confirmed';assert.equal((await observeTransaction(signature)).state,'failed');
  confirmationStatus='finalized';assert.equal((await observeTransaction(signature)).state,'failed');
  err=null;assert.equal((await observeTransaction(signature)).state,'finalized');
  confirmationStatus='confirmed';assert.equal((await observeTransaction(signature)).state,'confirmed');
 }finally{globalThis.fetch=originalFetch;Raydium.load=originalLoad;if(originalMode===undefined)delete process.env.APP_MODE;else process.env.APP_MODE=originalMode;}
});

import {assertClaim, transition, WALLET, PLATFORM, REPOSITORY, REF, type Ledger, type Identity} from '../scripts/devnet-claim';
const claimedFixture=()=>{
 const id:Identity={repository:REPOSITORY,ref:REF,runId:'12345',attempt:'1',sourceSha:'a'.repeat(40),nonce:'test_claim_nonce_0001',step:'launch'};
 const ledger:Ledger={schemaVersion:1,network:'devnet',wallet:WALLET,platformId:PLATFORM,steps:{launch:{nonce:id.nonce,sourceSha:id.sourceSha,runId:id.runId,state:'claimed'}}};
 return {id,ledger};
};
test('durable claim binds exact repository, ref, attempt, source, nonce and run before signing',()=>{
 const {id,ledger}=claimedFixture();assert.equal(assertClaim(ledger,id).state,'claimed');
 for(const change of [{repository:'other/repo'},{ref:'refs/heads/other'},{attempt:'2'},{sourceSha:'b'.repeat(40)},{nonce:'different_nonce_0001'},{runId:'54321'}])assert.throws(()=>assertClaim(ledger,{...id,...change}));
 ledger.steps.launch!.runId=null;assert.throws(()=>assertClaim(ledger,id));
});
test('consumed or out-of-order durable slots cannot be reused, even without a signature',()=>{
 const {id,ledger}=claimedFixture();ledger.steps.launch!.state='signing';assert.throws(()=>assertClaim(ledger,id));
 ledger.steps.launch!.state='claimed';ledger.steps.launch!.signature='public-signature';assert.throws(()=>assertClaim(ledger,id));delete ledger.steps.launch!.signature;
 ledger.steps.sell={...ledger.steps.launch!};assert.throws(()=>assertClaim(ledger,id));delete ledger.steps.sell;
 ledger.steps.buy={...ledger.steps.launch!};assert.throws(()=>assertClaim(ledger,{...id,step:'buy'}));
});
test('ledger CAS must succeed and read back before advancing; stale simultaneous claimant is rejected',async()=>{
 const {id,ledger}=claimedFixture(),originalFetch=globalThis.fetch,token=process.env.GH_TOKEN;process.env.GH_TOKEN='test-only-not-a-credential';
 let server=structuredClone(ledger),sha='initial',puts=0;
 globalThis.fetch=(async(_url,init)=>{
  if(init?.method==='PUT'){puts++;const body=JSON.parse(String(init.body));if(body.sha!==sha)return new Response('{}',{status:409});server=JSON.parse(Buffer.from(body.content,'base64').toString());sha='consumed';return new Response('{}');}
  return new Response(JSON.stringify({sha,encoding:'base64',content:Buffer.from(JSON.stringify(server)).toString('base64')}));
 }) as typeof fetch;
 try{
  const original={sha:'initial',ledger};const consumed=await transition(original,id,'claimed','signing');assert.equal(consumed.ledger.steps.launch!.state,'signing');
  await assert.rejects(()=>transition(original,id,'claimed','signing'),/CAS_OUTCOME/);assert.equal(puts,2);
  await assert.rejects(()=>transition(consumed,id,'claimed','signing'),/CLAIM_NOT_OWNED/);assert.equal(puts,2);
 }finally{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=token;}
});
test('ambiguous ledger write stops after a read and is never retried or treated as authorization',async()=>{
 const {id,ledger}=claimedFixture(),originalFetch=globalThis.fetch,token=process.env.GH_TOKEN;process.env.GH_TOKEN='test-only-not-a-credential';let puts=0,reads=0;
 globalThis.fetch=(async(_url,init)=>{if(init?.method==='PUT'){puts++;throw Error('timeout');}reads++;return new Response(JSON.stringify({sha:'unknown',encoding:'base64',content:Buffer.from(JSON.stringify(ledger)).toString('base64')}));}) as typeof fetch;
 try{await assert.rejects(()=>transition({sha:'initial',ledger},id,'claimed','signing'),/CAS_OUTCOME/);assert.equal(puts,1);assert.equal(reads,1);}
 finally{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=token;}
});
test('durable signed checkpoint cannot be replaced or moved back to a signable state',async()=>{
 const {id,ledger}=claimedFixture();ledger.steps.launch={...ledger.steps.launch!,state:'signed',signature:'original',messageHash:'digest',mint:WALLET,poolId:PLATFORM};
 await assert.rejects(()=>transition({sha:'x',ledger},id,'signed','finalized',{signature:'replacement',slot:1}),/IMMUTABLE_CLAIM/);
 for(const fields of [{mint:PLATFORM},{poolId:WALLET},{messageHash:'replacement'},{signature:undefined}])await assert.rejects(()=>transition({sha:'x',ledger},id,'signed','finalized',fields),/IMMUTABLE_CLAIM/);
 await assert.rejects(()=>transition({sha:'x',ledger},id,'signed','claimed'),/INVALID_TRANSITION/);
});

import {AddressLookupTableAccount} from '@solana/web3.js';
import {resolveAcceptanceKeys, RECOVERABLE_UNSIGNED_CLAIM, type UnsignedAttemptHistory} from '../scripts/devnet-claim';
test('bounded ALT resolution gives identical live and historical receipt account identities',async()=>{
 const payer=new PublicKey(WALLET),loaded=new PublicKey(PLATFORM),tableKey=new PublicKey(new Uint8Array(32).fill(7));
 const table=new AddressLookupTableAccount({key:tableKey,state:{deactivationSlot:18446744073709551615n,lastExtendedSlot:1,lastExtendedSlotStartIndex:0,addresses:[loaded]}});
 const ix=new TransactionInstruction({programId:SystemProgram.programId,keys:[{pubkey:payer,isSigner:true,isWritable:true},{pubkey:loaded,isSigner:false,isWritable:true}],data:Buffer.alloc(4)});
 const tx=new VersionedTransaction(new TransactionMessage({payerKey:payer,recentBlockhash:SystemProgram.programId.toBase58(),instructions:[ix]}).compileToV0Message([table]));
 assert.equal(tx.message.addressTableLookups.length,1);let reads=0;
 const connection={getAddressLookupTable:async()=>{reads++;return {value:table};}} as unknown as Connection;
 const live=await resolveAcceptanceKeys(tx,connection);const index=tx.message.compiledInstructions[0].accountKeyIndexes[1];assert.equal(live.get(index)?.toBase58(),PLATFORM);
 const historical=await resolveAcceptanceKeys(tx,connection,{writable:[loaded],readonly:[]});assert.equal(historical.get(index)?.toBase58(),PLATFORM);assert.equal(reads,1,'receipt must not refetch lookup tables');
 await assert.rejects(()=>resolveAcceptanceKeys(tx,connection,null),/RECEIPT_LOADED_ADDRESSES_REQUIRED/);
 await assert.rejects(()=>resolveAcceptanceKeys(tx,{getAddressLookupTable:async()=>({value:null})} as unknown as Connection),/LOOKUP_TABLE_UNAVAILABLE/);
 await assert.rejects(()=>resolveAcceptanceKeys(tx,connection,{writable:[],readonly:[]}));
});
const recoveryHistory=():UnsignedAttemptHistory=>({step:'launch',claim:{...RECOVERABLE_UNSIGNED_CLAIM},proof:{runUrl:'https://github.com/peterpeter228/stonklaunch/actions/runs/39151038033',runStatus:'completed',runConclusion:'failure',runAttempt:1,errorCode:'LOOKUP_TABLE_NOT_ALLOWED',fundedWalletSigned:false,broadcastAttempted:false,ledgerBlobSha:'82253a96d8c0abb419b27d98cd5bc3096b332161',reviewedAt:'2026-10-18T17:46:00Z',evidencePath:'evidence/DURABLE_LAUNCH_PRESIGN_FAILURE.json'}});
test('only the exact terminal pre-sign ALT failure can be preserved for one manually created replacement claim',()=>{
 const {id,ledger}=claimedFixture();ledger.attemptHistory=[recoveryHistory()];ledger.steps.launch!.recoveryOfRunId=RECOVERABLE_UNSIGNED_CLAIM.runId!;assert.equal(assertClaim(ledger,id).state,'claimed');
 const missing=structuredClone(ledger);delete missing.attemptHistory;assert.throws(()=>assertClaim(missing,id),/RECOVERY_HISTORY_REQUIRED/);
 const twice=structuredClone(ledger);twice.attemptHistory!.push(recoveryHistory());assert.throws(()=>assertClaim(twice,id),/ONE_RECONCILED_RECOVERY_ONLY/);
 const signed=structuredClone(ledger);signed.attemptHistory![0].claim.signature='any-public-signature';assert.throws(()=>assertClaim(signed,id),/UNRECONCILED_PRIOR_ATTEMPT/);
 const wrongRun=structuredClone(ledger);wrongRun.attemptHistory![0].claim.runId='999';assert.throws(()=>assertClaim(wrongRun,id),/UNRECONCILED_PRIOR_ATTEMPT/);
 const noProof=structuredClone(ledger);noProof.attemptHistory![0].proof.broadcastAttempted=true as false;assert.throws(()=>assertClaim(noProof,id),/RECOVERY_PROOF_REQUIRED/);
 const old=structuredClone(ledger);old.steps.launch!.runId=RECOVERABLE_UNSIGNED_CLAIM.runId;assert.throws(()=>assertClaim(old,{...id,runId:RECOVERABLE_UNSIGNED_CLAIM.runId!}),/RECOVERY_MUST_USE_NEW_BOUND_CLAIM/);
});
test('forward claim transition preserves archived unsigned attempt and its proof without mutation',async()=>{
 const {id,ledger}=claimedFixture();ledger.attemptHistory=[recoveryHistory()];ledger.steps.launch!.recoveryOfRunId=RECOVERABLE_UNSIGNED_CLAIM.runId!;
 const original=JSON.stringify(ledger.attemptHistory),originalFetch=globalThis.fetch,token=process.env.GH_TOKEN;process.env.GH_TOKEN='test-only-not-a-credential';let server=ledger;
 globalThis.fetch=(async(_url,init)=>{if(init?.method==='PUT'){const body=JSON.parse(String(init.body));server=JSON.parse(Buffer.from(body.content,'base64').toString());return new Response('{}');}return new Response(JSON.stringify({sha:'new',encoding:'base64',content:Buffer.from(JSON.stringify(server)).toString('base64')}));}) as typeof fetch;
 try{const result=await transition({sha:'old',ledger},id,'claimed','signing');assert.equal(JSON.stringify(result.ledger.attemptHistory),original);assert.equal(result.ledger.steps.launch!.state,'signing');}
 finally{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=token;}
});

import {checkTransactionValidity,TransactionValidityError,type TransactionValidity} from '../src/lib/raydium/client-transactions';
import {annotateSignedFailure,RECOVERABLE_SIGNED_BUY_CLAIM,type SignedBuyAttemptHistory} from '../scripts/devnet-claim';
test('height retries are readonly, bounded and only transient; expiry or invalid response is never retried',async()=>{
 const context={blockhash:WALLET,lastValidBlockHeight:100,expiresAt:new Date(Date.now()+20000).toISOString()};let reads=0;
 const connection={getBlockHeight:async()=>{reads++;if(reads<3)throw Error('429 Too Many Requests');return 5;}} as unknown as Connection;
 const valid=await checkTransactionValidity(connection,context,'after-sign',2);assert.equal(reads,3);assert.equal(valid.observedBlockHeight,5);assert.equal(valid.readAttempts,3);
 for(const [result,code] of [[101,'BLOCKHASH_EXPIRED'],[-1,'BLOCKHEIGHT_INVALID_RESPONSE'],[NaN,'BLOCKHEIGHT_INVALID_RESPONSE']] as const){reads=0;await assert.rejects(()=>checkTransactionValidity({getBlockHeight:async()=>{reads++;return result;}} as unknown as Connection,context,'after-sign',2),(error:unknown)=>error instanceof TransactionValidityError&&error.code===code);assert.equal(reads,1);}
 reads=0;await assert.rejects(()=>checkTransactionValidity({getBlockHeight:async()=>{reads++;throw Error('unauthorized');}} as unknown as Connection,context,'after-sign',2),(error:unknown)=>error instanceof TransactionValidityError&&error.code==='BLOCKHEIGHT_RPC_FAILED');assert.equal(reads,1);
 reads=0;await assert.rejects(()=>checkTransactionValidity(connection,{...context,expiresAt:new Date(Date.now()-1).toISOString()},'after-sign',2),(error:unknown)=>error instanceof TransactionValidityError&&error.code==='QUOTE_EXPIRED');assert.equal(reads,0);
 await assert.rejects(()=>checkTransactionValidity(connection,{...context,expiresAt:'invalid'},'after-sign',2),(error:unknown)=>error instanceof TransactionValidityError&&error.code==='QUOTE_INVALID');assert.equal(reads,0);
 const oldNow=Date.now;reads=0;const start=oldNow();try{await assert.rejects(()=>checkTransactionValidity({getBlockHeight:async()=>{reads++;Date.now=()=>start+20001;throw Error('429 Too Many Requests');}} as unknown as Connection,{...context,expiresAt:new Date(start+20000).toISOString()},'after-sign',2),(error:unknown)=>error instanceof TransactionValidityError&&error.code==='QUOTE_EXPIRED');assert.equal(reads,1);}finally{Date.now=oldNow;}
});
test('post-sign diagnostics preserve signed identity and cannot reset or overwrite the claim',async()=>{
 const {id,ledger}=claimedFixture();const validity:TransactionValidity={blockhash:WALLET,lastValidBlockHeight:100,expiresAt:'2026-10-18T18:00:20Z',phase:'before-sign',observedAt:'2026-10-18T18:00:00Z',observedBlockHeight:80,readAttempts:1};
 ledger.steps.launch={...ledger.steps.launch!,state:'signed',signature:'original',messageHash:'original-hash',mint:WALLET,poolId:PLATFORM,validity};
 const originalFetch=globalThis.fetch,token=process.env.GH_TOKEN;process.env.GH_TOKEN='test-only-not-a-credential';let server=ledger,puts=0;
 globalThis.fetch=(async(_url,init)=>{if(init?.method==='PUT'){puts++;const body=JSON.parse(String(init.body));server=JSON.parse(Buffer.from(body.content,'base64').toString());return new Response('{}');}return new Response(JSON.stringify({sha:'new',encoding:'base64',content:Buffer.from(JSON.stringify(server)).toString('base64')}));}) as typeof fetch;
 try{
  const failure={code:'BLOCKHEIGHT_RPC_FAILED' as const,validity:{...validity,phase:'after-sign' as const,readAttempts:3},broadcastAttempted:false as const};
  const result=await annotateSignedFailure({sha:'old',ledger},id,failure);assert.equal(puts,1);assert.equal(result.ledger.steps.launch!.state,'signed');assert.equal(result.ledger.steps.launch!.signature,'original');assert.equal(result.ledger.steps.launch!.messageHash,'original-hash');assert.deepEqual(result.ledger.steps.launch!.validity,validity);
  await assert.rejects(()=>annotateSignedFailure(result,id,failure),/INVALID_FAILURE_ANNOTATION/);assert.equal(puts,1);
  await assert.rejects(()=>transition(result,id,'signed','claimed'),/INVALID_TRANSITION/);
 }finally{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=token;}
});
const buyRecoveryHistory=():SignedBuyAttemptHistory=>({step:'buy',claim:{...RECOVERABLE_SIGNED_BUY_CLAIM},proof:{runUrl:'https://github.com/peterpeter228/stonklaunch/actions/runs/39151817814',runStatus:'completed',runConclusion:'failure',runAttempt:1,errorCode:'POST_SIGN_VALIDATION_FAILED_BEFORE_SUBMIT',fundedWalletSigned:true,broadcastAttempted:false,reviewedNoSubmitCodePath:true,originalSignedBytesPersisted:false,signatureStatus:null,walletBalanceLamports:4979382960,observedSlot:512518718,stages:['awaiting_signature','signed-before-broadcast','failed','blocked'],ledgerBlobSha:'d7700694d9f4f6a2d632ea481b57db62e8176a14',reviewedAt:'2026-10-18T18:00:00Z',evidencePath:'evidence/DURABLE_BUY_ATTEMPT_1_RECONCILIATION.json'}});
test('sole reviewed prebroadcast buy recovery retains original signed claim and requires exact proof',()=>{
 const {id,ledger}=claimedFixture();ledger.attemptHistory=[recoveryHistory(),buyRecoveryHistory()];ledger.steps.launch={...ledger.steps.launch!,state:'finalized',recoveryOfRunId:RECOVERABLE_UNSIGNED_CLAIM.runId!,mint:RECOVERABLE_SIGNED_BUY_CLAIM.mint,poolId:RECOVERABLE_SIGNED_BUY_CLAIM.poolId,signature:'launch-receipt',messageHash:'launch-hash',slot:512517543};
 const buyId={...id,step:'buy' as const,runId:'777',nonce:'new_buy_recovery_0001'};ledger.steps.buy={nonce:buyId.nonce,sourceSha:buyId.sourceSha,runId:buyId.runId,state:'claimed',recoveryOfRunId:RECOVERABLE_SIGNED_BUY_CLAIM.runId!};assert.equal(assertClaim(ledger,buyId).state,'claimed');
 const bad=structuredClone(ledger);delete bad.attemptHistory![1].claim.signature;assert.throws(()=>assertClaim(bad,buyId),/UNRECONCILED_BUY_ATTEMPT/);
 const broadcast=structuredClone(ledger);broadcast.attemptHistory![1].proof.broadcastAttempted=true as false;assert.throws(()=>assertClaim(broadcast,buyId),/BUY_RECOVERY_PROOF_REQUIRED/);
 const missing=structuredClone(ledger);missing.attemptHistory!.pop();assert.throws(()=>assertClaim(missing,buyId),/RECOVERY_HISTORY_REQUIRED/);
 const repeated=structuredClone(ledger);repeated.attemptHistory!.push(buyRecoveryHistory());assert.throws(()=>assertClaim(repeated,buyId),/ONE_RECONCILED_RECOVERY_ONLY/);
 const replaced=structuredClone(ledger);replaced.attemptHistory![1].claim.messageHash='different';assert.throws(()=>assertClaim(replaced,buyId),/UNRECONCILED_BUY_ATTEMPT/);
});

import {RECOVERABLE_EXPIRED_BUY_CLAIM,type ExpiredBuyAttemptHistory} from '../scripts/devnet-claim';
import {pacedDevnetFetch} from '../scripts/devnet-rpc-pacing';
test('last exact expired buy recovery preserves full signed claim and rejects any fourth attempt',()=>{
 const {id,ledger}=claimedFixture();
 const proof:ExpiredBuyAttemptHistory['proof']={runUrl:'https://github.com/peterpeter228/stonklaunch/actions/runs/39152770076',runStatus:'completed',runConclusion:'failure',runAttempt:1,errorCode:'BLOCKHEIGHT_RPC_FAILED',broadcastAttempted:false,ledgerBlobSha:'6a688b21f68d5643aae992e067998c8d81444aa0',reviewedAt:'2026-10-18T18:45:00Z',evidencePath:'evidence/DURABLE_BUY_ATTEMPT_2_EXPIRY.json',commitment:'finalized',blockHeight:499743878,blockhashValid:false,blockhashContextSlot:512530531,signatureStatus:null,searchTransactionHistory:true,transaction:null,walletBalanceLamports:4979382960,walletBalanceSlot:512530537,tokenAta:'EhPWDSteuHz8YchU9Ub3QGhJy38E6V1J8hSDkBzeY21Z',tokenAtaAccount:null,tokenAtaSlot:512530539};
 ledger.attemptHistory=[recoveryHistory(),buyRecoveryHistory(),{step:'buy',claim:structuredClone(RECOVERABLE_EXPIRED_BUY_CLAIM),proof}];
 ledger.steps.launch={...ledger.steps.launch!,state:'finalized',recoveryOfRunId:RECOVERABLE_UNSIGNED_CLAIM.runId!,mint:RECOVERABLE_SIGNED_BUY_CLAIM.mint,poolId:RECOVERABLE_SIGNED_BUY_CLAIM.poolId,signature:'launch',messageHash:'hash',slot:512517543};
 const buyId={...id,step:'buy' as const,runId:'778',nonce:'last_buy_recovery_0001'};ledger.steps.buy={nonce:buyId.nonce,sourceSha:buyId.sourceSha,runId:buyId.runId,state:'claimed',recoveryOfRunId:'39152770076'};assert.equal(assertClaim(ledger,buyId).state,'claimed');
 for(const key of ['signature','messageHash','validity','failure'] as const){const bad=structuredClone(ledger);delete bad.attemptHistory![2].claim[key];assert.throws(()=>assertClaim(bad,buyId));}
 for(const [key,value] of Object.entries({blockHeight:499734995,blockhashValid:true,signatureStatus:{},transaction:{},walletBalanceLamports:1,tokenAtaAccount:{},searchTransactionHistory:false,commitment:'confirmed'})){const bad=structuredClone(ledger);(bad.attemptHistory![2].proof as unknown as Record<string,unknown>)[key]=value;assert.throws(()=>assertClaim(bad,buyId),/BUY_EXPIRY_PROOF_REQUIRED/);}
 ledger.attemptHistory.push(structuredClone(ledger.attemptHistory[2]));assert.throws(()=>assertClaim(ledger,buyId),/ONE_RECONCILED_RECOVERY_ONLY/);
});
test('runner pacing spaces all RPC starts and stops queued network after 429 or 403 without retry',async()=>{
 const endpoint='https://api.devnet.solana.com';const request={method:'POST',body:JSON.stringify({method:'getBlockHeight'})};
 let now=0;const starts:number[]=[];const events:Record<string,unknown>[]=[];
 const paced=pacedDevnetFetch((async()=>{starts.push(now);return new Response('{"result":1}',{status:200});}) as typeof fetch,e=>events.push(e),()=>now,async ms=>{now+=ms;});
 await Promise.all(Array.from({length:5},()=>paced(endpoint,request)));assert.deepEqual(starts,[0,334,668,1002,1336]);assert.equal(events.length,5);
 for(const status of [429,403]){let calls=0;const f=pacedDevnetFetch((async()=>{calls++;return new Response('private raw body',{status});}) as typeof fetch,()=>{});await assert.rejects(()=>f(endpoint,request),/DEVNET_RPC_STOPPED/);await assert.rejects(()=>f(endpoint,request),/DEVNET_RPC_STOPPED/);assert.equal(calls,1);}
 let calls=0;const aborted=new AbortController();aborted.abort();const f=pacedDevnetFetch((async()=>{calls++;return new Response('{}');}) as typeof fetch,()=>{});await assert.rejects(()=>f(endpoint,{...request,signal:aborted.signal}));assert.equal(calls,0);await f('https://api.github.com/repos/example',{});assert.equal(calls,1);
});
