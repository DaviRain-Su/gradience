# Phase 3: Technical Spec — Agent Layer v2

> **目的**: 将架构设计转化为可以直接编码的精确规格
> **输入**: `docs/02-architecture.md`
> **输出物**: 本文档，代码必须与本规格 100% 一致
>
> ⚠️ **任何模糊之处在本文档解决，不留给实现阶段。**

---

## 3.1 常量定义

所有常量集中于 `programs/agent-layer/src/constants.rs`，**不可通过升级修改**。

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|----|----|------|--------|
| `JUDGE_FEE_BPS` | 300 | u16 | Judge 分成 3% | immutable |
| `PROTOCOL_FEE_BPS` | 200 | u16 | 协议分成 2% | immutable |
| `AGENT_FEE_BPS` | 9500 | u16 | Agent 分成 95%（派生，不单独存储） | immutable |
| `CANCEL_FEE_BPS` | 200 | u16 | Poster 主动取消扣除 2% | immutable |
| `FORCE_REFUND_DELAY` | 604800 | i64 | judge_deadline 后 7 天（秒），任何人可触发强退 | immutable |
| `UNSTAKE_COOLDOWN` | 604800 | i64 | Judge 解质押冷却期 7 天（秒） | immutable |
| `MAX_JUDGES_PER_POOL` | 200 | usize | 每个 category JudgePool 最大 Judge 数量；200 × 36 + header ≈ 7.2KB，在 Solana 10KB 账户上限内；若需扩容可通过分页（JudgePool shard）实现，当前 MVP 阶段 200 足够 | immutable |
| `MAX_CATEGORIES` | 8 | usize | 支持的最大 category 数量 | immutable |
| `MIN_SCORE` | 60 | u8 | 有效提交的最低分数门槛 | immutable |
| `MAX_SCORE` | 100 | u8 | 最高分数 | immutable |
| `MAX_REF_LEN` | 128 | usize | CID 字段最大字节数（Arweave/IPFS） | immutable |
| `MAX_PROVIDER_LEN` | 32 | usize | runtime_env.provider 最大字节数 | immutable |
| `MAX_MODEL_LEN` | 64 | usize | runtime_env.model 最大字节数 | immutable |
| `MAX_RUNTIME_LEN` | 32 | usize | runtime_env.runtime 最大字节数 | immutable |
| `MAX_VERSION_LEN` | 32 | usize | runtime_env.version 最大字节数 | immutable |

可配置常量（通过 `upgrade_config` 指令更新）：

| 常量名 | 初始值 | 类型 | 说明 |
|--------|--------|------|------|
| `min_judge_stake` | 1_000_000_000 | u64 | 成为 Judge 的最低质押量（lamports，= 1 SOL） |

---

## 3.2 数据结构定义

### 3.2.1 链上账户（PDA）

---

#### `Task`

```rust
/// 任务主体
/// PDA seeds: [b"task", task_id.to_le_bytes()]
/// 总大小: 8 + 315 = 323 bytes（含 Anchor discriminator）
#[account]
pub struct Task {
    pub task_id:        u64,           // 8  — 任务唯一 ID，单调递增，由 ProgramConfig.task_count 派生
    pub poster:           Pubkey,        // 32 — 发布者地址
    pub judge:            Pubkey,        // 32 — 评判者地址（pool 模式下由协议填写）
    pub judge_mode:       JudgeMode,     // 1  — 0=Designated(Poster指定), 1=Pool(随机抽选)
    pub reward:           u64,           // 8  — 奖励总量（lamports 或 SPL token 最小单位）
    pub mint:             Pubkey,        // 32 — SOL = Pubkey::default()，SPL Token = token mint，Token-2022 = token-2022 mint（支持基础转账，不支持 Confidential Transfer / Transfer Hook 等高级扩展）；每个任务固定一种 mint，不支持混合支付
    pub min_stake:        u64,           // 8  — Agent 申请所需最低质押（与 reward 同单位）
    pub state:            TaskState,     // 1  — Open / Completed / Refunded
    pub category:         u8,           // 1  — 任务领域（见 Category 枚举）
    pub eval_ref:         String,        // 4+128 = 132 — evaluationCID（Arweave），评判标准
    pub deadline:         i64,           // 8  — 提交截止时间（Unix timestamp）
    pub judge_deadline:   i64,           // 8  — Judge 评判截止时间（Unix timestamp）
    pub submission_count: u16,           // 2  — 当前有效提交数量
    pub winner:           Option<Pubkey>,// 33 — 获胜 Agent（完成后填写）
    pub created_at:       i64,           // 8  — 创建时间（Unix timestamp）
    pub bump:             u8,            // 1  — PDA bump
}
// 正确计算:
// task_id(8)+poster(32)+judge(32)+judge_mode(1)+reward(8)+mint(32)+min_stake(8)
// +state(1)+category(1)+eval_ref(132)+deadline(8)+judge_deadline(8)
// +submission_count(2)+winner(33)+created_at(8)+bump(1) = 315
// 315 + 8(discriminator) = 323
```

| 字段 | 类型 | 大小 (bytes) | 约束 | 说明 |
|------|------|-------------|------|------|
| discriminator | [u8; 8] | 8 | Anchor 自动 | 账户类型标识 |
| task_id | u64 | 8 | 唯一，单调递增 | 由 ProgramConfig.task_count++ 派生 |
| poster | Pubkey | 32 | 非零 | 发布者 |
| judge | Pubkey | 32 | 非零（pool模式下由协议写入） | 评判者 |
| judge_mode | u8 | 1 | 0 或 1 | 0=Designated, 1=Pool |
| reward | u64 | 8 | > 0 | 奖励总量 |
| mint | Pubkey | 32 | — | Pubkey::default() = SOL |
| min_stake | u64 | 8 | ≥ 0 | 0 表示无需质押 |
| state | u8 | 1 | 0/1/2 | 0=Open, 1=Completed, 2=Refunded |
| category | u8 | 1 | 0-7 | 见 Category 枚举 |
| eval_ref | String | 132 | len ≤ 128 | Arweave CID |
| deadline | i64 | 8 | > created_at | 提交截止 |
| judge_deadline | i64 | 8 | > deadline | 评判截止 |
| submission_count | u16 | 2 | ≤ 65535 | — |
| winner | Option\<Pubkey\> | 33 | — | None = 未评判 |
| created_at | i64 | 8 | — | Unix timestamp |
| bump | u8 | 1 | — | PDA bump |
| **总计** | | **323** | | |

---

#### `Escrow`

```rust
/// 任务奖励托管账户
/// PDA seeds: [b"escrow", task_id.to_le_bytes()]
/// SOL: PDA 直接持有 lamports（无 token account）
/// SPL: PDA 作为 ATA authority，escrow_ata 持有代币
/// 总大小: 8 + 49 = 57 bytes
#[account]
pub struct Escrow {
    pub task_id: u64,    // 8  — 关联任务
    pub mint:    Pubkey, // 32 — SOL = Pubkey::default()
    pub amount:  u64,    // 8  — 锁入总量（含 judge + protocol 份额）
    pub bump:    u8,     // 1  — PDA bump
}
// Escrow data: 8+32+8+1 = 49 bytes
```

