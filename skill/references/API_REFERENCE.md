# API 使用参考

依据本仓库实际 Route Handlers；运行证据见最终 DELIVERY_README_ZH.md。BASE_URL 必须由操作者提供已验证部署 URL，开发默认 http://localhost:3000。不要把示例占位地址作为生产链接。未部署、未配置或 builder 返回 blockers 时停止资金步骤。

普通 JSON 响应为 `{data,requestId}` 或 `{error:{code,message,details?},requestId}`；Action 使用标准 Action JSON，海报返回图片。raw 金额是十进制字符串，不能用 JS 浮点转换。响应中的 cluster、dataSource、observedAt、slot、isStale（如适用）说明证据来源；没有 slot 不代表链上已确认。

## 会话与来源

Supabase 原生 Solana Web3 登录在网页完成。GET /api/auth/session 读取已验证会话，POST /api/auth/logout 清理会话；没有自建 nonce/verify API。受保护写接口需要会话 cookie、匹配的 Origin 和当前钱包 x-wallet-address（有传入时必须匹配）。不能用一个公钥冒充登录；admin 还需实际链上权限。服务端 key 不提供给 Skill。

## 只读接口

- GET /api/runtime：模式、cluster、公钥配置、开关、阻塞，无私有 RPC URL 或密钥。
- GET /api/health：简明健康信息，不能当收费或正式部署证明。
- GET /api/assets：逐资产创建/买卖/迁移能力及原因。
- GET /api/launches?limit=12&status=0&creator=PUBLIC_KEY&cursor=POOL_ID：limit 1–50；status 0/1/2；items、nextCursor、coverage。仅覆盖已观察本平台池，不是全链榜单。
- GET /api/launches/[mint]：发行和真实绑定。地址必须属于当前网络。
- GET /api/fees：当前身份费用，按 quote mint 分账；数据不可用为 null/阻塞而非虚构零收入。
- GET /api/posters/[mint]?format=og：PNG 海报，og 变体用于分享。Demo 水印不能去除。

## 创建

POST /api/uploads：multipart/form-data 的 file，仅认证用户，PNG/JPEG/WebP ≤2 MB；服务端解码重编码，返回稳定受控 URL。demo 只本地预览，不上传真存储。

POST /api/launches/prepare：Header Idempotency-Key 使用稳定 UUID；JSON：
`{"name":"My Token","symbol":"MYT","description":"...","assetKey":"SOL","clientMintPublicKey":"CLIENT_GENERATED_MINT_PUBLIC_KEY","imageUrl":"OWN_UPLOADED_URL","initialBuyRaw":"0"}`

name 1–32、symbol 1–10 英文字母/数字，description ≤1000；imageUrl、initialBuyRaw 可省略。初始买入当前仅允许 0；不宣称已支持自动初买。客户端临时 mint signer 仅用于本次 mint，私钥不发服务器或日志。UUID 同一草稿和已保存 mint 保持不变。prepare 保存 metadata/草稿，不等于已发币；根据实际 plan 检查 blockers 和 transactionBase64，客户端 builder 如有多笔交易需逐一审阅。

## 买卖与观察

POST /api/trades/quote：`{"poolId":"POOL_PUBLIC_KEY","side":"buy","amountRaw":"1000000","slippageBps":50}`。side buy/sell，slippageBps 0–1000；amountRaw 正整数且 ≤u64。买入 amountRaw 是 quote 原始单位，卖出是 base 原始单位。

POST /api/trades/prepare：同上，另需会话；服务器从身份取得 wallet，不接收任意资金收款地址。prepare 会重新读取当前池及配置。交易计划包含 kind、cluster、transactionBase64、blockhash、lastValidBlockHeight、summary、requiresWalletSignature、blockers。只有非空交易及空 blockers 才能继续钱包审阅；不得擅自修改 minOut 或平台账户。

POST /api/transactions/observe：`{"signature":"ORIGINAL_SIGNATURE"}`。只是给服务器核验线索；不接受客户端 success、收益或 graduated 字段。signature 存在不等于成功；结果未知先查询，不盲目重发。

## 管理与领取

POST /api/fees/prepare-claim：`{"quoteMint":"QUOTE_PUBLIC_KEY","scope":"creator"}`；scope creator/platform。按实际 vault 和身份准备；creator+quote 聚合可能含外部平台，claimScope/attributionStatus 不得省略。

POST /api/admin/platform/prepare：`{"action":"create"}` 或 `{"action":"update","updateType":"updateClaimFeeWallet"}`。updateType 当前允许 updateClaimFeeWallet/updateFeeRate/updateCreatorFeeRate；配置取自受控环境，而非请求任意地址。管理员签名、确认、同一平台回读匹配后才生效。

## Action 与索引

GET /api/actions/buy/[poolId] 返回 Action metadata，可能 disabled 及原因；OPTIONS 提供 CORS。POST /api/actions/buy/[poolId]?amount=0.01 接收 `{"account":"WALLET_PUBLIC_KEY"}`，amount 为 quote 展示十进制，由该 mint decimals 转 raw。account 是待签地址，不是认证凭证。仅买入，复用真实交易 adapter，需 ENABLE_SOLANA_ACTIONS 与可交易模式；返回 unsigned transaction。`/actions.json` 映射本域路径；未做真实客户端验证不能承诺 X 自动展开。

GET /api/cron/index 使用 Authorization: Bearer CRON_SECRET 触发有限批次；不要把 secret 放 URL/对话中。生产采用独立 `pnpm indexer` 或获授权调度，不由 Skill 常驻代替后台服务。游标和写库缺配置时应明确失败。

## 状态与错误

常见阻塞：AUTH_NOT_CONFIGURED、AUTH_REQUIRED、VERIFIED_SOLANA_IDENTITY_REQUIRED、WALLET_SESSION_MISMATCH、DATABASE_NOT_CONFIGURED、ACTIONS_DISABLED、QUOTE_CONFIG_UNVERIFIED、CONFIG_MISMATCH、RPC_UNAVAILABLE、MIGRATION_PENDING、CPMM_UNVERIFIED。以实际响应 code/message 为准，不把本清单当成功分支保证。

草稿 → 校验 → 等待签名 → 提交 → 确认是不同阶段。未知广播结果不是失败重发许可。status 0 使用曲线，1 暂停买卖等待协议迁移，2 仅在 CPMM 验证后使用 CPMM；没有 graduate() API。CPMM 费用与 LP 权利不能套用曲线平台/creator 默认各 50 bps。
