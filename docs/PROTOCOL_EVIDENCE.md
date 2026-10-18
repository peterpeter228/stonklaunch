# 协议与 dot 证据册

核查日期：2026-10-18（Asia/Shanghai）。范围：官方网页、Raydium 官方 SDK / 公开 IDL / demo、官方公开配置 API。**未签名、未创建平台/代币、未验证主网交易或收费到账；未审计完整 LaunchLab Rust 程序。**

把“已读到的资料”“从资料作出的判断”和“目标集群已实测”分开。本册不是能力放行清单；dot 执行时需核实当前发布版和网络。

## 1. 本次确实观察到了什么

### 1.1 配置 API

2026-10-18 通过公开接口 [R3] 读取成功；原始响应格式化副本放在 `../runs/2026-10-18/launchlab_configs_observed.json`。该副本仅是观察证据，不能作为永久交易配置或 devnet 配置。

| 返回的 quote | API 标记 | 解释 |
|---|---|---|
| WSOL | `showWithUI=true` | 可以作为首选 SOL 集成候选，仍需 RPC/平台配置验证 |
| USD1 | `showWithUI=false` | 有返回项，本产品暂不扩范围 |
| HeyAnon | `requiresPlatformAuth=true` | 有平台限定字段，本产品暂不扩范围 |
| USDC / xStocks | 本次没有相应计价配置项 | 尚未验证；不能推断链上绝对不存在，也不能声称已支持 |

注意：响应中的 `swapInfo.fromMint=USDC` 只代表某预兑换来源，不等于存在 USDC 计价 GlobalConfig。先兑换成 SOL/USD1 再发射也不等于 USDC quote launch。

当次 WSOL 关键值：

```text
config: 6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX
quote mint: So11111111111111111111111111111111111111112
quote decimals: 9
tradeFeeRate: 2500
migrateFee: 0
minFundRaisingB: 24000000000
default totalFundRaisingB: 85000000000
```

以上是 API 观察，非本轮 RPC 逐账户验证。24 SOL 最低目标和 85 SOL 默认目标也应回读，不写成全协议不变常量，更不能为了演示“毕业”用主网资金硬推目标。

### 1.2 官方 SDK

已通过 GitHub 读取 `raydium-io/raydium-sdk-V2`，ref：

```text
e2e8bcd865189c994682a9477ec8eaf1e2da8aaf
package.json version: 0.2.74-alpha
package.json license: GPL-3.0
```

| 源码文件 | 已读位置 | 对本项目的意义 |
|---|---|---|
| `src/raydium/launchpad/curve/curve.ts` | 466–515 | 四项费率相加；ceil 总费、按比例切分，尾差归协议 |
| `src/raydium/launchpad/launchpad.ts` | 159–236 | `createLaunchpad` 从 `configInfo.mintB` 取得 quote，并使用配置的默认参数 |
| 同文件 | 519–750 | buy builder 读取真实池的 platform/config；报价参数不能改变外部池收款归属 |
| 同文件 | 1358–1442 | 真实平台 create/update 方法和配置参数 |
| 同文件 | 1838–1884 | 平台 vault claim 路径 |
| `src/raydium/launchpad/instrument.ts` | 平台更新与领取指令 | 管理员与领取钱包需要相应签名 |

关键 blob SHA：

```text
curve.ts      5c1ee9dac238e300e7626a05960e7eb42c4ff0f6
launchpad.ts  ee0c71563563f2bebb943e50cd36581cc012439e
layout.ts     7842b18f1073e68977e6b0c56f2b8f13aa4b376a
instrument.ts 25fd2e288baf3c7ee41983d59e22ce2ebde06418
```

源码所示版本不是 npm 安装和目标网络兼容证据。实现时锁定实际采用版本并记录，不用 `latest` 自动漂移。SDK package 声明 GPL-3.0：打包分发时应保留许可文件和所需源码/声明，不能默认按 MIT/Apache 处理。具体发行方式的许可义务以采用版本 LICENSE 和实际打包方式为准；仅调用链上 program 不等于复制其代码。[R4]

### 1.3 公开 IDL 与当前文档的冲突

已读 `raydium-io/raydium-idl/raydium_launchpad/raydium_launchpad.json`：blob SHA `70186e3f02c2bead7e5a9a92453104df853683ed`，metadata version `0.2.0`。

公开版本 quote token program 的部分约束仍为 legacy SPL，迁移账户命名较旧；较新官方文档描述 2026-08/09 Token-2022 quote 和 LP 分配更新。这种不一致意味着：**不能用最新文档加旧 IDL 拼成假定可运行的交易，也不能把 SDK master 新字段当成主网部署证明。**

GlobalConfig 创建受协议管理员/授权角色控制，这一权限限制在文档和公开 IDL 都存在。平台自己的 PlatformConfig 并不会给予任意 quote mint 的协议配置权限。[R1][R9]

## 2. 必须修订的业务承诺

