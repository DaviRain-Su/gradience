> **任务**: GRA-2 扩展  
> **输入**: `docs/multi-chain/03-reputation-oracle-spec.md`, `protocol/design/reputation-feedback-loop.md`, `programs/agent-arena/`  
> **输出**: Phase 3 Technical Spec — EVM → Solana Reputation Sync (Hybrid Bridge + Relayer)  
> **代码必须与本文档 100% 一致。**

---

## 1. 概述

### 1.1 目标

定义 **EVM 链上 Agent 行为如何同步更新到 Solana 核心声誉账本**。确保：

1. EVM 上的任何有益行为（ERC-8004 feedback、第三方 dApp 评分、链上交互等）都能被 Solana Program 认可并合并。
2. 同步机制是 **双通道 Hybrid**：高频小额行为走 Relayer 签名；关键任务走 Wormhole 消息桥接。
3. Solana 始终保持为声誉的唯一核心账本，EVM 链是声誉的输入源（input source），而不是独立账本。

### 1.2 核心设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **同步方向** | EVM → Solana | Solana 是唯一核心协议链 |
| **双通道策略** | Relayer (高频小额) + Wormhole (关键任务) | 成本与安全性平衡 |
| **EVM 事件源** | `AgentActivityLogger` 合约 | 统一事件格式，方便监听和验证 |
| **防重放** | `evm_sync_nonce` 严格递增 | 拒绝旧签名/VAA 重复消费 |
| **数据合并** | 加权平均，Solana 原生数据权重更高 | 防止 EVM 侧刷分 |

### 1.3 架构图

```
EVM Chain (Base / Arbitrum)
│
├─ 第三方 dApp A 调用 ERC-8004 Registry → emit FeedbackGiven
├─ 第三方 dApp B 调用 AgentActivityLogger.rateAgent()
└─ Gradience Cross-Chain Task 完成 → emit TaskCompletedCrossChain
│
▼
┌─────────────────────────────────────────────────────────────┐
│              AgentActivityLogger (EVM Contract)             │
│  • 记录所有可归因于 Agent 的行为事件                         │
│  • 事件格式标准化，包含 agentId、value、category、source    │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        ┌───────────────────────┐   ┌─────────────────────────┐
        │   Relayer Service     │   │  Wormhole Core Bridge   │
        │  (daemon 常驻服务)     │   │  (关键任务/VAA)         │
        │  • 监听事件             │   │  • publishMessage()     │
        │  • 打包 + ECDSA 签名    │   │  • Guardian 签名        │
        │  • 调用 Solana Program  │   │  • VAA 传递到 Solana    │
        └───────────┬───────────┘   └───────────┬─────────────┘
                    │                           │
                    ▼                           ▼
        ┌───────────────────────────────────────────────────────┐
        │            Solana Agent Arena Program                 │
        │  ┌─────────────────────────────────────────────────┐  │
        │  │  instruction: UpdateReputationFromEvm           │  │
        │  │  • 验证 Relayer 签名 或 解析 Wormhole VAA      │  │
        │  │  • 检查 evm_sync_nonce 严格递增                 │  │
        │  │  • 调用内部 merge_evm_reputation()              │  │
        │  └─────────────────────────────────────────────────┘  │
        │                        │                              │
        │                        ▼                              │
        │              ┌─────────────────┐                      │
        │              │  Reputation PDA │ ← 唯一核心账本       │
        │              └─────────────────┘                      │
        └───────────────────────────────────────────────────────┘
```

---

## 2. Solana Program 变更

### 2.1 新增数据结构

#### `EvmReputationUpdate` (instruction data)

```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct EvmReputationUpdate {
    pub agent: PubkeyBytes,
    pub chain_id: u64,           // EVM chainId, e.g. 8453 for Base
    pub nonce: u64,              // 严格递增，每 agent + chain 独立
    pub completed: u32,          // 本次同步新增的 completed 数量
    pub total_applied_delta: u32,// 本次同步新增的 applied 数量
    pub score_sum: u64,          // score * completed 的累加和
    pub category: u8,            // 0-7, 255 = global/no category
    pub source: String,          // 来源标识，如 "erc8004", "dapp_rating"
    pub proof_type: ProofType,   // RelayerSignature | WormholeVAA
    pub proof: Vec<u8>,          // 签名或 VAA bytes
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum ProofType {
    RelayerSignature = 0,
    WormholeVAA = 1,
}
```