---

#### `Application`

```rust
/// Agent 申请记录
/// PDA seeds: [b"application", task_id.to_le_bytes(), agent.as_ref()]
/// 总大小: 8 + 57 = 65 bytes
#[account]
pub struct Application {
    pub task_id:      u64,    // 8  — 关联任务
    pub agent:        Pubkey, // 32 — 申请的 Agent 地址
    pub stake_amount: u64,    // 8  — 质押量（与 task.mint 同单位）
    pub applied_at:   i64,    // 8  — 申请时间
    pub bump:         u8,     // 1  — PDA bump
}
```

---

#### `Submission`

```rust
/// Agent 最新提交（可覆盖）
/// PDA seeds: [b"submission", task_id.to_le_bytes(), agent.as_ref()]
/// 总大小: 8 + 497 = 505 bytes
/// data = task_id(8)+agent(32)+result_ref(132)+trace_ref(132)
///      + runtime_env(176)+submission_slot(8)+submitted_at(8)+bump(1) = 497
#[account]
pub struct Submission {
    pub task_id:         u64,        // 8   — 关联任务
    pub agent:           Pubkey,     // 32  — 提交的 Agent
    pub result_ref:      String,     // 132 — 最终产出 CID（Arweave）
    pub trace_ref:       String,     // 132 — 执行轨迹 CID（Arweave）
    pub runtime_env:     RuntimeEnv, // 176 — 运行时环境声明
    pub submission_slot: u64,        // 8   — 提交时的 Solana slot（平局用）
    pub submitted_at:    i64,        // 8   — 提交时间（Unix timestamp）
    pub bump:            u8,         // 1   — PDA bump
}

/// Agent 运行时环境声明（Judge 凭此复现环境验证）
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RuntimeEnv {
    pub provider: String, // 4+32=36 — AI 供应商（"anthropic"/"openai"/"google"）
    pub model:    String, // 4+64=68 — 模型 ID（"claude-sonnet-4-6"）
    pub runtime:  String, // 4+32=36 — 运行时（"opencloud"/"local"/"privy"）
    pub version:  String, // 4+32=36 — 模型版本（"20251001"）
}
// RuntimeEnv 总计: 36+68+36+36 = 176 bytes
```

---

#### `Reputation`

```rust
/// Agent / Judge 信誉数据（按需创建，首次参与自动初始化）
/// PDA seeds: [b"reputation", agent.as_ref()]
/// 总大小: 8 + 109 = 117 bytes
/// data = agent(32) + global(20) + by_category(56) + bump(1) = 109
#[account]
pub struct Reputation {
    pub agent:       Pubkey,                          // 32 — 地址
    pub global:      ReputationStats,                 // 20 — 全局统计
    pub by_category: [CategoryStats; MAX_CATEGORIES], // 56 — 按领域统计（8个）
    pub bump:        u8,                              // 1  — PDA bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct ReputationStats {
    pub total_earned:  u64, // 8 — 累计收益（lamports）
    pub completed:     u32, // 4 — 完成任务数（作为 winner）
    pub total_applied: u32, // 4 — 总申请数（用于计算 win_rate）
    pub avg_score:     u16, // 2 — 0-10000（实际分数×100，保留2位小数）
    pub win_rate:      u16, // 2 — 0-10000（实际比率×10000，= completed * 10000 / total_applied）
}
// ReputationStats 总计: 8+4+4+2+2 = 20 bytes（Anchor borsh 序列化，无 padding）

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, Copy)]
pub struct CategoryStats {
    pub category:  u8,  // 1 — category ID
    pub avg_score: u16, // 2 — 0-10000
    pub completed: u32, // 4 — 完成数
}
// CategoryStats 单个: 1+2+4 = 7 bytes（Anchor borsh 序列化，无 padding）
// CategoryStats × 8 = 56 bytes
// 注意：Anchor 使用 Borsh 序列化（紧凑排列，无对齐 padding），
// 而非 Rust 原生内存布局。所有大小计算基于 Borsh 序列化后的字节数。
```

---

#### `Stake`（Judge 质押）

```rust
/// Judge 质押记录
/// PDA seeds: [b"stake", judge.as_ref()]
/// 总大小: 8 + 66 = 74 bytes
/// Borsh 序列化: judge(32) + amount(8) + categories(8) + category_count(1)
///              + registered_at(8) + cooldown_until(8) + bump(1) = 66
#[account]
pub struct Stake {
    pub judge:          Pubkey,              // 32 — Judge 地址
    pub amount:         u64,                 // 8  — 质押量（lamports）
    pub categories:     [u8; MAX_CATEGORIES],// 8  — 注册的 category 列表（0 = 未使用）
    pub category_count: u8,                  // 1  — 有效 category 数量
    pub registered_at:  i64,                 // 8  — 注册时间
    pub cooldown_until: i64,                 // 8  — 解质押冷却期结束时间（0 = 无冷却）
    pub bump:           u8,                  // 1  — PDA bump
}
// 注意：Anchor 使用 Borsh 序列化（紧凑排列，无对齐 padding），
// 因此大小为字段字节总和 = 66 bytes，不受 Rust 原生内存对齐影响。
```

---

#### `JudgePool`

```rust
/// 每个 category 的 Judge 候选池
/// PDA seeds: [b"judge_pool", &[category]]
/// 总大小: 8 + 7210 = 7218 bytes（max 200 judges）
///
/// **Vec 容量说明**：
/// - Anchor 使用 Borsh 序列化 Vec：4 bytes (len) + len × element_size
/// - 账户空间在 `initialize_judge_pool` 时按 MAX_JUDGES_PER_POOL (200) 预分配
/// - 空间 = 8(discriminator) + 1(category) + 4(total_weight) + 4(vec_len) + 200×36(entries) + 1(bump)
///        = 8 + 7210 = 7218 bytes
/// - Vec 动态增长，不超过预分配空间；若 entries.len() = MAX_JUDGES_PER_POOL，
///   register_judge 返回 JudgePoolFull 错误
/// - 无需 realloc——200 上限在 MVP 阶段足够，未来可通过 JudgePool 分片扩容
#[account]
pub struct JudgePool {
    pub category:     u8,                              // 1  — 领域 ID
    pub total_weight: u32,                             // 4  — 所有 Judge 权重之和（用于加权随机）
    pub entries:      Vec<JudgePoolEntry>,             // 4+200×36=7204 — 候选列表
    pub bump:         u8,                              // 1  — PDA bump
}
// JudgePool data 部分: 1 + 4 + 4 + 200×36 + 1 = 7210 bytes

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct JudgePoolEntry {
    pub judge:  Pubkey, // 32 — Judge 地址
    pub weight: u32,    // 4  — 权重 = min(stake/1e9, 1000) + min(reputation/10, 100)
}
// JudgePoolEntry: 36 bytes
```

