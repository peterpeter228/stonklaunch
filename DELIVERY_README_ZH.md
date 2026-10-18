# StonkLaunch 开发交付状态

更新时间：2026-10-18。当前为可运行、已实操的私有 DEMO 工程，不是已经上线收费的成品。用户要求的 Argon 独立审查仍待核实费用，不能宣称全部验收完成。

## 1. 已有结果

仓库：https://github.com/peterpeter228/stonklaunch （私有）。实现检查点0afc9ac4213b846b5d84309581e630fb44562370已验证推送；后续修复以main实际提交为准，不用文档自指最新SHA。

五页：发现、连续创建、代币交易、毕业证据、终端。默认DEMO隔离真实资金；本平台与外部发行分开，外部发行只读、不算本平台收入。

实际浏览器完成首页→草稿刷新→校验→费用预览→演示详情→买卖模式隔离→PNG→毕业→终端。修复并复测负数输入、图标错误恢复、窄屏装饰溢出及钱包按钮可访问名称。详见evidence/BROWSER_QA.md。

实际PNG为1080×1350，二维码已独立解码至对应本地DEMO详情页；不等于公开分享地址可达。桌面和500px已测，360px与真机未测。

## 2. 启动

已使用Node24.19.0、pnpm11.25.0、Next15.5.28、React19.3.1、TypeScript5.9.3、SDK0.2.74-alpha。

在项目目录执行：

1. pnpm install --frozen-lockfile
2. pnpm build
3. pnpm start
4. 打开http://localhost:3000

默认APP_MODE=demo，不需要API Key、钱包或Supabase账号。已验证安装、类型检查、构建和本地生产服务。scripts/install.sh支持--help、--check-only，不覆盖已有环境文件。Windows安装Node/pnpm后可执行相同命令；没有验证Windows本机，不能把云端成功写成Windows实机通过。

环境示例保留空凭据。真实部署需按deploy/README_ZH.md配置Supabase、RLS、对象存储、正式URL和独立索引进程。Docker配置已提供但未运行Docker验收。pnpm indexer默认有限一次；--watch用于受监督的后台服务，不把当前临时电脑当生产服务。

## 3. 链上与费用

默认平台50bps、creator50bps、referral0。LaunchLab单位为百万分率，50bps转换5000，不能传50。公开主网SOL GlobalConfig已通过RPC与owner检查，slot458280673，协议费2500，最小募集24SOL。该证据不含自家平台、交易或领取。

平台创建/更新由标准SDK准备，LP比例/权限公钥必须显式配置，不猜测经济权利。env改变只表示期望；钱包签名、确认、回读后才生效。真实签名和资金操作交给用户本人。

没有创建自家平台或发币，没有买入/卖出/claim/迁移签名，没有真实收入。实际收入0，成本结算未知。非SOL发现列表仅是公共API观察，不证明本平台能使用对应GlobalConfig；USDC/xStocks不能宣传已支持。

## 4. 五门禁

| 门禁 | 状态 | 证据与限制 |
|---|---|---|
| GATE-1 RED_ZONE | BLOCKED（源码部分已核查） | 标准SDK、无自建资金池、无服务端钱包私钥；尚无实际签名交易审阅证据 |
| GATE-2 FEE_HARDCODED | BLOCKED | 单位/绑定测试、公开GlobalConfig读取通过；自家配置、真实费用归属和领取未验 |
| GATE-3 ANTI_BORING_UI | BLOCKED（桌面/500px通过） | 五页实际点击与失败恢复通过；严格360px条件未验 |
| GATE-4 PSYCHOLOGY_EMBEDDED | BLOCKED（DEMO通过） | 草稿连续、演示PNG/QR通过；真实创建后的身份海报未验 |
| GATE-5 BOUNTY_READY | PASS（工程材料范围） | 源码、Skill/API、配置、安装、分镜齐备；未提交悬赏、不证明参赛资格或收益 |

支持证据：unit-final.txt、route-smoke-initial.txt、backend-route-smoke.json、database-smoke.txt、build-overflow-recovery.txt、BROWSER_QA.md、poster-qr-verification.json。

数据库迁移/RLS在嵌入式PostgreSQL执行，Supabase Auth由最小stub替代：自有草稿可读写、另一身份不可读、伪造钱包/财务写入被拒、mint身份不能替换。不能据此宣称真实Supabase部署/登录/Storage已通过。

