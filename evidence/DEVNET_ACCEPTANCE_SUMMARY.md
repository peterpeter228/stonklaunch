# Devnet execution acceptance — 2026-10-18

## Outcome
Five real devnet transactions finalized with meta.err=null: platform configuration, token creation, buy, sell, platform-fee claim.49 deterministic receipt assertions passed against recovered public receipts. This is not mainnet income or production readiness.

- Platform:9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz. Readback feeRate5000 and creatorFeeRate5000, expected claim wallet, CPMM config, test-only LP0/0/1000000.
- Mint:6oeScPH9gs5qytR1KLwC3z8ky23WzWchXosMGwgNVSbT. Pool:3nwA7Py3AFUDwJv6Q9UWmyovKsQ12uQpWg7nsDsw58nR.
- Buy:10,000,000 raw WSOL input;353,078,001,725 base raw received ≥351,312,611,716 instruction minimum.
- Sell:176,539,000,862 base raw input;4,876,583 raw WSOL output ≥4,852,200 instruction minimum.
- Platform claim:74,691 raw WSOL left its vault and arrived in claimant WSOL ATA. Native SOL decreased due to fee+ATA rent; claim is not automatic unwrapping.
- Creator vault accrued74,691 raw WSOL. Real creator claim:NOT_RUN. Unsigned simulation and transaction guard passed later at slot512356487 (17477CU, estimated5000lamport network fee), with signature verification disabled and no broadcast. Simulation does not replace real execution.

Public receipts and decoded comparisons:DEVNET_RECEIPTS_20261018.json,DEVNET_RECEIPT_ASSERTIONS.json/.md. Original execution ledger remains unchanged so its recorded SHA256 stays reproducible.

## Actual failure found and repaired
The first confirmation used WebSocket subscription. In this executor it repeatedly failed DNS and delayed UI confirmation despite the transaction already finalizing. Promise.race did not cancel the underlying subscription. Replaced the application's confirmation path with bounded HTTP signature-status polling, no rebroadcast. Unknown outcomes still block retries. The new path was exercised by later successful devnet transactions; an added regression test forbids WebSocket confirmation and checks pending→confirmed and timeout.16 unit tests,typecheck,and production build pass.

## Test-process interruption and key policy
Original wallet DotkAg6PowGVeqKTax9rYaBtVhYVLkysDJ3ruGLLJ2z2 held an in-memory key only. Creator-claim attempts timed out while reading pre-signature balance. The executor then lost the process; no persisted key existed, so it could not be reused. Five completed receipts were recovered from public finalized RPC data. No claim retry was fabricated. This was a test-harness resilience gap, not loss of real funds.
User explicitly authorized replacementwallet B2yhMVcoJxBgV9w7esdtKzeHUfsxkrxrvEQrRoexGavC, but the human faucet quota was exhausted and user requested no further manual claims. Replacement remained unfunded and was closed at2026-10-18T07:13:42Z without persisting its key. Neither temporary address should be used for future funding.
The harness now atomically checkpoints public addresses, signatures and public evidence before/after relevant stages; it never serializes keypair objects. This preserves receipts, not signing capability. Durable signing recovery would require a separately authorized secure credential strategy or user-controlled wallet; none was silently introduced.

## Additional read-only negative checks
A separate creator public key was rejected from platform fee preparation with CLAIM_WALLET_REQUIRED. Empty original platform vault preparation returned NOTHING_TO_CLAIM. These are service-level checks, not deployed Supabase session tests.

## Argon supervision
Three earlier short reviews completed and informed fixes. Review05 submitted this confirmation fix/harness/receipt evidence but returned HTTPError without a completed review. One narrower follow-up06 returned HTTP503; neither is counted as approval of this increment, and further retries stopped. Native independent receipt review produced49 assertions.

## Remaining gates
No real creator claim, migrated CPMM execution/LP rights, hosted metadata, Supabase Auth/storage, wallet-extension end-to-end browser signing, exact360px viewport or public deployment acceptance. Existing actual browser DEMO evidence remains separate. Known dependency advisories remain. No profitability claim.