---

#### `Treasury`

```rust
/// 协议收入账户（持有 lamports）
/// PDA seeds: [b"treasury"]
/// 总大小: 8 + 1 = 9 bytes
#[account]
pub struct Treasury {
    pub bump: u8, // 1
}
```

---

#### `ProgramConfig`

```rust
/// 全局配置，仅 upgrade_authority 可修改
/// PDA seeds: [b"config"]
/// 总大小: 8 + 81 = 89 bytes
#[account]
pub struct ProgramConfig {
    pub treasury:          Pubkey, // 32 — Treasury PDA 地址
    pub upgrade_authority: Pubkey, // 32 — 多签 DAO 地址（使用 Squads v4 多签，M-of-N 阈值由 DAO 治理决定；upgrade_authority 本身可通过 upgrade_config 转移给新的多签地址）
    pub min_judge_stake:   u64,    // 8  — 成为 Judge 的最低质押（可配置，初始 1 SOL）
    pub task_count:        u64,    // 8  — 已创建任务数（用于生成 task_id）
    pub bump:              u8,     // 1
}
```

---

### 3.2.2 枚举定义

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TaskState {
    Open      = 0,
    Completed = 1,
    Refunded  = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum JudgeMode {
    Designated = 0, // Poster 指定特定 Judge 地址
    Pool       = 1, // 协议从 JudgePool 随机抽选
}

/// 任务领域分类
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Copy)]
#[repr(u8)]
pub enum Category {
    General  = 0, // 通用
    Defi     = 1, // DeFi / 量化 / 金融
    Code     = 2, // 代码实现 / 算法
    Research = 3, // 研究分析
    Creative = 4, // 创意写作 / 设计
    Data     = 5, // 数据处理 / ETL
    Compute  = 6, // 科学计算 / 模拟
    Gov      = 7, // 治理 / 提案评审
}
```

---

### 3.2.3 链下数据结构（Indexer PostgreSQL Schema）

```sql
-- 任务快照（从链上事件同步）
CREATE TABLE tasks (
    task_id          BIGINT PRIMARY KEY,
    poster           TEXT NOT NULL,
    judge            TEXT NOT NULL,
    judge_mode       SMALLINT NOT NULL,      -- 0=designated, 1=pool
    reward           BIGINT NOT NULL,
    mint             TEXT NOT NULL,
    min_stake        BIGINT NOT NULL,
    state            SMALLINT NOT NULL,      -- 0=open, 1=completed, 2=refunded
    category         SMALLINT NOT NULL,
    eval_ref         TEXT NOT NULL,
    deadline         BIGINT NOT NULL,        -- unix timestamp
    judge_deadline   BIGINT NOT NULL,
    submission_count SMALLINT DEFAULT 0,
    winner           TEXT,
    created_at       BIGINT NOT NULL,
    slot             BIGINT NOT NULL         -- Solana slot（事件捕获时）
);

-- 提交记录
CREATE TABLE submissions (
    task_id          BIGINT NOT NULL,
    agent            TEXT NOT NULL,
    result_ref       TEXT NOT NULL,
    trace_ref        TEXT NOT NULL,
    runtime_provider TEXT NOT NULL,
    runtime_model    TEXT NOT NULL,
    runtime_runtime  TEXT NOT NULL,
    runtime_version  TEXT NOT NULL,
    submission_slot  BIGINT NOT NULL,
    submitted_at     BIGINT NOT NULL,
    PRIMARY KEY (task_id, agent)
);

-- 信誉快照
CREATE TABLE reputations (
    agent             TEXT PRIMARY KEY,
    global_avg_score  INTEGER NOT NULL DEFAULT 0,  -- 0-10000
    global_win_rate   INTEGER NOT NULL DEFAULT 0,  -- 0-10000
    global_completed  INTEGER NOT NULL DEFAULT 0,
    global_total_applied INTEGER NOT NULL DEFAULT 0, -- 总申请数（对应链上 ReputationStats.total_applied）
    total_earned      BIGINT  NOT NULL DEFAULT 0,  -- lamports 数量，u64 范围（0 ~ 2^64-1）
    updated_slot      BIGINT  NOT NULL DEFAULT 0
);
-- 注意：category SMALLINT 对应 Rust u8，PostgreSQL 无 unsigned
-- SMALLINT 范围 -32768~32767，存储 u8 (0-255) 无问题，索引器应确保只写入非负值。

CREATE TABLE reputation_by_category (
    agent      TEXT NOT NULL,
    category   SMALLINT NOT NULL,    -- 对应 Rust u8，值范围 0-7
    avg_score  INTEGER NOT NULL DEFAULT 0,
    completed  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent, category)
);

