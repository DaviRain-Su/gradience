# Workflow Engine SDK

## Overview

The Workflow Engine SDK provides both **off-chain** execution and **on-chain** marketplace functionality.

- **Off-chain**: Execute workflows locally with the `WorkflowEngine`
- **On-chain**: Interact with the deployed Solana program using `SolanaWorkflowSDK`

## Installation

```bash
npm install @gradiences/workflow-engine @solana/web3.js
```

## Quick Start

### Off-Chain Execution

```typescript
import { createWorkflowEngine, createAllHandlers } from '@gradiences/workflow-engine';

const engine = createWorkflowEngine();

const workflow = {
  id: 'my-workflow',
  name: 'Simple Swap',
  steps: [
    {
      id: 'swap',
      action: 'swap',
      chain: 'solana',
      params: { from: 'SOL', to: 'USDC', amount: '1000000000' }
    }
  ],
  // ... other required fields
};

const result = await engine.execute(workflow.id, {});
```

### On-Chain Marketplace

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { createSolanaWorkflowSDK } from '@gradiences/workflow-engine';

const connection = new Connection('https://api.devnet.solana.com');
const payer = Keypair.fromSecretKey(/* your secret key */);

const sdk = createSolanaWorkflowSDK({ connection, payer });

// Create workflow on-chain
const workflowId = Keypair.generate().publicKey;
await sdk.createWorkflow(workflow, workflowId);

// Purchase workflow
await sdk.purchaseWorkflow(workflowId);

// Review workflow
await sdk.reviewWorkflow(workflowId, 5, 'Great workflow!');
```

## API Reference

### SolanaWorkflowSDK

#### Constructor

```typescript
const sdk = new SolanaWorkflowSDK({
  connection: Connection,
  payer: Keypair,
  programId?: PublicKey  // Optional, defaults to deployed program
});
```

#### Methods

##### `initialize(treasury, upgradeAuthority): Promise<string>`

Initialize the program (one-time setup).

```typescript
await sdk.initialize(
  new PublicKey('...'), // treasury
  payer.publicKey       // upgrade authority
);
```

##### `createWorkflow(workflow, workflowId): Promise<string>`

Create a new workflow on-chain.

```typescript
const workflowId = Keypair.generate().publicKey;
const signature = await sdk.createWorkflow(workflow, workflowId);
```

##### `purchaseWorkflow(workflowId, accessType?): Promise<string>`

Purchase a workflow.

```typescript
await sdk.purchaseWorkflow(workflowId);
// or with access type: 0=purchased, 1=subscribed, 2=rented
await sdk.purchaseWorkflow(workflowId, 1);
```

##### `reviewWorkflow(workflowId, rating, comment): Promise<string>`

Leave a review (requires purchase).

```typescript
await sdk.reviewWorkflow(workflowId, 5, 'Excellent!');
```

##### `updateWorkflow(workflowId, newContentHash): Promise<string>`

Update workflow metadata (author only).

```typescript
await sdk.updateWorkflow(workflowId, 'ipfs://QmNewHash');
```

##### `deactivateWorkflow(workflowId): Promise<string>`

Deactivate workflow (author only).

```typescript
await sdk.deactivateWorkflow(workflowId);
```

##### `activateWorkflow(workflowId): Promise<string>`

Activate workflow (author only).

```typescript
await sdk.activateWorkflow(workflowId);
```

##### `deleteWorkflow(workflowId): Promise<string>`

Delete workflow (author only, requires 0 purchases).

```typescript
await sdk.deleteWorkflow(workflowId);
```

##### `hasAccess(workflowId, user?): Promise<boolean>`

Check if user has access to workflow.

```typescript
const hasAccess = await sdk.hasAccess(workflowId);
```

##### `getWorkflow(workflowId): Promise<OnChainWorkflowMetadata | null>`

Get workflow metadata from chain.

```typescript
const metadata = await sdk.getWorkflow(workflowId);
console.log(metadata.totalPurchases, metadata.avgRating);
```

#### Helper Methods

```typescript
// Get PDA addresses
sdk.getConfigAddress(): PublicKey
sdk.getTreasuryAddress(): PublicKey
sdk.getWorkflowAddress(workflowId): PublicKey
sdk.getAccessAddress(workflowId, user?): PublicKey
sdk.getReviewAddress(workflowId, reviewer?): PublicKey
```

### Instruction Builders (Low-Level)

For advanced use cases, you can build instructions manually:

```typescript
import {
  createInitializeInstruction,
  createCreateWorkflowInstruction,
  createPurchaseWorkflowInstruction,
  createReviewWorkflowInstruction,
  createUpdateWorkflowInstruction,
  createDeactivateWorkflowInstruction,
  createActivateWorkflowInstruction,
  createDeleteWorkflowInstruction,
} from '@gradiences/workflow-engine';

