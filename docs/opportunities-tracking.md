# 生态机会追踪文档

> 记录所有外部 Grant、Hackathon、合作伙伴机会及其进展

---

## 当前活跃机会

### 1. Beam Foundation Grant 🟡 高优先级

| 属性 | 详情 |
|------|------|
| **类型** | Grant (资助) |
| **金额** | 待定 (建议 $50k-$150k) |
| **状态** | 已准备申请材料，待提交 |
| **截止日期** | 滚动申请 |
| **文档** | [beam-grant-application.md](/docs/grants/beam-grant-application.md) |

**核心定位**:  
"为 Beam 游戏生态提供 AI Agent 经济基础设施"

**关键叙事**:
- 游戏开发者发布 AI 任务 → Agent 竞争 → 链上结算
- 5% 费率 vs Virtuals 20-30%
- 无需许可、链上声誉、技能可交易

**下一步**:
- [ ] 填写具体预算金额
- [ ] 补充团队背景信息
- [ ] 寻找 1-2 个 Beam 游戏合作伙伴
- [ ] 联系 Beam 生态负责人 (Discord/Twitter)
- [ ] 提交申请

---

### 2. OWS (Open Wallet Standard) Hackathon 🔴 紧急

| 属性 | 详情 |
|------|------|
| **类型** | Hackathon (6小时) |
| **日期** | 2026年4月3日 (周五) 12:00 PM - 6:00 PM |
| **地点** | The LAB Miami, Florida |
| **奖金** | $30,000+ |
| **注册链接** | https://hackathon.openwallet.sh |
| **状态** | 待注册 |

**主办方**: MoonPay, Solana, Base, x402, DFlow, Zo Computer, Circle

**主题**:  
让 AI Agent 能够安全持有支付能力、在策略控制下操作、并为工具/服务付费

**我们的方案**: "Reputation-Powered Agent Wallet"
- 将 OWS 钱包与 Gradience 声誉系统结合
- Agent 通过完成任务建立信用
- 支持基于声誉的预支额度
- 多 Agent 协作 + 自动分账

**技术集成**:
- OWS SDK: https://openwallet.sh/
- x402: HTTP 微支付
- MCP: Agent 工具协议

**下一步** (紧急):
- [ ] 立即注册 Hackathon
- [ ] 研究 OWS SDK 文档
- [ ] 确定参加人员 (需要前往 Miami)
- [ ] 准备代码框架和演示脚本
- [ ] 联系主办方 Halsey 预热

---

## 机会优先级矩阵

```
重要性 ↑
    │
 高 │  [Beam Grant]    [OWS Hackathon]
    │     🟡 长期资金      🔴 紧急曝光
    │     高影响力         6天内发生
    │
 中 │
    │
 低 │
    └────────────────────────────────→ 紧急性
         低              中            高
```

---

## 资源准备清单

### 通用材料
- [x] 项目白皮书 (WHITEPAPER.md)
- [x] 协议设计文档
- [x] GitHub 仓库
- [ ] 2-3 分钟演示视频
- [ ] 团队介绍资料
- [ ]  pitch deck (10-15页)

### Beam Grant 专用
- [x] Grant 申请文档 (英文)
- [ ] 具体预算表
- [ ] 里程碑详细规划
- [ ] 游戏合作伙伴确认函

### OWS Hackathon 专用
- [ ] OWS SDK 调研笔记
- [ ] 技术集成方案文档
- [ ] 演示代码框架
- [ ] 现场演示脚本

---

## 联系人记录

| 姓名/组织 | 平台 | 状态 | 备注 |
|-----------|------|------|------|
| Halsey huth | Luma/Twitter | 待联系 | OWS Hackathon 主办方 |
| Beam 生态团队 | Discord | 待联系 | 寻找合作伙伴 |
| MoonPay | Hackathon | 待接触 | 主办方之一 |
| Solana 团队 | Hackathon | 待接触 | 已有合作关系 |

---

## 决策记录

### 2026-04-03: 关于 OWS Hackathon

**讨论**:
- Hackathon 主题 (Agent 支付) 与 Gradience 高度契合
- 6小时时间很短，但有已有基础 (Agent Layer + Chain Hub)
- 需要前往 Miami，团队资源是否允许？

**待决策**:
- [ ] 是否参加？
- [ ] 谁去？
- [ ] 选择哪个技术方案 (A/B/C)?

---

## 相关链接

### 项目文档
- 白皮书: [protocol/WHITEPAPER.md](/protocol/WHITEPAPER.md)
- 协议方 Agent 模型: [protocol/design/protocol-provider-agent-model.md](/protocol/design/protocol-provider-agent-model.md)
- Beam Grant 申请: [beam-grant-application.md](/docs/grants/beam-grant-application.md)

### 外部资源
- Beam Grant: https://grants.onbeam.com/
- OWS Hackathon: https://hackathon.openwallet.sh/
- OWS 标准: https://openwallet.sh/
- MCP 协议: https://modelcontextprotocol.io/

---

*最后更新: 2026-04-03*  
*下次回顾: 2026-04-04 (Hackathon 后)*
