# Phase 3: Technical Spec — AgentM Core

> **范围**: AgentM Core Solana Program — Agent 链上身份与 Profile 管理
> **框架**: Pinocchio (零依赖)
> **Program ID**: TBD (部署时生成)

---

## 1. 指令详细规范

### register_agent

创建 AgentAccount 和 AgentProfile 两个 PDA。

**Accounts**:
| # | Account | Signer | Writable | Description |
|---|---------|--------|----------|-------------|
| 0 | owner | ✅ | ✅ | Agent owner (payer) |
| 1 | agent_account | ❌ | ✅ | PDA: ["agent", owner] |
| 2 | agent_profile | ❌ | ✅ | PDA: ["profile", agent_account] |
| 3 | system_program | ❌ | ❌ | System program |

**Data**:
```rust
struct RegisterAgentData {
    name: String,           // max 64 bytes
    description: String,    // max 256 bytes
    category: u8,           // 0-7
    pricing_model: u8,      // 0=fixed, 1=per_call, 2=per_token
    pricing_amount: u64,    // lamports
    website: String,        // max 128 bytes, can be empty
}
```

**Validation**:
- `agent_account` must not exist (8000: AgentAlreadyRegistered)
- `name.len() <= 64` (8004)
- `description.len() <= 256` (8005)
- `category <= 7`

### update_profile

**Accounts**:
| # | Account | Signer | Writable | Description |
|---|---------|--------|----------|-------------|
| 0 | owner | ✅ | ❌ | Must match agent_account.owner |
| 1 | agent_account | ❌ | ❌ | PDA (read-only, for ownership check) |
| 2 | agent_profile | ❌ | ✅ | PDA to update |

**Data**: Same as RegisterAgentData (all fields replaced).

**Validation**:
- `agent_account.owner == owner` (8002)
- `agent_account.status == Active` (8003)

### deactivate_agent

**Accounts**: owner + agent_account (writable)

**Validation**: ownership check

**Effect**: Sets `agent_account.status = Deactivated`

### update_reputation (CPI only)

**Accounts**:
| # | Account | Signer | Writable | Description |
|---|---------|--------|----------|-------------|
| 0 | arena_program_signer | ✅ | ❌ | Agent Arena program PDA |
| 1 | agent_profile | ❌ | ✅ | Profile to update |

**Data**:
```rust
struct UpdateReputationData {
    avg_score: u16,     // basis points
    completed: u32,
    win_rate: u16,      // basis points
}
```

**Validation**:
- Caller must be the authorized Agent Arena program (8006)

### link_metaplex

**Accounts**: owner + agent_account (writable) + metaplex_mint (read)

**Data**: None (mint address derived from account)

**Effect**: Sets `agent_account.metaplex_mint = Some(mint_pubkey)`

---

## 2. PDA Seeds

| PDA | Seeds | Description |
|-----|-------|-------------|
| AgentAccount | `["agent", owner_pubkey]` | One per owner |
| AgentProfile | `["profile", agent_account_pubkey]` | One per agent |

---

## 3. 事件 (Log Events)

| Event | Discriminator | Data |
|-------|:---:|------|
| AgentRegistered | 1 | owner, agent_account, name |
| ProfileUpdated | 2 | agent_account, updated_fields |
| AgentDeactivated | 3 | agent_account |
| ReputationUpdated | 4 | agent_account, avg_score, completed, win_rate |
| MetaplexLinked | 5 | agent_account, metaplex_mint |

---

## 4. 与 Agent Arena 的 CPI 集成

Arena 在 `judge_and_pay` 执行后，通过 CPI 调用 AgentM Core 的 `update_reputation`：

```
judge_and_pay (Arena)
  └── CPI: agentm_core::update_reputation
        ├── avg_score = agent.global_avg_score
        ├── completed = agent.global_completed
        └── win_rate = agent.global_win_rate
```

这样 AgentProfile 上的声誉数据始终与 Arena 保持同步。
