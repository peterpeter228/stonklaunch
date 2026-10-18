'use client';
import {readRecovery,writeRecovery} from './recovery';
import {assertPlanTransaction} from './transaction-guard';
import { Connection, Keypair, PublicKey, VersionedTransaction, SendTransactionError } from '@solana/web3.js';
import { Raydium, TxVersion, LAUNCHPAD_PROGRAM, DEV_LAUNCHPAD_PROGRAM } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import type { RuntimeConfig, TransactionPlan } from '@/types/domain';
export type SigningWallet = {
    publicKey: PublicKey;
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};
export type TransactionStage = 'validating' | 'awaiting_signature' | 'submitted' | 'confirmed' | 'failed' | 'confirmation_unknown';
export type StageCallback = (stage: TransactionStage, detail?: string) => void;
// Call only from an explicit Create action. Never persist/export this temporary secret.
export function createClientMint() { return Keypair.generate(); }
function boundedConnection(c:Connection){return new Connection(c.rpcEndpoint,{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})});}
function validExpiry(value:unknown){const time=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(time)||time<Date.now())throw Error('计划已过期或缺少有效期限，请重新准备并审阅');}
function checkPending(wallet:SigningWallet,cluster:string){const pending=readRecovery('transaction',cluster,wallet.publicKey.toBase58());if(pending&&['submitted','confirmation_unknown'].includes(pending.state||''))throw Error(`请先查询尚未确定的原交易，不要重复提交：${pending.signature}`);}
function mode(runtime: RuntimeConfig) { if (!runtime.walletEnabled || !['devnet', 'mainnet-live'].includes(runtime.mode))
    throw Error('当前模式禁止资金签名'); }
function base58(bytes: Uint8Array) { const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n = 0n; for (const b of bytes)
    n = n * 256n + BigInt(b); let out = ''; while (n) {
    out = alphabet[Number(n % 58n)] + out;
    n /= 58n;
} for (const b of bytes) {
    if (b)
        break;
    out = '1' + out;
} return out; }
async function verifyNetwork(c: Connection, r: RuntimeConfig) { const expected = r.cluster === 'devnet' ? 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG' : '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'; if (await c.getGenesisHash() !== expected)
    throw Error('钱包 RPC 网络与应用模式不一致'); }
export async function buildClientLaunch(plan: TransactionPlan, mintSigner: Keypair, wallet: SigningWallet, runtime: RuntimeConfig, connection: Connection) { mode(runtime); connection=boundedConnection(connection); await verifyNetwork(connection, runtime); validExpiry(plan.summary.expiresAt); if (plan.kind !== 'create-launch' || plan.cluster !== runtime.cluster || plan.blockers.length)
    throw Error('创建计划不适用'); const params = plan.summary.clientCreate as Record<string, string | number | boolean> | undefined; if (!params || params.owner !== wallet.publicKey.toBase58() || params.mint !== mintSigner.publicKey.toBase58() || params.platformId !== runtime.platformId || Date.parse(String(plan.summary.expiresAt)) < Date.now())
    throw Error('计划已过期或钱包/mint/平台不匹配，请重新核验'); const expectedProgram = runtime.cluster === 'devnet' ? DEV_LAUNCHPAD_PROGRAM : LAUNCHPAD_PROGRAM; if (params.programId !== expectedProgram.toBase58() || params.buyAmount !== '0' || params.shareFeeRate !== '0' || params.createOnly !== true)
    throw Error('不允许变更创建交易的协议或费用'); const raydium = await Raydium.load({ connection, owner: wallet.publicKey, cluster: runtime.cluster === 'devnet' ? 'devnet' : 'mainnet', disableLoadToken: true, disableFeatureCheck: true,apiRequestTimeout:10000 }); const result = await raydium.launchpad.createLaunchpad({ programId: expectedProgram, mintA: mintSigner.publicKey, platformId: new PublicKey(String(params.platformId)), configId: new PublicKey(String(params.configId)), name: String(params.name), symbol: String(params.symbol), uri: String(params.uri), mintBDecimals: Number(params.mintBDecimals), supply: new BN(String(params.supply)), totalSellA: new BN(String(params.totalSellA)), totalFundRaisingB: new BN(String(params.totalFundRaisingB)), totalLockedAmount: new BN(0), migrateType: 'cpmm', createOnly: true, buyAmount: new BN(0), shareFeeRate: new BN(0), extraSigners: [mintSigner], txVersion: TxVersion.V0 }); if (result.transactions.length !== 1) throw Error('MULTI_TRANSACTION_CREATE_NOT_SUPPORTED: creation must fit one atomic transaction; nothing was signed or sent'); return { expiresAt:String(plan.summary.expiresAt),transactions: result.transactions, signers: result.signers, mint: mintSigner.publicKey.toBase58(), poolId: result.extInfo.address.poolId.toBase58() }; }
