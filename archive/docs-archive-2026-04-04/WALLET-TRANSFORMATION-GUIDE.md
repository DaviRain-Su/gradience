# Wallet 改造详解：从 Costs 到 Crypto Wallet

## 🔍 原来的 Costs 是什么？

### 原功能：API 成本分析

```
用户视角：
"我用 OpenClaw 调用了 GPT-4，消耗了 1000 tokens，花了 $0.02"

Costs 页面展示：
├── 总费用（USD）
├── Token 使用量（Input/Output）
├── 按 Provider 统计（OpenAI、Anthropic 等）
├── 时间趋势图（日/周/月）
└── 每个 Session 的费用明细
```

### 原数据结构

```typescript
// 原来的 Cost 类型
interface CostPoint {
    date: string;
    amount: number; // USD 金额
    input: number; // Input tokens
    output: number; // Output tokens
    cacheRead: number;
    cacheWrite: number;
    inputCost: number; // Input 费用
    outputCost: number; // Output 费用
}
```

---

## 🎯 新的 Wallet 是什么？

### 新功能：区块链钱包 + 经济系统

```
用户视角：
"我创建了一个 Agent，质押了 10 USDC，执行 Workflow 花了 2 USDC"

Wallet 页面展示：
├── 钱包余额（SOL / USDC）
├── Reputation Score（链上声誉）
├── 交易历史（链上转账、支付）
├── Workflow 购买记录
├── Escrow 托管管理
└── Token 奖励/收益
```

### 新数据结构

```typescript
// 新的 Wallet 类型
interface WalletData {
    // 余额
    balances: {
        sol: number; // SOL 余额
        usdc: number; // USDC 余额
    };

    // 声誉
    reputation: {
        score: number; // 0-100
        tier: 'bronze' | 'silver' | 'gold' | 'platinum';
        tasksCompleted: number;
        totalEarnings: number;
    };

    // 交易
    transactions: Array<{
        signature: string; // 链上签名
        type: 'transfer' | 'payment' | 'escrow' | 'reward';
        amount: number;
        token: 'SOL' | 'USDC';
        status: 'pending' | 'confirmed' | 'failed';
        timestamp: number;
    }>;

    // Escrow 托管
    escrows: Array<{
        id: string;
        amount: number;
        status: 'active' | 'released' | 'refunded';
        taskId: string;
        createdAt: number;
    }>;
}
```

---

## 🔄 具体改造对照

### 1. 页面标题和路由

```typescript
// 原代码 (costs-screen.tsx)
export function CostsScreen() { ... }
// 路由: /costs

// 新代码 (wallet-screen.tsx)
export function WalletScreen() { ... }
// 路由: /wallet
```

### 2. KPI 卡片改造

**原来 - 成本指标：**

```tsx
// 显示：今日费用、本月费用、Token 使用量
<KpiCard label="Today" value="$12.50" delta={{ value: 2.3, text: "+15%" }} />
<KpiCard label="MTD" value="$340.20" />
<KpiCard label="Tokens" value="1.2M" />
```

**新 - 钱包指标：**

```tsx
// 显示：SOL 余额、USDC 余额、Reputation
<KpiCard
  label="SOL Balance"
  value="12.5 SOL"
  sub="~$1,250 USD"
/>
<KpiCard
  label="USDC Balance"
  value="450.00 USDC"
/>
<KpiCard
  label="Reputation"
  value="85/100"
  sub="Gold Tier"
  delta={{ value: 5, text: "+5 this week" }}
/>
```

### 3. 图表改造

**原来 - 费用趋势图：**

```tsx
// 展示每日 API 费用变化
<LineChart data={costTimeSeries}>
    <Line dataKey="amount" name="Cost (USD)" />
</LineChart>
```

**新 - 余额/交易图：**

```tsx
// 展示余额变化或交易量
<LineChart data={balanceHistory}>
  <Line dataKey="usdc" name="USDC Balance" />
  <Line dataKey="sol" name="SOL Balance" />
</LineChart>

// 或者：
<BarChart data={transactionVolume}>
  <Bar dataKey="incoming" name="收入" />
  <Bar dataKey="outgoing" name="支出" />
</BarChart>
```

### 4. 列表改造

**原来 - Session 费用列表：**

```tsx
// 每个 Session 的费用详情
{
    /* 
  Session: chat-abc-123
  Provider: OpenAI
  Tokens: 1,234 / 567
  Cost: $0.023
*/
}
```

