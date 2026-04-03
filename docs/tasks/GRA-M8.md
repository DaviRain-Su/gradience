---
linear-id: GRA-M8
title: "[Bridge] Evaluator → Chain Hub Settlement Bridge"
status: done
priority: P0
project: "Mid-Term Integration"
created: 2026-04-04
assignee: "Code Agent"
tags: [task, p0, mid-term, bridge, evaluator, chain-hub]
---

# GRA-M8: [Bridge] Evaluator → Chain Hub Settlement Bridge

## Description
Build bridge from off-chain Evaluator to on-chain Chain Hub settlement.

## Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Evaluator  │────→│   Bridge    │────→│  Chain Hub  │────→│  Settlement │
│  (Score 85) │     │  (Proof)    │     │(Verify+Settle)    │  (Complete) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                    XMTP Confirmation
```

## Bridge Components

### 1. Proof Generation
```typescript
interface EvaluationProof {
  taskId: string;
  agentId: string;
  score: number;           // 0-100
  evaluatorId: string;     // Evaluator identity
  verificationHash: string; // Hash of verification data
  timestamp: number;
  signature: string;       // Evaluator signature
}
```

### 2. Chain Hub Integration
Chain Hub uses `complete_delegation_task` instruction:

```rust
// Chain Hub program instruction
pub fn complete_delegation_task(
    ctx: Context<CompleteDelegationTask>,
    evaluation_proof: EvaluationProof,
    score: u8,  // 0-100
) -> Result<()>
```

### 3. Settlement Logic
- Verify evaluator signature
- Verify task exists and is in correct state
- Distribute funds: 95% Agent, 3% Judge, 2% Protocol
- Update on-chain reputation

## Acceptance Criteria
- [ ] Bridge service implementation
- [ ] Proof generation and validation
- [ ] Chain Hub instruction integration
- [ ] Transaction construction and signing
- [ ] Retry logic for failed settlements
- [ ] Settlement confirmation via XMTP
- [ ] Error handling and recovery

## Dependencies
- GRA-M6: Evaluator runtime
- GRA-M7: Playwright harness
- Chain Hub program
- Agent Daemon (for signing)

## Related
- GRA-M5: XMTP payment confirmations
- GRA-M9: Chain Hub external evaluation instruction (if needed)

## Log
- 2026-04-04: Created as part of mid-term integration planning
