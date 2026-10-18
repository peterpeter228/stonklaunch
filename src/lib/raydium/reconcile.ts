import { AppError } from '@/lib/errors';
import { anchorDataBuf, getPdaPlatformVault, getPdaPlatformFeeVaultAuth } from '@raydium-io/raydium-sdk-v2';
import { connection, sdk, readPlatform, programs, TOKEN_PROGRAM } from './chain';
import { getRuntime } from '@/lib/runtime';
export type ClaimCursor = {
    before?: string;
    head?: string;
    scanHead?: string;
};
export type VerifiedClaim = {
    signature: string;
    eventIndex: number;
    claimant: string;
    quoteMint: string;
    amountRaw: string;
    destination: string;
    claimScope: 'platform';
    attributionStatus: 'unallocated';
    slot: number;
    observedAt: string;
};
function decode58(value: string) { const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n = 0n; for (const ch of value) {
    const digit = alphabet.indexOf(ch);
    if (digit < 0)
        throw Error('Invalid base58');
    n = n * 58n + BigInt(digit);
} const bytes: number[] = []; while (n) {
    bytes.unshift(Number(n & 255n));
    n >>= 8n;
} for (const ch of value) {
    if (ch !== '1')
        break;
    bytes.unshift(0);
} return Buffer.from(bytes); }
// Decode only the installed SDK's exact platform-vault claim instruction, not swap fee estimates.
// Finalized inner SPL transfers provide amount evidence. Current balances are never treated as income.
export async function reconcilePlatformClaims(input: {
    cursor?: ClaimCursor;
    limit?: number;
} = {}) {
    await sdk();
    const platform = await readPlatform();
    const c = connection();
    const cursor = input.cursor || {};
    const signatures = await c.getSignaturesForAddress(platform.id, { before: cursor.before, until: cursor.head, limit: Math.max(1, Math.min(50, input.limit || 20)) }, 'finalized');
    const claims: VerifiedClaim[] = [];
    const blockers = new Set<string>(['SWAP_FEE_EVENT_DECODER_UNVERIFIED', 'CREATOR_AGGREGATE_HISTORY_NOT_SCANNED', 'CPI_WRAPPED_CLAIMS_NOT_DECODED']);
    for (const entry of signatures) {
        if (entry.err)
            continue;
        const tx = await c.getTransaction(entry.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
        if (!tx || !tx.meta) throw new AppError('TRANSACTION_HISTORY_UNAVAILABLE','已确认签名的交易历史暂不可读；保留原游标以重试',503);
        if(tx.meta.err)continue;
        const message = tx.transaction.message;
        const keys = message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses });
        const instructions = message.compiledInstructions;
        for (let outer = 0; outer < instructions.length; outer++) {
            const ix = instructions[outer];
            if (!keys.get(ix.programIdIndex)?.equals(programs().launch) || !Buffer.from(ix.data).equals(anchorDataBuf.claimPlatformFeeFromVault))
                continue;
            const ids = ix.accountKeyIndexes;
            if (ids.length < 7) {
                blockers.add('CLAIM_LAYOUT_UNVERIFIED');
                continue;
            }
            const claimant = keys.get(ids[0]), auth = keys.get(ids[1]), pid = keys.get(ids[2]), vault = keys.get(ids[3]), destination = keys.get(ids[4]), mint = keys.get(ids[5]), tokenProgram = keys.get(ids[6]);
            if (!claimant || !auth || !pid || !vault || !destination || !mint || !tokenProgram || !pid.equals(platform.id) || !message.isAccountSigner(ids[0]) || !tokenProgram.equals(TOKEN_PROGRAM) || !getPdaPlatformVault(programs().launch, pid, mint).publicKey.equals(vault) || !getPdaPlatformFeeVaultAuth(programs().launch).publicKey.equals(auth)) {
                blockers.add('CLAIM_BINDING_UNVERIFIED');
                continue;
            }
            const destinationBalance = tx.meta.postTokenBalances?.find(b => b.accountIndex === ids[4] && b.mint === mint.toBase58());
            const vaultBalance = tx.meta.preTokenBalances?.find(b => b.accountIndex === ids[3] && b.mint === mint.toBase58());
            if (!destinationBalance || !vaultBalance || destinationBalance.owner !== claimant.toBase58()) {
                blockers.add('HISTORICAL_TOKEN_OWNERSHIP_UNVERIFIED');
                continue;
            }
            const inner = tx.meta.innerInstructions?.find(group => group.index === outer)?.instructions || [];
            let amount = 0n;
            let matched = 0;
            for (const transfer of inner) {
                if (!keys.get(transfer.programIdIndex)?.equals(TOKEN_PROGRAM))
                    continue;
                const data = decode58(transfer.data);
                const transferChecked = data[0] === 12 && data.length === 10;
                const transferPlain = data[0] === 3 && data.length === 9;
                if (!transferChecked && !transferPlain)
                    continue;
                const accounts = transfer.accounts;
                const source = keys.get(accounts[0]), dest = keys.get(accounts[transferChecked ? 2 : 1]), authority = keys.get(accounts[transferChecked ? 3 : 2]);
                if (!source?.equals(vault) || !dest?.equals(destination) || !authority?.equals(auth))
                    continue;
                if (transferChecked && !keys.get(accounts[1])?.equals(mint))
                    continue;
                amount += data.readBigUInt64LE(1);
                matched++;
            }
            if (matched !== 1 || amount <= 0n) {
                blockers.add('CLAIM_TRANSFER_EVIDENCE_UNVERIFIED');
                continue;
            }
            claims.push({ signature: entry.signature, eventIndex: outer, claimant: claimant.toBase58(), quoteMint: mint.toBase58(), amountRaw: amount.toString(), destination: destination.toBase58(), claimScope: 'platform', attributionStatus: 'unallocated', slot: entry.slot, observedAt: entry.blockTime ? new Date(entry.blockTime * 1000).toISOString() : new Date().toISOString() });
        }
    }
    const limit = Math.max(1, Math.min(50, input.limit || 20));
    const complete = signatures.length < limit;
    const scanHead = cursor.scanHead || signatures[0]?.signature || cursor.head;
    return { claims, cursor: complete ? { head: scanHead } : { head: cursor.head, before: signatures[signatures.length - 1]?.signature, scanHead }, coverage: 'Finalized, top-level platform-vault claims with exact SDK discriminator and inner legacy SPL transfer; historical income attribution remains unallocated', blockers: [...blockers], cluster: getRuntime().cluster };
}
