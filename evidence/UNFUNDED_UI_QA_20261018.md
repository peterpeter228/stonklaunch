# Unfunded rendered UI QA — 2026-10-18

## Result: BLOCKED before current application rendered

Attempt window: 2026-10-18 13:46–13:48 UTC. This is a fresh execution report, not a reuse of earlier browser acceptance. No current UI PASS or newly reproduced UI defect is claimed.

Reviewed AGENTS.md, runs/2026-10-18/STATE.json, docs/PRD_AND_ARCHITECTURE.md, evidence/BROWSER_QA.md and evidence/TOKEN_INSPECTION_QA.md before interaction. Earlier reports contain desktop/500px DEMO evidence; they do not establish this run.

## Actions and observed outcomes

1. Current cloud Chromium inventory had only a new tab. Opening http://localhost:3010 returned net::ERR_CONNECTION_REFUSED.
2. Cloud native Xfce Terminal was launched through documented CUA/Sky APIs. The screenshot showed an empty shell prompt, with no startup command entered. The three available attempted text-input variants (bound typeText, Sky type_text, bound paste) each failed with `cannot identify the focused text field`. No command executed and no server was started in that Terminal. Same-root retries stopped after these three attempts, per repository limits.
3. Executor shell in this workspace successfully started the existing production build with APP_MODE=demo and APP_ORIGIN=http://localhost:3010 using Next's local CLI and loopback-only 127.0.0.1:3010. Output: Next.js 15.5.28, Ready in 724ms; process session 99762. No .env or credentials were read. Existing build ID is AfY3kiI267F-_oYxbEOSa (BUILD_ID mtime 2026-10-18 07:07:21 UTC).
4. Attempting to rebind the failed browser tab encountered the browser URL policy for the browser-generated error page's unsupported protocol. No attempt was made to inspect that blocked protocol or bypass the gate.
5. After successful executor startup, a fresh http://localhost:3010 tab still returned net::ERR_CONNECTION_REFUSED. Thus the executor's loopback server is not reachable from this cloud browser in this run. Separate runtime/network namespaces are an inference, not independently verified infrastructure details.

## Coverage in this run

- Discovery → external read-only inspection: NOT_RUN.
- Search / empty / retry recovery: NOT_RUN.
- Create invalid-input and disconnected-wallet validation: NOT_RUN.
- Trade / claim financial isolation in rendered UI: NOT_RUN.
- Desktop / available narrow width: NOT_RUN on the application.
- Exact 360px, physical mobile, wallet signing, transactions, faucet claims: NOT_RUN.
- Current application screenshots: none, because the application never rendered. Terminal/error-page screenshots are not substituted as product evidence.

No application source or unit-test files changed. No faucet, paid API, credentials, wallet connection, transaction, external publication or push attempted. Existing two-test-file budget remains unchanged.

## Recovery needed

Restore a working supported native text-input surface for the cloud Terminal, or provide an explicitly supported route exposing this existing executor server to the cloud browser. Do not route around denied browser protocols or claim historical screenshots as current regression proof. Stop the temporary executor server when no longer needed.

### Supported history recovery — 13:48 UTC

Parent supplied the relevant prior-run recovery: inspect existing native Terminal history with documented Up key, then execute only a visibly verified known startup command. One Sky Up press completed without an API error, but the fresh Terminal screenshot still showed an empty prompt and no command history. No Return was sent. This distinct history path did not recover server startup; no further typing retries were made.
