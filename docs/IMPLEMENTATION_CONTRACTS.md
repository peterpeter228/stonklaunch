# d01–d03 实施契约

本文规定 dot 要生成的工程和行为。这里出现的接口与 wrapper 名称是本项目设计；标注“官方 SDK”的方法才是已核实的外部 API。不要把本文件当成已存在的源码或执行结果。

## 1. 实际工程结构

| 路径 | 责任 |
|---|---|
| `src/app/page.tsx`、`launch/page.tsx` | 首页、连续发币工作流 |
| `src/app/token/[mint]/page.tsx`、`graduation/page.tsx` | 交易、毕业详情 |
| `src/app/terminal/page.tsx` | 新币/我的发行/费用管理 |
| `src/app/api/*/route.ts` | 下表中的 Route Handlers |
| `src/components/*` | 资产选择、费用摘要、钱包反馈、曲线图、海报、模式标记 |
| `src/lib/monetization.ts` | 所有默认费率、单位换算、链上绑定核验、领取/更新计划 |
| `src/lib/raydium/*` | SDK 初始化、配置/池读取、创建、买卖、毕业/LP 证据 |
| `src/lib/data/*` | Supabase、演示数据、模式/来源区分 |
| `src/lib/amounts.ts`、`src/types/domain.ts` | 原始金额、数据契约和状态 |
| `src/worker/indexer.ts` | 可独立运行的索引/补扫任务 |
| `supabase/migrations/0001_initial.sql` | 表、索引、RLS 和最小权限 |
| `skill/SKILL.md`、`skill/references/API_REFERENCE.md` | 项目 Skill 和按需读取的 API 说明 |
| `scripts/install.sh` | d03 的真实安装与启动前检查 |
| `DELIVERY_README_ZH.md` | d04 实测结果、启动说明、费用配置、演示分镜 |

不创建自建资金合约目录。应用的 `src`、`package.json`、lockfile、SQL、Skill 和脚本由 dot 真正实现后才算产物。本包没有提供空壳文件来占位。

## 2. d01 第一条纵向闭环

先完成：读取官方配置 → 解码目标集群账户 → 读取自家平台配置 → 产生真实费用摘要 → 构建一个实际标准交易计划并模拟。与此同时开始数据库结构和无密钥 UI 预览。

主任务选择一个与目标集群匹配的 SDK 发布版，锁定精确版本。证据文件中的 `0.2.74-alpha` 是已读源码的版本，不等于本轮已安装、npm 已可用或目标集群已兼容。不得盲抄旧 demo 的平台 ID、私钥配置、`migrateType: "amm"` 或旧 LP 分配。

没有现成平台配置时，先完成管理页的“根据 .env 创建平台配置”交易准备与费用摘要；等待操作员签名时继续 UI、API、数据库、海报和文档。缺平台配置时，真实发币入口明确不可用，不能悄悄给 Raydium 默认平台发币后说 StonkLaunch 有收入。

### 官方调用映射

| 功能 | 已读官方 SDK 能力 | 本项目必须核验 |
|---|---|---|
| 发现配置 | `raydium.api.fetchLaunchConfigs()` | API 来源、cluster、quote mint 与 RPC 账户一致 |
| 创建平台 | `raydium.launchpad.createPlatformConfig()` | `feeRate`、`creatorFeeRate`、`platformClaimFeeWallet`、`platformAdmin`、目标 CPMM 配置 |
| 更新平台 | `raydium.launchpad.updatePlatformConfig()` | 该版本支持的 update variant，管理员签名 |
| 创建曲线 | `raydium.launchpad.createLaunchpad()` | `configId`、`platformId`、`migrateType: "cpmm"`、mint signer、metadata URI |
| 查询池 | `getRpcPoolInfo({poolId})` / `getRpcPoolsInfo({poolIdList})` | owner、mint A/B、绑定平台、config、状态 |
| 买入报价 | `Curve.buyExactIn(...)` | 当前池与费用、quote/token 扩展、slot |
| 买入交易 | `raydium.launchpad.buyToken(...)` | `buyAmount`、最小收到/滑点、真实绑定 |
| 卖出报价/交易 | `Curve.sellExactIn(...)` / `raydium.launchpad.sellToken(...)` | base 输入与 quote 输出不可混算 |
| 领取平台费 | `claimVaultPlatformFee` 或匹配该池版本的官方 claim builder | 实际 vault 模式、quote mint、领取钱包签名 |
| 领取创作者费 | `raydium.launchpad.claimCreatorFee(...)` | creator pubkey + quote mint，按协议实际聚合口径 |
| 毕业 | **没有通用 `graduate()` / `autoGraduate` API** | 监控协议指定执行者；验证 `status===2` 与 CPMM |
| 毕业后池读取 | `raydium.cpmm.getPoolInfoFromRpc(poolId)` | 该已读版本使用 base58 字符串参数；owner/mint/config 核验 |
| 毕业后报价/买卖 | `CurveCalculator.swapBaseInput(...)` / `raydium.cpmm.swap(...)` | 使用 CPMM 储备/费用/方向，重新计算滑点与 minOut |

