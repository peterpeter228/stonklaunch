# Durable creator acceptance runner: claimed single-step execution

Status: IMPLEMENTED FOR REVIEW, not dispatched. No secret loaded or funded transaction executed during implementation. Unit tests and typechecking are not chain acceptance.

## Fixed boundary

- Private repository `peterpeter228/stonklaunch`, `refs/heads/main`, workflow `.github/workflows/devnet-creator-acceptance.yml`, attempt 1 only.
- Solana devnet RPC `https://api.devnet.solana.com`, verified genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- Existing durable wallet `AFa5wrbY5ExUjf6qSuC2mtfNGV97Fo7xxBTgtcRouKho`, recovered only from existing repository secret `STONK_DEVNET_KEYPAIR_JSON`. Never create another funding wallet.
- Existing test platform `9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz`; original admin/claim wallet unchanged. Platform and creator fees remain 50 bps each, referral zero.
- One fixed sequence: zero-buy launch; 0.01 free devnet SOL buy; sell half current token balance; creator fee claim. One transaction and one funded-wallet signing callback per dispatch. No platform creation/update/claim, faucet, mainnet, custom amounts, or automatic resubmission.
- Fixed simulated payer-debit ceilings including conservatively added network fee: launch 0.05 SOL, buy 0.02 SOL, sell and claim 0.01 SOL each. Account context/minimum simulation slot reduce stale-balance risk; this is a preflight check, not a price guarantee.
- Synthetic `example.invalid` metadata is not hosted-metadata acceptance. Creator fee vault is creator-plus-quote protocol-wide, not attributable platform revenue.

## Durable ownership and source pinning

`evidence/DURABLE_CREATOR_LEDGER.json` is the sole public acceptance ledger. The four slots are append-only in meaning: never delete, clear, replace or reset a claimed slot. Repository history/artifacts alone are not a uniqueness ledger; the current consumed slot blocks even when no signature exists. This trusts authorized repository writers not to roll back/delete the ledger or change reviewed workflow code. It does not protect against a malicious repository administrator.

1. After code review and commit, choose the reviewed full source commit SHA. The source commit contains the workflow and empty initial ledger; later ledger-only commits may advance main without changing execution code.
2. Parent uses GitHub file SHA compare-and-set to add exactly the next slot with `nonce`, `sourceSha`, `runId: null`, `state: "claimed"`. Nonce is a fresh public 16–80-character alphanumeric/underscore/hyphen identifier. All prior slots must already be finalized and independently verified. Do not alter them.
3. Parent dispatches `mode=execute`, exact `step`, `source_sha`, `claim_nonce`, and default empty `public_recovery_json`. Verify the resulting unique run ID, then CAS-bind that ID into this same slot. Never bind a different dispatch or rerun. The read-only gate waits up to 180 seconds for this binding. If the gate times out before signing, inspect and retain the claim; do not silently replace it.
4. Checkout is pinned to `source_sha`, never latest main for execute. Runner verifies actual Git HEAD; claim source matches; the workflow file blob at `GITHUB_WORKFLOW_SHA` must equal that at reviewed source. Repository, ref, workflow identity, run ID, nonce and attempt are all bound. Reruns reject before checkout, dependencies and secret exposure.
5. Gate checks identity without the wallet secret. After dependencies install with lifecycle scripts disabled, only the execute step receives the existing secret. GITHUB_TOKEN contents-write permission is job-scoped; checkout does not retain credentials. No PAT or new persistent credential is created.
6. Runner verifies prior on-chain finalized receipts, exact signed-message hashes, instruction discriminators, payer, mint/pool, creator/platform/quote binding, then CAS-transitions `claimed -> signing` and reads it back before parsing the wallet secret or generating a mint. A consumed slot cannot sign again, including a process failure before signing.
7. The awaited wallet callback independently validates the exact step instruction and simulates bounded debit. Trades/claims additionally pass the existing detailed transaction guard. Launch permits only one initializeV2 plus compute-budget instructions, fixed wallet/platform/mint/pool/quote, no extra transfers/programs or nonzero priority fee.
8. After signing but before any submission, CAS-transitions `signing -> signed` with public mint, pool, signature and SHA-256 serialized message hash. Readback must exactly match before the callback returns and existing submit code can broadcast. Public local snapshot/log is also written before broadcast. No signed transaction bytes or secret keys are persisted. Existing signed identity fields are immutable.
9. Submit has `maxRetries: 0`. Poll only the original signature, then verify successful finalized transaction, exact message hash and instruction identity plus launch binding. Record full public receipt/readback and fees. Only then CAS `signed -> finalized` with slot, with exact readback.

## Ambiguity and recovery

Every CAS write is attempted once. A failed/timeout write triggers one read to inspect durable state and then stops regardless of whether the write landed. No retry, resigning or broadcast follows an uncertain write. If signed CAS landed but readback/local checkpoint failed, the recorded signature is still available for public reconciliation; the helper never receives a return value authorizing broadcast.

A claimed/signing slot with no signature is not permission to start again. A signed slot with no chain receipt is not proof of failure. Do not rerun or clear it. Parent must manually inspect the original run logs, public ledger and on-chain signature/mint; distinguish definitely unbroadcast/expired from unknown outcome before proposing any further action. The runner intentionally provides no reset/retry path. An on-chain finalized receipt with a failed final ledger update can be manually reconciled into the same immutable slot, never replaced by a new transaction.

Prepare remains read-only and secret-free; its optional public recovery hints are not used as execution authority. Earlier five-transaction evidence and old ephemeral checkpoints remain untouched. Public snapshots are append-only under `evidence/durable-creator/<run-id>-<attempt>-<timestamp>/`; artifact upload includes only JSON there, never private keys, signed bytes, environment dumps or arbitrary error text.

## Local verification

23 unit tests across the existing two files passed, including mismatched identity/rerun rejection, already-consumed empty-signature slots, prior ordering, competing stale CAS, ambiguous CAS no retry, and signed-field immutability. TypeScript checking passed. These are local fixtures/mocks only. Actions token permissions, real RPC preparation, simulated debit ceilings and funded steps remain unexecuted until authorized dispatch and independent receipt verification.
