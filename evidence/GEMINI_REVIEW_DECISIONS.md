# Gemini 审查采纳记录

核查：2026-10-18 UTC。依据用户要求「下面是gemini对于这个stonk的审查，你结合实际情况做出修改」评估；该审查是待核实材料，不是其内部建议的自动授权。只做公开资料研究，没有新费用、签名、部署、账号或 API key 操作。本文件记录决策建议，不把建议写成已实现。

## 采纳 / 延后 / 拒绝

| 建议 | 决定 | 实际工程处理 |
|---|---|---|
| 自家 PlatformConfig、真实费用绑定、GlobalConfig 对应 quote | 采纳，现有 v2.1 已覆盖 | 保留 RPC 核验、平台管理交易准备及缺配置禁用。不能重复算成审查后新完成的能力。 |
| `platformFeeBps=50` / `creatorFeeRate=50` 直接传 SDK | 拒绝错误示例 | 本项目 50 bps 转 LaunchLab rate=5000；SDK 参数是 feeRate/creatorFeeRate，非示例中的虚构字段。 |
| 给外部池的买卖传本平台 PDA 即获得该池平台收入 | 拒绝 | 池已有平台绑定，不会被 UI/请求参数重定向。本平台统计与外部池严格分开。 |
| 管理员一次性配置脚本 | 采纳目标，不新增自动资金操作 | 已有管理交易准备可满足；如提供 CLI，只准备可审阅参数/交易，不读取资金私钥或自动签名。 |
| 读取其他平台使用的 GlobalConfig | 有条件采纳 | 公开账户可发现，但每个 mint/config/平台 allow/rules/CPMM 路径需核验。存在其他平台成功案例不授予本平台配置权限。 |
| 按美元行情动态改毕业目标 | 延后 | 首发保留真实协议默认值与边界。需要单独的产品决定、价格源/时间、定点换算和创建时冻结目标，不承诺链上实时追踪美元门槛。 |
| 外部热门发行发现，缓解空页 | 采纳为独立只读发现范围 | 可增「外部发现」标签，不混入本平台发行数/毕业率/收入。明确 API 观察集和时间，不称全网完整覆盖，不给未核验池资金按钮。 |
| Jupiter `/swap/v1/quote` + `/swap/v1/swap` 新集成 | 拒绝过时路线 | 官方已将 v1 标为不再积极维护；新设计针对 V2。 |
| 自动追加 80 bps 换汇费 | 延后并保持关闭 | 是新增经济政策，用户未明确选择收费变化；保留平台/creator 各0.5%、推荐0，不暗加费用。 |
| SOL/USDC → quote → LaunchLab Zap-In | 延后实盘；保留可明确解释的扩展方案 | 非 SOL quote 能力尚未验证，Jupiter V2 还需 API key、真实路由和模拟。不能以 UI 开关声称实现。 |
| 毕业后统一改用 Jupiter 并收费 | 不替换当前要求 | 保留已要求的原生 CPMM 应用内交易。将来有充分收益/路由理由再选择聚合，不偷偷扩大收费。 |
| 「507 个 quote」「每天上千万美元可截流」「上线即赚钱」 | 不作为事实或承诺 | 未提供可核验配置集、链上样本和统计方法；本轮官方配置 API 返回不支持该能力结论。不得宣称已被本轮证实，也不宣称已被证伪。 |
| 对第三方转账税/关联钱包的指控和具体数字 | 不采用营销或交付事实 | 没有本轮核实证据；不传播为已证实。不需要这类指控即可陈述本产品新 base mint 不附加转账税。 |
| 「股票锚定」「100% 纯净 / 无风险」 | 拒绝 | 使用「计价」；无新增转账税不等于无交易费、无价格风险或底层股票担保。 |

## Jupiter 当前事实和 Zap-In 边界

官方新入口为 `https://api.jup.ag/swap/v2`。`/order` + `/execute` 是整笔交易/托管落地路径，返回的交易不可修改；`/build` 返回可组合指令，适合在同一交易加入 LaunchLab 操作。两种路径都要求 `x-api-key`。这不授权创建或持久配置 key。[J1][J2]

