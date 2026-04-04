# Workflow 功法库设计：Chain Hub 上的 Agent 经济操作系统

> **文档类型**: 核心产品设计  
> **日期**: 2026-04-03  
> **核心概念**: Workflow = 可组合、可交易的 Agent 技能秘籍  
> **愿景**: 从信任基础设施 → Agent 经济操作系统

---

## 执行摘要

**核心创新**: Chain Hub + Workflow 系统 = Agent 经济的"功法库"

```
《剑来》比喻:
├── 功法 = Workflow (可组合的多链操作)
├── 功法库 = Workflow Marketplace (买卖交易平台)
├── 弟子修炼 = Agent 执行 (自动运行功法)
└── 功法交易 = 创作者经济 (Escrow + Judge + Reputation)
```

**玩法打开**:
- 普通用户: "买现成秘籍"让 Agent 自动赚钱
- 高手: "自创功法"卖给别人
- Agent: Agent-to-Agent 自动交易 Workflow

---

## 1. 核心架构

### 1.1 三层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Workflow Marketplace (功法库)                         │
│  ├── 创建 Workflow                                             │
│  ├── 买卖交易 (Escrow + Judge + Reputation)                    │
│  ├── 租赁/订阅                                                  │
│  └── 评价/评分                                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 2: Workflow Engine (功法引擎)                            │
│  ├── 解析 Workflow JSON                                        │
│  ├── 条件分支 (DAG)                                            │
│  ├── 调用 Chain Hub Providers                                  │
│  └── Agent 授权执行                                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 1: Chain Hub (多链基础设施)                              │
│  ├── Solana (核心) — Escrow + Judge + Reputation               │
│  ├── Tempo — MPP 流式支付                                      │
│  ├── X Layer — 零 Gas + TEE                                    │
│  ├── Sui — Agentic Commerce                                    │
│  └── NEAR — AI Intents                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
创建 Workflow:
用户编写 JSON → 本地测试 → 链上注册哈希 → Marketplace 上架

购买 Workflow:
浏览 Marketplace → 选择 Workflow → Escrow 支付 → 获得使用权 NFT

执行 Workflow:
Agent 加载 Workflow → Workflow Engine 解析 → 调用 Chain Hub → 多链执行

结算收益:
Workflow 产生收益 → 按预设规则分配 → 创作者/用户/Agent 分成
```

---

## 2. Workflow 数据结构

### 2.1 核心接口

```typescript
// Workflow 定义
interface GradienceWorkflow {
  // 基础信息
  id: string;                    // 链上 UUID (solana pubkey)
  name: string;                  // "高阶稳定币套利功法 v2"
  description: string;           // 详细描述
  author: string;                // 创作者地址
  version: string;               // 语义化版本
  
  // 执行逻辑
  steps: WorkflowStep[];         // 步骤数组
  dag?: WorkflowDAG;             // 条件分支 (可选)
  
  // 经济模型
  pricing: WorkflowPricing;      // 定价策略
  revenueShare: RevenueShare;    // 收益分配
  
  // 准入门槛
  requirements: {
    minReputation: number;       // 最低声誉要求
    zkProofs?: ZKRequirement[];  // ZK 证明要求
    tokens?: TokenRequirement[]; // 持仓要求
  };
  
  // 元数据
  isPublic: boolean;             // 公开/私有
  isTemplate: boolean;           // 是否模板
  tags: string[];                // 标签
  createdAt: number;
  updatedAt: number;
  
  // 链上验证
  contentHash: string;           // IPFS/Arweave 哈希
  signature: string;             // 作者签名
}

// 工作流步骤
interface WorkflowStep {
  id: string;
  name: string;                  // 步骤名称
  description?: string;
  
  // 链选择
  chain: SupportedChain;         // 'solana' | 'tempo' | 'xlayer' | 'sui' | 'near'
  
  // 操作类型
  action: WorkflowAction;
  
  // 参数
  params: ActionParams;
  
  // 条件执行
  condition?: StepCondition;     // 执行条件
  timeout?: number;              // 超时时间
  retries?: number;              // 重试次数
  
  // 下一步
  next?: string;                 // 成功后下一步 ID
  onError?: string;              // 失败后跳转到哪
}

