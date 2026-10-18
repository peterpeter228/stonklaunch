# Dependency security review

Updated 2026-10-18 18:55 UTC. Dependency audit metadata submission to the npm registry was authorized. No source, API keys, or wallet keys were submitted. This report separates historical evidence from the current locked installation; neither is financial-production acceptance.

## Current implementation and evidence

- Next.js **16.4.2**, React 19.3.1, TypeScript 5.9.3, Node 24.19.0 and pnpm 11.25.0. Development and production builds explicitly use Webpack. This replaces the former Next 15.5.28 baseline; old build logs are not evidence for the upgraded tree.
- `pnpm-workspace.yaml` retains `next>postcss: 8.5.30`, adds the narrowly scoped `jayson>uuid: 11.1.1`, and records the exact `bigint-buffer@1.1.5` patch. The lockfile contains these resolutions.
- Clean frozen installation and `scripts/verify-dependency.mjs` passed: one patched bigint package copy, 16 integer cases, zero native-loader attempts, two SPL fixtures, UUID 11.1.1, and no stream-json in the inspected runtime module cache. Machine-readable result: `dependency-runtime-next16.json`.
- `unit-next16.txt`: 31 tests passed. `typecheck-next16.txt`: typecheck passed. These are scoped engineering checks, not proof of deployed exploitability or financial correctness.
- Final patched Next 16.4.2 Webpack build completed: `build-next16-patched.txt`. Fresh production audit `dependency-audit-next16.json` reports **0 critical, 1 high, 3 moderate**, across 231 dependencies (187 dependencies and 44 optional dependencies; zero development dependencies). UUID and PostCSS are absent from the remaining advisories. **This is not an audit-clean result.**
- Post-build scan of all 32 `.next/**/*.nft.json` traces found 17 with Jayson and bigint-buffer, zero with stream-json. The Jayson files are exclusively its browser client, request generator, and package manifest. Full trace matches: `dependency-reachability-next16.json`. Static traces and the runtime-import check are complementary bounded evidence; they do not prove all possible dynamic/deployed paths safe.

## Historical audit, not the current result

`dependency-audit-final.json` is the earlier Next 15 audit: **0 critical, 1 high, 4 moderate**, with 228 reported dependencies (187 dependencies and 41 optional dependencies). Its filename does not make it the latest audit after dependency changes.

The still earlier audit had nine advisories. The PostCSS override removed four PostCSS advisories. Historical `build-argon-ui-final.txt` and `unit-final.txt` recorded a successful build and 13 tests for that earlier tree; they must not be presented as current upgrade verification.

## bigint-buffer 1.1.5: high advisory retained, native path mitigated

[GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg) describes a native buffer overflow through `toBigIntLE`; no upstream patched version is listed. The package enters via `@solana/spl-token > @solana/buffer-layout-utils`, including the SDK's SPL dependency.

The prior mitigation only disabled compilation and observed JavaScript fallback in one installation. The current committed `patches/bigint-buffer@1.1.5.patch` removes only the native `bindings` loader from the official package's `dist/node.js`. Upstream JavaScript conversion functions and package licensing remain unchanged. No community replacement or new funds contract was introduced.

Patch SHA256: `8b6415ba0cf2075d00961458a4ca8bbd263ef2e00458315a8c427a39361c2831`.
Patched module SHA256: `b536bb4aad1f59646c54e612c19eb498f31c0d79903276a0ae9acf6d2e6e8693`.

The offline verification gate checks the exact resolved module hash and all installed pnpm bigint copies. A sandbox records any attempted require, preventing even caught native-load attempts from passing. It exercises the patched code without loading a native binary, LE/BE conversion boundaries for u64/u128, empty/invalid input, and fixed raw SPL mint/account decoding. Removing the loader means a stale native binary cannot be selected by this patched entrypoint.

The gate runs before `build`, `start`, and `indexer`. Docker copies the patch and verifier before a frozen, scripts-disabled install and runs the gate. Native build denial is retained. **The package advisory remains present and is mitigated, not a clean upstream fix.** Actual Docker/deployed-image execution remains an independent gate. Directly bypassing the provided scripts, altering installed code, or future dependency/entrypoint changes invalidate this assessment. The patch does not claim to correct every upstream JavaScript API edge case or eliminate resource-exhaustion risk for arbitrary oversized inputs.

## uuid: narrowly scoped verified remediation

The [maintainer advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq) lists 11.1.1 as patched. The [official 11.1.1 manifest](https://raw.githubusercontent.com/uuidjs/uuid/v11.1.1/package.json) provides both CommonJS and browser exports.

Jayson 4.3.0 uses `require('uuid').v4()` without arguments in the inspected browser client, request generator, and utilities. The exact `jayson>uuid: 11.1.1` override therefore preserves the APIs actually consumed without upgrading unrelated UUID dependencies. The gate resolves UUID from Jayson's actual dependency context and verifies a generated v4 request ID plus an entirely local JSON-RPC request/response. Broader build/tests remain necessary, and future Jayson API changes require reassessment.

## stream-json 1.9.1: three residual moderate advisories

- [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x): quadratic nested path-filter work; fixed in 3.5.0. The advisory expressly excludes StreamValues/StreamArray/StreamObject from this particular filter issue.
- [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x): JSONC comment rescanning; fixed in 3.6.0. The advisory expressly distinguishes the unaffected plain JSON parser.
- [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc): Assembler parsed-object prototype replacement; fixed in 3.6.0. It is not global Object.prototype pollution, but can alter application decisions if affected parsed objects are consumed.

Jayson introduces this package. Its streaming utilities require legacy CommonJS paths `stream-json/streamers/StreamValues` and `stream-json/utils/Verifier`. The [official 3.6.0 package](https://raw.githubusercontent.com/uhop/stream-json/3.6.0/package.json) is ESM with reorganized paths/API, so a forced cross-major override is not a verified compatible fix.

The application has no direct jayson/stream-json imports. The inspected web3 RPC entrypoint is `jayson/lib/client/browser`, which uses request generation and ordinary JSON parsing, not the streaming server/parser. Loading the resolved SPL/Web3/Raydium SDK paths in the offline gate did not load stream-json. This supports scoped non-reachability, not a universal absence-of-exploitability claim. Importing Jayson's server/utilities or adding streaming/JSONC parsing requires a new assessment before release. The current build trace coverage is recorded above and in `dependency-reachability-next16.json`.

## Release gates

- Repeat the production audit after dependency changes. Do not suppress the remaining high/moderate advisories or describe this tree as audit-clean.
- Run the dependency gate in the actual delivery image and preserve its locked patch, scripts, and entrypoints. Local and configured Docker checks are not proof that a deployed image was built or started.
- Review actual deployment imports and untrusted inputs; preserve evidence for any residual-risk acceptance. Recheck stream-json reachability whenever those change.
- Check current Next support/security releases before deployment; the obsolete Next 15 deadline is no longer the installed-version baseline, but this is not an indefinite support guarantee for Next 16.
- Check Raydium SDK GPL-3.0 distribution obligations. The dependency tree is not unconditionally MIT or legally cleared.
- Private DEMO, offline fixtures, source/LLM review, build and test success do not replace authentication, protocol, real-wallet, deployment or financial acceptance.