这张表不能代替检查安装版本的 types；若官方名称改变，记录对应关系，而不是创建一个同名假函数返回成功。

## 3. `src/lib/monetization.ts` 的固定契约

默认常量直接存在于代码，环境变量只通过这一模块解析与覆盖；UI、Actions、创建、买卖与运营页不能各有一套默认值。

```ts
export const DEFAULT_PLATFORM_FEE_BPS = 50;
export const DEFAULT_CREATOR_FEE_BPS = 50;
export const DEFAULT_SHARE_FEE_BPS = 0;
export const LAUNCHLAB_RATE_DENOMINATOR = 1_000_000;
// 1 bps = 100 个 LaunchLab rate units。使用 BN 或 bigint 传给适配器。
```

本项目 wrapper 的责任如下，命名保持一致：

- `loadFeePolicy(env)`：严格解析整数 bps；空值才采用默认，非法字符串/小数/负数直接报配置错误。新 base token 转账税始终关闭，首版 referral 非 0 配置拒绝启用。
- `bpsToLaunchlabRate(bps)`：单位转换，不能把 50 直接作为 `feeRate`。
- `readPoolFeeBinding(poolId)`：读取池、GlobalConfig、PlatformConfig；返回真实费率/owner/领取钱包/平台 ID/slot。不得只从 Supabase 的表单记录读取。
- `assertFeeBinding(actual, desired)`：比对当前自家平台 ID、关键钱包和目标费率；不匹配的创建暂停。已有池的展示必须保留实际费率，不能改成配置中的理想值。
- `quoteWithFeeBreakdown(...)`：调用官方 Curve 数学，展示协议/平台/creator/referral、转账费、网络/rent/优先费及 quote 有效期。
- `preparePlatformConfigChange(desired)`：生成标准 create/update 交易计划，明确管理钱包、目标配置、变更字段和费用，不在服务器代替用户签名。
- `prepareFeeClaim(...)`：按实际协议 vault 模式构建 claim，预览目标 quote mint 与收款账户；未知/不兼容状态拒绝构造。

### 费用舍入

当前已读 SDK 的口径为四项费率相加，先向上取整总费，再按费率切分平台/推荐/creator，尾差归 protocol。优先直接使用官方 Curve 的输出；不要另造一个会与交易偏离的业务手续费数学库。超小额输入必须显示“预计到账太小/不足支付费用”，不做负余额或凭空增益。

报价不是收入。只有真实交易确认、解码归属和累计/领取账户证据才允许写入相应财务状态。

### `.env` 与链上配置的同步

1. 读取目标配置值和管理员公钥。
2. 读取实际 PlatformConfig；显示字段差异。
3. 按 SDK 类型构建标准更新/新建交易。例如已读版本的领取钱包更新 variant 为 `updateInfo: { type: "updateClaimFeeWallet", value: nextWallet }`，执行前再次核对安装版 types。
4. 管理钱包在自身钱包中确认交易；应用等待成功。
5. 重新读取同一平台 PDA 和授权钱包；只有字段匹配才显示“生效”。

不允许接收请求参数随意覆盖 `feeWallet`、`programId`、`platformId`。外部池可作为只读发现数据，第一版只给经核验的本平台池提供交易按钮；若后来允许外部池，明确其平台费归属不属于 StonkLaunch。

## 4. 资产能力契约

每个资产独立记录：

```ts
type CapabilityStatus =
  | "enabled" | "verification_required" | "preview"
  | "blocked" | "temporarily_unavailable";

type AssetCapability = {
  assetKey: string; symbol: string;
  cluster: "devnet" | "mainnet-beta";
  mint: string | null; // 仅候选展示允许 null；真实交易绝不允许
  tokenProgram: string | null; decimals: number | null;
  globalConfigId: string | null;
  cpmmConfigId: string | null;
  status: CapabilityStatus;
  canCreate: boolean; canBuy: boolean; canSell: boolean;
  migrationPathVerified: boolean; // 不是应用拥有迁移权限
  reasonCodes: string[];
  checkedAt: string | null; slot: number | null;
};
```

