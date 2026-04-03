# Gradience 协议 - TODO 清单

**扫描日期**: 2026-04-04  
**总计**: 52 个 TODO/FIXME/未实现项

---

## 🔴 Critical (18项) - 必须立即处理

### 1. Agent Arena - Judge Evaluators (3项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/agent-arena/program/src/judge/mod.rs` | 112-114 | `LlmScoreEvaluator.evaluate()` 返回错误 | AI评判完全未实现 |
| `apps/agent-arena/program/src/judge/mod.rs` | 126-128 | `OnChainEvaluator.evaluate()` 返回错误 | 链上评判完全未实现 |
| `apps/agent-arena/program/src/judge/mod.rs` | 96-103 | `TestCasesEvaluator.evaluate()` 返回固定分数80 | 测试用例评判是 stub |

**解决方案**:
- LlmScoreEvaluator: 集成 DSPy 或 OpenAI API
- OnChainEvaluator: 实现 WASM 执行或合约调用
- TestCasesEvaluator: 实现实际测试执行

---

### 2. Workflow Engine - Trading Handlers (5项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/handlers/trading.ts` | 74 | `createSwapHandler()` | 未集成 Jupiter/Orca SDK |
| `packages/workflow-engine/src/handlers/trading.ts` | 106 | `createBridgeHandler()` | 未集成 Wormhole/LayerZero |
| `packages/workflow-engine/src/handlers/trading.ts` | 130 | `createTransferHandler()` | 未集成 Solana web3.js |
| `packages/workflow-engine/src/handlers/trading.ts` | 153 | `createStakeHandler()` | 未集成 Solana staking |
| `packages/workflow-engine/src/handlers/trading.ts` | 176 | `createUnstakeHandler()` | 未实现 |

**解决方案**:
- Swap: 集成 `@jup-ag/core` 或 `@orca-so/sdk`
- Bridge: 集成 `@wormhole-foundation/sdk`
- Transfer: 使用 `@solana/web3.js` SystemProgram.transfer
- Stake: 使用 Solana native staking 或 Marinade

---

### 3. Agent Daemon - Evaluation Runtime (5项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/agent-daemon/src/evaluator/runtime.ts` | 282 | `evaluateUI()` | Playwright UI 测试未实现 |
| `apps/agent-daemon/src/evaluator/runtime.ts` | 301 | `evaluateAPI()` | API 契约测试未实现 |
| `apps/agent-daemon/src/evaluator/runtime.ts` | 320 | `evaluateContent()` | LLM-as-judge 未实现 |
| `apps/agent-daemon/src/evaluator/runtime.ts` | 339 | `evaluateComposite()` | 复合评估未实现 |
| `apps/agent-daemon/src/evaluator/runtime.ts` | 358 | `createSandbox()` | Docker/git-worktree 沙箱未实现 |

**解决方案**:
- UI: 集成 Playwright 或 Puppeteer
- API: 使用 axios + jest 进行契约测试
- Content: 集成 OpenAI GPT-4 或 Claude
- Sandbox: 使用 Dockerode 或 child_process

---

### 4. Settlement Bridge - Solana 集成 (3项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 326 | `submitToChainHub()` | Solana 交易提交是 mock |
| `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 392 | `verifyOnChain()` | 链上验证未实现 |
| `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 404 | `getTransactionDetails()` | RPC 查询未实现 |

**解决方案**:
- 使用 `@solana/web3.js` 提交交易
- 使用 `connection.confirmTransaction()` 验证
- 使用 `connection.getTransaction()` 获取详情

---

### 5. Revenue Distribution - Solana 调用 (1项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/revenue-share.ts` | 260 | `SolanaRevenueDistributor.distribute()` | 程序调用是 mock |

**解决方案**:
- 实现 CPI 调用 workflow-marketplace 程序
- 使用 `@solana/web3.js` 构建交易

---

### 6. Workflow Marketplace - 购买功能 (1项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/sdk/marketplace.ts` | 107 | `purchase()` | 购买交易未实现 |

**解决方案**:
- 使用已实现的 `purchaseWorkflowV2` 指令
- 构建完整的交易并提交

---

## 🟠 High (15项) - 尽快处理

### 7. Payment Handlers (4项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/handlers/payment.ts` | 55 | `createX402PaymentHandler()` | x402 未集成 |
| `packages/workflow-engine/src/handlers/payment.ts` | 87 | `createMPPStreamRewardHandler()` | Tempo MPP 未集成 |
| `packages/workflow-engine/src/handlers/payment.ts` | 117 | `createTEEPrivateSettleHandler()` | X Layer TEE 未集成 |
| `packages/workflow-engine/src/handlers/payment.ts` | 145 | `createZeroGasExecuteHandler()` | X Layer Relay 未集成 |

**解决方案**:
- x402: 等待 `@solana/x402` 发布或自己实现
- MPP: 联系 Tempo 团队获取 SDK
- TEE: 等待 X Layer 文档
- ZeroGas: 使用 relay 服务

---

