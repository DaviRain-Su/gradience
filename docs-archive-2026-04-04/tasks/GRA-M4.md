---
linear-id: GRA-M4
title: "[OWS] Build Reputation-Policy Binding Engine"
status: done
priority: P1
project: "Mid-Term Integration"
created: 2026-04-04
assignee: "Code Agent"
tags: [task, p1, mid-term, ows, reputation]
---

# GRA-M4: [OWS] Build Reputation-Policy Binding Engine

## Description
Build engine that binds on-chain reputation to OWS wallet policies.

## Architecture

```typescript
interface ReputationPolicyEngine {
  // Read reputation from Chain Hub
  async getReputation(agentId: string): Promise<ReputationData>;
  
  // Calculate policy from reputation
  calculatePolicy(reputation: ReputationData): WalletPolicy;
  
  // Apply policy to OWS wallet
  async applyPolicy(wallet: OWSWallet, policy: WalletPolicy): Promise<void>;
  
  // Listen for reputation changes
  onReputationUpdate(agentId: string, callback: (newRep) => void): void;
}

interface WalletPolicy {
  dailyLimit: number;        // USD equivalent
  maxTransaction: number;    // USD equivalent
  requireApproval: boolean;  // Manual approval required
  allowedChains: string[];   // Supported chains
  allowedTokens: string[] | null; // null = all tokens
}
```

## Policy Tiers

| Reputation Score | Tier | Daily Limit | Require Approval | Allowed Tokens |
|-----------------|------|-------------|------------------|----------------|
| 0-30 | Bronze | $300 | Yes | USDC, USDT |
| 31-50 | Silver | $500 | Yes | USDC, USDT, ETH |
| 51-80 | Gold | $800 | Score < 80 | Major tokens |
| 81-100 | Platinum | $1000 | No | All tokens |

## Acceptance Criteria
- [ ] Reputation fetch from Chain Hub Indexer
- [ ] Policy calculation with all tiers
- [ ] Automatic policy updates on reputation change
- [ ] Event-driven architecture
- [ ] Policy conflict resolution
- [ ] Audit log for policy changes

## Dependencies
- GRA-M3: OWS Wallet-per-Agent
- Chain Hub Indexer API

## Related
- GRA-M5: XMTP + OWS payment integration

## Log
- 2026-04-04: Created as part of mid-term integration planning
