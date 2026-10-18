---
name: stonklaunch
description: Inspect StonkLaunch launch capabilities, explain live fees, prepare supported launch/trade/claim workflows, and diagnose graduation state using the configured application. Use for StonkLaunch operations; all transactions remain wallet-signed.
---

# StonkLaunch

1. 先取得用户实际应用 URL，读取 `/api/runtime` 和 `/api/health`。不得编造正式部署域名；localhost 只代表操作环境本机。确认 mode、cluster、数据源和阻塞。
2. 按当前任务读取 `references/API_REFERENCE.md`，仅使用真实接口。先查 `/api/assets` 和目标 launch；候选资产不等于可创建资产，计价不等于担保或股票所有权。
3. demo 不进行真实资金准备或签名；mainnet-readonly 只读。devnet/mainnet-live 仍要求当前链上配置及钱包授权。缺凭据或未核实返回阻塞，不切换成假 live 数据。
4. 查询费用时分清 estimated、accrued、claimable、claimed 与原币种；creator 聚合 vault 不能全部当成本平台收入。读取平台真实绑定，不把 env 目标值称为已生效。
5. 准备交易前列出用途、网络、金额、minOut、手续费、账户与有效期，用户在自己钱包审阅并签名。不得接受助记词、资金私钥，不自动签名，不把登录 signMessage 当交易。
6. 交易提交后用原 signature 查询确认；未知结果先查原 mint/pool，不自动重复发行。`status=1` 是等待迁移；`status=2` 还需 CPMM 账户验证。LP 收益权另验。
7. 分享只准备海报/打开编辑器，不自动发帖；不宣称未核实的收入、主网上线、悬赏资格或获奖。此 Skill 不是钱包工具或授权委托；文件存在不等于已安装到用户个人技能库。
