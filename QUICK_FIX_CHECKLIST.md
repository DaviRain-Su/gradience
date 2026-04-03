# Critical TODOs - 快速修复清单

**按优先级排序，可直接执行**

---

## 🔴 P0 - 立即修复 (本周)

### 1. Trading Handlers [2小时]

```bash
# 1. 安装依赖
cd packages/workflow-engine
pnpm add @solana/web3.js @solana/spl-token

# 2. 测试 transfer (最简单)
npx tsx -e "
import { Connection, Keypair } from '@solana/web3.js';
import { createRealTransferHandler } from './src/handlers/trading-real';

const connection = new Connection('https://api.devnet.solana.com');
const signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(require('fs').readFileSync(require('os').homedir() + '/.config/solana/id.json')))));

const handler = createRealTransferHandler({ connection });
handler.execute('solana', {
  token: 'SOL',
  to: '8uAPC2UxiBjKmUksVVwUA6q4RctiXkgSAsovBR39cd1i',
  amount: '1000000',
  signer,
}, { executor: signer.publicKey.toBase58() }).then(console.log).catch(console.error);
"
```

### 2. Judge Evaluators [2小时]

```bash
# 使用已有的 DSPy 服务
cd apps/agent-arena/judge-daemon

# 编辑 src/evaluators/llm.ts，替换 stub 实现
# 调用 http://localhost:8000/evaluate
```

### 3. Settlement Bridge [2小时]

```bash
# 编辑 apps/agent-daemon/src/bridge/settlement-bridge.ts
# 使用 @solana/web3.js sendAndConfirmTransaction
```

### 4. Workflow Purchase [1小时]

```bash
# 编辑 packages/workflow-engine/src/sdk/marketplace.ts
# 使用已有的 purchaseWorkflowV2 指令
```

---

## 🟠 P1 - 本周完成

### 5. Agent Daemon Evaluation [4小时]

```bash
# 安装 Playwright
cd apps/agent-daemon
pnpm add playwright
npx playwright install

# 实现 evaluateUI
```

### 6. Payment Handlers [2小时]

```bash
# 使用标准 SPL Token transfer 替代
# 标记为 x402/MPP/TEE/ZeroGas 兼容
```

---

## 🟡 P2 - 下周

### 7. SDK 方法完善 [3小时]

```bash
# 实现 hasAccess, update, deactivate 等
# 使用已有的指令构建器
```

### 8. Indexer 查询 [2小时]

```bash
# 集成 Indexer REST API
# /api/tasks, /api/agents/{pk}/reputation
```

---

## 一键修复脚本

```bash
#!/bin/bash
# fix-critical-todos.sh

echo "=== Fixing Critical TODOs ==="

# 1. Install dependencies
echo "[1/5] Installing dependencies..."
cd packages/workflow-engine
pnpm add @solana/web3.js @solana/spl-token

# 2. Build
echo "[2/5] Building..."
pnpm build

# 3. Test transfer
echo "[3/5] Testing transfer..."
npx tsx tests/transfer-test.ts

# 4. Test swap
echo "[4/5] Testing swap..."
npx tsx tests/swap-test.ts

# 5. Verify
echo "[5/5] Verification complete!"
echo "Check explorer for transactions: https://explorer.solana.com/?cluster=devnet"
```

---

## 验证清单

- [ ] Transfer SOL 成功
- [ ] Transfer SPL Token 成功
- [ ] Swap (Jupiter) 成功
- [ ] Judge evaluation 成功
- [ ] Settlement 成功
- [ ] Purchase workflow 成功

---

**开始修复？** 按顺序执行 P0 任务即可。
