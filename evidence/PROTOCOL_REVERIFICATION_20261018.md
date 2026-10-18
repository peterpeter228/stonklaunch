# StonkLaunch implementation protocol review

Checked 2026-10-18 UTC. Read all four assigned kit documents. Read-only public evidence; no credentials, wallet, signing, transaction, deployment or live RPC verification performed. SDK source snapshots used below are in /tmp/stonk-review. This report is not a successful on-chain execution claim.

## Exact dependency starting point

- Next.js **15.5.28**: published npm package retrieved successfully. Official 2026-10-14 security release explicitly identifies this as patched Maintenance LTS. Do not use older 15.5 security patches. Its Node range is `^18.18.0 || ^19.8.0 || >=20.0.0`; choose a current supported Node LTS operationally, not the obsolete minimum. Official support page still lists 15 Maintenance LTS and initial date 2024-10-21, with two-year window: re-evaluate before deployment on/after 2026-10-21. No silent Next16 migration.
- `@raydium-io/raydium-sdk-v2` **0.2.74-alpha**: current official GitHub package and npm latest metadata agree; npm tarball published. Pin exact version and commit lockfile. License GPL-3.0; preserve licensing and assess distribution obligations.
- `react` and `react-dom` **19.3.1**: npm latest metadata observed; satisfies Next15.5.28 `^19.0.0` peer range. This is registry/peer compatibility, not an application integration test.
- The root owns installation and lockfile; no dependency files changed here.

Sources: https://nextjs.org/blog/nextjs-security-update-october-14-2026 ; https://nextjs.org/support-policy ; https://registry.npmjs.org/next/15.5.28 ; https://registry.npmjs.org/react/latest ; https://registry.npmjs.org/react-dom/latest ; https://registry.npmjs.org/@raydium-io%2fraydium-sdk-v2/latest ; https://github.com/raydium-io/raydium-sdk-V2/blob/master/package.json

## Current quote and fee findings

The public mainnet configs API again returns WSOL, USD1 and HeyAnon, not USDC or xStocks as quote configurations. WSOL config is `6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX`; mint is `So11111111111111111111111111111111111111112`, decimals 9, protocol rate 2500, min raise 24000000000, default raise 85000000000. API observation is not RPC verification or a complete on-chain search. USDC inside swapInfo is not quote eligibility.

Source: https://launch-mint-v1.raydium.io/main/configs

Current platform documentation confirms rate denominator 1,000,000, platform cap 50000 and creator cap 5000. Desired 50 bps each therefore maps to 5000 each; referral zero; current observed protocol 2500 yields 1.25% total, not 1%. Creation requires creatorScale=0, with platformScale+burnScale=1000000. Legacy creator LP allocation may fold into platform rights; never promise a creator Fee Key from the old demo. Creator vault is creator+quote aggregate, not per-platform attribution.

Source: https://docs.raydium.io/products/launchlab/platform-config

GlobalConfig creation/update is protocol-admin/delegated-authority controlled. Current docs say old requires_platform_auth byte is padding and platform-side restrictGlobalConfig/allow PDAs now control access, whereas public API still exposes requiresPlatformAuth. SDK current PlatformConfig layout has restrictGlobalConfig/restrictCurveParam/curveRuleManager. Treat API flags as discovery hints, not authorization. Docs require new initialization CPMM migration; designated migration wallet signs MigrateToCpswap. No app-controlled universal graduate operation.

Source: https://docs.raydium.io/products/launchlab/global-config ; https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/launchpad/layout.ts

## Adapter contracts verified against official SDK source

All public-key inputs below are PublicKey objects unless specified otherwise. Raw amounts/rates are BN. Bind the Raydium instance owner to the intended wallet; constructing never authorizes executing. Both server and client reject incorrect runtime mode, owner/program/config/platform, stale quotes and arbitrary destinations.

### Reads and creation

`getRpcPoolInfo({poolId})` returns decoded pool plus programId and configInfo. `getRpcPoolsInfo({poolIdList})` returns `{poolInfoMap}` rather than an array. The helper exposes account owner but does not validate it against the expected LaunchLab program: wrapper must verify owner, discriminator/size, all mints, config and own platform independently.

`createLaunchpad` returns multi-transaction data. Pass mintA, name, symbol, uri, configId, explicit own platformId, buyAmount zero, createOnly true, migrateType cpmm and the browser-generated mint signer through extraSigners. Defaults currently consult `fetchLaunchConfigs()` even if configInfo is provided; pass validated supply/totalSellA/totalFundRaisingB explicitly, especially on devnet. Never enable skipCheckMint flags for unknown assets. Omit transferFeeExtensionParams entirely: implementation determines token2022 from that field, not the nominal token2022 boolean. Symbol limit checked by SDK is 10 characters. Do not invent metadata name limits from this check.

Source: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/launchpad/launchpad.ts

