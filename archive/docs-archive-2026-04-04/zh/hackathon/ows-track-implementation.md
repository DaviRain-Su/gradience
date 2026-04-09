# OWS Hackathon Track 02/03/04 冲刺方案

> Gradience + OWS 身份 + Reputation 叠加

---

## 🎯 新定位

**"首个带信用评分的 Agent 身份系统"**

在 ows.domains 基础上叠加：

- ✅ OWS 原生钱包 (Track 03 基础)
- ✅ ENS 跨链身份 (Track 03 要求)
- ✅ **Gradience Reputation 评分** (差异化)
- ✅ **声誉门控的 Wallet-per-Agent** (Track 02 + 04)

---

## 🏗️ 技术架构 (12小时实现)

```
┌─────────────────────────────────────────────────────────────┐
│                  Gradience OWS Identity                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: OWS 基础 (Track 03 要求)                           │
│  ├── OWS CLI: wallet create                                  │
│  ├── OWS Wallet: 签名 + 密钥管理                              │
│  ├── MoonPay Skill: 充值                                     │
│  └── ENS: name.ows.eth 跨链解析                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Gradience 叠加 (差异化)                             │
│  ├── Reputation Oracle: 链上评分查询                          │
│  ├── Judge System: 任务验证 + 评分                           │
│  └── DID + Verifiable Credentials                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Agent 功能 (Track 02 + 04)                         │
│  ├── Wallet-per-Agent: 每个 Agent 子钱包                      │
│  ├── Policy Engine: 声誉决定额度/权限                         │
│  └── SubWallet Governance: 主钱包控制策略                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 核心功能 (MVP)

### 1. Agent 身份注册

```typescript
// CLI 命令: gradience agent register
const result = await gradience.agent.register({
    // OWS 基础
    name: 'trading-agent.ows.eth',
    owsWallet: await ows.wallet.create(),

    // Gradience 叠加
    reputation: {
        initialScore: 50, // 新 Agent 默认 50 分
        badges: ['verified'],
    },

    // ENS 记录
    ensRecords: {
        'gradience.reputation': '50',
        'gradience.judgeScore': '0',
        'gradience.tasksCompleted': '0',
        'gradience.walletPolicy': JSON.stringify({
            dailyLimit: 500, // 50 * 10
            requireApproval: 100,
        }),
    },
});

// 返回: ENS 域名 + 多链地址 + 初始声誉
console.log(result);
// {
//   ens: 'trading-agent.ows.eth',
//   addresses: {
//     ethereum: '0xEBd6...',
//     solana: '5Y3dUir...',
//     bitcoin: 'bc1qxr2...',
//   },
//   reputation: 50,
//   policy: { dailyLimit: 500, requireApproval: 100 }
// }
```

### 2. 声誉驱动的子钱包

```typescript
// 为子 Agent 创建受限钱包
const subWallet = await gradience.wallet.createSubWallet({
    parent: 'trading-agent.ows.eth',
    name: 'sub-agent-1',

    // 策略由声誉决定
    policy: {
        // 每日限额 = 声誉分 * 10 USD
        dailyLimit: reputation * 10,

        // 单笔超过 100 USD 需要主钱包批准
        requireApproval: (amount) => amount > 100,

        // 声誉 < 30 需要人工审核所有交易
        requireManualReview: reputation < 30,

        // 允许的 Token 白名单
        allowedTokens: reputation > 80 ? ['ALL'] : ['USDC', 'USDT'],

        // 禁止交互的合约黑名单
        blockedContracts: knownScamContracts,
    },
});
```

### 3. 实时声誉查询

```typescript
// CLI: gradience reputation check trading-agent.ows.eth
const reputation = await gradience.reputation.get('trading-agent.ows.eth');

// 返回详细评分
{
  score: 78,           // 总分 0-100
  level: 'gold',       // bronze/silver/gold/platinum

  // 分项评分
  breakdown: {
    taskCompletion: 95,    // 任务完成率
    judgeRating: 4.2,      // Judge 平均评分 1-5
    disputeRate: 2,        // 争议率 %
    paymentSpeed: 98,      // 付款及时率 %
    crossChain: 85,        // 跨链操作成功率
  },

  // 可验证凭证
  credentials: [
    { type: 'task', id: 'task-123', score: 5, judge: '0xabc...' },
    { type: 'payment', id: 'pay-456', amount: 1000, onTime: true },
  ],

  // 历史趋势
  history: [
    { date: '2026-03-01', score: 50 },
    { date: '2026-04-01', score: 65 },
    { date: '2026-04-03', score: 78 },
  ]
}
```

### 4. ENS 跨链解析 + 声誉

```typescript
// ENS 文本记录存储声誉
const ensRecords = {
    // 基础地址解析 (像示例一样)
    'address.60': '0xEBd6...', // ETH
    'address.0': 'bc1qxr2...', // BTC
    'address.501': '5Y3dUir...', // SOL

    // Gradience 叠加的声誉记录
    'text.gradience.reputation': '78',
    'text.gradience.level': 'gold',
    'text.gradience.policy': JSON.stringify({
        dailyLimit: 780,
        maxTransaction: 5000,
    }),
    'text.gradience.credentials': 'ipfs://Qm...', // VC 凭证

    // 可验证的链上证明
    'text.gradience.proof': '0xsignature...',
};

// 解析时自动获取声誉
const agent = await ows.domains.resolve('trading-agent.ows.eth');
// {
//   name: 'trading-agent.ows.eth',
//   addresses: { ethereum: '0x...', solana: '5Y3d...' },
//   reputation: 78,  // ← 关键差异化
//   policy: { dailyLimit: 780 }
// }
```

---

## 🎨 Demo 场景 (3分钟演示)

### Scene 1: Agent 注册 (30秒)

```bash
$ gradience agent register --name "trading-agent"

