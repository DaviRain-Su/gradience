# Phase 3: Technical Spec — agent-layer-evm

> **范围**: `apps/agent-layer-evm/` — EVM 跨链实现（Base Sepolia）
> **定位**: Solana agent-arena 的 EVM 镜像，逻辑与 Solana 程序保持对齐

---

## 1. 模块职责

agent-layer-evm 将 Agent Arena 的核心逻辑部署到 EVM 链，同时提供：

- 与 Solana 完全对齐的任务生命周期（post/apply/submit/judge/refund）
- 链上 Solana 声誉验证（Ed25519 签名 + 跨链 proof）
- 以 ETH 为支付媒介（无 Token-2022 复杂性）

**不做**：
- 跨链资产桥接（Wormhole / LI.FI 集成在更高层）
- Solana 状态直接读取（通过离线签名 proof 实现）

---

## 2. 技术栈

| 项目 | 说明 |
|------|------|
| Solidity `^0.8.24` | `AgentLayerRaceTask.sol` 使用（含 OpenZeppelin） |
| Solidity `^0.6.8` + `pragma experimental ABIEncoderV2` | `ReputationVerifier.sol` 使用（Ed25519 库依赖） |
| OpenZeppelin `ReentrancyGuard` | 防重入保护（仅主合约） |
| Hardhat | 编译、测试、部署 |
| ethers.js | 脚本交互 |
| Base Sepolia | 部署目标链 |

---

## 3. 合约结构

```
contracts/
├── AgentLayerRaceTask.sol    — 主合约，任务生命周期（313 行）
├── ReputationVerifier.sol    — 跨链声誉验证（157 行）
└── libraries/
    ├── Ed25519.sol            — Ed25519 签名验证（纯 Solidity 实现）
    └── Sha512.sol             — SHA-512（Ed25519 依赖）
```

---

## 4. AgentLayerRaceTask 合约规范

### 常量（与 Solana 对齐）

| 常量 | 值 | 说明 |
|------|----|----|
| `MIN_SCORE` | 60 | 有效评判最低分 |
| `WINNER_PAYOUT_BPS` | 9500 | 95% 奖励给获胜者 |
| `JUDGE_FEE_BPS` | 300 | 3% Judge 费 |
| `PROTOCOL_FEE_BPS` | 200 | 2% 协议费（→ treasury） |
| `MAX_REF_LEN` | 128 | eval_ref 最大字节数 |
| `BPS_DENOMINATOR` | 10000 | 基点分母 |

### 核心 Struct

```solidity
struct Task {
  address poster; address judge; uint8 category;
  uint64 deadline; uint64 judgeDeadline;
  uint256 minStake; uint256 reward;
  TaskState state;  // Open / Completed / Refunded
  string evalRef; address winner; uint8 score;
}

struct Application { bool exists; bool submitted; uint256 stake; }
struct Submission { bool exists; uint64 submittedAt; string resultRef; string traceRef; }
struct Reputation { uint256 totalApplied; uint256 completed; uint256 totalEarned; uint256 totalScore; uint256 winRateBps; }
```

### 公开函数

| 函数 | 说明 |
|------|------|
| `post_task(...)` payable | 发布任务，ETH 作为 reward |
| `apply_for_task(task_id)` payable | 申请任务，ETH 作为 stake |
| `submit_result(task_id, result_ref, trace_ref)` | 提交结果 |
| `judge_and_pay(task_id, winner, score)` | 评判并分发奖励 |
| `claim_expired(task_id)` | 过期退款（任何人可调用） |
| `claim_stake(task_id)` | Agent 取回 stake（**仅当 task.state != Open 时**可调用） |
| `get_submission(task_id, agent)` view | 查询提交 |
| `get_applicants(task_id)` view | 查询申请列表 |
| `get_reputation(agent)` view | 查询声誉 |

### 错误码（custom errors）

27 个 custom error，覆盖所有非法状态转换（`ZeroAddress`、`TaskNotFound`、`NotTaskJudge`、`InvalidScore` 等）

---

