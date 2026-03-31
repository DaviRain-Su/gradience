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
| Solidity `^0.8.24` | 合约语言 |
| OpenZeppelin `ReentrancyGuard` | 防重入保护 |
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
| `claim_stake(task_id)` | Agent 取回 stake（任务结束后） |
| `get_submission(task_id, agent)` view | 查询提交 |
| `get_applicants(task_id)` view | 查询申请列表 |
| `get_reputation(agent)` view | 查询声誉 |

### 错误码（custom errors）

27 个 custom error，覆盖所有非法状态转换（`ZeroAddress`、`TaskNotFound`、`NotTaskJudge`、`InvalidScore` 等）

---

## 5. ReputationVerifier 合约规范

用途：验证 Agent 在 Solana 上的声誉 proof，防止女巫攻击。

机制：
1. Solana 侧签名服务签发声誉证明（Ed25519 私钥签名）
2. EVM 侧 `ReputationVerifier.verify(agent, score, signature)` 验证签名
3. 验证通过 → 允许 agent 以较低 stake 参与任务

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
