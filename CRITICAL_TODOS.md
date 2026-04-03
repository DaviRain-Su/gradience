# Critical TODOs - 立即处理清单

**总计**: 18 Critical + 15 High = 33 项需要立即处理

---

## 🔴 Critical (18项) - 本周必须完成

### 1. Judge Evaluators (3项) - 6小时
```rust
// apps/agent-arena/program/src/judge/mod.rs
// LlmScoreEvaluator - 需要集成 DSPy Python 服务
// OnChainEvaluator - 需要实现 WASM 执行
// TestCasesEvaluator - 需要实现实际测试执行
```

### 2. Trading Handlers (5项) - 10小时
```typescript
// packages/workflow-engine/src/handlers/trading.ts
// - createSwapHandler() - 集成 Jupiter
// - createBridgeHandler() - 集成 Wormhole
// - createTransferHandler() - Solana web3.js
// - createStakeHandler() - Solana staking
// - createUnstakeHandler() - Solana unstake
```

### 3. Agent Daemon Evaluation (5项) - 12小时
```typescript
// apps/agent-daemon/src/evaluator/runtime.ts
// - evaluateUI() - Playwright 集成
// - evaluateAPI() - API 契约测试
// - evaluateContent() - LLM-as-judge
// - evaluateComposite() - 复合评估
// - createSandbox() - Docker 沙箱
```

### 4. Settlement Bridge (3项) - 6小时
```typescript
// apps/agent-daemon/src/bridge/settlement-bridge.ts
// - submitToChainHub() - Solana 交易提交
// - verifyOnChain() - 链上验证
// - getTransactionDetails() - RPC 查询
```

### 5. Revenue Distribution (1项) - 2小时
```typescript
// packages/workflow-engine/src/revenue-share.ts
// - SolanaRevenueDistributor.distribute() - CPI 调用
```

### 6. Workflow Purchase (1项) - 2小时
```typescript
// packages/workflow-engine/src/sdk/marketplace.ts
// - purchase() - 使用 purchaseWorkflowV2 指令
```

---

## 🟠 High (15项) - 下周完成

### 7. Payment Handlers (4项) - 8小时
```typescript
// packages/workflow-engine/src/handlers/payment.ts
// - x402, MPP, TEE, ZeroGas
```

### 8. Settlement Bridge 其他 (3项) - 4小时
```typescript
// retry(), signProof(), verifyProofSignature()
```

### 9. Workflow SDK (4项) - 6小时
```typescript
// create(), hasAccess(), update(), deactivate()
```

### 10. Chain Hub (1项) - 2小时
```typescript
// registerAgent() CPI 调用
```

### 11. External Evaluators (3项) - 4小时
```typescript
// loadAuthorizedEvaluators(), getTransactionDetails()
```

---

## 📊 工作量汇总

| 类别 | 项数 | 小时 | 优先级 |
|------|------|------|--------|
| Judge | 3 | 6 | P0 |
| Trading | 5 | 10 | P0 |
| Evaluation | 5 | 12 | P0 |
| Settlement | 3 | 6 | P0 |
| Revenue | 1 | 2 | P0 |
| Purchase | 1 | 2 | P0 |
| Payment | 4 | 8 | P1 |
| SDK | 4 | 6 | P1 |
| **总计** | **26** | **52** | - |

---

## 🎯 建议执行顺序

### 本周 (Critical - 38小时)
1. **Trading Handlers** (10h) - 最影响用户体验
2. **Settlement Bridge** (6h) - 核心结算功能
3. **Judge Evaluators** (6h) - 评判系统核心
4. **Agent Daemon Evaluation** (12h) - 自动化评判
5. **Revenue + Purchase** (4h) - 经济模型

### 下周 (High - 14小时)
6. **Payment Handlers** (8h)
7. **SDK 完善** (6h)

---

## 🚀 快速修复方案

### Trading Handlers - 使用 Mock (临时)
```typescript
// 先使用 mock 数据演示，后续集成真实 DEX
const createSwapHandler = () => async (params) => {
  // Mock: 返回固定结果
  return { txHash: 'mock-tx', amountOut: params.amountIn * 100 };
};
```

### Judge Evaluators - 使用 DSPy 服务
```typescript
// 调用已有的 DSPy Python 服务
const response = await fetch('http://localhost:8000/evaluate', {
  method: 'POST',
  body: JSON.stringify({ task, submission })
});
```

### Settlement Bridge - 使用 Solana Web3
```typescript
import { Connection, Transaction } from '@solana/web3.js';
const connection = new Connection('https://api.devnet.solana.com');
await connection.sendTransaction(transaction, [signer]);
```

---

**开始处理 Critical TODOs？建议从 Trading Handlers 开始。**
