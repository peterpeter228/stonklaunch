# Dependency security review

Updated 2026-10-18 04:46 UTC. The user approved sending dependency names and versions to the npm registry for audit. The subsequent audit actually completed; it is no longer waiting for permission. Raw machine-readable result: `dependency-audit-final.json`.

## Result

Production audit: **0 critical, 1 high, 4 moderate**, across 228 total dependencies reported by the tool (187 dependencies and 41 optional dependencies; zero development dependencies in this audit). This is **not a clean audit** and not production financial acceptance.

Initial audit reported nine advisories. The `next>postcss: 8.5.30` same-major override replaces the vulnerable 8.4.31 resolution; the final result no longer lists the four PostCSS advisories. `pnpm-workspace.yaml` records the override. `build-argon-ui-final.txt` and `unit-final.txt` provide subsequent successful build and 13-test evidence; that evidence does not independently prove exploitability is absent.

## Remaining advisories and scoped mitigations

### bigint-buffer 1.1.5: one high

- [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg): buffer overflow via `toBigIntLE`; the audit lists no patched version.
- Native builds are explicitly disabled in `pnpm-workspace.yaml`. Inspection found no `.node` binary in the installed bigint-buffer package, and the test log confirms the pure JavaScript fallback is used.
- This mitigates the reported native binding path for this installation only. It is not removal of the vulnerable dependency or a guarantee for another build image. Recheck the packaged deployment and do not re-enable native compilation without review.

### uuid 8.3.2: one moderate

- [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): missing buffer bounds checks in v3/v5/v6 with caller-provided buffers; audit patched range is >=11.1.1.
- Installed jayson 4.3.0 browser client imports `require('uuid').v4` for request IDs. This is different from the advisory's described paths, but does not prove all transitive execution paths safe.
- No incompatible major-version override was applied solely to hide the audit warning. Upstream remediation or verified compatible replacement remains open.

### stream-json 1.9.1: three moderate

- [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x): nested filter complexity denial of service; audit patched range >=3.5.0.
- [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x): accumulated JSONC comment rescanning; audit patched range >=3.6.0.
- [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc): Assembler prototype pollution; audit patched range >=3.6.0.
- These packages are introduced through jayson. The inspected web3.js client path uses `jayson/lib/client/browser`, not its streaming server/parser. This is scoped reachability evidence, not a full exploitability assessment. All deployment/import paths still require review; do not blindly force a cross-major stream-json update.

## Release gates

- Before a public/mainnet release, resolve or explicitly assess all remaining advisories against the actual deployed bundle and runtime inputs, and repeat the production audit.
- Verify native-binding build policy in the delivery image, not just this workspace.
- Check Raydium SDK GPL-3.0 distribution obligations; do not describe the whole dependency tree as unconditionally MIT or legally cleared.
- Recheck current Next 15 support status before production; the project has recorded the approaching 2026-10-21 support boundary. This report did not independently revalidate the vendor support schedule.
- Private DEMO use, fixture tests, source review, and an LLM review are not a substitute for protocol, authentication, real-wallet, and deployment acceptance.

No source code, API keys, or wallet keys were part of the npm audit metadata submission. Actual financial/deployed integration coverage remains separately documented and must not be inferred from this audit.
