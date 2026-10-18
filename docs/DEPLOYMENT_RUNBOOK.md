# StonkLaunch 生产启动手册

2026-10-18 源码审阅。本文是可执行操作顺序，不是上线证明。当前没有已确认的公网部署、生产 Supabase 项目或主网资金验收。先完成隔离的 devnet 验收，再以 mainnet-readonly 做生产基础设施验收；不得把切换 APP_MODE 当作主网启用完成。

## 1. 选择一个目标与权限边界

部署需要：一个长期运行 Node 服务、一个独立 worker（或者已有受保护定时调度器，二选一）、Supabase Auth/Postgres/Storage、RPC、稳定 HTTPS 域名。现有 Docker 路径可用于已经授权的主机；不要把临时开发进程当作生产后台。

已检索插件目录：Supabase、Railway、Render、Vercel 可提供连接入口，但本次均未安装，不能据此声称已有服务权限或套餐。没有调用注册、安装、创建项目、支付、部署或凭据操作。供应商价格和账号实际权益未核实，费用未知；不能承诺免费生产运行。当前建议路线为 Render + Supabase，连接仍待用户完成；这不是已购买、已创建项目或已批准持久配置凭据。

待操作者一次性明确：

1. 选择已有主机/部署供应商及 Supabase 项目（没有项目时另行明确账号创建、区域和套餐）；批准把指定仓库源码交给指定部署服务。不默认开放整个 GitHub 账号。
2. 凭据具体配置时确认最小权限、写入哪个平台的 secret store、哪些服务能读取：Supabase 服务端 key、私有 RPC 凭据；如选 cron，另需新 cron secret。不得贴到聊天、仓库、公开构建参数或日志。持续访问创建/配置必须在具体操作时确认。
3. 主网管理员、平台费收款钱包及所需 LP/权限公钥；LP 分配和不可逆销毁必须单独审阅。主网钱包交易由用户在钱包审阅签名；不使用 devnet Actions secret，不自动付款/自动签名。
4. 有费用时先给出供应商、服务、币种、总额/周期和取消条件，批准后才能订购。域名不是必需采购项，可先用已经授权的稳定供应商 HTTPS 地址。

这些批准不代替主网资金交易的用户亲自操作，也不代替尚未满足的法律协议或访问权限确认。

## 2. 离线配置预检（不读取秘密）

复制 `deploy/production.public.example.json` 为一份仅含非秘密的部署清单，填真实公钥、公共 URL 和布尔声明。不要粘贴 RPC URL、anon key、service role、数据库密码或任何 secret；未知字段拒绝。脚本不加载 `.env`、不查看 process.env、不联系服务，也不证明声明真实。

```sh
node scripts/verify-environment.mjs --self-test
node scripts/verify-environment.mjs --manifest deploy/production.public.example.json
```

示例默认退出码 1/BLOCKED 是预期结果。自测 12 项已实际通过。`CONFIG_SHAPE_VALID` 仅表示清单语法和长度约束通过，不是 READY。

关键约束：

