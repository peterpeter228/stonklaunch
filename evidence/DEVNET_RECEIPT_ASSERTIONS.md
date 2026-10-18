# Devnet receipt assertions

Offline review of five supplied finalized receipts. No keys, signing, network requests, or test files were used.

Computed assertions: 49 PASS; 0 FAIL.

## Results

- **platform**: slot 512352312; network fee 5000 lamports; native wallet delta -5450760. [Devnet receipt](https://explorer.solana.com/tx/3ft1kLvKEJq28ieAKHAZLyTJRsrKXbZTMpob8T81qsrR3LJ5sG2fdix8MPikPeqy1DiWXE9RR8u1ogPPXVzptJPZ?cluster=devnet).
- **launch**: slot 512353031; network fee 10000 lamports; native wallet delta -20617040. [Devnet receipt](https://explorer.solana.com/tx/4zPogNeJhs6ybcZ7EXkAmFzWA1rpnitQcBs6p1Rq5ReNY7TNuXNHSSTu6Ceg4kH4HxSS4a1BDkMknBmwaUDLH7ts?cluster=devnet).
- **buy**: slot 512353289; network fee 5000 lamports; native wallet delta -14470320. [Devnet receipt](https://explorer.solana.com/tx/3dPqtvAuDvMGPeHhvtxZUMcYyzmhm9Hj7eVCJubVB2gPqfn9MixZVZTuszgUajRJ2CA7FiY7MpnV3pRRNFF2CBhB?cluster=devnet).
  - Exact input 10000000; output 353078001725 >= instruction minimum 351312611716. Platform and creator vault increases: 50000 and 50000 WSOL raw.
- **sell**: slot 512353562; network fee 5000 lamports; native wallet delta 4871583. [Devnet receipt](https://explorer.solana.com/tx/4wH53h6ESR7PG4jMeksc5ks5t1kwvX6RnbXuQZVLBHaM9rvEYzh6SQhDXg7Ltabp4TgSNY1ssCwhYafx5qypLDLa?cluster=devnet).
  - Exact input 176539000862; output 4876583 >= instruction minimum 4852200. Platform and creator vault increases: 24691 and 24691 WSOL raw.
- **claim-platform**: slot 512353776; network fee 5000 lamports; native wallet delta -1493440. [Devnet receipt](https://explorer.solana.com/tx/enc3BaW2FXv3hN12NnV8Dd33pNcRRNiDXjiRKDkGZtg7ovaKzqMLYgQvLkrgcUv2K8w93xdg7oNtCkahn2hk8E1?cluster=devnet).
  - Platform vault decrease 74691 equals claimant WSOL ATA increase 74691. Native SOL was not credited: 1488440 lamports new ATA rent + 5000 network fee.

## Scope limitations

- Creator claim was not submitted; creator vault accrual is proven but creator receipt is NOT_RUN.
- Same wallet is administrator, creator, trader and claimant. These receipts do not test unauthorized-wallet rejection or independent role separation.
- No saved prepared-plan summary is present in these files. Minimum output is checked against the executed instruction, not an independently preserved user-review quote.
- Program allowlist and decoded transfers establish observed paths, not a full formal security audit or comprehensive validation of every instruction field.
- Evidence is devnet SOL only, not mainnet economic readiness, migration execution, LP rights, hosted metadata, UI acceptance, or historical revenue coverage.
- The disposable wallet key was not persisted, per parent report; balance presence is not evidence of future recoverability.

## Sources and reproducibility

- evidence/DEVNET_RECEIPTS_20261018.json; SHA-256 5ac3f331a32d587e3080a7b455e5fa762a8170a9e11d307a18f64c1ce1fdd981
- evidence/DEVNET_EXECUTION_20261018.json; SHA-256 e7694aca48058e1577737df8fbc6421e6f893e7cd2ee456d47edeb35c3c29dfb
- Discriminators and vault PDA derivation: installed @raydium-io/raydium-sdk-v2 exports anchorDataBuf, getPdaPlatformId, getPdaPlatformVault and getPdaCreatorVault.
- Associated account derivation: installed @solana/spl-token getAssociatedTokenAddressSync.
- Account order reconstructed as static account keys + loaded writable + loaded readonly. Raw integers use BigInt; inner SPL TransferChecked amounts decode as little-endian u64 at offset 1. Missing pre-token entries for newly created accounts are zero.
- Full decoded instructions, token deltas, computed comparisons, and source hashes: DEVNET_RECEIPT_ASSERTIONS.json.