`canCreate=true` 的证据至少包括：目标 cluster 的真实 mint 身份、token owner、decimals、对应 GlobalConfig.quote mint、平台限制、实际支持的 CPMM 路径及配置，当前读/模拟结果。未经验证不得从名称推 mint。

官方文档描述新增 Token-2022 quote 能力，但公开 IDL/示例有版本差异。xStocks 的 Token-2022/Scaled UI 必须按目标 mint 读取；raw units、decimals、展示 multiplier 分开保存。不可把展示余额直接作为 raw 金额。

候选 mint 如存在转账费、hook、delegate、default frozen 等扩展，分别核验交易和目标 CPMM 支持。不要将“freeze authority 非空”与“账户已被冻结”混为一谈。mint 兼容、issuer 条款/地区接入条件和实际账户可转移性分别判定；免责声明不能代替接入条件。

失败原因示例：`QUOTE_CONFIG_UNVERIFIED`、`CPMM_COMPATIBILITY_UNVERIFIED`、`ISSUER_ELIGIBILITY_UNVERIFIED`、`CONFIG_MISMATCH`、`RPC_UNAVAILABLE`。不要硬编码永久不可用结论。

## 5. 创建、买卖和交易准备

### 创建

优先无税标准 SPL base mint，默认曲线参数来自所选 GlobalConfig 的有效默认值，再做整数与上下界核验。`migrateType` 显式选择 `cpmm`，不靠 SDK demo 默认。

名称/symbol/metadata URI 使用当前 SDK 的限制；UI 同步提示，最终由服务端和 builder 再校验。图标仅接收有限大小的受支持图片，服务端重编码/剥离多余 metadata；不直接执行 SVG/HTML 或读取任意用户 URL。建议持久 JSON metadata 和稳定图片 URL，避免临时签名 URL 在发币后过期。

为了不在服务器保存 mint 私钥，客户端生成仅用于新 mint 的临时 signer，并使用官方 SDK 创建流程。服务器准备合法参数、metadata 和配置证据；客户端在构建前重新核对。SDK 若返回多笔交易，要顺序执行并显示每笔目的/费用，保留已成功 mint/pool 以恢复后续买入。不要承诺“一次钱包签名完成所有动作”。

创建成功以链上确认及池绑定核验为准，不能以上传完成或有 tx signature 字符串为准。创建后初始买入默认关闭；用户主动选择才可包含，费用与用途单列。

### 买卖

默认产品滑点 `DEFAULT_SLIPPAGE_BPS=50`（本项目决定），在确认前可明确调整。不能从用户宪章未选择的 Jupiter 示例继承其路由调用或额外收费。

服务器/客户端 adapter 使用同一可信数据来源与官方 builder，约束准确的 mint、pool、program、minOut/maxIn、quote slot、过期 blockhash。签名前显示交易摘要；不允许 UI 表示买入 A、实际交易指向 B。用户金额严格转换为 raw 整数，不经 JS 浮点。

SDK 在目标钱包不支持交易版本时选择支持的标准版本或解释限制，不绕过签名。交易模拟失败、报价过期或配置变化先重取并审阅。相同交易广播结果未知时查签名；需要刷新 blockhash 必须重新确认，不能将相同经济操作当自动安全重试。

### 毕业后的真实买卖

实现统一 `resolveTradeRoute` dispatcher：status 0 进入 LaunchLab adapter；status 1 返回 `MIGRATION_PENDING`，不构建新的曲线/CPMM 买卖；status 2 且实际 CPMM 账户验证后进入 CPMM adapter。网页与 Action 共用此分发，不允许仅给第三方跳转链接代替已要求的应用内买卖。

CPMM adapter 从 RPC 读取 `poolInfo/poolKeys/rpcData`，核对输入 mint 属于实际池子并确定 `baseIn`。通过安装版本的 `CurveCalculator.swapBaseInput` 计算，再用 `raydium.cpmm.swap` 构建。费用从该 CPMM config 读取，按其实际 trade/protocol/fund/creator 口径解释，不能将曲线四项相加公式或 0.5%/0.5% 默认值套用过来。[R11]

