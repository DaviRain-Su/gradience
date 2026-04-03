# Gradience Protocol - Quick Reference

## 🚀 Quick Start (5 minutes)

### 1. Clone & Setup

```bash
git clone <repo>
cd gradience

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### 2. Run Tests

```bash
# Workflow Engine tests
cd packages/workflow-engine
pnpm test

# Agent Arena tests (requires Rust)
cd apps/agent-arena/tests/integration-tests
cargo test
```

### 3. Use SDK

```typescript
import { createSolanaWorkflowSDK } from '@gradiences/workflow-engine';
import { Connection, Keypair } from '@solana/web3.js';

const sdk = createSolanaWorkflowSDK({
  connection: new Connection('https://api.devnet.solana.com'),
  payer: Keypair.fromSecretKey(/* your key */),
});

// Create workflow
const workflowId = Keypair.generate().publicKey;
await sdk.createWorkflow(workflow, workflowId);

// Purchase
await sdk.purchaseWorkflowWithPayment(workflowId, author);
```

---

## 📋 Program IDs (Devnet)

| Program | ID | Explorer |
|---------|-----|----------|
| Agent Arena | `5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs` | [View](https://explorer.solana.com/address/5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs?cluster=devnet) |
| Chain Hub | `6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec` | [View](https://explorer.solana.com/address/6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec?cluster=devnet) |
| A2A Protocol | `FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H` | [View](https://explorer.solana.com/address/FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H?cluster=devnet) |
| Workflow | `3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW` | [View](https://explorer.solana.com/address/3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW?cluster=devnet) |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Product Layer (AgentM)                                  │
│  - GUI for users                                        │
│  - API for autonomous agents                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  SDK Layer                                               │
│  - TypeScript SDK (@gradiences/workflow-engine)         │
│  - Rust SDK (gradience_client)                          │
│  - CLI (gradience)                                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Protocol Layer (Solana Programs)                        │
│  - Agent Arena: Task/escrow/judge/reputation            │
│  - Chain Hub: Skills/delegation                         │
│  - A2A Protocol: Agent communication                    │
│  - Workflow: Composable workflows                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Key Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| PRD | Product requirements | `docs/01-prd.md` |
| Architecture | System design | `docs/02-architecture.md` |
| Technical Spec | Implementation details | `docs/03-technical-spec.md` |
| SDK Docs | API reference | `packages/workflow-engine/SDK.md` |
| Deployment Summary | Deployed programs | `docs/DEVNET_DEPLOYMENT_SUMMARY.md` |
| Project Status | Current status | `docs/PROJECT_STATUS_CORRECTED.md` |

---

## 🧪 Common Commands

### Build

```bash
# Build all
pnpm build

# Build specific package
cd packages/workflow-engine && pnpm build

# Build Solana program
cd apps/agent-arena/program && cargo build-sbf
```

### Test

```bash
# Workflow Engine
cd packages/workflow-engine && pnpm test

# Agent Arena (unit)
cd apps/agent-arena/program && cargo test

# Agent Arena (integration)
cd apps/agent-arena/tests/integration-tests && cargo test

# Workflow Marketplace
cd programs/workflow-marketplace && cargo test
```

### Deploy

```bash
# Deploy to devnet
solana program deploy target/deploy/<program>.so --url devnet

# Verify deployment
solana program show <PROGRAM_ID> --url devnet
```

---

## 💡 Common Patterns

### Create and Execute Workflow

```typescript
import { WorkflowEngine, validate } from '@gradiences/workflow-engine';

// 1. Define workflow
const workflow = {
  id: 'my-workflow',
  name: 'Token Swap',
  steps: [
    {
      id: 'swap',
      action: 'swap',
      chain: 'solana',
      params: { from: 'SOL', to: 'USDC', amount: '1000000000' }
    }
  ],
  pricing: { model: 'free' },
  // ... other fields
};

// 2. Validate
const result = validate(workflow);
if (!result.success) throw new Error(result.error);

// 3. Execute
const engine = new WorkflowEngine(createAllHandlers());
engine.registerWorkflow(workflow);
const execution = await engine.execute(workflow.id, {});
```

### Interact with Agent Arena

```typescript
// Post task
await sdk.postTask({
  reward: 1000000000, // 1 SOL
  deadline: Date.now() + 86400000, // 1 day
  category: 'code',
  evalRef: 'ipfs://Qm...',
});

// Apply for task
await sdk.applyForTask(taskId, stakeAmount);

// Submit result
await sdk.submitResult(taskId, resultRef, runtimeEnv);
```

---

## 🔧 Troubleshooting

### Build Issues

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build

# Rust issues
rustup update
cargo clean
cargo build
```

### Test Issues

```bash
# Workflow Engine tests fail
pnpm test -- --reporter=verbose

# Agent Arena tests fail
# Check program binary exists
ls apps/agent-arena/target/deploy/gradience.so

# Regenerate client code
cd apps/agent-arena && pnpm run generate-clients
```

### Deployment Issues

```bash
# Check balance
solana balance --url devnet

# Request airdrop
solana airdrop 2 --url devnet

# Verify program
solana program show <PROGRAM_ID> --url devnet
```

---

## 📞 Support

- **Documentation**: See `docs/` directory
- **Issues**: Check existing tasks in `docs/tasks/`
- **Tests**: Reference test files for usage examples

---

**Last Updated**: 2026-04-04  
**Status**: Core protocol 100% implemented ✅
