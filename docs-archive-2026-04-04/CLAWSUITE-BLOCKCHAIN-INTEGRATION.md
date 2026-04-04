# Clawsuite + 区块链功能集成方案

## 🎯 核心理念

**渐进式增强，不是替换**

```
原有功能（完全保留）
├── Chat / Agent / Mission
├── File Explorer / Terminal  
├── Costs / Dashboard
└── Settings

新增区块链功能
├── 🔐 钱包登录（可选）
├── 💰 Wallet 面板（查看余额）
├── 🏆 Reputation（链上声誉）
├── 🛒 Workflow Market（购买工作流）
└── 💸 任务支付（Escrow）
```

---

## 🔐 1. 钱包登录设计

### 登录方式选择

```
┌─────────────────────────────────────────┐
│           欢迎登录 Clawsuite            │
├─────────────────────────────────────────┤
│                                         │
│  [继续使用 Gateway Token]               │  ← 原有方式保留
│                                         │
│  ─────────── 或 ───────────             │
│                                         │
│  [🦊 Phantom] [🔥 Solflare]            │  ← 新增钱包登录
│  [⚡ Backpack] [💼 Glow]               │
│                                         │
└─────────────────────────────────────────┘
```

### 登录流程

**原有方式（保留）**:
```
用户输入 Gateway URL + Token → 连接 OpenClaw → 进入应用
```

**新增方式（钱包登录）**:
```
用户选择钱包 → 签名消息（证明身份）→ 后端验证 → 关联 Gateway → 进入应用
                                    ↓
                            可选：创建链上 Agent Profile
```

### 技术实现

```typescript
// src/server/auth/wallet-auth.ts
import { Connection, PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'

export class WalletAuth {
  // 验证钱包签名
  async verifyWalletSignature(
    publicKey: string,
    message: string,
    signature: string
  ): Promise<boolean> {
    const pubKey = new PublicKey(publicKey)
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = Buffer.from(signature, 'base64')
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKey.toBytes()
    )
  }
  
  // 生成 nonce 让用户签名
  generateAuthMessage(publicKey: string): string {
    const nonce = crypto.randomUUID()
    return `Clawsuite Login: ${publicKey}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`
  }
}
```

---

## 💰 2. Wallet 面板设计

### 集成方式：侧边栏或顶部栏

```
┌──────────────────────────────────────────┐
│  Clawsuite          [💰 12.5 SOL] [👤]  │  ← 顶部显示余额
├──────────┬───────────────────────────────┤
│          │                               │
│  原有    │                               │
│  侧边栏  │      原有功能区域              │
│  菜单    │      (Chat/Dashboard/Mission) │
│          │                               │
│          │                               │
├──────────┤                               │
│ 新增     │                               │
│ 💰 Wallet│                               │
│ 🛒 Market│                               │
│ 🏆 Rep   │                               │
│          │                               │
└──────────┴───────────────────────────────┘
```

### Wallet 面板内容

```
Wallet 页面
├── 余额卡片
│   ├── SOL: 12.5 (~$1,250)
│   ├── USDC: 450.00
│   └── [充值] [转账] [提现]
│
├── Reputation
│   ├── Score: 85/100
│   ├── Tier: Gold
│   └── 历史趋势图
│
├── 最近交易
│   ├── 2024-01-15: +10 USDC (任务奖励)
│   ├── 2024-01-14: -5 USDC (购买 Workflow)
│   └── 2024-01-13: -2 USDC (任务支付)
│
└── Escrow 托管
    ├── 活跃托管: 3 个
    ├── 冻结资金: 25 USDC
    └── [查看详情]
```

### 技术实现

```typescript
// src/screens/wallet/wallet-screen.tsx
export function WalletScreen() {
  const { publicKey, connected } = useWallet()  // Solana wallet adapter
  const { balance, reputation, transactions } = useWalletData(publicKey)
  
  if (!connected) {
    return <WalletConnectPrompt />  // 提示连接钱包
  }
  
  return (
    <div className="p-6">
      <BalanceCards balance={balance} />
      <ReputationCard reputation={reputation} />
      <TransactionList transactions={transactions} />
      <EscrowSummary />
    </div>
  )
}
```

