以下是对 StonkLaunch 代码的独立安全与逻辑审查报告，聚焦于高影响缺陷。

---

### 1. CPMM 准备交易时等式校验错误导致所有非零滑点交易被永久拦截
* **文件与函数**：`src/lib/raydium/service.ts` -> `prepareTrade`
* **触发条件**：池状态为已迁移（`status === 2`，路由为 `cpmm`），且用户设置的滑点 `slippageBps > 0`（且预计输出足够大使得滑点扣减大于 0）。
* **证据**：
  在 `quoteFromState` 中，`minOutRaw` 计算为 `s.output.muln(10000 - input.slippageBps).divn(10000)`，其中 `s.output` 即为 `s.result.outputAmount`。
  然而在 `prepareTrade` 中存在如下断言：
  ```ts
  if (!s.result.outputAmount.eq(new BN(q.minOutRaw))) throw new AppError('SLIPPAGE_ROUNDING_MISMATCH', ...);
  ```
  此处将**未扣减滑点的预计输出（`outputAmount`）**与**扣减滑点后的最小输出（`minOutRaw`）**进行了相等性比较。只要滑点大于 0 且产生了扣减，二者必然不等，导致所有正常的 CPMM 交易直接抛出 409 错误而无法构建。
* **最小修复**：
  移除该无意义的恒假比较，或改为校验 SDK 内部计算出的 `amountOutMin`（假设 SDK 返回结构中包含最低输出字段；若仅校验 `minOutRaw` 合法性，`quoteFromState` 中已做 `min.lten(0)` 检查，可直接删去该行拦截，或按同样公式重算比对）。
* **验证方法**：
  构造 `status === 2` 的池交易输入，设置 `slippageBps: 50`（0.5%），调用 `prepareTrade`，验证不再抛出 `SLIPPAGE_ROUNDING_MISMATCH`。

---

### 2. 签名前防护过度严苛，误拦所有涉及原生 SOL (WSOL) 交互的合法交易
* **文件与函数**：`src/lib/raydium/transaction-guard.ts` -> `assertPlanTransaction`
* **触发条件**：用户在客户端执行以下任一涉及 WSOL 的操作：`buy`（以 SOL 计价）、`sell`（获得 SOL）、或 `claim-fees`（领取 SOL 费用）。
* **证据**：
  （注：**假设** `@raydium-io/raydium-sdk-v2` 0.2.74-alpha 在处理 WSOL 时，会使用标准的 `CreateAccountWithSeed` + `InitializeAccount` 临时账户模式，或对 ATA 执行 `SystemProgram.transfer` 补充租金 / 初始化指令）。
  `assertPlanTransaction` 中对 `SystemProgram` 和 `TOKEN_PROGRAM_ID` 做了极窄的白名单限制：
  1. `SystemProgram` 仅允许指令索引 `2`（Transfer），且硬编码要求 `plan.kind === 'trade'` 且 `inputMint === NATIVE_MINT` 且目标为 `ownWsol`。这导致在 **Sell（卖出代币换取 SOL）** 或 **Claim（领取 SOL 费用）** 时，若 SDK 插入创建临时 WSOL 账户或补充租金的 `SystemProgram` 指令，会立即触发 `'Unexpected system transfer or rent instruction'` 误拦。
  2. `TOKEN_PROGRAM_ID` 仅允许指令 `17`（SyncNative）和 `9`（CloseAccount）。若 SDK 使用非 ATA 的临时 WSOL 账户并调用 `InitializeAccount`（指令 1 或 18），会直接触发 `'Unexpected top-level token instruction'` 误拦。
* **最小修复**：
  1. 允许在 `outputMint === NATIVE_MINT`（卖出得 SOL）或 `quoteMint === NATIVE_MINT`（领取 SOL 费用）时，向用户派生的临时 WSOL 账户或 ATA 转入免租金额（Rent-Exempt Lamports）。
  2. 在 `TOKEN_PROGRAM_ID` 分支中放行针对用户自身为 Owner 的 WSOL 账户的 `InitializeAccount` / `InitializeAccount3` 指令。
* **验证方法**：
  使用 WSOL 作为 `quoteMint`，分别构造首次买入（无 WSOL ATA）、卖出代币、领取 WSOL 费用的 SDK 交易，传入 `assertPlanTransaction` 验证能否正常通过。

---

