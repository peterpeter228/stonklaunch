# Proposed bounded hosted acceptance (NOT EXECUTED)

Files are staged only under /tmp/stonk-hosted-acceptance. No source/package/workflow changes were made. Syntax checked with node --check only.

## Before root approves copying or running

1. Deploy reviewed /drafts UI + browser/server auth fixes to https://stonklaunch-demo.onrender.com. Confirm the deployment is running the reviewed commit; this harness does not infer deployment SHA from checkout SHA.
2. Runtime must report mainnet-readonly, mainnet-beta, walletEnabled=false, actionsEnabled=false, canonical origin, authConfigured=true and storageConfigured=true. The harness fails before generating wallets if any differs.
3. Complete the pending server key setup through the already approved secure channel. Do not supply it to this workflow. Existing database migration, RLS, verified_wallets registration and public asset bucket must already be installed. Supabase Web3 auth must allow this deployment's canonical root URI.
4. Provide the exact deployed NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY as public repository variables (or replace the workflow values with reviewed literal public config). The runtime endpoint currently exposes booleans, not the public URL/key. Prefer this explicit input over scraping minified bundles. The harness accepts only a publishable key or an anon-role JWT and verifies the actual UI auth request uses the same key/project.
5. Copy reviewed harness to e2e/hosted-account-acceptance.mjs and workflow to .github/workflows/hosted-account-acceptance.yml. Do not replace existing mock/browser acceptance or add a test framework. Dispatch once only after ready checkbox is confirmed. An intentional fresh dispatch, not rerun, is needed for any justified new attempt.

## Evidence

One console JSON line reports PASS/FAIL, current phase, failed assertion label (when applicable), passed bounded assertions, test fixture label and public test wallet addresses. No auth tokens, JWTs, cookies, private keys, request/response bodies, browser console, stacks, screenshots or browser state are persisted. No GitHub artifacts required. Raw caught errors are deliberately not logged; a failure's phase/label is the starting point for a separately scoped sanitized diagnosis.

Two Ed25519 keypairs are generated only after readonly/config preflight, held solely as Node KeyObjects for this process. Only public addresses enter Chromium. The exposed signing binding accepts exactly the expected Solana sign-in message, own address, canonical root URI, fixed no-assets/no-transactions statement and fresh timestamp, with a small signature budget. Provider contains no transaction signing/sending methods. Strict browser network allowlist permits the app, the configured Supabase Auth endpoints, and public image GETs, not RPC endpoints. The app can still perform its normal server-side public read RPC calls; no financial route is enabled. No key recovery, airdrop, funding, or chain transaction is attempted.

Actual rendered UI performs each login, private save, reload/open, PNG upload and logout. Auth/session and direct app tests confirm two verified users, mismatched-wallet read/write denial, post-logout private denial, and four prepare-route READ_ONLY_MODE denials. Direct Supabase REST reads using only those test sessions prove the owner can select its own row but cannot select the other row (not just application filtering). A second user's attempted save against the first draft ID must fail and leave owner data unchanged. Browser wallet accountChanged clears all private UI state.

The public 2x2 PNG is uploaded from both accounts, read back publicly, compared to the same Sharp normalization hash, and required to have distinct /icons/<verified-user-id>/<sha256>.png namespaces. This proves application ownership namespace, not storage.objects.owner_id (uploads intentionally use server-role storage). Public images are publicly readable by design, so cross-account GET is not expected to be denied. No owner-image launch check can be reached in readonly mode, since financial-mode rejection must happen first; do not claim launch-time ownership enforcement was dynamically exercised.

Fixtures are labelled TEST FIXTURE in text and test-fixture filenames. The content-addressed stored PNG filename has no label because the application owns the immutable format. Test accounts, rows and images remain; there is no permanent deletion. Losing process-only keys intentionally makes these accounts unusable after this acceptance, as specifically authorized. Server logout clears local browser sessions but does not imply previously issued JWTs are instantly invalidated; the harness makes no such assertion.

## Scope limits

No live wallet extension, funding, on-chain launch/trade/claim, arbitrary account access, server key, schema/security modification, source release or deployment verification is included. Wallet behavior is a tightly constrained signMessage-only test provider; Supabase auth/storage and deployed application are real, not mocked. One bounded journey, no retries, no new unit-test files. Full hosted execution remains blocked until root readiness.

## Root review corrections

connect() now selects the Connect wallet button only inside .workflow-page, then selects the exact Connect Solana wallet button inside the dialog, avoiding header aria-label ambiguity.

The exact eight-line SIWS whitelist was checked against installed node_modules/.pnpm/@supabase+auth-js*/node_modules/@supabase/auth-js/src/GoTrueClient.ts lines 1935–1964 and src/lib/auth/browser.ts. With the app's nonempty statement and no signInWithSolana options, the SDK concatenates: (1) host + login preamble; (2) wallet address; (3) blank; (4) statement; (5) blank; (6) Version: 1; (7) URI: canonical origin root with trailing slash; (8) Issued At: current ISO timestamp. There is no trailing newline. Additional optional fields are not supplied by this app and remain rejected by the harness. No key or signature generation was needed for this source validation.

Upload expected-byte normalization now matches the route's Sharp constructor options (limitInputPixels:16000000, animated:false), rotate(), resize(512,512,{fit:'cover',withoutEnlargement:true}), png(), and toBuffer(). The known generated 2x2 PNG passes the route's separate PNG format/size checks; the harness does not bypass them.
