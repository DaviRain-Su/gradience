# Mid-Term Integration Documentation

> **Version**: 1.0  
> **Date**: 2026-04-04  
> **Status**: Implementation Complete

---

## Overview

This document describes the mid-term integration implementation for Gradience, covering the three core workstreams:

1. **XMTP Communication Layer** (GRA-M1, M2, M5)
2. **OWS Wallet Integration** (GRA-M3, M4)
3. **Evaluator & Settlement** (GRA-M6, M7, M8)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Economy Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    XMTP    ┌──────────────┐                  │
│  │   Agent A    │◄──────────►│   Agent B    │                  │
│  │  (Payer)     │  Payment   │   (Payee)    │                  │
│  └──────┬───────┘   Request  └──────┬───────┘                  │
│         │                           │                           │
│         │    ┌──────────────┐       │                           │
│         └───►│   Payment    │◄──────┘                           │
│              │   Service    │                                   │
│              └──────┬───────┘                                   │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │   Evaluator Runtime   │                               │
│         │  ┌─────────────────┐  │                               │
│         │  │  Sandbox        │  │                               │
│         │  │  Playwright     │  │                               │
│         │  │  Scoring Model  │  │                               │
│         │  └─────────────────┘  │                               │
│         └───────────┬───────────┘                               │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │  Settlement Bridge    │                               │
│         │  ┌─────────────────┐  │                               │
│         │  │  Proof Gen      │  │                               │
│         │  │  Chain Hub Tx   │  │                               │
│         │  │  Retry Logic    │  │                               │
│         │  └─────────────────┘  │                               │
│         └───────────┬───────────┘                               │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │     Chain Hub         │                               │
│         │   (Solana Program)    │                               │
│         └───────────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. XMTP Communication Layer

#### Files

- `apps/agentm/src/main/a2a-router/adapters/xmtp-adapter.ts`
- `apps/agentm/src/shared/a2a-payment-types.ts`
- `apps/agent-daemon/src/services/payment-service.ts`

#### Features

- **XMTP Adapter**: ProtocolAdapter implementation for XMTP
    - MLS E2E encryption
    - Wallet address as identity
    - Message streaming and polling
    - Conversation caching

- **Payment Types**: Complete payment message schema
    - PaymentRequest
    - PaymentConfirmation
    - PaymentReceipt
    - PaymentDispute

- **Payment Service**: End-to-end payment flow
    - Request/Accept/Complete states
    - XMTP message handling
    - OWS wallet integration

#### Usage

```typescript
// Initialize XMTP Adapter
const xmtpAdapter = new XMTPAdapter({
    env: 'dev',
    privateKey: '...',
    enableStreaming: true,
});

// Send payment request
await paymentService.requestPayment({
    payerAgentId: 'agent-a',
    payeeAgentId: 'agent-b',
    amount: '1000000',
    token: 'USDC',
    // ...
});
```

---

### 2. OWS Wallet Integration

#### Files

- `apps/agent-daemon/src/wallet/ows-wallet-manager.ts`
- `apps/agent-daemon/src/wallet/authorization.ts`

#### Features

- **Wallet-per-Agent**: Each Agent gets dedicated OWS sub-wallet
- **Reputation-Driven Policies**: Automatic policy calculation based on score
    - Bronze (0-30): $300 daily, approval required
    - Silver (31-50): $500 daily, approval required
    - Gold (51-80): $800 daily, no approval
    - Platinum (81-100): $1000 daily, no approval, all tokens

- **Policy Formula**:

    ```
    dailyLimit = reputationScore * 10
    maxTransaction = reputationScore * 2
    requireApproval = reputationScore < 80
    ```

- **Transaction Tracking**: Daily spend tracking, transaction history

#### Usage

```typescript
// Create wallet
const wallet = await walletManager.createWallet({
    agentId: 'agent-123',
    parentWallet: 'parent-address',
    name: 'agent-wallet',
    initialReputation: 75,
});

// Update reputation (auto-recalculates policy)
await walletManager.updateReputation('agent-123', {
    score: 85,
    completed: 10,
    // ...
});

// Check transaction limits
const check = walletManager.checkTransactionLimits(
    wallet,
    500, // $5.00 in cents
    'solana',
    'USDC',
);
```

---

### 3. Evaluator Runtime

#### Files

- `apps/agent-daemon/src/evaluator/runtime.ts`
- `apps/agent-daemon/src/evaluator/playwright-harness.ts`

#### Features

- **Independent Evaluation**: Evaluator has no shared state with Generator
- **Sandbox Isolation**: Docker/git-worktree isolation
- **Multiple Evaluation Types**:
    - Code: Build, test, lint, coverage
    - UI: Playwright screenshots, accessibility
    - API: Endpoint testing, contract validation
    - Content: LLM-as-judge

- **Drift Detection**: Context window monitoring with reset strategies
- **Cost Control**: Budget tracking for time, memory, API costs

#### Usage

