import { Connection, PublicKey } from '@solana/web3.js';
import {
  calculateFee, getTransferFeeConfig, unpackMint,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType, TRANSFER_FEE_CONFIG_SIZE,
  type TransferFee, type TransferFeeConfig,
} from '@solana/spl-token';
import { AppError } from '@/lib/errors';
import { getRuntime } from '@/lib/runtime';
import { demoLaunches } from '@/lib/data/demo';
import type { TokenInspection } from '@/types/token-inspection';
export type { TokenInspection } from '@/types/token-inspection';

const U64_MAX = (1n << 64n) - 1n;
const MAX_RPC_BYTES = 2 * 1024 * 1024;

function assertRaw(value: bigint) {
  if (value < 0n || value > U64_MAX) throw new RangeError('Amount must be an unsigned 64-bit integer');
}

/** SPL Token-2022 fee: min(cap, ceil(raw amount * bps / 10_000)). */
export function calculateTransferFeeRaw(amountRaw: bigint, bps: number, maximumFeeRaw: bigint): bigint {
  assertRaw(amountRaw);
  assertRaw(maximumFeeRaw);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError('Invalid transfer fee basis points');
  return calculateFee({ epoch: 0n, maximumFee: maximumFeeRaw, transferFeeBasisPoints: bps }, amountRaw);
}

/** Equality activates the newer fee. Only a genuinely future schedule is returned as next. */
export function selectEpochTransferFee(
  config: Pick<TransferFeeConfig, 'olderTransferFee' | 'newerTransferFee'>,
  currentEpoch: bigint,
): { current: TransferFee; next: TransferFee | null } {
  assertRaw(currentEpoch);
  for (const fee of [config.olderTransferFee, config.newerTransferFee]) {
    assertRaw(fee.epoch);
    calculateTransferFeeRaw(0n, fee.transferFeeBasisPoints, fee.maximumFee);
  }
  return currentEpoch >= config.newerTransferFee.epoch
    ? { current: config.newerTransferFee, next: null }
    : { current: config.olderTransferFee, next: config.newerTransferFee };
}

// OptionalNonZeroPubkey uses the all-zero public key for an absent extension authority.
function authority(value: PublicKey | null): string | null {
  return value && !value.equals(PublicKey.default) ? value.toBase58() : null;
}

function safeEpoch(epoch: bigint): number {
  if (epoch > BigInt(Number.MAX_SAFE_INTEGER)) throw new AppError('INVALID_MINT_DATA', '代币 epoch 超出安全整数范围', 409);
  return Number(epoch);
}

/** Reject malformed/truncated TLV rather than interpreting a parse miss as no transfer fee. */
function validateExtensions(tlv: Buffer) {
  const seen = new Set<number>();
  let offset = 0;
  while (offset < tlv.length) {
    // Token-2022 allocation may have unused zero padding at the end.
    if (tlv.subarray(offset).every(byte => byte === 0)) return;
    if (offset + 4 > tlv.length) throw new Error('Truncated extension header');
    const type = tlv.readUInt16LE(offset);
    const size = tlv.readUInt16LE(offset + 2);
    if (type === 0 || seen.has(type) || offset + 4 + size > tlv.length) throw new Error('Invalid extension layout');
    if (type === ExtensionType.TransferFeeConfig && size !== TRANSFER_FEE_CONFIG_SIZE) throw new Error('Invalid transfer fee layout');
    seen.add(type);
    offset += 4 + size;
  }
}

