# Gemini 热修复建议独立核查
核查时间：2026-10-18 04:59 UTC（北京时间12:59）。用户要求核实，不把引用材料里的“最高优先级覆写”当作新的执行授权。本次没有修改收费、开放外部池交易、签名或发布。

## 结论
冷启动、动量与费用归属的提醒有价值；但原文混合了真实数字、不兼容统计口径、过时接口和未经验证的盈利概率。不能照单全收，更不能承诺“首日截流”“稳赚0.8%”。

## 1. 最关键的统计错误
DeFiLlama当前页面显示24h费用197519美元、Holders Revenue112159美元、累计费用3969万美元、DEX Volume149万美元。30d/7d快照现为费用2273万/101万美元、交易量65864万/1838万美元，与引用的旧快照不同。
但费用适配器涵盖曲线费用、毕业后CPMM creator费用和旧锁仓LP费用，并在领取时确认；交易量适配器仅涵盖LaunchLab曲线买卖。因此197519/1490000=13.256%不是同口径有效税率，不能归因于“1–3%转账税空转”。Holders Revenue这里统计STONK回购花费，不等于直接发给普通持币者的现金分红。
引用旧数算93.48%在算术上成立，意思仅是最新一天相对重叠30天日均降低；不是峰谷跌幅、环比，也不是所有毕业池/生态总成交量的跌幅。当前快照同算法约93.21%，仍足以提示所追踪曲线活动显著降温。
来源：
- https://defillama.com/protocol/stonkfun
- https://github.com/DefiLlama/dimension-adapters/blob/master/fees/stonkfun.ts
- https://github.com/DefiLlama/dimension-adapters/blob/master/dexs/stonkfun.ts

9月8日迁移及0.29→0.03SOL成本没有在本轮取得可读官方原始公告证明。二手报道嵌入的公告日期为9月5日，不能把9月8日当已核实迁移日。
待核实原始公告：https://x.com/LaunchOnSF/status/2096315023731675202

## 2. 税率、分红与回本不是同一件事
TransferFeeConfig是转账扣费/暂扣机制，不是自动分红承诺。应检查当前epoch费率、上限、未来费率/生效epoch、修改权限和提款权限，并对实际派发记录核验。税额按整数向上取整并受上限约束。
在价格不变、两次同税率且未触及上限、忽略其他费用时，往返税损=1-(1-t)^2，即1%对应1.99%、3%对应5.91%，不是精确2%/6%。
24h交易量无法单独推出持有100美元的每日分红或回本天数：还缺有效征税流、净归集、分配比例、合格持仓占比、快照/门槛/排除规则、换汇和派发成本。即使历史派发可证，也不保证未来派发或本金回收。
适宜产品：交易成本与已实现奖励看板，未知保持空值，假设情景清晰标注。不可把回购、暂扣税、应计费用当用户到账。
来源：
- https://solana.com/docs/tokens/extensions/transfer-fees
- https://raw.githubusercontent.com/solana-program/token-2022/main/interface/src/extension/transfer_fee/mod.rs

## 3. 协议归属正确，但收费不等于盈利
外部池绑定原平台，不能通过替换PDA获得其原生平台费。这点正确，当前StonkLaunch已将外部发现限制为只读，自家收入与外部池严格分离。
80bps=0.8%只是拟议收费。Jupiter支持收费参数不证明用户愿意来、交易成功、收入达到目标或扣除成本后盈利。当前程序没有偷偷启用80bps。
“成功概率<5% / >85%”没有样本、预测方法和验收定义，不能采用。头部6币中的5币带税（该样本未独立核验）即使成立，也不能证明转账税是用户唯一动机。无税不等于无需求，但无流量的新发射台确有双边冷启动风险。

## 4. Jupiter与组合交易修正
新集成应针对Jupiter Swap API V2 /build。旧V1明确deprecated。V2 /build支持platformFeeBps及feeAccount，正费率需要合适的已初始化代币账户；不是随便填一个SOL钱包地址。/order与/build收费模式不同，不能混用参数和收入假设。
当前项目使用V0，其1232字节限制仍必须实际检查；当前Solana文档也区分V1的4096字节，不能说所有版本永远1232或盲目升级现有SDK/钱包。
maxAccounts24/32和onlyDirectRoutes都不保证组合交易可用。要序列化完整交易、检查所有账户/计算预算/ALTs/费用/最低到账并实际模拟。固定过低账户数还可能无路由或价格更差。
两步交易不是原子交易。第一步成功、第二步失败时，用户仍持有中间资产，而且第一步费用可能已收。须保存签名与实际净到账，查清未知结果后再处理；重新报价，允许保留中间资产，不自动重复扣费或自动反向兑换。
来源：
- https://developers.jup.ag/docs/guides/how-to-build-a-custom-swap-with-metis
- https://developers.jup.ag/docs/swap/build
- https://developers.jup.ag/docs/api-reference/swap/build
- https://developers.jup.ag/docs/swap/v1/get-quote
- https://solana.com/docs/core/transactions/versioned-transactions
- https://solana.com/docs/core/constants-reference

## 5. 扫描器建议应如何修正
采纳研究方向：同时查看费用/交易量多窗口、口径和领取时间；增加获客/流动性冷启动成本、替代品与需求验证；扩展公开悬赏和许可审查。
不采纳机械规则：费用/交易量>5%不能直接判高税或骗局；衰退也不自动证明聚合终端值得做。扣30分、系数2.5和两个不同的0.20/0.25阈值都未校准，只能作为待验证启发式，不能覆盖证据门槛。
当前本地BUSINESS_ASSESSMENT_20261018.json中StonkFun是score_lower0/upper100、coverage0、build_eligible=false，缺需求/付费/渠道证据，并非80/80满分。StonkLaunch源自用户明确指定开发，不代表扫描器已证明盈利。
Superteam官方Agent端点同时覆盖AGENT_ALLOWED和AGENT_ONLY，不是只看AGENT_ONLY。扩展普通列表有意义，但奖金关键词不能替代报名资格、截止时间、AI规则与最终提交授权。
Covenant官方仓库确实展示MIT许可，但“零依赖”不能直接接受：同README的启动命令明确安装ethers、better-sqlite3、@x402/core。涉及密钥代理/服务端钱包的代码更需审计，不能看到MIT就直接导入。链上刷量指控本轮未验证，不采用。
来源：
- https://superteam.fun/earn/agents
- https://github.com/covenantx402/covenant
未取得DoraHacks指定活动详情，不将它列为当前可报名悬赏。

## 6. 本轮决定
不按引用补丁立即180度转向“高收益狙击终端”，不新增0.8%收费，不引入虚假回本数字。
优先验证更稳妥的产品假设：面向现有池的成本/权限/真实派发透明工具，降低新发射台招商的依赖；发行能力保留为可选功能。是否开启真实Zap交易，必须先证实具体mint与路由支持、净成本优势、失败恢复和获客入口。
现有首页已是发现页，而非单一发币表单；外部只读发现已存在。上述判断不等于税务看板、Zap或全网16万币覆盖已经实现。