- APP_ORIGIN 和 Supabase URL 使用规范 HTTPS origin，无结尾 `/`、查询或 fragment；前者用于同源校验和分享链接，后者也用于上传身份前缀核对。
- 默认 20 字符 Supabase project ref、`stonklaunch-assets` bucket 及当前 metadata 路径组合恰好 **200 bytes**。更长 bucket 或自定义 Supabase 域名可能使发币 URI 超限。先跑预检；不要先上传或签名再发现超长。
- NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SOLANA_RPC_URL 在构建阶段固化到浏览器。只能给公开允许的值。改变后重新构建，不只是重启。
- 仅服务器接收 SOLANA_RPC_URL 和 SUPABASE_SERVICE_ROLE_KEY。DATABASE_URL 当前应用代码不使用；不要无故配置额外数据库高权限凭据。
- 生产 RPC 是独立门禁：[Solana 官方 cluster 文档](https://solana.com/docs/references/clusters) 明确公共 RPC endpoint 不面向生产应用。上线前必须选定并验证专用服务端 RPC；当前没有已连接或批准的生产 RPC 供应商。NEXT_PUBLIC_SOLANA_RPC_URL 会公开给所有浏览器，绝不能复制带私有服务端凭据的 URL。浏览器 endpoint 必须由供应商明确允许公开使用，并配置适当的域名限制、配额/速率限制；否则先实现并审阅受限代理方案。URL 含 API key 不意味着这个 key 可以公开。离线清单的 browserRpcConfigured=true 和 /api/ready 成功都不验证供应商的浏览器授权、限制、计费或生产容量，相关配置须另验。
- standalone worker 不自动读取 `.env.local`；由受权宿主注入运行环境。不要 `source` 用户配置文件。

## 3. Supabase：一次迁移 + bucket + Auth

先确认项目的 cluster 用途，devnet 与生产使用不同项目更易隔离；各表已有 cluster 约束不是误配置的免责机制。

由已获授权的项目操作者执行 `supabase/migrations/0001_initial.sql`。该文件包含 begin/commit，但不是可重复迁移；再次运行前查已应用状态，不能 reset 生产数据库。迁移没有创建 Storage bucket。

先在目标项目只读检查：

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'stonklaunch-assets';
select schemaname, tablename, policyname, roles, cmd
from pg_policies where schemaname in ('public', 'storage');
```

确认 bucket 不存在且获得创建/公开读取权限后，操作员可执行以下一次性配置（不是应用 migration，也没有在本次运行）：

```sql
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('stonklaunch-assets', 'stonklaunch-assets', true, 2097152,
        array['image/png', 'application/json']);
```

若已有同名 bucket，先审阅现有用途与权限，不能盲目 upsert 改公开。当前 API 将上传图标重编码为 PNG，metadata 是 JSON；只允许图片 MIME 会造成 metadata 上传失败。两者都是有意公开的项目资料，不能上传个人机密。不要加匿名或 authenticated 写 storage.objects 的 policy；应用只通过服务端凭据上传。现有过宽 Storage 策略也必须审阅，不能因为本仓库没有创建就假定没有。

Auth 在目标项目启用 Solana Web3 provider，配置实际站点 URL/允许 origin。由真实钱包发起网页登录，检查 `/api/auth/session` 返回钱包与当前钱包一致，然后测试刷新页面、重新登录和退出登录。代码只信任 auth.getUser 取回的 web3:solana 身份，不信任 editable user_metadata。连接钱包不是登录；登录消息不是资金交易。

## 4. 构建与进程

现有基线 Node 24.19.0 / pnpm 11.25.0，锁文件安装：

```sh
bash scripts/install.sh --check-only
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm exec tsx scripts/check-database.ts
pnpm build
pnpm start
```

`check-database.ts` 是 PGlite + auth stub，能验证本地 migration/RLS，但不能替代托管 Auth、Storage 或网络验收。没有为本手册重复声称运行以上构建命令。

独立进程方案（注入环境后）：

```sh
pnpm indexer
pnpm indexer --watch
```

先单批成功，再由宿主 supervisor 托管 watch，配置重启及失败告警。worker 与 web 使用同一 cluster/platform，不能并发跑多个无协调 indexer。若用 cron，调用 GET `/api/cron/index`，携带 `Authorization: Bearer <secret>`，secret 至少 32 字符；调度器安全配置头，不把 secret 放 URL。接口 maxDuration=60 不保证宿主允许 60 秒，也不保证该批次在此时间完成；先测真实时长再定周期，禁止批次重叠。现有仓库没有创建任何外部调度器。

Docker 已有文件，但本次未构建或运行容器：

```sh
docker compose --env-file .env.local up --build -d web
docker compose --env-file .env.local --profile indexer up -d indexer
```

Compose 只绑定 127.0.0.1:3000，必须接已有 HTTPS 反向代理。Docker `.env.local` 仅是已批准的本机部署路径示例；托管部署优先 secret store。不要导出完整 compose config/env 到日志。

## 5. 上线前必须实测的结果

1. 公网 HTTPS `/api/runtime` 显示目标模式/cluster/origin；`/api/health` 保留原配置诊断契约，HTTP 200 不代表健康依赖或可收费。新增 `/api/ready` 为独立基础设施探针：配置不全、demo、错误网络、数据库拒绝或超时返回 HTTP 503；并行限时 5 秒检查 RPC genesis 与私有 indexer_cursors 表可读取，禁止跳转转发凭据。结果每进程缓存 30 秒并合并并发请求，公开响应仅固定代码/时间。HTTP 200 且 scope=infrastructure_only 仍不证明 Auth 登录、Storage 上传、游标新鲜度或金融门禁通过。多实例仍可能各自探测，宿主应限制过量请求。
2. 两个真实钱包 A/B 分别登录：A 草稿可保存/刷新恢复，B 无法读取/修改；伪造 x-wallet-address 拒绝；匿名无法写 verified_wallets、fee_claims、chain_events、indexer_cursors。本地 auth stub 结果不替代这一项。
3. 登录 A 上传实际 PNG：返回 HTTPS URL 可匿名取到正确 PNG；准备发币产生 JSON 后其 URL 可匿名读取、Content-Type 正确、URI 不超过 200 bytes，name/symbol/image 匹配。主网准备/交易仅在用户允许的实际流程中进行，不能为了 smoke test 产生新资金动作。
4. worker 完成真实单批并重启恢复；在数据库只读检查以下结果，slot/last_success_at 随后推进，重复批次不重复事件。人为 RPC 故障必须显示错误并停止声称最新，不切 demo。

```sql
select cluster, stream, partition, slot, last_success_at, last_error_code, updated_at
from public.indexer_cursors order by cluster, stream;
select cluster, platform_id, count(*), max(confirmed_slot), max(observed_at)
from public.launches group by cluster, platform_id;
```

同时检查单批返回的 `blockers` 和 `reconciliation.blockers`：外层成功不等于历史费用对账完整。快照索引不是所有 swap 的完整事件索引。

5. 钱包端完成当前尚缺的受控 devnet 浏览器全旅程与拒签/恢复，再单独安排主网 PlatformConfig 读取及用户授权的资金验收。原有五门禁未通过时不得改成生产 READY。USDC/xStocks 未验证不得开放创建；SOL 闭环不等于任意资产计价已实现。
6. 发布前复核 `deploy/THIRD_PARTY_NOTICES.md`，保留 SDK LICENSE，并审阅面向浏览器 bundle/源码分发的适用义务。不能以“私有 GitHub”推断公开 bundle 已合规。

## 6. 回滚和证据

记录实际 commit、环境、构建结果、非秘密公网 URL、Auth/Storage 检查时间、索引游标/新鲜度和交易证据；不要记录 cookie、Bearer header、secret 或私钥。出现资金路由/来源异常时由运营者将应用切为 mainnet-readonly 并重启，停止新交易构建；保留已有原 signature/mint 用于查询，不自动重发。回滚应用版本不删除数据库、不改写链上事实、不自动退还资金。

当前明确待办：目标供应商/项目与费用范围未选择；凭据持久配置未授权执行；托管迁移/Auth/Storage/索引验收 NOT_RUN；公网部署 NOT_RUN；主网钱包操作未执行。以上是具体外部前置条件，不是可以靠继续本地修改变为 PASS 的项目。

新增 readiness 验证：8 个 mock 检查已执行通过，无真实外部服务访问；主任务随后复跑 readiness 8 项及清单 12 项通过，并清理陈旧缓存后确认整仓 typecheck 通过。宿主可选择 `/api/ready` 为部署 readiness 检查；现有 Docker `/api/health` 检查未改动。