## 5. ReputationVerifier 合约规范

用途：将 Solana 上的 Agent 声誉 proof 提交并存储到 EVM 链，防止女巫攻击。

### 核心数据结构

```solidity
struct ReputationPayload {
  bytes32 agentPubkey;      // Solana Agent 公钥（32 字节）
  uint16  globalScore;      // 全局综合得分（0–10000）
  uint16[8] categoryScores; // 各 category 得分
  bytes32 sourceChain;      // 必须 == SOLANA_CHAIN_HASH
  uint64  timestamp;        // 声誉快照时间戳（Unix 秒）
}

struct ReputationSnapshot {
  uint16  globalScore;
  uint16[8] categoryScores;
  bytes32 sourceChain;
  uint64  timestamp;
  bytes32 signerPubkey;     // 签发时的 ed25519Signer（可追溯）
}
```

### 常量

| 常量 | 值 | 说明 |
|------|----|----|
| `MAX_FUTURE_SKEW` | 600 s | payload.timestamp 允许超前 block.timestamp 的最大值（防时钟偏移） |
| `SOLANA_CHAIN_HASH` | `0x6eef29e...` | 合法来源链标识，payload.sourceChain 必须匹配 |

### 状态变量

| 变量 | 说明 |
|------|------|
| `owner` | 合约管理员地址 |
| `ed25519Signer` | Solana 签名服务的 Ed25519 公钥（bytes32） |
| `maxAttestationAge` | 声誉证明最大有效期（秒）；0 = 不限制 |

### 公开函数

| 函数 | 权限 | 说明 |
|------|------|------|
| `verifyReputation(payload, r, s)` | 任何人（view） | 验证签名是否有效，不写链上状态 |
| `submitReputation(payload, r, s)` | 任何人（写） | 验证后持久化 snapshot，要求 `timestamp` 单调递增（`NON_MONOTONIC_TIMESTAMP`） |
| `getSnapshot(agentPubkey)` | 任何人（view） | 返回已存储的 ReputationSnapshot 和是否存在标志 |
| `transferOwnership(newOwner)` | onlyOwner | 转移 owner |
| `setEd25519Signer(signer)` | onlyOwner | 更换 Solana 签名服务公钥 |
| `setMaxAttestationAge(age)` | onlyOwner | 更新证明有效期 |

### 防重放机制

`submitReputation` 执行时：
- 若该 `agentPubkey` 已有 snapshot，要求新 `payload.timestamp > existing.timestamp`
- 违反则 revert `"NON_MONOTONIC_TIMESTAMP"`
- 同一时间戳的 payload 无法二次提交，即使签名不同

### payload 有效性校验（`_isPayloadValid`）

1. `sourceChain == SOLANA_CHAIN_HASH`
2. `timestamp != 0`
3. `timestamp <= block.timestamp + MAX_FUTURE_SKEW`（防未来伪造）
4. 若 `maxAttestationAge > 0`：`timestamp >= block.timestamp - maxAttestationAge`（防过期证明）

---

## 6. 部署信息

| 网络 | 合约 | 地址 |
|------|------|------|
| Base Sepolia | AgentLayerRaceTask | （见部署脚本输出） |
| Base Sepolia | ReputationVerifier | （见部署脚本输出） |

部署脚本：
```bash
cd apps/agent-layer-evm
npx hardhat run scripts/deploy-base-sepolia.js --network base-sepolia
npx hardhat run scripts/deploy-reputation-verifier.js --network base-sepolia
```

---

## 7. 与 Solana 版本的差异

| 特性 | Solana 版本 | EVM 版本 |
|------|------------|----------|
| 支付媒介 | SOL / Token-2022 | ETH only |
| Judge Pool | 链上随机抽选 | 由 poster 指定（简化） |
| 冷却期 | 链上时间戳 | 同上 |
| 声誉存储 | PDA 账户 | mapping(address => Reputation) |
| 跨链声誉 | — | Ed25519 proof 验证 |
| Token-2022 扩展过滤 | ✅ | 不需要 |
