# Recovery hardening — 2026-10-18

## Fixed
- Prevent broadcast after wallet approval when the reviewed quote or blockhash has expired.
- Recheck pending operations after approval and preserve the original mint journal before duplicate launch attempts.
- Keep confirmed/finalized success or failure terminal even if a later RPC would fail.
- Treat processed errors as provisional in client confirmation, ambiguous-send reconciliation and server observation.
- Preserve confirmed chain state and remove the signing plan when application refresh fails. Explain that balances/pool binding still require verification; do not offer repeat signing.

## Evidence
- 18/18 unit tests PASS: unit-unfunded-recovery.txt.
- Typecheck PASS: typecheck-unfunded-recovery.txt.
- Direct route smoke checks PASS: routes-unfunded-recovery.txt. Not browser evidence.
- Production build PASS: build-unfunded-recovery.txt.
- New regression failed against original client helper and passed patched helper (worker validation).
- Independent read-only review of the confirmation/refresh UI patch found no blocker in its intended path.

## Not verified / remaining
- Current rendered UI regression BLOCKED, see UNFUNDED_UI_QA_20261018.md. Historical screenshots are not evidence for this increment.
- No real wallet approval or new chain transaction executed.
- Pending rechecks are not an atomic cross-tab submission lock.
- No production release claimed. Durable wallet funding remains awaited.
