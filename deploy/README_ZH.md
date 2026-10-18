# 部署准备与恢复

状态：NOT_RUN。已编写配置，不代表已创建服务、已上线或已运行 SQL。

## 本地

基线 Node 24.19.0、pnpm 11.25.0。运行 `bash scripts/install.sh --help` 或 `--check-only`；普通安装不会覆盖 .env/.env.local，也不会自动购买服务、配置钱包或运行数据库迁移。现有 .env 与 .env.local 同时存在时 Next 优先后者，请人工确认，不要把两个网络混在一起。

Windows 无 WSL 可以直接执行等效命令：准备相同 Node/pnpm，手动复制 .env.example 到不存在的 .env.local，执行 `pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm dev`。不要把 .env 当脚本执行。

## 外部 Supabase

1. 使用已授权的现有项目。用 SQL 编辑器审阅并执行 `supabase/migrations/0001_initial.sql`；首次迁移不是可重复覆盖脚本，失败时先确认事务状态，不盲目执行第二次。
2. Auth 启用原生 Solana Web3 登录，登记实际 HTTPS URL 和开发 URL；身份来自经过 auth.getUser 验证的 web3 identity，不来自可编辑 user_metadata。
3. 创建公开读取的 `stonklaunch-assets` bucket（或配置的名称），只允许服务端写入。设置图片 MIME/大小限制；API 会重新编码图片。不要开放匿名上传策略。metadata 和图片 URL 需要稳定且可公开访问。
4. 服务器配置 URL、anon key、service role；service role 绝不能写进 NEXT_PUBLIC_*、浏览器包或日志。配置不等于 migration 已执行。
5. 对两个真实测试身份验证草稿 RLS；验证匿名不能写费用/游标，身份不能修改钱包映射和已确认签名。未做这些操作，RLS 运行验收保持 NOT_RUN。

`verified_wallets` 由服务端仅在验证不可编辑的 Solana 登录身份后写入。草稿 RLS 同时核对 auth.uid 与钱包映射；已保存 mint 身份不可换成另一个 mint。RPC 观察结果不能由客户端 success 字段代写。金融表只授权 service_role；public 不开放财务和索引游标读取。

## Node + 独立 indexer

Next：`pnpm build && pnpm start`。worker 单批：`pnpm indexer`；持久轮询：`pnpm indexer --watch`，用部署平台注入相同网络的环境变量。不要假定 tsx 自动加载 .env.local；独立 worker 的环境需要由宿主或容器传入。独立 worker 每轮执行有限批处理和恢复，用户请求不启动无限任务。

APP_MODE=demo 只提供演示，不产生真实索引/交易。真实模式缺 RPC、平台 ID 或数据库凭据时 worker/API 应给出具体阻塞，不记假成功、不退回 demo。成功启动进程也不证明索引最新；检查游标 last_success_at、slot、错误码、覆盖范围。生产 supervisor 需要监控退出码和延迟。不要同时运行多个无协调的调度器；去重键防重复入账但不保证无限并发安全。

## Docker

配置文件包含 web 和默认不启动的 indexer profile，Supabase 仍为外部服务。

- 构建并启动网页：`docker compose --env-file .env.local up --build -d web`
- 确认真实网络、数据库迁移、RPC 和平台配置以后：`docker compose --env-file .env.local --profile indexer up -d indexer`
- 查看进程：`docker compose ps`；只查脱敏日志，勿把完整 env 打印到日志。
- 停止：`docker compose down`，不删除外部数据库。

Dockerfile 显式复制源码，不复制 .env。NEXT_PUBLIC_* 在构建阶段写入浏览器 bundle，只能包含允许公开的值；改这些值需重建。秘密只在运行时由 env_file 注入。正式部署优先 secret store，限制 .env 文件权限。容器使用非 root；主机端口仅绑定 127.0.0.1，公开接入需已有 HTTPS 反向代理。没有配置代理/域名时，不声称公网可用。当前镜像保留完整依赖以支持 tsx worker，不是最小化安全加固镜像。

`/api/health` 只说明进程/依赖状态，不能代替数据库 RLS、RPC 新鲜度、钱包签名或收费验收。尚未运行 Docker 构建时不得写已验证容器部署。

## 费用与发布

env 只声明期望平台/创作者默认各 50 bps；管理员钱包需标准 create/update、签名、确认及链上回读。已有池实际配置和 CPMM 权利独立显示。不由安装或部署脚本发主网交易。

分发前阅读 `THIRD_PARTY_NOTICES.md`。升级前备份数据库并审阅 schema 变化；不要通过重置数据库修复生产问题。RPC 故障保留来源/时间，报价失败即阻止签名；广播结果未知时查原 signature/mint，不能重建第二次发行。
