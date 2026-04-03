# OWS Hackathon - 技术规格说明书

## 技术整合架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Gradience + OWS Integration              │
├─────────────────────────────────────────────────────────────┤
│  User Layer                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ OWS Wallet  │  │ XMTP Client │  │ Gradience Frontend  │ │
│  │  (Identity) │  │ (Messaging) │  │    (Settlement)     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
├─────────┼────────────────┼─────────────────────┼────────────┤
│         │                │                     │            │
│  Agent Layer                                                │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐ │
│  │              Agent Core (Node.js/TS)                   │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │ │
│  │  │ OWS Skill  │ │ XMTP Skill │ │ MoonPay Skill      │  │ │
│  │  │ (Identity) │ │ (Messaging)│ │ (Fiat On/Off Ramp) │  │ │
│  │  └────────────┘ └────────────┘ └────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                  │
├──────────────────────────┼──────────────────────────────────┤
│                          │                                  │
│  Settlement Layer                                         │
│  ┌───────────────────────┴──────────────────────────────┐  │
│  │           Gradience Protocol (Solana)                 │  │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐   │  │
│  │  │   Escrow   │ │ Reputation │ │  Judge System   │   │  │
│  │  │  Contract  │ │  Contract  │ │                 │   │  │
│  │  └────────────┘ └────────────┘ └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心集成点

### 1. OWS Wallet 集成

**用途**: Agent 身份认证和签名

```typescript
// Agent 使用 OWS Wallet 作为身份
import { OWSWallet } from '@open-wallet-standard/sdk';

class GradienceAgent {
  wallet: OWSWallet;
  xmtpClient: XMTPClient;
  
  constructor() {
    // OWS Wallet 作为 Agent 身份
    this.wallet = new OWSWallet();
    this.agentId = this.wallet.address;
  }
  
  async signTaskAgreement(task: Task) {
    // 使用 OWS Wallet 签名任务协议
    return this.wallet.signMessage(task.hash);
  }
}
```

### 2. XMTP 消息层

**用途**: Agent 之间协商任务

```typescript
// Agent 通过 XMTP 发现对方并协商
import { Client } from '@xmtp/xmtp-js';

class AgentMssaging {
  async discoverAndNegotiate(targetAgentId: string) {
    // 通过 XMTP 发送任务请求
    const conversation = await this.xmtp.conversations.newConversation(
      targetAgentId
    );
    
    await conversation.send(JSON.stringify({
      type: 'TASK_REQUEST',
      task: {
        description: 'Create a landing page',
        budget: 500,
        deadline: '2026-04-10'
      }
    }));
  }
}
```

### 3. Gradience 结算层

**用途**: 资金托管和自动结算

```typescript
// 托管资金到 Gradience Escrow
import { GradienceSDK } from '@gradiences/sdk';

class AgentSettlement {
  async escrowFunds(taskId: string, amount: number) {
    // 创建托管任务
    const escrow = await this.gradience.createTask({
      title: 'Agent Task',
      reward: amount,
      judges: [this.judgeAgentId],
      agents: [this.workerAgentId],
      token: 'USDC'
    });
    
    // 存入资金
    await escrow.deposit(amount);
  }
}
```

### 4. MoonPay 技能

**用途**: Fiat 进出通道

```typescript
// Agent 使用 MoonPay 技能处理 fiat
import { MoonPaySkill } from '@open-wallet-standard/moonpay';

class AgentPayment {
  async onRampCrypto(amount: number) {
    // Agent 通过 MoonPay 将 fiat 转为 crypto
    return this.moonpay.buy({
      amount,
      currency: 'USDC',
      walletAddress: this.wallet.address
    });
  }
}
```

---

## 6 小时开发计划

### Hour 1: 基础设置 (9:00-10:00)

```
30 min - OWS SDK 集成
  - 初始化 OWS Wallet
  - 获取 Agent 身份

30 min - XMTP 客户端
  - 建立消息连接
  - 测试点对点通信
```

### Hour 2-3: 核心功能 (10:00-12:00)

```
60 min - Gradience 集成
  - 连接 Solana
  - 创建托管任务
  - 测试存款/提款

60 min - Agent 协调流程
  - Agent A 发现 Agent B
  - XMTP 协商任务
  - 达成共识后创建托管
```

### Hour 4: MoonPay 集成 (12:00-13:00)

```
60 min - Fiat 技能
  - 集成 MoonPay skill
  - 测试 crypto <-> fiat 转换
  - 展示完整资金流程
```

### Hour 5: UI 与演示 (13:00-14:00)

```
60 min - 演示界面
  - Agent 状态看板
  - 任务流程可视化
  - 钱包余额显示
```

### Hour 6: 测试与 Demo (14:00-15:00)

```
30 min - 端到端测试
  - Agent A 发布任务
  - Agent B 接受
  - 完成并结算

30 min - Demo 录制
  - 2-3 分钟展示视频
  - 准备现场演示
```

---

## 代码结构

```
ows-hackathon/
├── packages/
│   ├── agent-core/          # Agent 核心逻辑
│   ├── ows-adapter/         # OWS Wallet 适配器
│   ├── xmtp-adapter/        # XMTP 消息适配器
│   ├── gradience-sdk/       # Gradience 结算 SDK
│   └── moonpay-skill/       # MoonPay 技能
├── apps/
│   └── demo-ui/             # 演示界面
├── demo/
│   └── scenario.ts          # 演示剧本
└── README.md
```

---

## Demo 场景

### 场景: "AI 开发者雇佣设计师 Agent"

**角色**:
- **Client Agent** (使用 OWS Wallet 的 AI 助手)
- **Designer Agent** (提供设计服务的 Agent)

**流程**:

1. **Discovery** (发现)
   ```
   Client Agent 通过 XMTP 发现 Designer Agent
   ```

2. **Negotiation** (协商)
   ```
   XMTP 对话:
   - Client: "需要一个 landing page，预算 $500"
   - Designer: "可以，3天交付，需要50%预付"
   - Client: "同意"
   ```

3. **Escrow** (托管)
   ```
   Client Agent 通过 Gradience 创建托管:
   - 存入 $500 USDC
   - Judge: 自动代码检查 Agent
   - 条件: 交付验收后释放
   ```

4. **Execution** (执行)
   ```
   Designer Agent 完成工作
   提交交付物到 IPFS
   ```

5. **Settlement** (结算)
   ```
   Judge Agent 验证交付物
   调用 Gradience 释放资金
   Designer Agent 收到 $500
   ```

6. **Reputation** (声誉)
   ```
   双方互评
   Reputation 更新在链上
   ```

---

## 技术风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| OWS SDK 不稳定 | 准备 fallback 方案 (直接用钱包地址) |
| XMTP 连接失败 | 使用本地 mock 演示 |
| Solana 网络延迟 | 使用 devnet，预存测试资金 |
| 时间不够 | 专注核心流程，砍掉边缘功能 |

---

## 评判展示清单

演示时必须展示:

- [ ] **OWS Wallet** 登录/身份
- [ ] **XMTP** Agent 间实时通信
- [ ] **Gradience** 资金托管和结算
- [ ] **MoonPay** 技能调用 (可选)
- [ ] **Agent-native** 架构 (不是聊天机器人)
- [ ] **Working demo** 端到端流程

---

## 下一步

1. 确认参赛 (今天截止)
2. 设置开发环境
3. 预研 OWS SDK
4. 编写基础代码框架

*Tech Spec 版本: v1.0*  
*更新: 2026-04-03*