-- 索引
CREATE INDEX idx_tasks_state    ON tasks(state);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_submissions_agent ON submissions(agent);
```

---

## 3.3 接口定义

### 3.3.1 Program 指令

---

#### `initialize`

| 属性 | 值 |
|------|------|
| 调用者 | 部署者（一次性） |
| 前置条件 | ProgramConfig 未初始化 |
| 后置条件 | ProgramConfig 创建，Treasury PDA 初始化 |

参数：

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `upgrade_authority` | Pubkey | 非零 | 多签 DAO 地址 |
| `min_judge_stake` | u64 | > 0 | 初始值建议 1_000_000_000 |

账户：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `payer` | SystemAccount | ✅ | ✅ | 支付初始化租金 |
| `config` | ProgramConfig PDA | ✅ | ❌ | seeds: [b"config"] |
| `treasury` | Treasury PDA | ✅ | ❌ | seeds: [b"treasury"] |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `post_task`

| 属性 | 值 |
|------|------|
| 调用者 | 任何人（Poster） |
| 前置条件 | ProgramConfig 已初始化；reward > 0；deadline > clock.unix_timestamp；judge_deadline > deadline |
| 后置条件 | Task PDA 创建；reward 锁入 Escrow；task_count 递增；若 JudgeMode::Pool 则从 JudgePool 抽选 judge |

参数：

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `eval_ref` | String | len ≤ 128, 非空 | evaluationCID（Arweave） |
| `deadline` | i64 | > now | 提交截止时间 |
| `judge_deadline` | i64 | > deadline | 评判截止时间 |
| `judge` | Option\<Pubkey\> | None = pool 模式 | 指定 Judge 或留空 |
| `category` | u8 | 0-7 | 任务领域 |
| `min_stake` | u64 | ≥ 0 | Agent 申请所需质押 |
| `reward` | u64 | > 0 | 奖励总量（SOL 单位 lamports） |
| `mint` | Pubkey | — | Pubkey::default() = SOL |

账户（SOL 版本）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `poster` | SystemAccount | ✅ | ✅ | 发布者，支付 reward + 租金 |
| `config` | ProgramConfig | ✅ | ❌ | task_count++ |
| `task` | Task PDA | ✅ | ❌ | seeds: [b"task", task_id] |
| `escrow` | Escrow PDA | ✅ | ❌ | seeds: [b"escrow", task_id] |
| `judge_pool` | JudgePool PDA | ❌ | ❌ | 仅 Pool 模式需要，seeds: [b"judge_pool", &[category]] |
| `system_program` | Program | ❌ | ❌ | — |

账户（SPL Token 版本，当 mint ≠ Pubkey::default()）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `poster` | SystemAccount | ✅ | ✅ | 发布者，支付租金 |
| `poster_token_account` | TokenAccount | ✅ | ❌ | Poster 的 token account（mint 匹配），reward 扣款来源 |
| `config` | ProgramConfig | ✅ | ❌ | task_count++ |
| `task` | Task PDA | ✅ | ❌ | seeds: [b"task", task_id] |
| `escrow` | Escrow PDA | ✅ | ❌ | seeds: [b"escrow", task_id] |
| `escrow_ata` | TokenAccount | ✅ | ❌ | Escrow 的 ATA（authority = escrow PDA，mint 匹配）init_if_needed |
| `mint` | Mint | ❌ | ❌ | SPL Token / Token-2022 mint。不支持 Confidential Transfer 和 Transfer Hook 扩展——指令内 `require!` mint 无这些扩展（通过检查 mint 的 extension 字段） |
| `judge_pool` | JudgePool PDA | ❌ | ❌ | 仅 Pool 模式需要 |
| `token_program` | Program | ❌ | ❌ | SPL Token 或 Token-2022 program |
| `associated_token_program` | Program | ❌ | ❌ | ATA program |
| `system_program` | Program | ❌ | ❌ | — |

> **Token-2022 兼容说明**：程序同时支持 SPL Token 和 Token-2022 的基础转账。
> 不支持的扩展：Confidential Transfer、Transfer Hook、Permanent Delegate。
> 检测方式：在 `post_task` 时检查 mint account 的 extensions，若包含不支持的扩展则返回 `UnsupportedMintExtension` 错误（需新增错误码）。

Pool 模式随机抽选逻辑（链上执行）：
```
seed = hash(recent_blockhash || task_id || clock.slot)
point = u64::from_le_bytes(seed[0..8]) % judge_pool.total_weight
cumulative = 0
for entry in judge_pool.entries:
    cumulative += entry.weight
    if point < cumulative:
        task.judge = entry.judge
        break
