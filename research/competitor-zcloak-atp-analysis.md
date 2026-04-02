# 竞品深度分析：zCloak Network / Agent Trust Protocol (ATP)

> **文档类型**: 竞品分析与竞合策略  
> **日期**: 2026-04-03  
> **竞品**: zCloak Network (Agent Trust Protocol)  
> **创始人**: @xiao_zcloak (0xFrancis / Xiao Zhang)  
> **融资**: $5.8M (2022)  
> **相关文档**: [Dorsey 对齐验证](./external-validation-jack-dorsey-alignment.md)

---

## 目录

1. [zCloak 核心产品解析](#1-zcloak-核心产品解析)
2. [技术架构对比](#2-技术架构对比)
3. [差异化定位分析](#3-差异化定位分析)
4. [竞合策略建议](#4-竞合策略建议)
5. [X 互动模板](#5-x-互动模板)

---

## 1. zCloak 核心产品解析

### 1.1 项目背景

```
 evolution路径：
ZKP 隐私计算 (2022, $5.8M融资)
    ↓
AI-native 信任层 (2024+)
    ↓
Agent Trust Protocol (ATP) — 现在
```

**核心理念**：把 ZKP + 加密身份的技术扩展到 AI Agent 时代，让 Agent 成为"自主经济实体"。

### 1.2 Agent Trust Protocol (ATP) 四支柱

```
ATP Framework:
├── Identity（身份）
│   ├── AI-ID: Agent 的加密身份
│   └── AI-Name: 人类可读的永久链上名字
│
├── Accountability（问责）
│   ├── 所有动作必须签名
│   ├── 归属到 AI-ID（不可否认）
│   └── 不可变 ledger 记录
│
├── Privacy（隐私）
│   ├── ZKP 选择性披露（证明而不暴露）
│   └── VetKey 端到端加密
│
└── Security（安全）
    ├── 常规任务：Agent 自主执行
    └── 重大操作：人类生物识别确认
```

### 1.3 三层架构

| 层级 | 技术实现 | 功能 |
|------|---------|------|
| **Protocol Layer** | ATP 规范 | 定义规则：身份、签名、验证、声誉 |
| **Data Plane** | Internet Computer (ICP) | VetKey 加密 + ZKP 计算 + 链上持久化 |
| **Services** | 上层应用 | Keychain、AI-ID、AI-Name、发现平台 |

### 1.4 关键技术创新

```
VetKey (ICP 阈值加密):
├── 端到端加密消息
├── 加密存储
└── 无需信任单一节点

ZKP (零知识证明):
├── 证明某些属性
├── 不暴露底层数据
└── 合规友好

AI-Name:
├── 人类可读的永久名字
├── 绑定 AI-ID
└── 类似 ENS，但为 Agent 设计
```

---

## 2. 技术架构对比

### 2.1 全景对比表

| 维度 | Gradience | zCloak ATP | 评估 |
|------|-----------|------------|------|
| **核心目标** | Agent 自主竞争、结算、声誉 | Agent 身份、隐私、问责、安全 | 高度重合：都是"信任基础设施" |
| **信任机制** | Escrow + Judge + Reputation | Identity + Accountability + Privacy + Security | 互补：你重"结果"，他重"过程" |
| **验证方式** | Battle 对战（市场验证） | ZKP 证明（密码学验证） | 差异：公开竞争 vs 隐私保护 |
| **结算机制** | 链上 Escrow + 自动结算 | 金融 OS（支付、多签、合规） | 差异：协议层 vs 应用层 |
| **经济模型** | 任务竞价 + 声誉借贷 | 金融操作 + 合规 Treasury | 差异：去中心化市场 vs 机构金融 |
| **极简程度** | ~300 行，不可升级 | 模块化协议 + ICP 生态 | 差异：Bitcoin 极简 vs 企业级灵活 |
| **底层链** | Solana | Internet Computer (ICP) | 不同生态，可跨链互操作 |
| **隐私策略** | 未强调（公开竞争） | 核心卖点（ZKP + VetKey） | 差异：透明市场 vs 隐私协作 |
| **当前状态** | Agent Arena MVP Live | ATP 白皮书 + AI-Name 注册 | 都在早期，窗口期重叠 |

### 2.2 架构图对比

**Gradience 架构:**
```
User Agent
    ↓
Agent Arena (Solana)
├── Escrow: 资金托管
├── Judge: 结果评判
└── Reputation: 声誉积累
    ↓
Chain Hub (工具层)
    ↓
A2A Protocol (网络层)
```

**zCloak ATP 架构:**
```
User / Agent
    ↓
ATP Protocol (ICP)
├── Identity: AI-ID / AI-Name
├── Privacy: ZKP + VetKey
└── Security: 访问控制
    ↓
Financial OS (支付/多签/合规)
    ↓
zCloak.Money (DeFi 集成)
```

### 2.3 技术栈对比

| 组件 | Gradience | zCloak |
|------|-----------|--------|
| 智能合约 | Solana Program (Rust) | ICP Canister (Motoko/Rust) |
| 身份标准 | ERC-8004 | ATP AI-ID |
| 加密方案 | 标准加密 | VetKey (阈值) + ZKP |
| 存储 | Arweave/Avail | ICP 链上存储 |
| 可扩展性 | Solana 高 TPS | ICP 无限计算 |
| 去中心化程度 | 高（Solana 验证者）| 高（ICP 子网）|

---

## 3. 差异化定位分析

### 3.1 核心差异：市场验证 vs 身份隐私

```
场景："证明这个 Agent 值得信赖"

Gradience 方式:
"让它参与 100 个任务，看胜率和对战结果"
├── 公开透明
├── 市场检验
└── 适合：需要客观能力的场景

zCloak 方式:
"让它提供 ZKP 证明：我有证书、无违规、有担保"
├── 隐私保护
├── 即时验证
└── 适合：需要合规隐私的场景
```

### 3.2 适用场景对比

| 场景 | 更适合 | 原因 |
|------|--------|------|
| 代码竞赛 | Gradience | 结果可量化，公开公平 |
| DeFi 策略 | Gradience | 收益可验证，市场检验 |
| KYC 合规 | zCloak | 隐私保护，选择性披露 |
| 医疗数据 | zCloak | 敏感信息不能公开 |
| 金融支付 | zCloak | 合规要求，多签安全 |
| 内容创作 | Gradience | 质量主观，竞争发现 |

### 3.3 竞争优势矩阵

```
                    高隐私需求
                         ↑
    医疗数据 ←─────── zCloak ───────→ 金融合规
                         │
    内容创作 ←─────── Gradience ─────→ 代码竞赛
                         ↓
                    高公开验证需求
```

### 3.4 竞争态势总结

```
Agent 信任基础设施赛道
├── 身份 + 隐私层：zCloak (ATP) ⭐
├── 市场 + 结算层：Gradience ⭐
├── 社交背书层：Universal Trust
└── 算法评估层：Helixa

关系：
zCloak ←── 可集成 ──→ Gradience
   ↓                  ↓
  ICP              Solana
 隐私验证          市场竞争
```

---

## 4. 竞合策略建议

### 4.1 战略定位：互补而非替代

**关键洞察:**
> Gradience 和 zCloak 不是零和竞争，而是**同一基础设施的不同层面**。

**类比:**
- zCloak = **身份层**（你是谁，你能做什么）
- Gradience = **市场层**（你做了什么，结果如何）

### 4.2 三种合作模式

#### 模式 A：技术集成（推荐）

```
Gradience Arena + zCloak ATP:

1. Agent 注册时:
   - 使用 zCloak AI-ID 作为身份
   - 可选：ZKP 证明资质（不暴露细节）

2. 任务竞争时:
   - 公开 Battle（Gradience）
   - 但 Agent 可选择隐私模式（zCloak）

3. 声誉积累时:
   - 链上 Reputation PDA（Gradience）
   + 可验证凭证（zCloak VC）
```

**价值:**
- Gradience 获得隐私能力
- zCloak 获得应用场景
- 双方共享用户基础

#### 模式 B：生态联盟

```
发起"Agent Trust Alliance":
├── 成员: Gradience + zCloak + Universal Trust + Helixa
├── 目标: 统一 Agent 声誉标准
├── 形式: 互认声誉数据，跨协议积分
└── 价值: 共同做大蛋糕，避免碎片化
```

#### 模式 C：保持差异（当前）

```
各自专注：
- zCloak: 企业级隐私合规场景
- Gradience: 去中心化市场场景

风险: 长期可能形成生态孤岛
```

### 4.3 短期行动建议

| 优先级 | 行动 | 目的 |
|--------|------|------|
| P0 | 发 X 与 @xiao_zcloak 互动 | 建立联系，展示差异化 |
| P0 | 在文档中提及 ATP 兼容性 | 为 future 集成留空间 |
| P1 | 研究 VetKey + ZKP 可行性 | 评估技术集成难度 |
| P1 | 分析 ICP <-> Solana 跨链 | 技术互通可能性 |
| P2 | 共同起草 Agent 声誉标准 | 行业话语权 |

### 4.4 长期战略

```
Scenario A: 合作主导
├── Gradience 成为 ATP 的"市场验证模块"
├── zCloak 成为 Gradience 的"隐私身份层"
└── 形成最强组合

Scenario B: 各自发展
├── Gradience: Solana 生态主导
├── zCloak: ICP 生态主导
└── 长期可能形成两个标准

Scenario C: 被整合
├── 大厂进入，收购/抄袭双方
└── 风险：窗口期有限
```

---

## 5. X 互动模板

### 5.1 首次互动（建立联系）

```
@xiao_zcloak 刚看到你对 Dorsey 文章的解读，完全同意。

"AI 需要信任基础设施" —— 这正是我们构建 @GradienceProto 的原因。

有趣的是，我们在用不同但互补的方式解决同一个问题：
- 你们：ZKP + AI-ID（身份隐私层）
- 我们：Escrow + Battle（市场验证层）

一个证明"你能做什么"，一个证明"你做了什么"。

期待交流，说不定能碰撞出集成方案 🙌
```

### 5.2 深入讨论（展示技术）

```
@xiao_zcloak 深度同意 ATP 的四支柱设计。

我们在 Solana 上构建了类似的信任层，但侧重"市场竞争验证"：

- Escrow: 资金托管防跑路
- Judge: 对战结果客观评分
- Reputation: 可验证工作历史

区别可能是：
- 你们 = 过程可信（ZKP 证明资质）
- 我们 = 结果可信（Battle 证明能力）

未来 Agent 经济可能需要两者：
先用 ATP 建立身份，再用 Gradience 建立声誉。

有兴趣探讨互操作性吗？
```

### 5.3 行业共建（联盟视角）

```
看到 @xiao_zcloak 的 ATP、@GradienceProto 的 Arena、还有 Universal Trust、Helixa...

Agent 信任基础设施的拼图正在形成：
- 身份层：ATP
- 市场层：Gradience
- 社交层：Universal Trust
- 评估层：Helixa

问题是：碎片化。

是否应该发起一个开放标准，让这些协议能互操作？
类似 ERC-8004，但更广泛。

@xiao_zcloak 怎么看？
```

---

## 6. 核心洞察总结

### 6.1 关键发现

1. **赛道验证**: zCloak 的 $5.8M 融资和 ATP 协议证明"Agent 信任基础设施"是**真实需求**

2. **差异化清晰**:
   - zCloak: **过程可信**（身份、隐私、合规）
   - Gradience: **结果可信**（竞争、评判、声誉）

3. **互补性强**: 理想状态下，Agent 先用 ATP 建立身份，再用 Gradience 证明能力

4. **窗口期有限**: 多个团队在同时构建，需加速主网上线

5. **潜在合作**: 技术集成 > 生态联盟 > 各自发展

### 6.2 战略建议

```
短期（1-3 月）:
├── 与 zCloak 建立联系
├── 在叙事中强调差异化
└── 加速 Agent Arena 主网

中期（3-6 月）:
├── 探索技术集成可行性
├── 参与/发起 Agent 标准讨论
└── 建立竞合关系

长期（6-12 月）:
├── 形成互补生态或明确差异化
├── 避免被大厂碎片化
└── 争取行业标准地位
```

---

## 参考链接

- zCloak Network: https://zcloak.network
- zCloak.AI: https://zcloak.ai
- ATP 白皮书: (需查找)
- @xiao_zcloak X: https://x.com/xiao_zcloak
- Gradience: https://github.com/DaviRain-Su/gradience
- Jack Dorsey 文章: 《From Hierarchy to Intelligence》

---

*最后更新: 2026-04-03*  
*建议行动: 立即与 @xiao_zcloak 建立联系，探讨合作可能性*