---

## 🛒 3. Workflow Marketplace 设计

### 集成方式：独立页面

```
Marketplace 页面
├── 搜索/筛选栏
├── Workflow 列表
│   ├── [Workflow Card]
│   │   ├── 名称: "Twitter Auto-Poster"
│   │   ├── 价格: 10 USDC
│   │   ├── 评分: ⭐⭐⭐⭐⭐ (4.8)
│   │   ├── 销量: 234
│   │   └── [购买并导入]
│   └── ...
└── 我的 Workflow
    └── 已购买的列表
```

### 购买流程

```
用户点击 [购买并导入]
    ↓
显示确认弹窗："购买 Twitter Auto-Poster (10 USDC)?"
    ↓
用户确认 → 调用 Solana 交易
    ↓
交易确认 → 获取 Workflow 配置
    ↓
自动导入到 OpenClaw Skills
    ↓
提示："购买成功！已添加到您的 Skills"
```

### 技术实现

```typescript
// src/server/marketplace/client.ts
export class MarketplaceClient {
  async purchaseWorkflow(
    workflowId: string,
    buyer: PublicKey
  ): Promise<string> {
    // 1. 创建购买交易
    const tx = await this.program.methods
      .purchaseWorkflow(workflowId)
      .accounts({
        buyer,
        marketplace: this.marketplacePDA,
        escrow: this.escrowPDA,
      })
      .transaction()
    
    // 2. 返回交易让前端签名
    return tx.serializeMessage().toString('base64')
  }
  
  // 购买成功后导入到 OpenClaw
  async importWorkflowToOpenClaw(
    workflowConfig: WorkflowConfig
  ): Promise<void> {
    // 调用 OpenClaw API 添加 Skill
    await fetch('/api/gateway/skills/import', {
      method: 'POST',
      body: JSON.stringify(workflowConfig)
    })
  }
}
```

---

## 💸 4. 任务支付（Escrow）设计

### 集成方式：Mission/Task 创建时可选

```
创建 Mission 页面
├── 原有内容（全部保留）
│   ├── Mission 名称
│   ├── 选择 Agent
│   ├── 任务描述
│   └── ...
│
└── 新增: 支付设置（可选）
    ├── [x] 启用链上支付
    │
    ├── 预算: [____] USDC
    ├── 质押: [____] USDC
    │
    ├── 执行者选择:
    │   ├── ( ) 任意 Agent
    │   └── ( ) 指定 Agent (需对方同意)
    │
    └── [创建 Mission + 创建 Escrow]
```

### Escrow 流程

```
用户创建带支付的 Mission
    ↓
创建链上 Escrow（资金冻结）
    ↓
Agent 接受任务
    ↓
Agent 执行任务（通过 OpenClaw）
    ↓
任务完成 → Judge 验证结果
    ↓
验证通过 → 自动释放支付到 Agent
    ↓
双方 Reputation 更新
```

### 技术实现

```typescript
// src/server/escrow/client.ts
export class EscrowClient {
  // 创建托管
  async createEscrow(params: {
    missionId: string
    budget: number
    stake: number
    creator: PublicKey
  }): Promise<string> {
    return this.program.methods
      .createEscrow(
        params.missionId,
        new BN(params.budget),
        new BN(params.stake)
      )
      .accounts({
        creator: params.creator,
        escrow: this.getEscrowPDA(params.missionId),
      })
      .rpc()
  }
  
  // 释放支付
  async releaseEscrow(
    missionId: string,
    executor: PublicKey
  ): Promise<void> {
    await this.program.methods
      .releaseEscrow()
      .accounts({
        escrow: this.getEscrowPDA(missionId),
        executor,
      })
      .rpc()
  }
}
```

---

## 🏆 5. Reputation 设计

### 显示位置

