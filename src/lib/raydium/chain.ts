import { Connection, PublicKey } from '@solana/web3.js';
import { Raydium, LAUNCHPAD_PROGRAM, DEV_LAUNCHPAD_PROGRAM, CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID, LaunchpadConfig, PlatformConfig, LaunchpadPool, CpmmConfigInfoLayout, getPdaPlatformId } from '@raydium-io/raydium-sdk-v2';
import { getRuntime } from '@/lib/runtime';
import { AppError } from '@/lib/errors';
export const WSOL = 'So11111111111111111111111111111111111111112';
export const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export function key(value: string | undefined | null, label = 'address') { try {
    if (!value)
        throw Error();
    return new PublicKey(value);
}
catch {
    throw new AppError('INVALID_CONFIGURATION', `${label} 公钥未配置或无效`, 503);
} }
export function programs() { const dev = getRuntime().cluster === 'devnet'; return { launch: dev ? DEV_LAUNCHPAD_PROGRAM : LAUNCHPAD_PROGRAM, cpmm: dev ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM }; }
export function connection() { if (getRuntime().mode === 'demo')
    throw new AppError('DEMO_NO_REAL_TRANSACTIONS', '演示不能访问真实交易适配器', 403); return new Connection(process.env.SOLANA_RPC_URL || (getRuntime().cluster === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com'), { commitment: 'confirmed', disableRetryOnRateLimit: true, fetch: (input,init) => fetch(input, {...init,signal:AbortSignal.timeout(12000)}) }); }
export async function sdk(wallet?: string) { const c = connection(); const expected = getRuntime().cluster === 'devnet' ? 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG' : '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'; if (await c.getGenesisHash() !== expected)
    throw new AppError('CLUSTER_MISMATCH', 'RPC 网络与应用模式不一致', 503); return Raydium.load({ connection: c, owner: wallet ? key(wallet, 'wallet') : undefined, cluster: getRuntime().cluster === 'devnet' ? 'devnet' : 'mainnet', disableLoadToken: true, disableFeatureCheck: true, apiRequestTimeout:10000, blockhashCommitment: 'confirmed' }); }
export async function owned(address: PublicKey, owner: PublicKey, minLength: number) { const result = await connection().getAccountInfoAndContext(address, 'confirmed'); if (!result.value)
    throw new AppError('ACCOUNT_NOT_FOUND', '链上账户不存在', 404); if (!result.value.owner.equals(owner) || result.value.data.length < minLength)
    throw new AppError('ACCOUNT_OWNER_MISMATCH', '账户程序或布局不匹配', 409); return { ...result.value, slot: result.context.slot }; }
export async function readGlobal(id: string) { const a = await owned(key(id), programs().launch, LaunchpadConfig.span); return { info: LaunchpadConfig.decode(a.data), slot: a.slot }; }
export async function readPlatform() { const r = getRuntime(); const id = key(r.platformId, 'platformId'); const a = await owned(id, programs().launch, PlatformConfig.span); const admin = key(r.platformAdmin, 'platformAdmin'); if (!getPdaPlatformId(programs().launch, admin).publicKey.equals(id))
    throw new AppError('PLATFORM_ADMIN_MISMATCH', '平台 PDA 与管理员不匹配', 409); return { id, admin, info: PlatformConfig.decode(a.data), slot: a.slot }; }
export async function readPool(id: string) { const a = await owned(key(id), programs().launch, LaunchpadPool.span); const info = LaunchpadPool.decode(a.data); if (info.platformId.toBase58() !== getRuntime().platformId)
    throw new AppError('EXTERNAL_PLATFORM_READ_ONLY', '仅支持已核验的本平台池', 403); if (![0, 1, 2].includes(info.status))
    throw new AppError('POOL_STATUS_UNSUPPORTED', '池状态尚未支持', 409); const global = await readGlobal(info.configId.toBase58()); if (!global.info.mintB.equals(info.mintB))
    throw new AppError('QUOTE_CONFIG_MISMATCH', '池与 GlobalConfig 的计价 mint 不一致', 409); return { info, global: global.info, slot: Math.max(a.slot, global.slot) }; }
export async function legacyMint(mint: PublicKey) { const a = await owned(mint, TOKEN_PROGRAM, 82); if (a.data.length !== 82 || a.data[45] !== 1)
    throw new AppError('TOKEN_EXTENSIONS_UNVERIFIED', '仅已验证的标准 SPL mint 可进入交易', 409); return { decimals: a.data[44], slot: a.slot }; }
export async function readCpConfig(id: PublicKey) { const a = await owned(id, programs().cpmm, CpmmConfigInfoLayout.span); return CpmmConfigInfoLayout.decode(a.data); }
