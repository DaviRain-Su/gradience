# Phase 2: Architecture — AgentM Core

---

## 架构概览

```
┌────────────────────────────────────────────┐
│  AgentM Core Program (Solana)              │
│                                             │
│  Instructions:                              │
│  ┌──────────────┐  ┌──────────────────────┐│
│  │ register_agent│  │ update_profile       ││
│  │ deactivate   │  │ link_metaplex        ││
│  └──────┬───────┘  └──────────┬───────────┘│
│         │                     │             │
│  State Accounts:              │             │
│  ┌──────┴───────┐  ┌─────────┴──────────┐ │
│  │ AgentAccount  │  │ AgentProfile       │ │
│  │ (identity PDA)│  │ (metadata PDA)     │ │
│  └───────────────┘  └────────────────────┘ │
│                                             │
│  CPI Interfaces:                            │
│  ┌─────────────────────────────────────┐   │
│  │ update_reputation (from Arena)       │   │
│  │ read_reputation (by other programs)  │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
         │                    ▲
         │ CPI               │ CPI
         ▼                    │
┌─────────────────┐  ┌──────┴──────────┐
│  Metaplex Agent  │  │  Agent Arena    │
│  Registry (8004) │  │  (reputation)   │
└─────────────────┘  └─────────────────┘
```

## 状态账户设计

### AgentAccount PDA

**Seeds**: `["agent", owner_pubkey]`

| Field         | Type             | Size   | Description                              |
| ------------- | ---------------- | ------ | ---------------------------------------- |
| discriminator | u8               | 1      | Account type tag                         |
| version       | u8               | 1      | Schema version                           |
| owner         | [u8; 32]         | 32     | Agent owner public key                   |
| created_at    | i64              | 8      | Registration timestamp                   |
| status        | u8               | 1      | Active(0) / Deactivated(1)               |
| metaplex_mint | Option<[u8; 32]> | 33     | Linked Metaplex NFT mint (if registered) |
| bump          | u8               | 1      | PDA bump                                 |
| **Total**     |                  | **77** |                                          |

### AgentProfile PDA

**Seeds**: `["profile", agent_account_pubkey]`

| Field                | Type        | Size     | Description                           |
| -------------------- | ----------- | -------- | ------------------------------------- |
| discriminator        | u8          | 1        | Account type tag                      |
| version              | u8          | 1        | Schema version                        |
| agent                | [u8; 32]    | 32       | Back-reference to AgentAccount        |
| name                 | String(64)  | 68       | Display name                          |
| description          | String(256) | 260      | Agent description                     |
| category             | u8          | 1        | Primary capability category (0-7)     |
| pricing_model        | u8          | 1        | fixed(0) / per_call(1) / per_token(2) |
| pricing_amount       | u64         | 8        | Price in lamports                     |
| website              | String(128) | 132      | Optional website URL                  |
| reputation_avg_score | u16         | 2        | Cached from Arena (basis points)      |
| reputation_completed | u32         | 4        | Cached completed tasks                |
| reputation_win_rate  | u16         | 2        | Cached win rate (basis points)        |
| updated_at           | i64         | 8        | Last update timestamp                 |
| bump                 | u8          | 1        | PDA bump                              |
| **Total**            |             | **~521** |                                       |

## 指令集

| 指令                | 权限                | 描述                                           |
| ------------------- | ------------------- | ---------------------------------------------- |
| `register_agent`    | owner (signer)      | 创建 AgentAccount + AgentProfile PDAs          |
| `update_profile`    | owner (signer)      | 更新 Profile 元数据                            |
| `deactivate_agent`  | owner (signer)      | 将 Agent 标记为 deactivated                    |
| `update_reputation` | Arena program (CPI) | 由 Agent Arena 在 judge_and_pay 后调用更新缓存 |
| `link_metaplex`     | owner (signer)      | 关联 Metaplex Agent Registry NFT               |

## 错误码

| Code | Name                     | Description         |
| ---- | ------------------------ | ------------------- |
| 8000 | AgentAlreadyRegistered   | Agent PDA 已存在    |
| 8001 | AgentNotFound            | Agent PDA 不存在    |
| 8002 | NotAgentOwner            | 非 owner 操作       |
| 8003 | AgentDeactivated         | Agent 已停用        |
| 8004 | InvalidNameLength        | 名称超过 64 字节    |
| 8005 | InvalidDescriptionLength | 描述超过 256 字节   |
| 8006 | UnauthorizedCpiCaller    | 非授权程序 CPI 调用 |

## 与现有系统的关系

| 系统        | 关系                                                           |
| ----------- | -------------------------------------------------------------- |
| Agent Arena | Arena judge_and_pay 后通过 CPI 调用 update_reputation 更新缓存 |
| Indexer     | 监听 AgentM Core 事件，同步 Profile 到 PostgreSQL              |
| AgentM Pro  | 通过 SDK 调用 register_agent / update_profile                  |
| Metaplex    | link_metaplex 将 Agent 与 Metaplex NFT 关联                    |
| Chain Hub   | 可通过 CPI 读取 AgentProfile 做 Skill 匹配                     |
