# Dependency review status

2026-10-18. Initial pnpm production audit reported postcss, bigint-buffer, uuid and stream-json advisories. A final online audit was blocked by action review because npm receives dependency names/version metadata. Explicit approval is pending. Do not claim the final audit passed.

Implemented mitigation: next>postcss is pinned to8.5.30, replacing8.4.31. Production builds and the browser journey pass after this same-major update.

Residuals: bigint-buffer1.1.5 has an initial high-severity advisory. Its native build is explicitly disabled in pnpm-workspace.yaml and no .node binary exists in the installed package; the JS fallback is used. This is a scoped mitigation, not a blanket clean bill of health. jayson4.3.0 depends on older uuid/stream-json. Installed @solana/web3.js loads jayson/lib/client/browser; that file uses uuid.v4() for request IDs, rather than the advisory's v3/v5/v6 caller-supplied-buffer paths. A full exploitability audit and upstream remediation remain outstanding. No incompatible major override was applied merely to hide audit findings.

Private demo use and tested code paths do not establish production financial safety. Before public/mainnet release, review remaining advisories, the SDK GPL-3.0 distribution obligations, and Next15 support status (maintenance window approaches2026-10-21).
