# OWS Hackathon 2025 - 参赛规格说明书

## 活动信息

- **日期**: 2026年4月3日 (周五)
- **时间**: 9:00 AM EDT - 午夜
- **地点**: NYC · SF · Miami (或线上)
- **奖金**: $33,000 现金 + ~$20,000 积分
- **官网**: https://hackathon.openwallet.sh

---

## 赛道分析

### 5 个赛道 (Tracks)

| 赛道 | 主题 | 奖金 | 适合度 |
|------|------|------|--------|
| **01 The Network** | Agent-to-agent coordination (XMTP) | $3.5k/$2k/$1.1k | ⭐⭐⭐⭐⭐ **最佳匹配** |
| 02 The Exchange | Autonomous trading & markets | $3.5k/$2k/$1.1k | ⭐⭐⭐ |
| 03 The Grid | Cross-chain infrastructure | $3.5k/$2k/$1.1k | ⭐⭐⭐ |
| 04 The Commons | Group coordination & shared capital | $3.5k/$2k/$1.1k | ⭐⭐⭐⭐ |
| 05 The Observatory | Onchain intelligence & data | $3.5k/$2k/$1.1k | ⭐⭐ |

### 为什么选择 "The Network"?

**赛道描述**: Agent-to-agent coordination inspired by XMTP

**Building Opportunities**:
1. ✅ Agentic professional services (intake, negotiation, scheduling, billing)
2. ✅ P2P services marketplace (replace Upwork/Fiverr)
3. ✅ Open agent networks (hiring, travel, trading agents)
4. ✅ Personal coach agent (persistent relationship)
5. ✅ Accountability groups (goals tracked in XMTP group chats)
6. ✅ Payment coordination (Splitwise with stablecoins)
7. ✅ Creator communities (wallet-based fan identity)
8. ✅ Trustworthy reviews (tied to wallet identity)

**与 Gradience 的契合度**:
- ✅ 我们的 Agent 经济网络正是 "Agent-to-agent coordination"
- ✅ Gradience 的 Escrow + Reputation = "Trustworthy reviews tied to wallet"
- ✅ A2A Protocol = "Open agent networks"
- ✅ 5% fee vs 20-30% = "P2P services marketplace"

---

## 评判标准

### 核心要求

| 标准 | 权重 | Gradience 对应 |
|------|------|----------------|
| **Agent-native architecture** | 高 | ✅ 原生 Agent 协议设计 |
| **Real agent-to-agent coordination** | 高 | ✅ A2A Protocol + XMTP |
| **OWS for identity and credentials** | 高 | ✅ 整合 OWS Wallet |
| **MoonPay skills for payment** | 中 | ✅ MoonPay 技能集成 |
| **Not a chatbot wrapper** | 高 | ✅ 真正的经济协议 |

### Required Stack (必需技术栈)

```
✓ OWS CLI + at least one MoonPay agent skill
✓ XMTP for agent-to-agent messaging  
✓ OWS wallet for identity and credentials
```

---

## 开发规范分类

在我们的 7 阶段方法论中，这属于：

### 🏷️ **类型: 快速原型 / MVP Sprint**

**特征**:
- 时间: 1 天 (6 小时现场)
- 目标: 可演示的原型
- 范围: 核心功能子集
- 质量: "工作即可" (working demo)

### 📋 **开发流程调整**

标准 7 阶段需要压缩为 **6 小时冲刺**:

```
标准流程:        Hackathon 流程:
1. PRD     ──→   1. 概念定义 (30 min)
2. Arch    ──→   (跳过 / 口头)
3. Tech    ──→   2. 技术选型 (30 min)
4. Tasks   ──→   3. 任务拆分 (15 min)
5. Tests   ──→   (简化 / 手动测试)
6. Impl    ──→   4. 核心实现 (4 hours)
7. Review  ──→   5. Demo 准备 (1 hour)
```

---

## 参赛方案

### 项目名称
**"Gradience Agent Network with OWS"**

### 核心演示功能 (6小时内可完成)

1. **OWS Wallet 集成**
   - Agent 使用 OWS 钱包作为身份
   - 钱包地址 = Agent 身份标识

2. **XMTP 消息协调**
   - Agent 之间通过 XMTP 协商任务
   - 任务详情、报价、交付都在 XMTP 中

3. **Gradience 结算层**
   - 使用 Gradience Escrow 托管资金
   - Judge 评估后自动释放

4. **MoonPay 技能**
   - Agent 可以通过 MoonPay 将 crypto 转为 fiat
   - 或接收 fiat 支付

### 技术栈

```
Frontend: Next.js + OWS SDK
Messaging: XMTP
Wallet: OWS Wallet
Settlement: Gradience Protocol (Solana)
Fiat On/Off: MoonPay Agent Skill
```

---

## 提交要求

### 必需内容

- [ ] Demo 视频 (2-3 分钟)
- [ ] 代码仓库 (GitHub)
- [ ] 现场演示 (Miami/SF/NYC)
- [ ] 项目描述文档

### 评判展示重点

1. **Agent 使用 OWS Wallet 登录**
2. **Agent A 通过 XMTP 向 Agent B 发送任务请求**
3. **资金托管到 Gradience Escrow**
4. **任务完成后自动结算**
5. **Reputation 更新在链上**

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| OWS SDK 学习曲线 | 中 | 高 | 提前研究文档 |
| XMTP 集成复杂度 | 中 | 中 | 使用现有 SDK |
| 6小时时间不足 | 高 | 高 | 预写核心逻辑 |
| 现场演示失败 | 低 | 高 | 准备录屏备份 |

---

## 决策建议

### 参加建议: ⭐⭐⭐⭐⭐ 强烈推荐

**理由**:
1. **赛道匹配度极高** - The Network 完美契合 Gradience
2. **顶级合作伙伴** - MoonPay, PayPal, Ethereum Foundation
3. **奖金丰厚** - 即使第三名也有 $1,100
4. **品牌曝光** - 与顶级协议同场竞技
5. **技术互补** - OWS + XMTP + Gradience = 完整方案

### 参赛模式建议

**方案 A: 全力以赴** (推荐)
- 团队前往 Miami
- 6小时冲刺 + Demo
- 目标: 冲击第一名 $3,500

**方案 B: 线上参与**
- 远程提交
- 预录 Demo
- 风险: 现场演示优势缺失

---

## 下一步行动

1. **立即注册**: https://hackathon.openwallet.sh
2. **选择城市**: Miami (推荐) / SF / NYC / Online
3. **研究 OWS SDK**: https://github.com/open-wallet-standard/core
4. **准备代码框架**: 提前写好基础结构
5. **预订行程**: 机票 + 酒店 (如果去现场)

---

*Spec 版本: v1.0*  
*更新: 2026-04-03*
