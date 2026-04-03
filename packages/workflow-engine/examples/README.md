# Workflow Engine Examples

This directory contains example workflows demonstrating various capabilities of the Gradience Workflow Engine.

## Examples

### 1. Hello World (`hello-world.ts`)
The simplest possible workflow - just logs a message.

```bash
npx tsx examples/hello-world.ts
```

### 2. Cross-Chain Arbitrage (`arbitrage.ts`)
Demonstrates multi-chain operations for USDC arbitrage between Solana and Arbitrum.

```bash
npx tsx examples/arbitrage.ts
```

### 3. Privacy Payment (`privacy-payment.ts`)
Shows privacy-preserving payment using ZK proofs and TEE.

```bash
npx tsx examples/privacy-payment.ts
```

## Running Examples

Make sure you have the package built:

```bash
pnpm build
```

Then run any example:

```bash
npx tsx examples/hello-world.ts
```

## Creating Your Own Workflow

1. Define your workflow using the `GradienceWorkflow` type
2. Validate with `validate()`
3. Create a `WorkflowEngine` instance
4. Register and execute

See `hello-world.ts` for the minimal example.