const instruction = createCreateWorkflowInstruction(author, params);
const transaction = new Transaction().add(instruction);
```

## Types

### OnChainWorkflowMetadata

```typescript
interface OnChainWorkflowMetadata {
  workflowId: PublicKey;
  author: PublicKey;
  contentHash: string;
  version: string;
  pricingModel: number;      // 0-4 (free, oneTime, subscription, perUse, revenueShare)
  priceMint: PublicKey;
  priceAmount: bigint;
  creatorShare: number;      // bps (0-10000)
  totalPurchases: number;
  totalExecutions: number;
  avgRating: number;         // 0-10000 (10000 = 5 stars)
  isPublic: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CreateWorkflowParams

```typescript
interface CreateWorkflowParams {
  workflowId: PublicKey;
  contentHash: Buffer;       // 64 bytes
  version: string;           // max 16 bytes
  pricingModel: number;      // 0-4
  priceMint: PublicKey;
  priceAmount: bigint;
  creatorShare: number;      // bps (0-10000)
  isPublic: boolean;
}
```

## Examples

### Complete Workflow Lifecycle

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { createSolanaWorkflowSDK } from '@gradiences/workflow-engine';

const connection = new Connection('https://api.devnet.solana.com');
const payer = Keypair.fromSecretKey(/* ... */);
const sdk = createSolanaWorkflowSDK({ connection, payer });

// 1. Create workflow
const workflowId = Keypair.generate().publicKey;
await sdk.createWorkflow(myWorkflow, workflowId);

// 2. User purchases
await sdk.purchaseWorkflow(workflowId);

// 3. User reviews
await sdk.reviewWorkflow(workflowId, 5, 'Great!');

// 4. Check metadata
const metadata = await sdk.getWorkflow(workflowId);
console.log('Purchases:', metadata.totalPurchases);
console.log('Rating:', metadata.avgRating / 2000, '/ 5');

// 5. Author updates
await sdk.updateWorkflow(workflowId, 'ipfs://QmNewVersion');

// 6. Author deactivates
await sdk.deactivateWorkflow(workflowId);

// 7. Author reactivates
await sdk.activateWorkflow(workflowId);
```

### Check Access Before Execution

```typescript
const workflowId = new PublicKey('...');

if (await sdk.hasAccess(workflowId)) {
  // Execute workflow off-chain
  const engine = createWorkflowEngine();
  const result = await engine.execute(workflow.id, params);
} else {
  // Purchase first
  await sdk.purchaseWorkflow(workflowId);
}
```

### Browse Workflows (using PDA addresses)

```typescript
// Get all workflow PDAs
const workflowIds = [/* ... your workflow IDs ... */];

for (const id of workflowIds) {
  const metadata = await sdk.getWorkflow(id);
  if (metadata && metadata.isActive && metadata.isPublic) {
    console.log(`${metadata.version}: ${metadata.totalPurchases} purchases`);
  }
}
```

## Error Handling

```typescript
try {
  await sdk.deleteWorkflow(workflowId);
} catch (error) {
  if (error.message.includes('0x1778')) {
    console.error('Cannot delete: workflow has purchases');
  } else {
    console.error('Failed:', error);
  }
}
```

## Program Details

- **Program ID**: `3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW`
- **Network**: Solana Devnet
- **Explorer**: https://explorer.solana.com/address/3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW?cluster=devnet

## PDA Seeds

| PDA Type | Seeds |
|----------|-------|
| Config | `["config"]` |
| Treasury | `["treasury"]` |
| Workflow | `["workflow", workflow_id]` |
| Access | `["access", workflow_id, user]` |
| Review | `["review", workflow_id, reviewer]` |

## Next Steps

- See `examples/solana-sdk-example.ts` for complete example
- See `DEPLOYMENT.md` for program details
- See `TEST_REPORT.md` for integration test results