### 3. 交易池绑定的平台与费率未作强校验，存在跨平台混淆与费率失真
* **文件与函数**：`src/lib/raydium/service.ts` -> `readPoolFeeBinding`、`tradeState`
* **触发条件**：向 `quoteTrade`、`prepareTrade` 或 `readPoolFeeBinding` 传入任意非本平台创建的 Launchpad `poolId`。
* **证据**：
  1. 在 `readPoolFeeBinding` 中，代码读取了目标池 `p = await readPool(poolId)` 和本平台配置 `platform = await readPlatform()`，但**从未校验 `p.info.platformId.equals(platform.id)`**，便直接将本平台的 `platform.id`、`feeRate`、`creatorFeeRate` 组装返回。
  2. 在 `tradeState`（`launchlab` 分支）中，同样未校验池的 `platformId` 归属，直接将本平台的 `platform.info.feeRate` 和 `creatorFeeRate` 传给 `Curve.buyExactIn` / `sellExactIn` 以及 `launchpad.buyToken` / `sellToken`。
  若传入外部平台的 `poolId`，报价与交易构建会错误套用本平台费率，导致链上滑点计算偏差或费用归属披露完全失真。
* **最小修复**：
  在 `readPoolFeeBinding` 中增加硬性校验：
  ```ts
  if (!p.info.platformId.equals(platform.id)) {
      throw new AppError('PLATFORM_MISMATCH', '目标发射池不属于当前配置平台', 409);
  }
  ```
* **验证方法**：
  传入一个 `platformId` 不等于当前环境变量 `platformId` 的链上 `poolId` 调用 `quoteTrade`，验证立即抛出 `PLATFORM_MISMATCH` 错误。

---

### 4. 平台费用领取对账（Reconcile）分页游标在超过单页上限时丢失增量边界（漏扫或死循环）
* **文件与函数**：`src/lib/raydium/reconcile.ts` -> `reconcilePlatformClaims`
* **触发条件**：增量对账过程中，距上次对账完成点（`cursor.head`）的新增交易签名数量超过单页 `limit`（默认 20，最大 50），且在中途或后续分页中发生重试或状态恢复。
* **证据**：
  分页返回逻辑为：
  ```ts
  const complete = signatures.length < limit;
  const scanHead = cursor.scanHead || signatures[0]?.signature || cursor.head;
  return { ..., cursor: complete ? { head: scanHead } : { head: cursor.head, before: signatures[signatures.length - 1]?.signature, scanHead } };
  ```
  问题在于：
  1. Solana `getSignaturesForAddress` 按时间倒序（最新在前）返回。当新增刚好等于 `limit`（例如恰好 20 条）时，`signatures.length < limit` 为 `false`（`complete = false`）。下一轮调用传入 `before: 第20条签名, until: cursor.head` 时，RPC 返回空数组 `[]`。此时 `signatures.length < limit` 为 `true`，若调用方在首轮未持久化 `scanHead` 或 `scanHead` 为空（如首次全量扫描刚好满页后第二页为空），`scanHead` 会退化为 `undefined`。
  2. 更严重的是，在 `for (const entry of signatures)` 循环中，若第 10 条交易触发 `throw new AppError('TRANSACTION_HISTORY_UNAVAILABLE', ...)`，函数直接异常退出，调用方无法获得本页已确认的 `scanHead` 锚点；若其间链上又产生新交易，重试时无 `before` 约束会导致 `scanHead` 前移，或者若调用方自行推进了 `before` 却未固定 `scanHead`，完成时会将旧的 `head` 覆盖丢失中间段。
* **最小修复**：
  1. 在进入循环前先计算出确定的 `nextCursor` 锚点（尤其是首轮确定的 `scanHead = cursor.scanHead || signatures[0]?.signature || cursor.head`），若中途因 `TRANSACTION_HISTORY_UNAVAILABLE` 抛出异常，应在 `AppError` 的 `details` 中附带已固定的 `{ head: cursor.head, before: entry.signature, scanHead }` 以便从断点恢复而非整页重扫。
  2. 当 `signatures.length === 0` 时，确保 `scanHead` 优先继承入参的 `cursor.scanHead || cursor.head`。
* **验证方法**：
  模拟 25 条历史签名，`limit: 20`，在第 2 页的第 2 条签名处模拟 `getTransaction` 返回 `null`，验证错误详情中包含正确的 `scanHead`（第 1 页第 1 条）与当前出错签名的上一条 `before` 游标。

---