**新 - 交易历史列表：**

```tsx
// 每笔链上交易
{
    /*
  Signature: 0xabc...
  Type: Payment
  Amount: -10 USDC
  To: Workflow Marketplace
  Status: ✅ Confirmed
  Time: 2 min ago
*/
}
```

---

## 🛠️ 改造步骤（详细）

### Step 1: 重命名和基础结构

```bash
# 重命名文件
mv src/screens/costs src/screens/wallet
mv src/screens/wallet/costs-screen.tsx src/screens/wallet/wallet-screen.tsx
mv src/screens/wallet/use-cost-analytics.ts src/screens/wallet/use-wallet-data.ts
```

### Step 2: 修改路由配置

```typescript
// 找到路由配置文件（可能在 src/routes.tsx 或类似位置）
// 原路由：
{ path: '/costs', component: CostsScreen }

// 新路由：
{ path: '/wallet', component: WalletScreen }
```

### Step 3: 替换数据获取逻辑

```typescript
// use-wallet-data.ts
// 原来：从 Gateway API 获取成本数据
const { data: costData } = useQuery({
    queryKey: ['costs'],
    queryFn: () => fetch('/api/gateway/usage-cost').then((r) => r.json()),
});

// 新：从 Solana 获取钱包数据
const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => fetch('/api/solana/wallet').then((r) => r.json()),
});
```

### Step 4: 替换 UI 组件

```tsx
// wallet-screen.tsx
// 1. 导入新的类型
import { useWalletData } from './use-wallet-data'

// 2. 替换 KPI 卡片
const kpis = [
  {
    label: 'SOL Balance',
    value: `${walletData.balances.sol} SOL`,
    sub: `~$${(walletData.balances.sol * solPrice).toFixed(2)}`,
  },
  {
    label: 'USDC Balance',
    value: `${walletData.balances.usdc} USDC`,
  },
  {
    label: 'Reputation',
    value: `${walletData.reputation.score}/100`,
    sub: `${walletData.reputation.tier} Tier`,
  },
]

// 3. 添加操作按钮
<Button onClick={handleTransfer}>转账</Button>
<Button onClick={handleDeposit}>充值</Button>
<Button onClick={viewEscrows}>查看托管</Button>
```

### Step 5: 添加新组件

```bash
# 创建新组件
mkdir -p src/components/wallet
touch src/components/wallet/TransferModal.tsx
touch src/components/wallet/TransactionList.tsx
touch src/components/wallet/EscrowList.tsx
touch src/components/wallet/ReceiveQR.tsx
```

---

## 📊 完整改造清单

### 需要删除/修改的文件

- [ ] `src/screens/costs/costs-screen.tsx` → 重命名为 `wallet-screen.tsx`
- [ ] `src/screens/costs/use-cost-analytics.ts` → 重命名为 `use-wallet-data.ts`
- [ ] `src/server/usage-cost.ts` → 删除，替换为 Solana 客户端
- [ ] `src/server/provider-usage.ts` → 删除
- [ ] `src/components/usage-meter/` → 删除

### 需要新增的文件

- [ ] `src/screens/wallet/wallet-screen.tsx`
- [ ] `src/screens/wallet/use-wallet-data.ts`
- [ ] `src/server/solana/client.ts`
- [ ] `src/server/solana/wallet.ts`
- [ ] `src/components/wallet/TransferModal.tsx`
- [ ] `src/components/wallet/TransactionList.tsx`
- [ ] `src/components/wallet/EscrowList.tsx`
- [ ] `src/components/wallet/ReceiveQR.tsx`

### 需要修改的引用

- [ ] 侧边栏导航：`Costs` → `Wallet`
- [ ] 图标：费用图标 → 钱包图标
- [ ] 路由：`/costs` → `/wallet`

---

## 💡 关键区别总结

| 维度         | 原 Costs         | 新 Wallet                    |
| ------------ | ---------------- | ---------------------------- |
| **数据类型** | API 使用统计     | 链上资产数据                 |
| **货币单位** | USD              | SOL / USDC                   |
| **数据来源** | OpenClaw Gateway | Solana 区块链                |
| **核心功能** | 查看费用         | 转账、支付、托管             |
| **用户操作** | 只读（查看）     | 读写（签名交易）             |
| **新增概念** | -                | Reputation、Escrow、Workflow |

---

明白了吗？原来的 Costs 是**查看 API 账单**，新的 Wallet 是**区块链钱包+经济系统**。