| 原始说法/常见实现错误 | 证据结论 | 本包执行决定 |
|---|---|---|
| 任意股票/法币/商品都可“锚定”发币 | LaunchLab 绑定已有 GlobalConfig；计价关系本身不提供稳定/储备/赎回机制 | 已验证 mint 计价；候选逐个解锁，禁用价格锚定宣传 |
| 总费 1% 中平台/creator 各 0.5% | 平台和 creator 在协议费之外；当前 WSOL 协议费 0.25% | 保留两方各 0.5%，当前示例总费 1.25%，真实值回读 |
| 填 `platformFeeRate=5000` 就能赚钱 | 交易费用归属来自 pool 绑定的平台配置 | 创建自己的平台并在 launch 显式传 `platformId`，核对实际归属 |
| .env 一改收款地址立即生效 | 收款权在链上配置，更新需要授权签名 | env 表示目标值；标准更新确认和回读后生效 |
| 售罄即应用自动毕业 | `MigrateToCpswap` 受 GlobalConfig 指定迁移签名者控制 | 监控状态 0/1/2，验证 CPMM 后再展示成功 |
| 所有毕业 LP 都永久锁定 | LP 销毁/锁定/费用权利依配置和程序版本 | 分别显示实际 LP 处理证据，未知就写待验 |
| 非 SOL quote 也自动收 SOL/USDC | 费用按实际 quote mint 结算 | 原币种统计；不把美元估值当到账币种 |

费用字段对应：链上 `fee_rate` ↔ SDK `feeRate`；`creator_fee_rate` ↔ `creatorFeeRate`；protocol `trade_fee_rate` ↔ `tradeFeeRate`；推荐 `shareFeeRate`。LaunchLab rate 分母 1,000,000，5000 是 0.5%，不是 50%。滑点等参数可以使用 bps，不能因名称里有 fee 就假定同一单位。[R1][R2][R4]

## 3. 不能直接照抄的官方例子

- 部分 `createMint` 例子仍为 `migrateType: "amm"`；本任务需要显式 `"cpmm"`。
- 旧平台例子设置 `creatorScale=500000`；较新文档要求新配置 `creator_scale=0`，旧份额可能折入平台 LP 权利。对应程序版本未核对前，不承诺创作者自动得到某份 Fee Key。
- 有旧 referral demo 的条件表达式与本任务无推荐费目标不一致；本项目 `shareFeeRate=0`，不能复制默认分享收款人。
- 监控 demo 用 `status !== startStatus` 推断毕业，会将 0→1 的等待迁移当成完成；必须 `status===2` 并验证 CPMM。
- 文档展示 CLI `KEYPAIR` 读密钥代码仅是示例；Web 应用使用用户钱包确认，不收集用户资金私钥。
- 不手写猜测 PDA seed 顺序；使用选定 SDK 的官方派生函数并核对目标账户。[R6]

官方程序地址页注明 LaunchLab 和 LP Lock 完整源码未公开。[R8] 因此本册只能报告“官方文档 + SDK + API + 公开 IDL 已交叉读取”，不能宣称完整合约审计通过。

## 4. Token-2022 与 xStocks

较新官方支持矩阵描述 LaunchLab 支持 Token-2022 quote，但 quote 由 GlobalConfig 绑定；CPMM 创建/毕业还执行独立 mint 支持检查。当前 CPMM 公开源码允许若干扩展（包括 ScaledUiAmount），其他扩展可涉及协议管理的逐 mint 支持 PDA。[R7][R10]

仅存在某代币交易池或拿到 swap 报价，不能证明能够在 StonkLaunch 创建并毕业。每个目标 mint 的扩展、账户状态、对应配置与 migration path 均需实际判断。

xStocks 开发文档说明 Solana 使用 Token-2022 与 Scaled UI，余额展示需要 multiplier；raw integer、decimals 与 multiplier 不可混用。[X1] 产品本体的底层资产支持也不自动转移给一个以它计价的新 base token；这是由不同资产和不同机制得出的判断，不是新增发射币的担保。

xStocks 官方集成页同时说明 token 层可转移与 partner 的地区/接入义务。[X2] 不由“链上自由转移”推断任意地区可商用。本项目按实际接入条件开放，对未核实部分标 `ISSUER_ELIGIBILITY_UNVERIFIED`；不把所有 xStock 断言为有 hook/freeze，也不借此删除普通 SOL 全栈范围。

用户提及第三方项目的争议性指控没有作为本轮事实依据。本项目直接禁止新增转账税/Reward 分红机制，无需重复未经本轮核实的指控。

## 5. dot 与技术栈证据

官方 dot 文档支持长期协调、背景并行子任务和可见 Work/Codex 任务，也明确子任务不自动获得所有历史；连接电脑、仓库环境和插件权限是独立条件。[O1][O2] 因此本包使用显式 AGENTS、职责文件和 STATE，不能假定只写“继续”就能恢复全部上下文。