✓ Created OWS wallet
✓ Registered ENS: trading-agent.ows.eth
✓ Cross-chain addresses:
  - ETH: 0xEBd6...
  - SOL: 5Y3dUir...
  - BTC: bc1qxr2...
✓ Initial reputation: 50 (Bronze)
✓ Policy: Daily limit $500, Approval required >$100
```

### Scene 2: 完成任务提升声誉 (60秒)

```bash
$ gradience task complete --agent "trading-agent" --task "swap-eth-to-usdc"

✓ Task verified by Judge
✓ Payment released: 100 USDC
✓ Reputation updated: 50 → 65 (+15)
✓ New level: Silver
✓ Policy upgraded: Daily limit $650
```

### Scene 3: 高声誉 Agent 权限 (60秒)

```bash
$ gradience wallet check-policy --agent "elite-trader"

Agent: elite-trader.ows.eth
Reputation: 92 (Platinum)

Policy:
- Daily limit: $9200 (92 * 100)
- No approval required (reputation > 80)
- All tokens allowed
- Can create sub-agents

Sub-agents:
- sub-1: Limit $920/day
- sub-2: Limit $920/day
```

### Scene 4: 低声誉限制 (30秒)

```bash
$ gradience wallet check-policy --agent "new-agent"

Agent: new-agent.ows.eth
Reputation: 25 (New)

Policy:
- Daily limit: $250 (25 * 10)
- Manual review required
- Only USDC/USDT allowed
- Cannot create sub-agents

⚠️ Warning: Complete more tasks to unlock features
```

---

## 🔧 技术实现 (代码框架)

### 项目结构

```
gradience-ows/
├── packages/
│   ├── cli/                    # CLI 工具
│   │   ├── commands/
│   │   │   ├── agent.ts       # agent register
│   │   │   ├── reputation.ts  # reputation check
│   │   │   └── wallet.ts      # wallet create-sub
│   │   └── index.ts
│   │
│   ├── core/                   # 核心库
│   │   ├── agent.ts           # Agent 管理
│   │   ├── reputation.ts      # 声誉系统
│   │   ├── wallet.ts          # 钱包策略
│   │   └── ens.ts             # ENS 集成
│   │
│   └── ows-adapter/            # OWS 适配
│       ├── wallet.ts
│       └── provider.ts
│
├── contracts/                  # 智能合约
│   ├── ReputationRegistry.sol
│   └── WalletPolicy.sol
│
└── demo/                       # 演示应用
    └── web/
```

### 关键代码

```typescript
// packages/core/reputation.ts

export class ReputationEngine {
    async calculateScore(agentId: string): Promise<number> {
        const [tasks, payments, disputes] = await Promise.all([
            this.getTaskHistory(agentId),
            this.getPaymentHistory(agentId),
            this.getDisputeHistory(agentId),
        ]);

        // 算法
        const taskScore = tasks.filter((t) => t.verified).length * 5;
        const judgeScore = (tasks.reduce((sum, t) => sum + t.judgeRating, 0) / tasks.length) * 10;
        const paymentScore = payments.filter((p) => p.onTime).length * 3;
        const disputePenalty = disputes.length * 10;

        return Math.min(100, Math.max(0, taskScore + judgeScore + paymentScore - disputePenalty));
    }

    async getPolicy(score: number): Promise<WalletPolicy> {
        return {
            dailyLimit: score * 10,
            requireApproval: score < 80,
            allowedTokens: score > 80 ? null : ['USDC', 'USDT'],
            canCreateSubWallets: score > 50,
        };
    }
}

// packages/core/wallet.ts

export class PolicyWallet {
    constructor(
        private parentWallet: OWSWallet,
        private reputation: number,
    ) {}

    async sendTransaction(tx: Transaction): Promise<TxHash> {
        const policy = await this.getPolicy();

        // 检查限额
        if (tx.value > policy.dailyLimit) {
            throw new Error(`Exceeds daily limit: ${policy.dailyLimit}`);
        }

        // 检查是否需要审批
        if (policy.requireApproval && tx.value > 100) {
            await this.requestApproval(tx);
        }

        return this.parentWallet.signTransaction(tx);
    }
}
```

---

## 📋 12小时冲刺计划

### Hour 1-2: OWS 基础集成

- [ ] 集成 OWS CLI
- [ ] 创建钱包生成命令
- [ ] ENS 域名注册

### Hour 3-4: Reputation 核心

- [ ] 声誉计算算法
- [ ] 链上存储合约
- [ ] 查询接口

### Hour 5-6: Wallet Policy

- [ ] 策略引擎
- [ ] 限额检查
- [ ] 审批流程

### Hour 7-8: CLI 完成

- [ ] agent register
- [ ] reputation check
- [ ] wallet create-sub

### Hour 9-10: Demo Web

- [ ] 可视化界面
- [ ] 声誉展示
- [ ] 钱包管理

### Hour 11-12: 测试 + 部署

- [ ] 端到端测试
- [ ] 部署到 Vercel
- [ ] 准备 Pitch

---

## ✅ 提交检查清单

- [ ] OWS CLI 集成 ✅
- [ ] MoonPay Skill ✅
- [ ] 跨 2+ 链 (ETH + SOL) ✅
- [ ] ENS 身份 ✅
- [ ] **Gradience Reputation** ⭐ (差异化)
- [ ] **Wallet-per-Agent** ⭐ (差异化)
- [ ] **Policy Engine** ⭐ (差异化)

---

**Ready to build? Let's code! 🚀**