特别注意单位：已读 CPMM swap 示例的 `slippage` 是比例数 `0.005`，表示 50 bps；LaunchLab 示例使用 BN bps。内部统一保存 bps，在各 adapter 边界按安装 SDK 类型转换。CPMM mint A/B 可能经过排序，不能从发行时 base/quote 名称推断交易方向。Token 扩展、转账费和链上费用变化须重新核验。

LP Fee Key、CPMM creator 权利尚未验证时仍可在已核实的 CPMM 交易，但收益卡写“本平台毕业后收益归属未验证”；不得凭交易存在继续显示“平台每笔 0.5%”。

### 模式

`APP_MODE` 由服务端统一读取，通过安全的运行配置接口给前端：

| 值 | 数据与资金行为 |
|---|---|
| `demo` | 合成数据和流程演示，持续 DEMO 标记；拒绝任何真实资金构建/广播，不弹资金签名 |
| `devnet` | 仅 devnet 数据与交易；所有地址/配置必须来自 devnet，不能复用主网配置 ID |
| `mainnet-readonly` | 主网读取，禁止创建/买卖/claim 的资金交易构建 |
| `mainnet-live` | 仅在实际部署授权和配置校验后提供主网交易；签名仍由钱包完成 |

模式检查在 API 与交易 adapter 执行，不能只禁用一个按钮。Demo 之外的错误响应不返回 fake 成功；缓存过期保留来源和时间，真实报价路径不能使用 demo 或过期池状态。

## 6. 后端 API

所有接口具备结构化错误码和请求 ID；写入采用幂等键。整数金额用十进制字符串。公开响应标记 `cluster`、`dataSource`、`observedAt`、`slot`、`isStale`；需要权限的接口不因传入一个公钥就认证成功。

| 接口 | 请求/响应与责任 |
|---|---|
| `GET /api/runtime` | 返回允许公开的模式、网络、公钥/平台 ID、功能开关；绝不返回 service key、私有 RPC token、cron secret |
| `GET /api/auth/session` | 用 Supabase 验证后的会话返回最小用户 ID、已验证钱包和角色；不信任请求体的钱包声明 |
| `POST /api/auth/logout` | 清理本应用会话；不会清除链上钱包或转移资产 |
| `GET /api/assets` | 资产目录 + 分项能力 + 禁用原因；候选与可交易明确分开 |
| `GET /api/launches` | 本平台已观察发行列表，游标分页，限定筛选字段 |
| `GET /api/launches/[mint]` | mint 对应的真实 pool/config、状态、报价摘要；歧义时要求明确 pool ID |
| `POST /api/uploads` | 已认证、限量图标上传，返回稳定受控 URL |
| `POST /api/launches/prepare` | 接受草稿与客户端 mint 公钥；校验资产/参数/费率，准备 metadata 与有效创建计划；客户端负责其 mint signer |
| `POST /api/trades/quote` | 接受可信 pool 引用、side、amountRaw、slippageBps；返回完整费用、minOut、有效期与来源 |
| `POST /api/trades/prepare` | 重验 quote/池/配置/模式，使用官方 builder 产生可审阅交易与 blockhash 有效性信息；不接收任意收款目的地 |
| `POST /api/transactions/observe` | 接受 signature 作待验证线索，服务器从链上核实后更新；用户上传的成功字段不可信 |
| `GET /api/fees` | 读取当前钱包/平台的 accrued、claimable、claimed，按 quote mint 分账 |
| `POST /api/fees/prepare-claim` | 核验实际领取身份与范围，构建标准 claim；钱包自己签 |
| `POST /api/admin/platform/prepare` | 已认证管理员创建/更新平台配置计划；验证管理员公钥与链上权限 |
| `GET /api/posters/[mint]` | 基于确认 metadata 与真实链上身份生成 PNG/OG；demo 海报固定水印 |
| `GET /api/cron/index` | Bearer cron secret，有限批次读取/补扫/对账，保存 cursor；禁止任意公网投喂写库 |
| `GET /api/health` | 只返回环境/依赖简明状态，不泄露配置与连接字符串 |

报价的“过期”由签名前重新读取的 blockhash、lastValidBlockHeight 和政策有效窗口共同检查，不能把创建时的秒数当绝对安全保证。

### 认证