### 5. 创作者/平台费用查询与领取依赖受截断的池列表，超过 100 个池后特定计价资产无法领费
* **文件与函数**：`src/lib/raydium/service.ts` -> `listVerifiedLaunches`、`readFees`、`prepareFeeClaim`
* **触发条件**：平台累计创建的发射池数量超过 `INDEXER_BATCH_SIZE`（默认 50，硬上限 100），且某计价资产（如 `USDC`）创建的池恰好排在 `getProgramAccounts` 返回列表的第 100 个之后。
* **证据**：
  `listVerifiedLaunches` 中对 RPC 返回的账户列表做了无排序截断：
  ```ts
  entries.slice(0, Math.min(100, Number(process.env.INDEXER_BATCH_SIZE) || 50))
  ```
  而在 `readFees` 与 `prepareFeeClaim` 中，代码通过调用 `listVerifiedLaunches()` 来判断平台观察到哪些 `quoteMint`：
  ```ts
  if (!(await listVerifiedLaunches()).some(l => l.quoteMint === input.quoteMint))
      throw new AppError('QUOTE_NOT_OBSERVED', '本平台尚未观察到该计价资产', 409);
  ```
  一旦池总数超过 50/100，排在后面的池被截断丢弃，不仅昂贵地逐个调用了 `launchFromPool`（含 Metadata 读取和 CPMM 校验），更导致实际存在费用的 `quoteMint` 被误判为 `QUOTE_NOT_OBSERVED`，永久阻断费用查看与领取。
* **最小修复**：
  在 `readFees` 和 `prepareFeeClaim` 中，不要调用 `listVerifiedLaunches()`。改为直接使用 `getProgramAccounts` 配合 `memcmp` 过滤器（同时匹配 `platformId` 偏移量与 `mintB` 偏移量，且设置 `dataSlice: { offset: 0, length: 0 }`），直接检查该 `(platformId, quoteMint)` 组合是否存在至少 1 个池账户。
* **验证方法**：
  将 `INDEXER_BATCH_SIZE` 设为 `1`，在存在 SOL 池和 USDC 池的环境下对被截断的 `quoteMint` 调用 `prepareFeeClaim`，验证修复后不再抛出 `QUOTE_NOT_OBSERVED`。

---

### 6. 签名前防护未绑定交易的具体指令类型与核心参数，存在同类指令替换放行风险
* **文件与函数**：`src/lib/raydium/transaction-guard.ts` -> `assertPlanTransaction`
* **触发条件**：服务端返回或中间人篡改的 `TransactionPlan` 中，将 `plan.kind` 对应的 Raydium 指令替换为同 Program 下的其他指令（例如将 `claim-fees` 替换为 `updatePlatformConfig` 或 `buyToken`，或篡改 `minOutRaw`）。
* **证据**：
  `assertPlanTransaction` 仅检查了：
  1. `program === requiredProgram.toBase58()`（只要存在一条属于 Launchpad 或 CPMM 程序ID的指令即可，`protocolInstruction = true`）。
  2. 账户列表中包含 `pool` / `platformId` 和 `quoteMint`。
  它**完全没有检查协议指令的 8 字节 Anchor Discriminator（指令标识）及指令 Data 中的金额/滑点参数**，也没有拒绝单笔交易中夹带多条协议指令。例如：当 `plan.kind === 'claim-fees'` 时，账户列表中同样包含 `platformId` 和 `quoteMint`；若交易实际编码的是 `updatePlatformConfig`（修改费用接收钱包）或恶意参数交易，由于它们的 Program ID 都是 `launch`，`assertPlanTransaction` 会错误放行。
* **最小修复**：
  1. 统计协议指令数量，要求单笔计划交易中 `protocolInstructionCount === 1`。
  2. 根据 `plan.kind`（如 `claim-fees`、`update-platform`、`create-platform`、`trade`）校验协议指令 `ix.data.subarray(0, 8)` 必须匹配 `@raydium-io/raydium-sdk-v2` 导出的 `anchorDataBuf` 对应指令 Discriminator，并在 `trade` 时核对指令编码中的输入金额与最小输出金额等于 `plan.summary.amountInRaw` 和 `plan.summary.minOutRaw`。
* **验证方法**：
  构造一个 `plan.kind === 'claim-fees'` 的 `TransactionPlan`，但将其 `transactionBase64` 替换为 `updatePlatformConfig` 的序列化交易，调用 `assertPlanTransaction` 验证其被成功拦截。