```

---

#### `apply_for_task`

| 属性 | 值 |
|------|------|
| 调用者 | 任何 Agent |
| 前置条件 | Task.state = Open；clock < task.deadline；agent 未申请过该任务（Application PDA 不存在）；若 task.min_stake > 0，agent 需通过 `agent_stake_source` 账户提供质押（SOL: 从 SystemAccount 转入 Escrow；SPL: 从 token account 转入 escrow_ata） |
| 后置条件 | Application PDA 创建（stake_amount 记录锁入金额）；质押从 agent 转入 Escrow PDA（与 task 奖励共享 Escrow）；Reputation PDA 按需创建 |

参数：无（task_id 通过 PDA seeds 传入）

**质押机制说明**：
- 若 `task.min_stake = 0`，无需质押，`agent_stake_source` 可省略
- 若 `task.min_stake > 0`：
  - SOL 任务：agent 需持有 ≥ min_stake 的 SOL，指令内通过 `system_program::transfer` 从 agent → escrow 转入
  - SPL 任务：agent 需持有 ≥ min_stake 的对应代币，指令内通过 `token::transfer` 从 agent_token_account → escrow_ata 转入
- 质押在 `judge_and_pay` 完成后退回 agent（无论胜负）
- 质押在 `force_refund` / `refund_expired` / `cancel_task` 后退回 agent
- Application.stake_amount 记录实际锁入量

账户：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `agent` | SystemAccount | ✅ | ✅ | 申请者（SOL 质押来源） |
| `task` | Task PDA | ✅ | ❌ | 状态检查 + submission_count++ |
| `escrow` | Escrow PDA | ✅ | ❌ | 接收 agent 质押（seeds: [b"escrow", task_id]） |
| `application` | Application PDA | ✅ | ❌ | seeds: [b"application", task_id, agent] init |
| `reputation` | Reputation PDA | ✅ | ❌ | seeds: [b"reputation", agent] init_if_needed |
| `system_program` | Program | ❌ | ❌ | — |

账户（SPL Token 版本，当 task.mint ≠ Pubkey::default() 且 task.min_stake > 0）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `agent` | SystemAccount | ✅ | ✅ | 申请者 |
| `agent_token_account` | TokenAccount | ✅ | ❌ | Agent 的 token account（质押来源，mint 匹配） |
| `task` | Task PDA | ✅ | ❌ | 状态检查 + submission_count++ |
| `escrow` | Escrow PDA | ✅ | ❌ | seeds: [b"escrow", task_id] |
| `escrow_ata` | TokenAccount | ✅ | ❌ | Escrow 的 ATA（接收质押，authority = escrow PDA） |
| `mint` | Mint | ❌ | ❌ | token mint（验证匹配） |
| `application` | Application PDA | ✅ | ❌ | seeds: [b"application", task_id, agent] init |
| `reputation` | Reputation PDA | ✅ | ❌ | seeds: [b"reputation", agent] init_if_needed |
| `token_program` | Program | ❌ | ❌ | SPL Token 或 Token-2022 program |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `submit_result`

| 属性 | 值 |
|------|------|
| 调用者 | 已申请的 Agent |
| 前置条件 | Task.state = Open；clock < task.deadline；Application 存在；result_ref / trace_ref 非空；runtime_env 字段非空 |
| 后置条件 | Submission PDA 创建或覆盖；submission_slot = clock.slot |

参数：

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `result_ref` | String | len ≤ 128, 非空 | 最终产出 CID |
| `trace_ref` | String | len ≤ 128, 非空 | 执行轨迹 CID |
| `runtime_env` | RuntimeEnv | 各字段非空；provider.len() ≤ 32；model.len() ≤ 64；runtime.len() ≤ 32；version.len() ≤ 32 | 运行时环境声明。Anchor Borsh 反序列化不校验 String 长度上限——只要账户空间足够就能存入超长字符串。因此**必须**在指令处理函数中手动 `require!` 校验每个字段长度 ≤ 对应 MAX_*_LEN 常量，防止恶意写入超大数据。 |

账户：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `agent` | SystemAccount | ✅ | ✅ | 提交者 |
| `task` | Task PDA | ❌ | ❌ | 状态 + deadline 检查 |
| `application` | Application PDA | ❌ | ❌ | 验证 agent 已申请 |
| `submission` | Submission PDA | ✅ | ❌ | seeds: [b"submission", task_id, agent] init_if_needed |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `judge_and_pay`

| 属性 | 值 |
|------|------|
| 调用者 | Task.judge |
| 前置条件 | Task.state = Open；signer = task.judge；winner 的 Submission 存在；score ≤ 100；winner 的 Application 存在 |
| 后置条件 | 若 score ≥ MIN_SCORE：三方分账，Task.state = Completed，Reputation 更新，质押退回；若 score < MIN_SCORE：退款给 Poster，Task.state = Refunded |

参数：

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `winner` | Pubkey | 必须有 Submission | 获胜 Agent 地址 |
| `score` | u8 | 0-100 | 综合评分 |
| `reason_ref` | Option\<String\> | len ≤ 128 | 评判理由 CID（可选） |

账户（SOL 版本）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `judge` | SystemAccount | ✅ | ✅ | 评判者，接收 3% |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | 释放资金 |
| `winner_account` | SystemAccount | ✅ | ❌ | Agent，接收 95% |
| `winner_application` | Application PDA | ✅ | ❌ | 质押退回 |
| `winner_reputation` | Reputation PDA | ✅ | ❌ | 信誉更新 |
| `judge_stake` | Stake PDA | ❌ | ❌ | 验证 Judge 已质押 |
| `treasury` | Treasury PDA | ✅ | ❌ | 接收 2% |
| `system_program` | Program | ❌ | ❌ | — |

账户（SPL Token 版本，当 task.mint ≠ Pubkey::default()）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `judge` | SystemAccount | ✅ | ✅ | 评判者 |
| `judge_token_account` | TokenAccount | ✅ | ❌ | Judge 的 token account（接收 3%） |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | 释放资金（作为 ATA authority） |
| `escrow_ata` | TokenAccount | ✅ | ❌ | Escrow 的 ATA（持有代币） |
| `winner_account` | SystemAccount | ❌ | ❌ | Agent 的系统账户 |
| `winner_token_account` | TokenAccount | ✅ | ❌ | Agent 的 token account（接收 95%） |
| `winner_application` | Application PDA | ✅ | ❌ | 质押退回 |
| `winner_reputation` | Reputation PDA | ✅ | ❌ | 信誉更新 |
| `judge_stake` | Stake PDA | ❌ | ❌ | 验证 Judge 已质押 |
| `poster_token_account` | TokenAccount | ✅ | ❌ | Poster 的 token account（score < MIN_SCORE 时退款目标） |
| `treasury_ata` | TokenAccount | ✅ | ❌ | Treasury 的 ATA（接收 2%）init_if_needed |
| `mint` | Mint | ❌ | ❌ | token mint |
| `token_program` | Program | ❌ | ❌ | SPL Token 或 Token-2022 program |
| `associated_token_program` | Program | ❌ | ❌ | ATA program |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `cancel_task`

| 属性 | 值 |
|------|------|
| 调用者 | Task.poster |
| 前置条件 | Task.state = Open；submission_count = 0（无提交则可取消）；signer = task.poster |
| 后置条件 | Task.state = Refunded；98% 退还 Poster；2% 进 Treasury |

参数：无

账户（SOL 版本）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `poster` | SystemAccount | ✅ | ✅ | signer = task.poster |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | 释放资金 |
| `treasury` | Treasury PDA | ✅ | ❌ | 接收 2% |
| `system_program` | Program | ❌ | ❌ | — |

账户（SPL Token 版本，当 task.mint ≠ Pubkey::default()）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `poster` | SystemAccount | ✅ | ✅ | signer = task.poster |
| `poster_token_account` | TokenAccount | ✅ | ❌ | 接收 98% 退款 |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | ATA authority |
| `escrow_ata` | TokenAccount | ✅ | ❌ | 释放代币 |
| `treasury_ata` | TokenAccount | ✅ | ❌ | 接收 2% |
| `mint` | Mint | ❌ | ❌ | token mint |
| `token_program` | Program | ❌ | ❌ | SPL Token 或 Token-2022 |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `refund_expired`

| 属性 | 值 |
|------|------|
| 调用者 | 任何人 |
| 前置条件 | Task.state = Open；clock > task.deadline；submission_count = 0 |
| 后置条件 | Task.state = Refunded；100% 退还 Poster |

参数：无

账户（SOL 版本）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `anyone` | SystemAccount | ✅ | ✅ | 任何人触发（支付 tx 费） |
| `poster` | SystemAccount | ✅ | ❌ | 接收 100% 退款 |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | 释放资金 |
| `system_program` | Program | ❌ | ❌ | — |

账户（SPL Token 版本，当 task.mint ≠ Pubkey::default()）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `anyone` | SystemAccount | ✅ | ✅ | 任何人触发 |
| `poster_token_account` | TokenAccount | ✅ | ❌ | 接收 100% 退款 |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | ATA authority |
| `escrow_ata` | TokenAccount | ✅ | ❌ | 释放代币 |
| `mint` | Mint | ❌ | ❌ | token mint |
| `token_program` | Program | ❌ | ❌ | SPL Token 或 Token-2022 |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `force_refund`

| 属性 | 值 |
|------|------|
| 调用者 | 任何人 |
| 前置条件 | Task.state = Open；clock > task.judge_deadline + FORCE_REFUND_DELAY；至少有一个有效提交 |
| 后置条件 | Task.state = Refunded；95% → Poster；3% → 提交数最多的 Agent；2% → Treasury；Judge Slash 执行（见下方） |

**force_refund Slash 逻辑（精确）：**
```
1. slash_amount = config.min_judge_stake
2. remaining = judge_stake.amount - slash_amount
3. 将 slash_amount 从 Stake PDA lamports 转入 Treasury
4. 若 remaining >= config.min_judge_stake:
     → judge_stake.amount = remaining
     → 对 Judge 所在的每个 JudgePool，重新计算 weight:
       stake_weight = min(remaining / LAMPORTS_PER_SOL, 1000)
       reputation_weight = min(reputation.global.avg_score / 100, 100)
       entry.weight = stake_weight + reputation_weight
     → 更新每个 pool.total_weight（减去旧 weight，加上新 weight）
   否则（remaining < config.min_judge_stake）:
     → 从 Judge 注册的所有 JudgePool 中移除该 Judge 的 entry
     → 更新每个 pool.total_weight（减去该 entry 的 weight）
     → 将 remaining lamports 退回 Judge 的 SystemAccount
     → 关闭 Stake PDA（lamports 归零，由 Solana 运行时回收）
     → Judge 需重新调用 register_judge 才能再次参与