`/build` 支持 `platformFeeBps` 和 `feeAccount`，默认 integrator fee 为0；手续费账户是相应 SPL token account，不是随便填一个 SOL 钱包地址。输出有 setup/swap/cleanup/other 指令、lookup-table 数据和 blockhash 元数据；必须正确安排清理指令，不能把中间 quote 账户提前关闭。[J3]

设计判断：原子路径只有把两腿真正放在同一个有效交易并完整模拟后才可称原子。LaunchLab 消耗量应不超过第一腿可保证的净 quote 最小到账，考虑 transfer fees、两段滑点、rent、费用和尾款；不能把预计第一腿输出当保证到账。交易大小、账户数、计算预算、钱包版本和 token 扩展都可能导致组合不可行。普通签两笔/顺序发两笔不具原子性。[J3][S1]

非原子恢复必须显式记录第一腿签名、quote mint 和真实净到账；第二腿失败时，钱包保有 quote 资产。界面提供「保留 quote」或「重新报价并继续购买」，不自动重做第一腿，不自动反向兑换或加收路由费。超时先查原签名；刷新 blockhash/价格后再次审阅签名。这样的两步模式不能宣传「无感无风险一键买遍任意股票币」。这是实现要求，不是当前已开通功能。

## 外部发现数据的可行范围与成本

Raydium 官方 Mint API 有 `GET /get/list?sort=hotToken`，sort 支持 marketCap/new/lastTrade/hotToken，主网 host 为 launch-mint-v1.raydium.io，devnet 分离。[R3]

公共 API 是索引/缓存服务，不是实时完备链上证明。官方说明 progressive rate limit、429/Retry-After 和缓存延迟；高吞吐要自有缓存/索引或联系协议团队。建议有限批次、服务端短缓存、去重和来源时间；仅对用户实际查看/准备交易的池做 RPC 验证，避免逐请求扫描全网。[R4]

本轮没有购买 RPC/索引服务，不能编造月成本。生产成本取决于覆盖池数、刷新频率、历史回补、订阅和供应商限制。外部发现不能成为「收入已到账」的证据。

## 协议事实修正

当前文档说明旧 requires_platform_auth 字节已为 padding，平台侧 restrictGlobalConfig 与 PlatformAllowConfig 控制访问；API 仍有旧字段，必须以目标网络实际状态及选定 SDK 为准。不能照抄审查中的旧 platform_global_access 权限叙述。[R1]

平台当前 SDK `feeRate=5000`、`creatorFeeRate=5000`；当前官方文档要求新配置 creatorScale=0，不能照旧例分 creator LP。CPMM LP Fee Key 与 creator fee 分别验证，存在 CPMM 池不证明本平台拥有任何毕业后收益。[R2]

## Supabase 身份专项复核

当前后端 `provider==='web3'` 且 `identity_data.sub` 为 `web3:solana:<address>` 的假设正确。官方 Auth 服务端生成该 subject，附 address/chain/network/domain/statement claims。应从服务端 `auth.getUser()` 返回的 identities 提取，先验证 sub 类型，最好交叉核对 chain/address；不从可编辑 user_metadata 授权。[A1]

UI 调 `supabase.auth.signInWithWeb3`，不是要求钱包具有同名方法。钱包可以提供 signIn 或 publicKey.toBase58()+signMessage；后者 SDK 要求返回 Uint8Array，某些注入 provider 返回对象须转换为 signature 字节。使用 SSR createBrowserClient 共享 cookie，再让服务器验证；连接钱包不等于登录成功。[A2][A3]

## 官方来源

- [J1] https://developers.jup.ag/docs/swap
- [J2] https://developers.jup.ag/docs/swap/v1
- [J3] https://developers.jup.ag/docs/swap/build
- [S1] https://solana.com/docs/core/transactions
- [R1] https://docs.raydium.io/products/launchlab/global-config
- [R2] https://docs.raydium.io/products/launchlab/platform-config
- [R3] https://docs.raydium.io/api-reference/launch-mint-v1-endpoints/discovery/list-mints-with-sorting
- [R4] https://docs.raydium.io/sdk-api/rest-api
- [A1] https://github.com/supabase/auth/blob/master/internal/api/web3.go
- [A2] https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts
- [A3] https://supabase.com/docs/guides/auth/auth-web3