#### `EvmAuthority` (PDA)

存储被信任的 Relayer 公钥和 Wormhole program ID。

```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct EvmAuthority {
    pub owner: PubkeyBytes,
    pub relayers: Vec<PubkeyBytes>,   // 最多 8 个 relayer Ed25519 pubkey
    pub wormhole_program: PubkeyBytes,// Wormhole program on Solana
    pub max_relayer_age_slots: u64,  // Relayer 签名最大有效 slot 数
    pub bump: u8,
}

pub const EVM_AUTHORITY_SEED: &[u8] = b"evm_authority";
```

PDA 种子：`[b"evm_authority", program_id]`

#### 扩展 `Reputation` 结构

在现有 `Reputation` 中新增 `evm_sync_nonce` 字段（**不会破坏现有账户布局，因为程序首次初始化时即写入**；对于已有账户，通过 on-chain migration 指令初始化）：

```rust
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct Reputation {
    pub agent: PubkeyBytes,
    pub global: ReputationStats,
    pub by_category: [CategoryStats; MAX_CATEGORIES],
    pub bump: u8,
    // NEW
    pub evm_sync_nonce: u64,      // 最后接受的 EVM 同步 nonce
}
```

**数据长度变更**：
- 原 `REPUTATION_DATA_LEN` = `PUBKEY_BYTES_LEN + REPUTATION_STATS_DATA_LEN + CATEGORY_STATS_DATA_LEN * 8 + 1`
- 新 `REPUTATION_DATA_LEN` = 原长度 `+ 8`

---

### 2.2 新增 Instruction: `UpdateReputationFromEvm`

| 属性 | 值 |
|------|-----|
| **指令名** | `UpdateReputationFromEvm` |
| **调用者** | 任何人（Relayer 或 Wormhole redeemer） |
| **前置条件** | `proof` 有效且 `nonce > reputation.evm_sync_nonce` |
| **后置条件** | 更新 `Reputation PDA`，递增 `evm_sync_nonce` |

**账户列表：**

| 账户 | 类型 | mut | signer | 说明 |
|------|------|-----|--------|------|
| `evm_updater` | AccountInfo | ❌ | ✅ | Relayer 签名者或 Wormhole redeemer |
| `agent` | AccountInfo | ❌ | ❌ | Agent 主账户（用于验证绑定） |
| `reputation` | AccountInfo | ✅ | ❌ | Reputation PDA |
| `evm_authority` | AccountInfo | ❌ | ❌ | EvmAuthority PDA |
| `wormhole_program` | AccountInfo | ❌ | ❌ | Wormhole program（仅 VAA 模式需要） |
| `system_program` | AccountInfo | ❌ | ❌ | System program |

**处理逻辑（伪代码）：**

```rust
fn process_update_reputation_from_evm(
    program_id: &Address,
    accounts: &[AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = EvmReputationUpdate::try_from_slice(instruction_data)?;

    // 1. 验证 reputation PDA
    let (reputation_pda, _) = Address::find_program_address(
        &[REPUTATION_SEED, ix.agent.as_ref()],
        program_id,
    );
    verify_account(accounts.reputation, &reputation_pda)?;

    // 2. 解析 reputation
    let mut reputation = parse_reputation(accounts.reputation)?;

    // 3. 防重放检查
    if ix.nonce <= reputation.evm_sync_nonce {
        return Err(GradienceProgramError::EvmNonceTooOld.into());
    }

    // 4. 验证 proof
    match ix.proof_type {
        ProofType::RelayerSignature => {
            verify_relayer_signature(
                accounts.evm_authority,
                accounts.evm_updater,
                &ix,
                &ix.proof,
            )?;
        }
        ProofType::WormholeVAA => {
            verify_wormhole_vaa(
                accounts.evm_authority,
                accounts.wormhole_program,
                &ix.proof,
            )?;
        }
    }

    // 5. 合并 EVM 声誉数据
    merge_evm_reputation(
        &mut reputation,
        ix.completed,
        ix.total_applied_delta,
        ix.score_sum,
        ix.category,
    )?;

    // 6. 更新 nonce 并写回
    reputation.evm_sync_nonce = ix.nonce;
    serialize_and_write(accounts.reputation, &reputation)?;

    // 7. emit 事件
    emit_event(EvmReputationSyncedEvent {
        agent: ix.agent,
        chain_id: ix.chain_id,
        nonce: ix.nonce,
        new_global_score: reputation.global.avg_score,
    });

    Ok(())
}
```