// 支持的操作类型
type WorkflowAction =
  // 交易类
  | 'swap'                       // DEX 兑换
  | 'bridge'                     // 跨链桥接
  | 'transfer'                   // 转账
  | 'yieldFarm'                  // 流动性挖矿
  | 'stake'                      // 质押
  | 'unstake'                    // 解质押
  
  // 支付类
  | 'x402Payment'               // Sui x402 支付
  | 'mppStreamReward'           // Tempo MPP 流式奖励
  | 'teePrivateSettle'          // X Layer TEE 隐私结算
  | 'zeroGasExecute'            // X Layer 零 Gas 执行
  
  // 身份类
  | 'zkProveIdentity'           // ZK 身份验证
  | 'zkProveReputation'         // ZK 声誉证明
  | 'verifyCredential'          // 验证凭证
  
  // AI 类
  | 'nearIntent'                // NEAR 意图执行
  | 'aiAnalyze'                 // AI 分析
  | 'aiDecide'                  // AI 决策
  
  // 工具类
  | 'httpRequest'               // HTTP 调用
  | 'wait'                      // 等待
  | 'condition'                 // 条件判断
  | 'parallel'                  // 并行执行
  | 'loop';                     // 循环

// 条件分支 DAG
interface WorkflowDAG {
  nodes: WorkflowStep[];
  edges: {
    from: string;
    to: string;
    condition?: string;          // 条件表达式
  }[];
}

// 定价策略
interface WorkflowPricing {
  model: 'oneTime' | 'subscription' | 'perUse' | 'free';
  
  // 一次性购买
  oneTimePrice?: {
    token: string;               // 代币地址
    amount: BN;                  // 价格
  };
  
  // 订阅
  subscription?: {
    token: string;
    amountPerPeriod: BN;
    period: 'day' | 'week' | 'month';
  };
  
  // 按次付费
  perUsePrice?: {
    token: string;
    amount: BN;
  };
  
  // 免费但抽成
  revenueShare?: {
    creatorShare: number;        // 创作者分成比例 (bps)
    protocolShare: number;       // 协议分成 (固定 2%)
  };
}

// 收益分配
interface RevenueShare {
  // Workflow 执行产生的收益如何分配
  creator: number;               // 创作者 (如 30%)
  user: number;                  // Workflow 使用者 (如 60%)
  agent: number;                 // 执行 Agent (如 5%)
  protocol: number;              // 协议 (固定 2%)
  judge: number;                 // Judge (固定 3%)
}

// 支持的链
type SupportedChain = 
  | 'solana' 
  | 'tempo' 
  | 'xlayer' 
  | 'sui' 
  | 'near' 
  | 'ethereum'
  | 'arbitrum'
  | 'base';
```

### 2.2 Workflow 示例

```typescript
// 示例 1: 自动跨链套利功法
const arbitrageWorkflow: GradienceWorkflow = {
  id: 'workflow-arb-v2-7a3f',
  name: '跨链 USDC 套利功法 v2',
  description: '自动监控 Solana/Tempo/Sui USDC 价差，低买高卖',
  author: '0xTraderPro...',
  version: '2.0.0',
  
  steps: [
    {
      id: 'step1',
      name: '检查 Solana USDC 价格',
      chain: 'solana',
      action: 'httpRequest',
      params: {
        url: 'https://api.jupiter.ag/v4/price?id=USDC',
        method: 'GET'
      },
      next: 'step2'
    },
    {
      id: 'step2',
      name: '检查 Tempo USDC 价格',
      chain: 'tempo',
      action: 'httpRequest',
      params: {
        url: 'https://api.tempo.xyz/price/USDC',
        method: 'GET'
      },
      next: 'step3'
    },
    {
      id: 'step3',
      name: '比较价差',
      chain: 'solana',
      action: 'condition',
      params: {
        expression: '{{step1.price}} > {{step2.price}} * 1.005',
        trueAction: 'continue',
        falseAction: 'abort'
      },
      next: 'step4'
    },
    {
      id: 'step4',
      name: '在 Tempo 买入 USDC',
      chain: 'tempo',
      action: 'swap',
      params: {
        from: 'USDT',
        to: 'USDC',
        amount: '{{config.tradeAmount}}',
        slippage: 0.5
      },
      next: 'step5'
    },
    {
      id: 'step5',
      name: '跨链到 Solana',
      chain: 'tempo',
      action: 'bridge',
      params: {
        toChain: 'solana',
        token: 'USDC',
        amount: '{{step4.output}}'
      },
      next: 'step6'
    },
    {
      id: 'step6',
      name: '在 Solana 卖出 USDC',
      chain: 'solana',
      action: 'swap',
      params: {
        from: 'USDC',
        to: 'USDT',
        amount: '{{step5.output}}',
        slippage: 0.5
      },
      next: 'step7'
    },
    {
      id: 'step7',
      name: '隐私结算收益',
      chain: 'xlayer',
      action: 'teePrivateSettle',
      params: {
        recipient: '{{config.profitAddress}}',
        amount: '{{step6.output - config.tradeAmount}}'
      }
    }
  ],
  
  pricing: {
    model: 'revenueShare',
    revenueShare: {
      creatorShare: 500,
      protocolShare: 200
    }
  },
  
  revenueShare: {
    creator: 500,
    user: 8500,
    agent: 500,
    protocol: 200,
    judge: 300
  },
  
  requirements: {
    minReputation: 80,
    tokens: [
      { token: 'USDC', minAmount: '1000000000' }
    ]
  },
  
  isPublic: true,
  tags: ['arbitrage', 'cross-chain', 'usdc', 'advanced'],
  createdAt: Date.now(),
  contentHash: 'ipfs://QmXyz...',
  signature: '0x...'
};

