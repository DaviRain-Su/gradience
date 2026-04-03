# Triton Cascade Integration

High-performance Solana transaction delivery through Triton One's Cascade network.

## Features

- **Cascade Transaction Delivery**: Low-latency, high-reliability transaction submission
- **Jito Bundle Support**: MEV protection through Jito bundles
- **Automatic Retry**: Exponential backoff with jitter for failed transactions
- **Priority Fee Estimation**: Dynamic fee calculation based on network conditions
- **Health Monitoring**: Automatic failover and connection health tracking
- **Transaction Queue**: Controlled concurrency with backpressure

## Installation

```bash
pnpm add @gradience/triton-cascade
```

## Quick Start

```typescript
import { TritonCascadeClient } from '@gradience/triton-cascade';

// Create client
const client = new TritonCascadeClient({
  rpcEndpoint: 'https://api.triton.one/rpc',
  apiToken: process.env.TRITON_API_TOKEN,
  network: 'mainnet',
  enableJitoBundle: true,
});

// Send transaction
const response = await client.sendTransaction(transactionBase64, {
  transactionType: 'swap',
  useJitoBundle: true,
});

console.log('Transaction confirmed:', response.signature);
console.log('Delivery path:', response.deliveryPath);

// Close client
await client.close();
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRITON_RPC_ENDPOINT` | Triton RPC endpoint | `https://api.triton.one/rpc` |
| `TRITON_API_TOKEN` | API token for authentication | - |
| `SOLANA_NETWORK` | Network type (`mainnet` or `devnet`) | `devnet` |
| `ENABLE_JITO_BUNDLE` | Enable Jito Bundle support | `false` |
| `JITO_BLOCK_ENGINE_URL` | Custom Jito block engine URL | - |
| `TRITON_PRIORITY_FEE_STRATEGY` | Fee strategy (`auto`, `fixed`, `none`) | `auto` |

### Programmatic Configuration

```typescript
import { TritonCascadeClient, createDefaultConfig } from '@gradience/triton-cascade';

const config = createDefaultConfig('mainnet');

const client = new TritonCascadeClient({
  ...config,
  apiToken: 'your-api-token',
  enableJitoBundle: true,
  priorityFeeStrategy: 'auto',
  maxRetries: 5,
});
```

## Usage Examples

### Swap Transaction

```typescript
const response = await client.sendTransaction(swapTransactionBase64, {
  transactionType: 'swap',
  useJitoBundle: true,
  commitment: 'confirmed',
  metadata: {
    route: ['Orca', 'Raydium'],
    expectedOutput: '1000000',
  },
});
```

### Transfer with Custom Priority Fee

```typescript
const response = await client.sendTransaction(transferTransactionBase64, {
  transactionType: 'transfer',
  priorityFee: 20000, // microLamports
  commitment: 'confirmed',
});
```

### Get Priority Fee Estimate

```typescript
const estimate = await client.getPriorityFeeEstimate('confirmed');

console.log('Recommended fee:', estimate.recommended);
console.log('High priority fee:', estimate.high);
```

### Get Health Status

```typescript
const health = await client.getHealthStatus();

console.log('Healthy:', health.isHealthy);
console.log('Latency:', health.latencyMs, 'ms');
console.log('Success rate:', health.successRate);
```

### Get Metrics

```typescript
const metrics = client.getMetrics();

console.log('Submitted:', metrics.transactionsSubmitted);
console.log('Confirmed:', metrics.transactionsConfirmed);
console.log('Failed:', metrics.transactionsFailed);
console.log('Average latency:', metrics.averageLatencyMs, 'ms');
```

## Error Handling

```typescript
import { CascadeError, isRetryableError } from '@gradience/triton-cascade';

try {
  const response = await client.sendTransaction(transaction);
} catch (error) {
  if (error instanceof CascadeError) {
    console.log('Error code:', error.code);
    console.log('Retryable:', error.retryable);
    console.log('Message:', error.message);
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TritonCascadeClient                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Queue      │  │   Health     │  │     Fee      │      │
│  │  Manager     │  │   Monitor    │  │  Estimator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                        │
│  │     RPC      │  │     Jito     │                        │
│  │   Client     │  │   Bundle     │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Testing

```bash
# Run unit tests
pnpm test:unit

# Run integration tests (requires TRITON_API_TOKEN)
TRITON_API_TOKEN=xxx pnpm test:integration

# Run with coverage
pnpm test:coverage
```

## License

MIT