---

### 2.3 签名验证函数

#### `verify_relayer_signature`

```rust
fn verify_relayer_signature(
    evm_authority: &AccountView,
    relayer: &AccountView,
    ix: &EvmReputationUpdate,
    signature: &[u8],
) -> Result<(), ProgramError> {
    let authority = parse_evm_authority(evm_authority)?;

    let relayer_pubkey = relayer.address().as_ref();
    if !authority.relayers.iter().any(|r| r.as_slice() == relayer_pubkey) {
        return Err(GradienceProgramError::UnauthorizedRelayer.into());
    }

    // 构造签名消息
    let message = keccak256_digest(
        &ix.agent,
        &ix.chain_id.to_le_bytes(),
        &ix.nonce.to_le_bytes(),
        &ix.completed.to_le_bytes(),
        &ix.total_applied_delta.to_le_bytes(),
        &ix.score_sum.to_le_bytes(),
        &ix.category.to_le_bytes(),
        ix.source.as_bytes(),
    );

    // Ed25519 签名验证
    if !ed25519_verify(relayer_pubkey, &message, signature) {
        return Err(GradienceProgramError::InvalidRelayerSignature.into());
    }

    Ok(())
}
```

#### `verify_wormhole_vaa`

```rust
fn verify_wormhole_vaa(
    evm_authority: &AccountView,
    wormhole_program: &AccountView,
    vaa_bytes: &[u8],
) -> Result<(), ProgramError> {
    let authority = parse_evm_authority(evm_authority)?;

    // 验证传入的 wormhole_program 与 authority 中记录的一致
    if wormhole_program.address().as_ref() != authority.wormhole_program.as_slice() {
        return Err(GradienceProgramError::InvalidWormholeProgram.into());
    }

    // 调用 Wormhole program 的 parse_and_verify_vaa
    // （此处简化为 CPI 调用，具体 ABI 以 Wormhole SDK 为准）
    invoke_wormhole_verify(wormhole_program, vaa_bytes)?;

    // 解析 VAA payload 并校验 emitter chain / address
    let payload = parse_vaa_payload(vaa_bytes)?;
    if payload.emitter_chain != EXPECTED_EVM_CHAIN_ID {
        return Err(GradienceProgramError::InvalidVAAEmitter.into());
    }

    Ok(())
}
```

---

### 2.4 声誉合并算法

新增 `merge_evm_reputation`，复用并扩展现有 `update_reputation` 的数学逻辑。