```
Agent Hub 页面
├── Agent 卡片（原有信息保留）
│   ├── 名称: "CodeAgent-1"
│   ├── 状态: Online
│   ├── 新增: 🏆 Reputation 85/100  ← 新增
│   └── 新增: 💰 已完成任务: 234   ← 新增
│
└── Agent 详情页
    ├── 原有信息
    └── 新增: 链上 Profile
        ├── Reputation Score
        ├── 历史评分
        ├── 完成的任务列表
        └── 收入统计
```

### 技术实现

```typescript
// src/server/reputation/client.ts
export class ReputationClient {
  async getReputation(agentId: string): Promise<Reputation> {
    const profile = await this.program.account.agentProfile.fetch(
      this.getProfilePDA(agentId)
    )
    
    return {
      score: profile.reputationScore,
      tier: this.calculateTier(profile.reputationScore),
      tasksCompleted: profile.tasksCompleted,
      totalEarnings: profile.totalEarnings.toNumber(),
    }
  }
  
  private calculateTier(score: number): string {
    if (score >= 90) return 'Platinum'
    if (score >= 80) return 'Gold'
    if (score >= 60) return 'Silver'
    return 'Bronze'
  }
}
```

---

## 📁 文件结构

```
src/
├── screens/                    # 原有屏幕（不动）
│   ├── chat/
│   ├── dashboard/
│   ├── costs/                 # 保留原有 Costs
│   ├── agents/                # 添加 Reputation 显示
│   ├── mission/               # 添加支付选项
│   ├── wallet/                # ✅ 新增：Wallet 页面
│   └── marketplace/           # ✅ 新增：Marketplace 页面
│
├── server/                     # 后端
│   ├── gateway.ts             # 保留 OpenClaw 通信
│   ├── solana/                # ✅ 新增：Solana 相关
│   │   ├── connection.ts
│   │   ├── wallet-auth.ts
│   │   └── index.ts
│   ├── chain-hub/             # ✅ 新增：Chain Hub API
│   │   └── client.ts
│   ├── marketplace/           # ✅ 新增：Marketplace
│   │   └── client.ts
│   ├── escrow/                # ✅ 新增：Escrow
│   │   └── client.ts
│   └── reputation/            # ✅ 新增：Reputation
│       └── client.ts
│
├── components/                 # 组件
│   ├── wallet/                # ✅ 新增：Wallet 组件
│   ├── marketplace/           # ✅ 新增：Marketplace 组件
│   └── reputation/            # ✅ 新增：Reputation 组件
│
└── hooks/                      # Hooks
    ├── use-wallet.ts          # ✅ 新增
    ├── use-marketplace.ts     # ✅ 新增
    └── use-reputation.ts      # ✅ 新增
```

---

## 🔧 集成步骤

### Phase 1: 基础设置（1 周）
- [ ] 添加 Solana Wallet Adapter
- [ ] 创建钱包登录选项
- [ ] 配置 Solana 连接

### Phase 2: Wallet 功能（1 周）
- [ ] 创建 Wallet 页面
- [ ] 显示余额
- [ ] 显示交易历史

### Phase 3: Marketplace（1 周）
- [ ] 创建 Marketplace 页面
- [ ] 集成购买流程
- [ ] 导入到 OpenClaw

### Phase 4: Escrow（1 周）
- [ ] 在 Mission 创建添加支付选项
- [ ] Escrow 创建/释放流程
- [ ] 与 OpenClaw 任务状态同步

### Phase 5: Reputation（1 周）
- [ ] Agent Profile 添加 Reputation
- [ ] 评分系统
- [ ] 数据展示

---

## ✅ 总结

**原有功能：100% 保留**
**新增功能：**
- 🔐 钱包登录（可选）
- 💰 Wallet 页面（查看余额/交易）
- 🛒 Workflow Marketplace（购买/导入）
- 💸 任务支付 Escrow（可选启用）
- 🏆 Reputation 系统

**用户可以自由选择：**
- 只用原有功能 → 完全不受影响
- 启用区块链功能 → 获得增强体验
