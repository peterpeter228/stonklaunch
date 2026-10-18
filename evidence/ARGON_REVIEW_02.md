以下是最重要的5个具体安全与状态一致性漏洞：

### 1. 钱包已经签名但未广播时被置为待定，导致交易永久死锁
* **文件/函数**：`src/lib/raydium/client-transactions.ts` -> `submit()`
* **触发场景**：`localStorage.setItem('stonklaunch.pendingTransaction', ...)` 在调用 `c.sendRawTransaction` **之前**执行。若 `sendRawTransaction` 因本地网络断连或RPC预检失败（如滑点超限）直接抛错，交易并未上链，但状态被catch块置为 `confirmation_unknown`。因为链上永远查不到该签名，前端 `observe()` 永远无法解除锁定，导致该钱包无法再发起任何新交易。
* **最小修复**：仅当交易实际进入网络广播或预检非确定性失败时记录待定，或在 `sendRawTransaction` 明确返回确定性模拟错误（Simulation failed）时将状态置为 `failed`。
  ```ts
  // 在 catch(e) 中增加预检失败判断：
  if (e instanceof Error && /Transaction simulation failed/i.test(e.message)) {
      localStorage.setItem('stonklaunch.pendingTransaction', JSON.stringify({ ...record, state: 'failed' }));
      onStage('failed', signature);
      throw e;
  }
  ```
* **测试**：Mock `sendRawTransaction` 抛出 `Transaction simulation failed`，断言 `pendingTransaction.state` 为 `'failed'` 且 `pending.current` 为 `false`。

### 2. 切换钱包或修改草稿参数时未重置状态，导致计划与输入/身份脱节
* **文件/函数**：`src/components/transaction-control.tsx` -> `TransactionControl()`
* **触发场景**：用户A登录并点击 `prepare` 生成 `plan`（及 `mint.current`、`requestId.current`）。随后用户修改了上层组件传入的 `draft`/`input`（如修改代币名称或购买金额），或在插件中切换了 `wallet`。此时组件未清理 `authenticated`、`plan` 和 `mint.current`，用户点击展示的旧计划或直接报错，甚至复用旧幂等键 `requestId` 提交旧草稿。
* **最小修复**：监听 `wallet` 和输入变化，重置会话、计划与幂等引用。
  ```tsx
  useEffect(() => {
      setAuthenticated(false); setPlan(null); setStage('idle'); setError('');
      mint.current = null; requestId.current = null; pending.current = false;
  }, [wallet]);
  useEffect(() => {
      setPlan(null); mint.current = null; requestId.current = null;
  }, [JSON.stringify(draft), JSON.stringify(input)]);
  ```
* **测试**：渲染组件并完成 `prepare`，更新 `wallet` 或 `draft` prop，断言“Review & sign”按钮消失且回到初始验证/准备状态。

### 3. 多笔发射交易（Multi-tx Launch）中途中断后缺乏幂等恢复，重试导致重复创建
* **文件/函数**：`src/lib/raydium/client-transactions.ts` -> `signAndSubmitLaunch()` & `src/components/transaction-control.tsx` -> `observe()`
* **触发场景**：当 `built.transactions.length > 1` 时，若第1笔交易成功（`confirmed`），第2笔变为 `confirmation_unknown`。用户在UI点击 `observe()` 恢复了第2笔（或刷新页面后 `mint.current` 丢失），代码未读取 `stonklaunch.pendingLaunch` 进度，也未补发后续交易，再次点击 `prepare` 会生成新 Mint 从头创建，造成链上孤儿池或资金重复消耗。
* **最小修复**：若不支持多笔交易断点续传，应在 `buildClientLaunch` 中强制断言单笔交易原子性：
  ```ts
  if (result.transactions.length !== 1) throw Error('仅支持单笔原子创建交易，拒绝多笔非原子计划');
  ```
* **测试**：Mock `raydium.launchpad.createLaunchpad` 返回2笔交易，断言 `buildClientLaunch` 直接抛出拒绝错误。

### 4. `prepare` 发起未脱敏的裸 `fetch`，丢失全局钱包请求头导致后端校验旁路或失败
* **文件/函数**：`src/components/transaction-control.tsx` -> `prepare()`
* **触发场景**：`draft` 分支使用原生 `fetch('/api/launches/prepare')` 而非统一的 `api()` 封装，未携带 `x-wallet-address` 请求头；同时后端 `requireSession()` 中校验逻辑为 `if (connected && connected !== s.wallet)`（当请求头缺失时跳过比对）。若前端会话Cookie残留为旧钱包，会导致使用旧钱包身份为新钱包准备交易。
* **最小修复**：前端请求补充 `x-wallet-address: wallet ?? ''` 头；后端 `src/lib/auth/server.ts` 的 `requireSession` 强制要求该头（或前端统一走 `api()`）。
  ```ts
  // prepare() 的 fetch headers 中加入：
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId.current, 'x-wallet-address': wallet || '' }
  ```
* **测试**：在 `wallet` 为 B、Cookie 会话为 A 时调用 `prepare()`，断言后端返回 403 `WALLET_SESSION_MISMATCH`。

### 5. 前端摘要（Summary）与实际反序列化交易的指令内容未做一致性校验
* **文件/函数**：`src/lib/raydium/client-transactions.ts` -> `signAndSubmitPlan()`
* **触发场景**：`signAndSubmitPlan` 仅校验了 `tx.message.recentBlockhash !== plan.blockhash` 和付款人公钥，完全未校验 `plan.transactionBase64` 反序列化后的程序ID（Program ID）和账户列表是否与用户审阅的 `plan.summary` 一致。若后端响应被篡改或构造错误，用户看到的 Summary 是正常交易，实际签名的却是恶意指令。
* **最小修复**：在签名提交前，校验 `tx.message.compiledInstructions` 调用的所有 Program ID 必须属于白名单（如 Raydium Launchpad、System、Token Program 等）且关键池/代币账户在 `staticAccountKeys` 中存在。
  ```ts
  const keys = tx.message.staticAccountKeys.map(k => k.toBase58());
  if (plan.summary.poolId && !keys.includes(String(plan.summary.poolId))) throw Error('交易账户与摘要池地址不匹配');
  ```
* **测试**：构造 `plan.summary.poolId` 不在 `transactionBase64` 账户列表中的测试数据，调用 `signAndSubmitPlan` 断言抛出异常且未触发 `wallet.signTransaction`。