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
  else if(req.method==='getBlockHeight')result=scenario==='blockheight'&&++heightCalls===2?101:1;
  else if(req.method==='getLatestBlockhash')result={context:{slot:1},value:{blockhash:walletKey.toBase58(),lastValidBlockHeight:100}};
  else if(req.method==='simulateTransaction')result={context:{slot:1},value:{err:null,logs:[]}};
  else if(req.method==='sendTransaction'){sends++;if(scenario==='processed')throw Error('Ambiguous network outcome');result='fixture-only';}
  else if(req.method==='getSignatureStatuses'){statusCalls++;if(statusCalls>1)throw Error('RPC unavailable after definitive failure');result={context:{slot:1},value:[{slot:1,confirmations:1,err:scenario==='confirmed'?null:{InstructionError:[0,'InvalidArgument']},confirmationStatus:scenario==='processed'?'processed':'confirmed'}]};}
  else throw Error('Unexpected RPC in test: '+req.method);
  return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}),{headers:{'content-type':'application/json'}});
 };
 const pending={cluster:runtime.cluster,wallet:walletKey.toBase58(),kind:'trade',state:'confirmation_unknown',signature:'original-signature'};
 const wallet={publicKey:walletKey,signTransaction:async(t:VersionedTransaction)=>{t.signatures[0].fill(1);if(scenario==='pending')writeRecovery('transaction',pending);if(scenario==='quote-expiry')Date.now=()=>originalNow()+120000;return t;}};
 // Every RPC is intercepted and signatures are synthetic; these tests never sign or send on-chain.
 try{
  const c=new Connection('https://invalid.test');const run=()=>signAndSubmitPlan(plan,wallet,runtime,c,s=>stages.push(s));
  await assert.rejects(run,/区块哈希已过期/);assert.equal(sends,0);assert.equal(records.size,0);assert.equal(stages.at(-1),'failed');
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
