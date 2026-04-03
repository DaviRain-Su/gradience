# @gradiences/workflow-engine

> Workflow Engine for Gradience Protocol — Composable, tradeable Agent skills

## Overview

The Workflow Engine enables AI Agents to execute complex, multi-chain operations defined as composable workflows. Think of it as "IFTTT for AI Agents" — but decentralized, verifiable, and tradeable.

### Key Concepts

- **Workflow**: A JSON-defined sequence of operations (steps) that an Agent can execute
- **Step**: A single operation (swap, bridge, API call, etc.) with parameters and conditions
- **Handler**: Implementation of an operation type (19 built-in handlers)
- **Engine**: The runtime that executes workflows step by step
- **Marketplace**: On-chain registry for buying, selling, and rating workflows

## Installation

```bash
npm install @gradiences/workflow-engine
# or
pnpm add @gradiences/workflow-engine
```

## Quick Start

### 1. Create a Simple Workflow

```typescript
import { validate, type GradienceWorkflow } from '@gradiences/workflow-engine';

const workflow: GradienceWorkflow = {
  id: 'my-first-workflow',
  name: 'Hello World',
  description: 'A simple greeting workflow',
  author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
  version: '1.0.0',
  steps: [
    {
      id: 'step1',
      name: 'Log Message',
      chain: 'solana',
      action: 'log',
      params: { message: 'Hello from Gradience!' }
    }
  ],
  pricing: { model: 'free' },
  revenueShare: { creator: 0, user: 9500, agent: 0, protocol: 200, judge: 300 },
  requirements: {},
  isPublic: true,
  isTemplate: false,
  tags: ['example'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  contentHash: 'ipfs://Qm...',
  signature: '...'
};

// Validate
const result = validate(workflow);
if (!result.success) {
  console.error(result.error);
}
```

### 2. Execute the Workflow

```typescript
import { WorkflowEngine, createAllHandlers } from '@gradiences/workflow-engine';

// Create engine with all default handlers
const engine = new WorkflowEngine(createAllHandlers());

// Register workflow
engine.registerWorkflow(workflow);

// Execute
const execution = await engine.execute(workflow.id, {
  executor: 'my-agent-address'
});

console.log('Status:', execution.status);
console.log('Steps:', execution.stepResults);
```

### 3. Cross-Chain Arbitrage Example

```typescript
const arbitrageWorkflow: GradienceWorkflow = {
  id: 'usdc-arbitrage-v1',
  name: 'USDC Cross-Chain Arbitrage',
  steps: [
    {
      id: 'check-solana',
      name: 'Get Solana Price',
      chain: 'solana',
      action: 'httpRequest',
      params: { url: 'https://api.jupiter.ag/v4/price?id=USDC' },
      next: 'check-arbitrum'
    },
    {
      id: 'check-arbitrum',
      name: 'Get Arbitrum Price',
      chain: 'arbitrum',
      action: 'httpRequest',
      params: { url: 'https://api.arbitrum.io/price/USDC' },
      next: 'compare'
    },
    {
      id: 'compare',
      name: 'Check Spread',
      chain: 'solana',
      action: 'condition',
      params: {
        expression: '{{check-solana.output.price}} > {{check-arbitrum.output.price}} * 1.01'
      },
      next: 'execute-swap'
    },
    {
      id: 'execute-swap',
      name: 'Execute Arbitrage',
      chain: 'solana',
      action: 'swap',
      params: {
        from: 'USDC',
        to: 'SOL',
        amount: '1000000000',
        slippage: 0.5
      }
    }
  ],
  // ... rest of workflow definition
};
```

## Available Handlers

### Trading/DeFi
- `swap` — DEX token swap (Jupiter, Orca)
- `bridge` — Cross-chain bridge (Wormhole, LayerZero)
- `transfer` — Token transfer
- `stake` / `unstake` — Staking operations
- `yieldFarm` — Liquidity provision
- `borrow` / `repay` — Lending operations

### Payment
- `x402Payment` — HTTP 402 micro-payments
- `mppStreamReward` — Tempo MPP streaming rewards
- `teePrivateSettle` — X Layer TEE private settlement
- `zeroGasExecute` — X Layer zero-gas execution

### Utility
- `httpRequest` — HTTP API calls
- `wait` — Delay/wait
- `condition` — Conditional logic
- `parallel` — Parallel execution
- `loop` — Loop execution
- `setVariable` — Set variables
- `log` — Logging

## SDK Usage

```typescript
import { createWorkflowSDK } from '@gradiences/workflow-engine';

const sdk = createWorkflowSDK({
  rpcEndpoint: 'https://api.devnet.solana.com',
  wallet: myWalletAdapter
});

// Create workflow
const workflowId = await sdk.create(workflow);

// Purchase workflow
const accessId = await sdk.purchase(workflowId);

// Execute
const result = await sdk.execute(workflowId, {
  recipient: '5Y3d...',
  amount: '1000000'
});

// Browse marketplace
const workflows = await sdk.browse({
  tags: ['arbitrage'],
  sortBy: 'popular'
});

// Review
await sdk.review(workflowId, 5, 'Excellent workflow!');
```

## Template Variables

Use template variables to pass data between steps:

```typescript
{
  id: 'step2',
  action: 'transfer',
  params: {
    to: '{{step1.output.recipient}}',
    amount: '{{step1.output.amount}}'
  }
}
```

## Conditions

Skip or abort steps based on conditions:

```typescript
{
  id: 'check',
  action: 'condition',
  condition: {
    expression: '{{step1.output.balance}} > 1000',
    onFalse: 'skip' // or 'abort' or 'goto'
  }
}
```

## Error Handling

```typescript
{
  id: 'risky-step',
  action: 'swap',
  retries: 3,
  retryDelay: 1000,
  timeout: 30000,
  optional: true, // Don't fail workflow if this step fails
  onError: 'cleanup-step'
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test -- tests/e2e.test.ts
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Engine                          │
├─────────────────────────────────────────────────────────────┤
│  SDK Layer    │  createWorkflow, purchase, execute, review  │
├───────────────┼─────────────────────────────────────────────┤
│  Engine Layer │  WorkflowEngine, StepExecutor               │
├───────────────┼─────────────────────────────────────────────┤
│  Handler Layer│  Trading, Payment, Utility (19 handlers)    │
├───────────────┼─────────────────────────────────────────────┤
│  Schema Layer │  Types, Validation, Template Parser         │
├───────────────┼─────────────────────────────────────────────┤
│  Chain Layer  │  Solana Program (Marketplace)               │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
