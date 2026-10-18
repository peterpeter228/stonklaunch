# Durable creator acceptance runner: claimed single-step execution

Status: TARGETED RECOVERY PATCH FOR REVIEW. First launch run 39151038033 stopped at LOOKUP_TABLE_NOT_ALLOWED before funded-wallet signing or broadcast. The parent separately reconciles the terminal run and public wallet activity. No execution, secret access or ledger mutation was performed while implementing this patch. Unit tests and typechecking are not chain acceptance.

## Fixed boundary

- Private repository `peterpeter228/stonklaunch`, `refs/heads/main`, workflow `.github/workflows/devnet-creator-acceptance.yml`, attempt 1 only.
- Solana devnet RPC `https://api.devnet.solana.com`, verified genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- Existing durable wallet `AFa5wrbY5ExUjf6qSuC2mtfNGV97Fo7xxBTgtcRouKho`, recovered only from existing repository secret `STONK_DEVNET_KEYPAIR_JSON`. Never create another funding wallet.
- Existing test platform `9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz`; original admin/claim wallet unchanged. Platform and creator fees remain 50 bps each, referral zero.
- One fixed sequence: zero-buy launch; 0.01 free devnet SOL buy; sell half current token balance; creator fee claim. One transaction and one funded-wallet signing callback per dispatch. No platform creation/update/claim, faucet, mainnet, custom amounts, or automatic resubmission.
- Fixed simulated payer-debit ceilings including conservatively added network fee: launch 0.05 SOL, buy 0.02 SOL, sell and claim 0.01 SOL each. Account context/minimum simulation slot reduce stale-balance risk; this is a preflight check, not a price guarantee.
- Synthetic `example.invalid` metadata is not hosted-metadata acceptance. Creator fee vault is creator-plus-quote protocol-wide, not attributable platform revenue.

## Durable ownership and source pinning

`evidence/DURABLE_CREATOR_LEDGER.json` is the sole public acceptance ledger. The four slots and archived attempts are append-only in meaning: never delete or clear a consumed claim. The sole specifically reconciled pre-sign exception below preserves the complete original claim before the parent creates a replacement active claim; the runner cannot perform this operation. Repository history/artifacts alone are not a uniqueness ledger; the current consumed slot blocks even when no signature exists. This trusts authorized repository writers not to roll back/delete the ledger or change reviewed workflow code. It does not protect against a malicious repository administrator.

1. After code review and commit, choose the reviewed full source commit SHA. The source commit contains the workflow and empty initial ledger; later ledger-only commits may advance main without changing execution code.
2. Parent uses GitHub file SHA compare-and-set to add exactly the next slot with `nonce`, `sourceSha`, `runId: null`, `state: "claimed"`. Nonce is a fresh public 16–80-character alphanumeric/underscore/hyphen identifier. All prior slots must already be finalized and independently verified. Do not alter them.
3. Parent dispatches `mode=execute`, exact `step`, `source_sha`, `claim_nonce`, and default empty `public_recovery_json`. Verify the resulting unique run ID, then CAS-bind that ID into this same slot. Never bind a different dispatch or rerun. The read-only gate waits up to 180 seconds for this binding. If the gate times out before signing, inspect and retain the claim; do not silently replace it.
4. Checkout is pinned to `source_sha`, never latest main for execute. Runner verifies actual Git HEAD; claim source matches; the workflow file blob at `GITHUB_WORKFLOW_SHA` must equal that at reviewed source. Repository, ref, workflow identity, run ID, nonce and attempt are all bound. Reruns reject before checkout, dependencies and secret exposure.
5. Gate checks identity without the wallet secret. After dependencies install with lifecycle scripts disabled, only the execute step receives the existing secret. GITHUB_TOKEN contents-write permission is job-scoped; checkout does not retain credentials. No PAT or new persistent credential is created.
6. Runner verifies prior on-chain finalized receipts, exact signed-message hashes, instruction discriminators, payer, mint/pool, creator/platform/quote binding, then CAS-transitions `claimed -> signing` and reads it back before parsing the wallet secret or generating a mint. A consumed slot cannot sign again, including a process failure before signing.
7. The awaited wallet callback independently validates the exact step instruction and simulates bounded debit. Trades/claims additionally pass the existing detailed transaction guard. Launch permits only one initializeV2 plus compute-budget instructions, fixed wallet/platform/mint/pool/quote, no extra transfers/programs or nonzero priority fee.
Lookup tables are limited to eight. Before signing, RPC resolves all tables and every compiled account index must resolve. Historical receipt checks use the finalized transaction meta.loadedAddresses, not a refetch of possibly changed tables. All original instruction/account/amount checks still apply.

8. After signing but before any submission, CAS-transitions `signing -> signed` with public mint, pool, signature and SHA-256 serialized message hash. Readback must exactly match before the callback returns and existing submit code can broadcast. Public local snapshot/log is also written before broadcast. No signed transaction bytes or secret keys are persisted. Existing signed identity fields are immutable.
9. Submit has `maxRetries: 0`. Poll only the original signature, then verify successful finalized transaction, exact message hash and instruction identity plus launch binding. Record full public receipt/readback and fees. Only then CAS `signed -> finalized` with slot, with exact readback.

