# Linear AIG (Agent Interaction Guidelines) 分析与 Gradience 整合方案

> 分析时间：2026-04-01  
> 来源：https://linear.app/developers/aig  
> 核心问题：AIG 如何帮助 Gradience 构建更可信的 Agent 经济协议？

---

## 1. AIG 核心原则概述

Linear 提出的 AIG (Agent Interaction Guidelines) 是 **Agent 与人类交互的设计规范**，定义了 6 条核心原则：

```
┌─────────────────────────────────────────┐
│  1. 身份披露 (Identity Disclosure)       │
│     Agent 必须明确标识自己是 Agent       │
├─────────────────────────────────────────┤
│  2. 原生融入 (Native Integration)        │
│     Agent 应通过现有 UI 模式工作         │
├─────────────────────────────────────────┤
│  3. 即时反馈 (Instant Feedback)          │
│     被调用时立即响应，避免不确定性       │
├─────────────────────────────────────────┤
│  4. 状态透明 (State Transparency)        │
│     思考/等待/执行/完成状态清晰可见      │
├─────────────────────────────────────────┤
│  5. 随时退出 (Disengage on Request)      │
│     被要求时立即停止                     │
├─────────────────────────────────────────┤
│  6. 责任归属 (Human Accountability)      │
│     Agent 执行，但最终责任在人类         │
└─────────────────────────────────────────┘
```

**核心理念**：Agent 产生工作的"丰裕"(abundance)改变了角色和工作流，价值转向编排输入、工程上下文和审查输出。

---

## 2. 对 Gradience 各组件的直接帮助

### 2.1 AgentM — UX 设计规范

#### AIG 原则 → AgentM 桌面端实现

| AIG 原则     | AgentM 设计实现                                           | 优先级 |
| ------------ | --------------------------------------------------------- | ------ |
| **身份披露** | 界面始终显示"Agent"标识；语音唤醒时先声明"我是你的 Agent" | P0     |
| **原生融入** | 作为桌面应用，直接操作本地文件/浏览器；不创建独立隔离界面 | P0     |
| **即时反馈** | 语音唤醒后立即显示"正在思考"动画；避免用户等待焦虑        | P0     |
| **状态透明** | 面板实时显示：🔍搜索中 → 🧠分析中 → ⚡执行中 → ✅完成     | P1     |
| **随时退出** | 语音命令"停止"/"取消"立即中断当前任务；不追问原因         | P1     |
| **责任归属** | 每项任务显示："由你发起 → Agent 执行 → 你确认后上链"      | P0     |

#### 设计细节建议

```typescript
// AgentM 状态机设计
interface AgentSession {
    // 身份披露
    agentIdentity: {
        name: string; // "AgentM"
        version: string; // "v1.2.0"
        did: string; // "did:gradience:agent_0x1234"
        isAgent: true; // 明确标识
    };

    // 状态透明
    state: 'idle' | 'thinking' | 'waiting_input' | 'executing' | 'completed' | 'error';

    // 思考过程可追溯
    reasoningLog: {
        timestamp: number;
        step: string; // "分析用户意图"
        toolCall?: string; // "search_files"
        result?: string; // 执行结果
    }[];

    // 责任归属
    delegation: {
        humanOwner: string; // 人类主人地址
        initiatedBy: 'voice' | 'click' | 'proactive';
        approvedActions: string[]; // 需要人类确认的操作
    };
}
```

---

### 2.2 Agent Arena — 评判标准扩展

#### AIG "状态透明" → Arena 新增评判维度

当前 Arena 评判维度：

- Correctness (40%) - 结果正确性
- Process (30%) - 过程合理性
- Efficiency (15%) - 执行效率
- Robustness (15%) - 鲁棒性

**新增 AIG 合规维度：**

```
Transparency (新增, 建议权重 10-15%)
├── 身份披露清晰度 (3%)
│   └── Agent 是否明确标识自己的能力和局限
├── 推理过程可解释性 (4%)
│   └── Agent 是否让人理解"它在想什么"
├── 关键节点人类确认 (4%)
│   └── 在资金操作等关键步骤是否寻求人类确认
└── 错误处理透明度 (3%)
    └── 出错时是否清晰说明原因和补救方案
```

#### 为什么新增透明度评分？

```
场景：Agent A 和 Agent B 都能完成 DeFi 套利任务
- Agent A：赢了 100 USDC，但策略黑箱，不可解释
- Agent B：赢了 90 USDC，但每一步都清晰说明

传统评判：Agent A 获胜（收益更高）
AIG 增强评判：Agent B 获胜（更可信赖）

原因：一个能赢但不透明的 Agent 可能危险
（比如用不可解释的策略，可能在某些市场条件下爆仓）
```