```rust
fn merge_evm_reputation(
    reputation: &mut Reputation,
    completed_delta: u32,
    total_applied_delta: u32,
    score_sum: u64,          // sum(score_i * 100)
    category: u8,             // 255 = 只更新 global
) -> Result<(), ProgramError> {
    if completed_delta == 0 && total_applied_delta == 0 {
        return Ok(());
    }

    // 1. 更新 global.completed
    let prev_global_completed = reputation.global.completed;
    let next_global_completed = prev_global_completed
        .checked_add(completed_delta)
        .ok_or(GradienceProgramError::Overflow)?;

    // 2. 更新 global.avg_score（加权平均）
    if completed_delta > 0 {
        let prev_avg = (reputation.global.avg_score as u128)
            .checked_mul(prev_global_completed as u128)
            .unwrap_or(0);
        let new_avg = (prev_avg + score_sum as u128)
            .checked_div(next_global_completed as u128)
            .ok_or(GradienceProgramError::Overflow)?;
        reputation.global.avg_score = u16::try_from(new_avg)
            .map_err(|_| GradienceProgramError::Overflow)?;
    }

    reputation.global.completed = next_global_completed;

    // 3. 更新 global.total_applied
    reputation.global.total_applied = reputation.global.total_applied
        .checked_add(total_applied_delta)
        .ok_or(GradienceProgramError::Overflow)?;

    // 4. 更新 global.win_rate
    reputation.global.win_rate = if reputation.global.total_applied == 0 {
        0
    } else {
        let wr = (reputation.global.completed as u128)
            .checked_mul(10_000)
            .and_then(|v| v.checked_div(reputation.global.total_applied as u128))
            .ok_or(GradienceProgramError::Overflow)?;
        u16::try_from(wr).map_err(|_| GradienceProgramError::Overflow)?
    };

    // 5. 更新 category（若指定）
    if category != 255 && (category as usize) < MAX_CATEGORIES && completed_delta > 0 {
        let cat = &mut reputation.by_category[category as usize];
        let prev_cat_completed = cat.completed;
        let next_cat_completed = prev_cat_completed
            .checked_add(completed_delta)
            .ok_or(GradienceProgramError::Overflow)?;

        let prev_cat_avg = (cat.avg_score as u128)
            .checked_mul(prev_cat_completed as u128)
            .unwrap_or(0);
        let new_cat_avg = (prev_cat_avg + score_sum as u128)
            .checked_div(next_cat_completed as u128)
            .ok_or(GradienceProgramError::Overflow)?;

        cat.completed = next_cat_completed;
        cat.avg_score = u16::try_from(new_cat_avg)
            .map_err(|_| GradienceProgramError::Overflow)?;
    }

    Ok(())
}
```

**权重说明**：EVM 数据不单独设置权重系数，而是通过 `score_sum` 由 Relayer/Bridge 在链下预先计算好传入。这样 Solana Program 保持简单且无外部依赖。

---

## 3. EVM 合约设计

### 3.1 `AgentActivityLogger` 合约（Solidity）

部署在 Base / Arbitrum 上，只负责**标准化记录事件**，不存储复杂状态。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentActivityLogger {
    // 事件定义
    event FeedbackGiven(
        bytes32 indexed agentId,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        string source,
        uint256 timestamp
    );

    event ThirdPartyRating(
        bytes32 indexed agentId,
        address indexed rater,
        uint16 score,        // 0-10000
        uint8 category,      // 0-7, 255 = global
        string sourceDapp,
        string memo,
        uint256 timestamp
    );

    event TaskCompletedCrossChain(
        bytes32 indexed agentId,
        uint256 taskId,
        uint16 score,        // 0-10000
        uint256 reward,
        uint8 category,
        string resultRef,
        uint256 timestamp
    );

    // 任何人都可以记录一个标准化事件
    // （高级功能可以加 access control，MVP 无需限制）

    function logFeedback(
        bytes32 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata source
    ) external {
        emit FeedbackGiven(agentId, value, valueDecimals, tag1, tag2, source, block.timestamp);
    }

    function logRating(
        bytes32 agentId,
        uint16 score,
        uint8 category,
        string calldata sourceDapp,
        string calldata memo
    ) external {
        emit ThirdPartyRating(agentId, msg.sender, score, category, sourceDapp, memo, block.timestamp);
    }

    function logTaskCompleted(
        bytes32 agentId,
        uint256 taskId,
        uint16 score,
        uint256 reward,
        uint8 category,
        string calldata resultRef
    ) external {
        emit TaskCompletedCrossChain(agentId, taskId, score, reward, category, resultRef, block.timestamp);
    }
}
```

### 3.2 合约部署策略

| 链 | 合约名 | 用途 |
|----|--------|------|
| Base Sepolia | `AgentActivityLogger` | 测试网验证 |
| Base Mainnet | `AgentActivityLogger` | 主生产消费链 |
| Arbitrum One | `AgentActivityLogger` | 扩展 EVM 生态 |

---

## 4. Relayer Service 设计

### 4.1 服务职责

`apps/agent-daemon` 中新增常驻服务 `EvmToSolanaRelayer`：

1. 通过 `ethers.js` 订阅 `AgentActivityLogger` 事件
2. 按 agent + chain 聚合事件（滑动窗口 5 分钟）
3. 计算 `completed_delta`、`total_applied_delta`、`score_sum`
4. 生成 `EvmReputationUpdate` + Ed25519 签名
5. 调用 Solana Program `UpdateReputationFromEvm` instruction
6. 维护链下 `nonce` 映射，保证严格递增

### 4.2 核心类型

```typescript
// apps/agent-daemon/src/reputation/evm-to-solana-relayer.ts