## Ambiguity and recovery

Every CAS write is attempted once. A failed/timeout write triggers one read to inspect durable state and then stops regardless of whether the write landed. No retry, resigning or broadcast follows an uncertain write. If signed CAS landed but readback/local checkpoint failed, the recorded signature is still available for public reconciliation; the helper never receives a return value authorizing broadcast.

A claimed/signing slot with no signature is not permission to start again. A signed slot with no chain receipt is not proof of failure. Do not rerun or clear it. Parent must manually inspect the original run logs, public ledger and on-chain signature/mint; distinguish definitely unbroadcast/expired from unknown outcome before proposing any further action. The runner intentionally provides no reset/retry path. The single explicitly reconciled parent-side recovery described below does not add one. An on-chain finalized receipt with a failed final ledger update can be manually reconciled into the same immutable slot, never replaced by a new transaction.

Prepare remains read-only and secret-free; its optional public recovery hints are not used as execution authority. Earlier five-transaction evidence and old ephemeral checkpoints remain untouched. Public snapshots are append-only under `evidence/durable-creator/<run-id>-<attempt>-<timestamp>/`; artifact upload includes only JSON there, never private keys, signed bytes, environment dumps or arbitrary error text.

## Local verification

26 unit tests across the existing two files passed, including mismatched identity/rerun rejection, already-consumed empty-signature slots, prior ordering, competing stale CAS, ambiguous CAS no retry, and signed-field immutability. TypeScript checking passed. These are local fixtures/mocks only. The original run exercised Actions permissions and RPC preparation but stopped before signing; the ALT-patched launch subsequently finalized. The buy then stopped after durable signing and before submission. Each result remains separate; the new diagnostic/recovery patch below has not been dispatched.


## Sole explicit pre-sign recovery: run 39151038033

The reviewed source 78f91071d443819c999fa0c92754993560ba67fd rejected any ALT in assertInstruction, before wallet.sign and before the submit helper could broadcast. The consumed original claim is exactly:

    {"nonce":"stonk-launch-20261018-174350","sourceSha":"78f91071d443819c999fa0c92754993560ba67fd","runId":"39151038033","state":"signing"}

Original consumed ledger blob SHA: 82253a96d8c0abb419b27d98cd5bc3096b332161. No signature, message hash, mint or pool fields were persisted. Absence alone is not enough to retry: parent must additionally verify the terminal failed run, exact LOOKUP_TABLE_NOT_ALLOWED log and pre-sign code path, plus public balance/signature reconciliation, and persist that public proof.

Only after that verification, parent may perform one explicit CAS on the latest ledger to preserve the entire original claim under attemptHistory and create a replacement launch claim with a fresh nonce, reviewed patched sourceSha, runId null, state claimed, and recoveryOfRunId "39151038033". The normal dispatch/run-binding gate then applies. Do not rerun the old Actions run. Do not clear, mutate, or omit archived history.

attemptHistory must be exactly one entry with step "launch", claim equal to the complete original object above, and proof containing:

- runUrl: https://github.com/peterpeter228/stonklaunch/actions/runs/39151038033
- runStatus: "completed", runConclusion: "failure", runAttempt: 1
- errorCode: "LOOKUP_TABLE_NOT_ALLOWED"
- fundedWalletSigned: false, broadcastAttempted: false
- ledgerBlobSha: "82253a96d8c0abb419b27d98cd5bc3096b332161"
- reviewedAt: actual ISO timestamp of parent reconciliation
- evidencePath: parent-persisted JSON proof at evidence/<filename>.json

The runner only validates/preserves this history. It never archives an attempt, writes a replacement claim, resets a slot, or retries a failed operation. A different failed run, second recovery, signed archived entry, missing proof/history, reused nonce/run, or unchanged source SHA is rejected. The same repository-writer trust boundary applies to parent-authored reconciliation evidence; the runner does not claim that a boolean alone proves no broadcast.

Additional local tests cover ALT live/historical account identity, missing lookup tables or receipt addresses, exact recovery case restriction, rejected signed/duplicate history, and history preservation through forward CAS transitions. 26/26 tests and typecheck pass; this patch remains unexecuted against Actions/RPC.


## Buy diagnostic patch and sole explicit signed-attempt recovery

Run 39151817814 preserved a signed buy checkpoint, then emitted failed without submitted. Source 60431d61defb46eb026999a45a0c4155399243ed places that post-sign validation failure before sendRawTransaction. The exact inner error was suppressed. Logs show claim consumption 17:56:20.049Z, awaiting signature 17:56:24.138Z, signed checkpoint 17:56:25.776Z, and failure 17:56:25.838Z. This does not establish quote expiry: quote creation occurred less than 5.79 seconds before failure, against an unchanged 20-second TTL. RPC or blockheight errors remain possible. Never relabel this failed buy as acceptance PASS.