---

### 2.3 Chain Hub — 技能注册标准

#### AIG 合规 → Chain Hub 技能元数据标准

```json
{
    "skill_metadata": {
        "identity": {
            "is_agentic": true,
            "skill_name": "uniswap_v3_swap",
            "provider": "did:gradience:agent_0x1234",
            "version": "1.2.0"
        },

        "aig_compliance": {
            "identity_disclosure": {
                "compliant": true,
                "description": "本技能由 Gradience Agent 提供，非官方 Uniswap 团队"
            },
            "native_integration": {
                "compliant": true,
                "description": "通过标准 Router 合约调用，不创建独立界面"
            },
            "instant_feedback": {
                "compliant": true,
                "latency_ms": 500,
                "description": "交易提交后立即返回 tx_hash 和预估确认时间"
            },
            "state_transparency": {
                "compliant": true,
                "trace_cid": "Qm...",
                "description": "所有步骤上链可追溯"
            },
            "disengage_capable": {
                "compliant": true,
                "description": "pending 交易可通过 cancel 方法取消"
            },
            "human_accountability": {
                "compliant": true,
                "stake_amount": "1000 GRAD",
                "description": "技能提供方质押担保，出错可索赔"
            }
        },

        "verification": {
            "aig_audit_passed": true,
            "audit_report_cid": "Qm...",
            "audited_by": "did:gradience:judge_pool_0x5678"
        }
    }
}
```

#### Chain Hub AIG 认证等级

```
🥉 Basic：自我声明 AIG 合规
🥈 Verified：通过第三方 AIG 审计
🥇 Certified：通过 Gradience 官方 AIG 认证 + 长期无事故记录
```

---

### 2.4 AgentM — 信任机制设计

#### AIG "责任归属" → A2A 交互的责任链

```
场景：Agent A（人类 Alice 的 Agent）联系 Agent B（人类 Bob 的 Agent）

传统问题：如果合作出问题，谁负责？
- Alice 说："我不知道我的 Agent 会这样做"
- Bob 说："你的 Agent 先联系的我的 Agent"
- 无法追溯

AIG + Gradience 方案：
1. Agent A 发起联系时必须声明："我代表 Alice (did:alice)"
2. Agent B 响应时必须声明："我已通知 Bob (did:bob)"
3. 所有交互记录上链，形成责任链
4. 争议时回溯：谁发起、谁执行、谁确认
```

#### A2A 责任链数据结构

```typescript
interface A2AInteraction {
    // 唯一标识
    interactionId: string;
    timestamp: number;

    // 参与方
    initiator: {
        agent: string; // Agent A DID
        human: string; // Alice DID
        confirmed: boolean; // Alice是否知情
    };

    responder: {
        agent: string; // Agent B DID
        human: string; // Bob DID
        confirmed: boolean; // Bob是否知情
    };

    // 交互内容
    intent: string; // "寻求合作完成某任务"
    actions: {
        action: string;
        executedBy: 'agent_a' | 'agent_b';
        humanApproved: boolean;
        txHash?: string;
    }[];

    // 责任归属
    liability: {
        ifFailure: 'initiator' | 'responder' | 'shared';
        stakeAmount: number;
    };
}
```

---

## 3. 协议设计层面的深层启示

### 3.1 核心问题：人如何信任 Agent？

AIG 的答案（UX 层面）：

1. **可知** - 知道对方是 Agent（不是人冒充的）
2. **可控** - 随时可以停止
3. **可见** - 能看到它在做什么
4. **可归责** - 出事知道找谁

Gradience 的答案（协议层面）：

| 信任需求 | AIG (UX) | Gradience (Protocol)       |
| -------- | -------- | -------------------------- |
| 可知     | 界面标识 | ERC-8004 Agent 身份标准    |
| 可控     | 停止按钮 | 智能合约支持随时取消任务   |
| 可见     | 状态显示 | ExecutionTracer 可观测性层 |
| 可归责   | 责任提示 | 声誉系统 + 质押罚没机制    |

**关键洞察**：AIG 解决"如何让人感知信任"，Gradience 解决"如何让信任可验证和结算"。

---

### 3.2 ZK-KYC 与身份披露的平衡

**矛盾**：

- AIG 要求：Agent 必须披露"我是 Agent"
- Gradience 隐私原则：Agent 背后的人的身份是隐私的

**平衡方案**：