```typescript
// Submit evaluation
const evaluationId = await evaluatorRuntime.submit({
  taskId: 'task-123',
  agentId: 'agent-456',
  type: 'code',
  submission: {
    type: 'git_repo',
    source: 'https://github.com/...',
  },
  criteria: {
    minScore: 70,
    rubric: { ... },
    requiredChecks: ['compiles', 'tests_pass'],
  },
  budget: {
    maxCostUsd: 5,
    maxTimeSeconds: 60,
    // ...
  },
});

// Listen for completion
evaluatorRuntime.on('completed', (result) => {
  console.log(`Score: ${result.score}/100`);
});
```

---

### 4. Settlement Bridge

#### Files

- `apps/agent-daemon/src/bridge/settlement-bridge.ts`
- `apps/agent-daemon/src/bridge/external-evaluation-stub.ts`

#### Features

- **Proof Generation**: Cryptographic proof of evaluation
- **Chain Hub Integration**: Submit to Solana program
- **Retry Logic**: Exponential backoff for failed submissions
- **Fund Distribution**: 95% Agent / 3% Judge / 2% Protocol

#### Usage

```typescript
// Create bridge
const bridge = await createSettlementBridge({
  chainHubProgramId: '...',
  rpcEndpoint: 'https://api.devnet.solana.com',
  evaluatorPrivateKey: '...',
});

// Settle evaluation
const result = await bridge.settle({
  evaluationId: 'eval-123',
  taskId: 'task-456',
  evaluationResult: { ... },
  amount: '1000000',
  // ...
});

// Create payment confirmation
const confirmation = bridge.createPaymentConfirmation(result, request);
```

---

## Integration Flow

### Complete Payment Flow

```
1. Agent A (payer) → PaymentService.requestPayment()
   └─► Checks OWS wallet policy
   └─► Creates PaymentRequest
   └─► Sends via XMTP to Agent B

2. Agent B (payee) → PaymentService.acceptPayment()
   └─► Updates payment status
   └─► Sends acceptance via XMTP

3. Agent B → PaymentService.markServiceComplete()
   └─► Submits work for evaluation

4. EvaluatorRuntime → submit()
   └─► Runs evaluation in sandbox
   └─► Generates score (0-100)
   └─► Emits 'completed' event

5. SettlementBridge → settle()
   └─► Generates evaluation proof
   └─► Submits to Chain Hub
   └─► Retries on failure
   └─► Distributes funds (95/3/2)

6. PaymentService → XMTP confirmation
   └─► Sends PaymentConfirmation
   └─► Updates payment status

7. Both parties have cryptographic proof
```

---

## Configuration

### Environment Variables

```bash
# XMTP
XMTP_ENV=dev|production
XMTP_PRIVATE_KEY=...

# OWS
OWS_NETWORK=devnet|mainnet
OWS_DEFAULT_CHAIN=solana

# Chain Hub
CHAIN_HUB_PROGRAM_ID=6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec
SOLANA_RPC_URL=https://api.devnet.solana.com

# Evaluator
EVALUATOR_MODEL=claude-opus-4
EVALUATOR_MAX_COST_USD=10
EVALUATOR_TIMEOUT_SECONDS=300

# Settlement
SETTLEMENT_MAX_RETRIES=3
SETTLEMENT_RETRY_DELAY_MS=1000
```

---

## Testing

### Unit Tests

```bash
# XMTP Adapter
cd apps/agentm && npm test src/main/a2a-router/adapters/xmtp-adapter.test.ts

# OWS Wallet Manager
cd apps/agent-daemon && npm test src/wallet/ows-wallet-manager.test.ts

# Evaluator Runtime
cd apps/agent-daemon && npm test src/evaluator/runtime.test.ts

# Settlement Bridge
cd apps/agent-daemon && npm test src/bridge/settlement-bridge.test.ts
```

### E2E Tests

```bash
cd apps/agent-daemon && npm test src/tests/e2e-payment-flow.test.ts
```

---

## Deployment Checklist

### Pre-deployment

- [ ] All unit tests passing
- [ ] E2E tests passing
- [ ] Chain Hub program deployed to devnet
- [ ] XMTP environment configured
- [ ] OWS SDK integrated

### Deployment

- [ ] Deploy Agent Daemon with new wallet manager
- [ ] Deploy AgentM with XMTP adapter
- [ ] Configure authorized evaluators
- [ ] Set reputation thresholds

### Post-deployment

- [ ] Monitor settlement success rate
- [ ] Track evaluation costs
- [ ] Verify fund distribution accuracy

---

## Future Enhancements

### GRA-M9: Chain Hub External Evaluation (Optional)

- Add `submit_external_evaluation` instruction to Solana program
- Implement authorized evaluator whitelist
- Enable auto-completion based on evaluation score

### Performance Optimizations

- Batch multiple settlements
- Cache evaluation results
- Optimize sandbox reuse

### Security Hardening

- Multi-sig for evaluator authorization
- Rate limiting on settlements
- Formal verification of proof validation

---

## References

- [Strategic Integration Analysis](../../docs/strategic-integration-analysis.md)
- [A2A Router Types](../../apps/agentm/src/shared/a2a-router-types.ts)
- [Payment Types](../../apps/agentm/src/shared/a2a-payment-types.ts)
- [Chain Hub Program](../../apps/chain-hub/program/src/)

---

**Implementation Status**: ✅ Complete (GRA-M1 through GRA-M8)
