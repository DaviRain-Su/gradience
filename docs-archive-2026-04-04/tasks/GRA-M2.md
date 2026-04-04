---
linear-id: GRA-M2
title: "[XMTP] Define Payment Confirmation Message Schema"
status: done
priority: P0
project: "Mid-Term Integration"
created: 2026-04-04
assignee: "Code Agent"
tags: [task, p0, mid-term, xmtp, payment]
---

# GRA-M2: [XMTP] Define Payment Confirmation Message Schema

## Description
Define XMTP message types for payment confirmations between Agents.

Payment flow:
1. Agent A requests service from Agent B
2. Agent B completes service, submits result
3. Evaluator verifies quality
4. Chain Hub settles payment
5. XMTP channel confirms payment receipt

## Message Types

```typescript
// Payment Request
interface PaymentRequestMessage {
  type: 'gradience:payment:request';
  taskId: string;
  amount: number;
  token: string;
  from: string; // Agent A address
  to: string;   // Agent B address
  deadline: number;
}

// Payment Confirmation
interface PaymentConfirmationMessage {
  type: 'gradience:payment:confirmed';
  taskId: string;
  txHash: string;
  amount: number;
  settledAt: number;
  signature: string; // Chain Hub settlement proof
}

// Receipt Verification
interface PaymentReceiptMessage {
  type: 'gradience:payment:receipt';
  taskId: string;
  confirmed: boolean;
  receiptHash: string;
}
```

## Acceptance Criteria
- [ ] Define TypeScript interfaces for all message types
- [ ] Message validation schema (zod)
- [ ] Receipt verification logic
- [ ] XMTP content type registration
- [ ] Unit tests for message serialization

## Dependencies
- GRA-M1: XMTP Adapter

## Related
- GRA-M5: XMTP + OWS payment integration
- GRA-M8: Evaluator → Chain Hub bridge

## Log
- 2026-04-04: Created as part of mid-term integration planning