## 5. 已知缺口

- Argon原生流式两轮审查已完成，另一次长审查超时未形成结论。用户已取消20元门槛；实际费用未知。采纳与反证见ARGON_FINDINGS_RESOLUTION.md。
- 最终在线依赖审查已获授权并完成：0 critical、1 high、4 moderate；不等于无风险。已修Next传递PostCSS；SDK传递依赖仍有已知告警，详见DEPENDENCY_SECURITY_REVIEW.md。不能把私有演示当金融生产安全认证。
- 没有Supabase实际项目接入、真实钱包、平台配置或部署账户。
- 已接入链上Metaplex名称/符号/URI并校验owner和mint；任意外部URI图片与描述未自动抓取，索引仍有范围限制。
- 已实现有限历史平台vault领取对账，swap费用、creator历史及CPI包装领取未完整解码，未知金额保留null，禁止捏造收入。
- 没有验证真实创建、买卖、领取、毕业后LP权利；Actions格式/模式隔离通过，真实客户端展开未验。
- 没有公开网站、录制视频或外部用户/付费验证。
- Next15维护窗口临近2026-10-21，发布前须重新核对支持情况；不能带过期支持声明上线。

## 6. Gemini审查采纳

v2.1已覆盖真实平台配置/计价白名单；保留并加固。新增独立外部只读发现缓解空页，不挪用外部池收入。拒绝协议费率单位错误、保证盈利和未经核实的竞品指控。Jupiter v1已过时；V2 Zap-In需要路由、Key、两腿失败恢复和明确费用政策，当前未启用，不新增0.8%抽成。详见evidence/GEMINI_REVIEW_DECISIONS.md。

## 7. 两分钟分镜（未录视频）

00:00–00:15：首页、DEMO与资产能力；00:15–00:35：草稿/图标/预览；00:35–00:55：费用与模式拒绝；00:55–01:10：演示海报PNG与二维码；01:10–01:30：买卖校验、无真实报价时的明确反馈；01:30–01:45：status0/1与LP未知；01:45–02:00：终端分账、Skill与当前缺口。全程不把样例身份或金额冒充真实交易。

## 8. 继续验收所需

Argon审查与本地修复已完成两轮。现在需要免费devnet测试币完成已授权临时钱包实测，再连接实际Supabase/部署环境和平台管理员等公开配置。真实资金钱包签名由用户本人执行；用户明确批准的临时devnet测试除外，不能要求用户把资金私钥交给程序。公开部署、真实金融操作和商业收入各自验收，不能相互替代。

## 9. 核查报告后的费用透明度增量
已加入只读mint检查：当前/未来转账费率、每次上限、修改/提款及mint/freeze权限、网络/slot/UTC时间。搜索可按mint，错误重试、切换和关闭重开经实际浏览器验证。实际主网USDC只读检查成功；Token-2022构造RPC测试通过，真实样本首次超时后一次有界重试成功（slot458315142），这仅验证一个样本，不能写成全网覆盖或交易通过。15项测试、类型检查、生产构建通过。Argon第3个完成的短审查指出的有效问题已修复，错误的offset82建议未采用。
未知分红仍为未知，无每日收益/回本承诺；没有启用外部交易或0.8%收费。完整记录：evidence/TOKEN_INSPECTION_QA.md。

## 10. 最新 devnet 实操验收
五笔真实测试网交易已最终确认：配置平台、创建代币、买入、卖出、平台领取；49项回执断言通过。16项单测/类型检查/构建通过。实操发现并修复了WebSocket失败造成长时间等待的问题，改为有时限HTTP状态确认，不重复广播。
创作者领取仅通过未签名模拟和指令核验，没有真实广播，不能算通过。原临时进程退出使其仅在内存的密钥不可恢复；替代钱包无测试币，用户额度已满且要求不要再领。两个临时地址均不要再充值。源码不保存私钥，新增的是公开签名/凭据检查点。
真实Supabase登录、浏览器钱包签名闭环、毕业CPMM/LP、生产配置及部署仍未完成。详见evidence/DEVNET_ACCEPTANCE_SUMMARY.md。前述早期“无签名交易”章节是历史基线，以本节及最新STATE为准。
