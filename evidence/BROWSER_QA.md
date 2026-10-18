# StonkLaunch browser QA

Status: Completed actual DEMO UI journey and targeted recovery regressions. Five pages exercised. No real-wallet, chain, commercial or exact360px pass is claimed.

## Focused acceptance journey
1. Discover: inspect honest network/data/DEMO labels and empty state; enter synthetic public name/symbol, continue to launch without losing context.
2. Launch: refresh and restore public draft; test required fields, invalid image/parameters, unavailable quote assets, advanced defaults and complete fee summary. Check missing-wallet feedback without signing or creating wallets. A simulated rejection, if offered, is labelled simulation and does not prove actual wallet rejection.
3. Token: inspect actual source/age and route labels, buy/sell inputs, invalid amount/slippage, quote invalidation, disabled real actions where configuration or wallet is absent. No financial transaction.
4. Poster: download DEMO watermarked PNG, inspect dimensions/nonblank pixels and decode QR to the corresponding local DEMO route. No external sharing or X publication.
5. Terminal: click platform/my launches/fee management; inspect empty state, permission boundaries, per-asset and accrued/claimable/claimed separation. No claims.
6. Graduation: inspect status 0/1/2 distinctions, explicit CPMM and LP evidence/unknowns; DEMO not chain proof.
7. Narrow layout: use permitted native window resize only. Record measured width and overflow, focus and CTA visibility. Previous Chromium minimum was 500px; exact 360px stays NOT_RUN if unavailable. No policy-disabled devtools or incognito bypass.

## Evidence boundaries
Only one concentrated business journey plus targeted failure recovery. No new test files or source edits under this QA assignment. Cloud browser/native Terminal only, not user computer. Real signing, mainnet creation, buy/sell, claims, live migration and commercial income are NOT_RUN unless separately evidenced by authorized operators. Screenshot artifacts must exclude secrets and browser chrome. Synthetic inputs and DEMO outputs must remain clearly labelled.

The plan below was executed within the explicit evidence boundaries; chronological findings and fixes follow.

## Initial actual pass — 2026-10-18 03:13–03:39 UTC
Production build completed by root at 03:13. Native Terminal used the installed absolute Node executable with local Next CLI, APP_MODE=demo, APP_ORIGIN=http://localhost:3010, listening only127.0.0.1:3010. Native PATH did not contain pnpm. A typing timeout left an unsubmitted partial command; observed it before completing. No duplicate server launched.

- PASS homepage renders dark navy/mint interface and persistent DEMO/sample-data labels. No real transaction or fake candle claim.
- PASS synthetic name `SYNTHETIC QA Orbit` and symbol `QATEST` flow into launch, persist across refresh, and retain optional description across navigation.
- PASS symbols sanitize nonalphanumeric characters; empty symbol disables Review launch without erasing other fields. USDC/TSLAx/AAPLx/NVDAx remain disabled and awaiting verification.
- PASS review shows demo network, not-connected wallet, platform not configured/global not verified, target platform/creator0.50%, referral0%, chain protocol fee and network costs unknown rather than total1%.
- PASS Experience the demo explicitly says no token created, no transaction built and no wallet signature requested, then links to a separately labelled sample launch. No real wallet rejection/signing tested.
- PASS both sample buy and sell quote attempts return DEMO_NO_REAL_TRANSACTIONS. Input values remain. Defect found: negative amount enabled quote button; reported for correction and final retest.
- PASS poster modal/download: PNG1080×1350, RGB standard deviations41.17/40.60/40.18, visually nonblank and contains DEMO · NOT A REAL TOKEN, sample mint/pool and QR. Decoder verification pending. X editor link present with DEMO-prefixed text and correct local token route; no publication performed.
- PASS graduation sample status0 remains bonding curve. Separate Lunar sample status1 at100% remains migration pending, CPMM not yet verified, address unavailable. LP rights explicitly unverified, not permanently locked. No status2/live graduation tested.
- PASS terminal All/My/Fee tabs work. Synthetic cohort4, verified graduations0, denominator visible. My tab asks for wallet without pretending ownership; Fee tab public/no verified fees/DEMO_NO_REAL_REVENUE, separate attribution and claimable totals explained.
- Upload TXT selection completed with draft preserved but no visible error in initial build. Root identified error rendered only at review; final patch/retest pending. No uploaded image success yet claimed.
- PASS permitted native resize reaches minimum innerWidth500/client485/scroll485: launch reflows without page overflow. Exact360 NOT_RUN because browser minimum500 and policy-disabled devtools cannot be bypassed. Header wallet icon lost accessible name at narrow width; reported.