既有权限和自动行动审查继续有效；自然语言规约不能赋予未连接账户权限。[O3] 本包让 dot 先准备可审阅变更，再在实际需要签名/接入时交接，不让用户反复批准常规代码改动。

Next.js 15 在当次官方支持页属于 Maintenance LTS，14 已 unsupported；15 初次发布时间是 2024-10-21，官网声明维护窗口按初次发布后的两年计算。**临近 2026-10-21，启动和发布时需重新核对**，不能把本包的版本选择永久视为安全承诺。[N1]

全栈 Route Handlers 需要相应服务端部署；静态导出功能有限，不能承载本任务的完整后台。[N2] Supabase 表需要显式 grants 与 RLS，service role 能绕过 RLS、必须留在服务端。[D1]

## 6. 来源链接

| ID | 官方来源 |
|---|---|
| R1 | [LaunchLab GlobalConfig](https://docs.raydium.io/products/launchlab/global-config) |
| R2 | [LaunchLab PlatformConfig](https://docs.raydium.io/products/launchlab/platform-config) |
| R3 | [LaunchLab configs API](https://launch-mint-v1.raydium.io/main/configs) |
| R4 | [SDK 固定 ref](https://github.com/raydium-io/raydium-sdk-V2/tree/e2e8bcd865189c994682a9477ec8eaf1e2da8aaf)、[费用计算](https://github.com/raydium-io/raydium-sdk-V2/blob/e2e8bcd865189c994682a9477ec8eaf1e2da8aaf/src/raydium/launchpad/curve/curve.ts)、[调用实现](https://github.com/raydium-io/raydium-sdk-V2/blob/e2e8bcd865189c994682a9477ec8eaf1e2da8aaf/src/raydium/launchpad/launchpad.ts)、[package/许可声明](https://github.com/raydium-io/raydium-sdk-V2/blob/e2e8bcd865189c994682a9477ec8eaf1e2da8aaf/package.json) |
| R5 | [LaunchLab accounts](https://docs.raydium.io/products/launchlab/accounts) |
| R6 | [LaunchLab code demos](https://docs.raydium.io/products/launchlab/code-demos) |
| R7 | [Token-2022 support matrix](https://docs.raydium.io/reference/token-2022-support) |
| R8 | [Program addresses](https://docs.raydium.io/reference/program-addresses) |
| R9 | [公开 LaunchLab IDL](https://github.com/raydium-io/raydium-idl/blob/master/raydium_launchpad/raydium_launchpad.json) |
| R10 | [CPMM mint 支持源码](https://github.com/raydium-io/raydium-cp-swap/blob/master/programs/cp-swap/src/utils/token.rs) |
| R11 | [CPMM code demos](https://docs.raydium.io/products/cpmm/code-demos)、[官方 swap 示例](https://github.com/raydium-io/raydium-sdk-V2-demo/blob/master/src/cpmm/swap.ts)；本轮已读示例 blob SHA `53b95ee24d12c18ce39d426c5006cc82a5cf7d9d` |
| X1 | [xStocks For Developers](https://docs.xstocks.fi/developers) |
| X2 | [xStocks Integration FAQ](https://xstocks.com/partner) |
| X3 | [xStocks 产品机制](https://xstocks.com/partners/learn/how-xstocks-works) |
| S1 | [Solana Actions and Blinks](https://solana.com/docs/tools/actions) |
| O1 | [dot Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory) |
| O2 | [dot Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps) |
| O3 | [dot Controls](https://learn.chatgpt.com/docs/dots/controls) |
| N1 | [Next.js Support Policy](https://nextjs.org/support-policy) |
| N2 | [Next.js 15 部署方式](https://nextjs.org/docs/15/app/getting-started/deploying) |
| D1 | [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) |
| D2 | [Supabase Sign in with Web3](https://supabase.com/docs/guides/auth/auth-web3)、[signInWithWeb3 API](https://supabase.com/docs/reference/javascript/auth-signinwithweb3) |
| D3 | [Supabase 服务端客户端](https://supabase.com/docs/guides/auth/server-side/creating-a-client)、[auth.getUser](https://supabase.com/docs/reference/javascript/auth-getuser) |

## 7. dot 启动时仅补齐这些关键未知

1. 实际工具/目录/仓库/Node/SDK 与目标 cluster；只核对变化，不重做泛行业研究。
2. SOL GlobalConfig、PlatformConfig 与授权钱包的 RPC 结果；无平台时生成标准配置交易。
3. 当前 SDK/IDL 与目标程序兼容性；USDC/xStocks 如仍无配置，保留待验证并推进 SOL 全栈。
4. 真实 create/buy/sell/claim 与毕业、LP 证据在哪个网络取得。
5. 部署与签名是否已有授权；只在最终必要动作具体就绪时请求缺失部分。

这些未知不影响把全栈代码、界面、数据服务和交付物做完整；但影响哪些主网/多计价/盈利结论可以成立。