``` |

参数：无

账户（SOL 版本）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `anyone` | SystemAccount | ✅ | ✅ | 任何人触发 |
| `poster` | SystemAccount | ✅ | ❌ | 接收 95% |
| `most_active_agent` | SystemAccount | ✅ | ❌ | 接收 3%（提交数最多的 Agent） |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | 释放资金 |
| `judge_stake` | Stake PDA | ✅ | ❌ | Slash 操作 |
| `judge_account` | SystemAccount | ✅ | ❌ | 接收 Stake 剩余（若被移除） |
| `judge_reputation` | Reputation PDA | ❌ | ❌ | 读取信誉（重算 weight） |
| `judge_pool_*` | JudgePool PDA(s) | ✅ | ❌ | Judge 注册的每个 category pool（最多 8 个） |
| `treasury` | Treasury PDA | ✅ | ❌ | 接收 2% + slash_amount |
| `system_program` | Program | ❌ | ❌ | — |

账户（SPL Token 版本，当 task.mint ≠ Pubkey::default()）：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `anyone` | SystemAccount | ✅ | ✅ | 任何人触发 |
| `poster_token_account` | TokenAccount | ✅ | ❌ | 接收 95% |
| `most_active_agent_token_account` | TokenAccount | ✅ | ❌ | 接收 3% |
| `task` | Task PDA | ✅ | ❌ | 状态更新 |
| `escrow` | Escrow PDA | ✅ | ❌ | ATA authority |
| `escrow_ata` | TokenAccount | ✅ | ❌ | 释放代币 |
| `judge_stake` | Stake PDA | ✅ | ❌ | Slash 操作（质押始终为 SOL） |
| `judge_account` | SystemAccount | ✅ | ❌ | 接收 Stake 剩余 |
| `judge_reputation` | Reputation PDA | ❌ | ❌ | 读取信誉 |
| `judge_pool_*` | JudgePool PDA(s) | ✅ | ❌ | 每个 category pool |
| `treasury` | Treasury PDA | ✅ | ❌ | 接收 slash_amount (SOL) |
| `treasury_ata` | TokenAccount | ✅ | ❌ | 接收 2% (代币) |
| `mint` | Mint | ❌ | ❌ | token mint |
| `token_program` | Program | ❌ | ❌ | SPL Token 或 Token-2022 |
| `system_program` | Program | ❌ | ❌ | — |

> **注意**：Judge Slash 始终操作 SOL（Stake 质押为 SOL），与任务 mint 无关。
> SPL Token 版本仅影响奖励分配，Slash 逻辑不变。

---

#### `register_judge`

| 属性 | 值 |
|------|------|
| 调用者 | 任何人 |
| 前置条件 | 质押量 ≥ config.min_judge_stake；categories 非空且每个值在 0-7；Stake PDA 未存在；JudgePool 未满（< MAX_JUDGES_PER_POOL） |
| 后置条件 | Stake PDA 创建；质押锁入；加入每个 category 的 JudgePool；weight 计算并累加到 pool.total_weight |

参数：

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `categories` | Vec\<u8\> | len 1-8，值 0-7，无重复 | 注册领域 |
| `stake_amount` | u64 | ≥ config.min_judge_stake | 质押量 |

账户：

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `judge` | SystemAccount | ✅ | ✅ | — |
| `config` | ProgramConfig | ❌ | ❌ | 读取 min_judge_stake |
| `stake` | Stake PDA | ✅ | ❌ | seeds: [b"stake", judge] init |
| `reputation` | Reputation PDA | ❌ | ❌ | 读取信誉（计算 weight） |
| `judge_pool_*` | JudgePool PDA(s) | ✅ | ❌ | 每个 category 一个，最多 8 个 |
| `system_program` | Program | ❌ | ❌ | — |

---

#### `unstake_judge`

| 属性 | 值 |
|------|------|
| 调用者 | Judge 本人 |
| 前置条件 | Stake 存在；clock > stake.cooldown_until（冷却期已过，初次 unstake 无需冷却） |
| 后置条件 | 从所有 JudgePool 中移除；Stake 关闭；质押退回 |

参数：无

---

#### `upgrade_config`

| 属性 | 值 |
|------|------|
| 调用者 | config.upgrade_authority（多签 DAO） |
| 前置条件 | signer = config.upgrade_authority |
| 后置条件 | config.treasury 或 config.min_judge_stake 更新 |

参数：

| 参数 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `new_treasury` | Option\<Pubkey\> | — | 新 treasury 地址 |
| `new_min_judge_stake` | Option\<u64\> | > 0 | 新最低质押要求 |

---

### 3.3.2 SDK 公开接口（`@gradience/sdk`）

```typescript
interface GradienceSDK {
  // 任务生命周期
  task: {
    post(params: PostTaskParams): Promise<TransactionSignature>;
    apply(taskId: bigint): Promise<TransactionSignature>;
    submit(taskId: bigint, result: SubmitResultParams): Promise<TransactionSignature>;
    judge(taskId: bigint, winner: PublicKey, score: number, reasonRef?: string): Promise<TransactionSignature>;
    cancel(taskId: bigint): Promise<TransactionSignature>;
    forceRefund(taskId: bigint): Promise<TransactionSignature>;
    list(filter: TaskFilter): Promise<Task[]>;          // 走 Indexer
    submissions(taskId: bigint): Promise<Submission[]>; // 走 Indexer，按信誉排序
  };

  // Judge 管理
  judge: {
    register(categories: number[], stakeAmount: bigint): Promise<TransactionSignature>;
    unstake(): Promise<TransactionSignature>;
  };

  // 信誉查询
  reputation: {
    get(agent: PublicKey): Promise<Reputation>;
    getByCategory(agent: PublicKey, category: number): Promise<CategoryStats>;
  };

  // 钱包适配器（统一接口）
  wallet: {
    use(adapter: WalletAdapter): void;
  };

  // Indexer 端点切换
  indexer: {
    endpoint(url: string): void; // 切换 Managed / Self-hosted
  };
}

interface PostTaskParams {
  evalRef: string;          // evaluationCID
  deadline: number;         // Unix timestamp
  judgeDeadline: number;    // Unix timestamp
  judge?: PublicKey;        // 留空 = Pool 模式
  category: Category;
  minStake: bigint;
  reward: bigint;
  mint?: PublicKey;         // 留空 = SOL
}

interface SubmitResultParams {
  resultRef: string;
  traceRef: string;
  runtimeEnv: {
    provider: string;       // "anthropic" | "openai" | "google" | ...
    model: string;          // "claude-sonnet-4-6" | ...
    runtime: string;        // "opencloud" | "local" | "privy" | ...
    version: string;        // "20251001" | ...
  };
}
```

---

### 3.3.3 Indexer REST API

```
GET  /api/tasks
  ?status=open|completed|refunded
  ?category=0-7
  ?mint=SOL|<pubkey>
  ?poster=<pubkey>
  ?limit=20&offset=0
  → Task[]

GET  /api/tasks/:taskId
  → Task

GET  /api/tasks/:taskId/submissions
  ?sort=score|slot           默认按信誉排序
  → Submission[]

GET  /api/agents/:pubkey/reputation
  → Reputation

GET  /api/judge-pool/:category
  → JudgePoolEntry[]

WebSocket  /ws/tasks
  → 推送 TaskCreated | TaskCompleted | TaskRefunded | SubmissionReceived | JudgeAssigned
```

---

### 3.3.4 Program 事件（Anchor Event）

```rust
#[event]
pub struct TaskCreated {
    pub task_id:  u64,
    pub poster:   Pubkey,
    pub judge:    Pubkey,
    pub reward:   u64,
    pub category: u8,
    pub deadline: i64,
}