### 8. Settlement Bridge - 其他 (3项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 267 | `retry()` | 重试逻辑未实现 |
| `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 293 | `signProof()` | 签名未实现 |
| `apps/agent-daemon/src/bridge/external-evaluation-stub.ts` | 120 | `verifyProofSignature()` | Ed25519 验证未实现 |

**解决方案**:
- 使用 `@solana/web3.js` Keypair.sign()
- 使用 `tweetnacl` 进行 Ed25519 验证

---

### 9. Workflow Marketplace - SDK 方法 (4项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/sdk/marketplace.ts` | 76 | `create()` | IPFS 上传未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 130 | `hasAccess()` | 链上检查未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 249 | `update()` | 更新交易未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 259 | `deactivate()` | 停用交易未实现 |

**解决方案**:
- IPFS: 使用 `nft.storage` 或 `web3.storage`
- 其他: 使用已实现的指令构建器

---

### 10. Chain Hub SDK (1项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/chain-hub/sdk/client.ts` | 83 | `registerAgent()` | CPI 调用未实现 |

**解决方案**:
- 使用 `@solana/web3.js` 构建 CPI 交易

---

### 11. External Evaluators (3项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/agent-daemon/src/bridge/external-evaluation-stub.ts` | 127 | `loadAuthorizedEvaluators()` | PDA 获取未实现 |
| `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 404 | `getTransactionDetails()` | RPC 查询未实现 |

---

## 🟡 Medium (14项) - 后续处理

### 12. Indexer 查询集成 (6项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/sdk/marketplace.ts` | 95 | `get()` | 查询 indexer 未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 199 | `browse()` | 查询 indexer 未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 229 | `getMyWorkflows()` | 查询 indexer 未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 239 | `getMyPurchases()` | 查询 indexer 未实现 |

**解决方案**:
- 使用 Indexer REST API (`/api/tasks`, `/api/agents/{pk}/reputation`)

---

### 13. Workflow Marketplace - 其他 (4项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `packages/workflow-engine/src/sdk/marketplace.ts` | 183 | `review()` | IPFS 上传未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 186 | `review()` | 交易未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 269 | `activate()` | 交易未实现 |
| `packages/workflow-engine/src/sdk/marketplace.ts` | 279 | `delete()` | 交易未实现 |

---

### 14. CLI 功能 (2项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `apps/agent-arena/cli/gradience.ts` | 537-538 | `handleCreateAgent()` | 任务选择逻辑未实现 |
| `apps/agent-arena/cli/gradience.ts` | 541-542 | `handleCreateAgent()` | 任务处理逻辑未实现 |

---

### 15. Build 脚本 (1项)

| 文件 | 行 | 问题 | 说明 |
|------|-----|------|------|
| `programs/workflow-marketplace/build.rs` | 2-4 | IDL 生成注释 | 低优先级 |

---

## 🟢 Low (5项) - 可选/延后

- 一些模板注释
- IPFS 上传优化
- 次要功能完善

---

## 📋 修复优先级建议

### Phase 1: Critical Core (本周)
1. ✅ Judge Evaluators (LlmScore, OnChain)
2. ✅ Trading Handlers (swap, bridge, transfer, stake)
3. ✅ Settlement Bridge Solana 提交

### Phase 2: High Priority (下周)
4. ✅ Agent Daemon Evaluation (UI, API, Content)
5. ✅ Payment Handlers (x402, MPP, TEE, ZeroGas)
6. ✅ Workflow Marketplace 完整 SDK

### Phase 3: Medium (第三周)
7. ✅ Indexer 查询集成
8. ✅ 其他 SDK 方法

### Phase 4: Low (后续)
9. ✅ 次要功能完善

---

## 🎯 关键决策点

### 1. Judge Evaluators
**选项 A**: 使用 DSPy Python 服务 (已实现)  
**选项 B**: 使用 OpenAI API 直接调用  
**选项 C**: 使用本地 LLM (Ollama)

**建议**: 选项 A，DSPy 服务已在 judge-daemon 中实现

### 2. Trading Handlers
**选项 A**: 集成真实 DEX SDK (Jupiter/Orca)  
**选项 B**: 使用 mock 数据 (演示用)  
**选项 C**: 使用 Chainlink Price Feeds

**建议**: 选项 A，但可以先使用选项 B 进行演示

### 3. Payment Handlers
**选项 A**: 等待官方 SDK  
**选项 B**: 自己实现协议  
**选项 C**: 使用替代方案

**建议**: 选项 C，使用标准 SPL Token transfer 替代

---

## 📊 工作量估算

| 优先级 | 项数 | 预计工作量 | 负责方 |
|--------|------|-----------|--------|
| Critical | 18 | 40小时 | Core Team |
| High | 15 | 30小时 | Core Team |
| Medium | 14 | 20小时 | Community |
| Low | 5 | 10小时 | Community |
| **总计** | **52** | **100小时** | - |

---

**结论**: 核心功能需要约 70 小时完成，建议分 2-3 周处理。