// 示例 2: ZK KYC 隐私支付功法
const privacyWorkflow: GradienceWorkflow = {
  id: 'workflow-privacy-kyc-9b2e',
  name: 'ZK 隐私身份验证 + 支付',
  description: '证明 KYC 通过但不暴露身份，然后隐私支付',
  author: '0xPrivacyDev...',
  version: '1.0.0',
  
  steps: [
    {
      id: 'step1',
      name: 'ZK 证明 KYC 通过',
      chain: 'solana',
      action: 'zkProveIdentity',
      params: {
        prove: 'kycVerified',
        notReveal: ['name', 'passport', 'address']
      },
      next: 'step2'
    },
    {
      id: 'step2',
      name: '隐私结算',
      chain: 'xlayer',
      action: 'teePrivateSettle',
      params: {
        recipient: '{{task.winner}}',
        amount: '{{task.reward}}',
        hideAmount: true
      }
    }
  ],
  
  pricing: {
    model: 'perUse',
    perUsePrice: {
      token: 'USDC',
      amount: new BN(1000000)
    }
  },
  
  isPublic: true,
  tags: ['privacy', 'zk', 'kyc'],
  createdAt: Date.now(),
  contentHash: 'ipfs://QmAbc...',
  signature: '0x...'
};
```

---

## 3. Workflow Engine 实现

```typescript
class WorkflowEngine {
  private hub: GradienceChainHub;
  
  constructor(hub: GradienceChainHub) {
    this.hub = hub;
  }
  
  async execute(workflowId: string, agentId: string, userId: string): Promise<ExecutionResult> {
    // 1. 加载 Workflow
    const workflow = await this.loadWorkflow(workflowId);
    
    // 2. 检查权限
    await this.checkPermissions(workflow, userId);
    
    // 3. 执行步骤
    const results: StepResult[] = [];
    for (const step of workflow.steps) {
      const result = await this.executeStep(step, results);
      results.push(result);
      
      if (!result.success && step.onError) {
        // 错误处理
      }
    }
    
    // 4. 收益分配
    await this.distributeRevenue(workflow, results);
    
    return { success: true, results };
  }
  
  private async executeStep(step: WorkflowStep, previousResults: StepResult[]): Promise<StepResult> {
    // 获取 Provider
    const provider = this.hub.getProvider(step.chain);
    
    // 解析参数（模板替换）
    const params = this.parseParams(step.params, previousResults);
    
    // 执行
    const result = await provider.execute({
      type: step.action,
      payload: params
    });
    
    return {
      stepId: step.id,
      success: result.success,
      output: result.output,
      txHash: result.txHash,
      chain: step.chain
    };
  }
  