### Types and parameters

Platform creation requires platformAdmin, platformClaimFeeWallet, platformLockNftWallet, platformVestingWallet, cpConfigId, transferFeeExtensionAuth, feeRate, creatorFeeRate, name/web/img and migrateCpLockNftScale with platformScale/creatorScale/burnScale. Optional platformVestingScale defaults zero. LP policy is an explicit administrator decision, not a hidden arbitrary app default.

`updatePlatformConfig` takes platformAdmin, platformId and typed updateInfo. Wallet variant: `{type:'updateClaimFeeWallet',value:PublicKey}`. Platform rate: updateFeeRate. There is no standalone updateCreatorFeeRate in this SDK union: creator changes use updateAll with all required existing fields preserved.

Buy uses `buyAmount` and optional `minMintAAmount`; sell uses `sellAmount` and optional `minAmountB`. LaunchLab slippage is BN bps. Both receive actual poolInfo/configInfo, zero shareFeeRate and matching mintA/mintB token programs.

Source: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/launchpad/type.ts

### Quotes and claims

`Curve.buyExactIn` object: poolInfo, amountB, protocolFeeRate, platformFeeRate, curveType, shareFeeRate, creatorFeeRate, transferFeeConfigA (explicit undefined for plain SPL), optional transferFeeConfigB, slot. Sell changes amountB to amountA. Returns amountA transfer-amount object, amountB BN, splitFee and optional transferFeeB. Curve sums all rates, ceiling-rounds total fee, floors shares, leaves remainder to protocol. Use official returned fees and amount net of applicable transfer fee; do not multiply base token input by quote fee percentages.

Source: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/launchpad/curve/curve.ts

`claimVaultPlatformFee({platformId,mintB,mintBProgram?,claimFeeWallet?})` creates SDK owner ATA and sends quote there. Enforce SDK owner equals verified claim wallet; never accept arbitrary destination substitutions. `claimCreatorFee({mintB,mintBProgram?})` derives creator vault from SDK owner, not a supplied creator parameter. Both return single-transaction builder results; quote vault claim does not prove current-period revenue or platform attribution. Inspect old pool-fee mode before selecting vault claim.

Source: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/launchpad/launchpad.ts#L1838

### CPMM after verified graduation

`cpmm.getPoolInfoFromRpc(poolId)` uses base58 string and returns poolInfo/poolKeys/rpcData. Determine baseIn using actual sorted mintA, not original launch naming. `CurveCalculator.swapBaseInput` has eight positional args: inputAmount, inputReserve, outputReserve, tradeFeeRate, creatorFeeRate, protocolFeeRate, fundFeeRate, isCreatorFeeOnInput. Protocol/fund portions derive from trade fee, not additive LaunchLab four-fee math.

`cpmm.swap` receives poolInfo,poolKeys,baseIn,inputAmount,swapResult and slippage as number ratio: 50 bps = 0.005. Verify enableCreatorFee and effective creator rate from pool state. Token extensions require the CPMM path's own support and transfer-fee handling.

Sources: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/cpmm/curve/calculator.ts ; https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/cpmm/type.ts ; https://github.com/raydium-io/raydium-sdk-V2-demo/blob/master/src/cpmm/swap.ts

IMPORTANT demo correction: official swap demo currently uses a direction-independent fee-on-input condition. On-chain pool.rs establishes direction-aware semantics: BothToken, or OnlyTokenA with baseIn, or OnlyTokenB with !baseIn. Enum values 0/1/2 correspond to Both/A/B. Use that condition, not blind demo copying.

Source: https://github.com/raydium-io/raydium-cp-swap/blob/master/programs/cp-swap/src/states/pool.rs#L277

## Acceptance blockers and implementation boundaries

1. Platform public key/admin/fee recipient and CPMM configuration are not supplied or verified. Prepare standard platform transaction and diff UI; creation remains blocked until actual configuration exists and is re-read.
2. No RPC account observations, compatibility simulation, successful signature, real fee credit/claim or graduated-pool evidence were produced by this research. Do not mark those gates passed.
3. SOL is the supported first integration candidate, not yet canCreate=true. USDC/xStocks remain verification_required until exact mint, global config, platform rules, CPMM support, extensions and issuer eligibility are proven. LaunchLab Token-2022 quote support does not imply permissionless custom GlobalConfig or CPMM support.
4. Graduation routing: 0 curve, 1 MIGRATION_PENDING, 2 plus verified CPMM account only. LP evidence is separate. Program/admin operations and financial signing remain user wallet actions.
5. Public mainnet API data must never become devnet configuration. Initial production mode should be mainnet-readonly or clearly synthetic demo until deployment/signing/configuration gates are satisfied.

Additional sources: https://docs.raydium.io/reference/token-2022-support ; https://docs.raydium.io/products/launchlab/accounts
