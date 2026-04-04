---
linear-id: GRA-M3
title: "[OWS] Implement Wallet-per-Agent with Reputation Policies"
status: done
priority: P0
project: "Mid-Term Integration"
created: 2026-04-04
assignee: "Code Agent"
tags: [task, p0, mid-term, ows, wallet]
---

# GRA-M3: [OWS] Implement Wallet-per-Agent with Reputation Policies

## Description
Implement OWS Wallet-per-Agent in Agent Daemon with reputation-driven policies.

Core innovation: Agent's wallet spending limits are determined by on-chain reputation.

## Policy Formula
```typescript
// From strategic-integration-analysis.md
dailyLimit = reputationScore * 10
maxTransaction = reputationScore * 2
requireApproval = reputationScore < 80
allowedChains = getChainsByReputation(reputationScore)
```

## Implementation

### Agent Daemon Extension
```
apps/agent-daemon/src/wallet/
├── ows-wallet.ts       # OWS sub-wallet management
├── policy-engine.ts    # Reputation → Policy calculation
└── x402-payment.ts     # x402 protocol integration
```

### Key Features
1. **Sub-wallet Creation**: Each Agent gets dedicated OWS sub-wallet
2. **Reputation Sync**: Periodic sync with Chain Hub reputation
3. **Policy Enforcement**: Enforce limits at wallet level
4. **Dynamic Updates**: Auto-adjust policy on reputation change

## Acceptance Criteria
- [ ] `OWSWalletManager` class in Agent Daemon
- [ ] Sub-wallet creation per Agent
- [ ] Reputation → Policy calculation engine
- [ ] Daily limit enforcement
- [ ] Transaction approval workflow
- [ ] Integration with existing `authorization.ts`
- [ ] Tests for policy edge cases

## Dependencies
- Agent Daemon core
- OWS SDK (`@openwallet/sdk`)
- Chain Hub reputation API

## Related
- GRA-M4: Reputation-policy binding
- GRA-M5: XMTP payment confirmations
- GRA-58/59: OWS Hackathon tasks

## Log
- 2026-04-04: Created as part of mid-term integration planning