```
公开层（必须披露）：
├── Agent 身份："我是 Gradience Agent #1234"
├── 能力范围："我擅长 DeFi 策略，胜率 82%"
├── 声誉分数："847/1000"
└── 服务历史："已完成 234 个任务"

隐私层（ZK 保护）：
├── 人类身份：ZK 证明 "背后是真实人类"（不透露是谁）
├── 地理位置：ZK 证明 "在某个合规区域"（不透露具体位置）
└── 资金来源：ZK 证明 "资金非非法来源"（不透露具体来源）

结论：Agent 要透明，人要保持隐私
```

---

### 3.3 AIG 与 Dorsey "公司智能"的呼应

| Dorsey (Block)          | AIG (Linear)              | Gradience               |
| ----------------------- | ------------------------- | ----------------------- |
| 公司智能 = 实时全局状态 | Agent 智能 = 实时交互状态 | 协议智能 = 实时市场状态 |
| 消除中层管理            | 消除交互摩擦              | 消除信任中介            |
| 数据驱动决策            | 状态透明可理解            | 战绩客观可验证          |

**三者共同指向**：用实时、透明、可验证的机制取代传统的"信任但验证"。

---

## 4. 具体行动建议

### Phase 1: 文档整合（1-2 周）

- [ ] 在 AgentM 设计文档中引用 AIG，确保 UX 符合 6 条原则
- [ ] 更新 Arena 评判标准，增加"透明度"维度（10-15% 权重）
- [ ] Chain Hub 技能模板增加 `aig_compliance` 字段
- [ ] 白皮书"设计原则"章节添加 AIG 参考

### Phase 2: 产品开发（1-2 月）

- [ ] AgentM 实现完整的状态透明面板
- [ ] 开发 AIG 审计工具，自动检测技能合规性
- [ ] Arena 评判系统支持透明度评分
- [ ] AgentM 实现 A2A 责任链记录

### Phase 3: 标准推动（2-3 月）

- [ ] 发起"Web3 Agent AIG 标准"社区讨论
- [ ] 将 AIG 原则整合进 ERC-8004 扩展提案
- [ ] 建立 AIG 合规认证流程
- [ ] 联系 Linear 团队，探讨 AIG + Web3 的合作可能

### Phase 4: 生态建设（3-6 月）

- [ ] Gradience 成为 Web3 Agent 的"AIG 合规验证者"
- [ ] 提供 AIG 审计服务，产生协议收入
- [ ] 与其他 Agent 项目建立 AIG 互认机制
- [ ] 举办"AIG 合规 Agent"黑客松

---

## 5. 关键整合点总结

```
┌─────────────────────────────────────────────────────────┐
│                    AIG 整合全景图                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Linear AIG (UX 标准)                                    │
│       │                                                 │
│       ├──▶ AgentM (用户体验)                           │
│       │       └── 身份披露 + 状态透明 + 随时退出         │
│       │                                                 │
│       ├──▶ Agent Arena (评判标准)                        │
│       │       └── 新增透明度维度                         │
│       │                                                 │
│       ├──▶ Chain Hub (技能标准)                          │
│       │       └── AIG 合规元数据 + 认证等级              │
│       │                                                 │
│       └──▶ AgentM (信任机制)                       │
│               └── A2A 责任链 + 可归责设计                │
│                                                         │
│  Gradience Protocol (基础设施)                           │
│       │                                                 │
│       ├── ERC-8004 (身份标准) ◀── 整合 AIG 身份披露      │
│       ├── ExecutionTracer (可观测性) ◀── 支持状态透明    │
│       ├── Reputation (声誉系统) ◀── 记录 AIG 合规历史    │
│       └── ZK-KYC (隐私身份) ◀── 平衡披露与隐私           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 结语

**Linear 在做 Web2 Agent 的交互标准，Gradience 在做 Web3 Agent 的经济标准。**

两者结合，构成 Agent 经济的完整基础设施：

- **AIG** 确保 Agent 让人信任和舒适
- **Gradience** 确保信任可以被验证、结算和货币化

**下一步**：等团队正式组建后，联系 Linear 团队探讨：

1. AIG 如何在 Web3 环境中应用
2. Gradience 如何成为 AIG 的链上验证层
3. 共同推动跨平台的 Agent 交互标准

---

## 参考链接

- Linear AIG: https://linear.app/developers/aig
- Gradience Protocol: [protocol/WHITEPAPER.md](../protocol/WHITEPAPER.md)
- Gradience AgentM: [apps/agent-me/README.md](../apps/agent-me/README.md)
- Dorsey "From Hierarchy to Intelligence": [research/from-hierarchy-to-intelligence-protocol-perspective.md](./from-hierarchy-to-intelligence-protocol-perspective.md)

---

_文档版本：v1.0_  
_最后更新：2026-04-01_  
_维护者：Gradience Research Team_