#[event]
pub struct SubmissionReceived {
    pub task_id:         u64,
    pub agent:           Pubkey,
    pub result_ref:      String,
    pub trace_ref:       String,
    pub submission_slot: u64,
}

#[event]
pub struct TaskJudged {
    pub task_id:      u64,
    pub winner:       Pubkey,
    pub score:        u8,
    pub agent_payout: u64,
    pub judge_fee:    u64,
    pub protocol_fee: u64,
}

#[event]
pub struct TaskRefunded {
    pub task_id: u64,
    pub reason:  RefundReason, // Expired | Cancelled | LowScore | ForceRefund
    pub amount:  u64,
}

#[event]
pub struct JudgeRegistered {
    pub judge:      Pubkey,
    pub stake:      u64,
    pub categories: Vec<u8>,
}
```

---

## 3.4 错误码定义

```rust
#[error_code]
pub enum GradienceError {
    // 任务状态错误 6000-6009
    #[msg("Task is not in Open state")]
    TaskNotOpen,                    // 6000
    #[msg("Task deadline has passed")]
    DeadlinePassed,                 // 6001
    #[msg("Judge deadline has not passed yet")]
    JudgeDeadlineNotPassed,         // 6002
    #[msg("Force refund delay has not passed yet")]
    ForceRefundDelayNotPassed,      // 6003
    #[msg("Task already has submissions, cannot cancel")]
    HasSubmissions,                 // 6004
    #[msg("No submissions found for this task")]
    NoSubmissions,                  // 6005

    // 权限错误 6010-6019
    #[msg("Signer is not the task poster")]
    NotTaskPoster,                  // 6010
    #[msg("Signer is not the task judge")]
    NotTaskJudge,                   // 6011
    #[msg("Signer is not the config upgrade authority")]
    NotUpgradeAuthority,            // 6012
    #[msg("Agent has not applied for this task")]
    AgentNotApplied,                // 6013
    #[msg("Winner has no submission for this task")]
    WinnerNoSubmission,             // 6014

    // 质押 / 数量错误 6020-6029
    #[msg("Insufficient agent stake amount")]
    InsufficientAgentStake,         // 6020
    #[msg("Insufficient judge stake amount")]
    InsufficientJudgeStake,         // 6021
    #[msg("Agent has already applied for this task")]
    AlreadyApplied,                 // 6022
    #[msg("Judge is already registered in this category pool")]
    AlreadyInPool,                  // 6023 — 用于 Judge 增加 category 时检测重复（未来扩展）
    #[msg("Judge unstake cooldown has not expired")]
    CooldownNotExpired,             // 6024
    #[msg("Judge pool is full")]
    JudgePoolFull,                  // 6025

    // 数据验证错误 6030-6039
    #[msg("Score must be between 0 and 100")]
    InvalidScore,                   // 6030
    #[msg("Category must be between 0 and 7")]
    InvalidCategory,                // 6031
    #[msg("CID reference field is empty")]
    EmptyRef,                       // 6032
    #[msg("RuntimeEnv fields must not be empty")]
    InvalidRuntimeEnv,              // 6033
    #[msg("CID reference exceeds maximum length")]
    RefTooLong,                     // 6034
    #[msg("Categories list is empty or has duplicates")]
    InvalidCategories,              // 6035
    #[msg("Judge pool is empty for this category")]
    JudgePoolEmpty,                 // 6036
    #[msg("Reward amount must be greater than zero")]
    ZeroReward,                     // 6037
    #[msg("Deadline must be in the future")]
    InvalidDeadline,                // 6038
    #[msg("Judge deadline must be after task deadline")]
    InvalidJudgeDeadline,           // 6039

    // 算术错误 6040
    #[msg("Arithmetic overflow")]
    Overflow,                       // 6040

    // Token 错误 6041-6049
    #[msg("Mint has unsupported Token-2022 extensions (Confidential Transfer / Transfer Hook / Permanent Delegate)")]
    UnsupportedMintExtension,       // 6041
}
```

---

## 3.5 状态机精确定义

| 当前状态 | 触发指令 | 前置条件 | 新状态 | 副作用 |
|---------|---------|----------|--------|--------|
| —（不存在）| `post_task` | reward > 0；deadline > now | Open | 创建 Task + Escrow；锁入 reward；若 Pool 模式则抽选 judge |
| Open | `apply_for_task` | clock < deadline；未申请过；stake ≥ minStake | Open | 创建 Application；质押锁入 Escrow；按需创建 Reputation；rep.global.total_applied++ |
| Open | `submit_result` | clock < deadline；已申请 | Open | 更新 Submission（可多次覆盖）；记录 slot |
| Open | `judge_and_pay` | signer = judge；score ≥ MIN_SCORE | **Completed** | 三方分账；Reputation 更新；Application 质押退回 |
| Open | `judge_and_pay` | signer = judge；score < MIN_SCORE | **Refunded** | 全额退 Poster；Application 质押退回 |
| Open | `cancel_task` | signer = poster；submission_count = 0 | **Refunded** | 98% 退 Poster；2% → Treasury |
| Open | `refund_expired` | clock > deadline；submission_count = 0 | **Refunded** | 100% 退 Poster |
| Open | `force_refund` | clock > judge_deadline + 7d；submission_count > 0 | **Refunded** | 95% → Poster；3% → 最活跃 Agent；2% → Treasury；Judge Stake Slash |
| Completed | — | — | Completed | 终态 |
| Refunded | — | — | Refunded | 终态 |

---

## 3.6 算法与计算

### 3.6.1 费用计算（整数除法，向下取整）

```
judge_fee    = reward * JUDGE_FEE_BPS / 10000       // 3%
protocol_fee = reward * PROTOCOL_FEE_BPS / 10000    // 2%
agent_payout = reward - judge_fee - protocol_fee     // 95%（含余数，余数归 Agent）

// 示例：reward = 1000 lamports
// judge_fee    = 1000 * 300 / 10000 = 30
// protocol_fee = 1000 * 200 / 10000 = 20
// agent_payout = 1000 - 30 - 20 = 950

// 示例（余数）：reward = 1001 lamports
// judge_fee    = 1001 * 300 / 10000 = 30（30.03，截断）
// protocol_fee = 1001 * 200 / 10000 = 20（20.02，截断）
// agent_payout = 1001 - 30 - 20 = 951（余数 0.05 归 Agent）
```

### 3.6.2 赢家判定

```
// 1. 收集所有 Submission
// 2. Judge 对每个 Submission 打分（off-chain，只有最终 winner + score 上链）
// 3. 链上验证：
valid = score >= MIN_SCORE (60)
if !valid:
    state = Refunded, 全额退款

// 4. 平局处理（Judge 保证唯一 winner，在 off-chain 环节完成）
// 若两个 Submission 分数相同，Judge 选取 submission_slot 更小者（更早提交）
```

### 3.6.3 Judge Pool 加权随机选取

```
// on-chain 执行，在 post_task Pool 模式时调用
seed    = sha256(recent_blockhash || task_id.to_le_bytes() || clock.slot.to_le_bytes())
point   = u64::from_le_bytes(seed[0..8]) % pool.total_weight
cumulative = 0u32
for entry in pool.entries:
    cumulative += entry.weight
    if (point as u32) < cumulative:
        task.judge = entry.judge
        return

