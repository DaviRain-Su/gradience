# Multi-Chain Design: Move Chain Integration (Aptos/Sui)

---

## Overview

Extend Gradience Protocol to Move-based chains (Aptos and Sui), leveraging Move's resource-oriented programming for safe Agent escrow and reputation management.

## Why Move Chains

| Feature   | Solana              | Move (Aptos/Sui)               |
| --------- | ------------------- | ------------------------------ |
| Execution | Parallel (Sealevel) | Parallel (Block-STM / Narwhal) |
| State     | Account model       | Resource/Object model          |
| Safety    | Manual checks       | Type-system enforced ownership |
| TPS       | ~65k                | ~160k (Sui)                    |

Move's resource model is a natural fit for Agent state (profiles can't be accidentally copied or lost).

## Architecture

### Module Structure

```move
module gradience::agent_arena {
    struct Task has key, store {
        poster: address,
        judge: address,
        reward: Coin<APT>,
        state: u8,  // 0=Open, 1=Completed, 2=Refunded
        ...
    }

    struct AgentReputation has key, store {
        avg_score: u16,
        completed: u32,
        win_rate: u16,
        total_earned: u64,
    }

    public entry fun post_task(...) { ... }
    public entry fun apply_for_task(...) { ... }
    public entry fun submit_result(...) { ... }
    public entry fun judge_and_pay(...) { ... }
}
```

### Key Differences from Solana

| Aspect | Solana Implementation      | Move Implementation          |
| ------ | -------------------------- | ---------------------------- |
| Escrow | PDA-based lamport transfer | Resource-based Coin storage  |
| State  | Manual Borsh serialization | Native struct with abilities |
| Access | Signer + PDA validation    | Move type system enforcement |
| Events | CPI log emission           | Native event emission        |

## Target Chain

**Aptos** (primary) — larger DeFi ecosystem, Move stdlib
**Sui** (secondary) — object model, parallel execution

## Implementation Plan

1. **Phase 1**: Port `AgentLayerRaceTask` to Move (Aptos)
2. **Phase 2**: Cross-chain reputation bridge (Solana ↔ Aptos via Wormhole)
3. **Phase 3**: Sui adaptation (object-centric variant)

## Dependencies

- Aptos CLI + Move compiler
- Wormhole SDK for cross-chain messaging
- `@aptos-labs/ts-sdk` for TypeScript integration

## Timeline

- Phase 1: 3 weeks (Move module + tests)
- Phase 2: 2 weeks (Wormhole bridge)
- Phase 3: 2 weeks (Sui adaptation)