The diagnostic patch introduces typed public failure codes BLOCKHEIGHT_RPC_FAILED, BLOCKHEIGHT_INVALID_RESPONSE, BLOCKHASH_EXPIRED, QUOTE_EXPIRED and QUOTE_INVALID. No raw RPC error is serialized. Before signing, public snapshots record blockhash, lastValidBlockHeight, reviewed expiresAt, check phase, timestamp, observed height and read-attempt count. The exact validity context is also immutable in the signed ledger checkpoint. An after-sign typed error may add one failure annotation through CAS without changing state=signed, signature/hash, validity, mint or pool. Annotation uncertainty stops without another write or transaction attempt.

Only the durable wallet adapter opts into at most two extra readonly blockheight calls. Retryable cases are 429, timeout and specified network failures; invalid responses, actual expired height, expired/invalid quote and non-transient errors never retry. Each opted-in read is bounded to four seconds and the overall operation is bounded by the original quote expiry (or 20 seconds for operations without one). No quote is refreshed/extended and no signing/broadcast is retried. Existing non-opted-in adapters keep zero retries and their connection timeout. Independent ALT checks, ledger read, payer account and fee lookup are parallelized; context-bound simulation and the post-sign validity guard remain mandatory.

Parent may review one specific buy recovery but the runner cannot perform it. Preserve the complete original signed buy claim verbatim as attemptHistory[1], after the original launch history. Its run is 39151817814; source is 60431d61defb46eb026999a45a0c4155399243ed; nonce is stonk-buy-20261018-175345; state remains signed. Preserve mint, poolId, signature bdwh8ZUbAa55gAWKok88CAX5jZusHFtGmkFsbwoccrz7jCPHLdXWub6QnVxChJqnDeB134o3PGb4UqrWv12rJ6F and messageHash 403041c3371fd27e00524befb44ea465f0fde69597b27c3b460f15af69266d11. Never discard these fields or treat a null chain status alone as permission to resubmit.

The second entry has step buy, claim equal to that complete original eight-field object, and proof with:

- runUrl: https://github.com/peterpeter228/stonklaunch/actions/runs/39151817814
- runStatus completed, runConclusion failure, runAttempt 1
- errorCode POST_SIGN_VALIDATION_FAILED_BEFORE_SUBMIT (not an invented nested cause)
- fundedWalletSigned true, broadcastAttempted false, reviewedNoSubmitCodePath true, originalSignedBytesPersisted false
- signatureStatus null, walletBalanceLamports 4979382960, observedSlot at least 512518716
- stages exactly [awaiting_signature, signed-before-broadcast, failed, blocked]
- ledgerBlobSha d7700694d9f4f6a2d632ea481b57db62e8176a14
- reviewedAt actual ISO reconciliation time and evidencePath pointing to the parent's persisted evidence/<filename>.json

Only after reviewing terminal logs, no-submit code path, original signature status, unchanged balance/history and absence of persisted signed bytes may parent explicitly CAS-archive this attempt and create a new active buy claim. The new claim requires recoveryOfRunId 39151817814 and a fresh nonce/source/run binding; the finalized launch must still match the archived mint/pool. This is not automatic recovery and does not create authorization by itself. Missing signature/hash, changed archived claim or absent proof is rejected. The only later signed-failure exception is the exact finalized-expiry reconciliation below; no generic signed-failure recovery is permitted. No ledger reset helper exists.

Local tests: 29/29 pass, typecheck passes. Coverage includes typed no-submit post-sign failures, transient read bounds, no retries for expired/invalid results, immutable diagnostic annotation and the exact signed-buy archive requirements. No funded execution or ledger mutation was performed during this patch.

### Final bounded buy recovery (run 39152770076 only)

`evidence/DURABLE_BUY_ATTEMPT_2_EXPIRY.json` records finalized expiry and absence evidence at 18:44:51–53Z: height 499743878 exceeds original last-valid height 499734995, original blockhash invalid, history-search signature and finalized transaction null, wallet unchanged at 4979382960 lamports, canonical mint ATA absent. This does not identify the previous RPC failure cause.

Only the parent may append the entire exact second buy claim (including signature, message hash, validity and failure) as history index 2, with a proof matching `ExpiredBuyAttemptHistory`, and create a new source/run/nonce-bound active claim recovering run 39152770076. The first two history entries remain intact. Three history entries are the hard maximum: no fourth buy attempt or generic reset is supported. The runner never archives or resets a claim. Existing signed-state persistence and ambiguity rules remain unchanged.

The runner installs a global fetch wrapper before configure. Only the fixed devnet RPC endpoint is paced, at least 334ms between request starts, including SDK and boundedConnection reads and submission. GitHub ledger CAS is untouched. Logs contain only safe RPC method, HTTP status, numeric RPC error, duration and allowlisted transport diagnostics. HTTP 429/403 permanently stop subsequent RPC requests for that process; no retry is made before or after Retry-After. Existing quote TTL, expiry checks, transaction guards and no-resubmit rules are unchanged. Pacing respects public service limits rather than claiming a proven rate-limit diagnosis; the public endpoint is not production infrastructure.
