# Argon findings: verified disposition

Updated 2026-10-18 04:46 UTC. Raw model output is preserved in `ARGON_REVIEW_02.md` and `ARGON_REVIEW_03.md`. Findings below are developer-verified dispositions, not statements that every affected live workflow has passed. Source locations refer to functions rather than unstable line numbers.

## Review 02

### R02-1: Submission recovery deadlock — partially confirmed, hardened

`client-transactions.ts::submit` now distinguishes a typed `SendTransactionError` with a definite preflight simulation failure, before broadcast acceptance, from an ambiguous network outcome. The former becomes `failed`; the latter remains `confirmation_unknown`, blocking duplicate submission. The public recovery journal deliberately remains **before** broadcast: moving it after broadcast could lose evidence if the browser dies after acceptance. Error-string matching alone was not adopted.

Evidence: the actual submission helper is exercised through a JSON-RPC fetch fixture in `tests/lifecycle.test.ts`; `unit-final.txt` shows the definite-failure/ambiguous-outcome case passed. No actual transaction or wallet signature was sent by that fixture. Live network interruption recovery remains unverified.

### R02-2: Stale wallet/input plan — confirmed, hardened

`transaction-control.tsx` uses an epoch to invalidate obsolete asynchronous results and reviewed plans after wallet/input changes, snapshots wallet identity and bound signing functions, and checks reviewed input before signing. `recovery.ts` scopes journals to network and wallet and refuses corrupted/contextless recovery instead of silently overwriting it. In-flight ambiguous submissions are not treated as canceled merely because the UI changed.

Evidence: wallet/network journal isolation and corruption rejection pass in `unit-final.txt`. Actual wallet-extension switching and all React asynchronous race interleavings are **NOT_RUN**; the persistence test does not replace them.

### R02-3: Multi-transaction launch recovery — confirmed, scope restricted

`client-transactions.ts::buildClientLaunch` rejects `result.transactions.length !== 1` before signing or sending. The first version supports only an atomic single-transaction creation. This is a deliberate unsupported-case refusal, not a completed multi-transaction resume feature.

Evidence: source inspection and successful typecheck/build. A dedicated SDK multi-transaction-return fixture and real interrupted multi-transaction launch are **NOT_RUN**.

### R02-4: Missing wallet-context header — hardening accepted, authentication-bypass claim not established

The launch prepare request now sends `x-wallet-address`. `auth/server.ts::requireSession` requires wallet context for mutating requests and rejects a mismatch with the verified session. The header is not authentication: Supabase `getUser` and the verified Web3 wallet identity remain required. Existing session checks mean the model's claim of a general authentication bypass was too broad.

Evidence: source inspection. Deployed Supabase authentication plus wallet A/B switching and endpoint mismatch behavior remain **NOT_RUN** end to end.

### R02-5: Summary not bound to signed instructions — confirmed, defense added

`transaction-guard.ts::assertPlanTransaction`, invoked before wallet signing, resolves bounded address lookup tables and checks payer, permitted programs, pool/platform, discriminator, instruction count, exact amounts, mint/account identity, claim recipients, and platform changes. R03-6 strengthened this further. This is defense in depth, not a complete independent transaction security audit.

Evidence: negative fixtures for wrong program/pool/minimum output/extra protocol instructions pass in `unit-final.txt`. Full real SDK-generated transaction coverage remains pending.

## Review 03

### R03-1: All nonzero-slippage CPMM trades fail — not confirmed as stated; construction improved

Installed SDK `src/raydium/cpmm/cpmm.ts` mutates `swapResult.outputAmount` during `swap` (line 759 in this installation). Therefore the old post-build equality was not necessarily comparing an untouched estimate, contrary to the model's premise. Nevertheless `service.ts::prepareTrade` now copies the result, sets its output to the already reviewed exact integer `minOutRaw`, and passes SDK slippage zero, retaining a post-build equality check. This avoids float-derived second rounding and mutation of the original estimate.

Evidence: dependency and source inspection; successful build. Real migrated CPMM nonzero-slippage swaps are **NOT_RUN**.

### R03-2: Legitimate seeded WSOL setup rejected — confirmed and fixed narrowly

