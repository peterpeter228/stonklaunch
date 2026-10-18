# Durable creator acceptance runner: prepare-only release

Status: PREPARED, execution BLOCKED. This change has not been dispatched and has not loaded a wallet secret, signed a transaction, requested faucet funds, or broadcast anything. Local TypeScript checking is not chain acceptance.

## Fixed scope

- Network is Solana devnet, fixed RPC `https://api.devnet.solana.com`, verified genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- Expected durable wallet: `AFa5wrbY5ExUjf6qSuC2mtfNGV97Fo7xxBTgtcRouKho`. Existing repository secret only: `STONK_DEVNET_KEYPAIR_JSON`. No new wallet vault, secrets, or persistence destination.
- Existing synthetic test platform: `9ZVMxPgFLvgKGyyKVRVxaocst4UNuq6ATwrF5g8N85Cz`. Original admin and claim wallet remain unchanged. Fee binding must still be 50 bps platform and creator.
- Candidate ordered sequence: new launch with zero initial buy, buy 0.01 free devnet SOL, sell half the resulting token balance, creator fee claim. Each dispatch would perform exactly one step, never platform creation, update, platform claim, faucet request, mainnet transfer, or automatic retry.
- Synthetic `example.invalid` metadata is not hosted-metadata acceptance. Creator vault is creator-plus-quote protocol-wide, not attributed platform revenue.

## What can run now

Manual default-branch workflow `devnet-creator-acceptance.yml` defaults to `prepare`. It reads network/platform/wallet balance/fee vaults and validates supplied public recovery receipts. No wallet secret is supplied to that step. Dependency install disables lifecycle scripts. This workflow has no secret-bearing step; the existing recovery-verification workflow remains separate.

Optional `public_recovery_json` has only `mint`, `poolId`, and `signatures` fields. Signatures are keyed by `launch`, `buy`, `sell`, `claim-creator`. Example shape: `{"mint":"PUBLIC_MINT","poolId":"PUBLIC_POOL","signatures":{"launch":"PUBLIC_SIGNATURE"}}`. Never supply a keypair or secret. Preparation validates recovered mint creator, platform and quote; finalized successful transactions, expected payer, distinct signatures and pool account membership. Later steps require all preceding receipts. Missing or uncertain evidence blocks rather than inventing a new mint.

These are preliminary recovery checks, not a complete semantic proof of each transaction's instruction kind. No execution can rely on these checks alone in this release.

## Why execution remains blocked

Concurrency groups prevent overlap, not duplicates across workflow invocations. GitHub run history may be deleted or aged out; artifact upload may never run after a process crash. Neither is a durable claim or sufficient uniqueness ledger. A rerun after signing but before artifact upload must not silently generate another mint, buy twice, or claim twice.

The workflow's first step rejects execute mode before dependency install or secret exposure. The runner independently rejects execute mode before network work. No signing, keypair parsing, faucet, or broadcast code is present. Selecting execute does not enable it.

Before enabling execution, implement and review a durable public single-acceptance ledger with atomic compare-and-set ownership of each step, bound to trusted repository/ref and run ID. Commit the claim before signing. A prior claimed step must block new submission even when there is no signature/artifact. Reconcile original signature/mint and instruction semantics before advancing; unknown outcomes require investigation, not a new mint. Ledger permission and persistence choice require review. Do not merely remove the guards or substitute run-history scanning. Actions reruns must remain signing-disabled.

## Evidence and secret hygiene

- Old five-transaction receipts, assertions, execution report, and `DEVNET_PUBLIC_CHECKPOINT.json` are untouched.
- New public snapshots are append-only under `evidence/durable-creator/<run-id>-<attempt>-<timestamp>/`. Artifact names include run ID and attempt. Upload is limited to this directory's JSON files, never repository globs, node_modules, `.env`, keypair files, or home directories.
- Public snapshots contain allowlisted identity/context/transaction data, never wallet or mint keypair objects, environment dumps, raw recovery input, signed transaction bytes, or arbitrary exception text.
- This runner does not access the secret. Wallet identity is a fixed public key whose recovery proof is in `DURABLE_DEVNET_WALLET.json`; the separate existing verification workflow performs key recovery. Live recovery is not asserted by preparation.
- Error handling fails closed and emits only generic error text plus public snapshots. Evidence collection failure also stops the run.
- Legacy `devnet-session.ts` and `devnet-steps.ts` remain historical ephemeral tooling, not the new workflow path. Their old storage claim still describes that historical path; the durable runner uses its own accurate storage metadata and unique output directory.

## Verification performed locally

`pnpm typecheck` passed. An execute-mode rejection test uses no secret and must fail before any RPC or signing. Live prepare/network validation and Actions behavior remain untested until an authorized dispatch; funding remains awaiting the user. No existing finalized transaction evidence is replaced by these local checks.
