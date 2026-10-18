import {Keypair,Connection,PublicKey} from '@solana/web3.js';
import {getPdaPlatformId,getCpmmPdaAmmConfigId,DEVNET_PROGRAM_ID,CpmmConfigInfoLayout} from '@raydium-io/raydium-sdk-v2';
import {getAssociatedTokenAddressSync} from '@solana/spl-token';
import {getRuntime} from '../src/lib/runtime';
import {sdk,programs,readPlatform} from '../src/lib/raydium/chain';
import {preparePlatformConfigChange,prepareLaunch,prepareTrade,prepareFeeClaim,readFees,getVerifiedLaunch,quoteTrade} from '../src/lib/raydium/service';
import {buildClientLaunch,signAndSubmitLaunch,signAndSubmitPlan} from '../src/lib/raydium/client-transactions';
import {readRecovery,writeRecovery} from '../src/lib/raydium/recovery';
type Context={wallet:Keypair;connection:Connection;mint:Keypair|null;sent:Record<string,string>;evidence:unknown[];configured?:boolean;poolId?:string;storage?:Map<string,string>};
async function configure(ctx:Context){
 if(await ctx.connection.getGenesisHash()!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw Error('DEVNET_ONLY');
 process.env.APP_MODE='devnet';process.env.SOLANA_RPC_URL='https://api.devnet.solana.com';process.env.APP_ORIGIN='https://example.invalid/stonklaunch-devnet';const owner=ctx.wallet.publicKey.toBase58();
 for(const k of ['LAUNCHLAB_PLATFORM_ADMIN','LAUNCHLAB_PLATFORM_FEE_WALLET','LAUNCHLAB_PLATFORM_NFT_WALLET','LAUNCHLAB_PLATFORM_VESTING_WALLET','LAUNCHLAB_TRANSFER_FEE_AUTHORITY'])process.env[k]=owner;
 process.env.LAUNCHLAB_PLATFORM_FEE_BPS='50';process.env.LAUNCHLAB_CREATOR_FEE_BPS='50';process.env.LAUNCHLAB_SHARE_FEE_BPS='0';
 // Explicit synthetic-test allocation only, not a production economic decision.
 process.env.LAUNCHLAB_LP_PLATFORM_RATE='0';process.env.LAUNCHLAB_LP_CREATOR_RATE='0';process.env.LAUNCHLAB_LP_BURN_RATE='1000000';
 process.env.LAUNCHLAB_PLATFORM_ID=getPdaPlatformId(programs().launch,ctx.wallet.publicKey).publicKey.toBase58();
 const r=await sdk();const configs=await r.api.fetchLaunchConfigs();const sol=configs.find(x=>x.key.mintB==='So11111111111111111111111111111111111111112');if(!sol)throw Error('No devnet SOL configuration');process.env.LAUNCHLAB_SOL_CONFIG_ID=sol.key.pubKey;
 let cp:string|undefined;for(let i=0;i<5;i++){const id=getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,i).publicKey;const a=await ctx.connection.getAccountInfo(id);if(a?.owner.equals(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM)&&a.data.length>=CpmmConfigInfoLayout.span&&!CpmmConfigInfoLayout.decode(a.data).disableCreatePool){cp=id.toBase58();break;}}
 if(!cp)throw Error('No verified devnet CPMM configuration');process.env.LAUNCHLAB_CPMM_CONFIG_ID=cp;
 if(!ctx.storage){ctx.storage=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>ctx.storage!.get(k)||null,setItem:(k:string,v:string)=>ctx.storage!.set(k,v)}});}
 ctx.configured=true;return {cluster:'devnet',wallet:owner,platformId:process.env.LAUNCHLAB_PLATFORM_ID,globalConfig:sol.key.pubKey,cpmmConfig:cp,testLpAllocation:'100% burn, test-only',realFunds:false};
}
export async function runStep(step:string,ctx:Context){
 if(!ctx.configured||step==='configure'){const config=await configure(ctx);if(step==='configure')return config;}
 const c=ctx.connection,owner=ctx.wallet.publicKey.toBase58(),runtime=getRuntime();if(runtime.cluster!=='devnet')throw Error('DEVNET_ONLY');
 if(step==='fund-once-more'){if(ctx.sent.airdropRetry)throw Error('Airdrop retry already used');ctx.sent.airdropRetry='attempted';const balance=await c.getBalance(ctx.wallet.publicKey);if(balance>0)return {balanceLamports:balance,noRepeat:true};const signature=await c.requestAirdrop(ctx.wallet.publicKey,1000000000);ctx.sent.airdrop=signature;return {testOnly:true,airdropSignature:signature};}
 if(step==='fees')return readFees(owner);
 if(step==='inspect')return {platform:(await readPlatform()).id.toBase58(),mint:ctx.mint?.publicKey.toBase58(),pool:ctx.poolId,signatures:ctx.sent,balanceLamports:await c.getBalance(ctx.wallet.publicKey)};
 if(ctx.sent[step]){const state=(await c.getSignatureStatuses([ctx.sent[step]],{searchTransactionHistory:true})).value[0];const pending=readRecovery('transaction','devnet',owner);if(pending?.signature===ctx.sent[step]&&state&&(state.err||state.confirmationStatus==='confirmed'||state.confirmationStatus==='finalized'))writeRecovery('transaction',{...pending,state:state.err?'failed':'confirmed'});return {alreadySubmitted:true,step,signature:ctx.sent[step],state,noRepeat:true};}
 if(await c.getBalance(ctx.wallet.publicKey)<10000000)throw Error('FREE_DEVNET_TEST_SOL_REQUIRED');
 const signingWallet={publicKey:ctx.wallet.publicKey,signTransaction:async(tx:import('@solana/web3.js').VersionedTransaction)=>{tx.sign([ctx.wallet]);return tx;}};
 const onStage=(state:string,signature?:string)=>{if(signature&&['submitted','confirmed','confirmation_unknown','failed'].includes(state))ctx.sent[step]=signature;};
 let signature:string;
 if(step==='platform')signature=await signAndSubmitPlan(await preparePlatformConfigChange({action:'create'},owner),signingWallet,runtime,c,onStage);
 else if(step==='launch'){
  ctx.mint ||=Keypair.generate();const plan=await prepareLaunch({name:'StonkLaunch Devnet QA',symbol:'STQA',description:'Disposable devnet acceptance only',assetKey:'SOL',clientMintPublicKey:ctx.mint.publicKey.toBase58(),metadataUri:'https://example.invalid/stonklaunch-devnet.json',initialBuyRaw:'0'},owner);
  const built=await buildClientLaunch(plan,ctx.mint,signingWallet,runtime,c);ctx.poolId=built.poolId;const result=await signAndSubmitLaunch(built,signingWallet,runtime,c,onStage);signature=result.signatures[result.signatures.length-1];await getVerifiedLaunch(ctx.mint.publicKey.toBase58());
 }else if(step==='buy'||step==='sell'){
  if(!ctx.poolId||!ctx.mint)throw Error('Launch must be verified first');let amountRaw='10000000';if(step==='sell'){const balance=await c.getTokenAccountBalance(getAssociatedTokenAddressSync(ctx.mint.publicKey,ctx.wallet.publicKey));amountRaw=(BigInt(balance.value.amount)/2n).toString();}
  const input={poolId:ctx.poolId,side:step as 'buy'|'sell',amountRaw,slippageBps:50};const quote=await quoteTrade(input);signature=await signAndSubmitPlan(await prepareTrade({...input,wallet:owner}),signingWallet,runtime,c,onStage);ctx.evidence.push({step,quote});
 }else if(step==='claim-platform'||step==='claim-creator')signature=await signAndSubmitPlan(await prepareFeeClaim({quoteMint:'So11111111111111111111111111111111111111112',scope:step==='claim-platform'?'platform':'creator'},owner),signingWallet,runtime,c,onStage);
 else throw Error('Unknown bounded devnet step');
 const result={step,signature,cluster:'devnet',wallet:owner,mint:ctx.mint?.publicKey.toBase58(),poolId:ctx.poolId,status:(await c.getSignatureStatuses([signature],{searchTransactionHistory:true})).value[0],testOnly:true};ctx.evidence.push(result);return result;
}