The selected SDK uses `CreateAccountWithSeed` plus initialization for temporary WSOL. The guard now permits only wallet-derived seed accounts owned by the legacy Token program with size 165, reviewed WSOL purpose, rent plus bounded input funding, matching initialization owner/mint, and wallet-directed close. Unrelated transfers and excessive cumulative funding remain rejected.

Evidence: `official seeded WSOL setup and close shape passes the client guard without a real transaction` passes in `unit-final.txt`. This positive fixture does not establish first-buy/sell/claim live execution.

### R03-3: Foreign-platform pools accepted — not confirmed

`chain.ts::readPool`, called by the reviewed service functions, already verifies program ownership/layout and rejects a decoded platform ID different from runtime configuration. This central check was outside review 03's submitted file subset. Do not remove it or add a permissive fallback. External discovery remains read-only and distinct from own-platform trading/revenue.

Evidence: `chain.ts::readPool` and call-site inspection. Dedicated live foreign-platform rejection is not claimed by this report.

### R03-4: Reconciliation cursor loss — not confirmed; unsafe suggested skip rejected

`reconcile.ts` retains `scanHead` across full pages. `worker/indexer.ts::reconcileClaims` persists the returned cursor only after all claim upserts succeed; exceptions preserve the old cursor. Claim upserts are uniquely keyed by cluster, signature, and event index. A retry can rescan an incomplete page safely. Advancing `before` past an unavailable transaction, as suggested, could actually skip evidence, so that change was not adopted.

Evidence: source/caller inspection, not a complete multi-page failure-injection test. Historical transaction availability, deployed database failures, and full replay coverage remain unverified. Current reconciliation covers finalized top-level platform-vault claims only, not general income attribution, creator history, or all CPI-wrapped claims.

### R03-5: Fee availability depends on truncated discovery list — confirmed and fixed

`service.ts::observedQuoteMints` now directly queries program accounts filtered by platform and, when requested, quote mint, reading only the 32-byte mint field. `readFees` and `prepareFeeClaim` no longer depend on the display list's 50/100-pool cap. This removes that cap-based false negative without inventing historical fee income.

Evidence: source inspection and successful build. A live platform containing more than 100 pools/multiple quote assets is **NOT_RUN**; RPC provider limits and large-query performance remain operational concerns.

### R03-6: Protocol instruction type/parameters not bound — confirmed and fixed

The guard now requires exactly one reviewed protocol instruction, matches its discriminator to the plan kind/side, checks exact input/minimum output and zero referral fee where applicable, and verifies pool/mint/account positions. Claim vault PDAs, recipients, platform-update variants, and creation allocations are also checked.

Evidence: guard-negative and seeded-WSOL-positive tests pass. This is not comprehensive fuzzing or a mainnet readiness certificate.

## Acceptance boundary

The current unit log contains 13 passing tests in two files. Compilation and actual DEMO UI testing are separate evidence classes. No test here proves production financial safety, profit, paid demand, complete historical fee accounting, live Supabase integration, or a successfully completed devnet financial journey. The final release decision must incorporate subsequent chain/UI evidence and unresolved dependency advisories.

## Review 04: read-only token inspection
Native streaming HTTP200 STOP, 28.14 seconds, reported 7265 tokens. No secret or test-wallet key sent.
- RPC error leakage claim: not confirmed. The route wraps inspectToken in api(), and errors.ts normalizes unknown upstream failures to a generic503 without echoing provider messages. The model did not inspect that wrapper. Keep existing safe boundary.
- Token-2022 discriminator at offset82 claim: rejected. Installed SPL unpackMint checks data[ACCOUNT_SIZE] (165), not82, before TLV parsing for every extended mint. Applying the proposed offset82 check would reject valid accounts. Added positive Token-2022 and negative discriminator/TLV fixtures to the existing test file.
- Mint-address catalog search: confirmed and fixed. Name/symbol/mint are now searchable, whitespace trimmed, and no-match state is distinct from upstream empty state. Actual paste/search/clear recovery tested.
- Duplicate catalog rows: robustness accepted. Deduplicate mint+pool identity at the data boundary and use composite React keys.
- Runtime network switching: process-static server configuration; no UI mode switch exists. Panel is remounted for each inspection and close/reopen. No live cross-cluster switching guarantee added.
Model findings remain independently verified rather than blindly applied.
