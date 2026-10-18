import type { Cluster } from '@/types/domain';

/** Read-only mint snapshot, not a swap quote, trading approval, or payout proof. */
export type TokenInspection = {
  cluster: Cluster;
  mint: string;
  tokenProgram: string;
  decimals: number;
  slot: number | null;
  observedAt: string;
  currentEpoch: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  feeStatus: 'none' | 'configured';
  transferFee: null | {
    currentBps: number;
    maximumFeeRaw: string;
    nextBps: number | null;
    nextMaximumFeeRaw: string | null;
    nextEpoch: number | null;
    configAuthority: string | null;
    withdrawAuthority: string | null;
    /** Mint-level withheld tokens only, not account-level totals or holder income. */
    withheldRaw: string;
  };
  dataSource: string;
  isStale: false;
  synthetic: boolean;
  payoutStatus: 'unknown';
  verifiedPayouts: null;
  tradingEnabled: false;
};