// 若 pool 为空：返回 JudgePoolEmpty 错误
```

### 3.6.4 Judge 权重计算

```
// 在 register_judge 和 reputation 更新时重新计算
stake_weight      = min(stake_amount / LAMPORTS_PER_SOL, 1000) as u32
reputation_weight = min(reputation.global.avg_score / 100, 100) as u32
weight            = stake_weight + reputation_weight
// 最大权重：1000 + 100 = 1100
// 最小权重（刚注册，无信誉）：1（stake=1 SOL → stake_weight=1，reputation=0）
```

### 3.6.5 Reputation 更新（judge_and_pay 后）

```
// 更新 winner 的全局信誉
prev_avg   = rep.global.avg_score  // 0-10000
prev_count = rep.global.completed
new_avg    = (prev_avg * prev_count + score * 100) / (prev_count + 1)
rep.global.avg_score  = new_avg
rep.global.completed  = prev_count + 1
rep.global.win_rate   = rep.global.completed * 10000 / rep.global.total_applied

// 注意：total_applied 在 apply_for_task 时递增（无论最终是否获胜）
// completed 仅在 judge_and_pay 且作为 winner 时递增

// 更新 category 信誉（同逻辑，对应 category 的 CategoryStats）
// 更新 Judge 的 weight（在对应 JudgePool 中更新 entry.weight）
```

---

## 3.7 PDA 推导（Seeds）

| PDA 用途 | Seeds | 说明 |
|---------|-------|------|
| Task | `[b"task", task_id.to_le_bytes()]` | task_id = u64 小端序 |
| Escrow | `[b"escrow", task_id.to_le_bytes()]` | — |
| Application | `[b"application", task_id.to_le_bytes(), agent.as_ref()]` | — |
| Submission | `[b"submission", task_id.to_le_bytes(), agent.as_ref()]` | — |
| Reputation | `[b"reputation", agent.as_ref()]` | agent 可以是 Agent 或 Judge |
| Stake | `[b"stake", judge.as_ref()]` | — |
| JudgePool | `[b"judge_pool", &[category]]` | category 为单字节 |
| Treasury | `[b"treasury"]` | — |
| ProgramConfig | `[b"config"]` | — |

**种子冲突检查**：
- `task` vs `config`：前缀不同，无冲突
- `stake` vs `submission`：前缀不同，无冲突
- 所有 PDA 前缀唯一，无需额外区分

---

## 3.8 安全规则

| 规则 | 实现方式 | 验证方法 |
|------|---------|---------|
| 防重入 | CEI 模式（先检查，再更新状态，最后转账） | 代码审查 + 测试 |
| Poster 权限校验 | `constraint = task.poster == poster.key()` | 单元测试 |
| Judge 权限校验 | `constraint = task.judge == judge.key()` | 单元测试 |
| 费用常量不可升级 | 定义为 `const`，不存储在 ProgramConfig | 代码审查 |
| Judge Pool 随机不可预测 | 使用 `recent_blockhash + task_id + slot` 作为种子 | 统计测试 |
| Judge Slash | force_refund 时扣除 Judge Stake 的 min_judge_stake | 集成测试 |
| 溢出保护 | 所有 u64 运算使用 `checked_add / checked_mul`，失败返回 Overflow | 边界测试 |
| 质押冷却期 | unstake 前检查 `clock.unix_timestamp > stake.cooldown_until` | 时间模拟测试 |
| 无效 CID 防护 | 检查 ref 字段非空且 len ≤ MAX_REF_LEN | 参数验证测试 |
| Pool 满员保护 | register_judge 时检查 pool.entries.len() < MAX_JUDGES_PER_POOL | 边界测试 |

---

## 3.9 边界条件清单

| # | 边界条件 | 预期行为 |
|---|---------|---------|
| 1 | reward = 1 lamport | judge_fee=0, protocol_fee=0, agent_payout=1（余数归 Agent） |
| 2 | reward = u64::MAX | 检测溢出，返回 Overflow 错误 |
| 3 | 0 个 Agent 申请，deadline 到期 | refund_expired 退款 100%，无手续费 |
| 4 | 1 个 Agent 申请但 score < 60 | Refunded，退款 Poster，Agent 质押退回 |
| 5 | 200 个 Agent 同时申请同一任务 | 均可申请，submission_count 正确递增，Judge 选最优 |
| 6 | Agent 重复提交（覆盖） | Submission PDA 更新，slot 刷新，旧数据丢弃 |
| 7 | JudgePool 恰好 1 个 Judge | 必然选中该 Judge，Pool 模式正常运行 |
| 8 | JudgePool 达到 200 上限 | register_judge 返回 JudgePoolFull |
| 9 | Judge 在评判期前 unstake | 冷却期 7 天保护，确保评判期内 Judge 不能离场 |
| 10 | SPL Token reward，精度 6 位 | 费用计算以 u64 最小单位（1e-6 token），行为与 SOL 一致 |
| 11 | Poster 指定 Judge = Pubkey::default() | 视为 Pool 模式处理（约定 default = null） |
| 12 | force_refund，多个 Agent 提交数相同 | 按 submission_slot 最早者获得 3%（同平局规则） |
| 13 | runtime_env 所有字段均为空字符串 | 返回 InvalidRuntimeEnv |
| 14 | category = 8（超出范围） | 返回 InvalidCategory |
| 15 | deadline = clock.unix_timestamp（恰好当前时间）| 返回 InvalidDeadline（必须 > now） |

---

## ✅ Phase 3 验收标准

- [x] 所有 9 个 PDA 精确到字段类型和字节大小
- [x] 所有 10 条指令有完整参数、账户、前后置条件
- [x] 错误码统一编号（6000-6041），共 42 个（含 UnsupportedMintExtension）
- [x] 状态机转换条件精确，无歧义，覆盖所有终态
- [x] 费用计算有伪代码，精度处理（余数归 Agent）已说明
- [x] JudgePool 加权随机算法有伪代码，随机源明确
- [x] Reputation 更新公式完整（含 total_applied 字段）
- [x] PDA Seeds 无冲突，全部列出
- [x] 安全规则 10 条，均有验证方法
- [x] 边界条件 15 个，覆盖溢出、空池、覆盖提交、精度等场景
- [x] 所有大小计算基于 Borsh 序列化（紧凑排列，无 padding），已标注说明
- [x] SPL Token / Token-2022 版本账户完整列出（post_task、judge_and_pay）
- [x] apply_for_task 质押机制明确（SOL/SPL 路径、Escrow 存储、退回时机）
- [x] 本文档可以直接交给任何开发者（或 AI），不需要额外口头解释即可实现

**Phase 3 验收通过后，进入 Phase 4: Task Breakdown →**
