# StonkLaunch 交付说明

本文件为待主任务填入实测证据的交付底稿。已编写源码与文档不等于门禁通过；下列 NOT_RUN 不能在没有证据时改成 PASS。

## 1. 可运行结果

- 源码：本仓库根目录；分支/SHA：待最终提交后填写。
- SDK：@raydium-io/raydium-sdk-v2 0.2.74-alpha；Next 15.5.28、React 19.3.1。
- 默认模式 demo；正式 URL 未提供，公开生产部署未验证。
- 实际预览入口、开始时间、日志与截图：NOT_RUN，主任务验收后填写。
- demo 使用 src/lib/data/demo.ts 合成资料，始终标记；不能用于真实交易、财务或毕业证据。

## 2. 启动方式与实测记录

基线 Node 24.19.0、pnpm 11.25.0。运行 `bash scripts/install.sh`：已有 .env/.env.local 不覆盖；缺少时复制 .env.example 为仅本地默认 demo；安装锁定依赖，不执行账号创建、SQL、部署或主网操作。

命令顺序：`pnpm typecheck`、`pnpm test`、`pnpm build`；开发 `pnpm dev`，生产 `pnpm start`；indexer 单批 `pnpm indexer`、持续 `pnpm indexer --watch`。worker 环境由部署宿主注入，不能假定自动读取 .env.local。

| 项目 | 状态 | 已有证据/限制 |
|---|---|---|
| 脚本语法、--help、--check-only | PASS（仅脚本检查） | 本工作环境实跑，退出 0；未输出环境秘密，未创建配置 |
| 干净安装、typecheck、测试、build/start | NOT_RUN | 由主任务统一记录执行结果 |
| SQL migration/RLS | NOT_RUN | supabase/migrations/0001_initial.sql；未连接真实 Supabase，当前无 psql |
| Docker web/indexer | NOT_RUN | Dockerfile/docker-compose.yml 已写；当前无 Docker，不声称镜像已构建 |
| 生产索引持久运行/补扫 | NOT_RUN | 配置与源码不等于已上线后台 |

数据库、Auth Web3 provider、公开资源 bucket 和 Docker 步骤见 deploy/README_ZH.md。脚本不替用户购买或注册 Supabase。容器公开构建变量与运行秘密分开，外部 Supabase 不由 compose 创建。

## 3. 收款配置

管理员、领取钱包、平台 PDA：未填写/未核验。默认期望 platform 50 bps、creator 50 bps、referral 0；LaunchLab units=bps×100。协议费须当前链上读取；不是“固定总费 1%”。

配置路径：env 目标 → /api/admin/platform/prepare 标准 create/update → 管理员钱包审阅签名 → 链上确认 → 同一 PlatformConfig 回读匹配。仅改 env 不会更改链上费率或领取权。已有池显示实际绑定；毕业后 CPMM 费用与 LP 收益权单独核验。claim 需真实领取钱包和标准协议 builder，不由服务器签名。

## 4. 五门禁

| 门禁 | 状态 | 网络/证据与剩余影响 |
|---|---|---|
| GATE-1 RED_ZONE | NOT_RUN | 需代码及实际交易账户核验，不能仅凭无 Rust 目录 |
| GATE-2 FEE_HARDCODED | NOT_RUN | 尚无真实绑定、成交、claim/到账证据 |
| GATE-3 ANTI_BORING_UI | NOT_RUN | 主任务填写桌面/手机业务旅程证据 |
| GATE-4 PSYCHOLOGY_EMBEDDED | NOT_RUN | 主任务填写草稿恢复、真实身份海报及分享证据 |
| GATE-5 BOUNTY_READY | NOT_RUN | Skill/安装/分镜文件已写，仍需工程与接口实际验收；不宣称悬赏资格 |

独立验收项目见 deploy/ACCEPTANCE_CHECKLIST_ZH.md。保持原五门禁，不另加轮次。仅有 demo UI PASS 不代表主网商业通过。

## 5. 资产与功能范围

| 计价 | 创建 | 买卖 | CPMM 迁移路径 | 领取 |
|---|---|---|---|---|
| SOL | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |
| USDC | 待逐集群验证 | 待验证 | 待验证 | 待验证 |
| 每种 xStock | 待逐 mint 与接入条件验证 | 待验证 | 待验证 | 待验证 |

候选资产登记不等于多计价能力完成。SOL 若最终验证成功，而非 SOL 未通过，只能声明 SOL 范围闭环。计价资产不是价格锚定、股票所有权或担保。

API 使用与模式/权限见 skill/references/API_REFERENCE.md。Action GET/POST/OPTIONS 规范验证：NOT_RUN；真实客户端/Blink 展开：NOT_RUN。没有上线 registry 或 X 内嵌交易保证。

## 6. 真实链上结果

本底稿未记录任何本次创建、买入、卖出、claim 或毕业签名。缺签名/slot/网络/账户回读，不宣布发行、收入或领取完成。status=1 只是等待迁移；status=2 仍需目标 CPMM 验证；LP burn/lock/fee-key 独立证明。

当前索引为有限池快照批处理；若尚无完整事件/claim 解码回放，不得把快照观察称为财务对账闭环。最终覆盖限制由主任务根据实际实现填写。

## 7. 两分钟演示分镜

- 00:00–00:15：首页、SOL 与有状态候选资产，网络/DEMO 标签可见。
- 00:15–00:35：草稿带入创建，图标验证、折叠高级参数与海报预览。
- 00:35–00:55：完整费用摘要，钱包审阅；缺钱包则明确只演示流程，展示失败/草稿恢复。
- 00:55–01:10：只有已确认记录才展示真实发行成功；海报下载/打开 X 编辑器不等于发帖。
- 01:10–01:30：交易页金额、报价、minOut、费用、确认或明确失败。
- 01:30–01:45：毕业等待与 CPMM 核验；既有池标来源，不伪装本次新池毕业。
- 01:45–02:00：终端原币种费用、领取入口、Skill/API；结尾准确列完成范围。

视频状态 NOT_RUN：未实际录制/提供文件，不称“附演示视频”。海报 1080×1350、OG 1200×630，demo/devnet 显眼标记。

## 8. 商业口径与许可证

本次尚无经验证实际收入/领取证据，不用 demo 数字填补。若没有实际成交，本次实际收入为 0；未知历史 vault 余额不能归成本期收益。分别记原币种 accrued、claimable、claimed，creator 聚合领取不可当平台营业收入；USD 估值要注明价格来源/时间与成本。

Raydium SDK 声明 GPL-3.0，许可证副本与分发提醒见 deploy/THIRD_PARTY_NOTICES.md。未擅自把整个应用声明 MIT；外部分发前应审阅相应源码/通知等义务。本工程不自动取得悬赏资格或奖励。

## 9. 剩余具体动作

1. 在已授权部署环境填写真实 RPC、外部 Supabase/存储/登录 provider、允许 URL，运行并验证 migration/RLS；如接入尚未授权，先确认具体服务操作，不自动新建账号。
2. 在目标集群填写管理员/领取公钥和真实平台/GlobalConfig/CPMM 配置，逐资产回读。准备交易费用摘要后由对应钱包审阅；本底稿不预设主网支出上限或签名授权。
3. 沿用现有仓库/部署授权完成可完成操作；仍需钱包签名/新服务权限的，仅说明具体目标、费用上限与待决定事项，不重复确认常规实现。
4. 主任务把实测命令、浏览器、真实链上与资产能力证据写回本文件及同一 d04 记录，保持未验证项诚实状态。