/** Only the server-configured RPC is used. No client URL, redirects, unbounded body, or retry. */
function inspectionConnection(cluster: 'devnet' | 'mainnet-beta') {
  const endpoint = process.env.SOLANA_RPC_URL || (cluster === 'devnet'
    ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com');
  return new Connection(endpoint, {
    commitment: 'confirmed', disableRetryOnRateLimit: true,
    fetch: async (input, init) => {
      const response = await fetch(input, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const reader = response.body?.getReader();
      if (!reader) throw new AppError('INSPECTION_RPC_UNAVAILABLE', '代币读取暂时不可用', 503);
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > MAX_RPC_BYTES) {
            await reader.cancel();
            throw new AppError('INSPECTION_RESPONSE_TOO_LARGE', '代币读取响应超过限制', 503);
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(bytes, { status: response.status, statusText: response.statusText, headers: { 'Content-Type': 'application/json' } });
    },
  });
}

function demoInspection(mint: string): TokenInspection {
  // Identical IDs to externalDiscovery. Never accept arbitrary fake addresses or run RPC here.
  const index = demoLaunches.slice(0, 3).findIndex(item => `external-${item.mint}` === mint);
  if (index < 0) throw new AppError('DEMO_INSPECTION_ONLY', '演示模式仅可检查明确标记的外部演示样例', 400);
  const configured = index === 0;
  return {
    cluster: 'demo', mint, tokenProgram: configured ? TOKEN_2022_PROGRAM_ID.toBase58() : TOKEN_PROGRAM_ID.toBase58(),
    decimals: 6, slot: null, observedAt: new Date().toISOString(), currentEpoch: 100,
    mintAuthority: null, freezeAuthority: null,
    feeStatus: configured ? 'configured' : 'none',
    transferFee: configured ? {
      currentBps: 300, maximumFeeRaw: '1000000', nextBps: 200,
      nextMaximumFeeRaw: '1000000', nextEpoch: 102,
      configAuthority: 'synthetic-demo-fee-authority', withdrawAuthority: 'synthetic-demo-withdraw-authority', withheldRaw: '0',
    } : null,
    dataSource: 'synthetic-demo-token-inspection (not on-chain data)', isStale: false, synthetic: true,
    payoutStatus: 'unknown', verifiedPayouts: null, tradingEnabled: false,
  };
}

/** Inspect mint authorities and transfer-fee configuration without building or sending transactions. */
export async function inspectToken(mint: string): Promise<TokenInspection> {
  const runtime = getRuntime();
  if (runtime.cluster === 'demo') return demoInspection(mint);
  let address: PublicKey;
  try {
    if (mint.length < 32 || mint.length > 44) throw new Error();
    address = new PublicKey(mint);
    if (address.toBase58() !== mint) throw new Error();
  } catch { throw new AppError('INVALID_MINT', '需要有效的代币 mint 公钥', 400); }
  const rpc = inspectionConnection(runtime.cluster);
  const genesis = await rpc.getGenesisHash();
  const expectedGenesis = runtime.cluster === 'devnet'
    ? 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG' : '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  if (genesis !== expectedGenesis) throw new AppError('CLUSTER_MISMATCH', 'RPC 网络与应用模式不一致', 503);
  // Bracket the mint snapshot with monotonically bounded epoch observations. At rollover,
  // reject rather than label a prior-epoch mint snapshot using the next epoch's rate.
  const before = await rpc.getEpochInfo({ commitment: 'confirmed' });
  const snapshot = await rpc.getAccountInfoAndContext(address, { commitment: 'confirmed', minContextSlot: before.absoluteSlot });
  const account = snapshot.value;
  if (!account) throw new AppError('MINT_NOT_FOUND', '该网络未找到 mint 账户', 404);
  if (account.executable || (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID))) {
    throw new AppError('INVALID_MINT_OWNER', '账户不是受支持的 SPL Token mint', 409);
  }
  if (account.owner.equals(TOKEN_PROGRAM_ID) && account.data.length !== 82) {
    throw new AppError('INVALID_MINT_DATA', '标准 SPL mint 布局不匹配', 409);
  }
  const after = await rpc.getEpochInfo({ commitment: 'confirmed', minContextSlot: snapshot.context.slot });
  if (!Number.isSafeInteger(before.epoch) || before.epoch < 0 || before.epoch !== after.epoch ||
      snapshot.context.slot < before.absoluteSlot || after.absoluteSlot < snapshot.context.slot) {
    throw new AppError('EPOCH_SNAPSHOT_CHANGED', 'epoch 边界或 RPC 快照不一致，请重新检查', 503);
  }
  try {
    const parsed = unpackMint(address, account, account.owner);
    if (account.data.readUInt32LE(0) > 1 || account.data.readUInt32LE(46) > 1 || account.data[45] > 1) throw new Error('Invalid mint options');
    validateExtensions(parsed.tlvData);
    if (!parsed.isInitialized) throw new AppError('MINT_UNINITIALIZED', 'mint 尚未初始化', 409);
    const config = account.owner.equals(TOKEN_2022_PROGRAM_ID) ? getTransferFeeConfig(parsed) : null;
    const schedule = config ? selectEpochTransferFee(config, BigInt(before.epoch)) : null;
    return {
      cluster: runtime.cluster, mint, tokenProgram: account.owner.toBase58(), decimals: parsed.decimals,
      slot: snapshot.context.slot, observedAt: new Date().toISOString(), currentEpoch: before.epoch,
      mintAuthority: parsed.mintAuthority?.toBase58() ?? null, freezeAuthority: parsed.freezeAuthority?.toBase58() ?? null,
      feeStatus: config ? 'configured' : 'none',
      transferFee: config && schedule ? {
        currentBps: schedule.current.transferFeeBasisPoints, maximumFeeRaw: schedule.current.maximumFee.toString(),
        nextBps: schedule.next?.transferFeeBasisPoints ?? null, nextMaximumFeeRaw: schedule.next?.maximumFee.toString() ?? null,
        nextEpoch: schedule.next ? safeEpoch(schedule.next.epoch) : null,
        configAuthority: authority(config.transferFeeConfigAuthority), withdrawAuthority: authority(config.withdrawWithheldAuthority),
        withheldRaw: config.withheldAmount.toString(),
      } : null,
      dataSource: 'solana-rpc-confirmed-mint', isStale: false, synthetic: false,
      payoutStatus: 'unknown', verifiedPayouts: null, tradingEnabled: false,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('INVALID_MINT_DATA', 'mint 或扩展数据无法安全解析', 409);
  }
}
