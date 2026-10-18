# Rendered Chromium acceptance harness

Status: IMPLEMENTED, NOT YET EXECUTED. This document is not a PASS receipt.

## Execution

Manual GitHub workflow: `.github/workflows/browser-acceptance.yml` (main only).
It builds the actual Next.js production app, starts it on runner-local loopback,
and uses actual Chromium clicks, inputs, downloads and DOM assertions. It does
not replace the UI with direct route calls. One journey is repeated at desktop
1440×1000 and Chromium mobile emulation 360×800, using one worker and no retries.
The existing two unit-test-file limit is unchanged.

Required exact dev dependency: `@playwright/test` version `1.64.1`, installed
through the root-owned package manifest and lockfile. Official npm registry
verification on 2026-10-18 returned integrity:
`sha512-IaYGml/nSOiZWROfPtuIL7neuu9qDOZ3TNvNljUIrhDMxiGTgPjzj/g9p9RxpS2tSepPDRY+UwAaEeiKtUvIAg==`.
Official instructions: https://playwright.dev/docs/ci and
https://playwright.dev/docs/browsers. The workflow installs Chromium with its
Linux dependencies using the locked Playwright CLI. Actions are pinned to the
same reviewed commit SHAs already used by this repository.

For an isolated local checkout with no credentials or `.env` files:

    APP_MODE=demo APP_ORIGIN=http://127.0.0.1:3110 pnpm build
    pnpm exec playwright install --with-deps chromium
    pnpm exec playwright test --config=e2e/playwright.config.mjs

## Assertions and preserved evidence

- Home → launch with draft continuity across reload.
- Empty symbol and excessive UTF-8 name bytes disable review.
- Invalid image recovery to a valid synthetic preview without losing inputs.
- DEMO completion explicitly states no token, transaction or signature.
- Sample token negative amount rejection, buy/sell server refusal and input retention.
- Actual poster click/download, PNG 1080×1350 and decoded QR to that local DEMO token.
- Graduation evidence distinguishes target progress from verified migration.
- External catalog outage (explicit one-response browser fault injection), retry,
  no-results search and clear, invalid mint refusal and recovery to actual DEMO
  fee inspection, authority details and refresh.
- Terminal My launches and Fee management permission/no-income states.
- Exact viewport and horizontal overflow assertions at each checkpoint.
- Screenshots, full HTML report, Playwright traces, console/page errors, error
  HTTP responses, build/test logs and source SHA retained in an Actions artifact.
  All recordings use fresh contexts and synthetic data; no secret or environment
  dump, production storage state, wallet extension or external publication.
- Browser network is limited to this runner-local app. Unexpected outbound
  attempts fail acceptance. No successful API response is mocked.

The only injected response is the clearly labelled catalog 503 used to test
recovery. It does not prove a real upstream provider outage. Expected 403 trade
refusals, invalid demo-mint 400 and that synthetic 503 are retained in diagnostics;
other failed HTTP responses, uncaught page errors and unexpected console errors
fail the run. No existing credentials or production secrets are referenced by
the workflow. Do not add secrets to this job or run against a production URL.

## Evidence boundaries

Even a green run proves only the rendered isolated DEMO journey and Chromium
360px emulation, not physical mobile, wallet connection/signing, chain creation,
mainnet-readonly mode, live discovery failure, swaps, claims, migration or revenue.
The trade refusal is `DEMO_NO_REAL_TRANSACTIONS`, not a claim of live or
mainnet-readonly wallet testing. No real token is created. Do not change launch
readiness or acceptance gates until the actual run and artifacts are reviewed.
Record run URL, exact SHA, result and any failing assertion after execution.
