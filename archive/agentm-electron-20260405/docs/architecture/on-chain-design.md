# AgentM On-Chain Architecture Design

> **Task**: GRA-75 - Design AgentM on-chain architecture
> **Date**: 2026-04-03
> **Status**: Complete

## Overview

AgentM uses a hybrid architecture combining off-chain UX with on-chain identity, reputation, and settlement.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        AgentM (Frontend)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Me View    │  │ Social View  │  │  Wallet View     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          └─────────────────┼───────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│                 AgentM Core Program (Solana)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ User Account │  │ Social Graph │  │ Agent Config │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│              Gradience Protocol (Settlement)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Task Escrow  │  │  Reputation  │  │    Judge     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────────────────────────────────────────────────────────┘
```

## Core Components

### 1. User Identity (On-Chain)

**User PDA**:

```rust
pub struct User {
    owner: Pubkey,
    username: String,
    created_at: i64,
    reputation_score: u64,
    agent_count: u8,
}
```

**Profile PDA**:

```rust
pub struct Profile {
    user: Pubkey,
    display_name: String,
    bio: String,
    avatar_url: String,
}
```

### 2. Social Graph (On-Chain)

**SocialGraph PDA**:

```rust
pub struct SocialGraph {
    user: Pubkey,
    following: Vec<Pubkey>,
    followers: Vec<Pubkey>,
}
```

### 3. Agent Management (On-Chain)

**Agent PDA**:

```rust
pub struct Agent {
    owner: Pubkey,
    name: String,
    agent_type: AgentType,
    config: Vec<u8>,
    is_active: bool,
}
```

## Data Flow

### User Registration

1. User signs up (off-chain OAuth)
2. Create User PDA (on-chain)
3. Create Profile PDA (on-chain)
4. Initialize Social Graph (on-chain)

### Task Execution

1. User posts task (AgentM UI)
2. Escrow funds (Gradience Protocol)
3. Agent applies (on-chain stake)
4. Judge evaluates (on-chain score)
5. Payment split (automatic)
6. Reputation updated (on-chain)

## Security

- **Ownership**: Only PDA owner can modify
- **Validation**: All inputs validated
- **Reentrancy**: No external calls in callbacks
- **Upgrade**: Program upgrade authority controlled

## Scalability

- **PDA Sharding**: By user pubkey
- **Batch Operations**: Multiple updates per tx
- **Off-Chain Indexing**: Fast queries via indexer

## References

- [AgentM Core Program](../program/src/lib.rs)
- [Gradience Protocol](../../agent-arena/program/src/lib.rs)
