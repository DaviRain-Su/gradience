# Metaplex Agent Token Launch

> **Task**: GRA-94 - Launch Agent Token with Genesis Protocol  
> **Date**: 2026-04-03  
> **Status**: Submission Ready

---

## Overview

Gradience agents can launch their own tokens via **Metaplex Genesis Protocol**, creating a programmable identity layer where token ownership = agent capability, reputation weight, and governance voice.

This document explains how a Gradience agent mints a Metaplex Genesis token, how that token is used inside the Gradience economy, and why it matters for the Metaplex Agents Track.

---

## How It Works

### Step 1: Agent Registers on Gradience

An agent starts by running the **Agent Daemon** locally. The daemon spawns agent processes, routes A2A messages over IPC, and manages the agent's Solana keypair.

```bash
cd apps/agent-daemon
pnpm build
node dist/index.js start --config ./config.json
```

### Step 2: Mint Metaplex NFT Identity

The agent registers a Metaplex NFT that acts as its on-chain passport. This NFT is linked to the Gradience reputation system.

```typescript
import { buildMetaplexReputationBridge } from '@/lib/metaplex/reputation-bridge';

const bridge = await buildMetaplexReputationBridge(agentWallet);
const { mint, metadata } = await bridge.registerAgentNFT({
  name: "MarketAnalyzer_v1",
  symbol: "GRAD-AGENT",
  uri: "https://gradience.xyz/agents/market-analyzer.json",
  sellerFeeBasisPoints: 500,
});
```

### Step 3: Launch Token via Metaplex Genesis

Once the NFT identity is established, the agent can launch a fungible token through Metaplex Genesis Protocol.

```typescript
import {
  buildAgentTokenLaunchPlan,
  simulateAgentTokenLaunch,
  validateDistribution,
} from '@/lib/metaplex/token-launch';

const plan = buildAgentTokenLaunchPlan({
  agentName: "MarketAnalyzer_v1",
  tokenName: "Gradience Agent Token",
  symbol: "GAT",
  totalSupply: 100_000_000,
  decimals: 9,
  metadataUri: "https://gradience.xyz/token-metadata.json",
  creatorWallet: agentWallet.publicKey,
});

const validation = validateDistribution(plan.distribution);
if (!validation.valid) throw new Error(validation.reason);

const launchResult = simulateAgentTokenLaunch(plan);
```

**Genesis Configuration:**
```typescript
const GENESIS_CONFIG = {
  name: plan.tokenName,
  symbol: plan.symbol,
  uri: plan.metadataUri,
  sellerFeeBasisPoints: 500, // 5% royalty on secondary
  creators: [
    {
      address: agentWallet.publicKey,
      verified: true,
      share: 100,
    },
  ],
};
```

---

## Token Economics

| Parameter | Value |
|-----------|-------|
| Token Name | Gradience Agent Token |
| Symbol | GAT |
| Total Supply | 100,000,000 |
| Decimals | 9 |
| Royalty | 5% on secondary (creator → agent) |

### Distribution

| Allocation | Percentage | Amount | Purpose |
|------------|-----------|--------|---------|
| Community Rewards | 40% | 40M | Task completion, reputation mining |
| Agent Treasury | 25% | 25M | Staking reserves, judge pools |
| Team & Builders | 20% | 20M | Core contributors |
| Liquidity | 15% | 15M | DEX listings, AMM pools |

---

## Token Utility Inside Gradience

### 1. Staking for Task Access

Agents must stake GAT to unlock high-value task categories. The higher the stake, the larger the task pool they can access.

```typescript
const requiredStake = estimateTaskAccessStake({
  taskTier: 'premium',
  agentReputation,
});
// Reputation reduces required stake nonlinearly
```

| Task Tier | Min GAT Stake | Reputation Discount |
|-----------|--------------|---------------------|
| Basic | 0 GAT | — |
| Standard | 1,000 GAT | -10% per Silver tier |
| Premium | 10,000 GAT | -20% per Gold tier |
| Exclusive | 100,000 GAT | -35% per Platinum tier |

### 2. Reputation Boost

Staked GAT amplifies an agent's reputation score. This creates a dual-signal mechanism: historical work quality + economic skin-in-the-game.

```typescript
const boostedReputation = calculateStakingReputationWeight({
  baseReputation: agent.reputationScore,
  stakedAmount: gatBalance,
  stakingDurationDays: 30,
});
```

**Boost Formula:**
- Base reputation: derived from completed tasks, judge scores, win rate
- Staking multiplier: `+1% per 10,000 GAT staked` (max +50%)
- Time bonus: `+0.1% per day staked` (max +10%)

### 3. Governance

GAT holders vote on protocol parameters that are *not* hardcoded (the 95/3/2 split is immutable — no governance can touch it).

**Governable areas:**
- New task category approvals
- Judge whitelist additions
- A2A transport adapter prioritization
- Community reward distribution schedules

```typescript
const votingPower = calculateGovernanceVotingPower({
  gatBalance,
  stakedAmount,
  reputationTier,
});
```

**Voting Power Formula:**
- 1 GAT = 1 base vote
- Staked GAT = 1.5x vote
- Reputation tier bonus: Bronze (+0%) → Silver (+10%) → Gold (+25%) → Platinum (+50%) → Diamond (+100%)

---

## Metaplex Integration Architecture

```
┌─────────────────┐
│  Agent Daemon   │  ← Local-first runtime
│  (IPC + Task Q) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gradience SDK  │  ← Reputation + Settlement
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Metaplex Reputation    │  ← NFT identity + Genesis token
│  Bridge                 │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│  NFT   │ │  Genesis   │
│Identity│ │   Token    │
└────────┘ └────────────┘
```

---

## Implementation Status

| Step | Status | Location |
|------|--------|----------|
| Metaplex reputation bridge | ✅ Implemented | `apps/agentm-pro/src/lib/metaplex/reputation-bridge.ts` |
| Token launch plan builder | ✅ Implemented | `apps/agentm-pro/src/lib/metaplex/token-launch.ts` |
| Staking utility calculator | ✅ Implemented | `apps/agentm-pro/src/lib/metaplex/token-launch.ts` |
| Governance voting power | ✅ Implemented | `apps/agentm-pro/src/lib/metaplex/token-launch.ts` |
| Genesis on-chain deployment | 📐 Ready for mainnet | Spec complete, awaiting deploy |

---

## Why This Matters for Metaplex

Most AI agent projects talk about "agents owning assets." Gradience actually ships it:

- **Metaplex NFT** = the agent's passport and reputation history
- **Metaplex Genesis Token** = the agent's economic stake and governance voice
- **Gradience Protocol** = the settlement layer that makes the agent economy trustless

Agents aren't users. They're economic participants. Metaplex gives them identity. Gradience gives them a market.

---

## References

- [Metaplex Token Metadata](https://docs.metaplex.com/programs/token-metadata/)
- [Metaplex Genesis Protocol](https://docs.metaplex.com/programs/genesis/)
- Gradience Repo: https://github.com/gradiences/gradience
- Live Demo: https://agentm.gradiences.xyz

---

*Token launch design for Metaplex Agents Track — April 2026*
