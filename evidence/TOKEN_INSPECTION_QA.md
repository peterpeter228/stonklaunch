# Read-only token inspection acceptance
2026-10-18 05:14 UTC. Flow: Discover → External discovery → inspect mint → read fees/authorities → change token → close/reopen → invalid input/retry/recovery → search by mint/clear filter.

## Implemented
Current transfer-fee rate and per-transfer cap; future epoch schedule; mint/freeze/config/withdraw authorities; provenance slot/network/time (explicit ISO UTC); mint-level withheld balance distinguished from actual payouts. No payout prediction, break-even estimate, new fee, signature, or external-pool trading enabled. Unknown payouts stay unknown.

## Automated checks
15 tests across the existing two test files PASS; typecheck PASS; production build PASS. Fixtures cover exact integer ceil/cap/u64, epoch activation, demo without fetch, legacy and Token-2022 mint parsing, zero authority, uninitialized mint, bad owner/discriminator/TLV, and epoch rollover. Fixtures are not live-chain proof.

## Actual public read
USDC mainnet mint read succeeded at slot458312894, observed2026-10-18T05:08:00.057Z; reported no transfer-fee extension plus separate mint/freeze authorities. Initial attempt timed out, bounded retry succeeded. Separate Token-2022 public catalog/inspection first attempt timed out. One bounded retry succeeded on mint78pERgfjdqXt8GbGjbXzhDC5kb1XCEXmd388zwT7HhS4, slot458315142, observed2026-10-18T05:16:05.882Z: active100bps, explicit cap and separate fee-setting/withdraw authorities, no future schedule, payouts unknown. This verifies one actual Token-2022 read, not every mint/extension or trading. See raw public read logs.

## Actual cloud browser
Cloud Chromium, http://localhost:3010/, production build; Browser skill/plugin absent, used available CUA browser/Playwright surface without installing browser packages. This is not a user-device or public deployment test.
- Page identity/content/overlay: correct StonkLaunch, meaningful content, no framework error overlay.
-500px viewport: clientWidth485==scrollWidth485, no horizontal overflow.
-1180px viewport: clientWidth1165==scrollWidth1165; three-card desktop layout.
- Synthetic3%/cap1 token sample, scheduled2% at epoch102, unknown payouts displayed.
- Switching to no-fee sample removes prior3% and scheduled data; explicitly not risk-free.
- Close removes panel; reopening works. Invalid mint produces explicit demo-only error; retry does not fake success; entering valid fixture recovers.
- Mint-address search finds the existing matching row. No-match state has Clear search and restores rows.
- Same-mint repeat inspection remounts a fresh request; useApi ignores unmounted request results. An artificially delayed network race was not injected in this browser.
- Final refinement fixed focus scroll so the panel header and Close button stay visible, then retested desktop entry.500px layout was checked before this scroll-only refinement; exact360px remains NOT_RUN.
- Source-filtered localhost console log query returned[]; unfiltered log contained browser-extension metadata errors, not application stack errors. Expected demo invalid-input response was observed in UI.

Screenshots: token-inspection-desktop.png(final), token-inspection-narrow.png(earlier narrow authorities view). No real-wallet browser transactions, Supabase auth, payout history or Zap verified.

## Independent review
Argon native streaming returned HTTP200 STOP. Accepted mint-search and dedup improvements. Rejected incorrect account discriminator offset82 suggestion: installed SPL source checks byte165 before TLV. Existing API wrapper already normalizes network failures; no raw RPC leak reproduced. Full dispositions in ARGON_FINDINGS_RESOLUTION.md.
