# 独立验收清单（不是验收结果）

全部待执行项初始 NOT_RUN；由主任务填实际命令/时间/网络/证据。一个检查可以支持多个原门禁，不新增第六门禁。单元测试最多两个文件，浏览器集中验一次业务旅程。

## GATE-1 RED_ZONE

- [ ] 检查源码/依赖调用不存在自建本金托管；标准交易 decode 的 program、mint、pool、vault、收款账户与摘要一致。
- [ ] 浏览器 bundle、API/runtime/health、日志、海报没有私钥/服务端 key/私有 RPC token；安装与容器不复制秘密。
- [ ] demo 与 mainnet-readonly 的全部资金 prepare 和 Action POST 服务器端阻止；RPC 故障不回假 live。
- [ ] 后端不保存资金私钥；mint 临时 signer 留客户端，仅对应同一发行。

## GATE-2 FEE_HARDCODED

- [ ] 50 bps→5000 rate units，非法 env/非零 referral 拒绝；官方实际 protocol rate 和整数舍入正确。
- [ ] env → 标准 create/update → 管理员钱包 → 确认 → 同 PDA 回读，包括领取地址。
- [ ] 本平台 launch 正确绑定；真实创建、买入、卖出 signature、slot、网络及交易结果。
- [ ] 原币种 accrued/claimable/claimed 分账；creator 聚合领取不误记平台收入；标准 claim 及到账证据。
- [ ] status1 禁交易；status2 必须有核实 CPMM 才切路由；LP burn/lock/fee-key 权利独立证据。
- [ ] 数据库迁移实跑，身份 A/B 交叉读取/更新草稿均拒绝；可编辑 user_metadata 不产生钱包权限。
- [ ] 匿名/authenticated 不能写 financial/capability/cursor/mapping；草稿不能修改 confirmed_signature、已有 mint 或所属身份。
- [ ] 同 signature 不同 event_index 可保存，完全相同事件只一条；不同 cluster 不混账；demo 插入真实表失败。
- [ ] worker 中断后游标恢复、重复快照幂等；费用事件未实现时准确标覆盖限制，不能由余额编造历史收入。

## GATE-3 ANTI_BORING_UI

- [ ] 首页 → 创建 → 图标/字段验证 → 费用 → 拒签恢复 → 交易 → 海报 → 终端 → 毕业。
- [ ] 真签名条件缺失就记 BLOCKED；不通过按钮点击宣称签名成功。
- [ ] 桌面/手机实际浏览，CTA 不遮挡，无横向溢出；空态、加载、断网/错误有反馈。

## GATE-4 PSYCHOLOGY_EMBEDDED

- [ ] 首页草稿跨页延续、默认参数、拒签后恢复。
- [ ] 真实确认之后海报有真实 mint/pool、网络和可解码 QR；demo 有显眼水印。
- [ ] 下载、打开分享编辑器可用；不自动发帖，无假交易/假收益/假倒计时。

## GATE-5 BOUNTY_READY

- [ ] 干净依赖安装、typecheck、最多两文件测试、生产 build、start 实跑及日志。
- [ ] install.sh --help/--check-only、不覆盖已有环境、未知参数失败；Docker 独立 web/indexer 部署实跑或明确 NOT_RUN。
- [ ] Skill/API 文档与实际路由/字段吻合；金额/模式/权限说明完整，无虚构工具或正式 URL。
- [ ] Action GET/POST/OPTIONS 和 actions.json 规范响应；真实客户端展开另验，不混为一项。
- [ ] 两分钟分镜存在；视频仅在实际录制后标已交付。
- [ ] GPL-3.0 SDK LICENSE/说明随源码；外部分发前许可证义务已审阅，不声称自动获悬赏资格。

## 最后交叉检查

每个 PASS 都能定位证据；demo UI 证据不能证明主网收费。SOL/USDC/各 xStock 分别给创建、买卖、迁移、领取结果。文件编写完成不是 SQL/索引/部署完成，流程预览不是商业通过。收口使用同一轮 d04，不创建 d05。