// HTTP-only confirmation also works when a wallet/RPC environment cannot establish WebSockets.
// Never rebroadcast here: a missing status remains uncertain until reconciled separately.
export async function confirmByHttp(c:Connection,signature:string,timeoutMs=45000,pollMs=1200){
 const deadline=Date.now()+timeoutMs;
 while(true){
  const observed=await c.getSignatureStatuses([signature],{searchTransactionHistory:true});const status=observed.value[0];
  if(status?.err||status?.confirmationStatus==='confirmed'||status?.confirmationStatus==='finalized')return {value:{err:status.err}};
  if(Date.now()>=deadline)throw Error('确认超时');
  await new Promise(resolve=>setTimeout(resolve,Math.min(pollMs,Math.max(0,deadline-Date.now()))));
 }
}
async function submit(tx: VersionedTransaction, wallet: SigningWallet, c: Connection, blockhash: string, lastValidBlockHeight: number, onStage: StageCallback,context:{cluster:string;kind:string}) { checkPending(wallet,context.cluster);if (!tx.message.staticAccountKeys[0].equals(wallet.publicKey))
    throw Error('交易付款钱包与已连接钱包不一致'); if ((await c.getBlockHeight('confirmed')) > lastValidBlockHeight)
    throw Error('区块哈希已过期，请重新准备并审阅'); onStage('awaiting_signature'); const reviewedMessage = tx.message.serialize(); let signed: VersionedTransaction; try {
    signed = await wallet.signTransaction(tx);
}
catch (e) {
    onStage('failed', '钱包未签名；保留草稿');
    throw e;
} if (!(signed.message.serialize().length === reviewedMessage.length && signed.message.serialize().every((b, i) => b === reviewedMessage[i])))
    throw Error('签名返回的交易消息已改变'); if (!signed.signatures[0]?.some(b => b !== 0))
    throw Error('钱包没有返回有效签名'); const signature = base58(signed.signatures[0]); const record = { ...context,wallet:wallet.publicKey.toBase58(),signature, blockhash, lastValidBlockHeight, state: 'submitted', at: new Date().toISOString() }; writeRecovery('transaction',record); onStage('submitted', signature); let broadcastAccepted=false; try {
    await c.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 0 }); broadcastAccepted=true;
    const result=await confirmByHttp(c,signature);
    if (result.value.err) {
        onStage('failed', signature);
        writeRecovery('transaction',{ ...record, state: 'failed' });
        throw Error('链上执行失败');
    }
    onStage('confirmed', signature);
    writeRecovery('transaction',{ ...record, state: 'confirmed' });
    return signature;
}
catch (e) {
    if (!broadcastAccepted && e instanceof SendTransactionError && e.message.startsWith('Simulation failed.')) { writeRecovery('transaction',{...record,state:'failed'}); onStage('failed',signature); throw e; }
    const observed = await c.getSignatureStatuses([signature], { searchTransactionHistory: true }).catch(() => null);
    const status = observed?.value[0];
    if (status?.err) {
        writeRecovery('transaction',{...record,state:'failed'});onStage('failed', signature);
        throw e;
    }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
        writeRecovery('transaction',{...record,state:'confirmed'});onStage('confirmed', signature);
        return signature;
    }
    writeRecovery('transaction',{...record,state:'confirmation_unknown'});onStage('confirmation_unknown', signature);
    throw Error(`广播结果未知，请先查询原签名，不要重发：${signature}`);
} }
export async function signAndSubmitPlan(plan: TransactionPlan, wallet: SigningWallet, runtime: RuntimeConfig, c: Connection, onStage: StageCallback) { mode(runtime); c=boundedConnection(c); await verifyNetwork(c, runtime); if (plan.cluster !== runtime.cluster || !plan.transactionBase64 || !plan.blockhash || !plan.lastValidBlockHeight || plan.blockers.length)
    throw Error('交易计划无效或仍有阻塞'); if(plan.kind==='trade')validExpiry(plan.summary.expiresAt); const bytes = Uint8Array.from(atob(plan.transactionBase64), v => v.charCodeAt(0)); const tx = VersionedTransaction.deserialize(bytes); if (tx.message.recentBlockhash !== plan.blockhash)
    throw Error('交易 blockhash 与摘要不符'); await assertPlanTransaction(tx,plan,wallet.publicKey,runtime,c); return submit(tx, wallet, c, plan.blockhash, plan.lastValidBlockHeight, onStage,{cluster:runtime.cluster,kind:plan.kind}); }
export async function signAndSubmitLaunch(built: Awaited<ReturnType<typeof buildClientLaunch>>, wallet: SigningWallet, runtime: RuntimeConfig, c: Connection, onStage: StageCallback) { mode(runtime); c=boundedConnection(c); await verifyNetwork(c, runtime);validExpiry(built.expiresAt); const signatures: string[] = []; writeRecovery('launch',{cluster:runtime.cluster,wallet:wallet.publicKey.toBase58(),kind:'create-launch', mint: built.mint, poolId: built.poolId, signatures, completedTransactions: 0, totalTransactions: built.transactions.length }); for (let i = 0; i < built.transactions.length; i++) {
    const tx = built.transactions[i];
    const latest = await c.getLatestBlockhash('confirmed');
    tx.message.recentBlockhash = latest.blockhash;
    if (built.signers[i]?.length)
        tx.sign(built.signers[i]);
    const simulation = await c.simulateTransaction(tx, { sigVerify: false, commitment: 'confirmed' });
    if (simulation.value.err)
        throw Error('创建交易模拟失败；未提交该交易');
    const signature = await submit(tx, wallet, c, latest.blockhash, latest.lastValidBlockHeight, onStage,{cluster:runtime.cluster,kind:'create-launch'});
    signatures.push(signature);
    writeRecovery('launch',{cluster:runtime.cluster,wallet:wallet.publicKey.toBase58(),kind:'create-launch', mint: built.mint, poolId: built.poolId, signatures, completedTransactions: i + 1, totalTransactions: built.transactions.length });
} return {cluster:runtime.cluster,wallet:wallet.publicKey.toBase58(),kind:'create-launch', mint: built.mint, poolId: built.poolId, signatures }; }
