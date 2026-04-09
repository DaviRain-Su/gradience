---
linear-id: GRA-M5
title: '[Integration] XMTP Payment Confirmations + OWS Wallet'
status: todo
priority: P0
project: 'Mid-Term Integration'
created: 2026-04-04
assignee: 'Code Agent'
tags: [task, p0, mid-term, integration, xmtp, ows]
---

# GRA-M5: [Integration] XMTP Payment Confirmations + OWS Wallet

## Description

Integrate XMTP payment confirmations with OWS wallet operations.

Complete payment flow:

```
1. Agent A (payer) ──XMTP──→ Agent B (payee): Payment Request
2. Agent B completes service
3. Evaluator verifies (off-chain)
4. Chain Hub settles (on-chain)
5. Agent A ──XMTP──→ Agent B: Payment Confirmation (with txHash)
6. Agent B verifies settlement, sends Receipt
7. Both parties have cryptographic proof
```

## Components

### XMTP Payment Channel

- Establish MLS-encrypted channel between Agents
- Send/confirm payment messages
- Receipt verification

### OWS Integration

- Sign payment requests
- Verify settlement on-chain
- Update wallet balance

### Chain Hub Bridge

- Verify txHash exists on-chain
- Confirm settlement amount matches

## Acceptance Criteria

- [ ] End-to-end payment flow working
- [ ] XMTP channel establishment
- [ ] Payment request signing
- [ ] Settlement verification
- [ ] Receipt generation and validation
- [ ] Error handling for failed payments
- [ ] Integration tests

## Dependencies

- GRA-M1: XMTP Adapter
- GRA-M2: Payment confirmation schema
- GRA-M3: OWS Wallet-per-Agent
- GRA-M4: Reputation-policy binding

## Related

- GRA-M8: Evaluator → Chain Hub bridge

## Log

- 2026-04-04: Created as part of mid-term integration planning
