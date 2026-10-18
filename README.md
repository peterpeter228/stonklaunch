# StonkLaunch

Private full-stack Solana LaunchLab application. Next.js15.5.28 / React19.3.1 / TypeScript5.9.3 / Raydium SDK0.2.74-alpha / Supabase.

## Current state

The five-page **DEMO** application builds and has been exercised in a real cloud browser, including validation, draft recovery, PNG/QR, terminal and graduation states. Backend mode boundaries and embedded PostgreSQL RLS checks pass. All observed UI defects were fixed and retested.

This is **not a launched or revenue-verified platform**. Own PlatformConfig, live Supabase deployment, real wallet transactions/fee claims, non-SOL capability, and parts of historical fee indexing remain unverified or incomplete. Two native-streaming Argon reviews completed; verified findings were fixed and retested. Devnet execution is currently blocked by zero test balance and the public faucet limit. No mainnet transactions have been performed.

Read [DELIVERY_README_ZH.md](DELIVERY_README_ZH.md), [state](runs/2026-10-18/STATE.json) and [browser evidence](evidence/BROWSER_QA.md). The kickoff documents are the requested specification, not proof that every requirement passed.

## Local demo

Use Node24 and pnpm11.25.0. `pnpm install --frozen-lockfile`, then `pnpm build` and `pnpm start`. Default mode is DEMO; no credentials are required and no real financial transaction can be built. See `.env.example` for the explicit deployed configuration. Never place private keys or seed phrases in this app.

Source uses the official Raydium SDK, whose GPL-3.0 notice is retained under deploy. No permissive license is asserted over third-party code. Review licensing and remaining dependency advisories before external distribution or mainnet use.