Artifacts from actual current app: home-desktop.jpg, launch-demo-review.jpg, poster-modal.jpg, demo-poster.png, graduation-desktop.jpg, terminal-fees-desktop.jpg, launch-narrow.jpg. All are DEMO, not chain or commercial proof. Prior Triptych artifacts are not used.

Remaining final patch checks: negative amount, invalid-image visible error, decorative glyph, narrow wallet accessible name, final build smoke. Real wallet presence/rejection/confirmation, signing/broadcast/claim, live migration,360px and physical mobile remain NOT_RUN.

## Final-build targeted pass — 03:41–03:46 UTC
Restarted native production process on root's03:40 completed build, refreshed browser. Negative trade amount now produces a positive-decimal validation message and disables quote. At500px token client/scroll widths both485; no page overflow. Wallet icon now has accessible name `Connect Solana wallet`. Invalid TXT now displays explicit PNG/JPG/WebP/2MB rejection on edit form and preserves all fields. Valid synthetic PNG previews with explicit DEMO-only/not uploaded/not saved notice. Found remaining stale validation warning after valid selection, reported; root patched, targeted retest pending.

Platform setup is collapsed by default in Fee management, expands desired-vs-chain configuration explanation and shows no financial action in DEMO. External discovery tab shows clearly synthetic DEMO catalog, read-only/no trade/no platform-income attribution. External live-provider failure not tested in demo mode.

Parent independently decoded the actual downloaded PNG using jsQR: `http://localhost:3010/token/demo-orbit`, evidence/poster-qr-verification.json. No QR failure remains. Localhost destination is not externally reachable sharing proof.

Final desktop screenshot home-desktop-final.jpg shows replaced SVG arrow/no unsupported registered trademark. Remaining home-only narrow defect found at500px: client485, scroll552 due to orbital decorative transforms. Screenshot external-narrow-overflow.jpg. Root notified for containment fix; do not extrapolate launch/token no-overflow result to whole app until retest.

Additional evidence: launch-narrow-final.jpg, trade-negative-narrow.jpg, home-desktop-final.jpg. Images may contain intentionally synthetic QA drafts and DEMO sample records only.


## Final outcome — 03:51 UTC
Root build `evidence/build-overflow-recovery.txt` completed03:47; normal production restart and browser refresh precede these checks. Home at innerWidth500 has clientWidth485 and scrollWidth485. Decorative overflow is fixed without hiding whole-page content. Invalid TXT produces the expected warning; selecting valid synthetic PNG afterwards yields warningCount0 and visible preview. Synthetic name, symbol and description remain intact. Screenshots: home-narrow-fixed.jpg and upload-recovery-final.jpg. All defects observed in this focused QA have been corrected and retested. Earlier failing screenshots are chronological, not current defects.

Supported result: interactive five-page DEMO experience, draft continuity, input/upload recovery, clear financial isolation, synthetic PNG download with independently decoded QR, terminal permissions/empty states, and non-graduated status0/1 distinctions. Desktop and permitted500px were inspected. Full GATE-3 mobile360 criterion and real-identity GATE-4 poster remain partial, not unconditional PASS. This report cannot establish GATE-1/2 chain execution or commercial readiness.

Not run: exact360px, physical mobile, real wallet connect/rejection/sign/broadcast/confirmation/claim, live create/trade, actual status2 migration/LP rights, external live discovery failure, oversized upload, complete keyboard-only walkthrough, X editor opening/posting, video recording. No demo output is credited as real revenue or real issuance. Current native local demo server remains running for parent inspection; no public hosting.
