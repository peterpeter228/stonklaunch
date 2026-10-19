# Hosted DEMO browser acceptance, 2026-10-19

Origin: https://stonklaunch-demo.onrender.com
Initial deployed source: 905fbbe834f4d9382d3424a7cbb943bb53d9cfe4.
Actual cloud Chromium desktop journey, measured 1180px source-page viewport;
source page clientWidth=scrollWidth=1180. No exact360 hosted or physical-mobile
claim: current supported tab API exposes no viewport emulation/resize method.
Prior CI mobile evidence remains separate.

Verified through actual clicks/inputs/reload:
- Home DEMO labels and sample launch catalog.
- Home name/symbol transfer into launch, retained through reload.
- Empty symbol and 45-byte Chinese name prevent review; restoring valid data recovers.
- Review fees and isolated DEMO completion explicitly state no token/signature/transaction.
- Negative trade amount disabled; positive input retained after actual DEMO server refusal.
- External search no-results and clear recovery; invalid mint refusal and recovery to
  synthetic 3% transfer cost, 1-token maximum and unknown payouts.
- Source footer navigation and real download; SHA256
  005f4ac42548668fc1671dea2000c8f5946e6b39ddd98e0f9e164ef83381b104,
  gzip/tar readable, matched deployed source checksum.
- Actual poster download 1080×1350 and QR https://stonklaunch-demo.onrender.com/token/demo-orbit.

Initial poster FAIL: all text rendered as missing-glyph boxes in deployed Docker
runtime. Preserved original bad image as demo-poster.png, plus poster-check.json.
Parent owns font-package correction/redeploy. Do not label this image corrected.

Screenshots 01–07 are actual hosted captures, exported from supported browser
screenshot API; source and home were independently visually inspected. Website
HTML fonts/layout are intact. Poster defect is image-generation runtime-specific.
Browser error log's last50 entries were automation-extension metadata errors,
not sufficient evidence for a blanket zero-console-error claim.

No wallet connection/signing, credentials, external posting or financial action.
Awaiting fresh font-fix deployment for final poster and source checksum checks.

## Font-fix verification, 01:34–01:35 UTC

Final deployment dep-dban513bc2fs73c1ldk0, source f64fc79ef8548d3761aa764cd1fe6a4be77f1933. Fresh browser PNG download demo-poster-fixed.png is visually readable, including DEMO watermark,1080×1350, with decoded public-origin QR. Fresh source download hash15b204478ed4c4cf07a2641b7860b3ac0fb39b93f0b2f29e19d97ad15239a5fd matched. Rechecked sell quote refusal and recovery; input retained and button enabled. Last500 error-log records contained no non-extension entries. Final screenshots08–10 preserve source, corrected poster modal and sell refusal. Scoped hosted desktop DEMO acceptance complete; no hosted360, physical mobile, wallet or production-finance claim.
