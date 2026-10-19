# StonkLaunch corresponding-source release

The copyright holder has authorized distributing the StonkLaunch application source under GNU GPL version 3, while retaining a private development repository. The root LICENSE contains GPLv3. StonkLaunch-authored application code in this release is licensed under GPL-3.0-only; third-party code retains its own copyright notices and licenses. No additional warranty is provided. Recipients may copy, modify and redistribute covered code under GPLv3. This notice does not claim ownership of third-party code, trademarks or user content.

Release preparation date: 2026-10-18. This source-release packaging and notice were added on that date. Any actual SDK modifications must be identified separately; the included SDK source is copied from the installed pinned package, not described as independently authored code.

## Build a local candidate

Run `python3 deploy/build-source-release.py --output /tmp/stonklaunch-source-release` from a checkout with its pinned dependencies installed. No network, install, signing, upload, repo visibility change or environment-file read occurs. Output is a deterministic gzip/tar archive, adjacent review manifest and SHA-256 file. The full manifest is also inside the archive. Unchanged input bytes and installed dependency inventory produce identical archive bytes. A content-derived suffix distinguishes changes even if package version stays unchanged.

The allowlist includes complete application src/public, tests, migrations, patches, package/lock/workspace files, build configuration, runtime/install verification scripts, container definitions and release notices. It includes the installed exact Raydium SDK's src, package metadata, README and LICENSE. It excludes private repository history, internal planning, logs, evidence, run state, node_modules, generated outputs and all original environment files. A blank safe .env.example is generated for installation compatibility. Known credential signatures cause failure; this check is not a complete secret scanner. Review all selected files and the manifest before publication. Symlinks are not copied.

## Rebuild and run

Use Node 24.19.0 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm test` and `pnpm build`. Use `pnpm start` for the application and `pnpm indexer` for a separately managed indexer. The installation script is invoked with `bash scripts/install.sh`. Dependency verification checks the mandatory bigint-buffer patch. The exact package versions and patches are in the lock/workspace files.

Configuration names and defaults are defined in the application source and `scripts/verify-environment.mjs`; the source snapshot contains no production credentials. Demo defaults do not constitute a production configuration. Database schema is in supabase/migrations. Apply it only to an authorized database. External RPC, Supabase, wallet and protocol configuration are operational inputs, not supplied secrets. The upstream SDK's package.json describes its own source build tooling; its src copy is not substituted for the application package-manager dependency automatically.

## Publication checklist and remaining gaps

1. Build the final application and archive from the same frozen source tree. Rebuild the archive after any application or package/lock change. Verify manifest hashes against the release tree. Never publish an old archive beside a new bundle.
2. Installed dependency notices (including embedded Next framework notices) are copied to third_party/notices with THIRD_PARTY_NOTICE_INDEX.json. The browser-reachable GPL Raydium source and LGPL rpc-websockets preferred source/build files are included. See THIRD_PARTY_NOTICES.md for the bounded bundle/trace review. Other dependencies remain pinned package-manager inputs; installed metadata is not a formal exhaustive SBOM. Review changes to dependencies or the delivery method rather than treating this release as blanket legal clearance.
3. Review image/font/logo provenance, any unrecognized or missing license, attribution requirements and compatibility. This script gives no legal clearance. The exact scope of a covered work remains a legal judgment; this candidate deliberately includes the entire authored application rather than claiming only importing frontend files are covered.
4. After review, host the version-matched source archive at no additional charge, with a clear Source / License link beside the public application and accessible legal notices. Keep source available as required by GPLv3 section 6(d). A private GitHub link or email-only source request is not a replacement for equivalent download access.
5. Recipients obtain GPL modification and redistribution rights. Keeping GitHub private does not make the released source confidential. Do not add an NDA or no-redistribution restriction. Exclude credentials and unrelated private records, not source necessary to modify/build the covered application.

References: https://www.gnu.org/licenses/gpl-3.0.html (sections 1, 4–6); https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedMods; https://github.com/raydium-io/raydium-sdk-V2 .


## Pinned upstream source support

rpc-websockets 9.3.9 preferred source, original license, build configuration and npm lock are included in deploy/source-vendor/rpc-websockets. Its TypeScript source matches all 18 source-map entries in the installed browser/server outputs. Its SOURCE_ORIGIN.md explains rebuilding/recombining a modified library with the complete application.

Raydium 0.2.74-alpha source is copied from the installed package. Its missing tsconfig.json is supplied from the official matching-version commit e2e8bcd865189c994682a9477ec8eaf1e2da8aaf. The original config extends @tsconfig/node16, whereas upstream package metadata lists @tsconfig/node14: rebuilding the SDK independently requires providing the @tsconfig/node16 development preset along with its declared build tools. This is a build-tool configuration mismatch upstream, not an application dependency change made here. Package build-lib documents the tsup command; the app uses the pinned published SDK by default. No new tools were installed for this release review.

## Deployment packaging

The Python builder is a local release preparation tool, not a runtime/build dependency of the web app. Prepare and review the small archive before the production container build, then place the approved archive, checksum and notices in public/source for static hosting. The builder explicitly excludes public/source to prevent self-inclusion. Python need not be installed in the production Node container. Rebuild the source archive after the final UI/source change and before the deployment build; never regenerate it from a different checkout.

## Stale-source CI guard

Before the application build, run `python3 deploy/verify-source-release.py` in CI with the staged public/source archive and SHA256SUMS.txt. The stdlib-only guard does not extract files, install dependencies, read environment files or use the network. It validates the outer checksum, every manifest member and exact current authored source set/content, including new files in the allowlisted trees. Generated .env.example, dependency inventories and archive-only third_party files are integrity-checked but not compared to local originals. A changed, missing or new authored file requires regeneration and review of the source archive. This guard is not a clean dependency-install test or legal certification.