主选 **Supabase Auth 原生 Solana Web3 登录**：`supabase.auth.signInWithWeb3({chain: "solana", wallet, statement})`，使用安装版支持的钱包适配器，不自建另一套登录系统。[D2] statement 明确只用于登录，不转移资产。按该项目配置启用 Solana Web3 provider，注册正式/开发允许的 URL；域名、时间、签名等由 Auth 标准流程验证，不能改成服务器盲信钱包地址。

用 `@supabase/ssr` 的 Next 对应版本集成会话；受保护 Route Handler 通过服务端 `auth.getUser()` 等官方认证方式验证身份，不能仅信任客户端缓存的 session。登录请求走 Supabase Auth 客户端/其标准端点；本项目 session/logout 只是受控薄封装，不另建未定义 nonce/verify API。[D3]

私人草稿增加 `owner_user_id uuid`，关联 `auth.users.id`，RLS 使用 `auth.uid() = owner_user_id`。`owner_wallet` 如保存，必须从经服务器验证的 Web3 identity 取得，不能来自用户可随意修改的 profile 字段。当前连接钱包与已认证钱包不一致时，提示重新登录/明确切换，禁止借旧会话操作另一钱包的私人草稿或管理接口。

管理员需同时满足经验证的当前钱包身份与链上 PlatformConfig 管理权限；所谓 admin role 不由请求 body 或可编辑 user metadata 设置。`signMessage` 在此仅用于登录；不得当作交易证明。缺 Supabase provider 配置时继续本地草稿/公开浏览，并标明服务端认证未就绪，不静默使用 service role 给任意地址写私人数据。

## 7. Supabase / PostgreSQL

首版实现下列逻辑表，允许合理合并；不建设通用数据仓库。

| 表 | 关键字段/约束 |
|---|---|
| `asset_capabilities` | cluster+asset_key；mint、token_program、decimals、global_config、cpmm_config、status/reasons、checked_slot/at；候选可空 mint |
| `launches` | cluster+pool_id 唯一；mintA/mintB、platform_id、creator、metadata_uri、status、raw 储备/目标、cpmm_pool、确认 slot；校验平台归属 |
| `launch_drafts` | draft_id、owner_user_id（auth.users.id）、已验证 owner_wallet、validated parameters、client_mint_public_key、已确认 tx；禁止存资金私钥 |
| `chain_events` | cluster+signature+outer_instruction_index+inner/event_index 唯一；event_type、pool、block time、commitment、raw fee components |
| `fee_claims` | cluster+signature+event_index；claimant、quote_mint、amount_raw、destination、status、claim_scope、attribution_status；不可由 claim 请求直接记收入 |
| `indexer_cursors` | cluster+stream/partition；last finalized cursor、slot、最近成功/错误；幂等恢复 |
| `growth_events` | event id、非敏感匿名会话/来源、event type、launch、timestamp；不记录助记词/原始签名登录消息 |

整数余额用足够精度的 `numeric(...,0)` 或经范围确认的 bigint，不用 double；API 序列化为字符串。估值价格独立 numeric 与价格时间/来源。所有唯一键包含 cluster；demo 独立 schema/数据适配器，不混入真实表。

RLS：公开只读必要的链上索引字段；私人草稿仅所属认证会话可读写；链上事件、费用、能力与索引游标由受保护服务写入。service role 只在后端，浏览器不能直接修改 fee amount、graduated 或管理员身份。SQL migration 包含必要索引与 policy，不能只在 README 说“请配置 RLS”。

## 8. 索引、毕业和费用对账

优先索引本平台绑定的 pool，避免第一天扫描全链历史。发现可用公共 API 时用来定位候选，再用 RPC 核验。UI 所称“全平台”是 StonkLaunch 已覆盖数据；若仅覆盖观察集合，显示覆盖起点和范围，不能假装全 Solana 完整终端。

订阅负责低延迟反馈；定时补扫负责漏事件和重启。没有可靠订阅时，先轮询活跃池并批量查询，不让一笔用户请求启动无限后台循环。生产服务部署独立 indexer 或可靠调度器运行受保护的批处理接口，保存游标；开发 agent 不承担生产实时性。

事件按签名+指令/事件索引去重；同一交易可有多个 swap/CPI，不能仅以 signature 作为全局唯一事件。可短暂用 confirmed 更新页面，财务按明确的 finalized/结算政策重核；处理重复、乱序、断线补扫和失败交易。