interface EvmEventBatch {
    agentId: string;          // bytes32 hex
    chainId: number;
    events: EvmActivityEvent[];
    nonce: bigint;            // 从链下 DB 或 Solana 读取后 +1
}

interface EvmActivityEvent {
    type: 'feedback' | 'rating' | 'task_completed';
    score: number;            // 0-10000
    category: number;         // 0-7, 255 = global
    timestamp: number;
}

interface RelayerSignaturePayload {
    agent: Uint8Array;        // 32 bytes
    chainId: bigint;
    nonce: bigint;
    completed: number;
    totalAppliedDelta: number;
    scoreSum: bigint;
    category: number;
    source: string;
}
```

### 4.3 签名生成

```typescript
function hashRelayerPayload(payload: RelayerSignaturePayload): Uint8Array {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint64', 'uint64', 'uint32', 'uint32', 'uint64', 'uint8', 'string'],
        [
            payload.agent,
            payload.chainId,
            payload.nonce,
            payload.completed,
            payload.totalAppliedDelta,
            payload.scoreSum,
            payload.category,
            payload.source,
        ],
    );
    return ethers.getBytes(ethers.keccak256(encoded));
}

async function signRelayerPayload(
    payload: RelayerSignaturePayload,
    keypair: Keypair,
): Promise<Uint8Array> {
    const message = hashRelayerPayload(payload);
    return nacl.sign.detached(message, keypair.secretKey);
}
```

### 4.4 批量策略

- **时间窗口**：每 5 分钟聚合一次事件
- **触发阈值**：单 agent 累积 ≥3 个事件 或 时间窗口到期
- **分类合并**：同一 category 的 rating/feedback 在 batch 内先按加权平均合并，再生成 `score_sum`

**合并示例：**

```
events: [rating 8000, rating 9000, feedback 8500]
category = 2
completed_delta = 3
score_sum = 8000 + 9000 + 8500 = 25500
category = 2（若混合 global 事件则拆分为 2 个 batch）
```

---

## 5. Wormhole 桥接路径（关键任务）

### 5.1 触发条件

以下任一条件满足时，走 Wormhole 而不是 Relayer：

1. 单次事件 reward > 1 ETH（或等值稳定币）
2. 单次评分 score > 9500（极高价值证明）
3. 用户/任务发起方明确要求“链上桥接证明”
4. Relayer 连续失败 3 次，自动降级到 Wormhole 保底

### 5.2 消息格式

复用 `packages/cross-chain-adapters` 的 `WormholeMessage`，新增 messageType：

```typescript
interface WormholeReputationMessage {
    version: '1.0';
    messageType: 'evm_reputation_sync';  // 新增
    sourceChain: string;
    targetChain: 'solana';
    timestamp: number;
    nonce: number;
    sourceAgentAddress: string;   // EVM address
    solanaAgentAddress: string;   // Solana pubkey (base58)
    payload: {
        chainId: number;
        nonce: bigint;
        completed: number;
        totalAppliedDelta: number;
        scoreSum: bigint;
        category: number;
        source: string;
        // 原始事件 hashes，用于 Solana 侧审计
        eventHashes: string[];
    };
}
```

### 5.3 Solana 消费流程

1. Relayer / Guardian 在 Solana 上 redeem VAA
2. VAA 验证通过后，调用 `UpdateReputationFromEvm`（`proof_type = WormholeVAA`）
3. Program 从 VAA payload 中解析出 `EvmReputationUpdate` 各字段
4. 走相同的 `merge_evm_reputation` 逻辑

---

## 6. 与现有代码的对接

### 6.1 新建/修改文件清单

| 文件路径 | 动作 | 说明 |
|----------|------|------|
| `programs/agent-arena/src/instructions/update_reputation_from_evm/` | 新建 | instruction / data / processor / accounts |
| `programs/agent-arena/src/state/agent_layer.rs` | 修改 | Reputation 新增 `evm_sync_nonce` |
| `programs/agent-arena/src/errors.rs` | 修改 | 新增 `EvmNonceTooOld`, `UnauthorizedRelayer`, `InvalidRelayerSignature`, `InvalidWormholeProgram`, `InvalidVAAEmitter` |
| `apps/agent-daemon/src/reputation/evm-to-solana-relayer.ts` | 新建 | Relayer 服务 |
| `apps/agent-daemon/src/reputation/proof-generator.ts` | 新建 | 生成 `EvmReputationUpdate` + 签名 |
| `apps/agent-daemon/src/reputation/push-service.ts` | 修改 | 启动时注册 Relayer 监听 |
| `packages/evm-oracle-contracts/src/AgentActivityLogger.sol` | 新建 | EVM 事件日志合约 |
| `packages/cross-chain-adapters/src/adapters/wormhole-adapter.ts` | 修改 | 新增 `syncEvmReputation` 方法 |

### 6.2 EVM 合约目录建议

由于 `apps/agent-layer-evm` 已删除，建议新建轻量目录：

```
packages/evm-oracle-contracts/
  ├── src/AgentActivityLogger.sol
  ├── src/GradienceReputationOracle.sol   (已有的 Phase 3 spec)
  ├── src/interfaces/IAgentActivityLogger.sol
  ├── test/AgentActivityLogger.t.sol
  └── foundry.toml
