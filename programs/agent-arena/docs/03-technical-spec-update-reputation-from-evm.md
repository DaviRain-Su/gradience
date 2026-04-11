# Phase 3: Technical Spec — UpdateReputationFromEvm Instruction

> **任务**: GRA-6  
> **输入**: `apps/agent-daemon/docs/03-technical-spec-evm-to-solana-reputation-sync.md`  
> **输出**: 本技术规格文档  
> ⚠️ **代码必须与本文档 100% 一致。**

---

## 1. 目标与范围

在 `programs/agent-arena/` 中实现 `UpdateReputationFromEvm` instruction，使 Solana Program 能够接收并验证来自 EVM 链的声誉同步数据。

本次修改不涉及 Wormhole VAA 路径（仅实现 `ProofType::RelayerSignature`），为最小可用版本（MVP）。

---

## 2. 数据结构变更

### 2.1 `Reputation` 新增字段

```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Reputation {
    pub agent: PubkeyBytes,
    pub global: ReputationStats,
    pub by_category: [CategoryStats; MAX_CATEGORIES],
    pub bump: u8,
    // NEW
    pub evm_sync_nonce: u64,
}
```

**Data length 变更**:
- `REPUTATION_DATA_LEN` += 8
- `REPUTATION_LEN` += 8
- 测试中 `REPUTATION_DATA_LEN` 期望值从 `109` 改为 `117`
- `REPUTATION_LEN` 期望值从 `111` 改为 `119`

### 2.2 `EvmAuthority` PDA

```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct EvmAuthority {
    pub owner: PubkeyBytes,
    pub relayers: Vec<PubkeyBytes>,
    pub max_relayer_age_slots: u64,
    pub bump: u8,
}

pub const EVM_AUTHORITY_SEED: &[u8] = b"evm_authority";
```

PDA 种子：`[b"evm_authority", program_id]`

Data length:
- `EVM_AUTHORITY_DATA_LEN` = `PUBKEY_BYTES_LEN + BORSH_VEC_PREFIX_LEN + (PUBKEY_BYTES_LEN * 8) + 8 + 1`
- `EVM_AUTHORITY_LEN` = `ACCOUNT_HEADER_LEN + EVM_AUTHORITY_DATA_LEN`

### 2.3 `EvmReputationUpdate` Instruction Data

```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct EvmReputationUpdate {
    pub agent: PubkeyBytes,
    pub chain_id: u64,
    pub nonce: u64,
    pub completed: u32,
    pub total_applied_delta: u32,
    pub score_sum: u64,
    pub category: u8,
    pub source: String,
    pub proof: Vec<u8>, // Relayer Ed25519 signature
}
```

---

## 3. 新增 Instruction

### 3.1 `UpdateReputationFromEvm`

**Discriminator**: `14`

**Accounts**:

| # | 名称 | 类型 | mut | signer | 说明 |
|----|------|------|-----|--------|------|
| 0 | `relayer` | AccountInfo | ❌ | ✅ | Relayer 签名者 |
| 1 | `agent` | AccountInfo | ❌ | ❌ | Agent 主账户 |
| 2 | `reputation` | AccountInfo | ✅ | ❌ | Reputation PDA |
| 3 | `evm_authority` | AccountInfo | ❌ | ❌ | EvmAuthority PDA |
| 4 | `system_program` | AccountInfo | ❌ | ❌ | System program |

**处理逻辑**:

1. 解析 `EvmReputationUpdate` instruction data
2. 验证 `reputation` PDA: ` seeds = [b"reputation", agent] `
3. 解析 reputation 账户数据
4. **Nonce 防重放**: `nonce > reputation.evm_sync_nonce`，否则返回 `EvmNonceTooOld`
5. **Relayer 验证**:
   - 解析 `evm_authority`
   - 检查 `relayer` 在 `evm_authority.relayers` 列表中
   - 重建签名消息并调用 `ed25519_verify`