毕业：`status===1` 时禁用曲线新报价并提示等待迁移；`status===2` 后验证目标 CPMM 的 program owner、base/quote mints、关联 config 与真实账户，再切换毕业后路由。LP burn/lock/fee key 独立读取和显示。既无目标权限又无可验证迁移账户时，保持待核验状态。

统计：毕业率采用同一创建时间 cohort 的已毕业数/该 cohort 创建数，分母 0 显示“暂无样本”。每种 quote 分别统计原始收入；USD 估值带来源/时间，不能把缺价格当 1 美元。已产生费用与当前 vault balance/claimable、已领取各有不同语义；外部直接 claim 也应补扫，不能只统计应用按钮的动作。

**聚合领取的归因边界**：LaunchLab creator vault 按 creator+quote 聚合，可能含其他平台来源。`GET /api/fees` 分别返回“本平台已归因 creator 费用”“该钱包在协议中的可领取总额”“本次领取总额”及 `claimScope`。claim 无法按来源证明时标 `unallocated`，不强行分摊到自家 pool，也不把 creator 领取金额记成平台营业收入。平台自身 vault 如含索引起点以前的金额，同样标明历史/覆盖差异，不能把它全算成本期新收入。

## 9. Solana Actions / Blinks

首版 Action 只做已验证池的买入入口，复用与网页相同的报价、费用核验和交易 adapter；复杂创建保持 Web 流程。

- `GET /api/actions/buy/[poolId]`：标准 metadata、title/icon/label/links，不可用时 disabled+原因。
- `POST /api/actions/buy/[poolId]?amount=...`：接收 `{account}`；验证地址与金额、来源池、模式；返回符合安装版本 spec 的 base64 transaction。
- `OPTIONS`：按官方规范提供 CORS；优先使用标准库 types/headers。
- 根 `/actions.json`：映射当前域的网页与 Action 路径，不能残留 example.com 或 localhost。
- amount 输入严格解析为 raw units；`account` 仅是待签地址，不作为登录凭证；不允许输入任意接收地址或替换平台费用配置。

公开 CORS 是 Action 兼容要求，不是放宽资金参数验证。实现后用检查工具和实际客户端验证。网页/海报/X 编辑器为基础分享能力；X 自动展开或内嵌交易取决于客户端/registry，单有 actions.json 不等于所有客户端已可用。[S1]

## 10. d03 项目 Skill 和安装

`skill/SKILL.md` 是随应用交付的项目 Skill，不是支付权或安全规则的覆盖器，也不因为存在文件就自动安装进用户的 dot。

生成时采用最小渐进加载结构：

```yaml
---
name: stonklaunch
description: Inspect StonkLaunch launch capabilities, explain live fees, prepare supported launch/trade/claim workflows, and diagnose graduation state using the configured application. Use for StonkLaunch operations; all transactions remain wallet-signed.
---
```

正文仅包含：先检查 `/api/runtime` 与网络；按任务读取 `references/API_REFERENCE.md`；查询能力/launch/费用；准备交易并给钱包审阅；回读链上确认；未知/演示状态如实报告。写明不接受私钥、不自动签名/发推、不把 quote 资产当担保、不声明未验证悬赏资格。API 字典给出真实部署 URL 配置方式、当前接口、金额单位、状态和错误，而不是编造一个可以付款的 Skill 工具。

目录沿用用户指定的 `skill/`。是否安装为个人 dot Skill 是独立动作，只在用户要求且环境支持时使用当前 Skill 安装流程；项目内文件仍随源码正常提交。不要擅自修改个人全局技能。

`scripts/install.sh` 必须在 d03 针对已经存在的 `package.json`/lockfile 实现：明确 Node/pnpm 版本、检查配置、安装锁定依赖、提示数据库 migration 和 worker、返回启动命令。不能自动购买服务、发主网配置交易、覆盖已有 `.env` 或打印密钥。提供 `--help`，Windows 用户可以让 dot 在其云 Linux/WSL 执行；无 WSL 不要求强装，列出等效 pnpm 命令。

package scripts 至少具备 `dev`、`build`、`start`、`typecheck`、`indexer` 和选定的最小测试命令。提交 `pnpm-lock.yaml`，给出从干净目录安装与启动的实测命令。

持久部署至少支持 Next 服务和 indexer 两种进程/托管调度配置。主页面不能在访问时偷偷开始永久轮询任务。AI 生成介绍/海报文案本轮不是必要依赖；无 AI key 时可以使用安全固定文案，不影响收费闭环。
