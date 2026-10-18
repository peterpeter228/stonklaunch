import {createInterface} from 'node:readline';
import {Keypair,Connection,LAMPORTS_PER_SOL} from '@solana/web3.js';
if(!process.argv.includes('--authorized-devnet-only'))throw Error('Explicit disposable-devnet test authorization is required.');
process.env.APP_MODE='devnet';process.env.SOLANA_RPC_URL='https://api.devnet.solana.com';
const c=new Connection(process.env.SOLANA_RPC_URL,{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})});
async function main(){if(await c.getGenesisHash()!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw Error('Not Solana devnet');
 const wallet=Keypair.generate();const context={wallet,connection:c,mint:null as Keypair|null,sent:{} as Record<string,string>,evidence:[] as unknown[]};
 const output=(v:unknown)=>process.stdout.write(JSON.stringify(v)+'\n');output({event:'disposable-devnet-wallet-ready',wallet:wallet.publicKey.toBase58(),privateKeyPersisted:false});
 for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{const cmd=JSON.parse(line);if(cmd.action==='quit'){output({event:'session-closed',wallet:wallet.publicKey.toBase58(),privateKeyPersisted:false});process.exit(0);}
   if(cmd.action==='fund'){const before=await c.getBalance(wallet.publicKey);if(before>0){output({event:'balance',lamports:before});continue;}if(context.sent.airdrop){output({event:'airdrop-already-requested',signature:context.sent.airdrop,status:(await c.getSignatureStatuses([context.sent.airdrop],{searchTransactionHistory:true})).value[0]});continue;}
    if(context.sent.initialAirdropAttempt)throw Error('Initial airdrop already attempted; inspect balance and provider response before any explicitly bounded retry.');context.sent.initialAirdropAttempt='attempted';
    const sig=await c.requestAirdrop(wallet.publicKey,2*LAMPORTS_PER_SOL);context.sent.airdrop=sig;output({event:'airdrop-requested',signature:sig});
   }else if(cmd.action==='balance')output({event:'balance',lamports:await c.getBalance(wallet.publicKey),wallet:wallet.publicKey.toBase58()});
   else if(cmd.action==='step'){const mod=await import('./devnet-steps.ts?revision='+Date.now());output(await mod.runStep(cmd.step,context));}
   else output({error:'UNKNOWN_ACTION'});
  }catch(e){output({event:'step-error',name:e instanceof Error?e.name:'Unknown',message:e instanceof Error?e.message.slice(0,1000):'Unknown error'});}
 }
}
main().catch(e=>{process.stdout.write(JSON.stringify({event:'session-error',name:e.name,message:String(e.message).slice(0,600)})+'\n');process.exitCode=1;});