6. **合并声誉**: 调用 `merge_evm_reputation`
7. 更新 `evm_sync_nonce = nonce`
8. 序列化写回 reputation 账户

### 3.2 签名消息格式

```rust
fn build_relayer_message(ix: &EvmReputationUpdate) -> [u8; 32] {
    use const_crypto::keccak256;
    let chain_id_le = ix.chain_id.to_le_bytes();
    let nonce_le = ix.nonce.to_le_bytes();
    let completed_le = ix.completed.to_le_bytes();
    let total_applied_le = ix.total_applied_delta.to_le_bytes();
    let score_sum_le = ix.score_sum.to_le_bytes();
    let category_le = ix.category.to_le_bytes();

    keccak256(
        &ix.agent,
        &chain_id_le,
        &nonce_le,
        &completed_le,
        &total_applied_le,
        &score_sum_le,
        &category_le,
        ix.source.as_bytes(),
    )
}
```

---

## 4. 新增错误码

```rust
/// (6051) EVM sync nonce is too old (replay protection)
#[error("EVM sync nonce too old")]
EvmNonceTooOld = 6051,

/// (6052) Relayer is not authorized
#[error("Unauthorized relayer")]
UnauthorizedRelayer = 6052,

/// (6053) Invalid relayer signature
#[error("Invalid relayer signature")]
InvalidRelayerSignature = 6053,

/// (6054) EvmAuthority account not initialized
#[error("EVM authority not initialized")]
EvmAuthorityNotInitialized = 6054,
```

---

## 5. 声誉合并算法

复用 `merge_evm_reputation`，与 spec 文档一致：

```rust
fn merge_evm_reputation(
    reputation: &mut Reputation,
    completed_delta: u32,
    total_applied_delta: u32,
    score_sum: u64,
    category: u8,
) -> ProgramResult {
    // global update
    // category update (if category != 255)
}
```

---

## 6. 新增 InitializeEvmAuthority Instruction（MVP）

**Discriminator**: `15`

用于初始化 `EvmAuthority` PDA。

**Accounts**:
| # | 名称 | 类型 | mut | signer |
|----|------|------|-----|--------|
| 0 | `owner` | AccountInfo | ❌ | ✅ |
| 1 | `evm_authority` | AccountInfo | ✅ | ❌ |
| 2 | `system_program` | AccountInfo | ❌ | ❌ |

**Data**:
```rust
pub struct InitializeEvmAuthority {
    pub relayers: Vec<PubkeyBytes>,
    pub max_relayer_age_slots: u64,
}
```

---

## 7. 目录结构变更

```
programs/agent-arena/src/
├── state/agent_layer.rs              [修改]
├── errors.rs                         [修改]
├── instructions/
│   ├── mod.rs                        [修改]
│   ├── definition.rs                 [修改]
│   ├── update_reputation_from_evm/
│   │   ├── mod.rs
│   │   ├── data.rs
│   │   ├── accounts.rs
│   │   ├── processor.rs
│   │   └── instruction.rs
│   └── initialize_evm_authority/
│       ├── mod.rs
│       ├── data.rs
│       ├── accounts.rs
│       ├── processor.rs
│       └── instruction.rs
├── traits/instruction.rs             [修改]
├── entrypoint.rs                     [修改]
└── lib.rs                            [不变]
```

---

## 8. 测试要求

1. `test_account_data_lengths_match_spec` 更新期望值
2. 新增 `test_evm_authority_length`
3. `process_update_reputation_from_evm` 测试：
   - 成功更新声誉
   - nonce 过旧被拒绝
   - 非授权 relayer 被拒绝
   - 错误签名被拒绝
4. `process_initialize_evm_authority` 测试：正常初始化

---

## ✅ Phase 3 验收标准

- [x] 数据结构和长度精确
- [x] Instruction 和 account 列表完整
- [x] 错误码编号连续且无冲突
- [x] 签名验证逻辑明确
- [x] 目录结构已定义