  private parseParams(params: any, results: StepResult[]): any {
    // 替换 {{stepX.output}} 模板变量
    if (typeof params === 'string') {
      return params.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, stepId, field) => {
        const result = results.find(r => r.stepId === stepId);
        return result?.output?.[field] || match;
      });
    }
    return params;
  }
}
```

---

## 4. Workflow Marketplace

### 4.1 核心功能

```typescript
interface WorkflowMarketplace {
  // 发布 Workflow
  publish(workflow: GradienceWorkflow): Promise<WorkflowId>;
  
  // 购买 Workflow
  buy(workflowId: string, payment: Payment): Promise<AccessNFT>;
  
  // 租赁 Workflow
  rent(workflowId: string, duration: Duration): Promise<RentalNFT>;
  
  // 评价 Workflow
  review(workflowId: string, score: number, comment: string): Promise<void>;
  
  // 浏览市场
  browse(filters: FilterOptions): Promise<WorkflowListing[]>;
}
```

### 4.2 交易闭环

```
卖家发布 Workflow
    ↓
链上注册哈希 + Escrow 托管
    ↓
买家支付 (95/3/2 分成)
    ↓
Judge/社区评分 (0-100)
    ↓
买家获得使用权 NFT
    ↓
可执行/可租赁/可 fork
```

---

## 5. X 宣传文案

### 主帖

```
Gradience 即将推出 Agent Workflow 功法库 🥋

什么是"功法"？
→ 可组合、可交易的多链 Agent 技能

比如：
• 自动跨链套利 (Sui→Tempo→Solana)
• ZK 隐私支付 (证明 KYC 不暴露身份)
• AI 自动收益最大化

在 Gradience：
• 高手创作功法 → 卖给他人
• 普通用户买功法 → Agent 自动执行
• Agent 之间 → 交易功法

内核依然是 Solana 极简 ~300 行代码
上层是无限扩展的 Agent 经济

这不再是信任基础设施
这是 Agent 经济操作系统

Coming soon to Chain Hub
```

### Thread

```
1/ 为什么 Agent 需要"功法"？

普通用户不懂：
• 哪个链 gas 最低？
• 哪个桥最快？
• ZK 怎么玩？

高手懂 → 打包成 Workflow → 卖出去
→ 这就是"功法库"的经济模型

2/ 功法 = JSON 配置文件

{
  name: "跨链套利 v2",
  steps: [
    { chain: "sui", action: "x402Payment" },
    { chain: "tempo", action: "mppStreamReward" },
    { chain: "solana", action: "jupiterSwap" },
    { chain: "xlayer", action: "teePrivateSettle" }
  ]
}

Agent 自动执行，用户零门槛

3/ 怎么交易？

Gradience kernel (Solana):
• Escrow 托管
• Judge 评分
• Reputation 累积

买卖Workflow和买卖任务一样安全

4/ 三种玩家

创作者：打包多链技能 → 赚钱
用户：买现成功法 → Agent 自动跑
Agent：Agent-to-Agent 交易

整个 Agent 经济被激活

5/ 技术极简

Solana kernel: ~300 行，不可变
Workflow Engine: TypeScript SDK
Marketplace: 链上哈希 + off-chain 执行

复杂在上层，核心极简

6/ 首批功法 (coming soon)

• 高阶稳定币套利
• ZK 隐私身份支付
• AI 自动收益最大化
• 跨链 NFT 批量操作

你想让 Agent 自动做什么？
告诉我们，帮你打包成功法 💪
```

---

## 6. 实施路线图

### Phase 1: Workflow Engine (4 周)
- Workflow JSON Schema
- Step execution engine
- Chain Hub integration
- Template system

### Phase 2: Marketplace (4 周)
- Solana contracts (publish/buy/review)
- NFT access system
- Revenue distribution
- UI/UX

### Phase 3: Agent Integration (4 周)
- Agent authorization
- Automated execution
- Monitoring dashboard
- Performance analytics

---

## 7. 竞争优势

| 项目 | 定位 | Gradience 差异 |
|------|------|---------------|
| Virtuals | Agent 创建 | Workflow 功法交易 |
| Sahara AI | AI 工作流 | 多链 + 信任层 |
| AVA Protocol | 自动化 | Escrow + Judge 安全 |

**Gradience 独特价值**:
- 极简 kernel (~300 行 Solana)
- 五链多链适配
- 信任层 (Escrow + Judge + Reputation)
- 可组合、可交易、可验证

---

*最后更新: 2026-04-03*  
*状态: 产品设计冻结，等待开发启动*