```

---

## 7. 安全与风险模型

| 风险 | 缓解方案 |
|------|----------|
| **Relayer 造假 / 刷分** | 多 Relayer 轮换 + 异常检测；Relayer 行为完全链上可审计 |
| **Wormhole VAA 伪造** | Solana Program 直接调用 Wormhole `parse_and_verify_vaa` CPI |
| **EVM 事件源 spam** | `AgentActivityLogger` 可加 `onlyVerifiedSource` modifier（MVP 后迭代） |
| **重放攻击** | `evm_sync_nonce` 严格递增，旧 batch 无法再次消费 |
| **Solana Program 账户膨胀** | `Reputation` 仅增加 8 bytes，现有账户通过一次性 migration instruction 升级 |
| **Relayer 单点宕机** | 多 Relayer热备 + Wormhole fallback |

---

## 8. 验收标准

- [ ] `Reputation` 账户成功新增 `evm_sync_nonce` 并通过 Pinocchio SBF 编译
- [ ] `UpdateReputationFromEvm` instruction 实现并通过单元测试
- [ ] `AgentActivityLogger.sol` 部署到 Base Sepolia 并生成事件
- [ ] Relayer 成功监听事件、签名并调用 Solana Program 更新声誉
- [ ] Wormhole `syncEvmReputation` 路径端到端跑通（VAA verify → Solana update）
- [ ] `merge_evm_reputation` 的数学逻辑与本地 `update_reputation` 一致且可审计
- [ ] 第三方 dApp 在 EVM 上提交 feedback 后，Solana `Reputation PDA` 在 10 分钟内可见更新

---

## 9. 参考文档

- `docs/multi-chain/03-reputation-oracle-spec.md` — 原始 Oracle 架构
- `apps/agent-daemon/docs/03-technical-spec-reputation-oracle-interface.md` — ERC-8004 兼容接口
- `protocol/design/reputation-feedback-loop.md` — 声誉反馈循环
- `programs/agent-arena/src/state/agent_layer.rs` — Solana Reputation 数据结构
- `packages/cross-chain-adapters/src/adapters/wormhole-adapter.ts` — Wormhole 桥接实现
