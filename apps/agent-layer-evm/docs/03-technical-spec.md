# Phase 3: Technical Spec — EVM Core Protocol Deployment

> **模块**: `apps/agent-layer-evm/`  
> **范围**: `apps/agent-layer-evm/` — EVM Multi-Chain 部署（XLayer 首发）  
> **目标链**: 所有 EVM 兼容链（XLayer / Base / Arbitrum / Ethereum 等）
> **首发部署**: **XLayer** (Polygon CDK zkEVM / Validium, Chain ID 196 Mainnet / 195 Testnet)  
> **状态**: Draft
> **关联文档**: `01-prd.md`, `02-architecture.md`, `docs/multi-chain/02-architecture.md`

---

## 1. 概述

### 1.1 设计目标

本文档定义 Gradience Protocol 在 EVM 生态的完整链上技术规范。与现有 Solana 程序保持**语义对齐、接口等价、状态可验证**，同时利用 EVM 的成熟工具链（Solidity、Foundry、The Graph、viem）降低开发和集成成本。

### 1.2 核心原则

1. **Multi-Home Deployment**: 每条链独立 escrow、独立结算，不依赖跨链资产桥。
2. **声誉全局统一**: 通过 `ReputationVerifier` + `GradienceReputationFeed` + Oracle 网络，实现 Solana ↔ EVM 的声誉互认。
3. **元数据链下化**: Profile、Agent Config、Workflow 内容存 IPFS/Arweave，链上只存 URI 和关键状态。
4. **向后兼容**: `packages/sdk` 的抽象接口不变，新增 `EVMAdapter` 即可无缝切换。

### 1.3 部署范围

| 子系统 | EVM 合约 | 优先级 |
|--------|---------|--------|
| Agent Arena | `AgentArenaEVM.sol` | P0 |
| AgentM Core | `AgentMRegistry.sol`, `SocialGraph.sol` | P0 |
| Reputation Bridge | `ReputationVerifier.sol`, `GradienceReputationFeed.sol` | P0 |
| Chain Hub | `ChainHubRegistry.sol`, `DelegationManager.sol` | P1 |
| A2A Protocol | `A2AChannelRegistry.sol`, `SubtaskMarket.sol` | P1 |
| Workflow Marketplace | `WorkflowMarket.sol` | P2 |
| Judge Infrastructure | `JudgeRegistry.sol`, `JudgeVRFCoordinator.sol` | P0 |

---

## 2. 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 智能合约 | Solidity `^0.8.24` | 统一版本（除 `ReputationVerifier.sol` 因 Ed25519 库限制继续用 `^0.6.8`） |
| 开发框架 | Foundry (forge + cast) + soldeer/forge-std | 编译、测试、部署脚本 |
| 测试 | Anvil (local) / EVM testnet fork + mainnet fork | 集成测试使用 XLayer testnet fork |
| 索引 | The Graph (Subgraph) | 监听所有核心合约事件 |
| Oracle | Node.js / Rust + Redis | 声誉数据聚合与链上提交 |
| 密码学 | `noble-ed25519` (off-chain), `Ed25519.sol` (on-chain) | Solana 签名验证 |
| 前端 SDK | viem + wagmi | EVM 侧交易构建 |
| 随机数 | Chainlink VRF v2.5 | Judge 随机分配 |

---

## 3. 合约数据模型

### 3.1 AgentArenaEVM

#### 枚举

```solidity
enum TaskState { Open, Completed, Refunded, Cancelled }
enum ApplicationState { None, Applied, Submitted, Disputed }
```

#### 结构体

```solidity
struct Task {
address poster;
address judge;
uint8 category;           // 0-7, 与 Solana 对齐
uint64 deadline;          // 任务提交截止
uint64 judgeDeadline;     // 评判截止
uint256 minStake;         // 最低质押额
uint256 reward;           // 任务奖励（以 paymentToken 计价）
TaskState state;
string evalRef;           // IPFS/Arweave URI，最长 256 字节
address winner;
uint8 score;              // 0-100
address paymentToken;     // ETH = address(0)，否则 ERC20
}

struct Application {
ApplicationState state;
uint256 stake;
uint64 appliedAt;
}

struct Submission {
bool exists;
uint64 submittedAt;
string resultRef;         // IPFS URI
string traceRef;          // IPFS URI
}

struct CategoryStats {
uint256 applied;
uint256 completed;
uint256 won;
uint256 totalScore;       // 累加分，用于计算平均分
}

struct Reputation {
uint256 totalApplied;
uint256 completed;
uint256 totalEarned;
uint256 totalScore;       // 累加所有 completed task 的 score
uint256 winRateBps;       // 获胜率，基点
mapping(uint8 => CategoryStats) categoryStats;
}
```

#### 状态变量

```solidity
uint256 public taskCount;
address public immutable treasury;
address public immutable judgeRegistry;
address public immutable reputationFeed;
uint256 public constant MIN_SCORE = 60;
uint256 public constant BPS_DENOMINATOR = 10_000;
uint256 public constant WINNER_PAYOUT_BPS = 9_500;
uint256 public constant JUDGE_FEE_BPS = 300;
uint256 public constant PROTOCOL_FEE_BPS = 200;
uint256 public constant MAX_REF_LEN = 256;
uint256 public constant MAX_JUDGE_SELECTION_DELAY = 1 days;

mapping(uint256 => Task) public tasks;
mapping(uint256 => mapping(address => Application)) public applications;
mapping(uint256 => mapping(address => Submission)) private _submissions;
mapping(uint256 => address[]) private _taskApplicants;
mapping(address => Reputation) public reputations;
mapping(address => uint256) public protocolFees; // token maps to accumulated fees, address(0) = ETH
```

### 3.2 JudgeRegistry

```solidity
enum JudgeStatus { Inactive, Active, Unstaking }

struct Judge {
JudgeStatus status;
uint256 stakedAmount;
uint64 registeredAt;
uint64 unstakeRequestedAt;
uint8[] categories;
uint256 totalJudged;
uint256 totalEarned;
}

uint256 public constant MIN_JUDGE_STAKE = 0.05 ether; // 可配置
uint256 public constant UNSTAKE_COOLDOWN = 7 days;

mapping(address => Judge) public judges;
address[] public activeJudgeList; // 用于 VRF 选 Judge（维护成本高，可用链下索引替代）
address public immutable vrfCoordinator;
address public owner;
```

### 3.3 AgentMRegistry + SocialGraph

```solidity
struct UserProfile {
bool exists;
string username;        // 唯一，3-32 字符
string metadataURI;     // IPFS/Arweave
uint64 createdAt;
uint64 updatedAt;
}

struct AgentProfile {
bool exists;
address owner;
string metadataURI;
uint64 createdAt;
bool isActive;
}

mapping(address => UserProfile) public users;
mapping(string => address) public usernameToAddress;
mapping(uint256 => AgentProfile) public agents;
mapping(address => uint256[]) public userAgents;
uint256 public agentCount;

// SocialGraph
mapping(address => mapping(address => bool)) public following;
mapping(address => address[]) public followings;
mapping(address => address[]) public followers;
```

### 3.4 ReputationVerifier

保持现有设计，仅做兼容性注释：

```solidity
struct ReputationPayload {
bytes32 agentPubkey;      // Solana 公钥
uint16 globalScore;       // 0-10000
uint16[8] categoryScores;
bytes32 sourceChain;
uint64 timestamp;
}

struct ReputationSnapshot {
uint16 globalScore;
uint16[8] categoryScores;
bytes32 sourceChain;
uint64 timestamp;
bytes32 signerPubkey;
}
```

### 3.5 GradienceReputationFeed

```solidity
struct AggregatedReputation {
uint16 globalScore;
uint16[8] categoryScores;
uint64 lastUpdatedAt;
bytes32 merkleRoot;       // 可选，用于批量验证
bool exists;
}

address public owner;
address public oracle;        // 受信任的声誉 Oracle 地址
mapping(address => AggregatedReputation) public feed; // EVM 地址 => 聚合声誉
mapping(bytes32 => AggregatedReputation) public feedBySolanaPubkey; // Solana 公钥 => 聚合声誉

event ReputationUpdated(address indexed evmAddress, bytes32 solanaPubkey, uint16 globalScore, uint64 timestamp);
```

---

## 4. 合约接口规范

### 4.1 AgentArenaEVM

```solidity
// -------- Task Lifecycle --------
function postTask(
string calldata evalRef,
uint64 deadline,
uint64 judgeDeadline,
address judge,           // address(0) = 自动从 JudgeRegistry 分配
uint8 category,
uint256 minStake,
address paymentToken     // address(0) = ETH
) external payable returns (uint256 taskId);

function applyForTask(uint256 taskId) external payable;
function submitResult(uint256 taskId, string calldata resultRef, string calldata traceRef) external;
function judgeAndPay(uint256 taskId, address winner, uint8 score) external;
function cancelTask(uint256 taskId) external;
function claimExpired(uint256 taskId) external;   // 任何人可调用，过期后退款
function claimStake(uint256 taskId) external;     // task 结束后取回 stake

// -------- View Functions --------
function getTask(uint256 taskId) external view returns (Task memory);
function getApplicants(uint256 taskId) external view returns (address[] memory);
function getSubmission(uint256 taskId, address agent) external view returns (Submission memory);
function getReputation(address agent) external view returns (
uint256 totalApplied,
uint256 completed,
uint256 totalEarned,
uint256 avgScore,        // totalScore / completed
uint256 winRateBps,
CategoryStats[8] memory categories
);

// -------- Admin --------
function setTreasury(address newTreasury) external;
function setJudgeRegistry(address newRegistry) external;
function setReputationFeed(address newFeed) external;
function withdrawProtocolFees(address token) external; // 仅 treasury 可提取累积的 protocol fees
```

### 4.2 JudgeRegistry

```solidity
function registerJudge(uint8[] calldata categories) external payable;
function requestUnstake() external;
function completeUnstake() external;
function selectJudge(uint8 category, uint256 randomness) external view returns (address);
function recordJudgment(address judge, uint256 fee) external; // 仅 AgentArenaEVM 可调用
function setMinStake(uint256 minStake) external;
```

### 4.3 AgentMRegistry

```solidity
function registerUser(string calldata username, string calldata metadataURI) external;
function updateProfile(string calldata metadataURI) external;
function createAgent(string calldata metadataURI) external returns (uint256 agentId);
function updateAgent(uint256 agentId, string calldata metadataURI, bool isActive) external;

// View
function getUser(address user) external view returns (UserProfile memory);
function getAgent(uint256 agentId) external view returns (AgentProfile memory);
function getUserAgents(address user) external view returns (uint256[] memory);
function resolveUsername(string calldata username) external view returns (address);
```

### 4.4 SocialGraph

```solidity
function follow(address target) external;
function unfollow(address target) external;
function isFollowing(address from, address to) external view returns (bool);
function getFollowings(address user) external view returns (address[] memory);
function getFollowers(address user) external view returns (address[] memory);
```

### 4.5 ReputationVerifier

保持现有接口（`verifyReputation`, `submitReputation`, `getSnapshot`）。

### 4.6 GradienceReputationFeed

```solidity
function updateReputation(
address evmAddress,
bytes32 solanaPubkey,
uint16 globalScore,
uint16[8] calldata categoryScores,
uint64 timestamp,
bytes calldata oracleSignature
) external;

function getReputation(address evmAddress) external view returns (AggregatedReputation memory);
function getReputationBySolana(bytes32 solanaPubkey) external view returns (AggregatedReputation memory);
function setOracle(address newOracle) external;
```

---

## 5. 模块设计

### 5.1 AgentArenaEVM — 任务状态机

```
postTask
│
▼
[Open]
┌──────────┼──────────┐
▼          ▼          ▼
apply    submitResult  cancelTask
│          │          │
▼          ▼          ▼
[Applied]  [Submitted]  [Cancelled]
│          │          │
└────┬─────┘          │
▼                 │
judgeAndPay            │
│                 │
┌────┴────┐            │
▼         ▼            │
[Completed] [Refunded] ◄────┘
│         │
▼         ▼
资金分配    资金退回
```

#### 关键规则

1. **费用分配**（`judgeAndPay` 时执行）：
- `winnerPayout = reward * 9500 / 10000`
- `judgeFee = reward * 300 / 10000`
- `protocolFee = reward * 200 / 10000`
- **Protocol Fee 累积**：`protocolFee` 不实时转出，而是累加在 `protocolFees[paymentToken]` 中，由 `treasury` 通过 `withdrawProtocolFees` 按需提取。
- 所有未获奖 Agent 的 `stake` 原路退回。

2. **Cancel 规则**（`cancelTask` 时执行）：
- **0 申请者**：Poster 可免费取消，100% reward 退回（仅扣除累积的 protocol fee = 0，因未评判）。
- **有申请者但无提交者**：Poster 仍可取消，但需扣除 **5% reward** 平分给所有已申请者作为补偿，剩余 95% 退回。
- **有提交者后**：**禁止 cancel**。任务必须进入正常评判流程或等待 `claimExpired` / `forceRefund`。

3. **评判权限**：
- `msg.sender == task.judge`
- `score >= 60`（否则 revert `InvalidScore`）
- `winner` 必须在 applicants 列表中且已 submit

4. **时间检查**：
- `applyForTask`: `block.timestamp <= deadline`
- `submitResult`: `block.timestamp <= deadline`
- `judgeAndPay`: `block.timestamp <= judgeDeadline`
- `claimExpired`: `block.timestamp > judgeDeadline && task.state == Open`

5. **ERC20 支持**：
- `postTask` 和 `applyForTask` 都需要 `safeTransferFrom` 或 `safeTransfer`。
- ETH 使用 `msg.value`；ERC20 使用 `transferFrom`。
- 支持 `permit2`（长期优化）

### 5.2 JudgeRegistry — Judge 分配流程

```
postTask(judge = address(0))
│
▼
内部调用 _assignJudge(category)
│
▼
JudgeRegistry.selectJudge(category, block.prevrandao)
│
▼
按 category 过滤 active judges
│
▼
伪随机选择（Phase 1 简化，Phase 2 换 Chainlink VRF）
```

**Phase 1（MVP）**: 使用 `block.prevrandao` 做伪随机选择，由 `AgentArenaEVM` 调用。
**Phase 2**: 集成 Chainlink VRF v2.5，`postTask` 不立即分配 judge，而是发起 VRF 请求，回调后再设置 `task.judge`。

### 5.3 Reputation Bridge — 双轨验证

EVM 链上的声誉来源有两条路径：

1. **Solana 原生声誉** → `ReputationVerifier.sol`
- 由 Agent 自己或 Oracle 提交 `ReputationPayload` + Ed25519 签名
- 合约验证签名后存储 snapshot
- 用于防止女巫攻击，证明该 Agent 在 Solana 或 EVM 上有历史记录

2. **Gradience 聚合声誉** → `GradienceReputationFeed.sol`
- 仅由受信任的 Oracle 地址调用
- 包含跨链聚合后的 `globalScore` 和 `categoryScores[8]`
- `AgentArenaEVM` 在任务匹配、stake 折扣、Judge 选择权重时读取

**两条路径的关系**：
- `ReputationVerifier` 是**可自助提交**的 Solana 声誉证明库（未来扩展支持 EVM 本地声誉证明）。
- `GradienceReputationFeed` 是**官方 Oracle 维护**的权威声誉数据库。
- `AgentArenaEVM` 优先读取 `GradienceReputationFeed`；如果 feed 不存在， fallback 到 `ReputationVerifier` 的 snapshot。

### 5.4 AgentMRegistry + SocialGraph — 身份与社交

- **用户名唯一性**：`registerUser` 时检查 `usernameToAddress[username] == address(0)`，小写统一。
- **元数据不可为空**：`metadataURI` 必须是有效的 IPFS/Arweave URI（格式校验在链下，链上只检查非空和长度 < 256）。
- **社交图可遍历**：`follow` / `unfollow` 更新双向映射，事件供 Subgraph 索引。

---

## 6. 链下组件对接

### 6.1 EVM Subgraph

The Graph 子图监听以下事件：

**AgentArenaEVM**
- `TaskCreated(uint256 indexed taskId, address indexed poster, address indexed judge, ...)`
- `TaskApplied(uint256 indexed taskId, address indexed agent, uint256 stake)`
- `SubmissionReceived(uint256 indexed taskId, address indexed agent, string resultRef, string traceRef)`
- `TaskJudged(uint256 indexed taskId, address indexed winner, uint8 score, uint256 winnerPayout, uint256 judgeFee, uint256 protocolFee)`
- `TaskRefunded(uint256 indexed taskId, address indexed poster, uint256 reward)`
- `StakeRefunded(uint256 indexed taskId, address indexed agent, uint256 stake)`

**AgentMRegistry**
- `UserRegistered(address indexed user, string username, string metadataURI)`
- `AgentCreated(address indexed owner, uint256 indexed agentId, string metadataURI)`
- `ProfileUpdated(address indexed user, string metadataURI)`

**SocialGraph**
- `Followed(address indexed from, address indexed to)`
- `Unfollowed(address indexed from, address indexed to)`

**GradienceReputationFeed**
- `ReputationUpdated(address indexed evmAddress, bytes32 solanaPubkey, uint16 globalScore, uint64 timestamp)`

### 6.2 agent-daemon 适配

`agent-daemon` 新增 `EVMTaskBuilder` 模块：

```typescript
// apps/agent-daemon/src/solana/ 旁新增 src/evm/
class EVMTaskBuilder {
constructor(publicClient: PublicClient, walletClient: WalletClient) {}

async postTask(params: PostTaskParams): Promise<Hash> {
// 调用 AgentArenaEVM.postTask
}

async applyForTask(taskId: bigint, stake: bigint): Promise<Hash> {
// 调用 AgentArenaEVM.applyForTask
}

async submitResult(...): Promise<Hash> { ... }
async judgeAndPay(...): Promise<Hash> { ... }
}
```

- `publicClient` 和 `walletClient` 使用 `viem` 构建。
- 根据 `chainId`（`xlayer` | `base` | `arbitrum` | `ethereum`）读取对应的合约地址映射表。

### 6.3 packages/sdk 重构

```typescript
// packages/sdk/src/router/chain-router.ts
export interface ITaskClient {
postTask(params: PostTaskParams): Promise<TaskReceipt>;
applyForTask(taskId: TaskId): Promise<TransactionReceipt>;
submitResult(taskId: TaskId, resultRef: string, traceRef?: string): Promise<TransactionReceipt>;
judgeAndPay(taskId: TaskId, winner: string, score: number): Promise<TransactionReceipt>;
getTask(taskId: TaskId): Promise<Task>;
listTasks(filter?: TaskFilter): Promise<Task[]>;
}

export class EVMAdapter implements ChainAdapter {
constructor(private chainId: 'xlayer' | 'base' | 'arbitrum' | 'ethereum', private publicClient, private walletClient) {}
getTaskClient(): ITaskClient { return new EVMTaskClient(this.chainId, this.publicClient, this.walletClient); }
getUserClient(): IUserClient { return new EVMUserClient(...); }
getReputationClient(): IReputationClient { return new EVMReputationClient(...); }
}
```

### 6.4 批量操作（Multicall3）

> **决策**：不增加原生 `batchPostTask` / `batchJudgeAndPay` 合约函数，而是通过 **Multicall3**（`0xcA11bde05977b3631167028862bE2a173976CA11`）在 SDK 层实现批量操作。

**理由**：
- 无需增加合约字节码大小（避免接近 EIP-170 的 24KB 限制）
- 通用性强：任何外部函数都可以被批量调用
- 前端和 Keeper Bot 都可以复用同一套逻辑

**SDK 封装示例**：
```typescript
// packages/sdk/src/evm/multicall.ts
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

export async function batchPostTasks(
  walletClient: WalletClient,
  calls: { target: string; value: bigint; data: Hex }[]
): Promise<TransactionReceipt> {
  return walletClient.writeContract({
    address: MULTICALL3,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3Value',
    args: [calls.map(c => ({ target: c.target, callData: c.data, value: c.value, allowFailure: false }))],
    value: calls.reduce((sum, c) => sum + c.value, 0n),
  });
}
```

**适用场景**：
- Poster 一次性发布多个任务
- Judge 批量评判多个已完成的任务
- Keeper Bot 批量调用 `claimExpired`

### 6.5 Reputation Oracle

参考 `docs/multi-chain/03-reputation-oracle-spec.md`：

```
Solana RPC / EVM RPC
│
▼
Data Adapter (Rust/Node)
│
▼
Aggregation Engine
│
▼
Proof Generator (ECDSA sign with Oracle key)
│
▼
GradienceReputationFeed.updateReputation()  (XLayer / Base / Arbitrum / Ethereum)
```

Oracle 提交的数据包含：
- `evmAddress`: Agent 在 EVM 上的控制地址（需用户提前绑定）
- `solanaPubkey`: 对应的 Solana Agent 公钥
- `globalScore`, `categoryScores[8]`, `timestamp`
- `oracleSignature`: Oracle 私钥对 `(evmAddress, solanaPubkey, globalScore, categoryScores, timestamp)` 的 ECDSA 签名

---

## 7. 安全设计

### 7.1 重入防护
- `AgentArenaEVM` 的所有 payable 外部函数（`postTask`, `applyForTask`, `judgeAndPay`, `claimExpired`, `claimStake`）均使用 `nonReentrant`。
- 遵循 Checks-Effects-Interactions 模式。

### 7.2 权限控制

| 合约 | 权限角色 | 权限操作 |
|------|---------|---------|
| AgentArenaEVM | `owner` | `setTreasury`, `setJudgeRegistry`, `setReputationFeed` |
| JudgeRegistry | `owner` | `setMinStake`, `emergencySlash` |
| AgentMRegistry | `owner` | 暂停注册（可选） |
| GradienceReputationFeed | `owner` | `setOracle` |
| GradienceReputationFeed | `oracle` | `updateReputation` |
| ReputationVerifier | `owner` | `setEd25519Signer`, `setMaxAttestationAge` |

### 7.3 防女巫攻击
- `applyForTask` 时，若 Agent 没有 `GradienceReputationFeed` 记录，要求其质押更高额度的 stake（例如 2x）。
- `ReputationVerifier` 确保 Solana 声誉无法伪造（Ed25519 签名验证）。

### 7.4 随机数安全
- Phase 1 使用 `block.prevrandao` 做伪随机，仅用于非高价值任务的 Judge 分配。
- Phase 2 必须切换到 **Chainlink VRF v2.5**，用于高价值任务和竞赛场景。

### 7.5 整数溢出
- Solidity `^0.8.24` 内置溢出检查，无需额外 `SafeMath`。
- ERC20 转账使用 OpenZeppelin `SafeERC20`。

---

## 8. 部署与升级策略

### 8.1 代理模式

所有业务合约（`AgentArenaEVM`, `AgentMRegistry`, `SocialGraph`, `ChainHubRegistry`, `WorkflowMarket`）使用 **UUPS 代理模式**（OpenZeppelin `ERC1967Proxy`）：
- 便于后续升级和 Bug 修复
- 代理地址固定，Subgraph / SDK / Frontend 无需更新地址

**例外**：`ReputationVerifier.sol` 因 Solidity `^0.6.8` 版本限制，**不升级**，如有问题直接部署新版本并更新引用。

### 8.2 部署顺序

```
1. Deploy ReputationVerifier (immutable, no proxy)
2. Deploy GradienceReputationFeed (UUPS proxy)
3. Deploy JudgeRegistry (UUPS proxy)
4. Deploy AgentArenaEVM (UUPS proxy)
└─ 初始化时设置 treasury, judgeRegistry, reputationFeed
5. Deploy AgentMRegistry (UUPS proxy)
6. Deploy SocialGraph (UUPS proxy)
└─ 初始化时设置 agentMRegistry
7. (P1) Deploy ChainHubRegistry + DelegationManager
8. (P1) Deploy A2AChannelRegistry + SubtaskMarket
9. (P2) Deploy WorkflowMarket
10. Verify all contracts on OKX Explorer / Etherscan / Basescan / Arbiscan
```

### 8.3 多链地址表

SDK 需要维护一个链 ID 到合约地址的映射表：

```typescript
const CONTRACTS = {
xlayer: {
agentArena: '0x...',
agentMRegistry: '0x...',
socialGraph: '0x...',
reputationVerifier: '0x...',
reputationFeed: '0x...',
judgeRegistry: '0x...',
},


};
```

### 8.5 Oracle 服务层设计

> 目标：Oracle 不仅是 Gradience 内部组件，更要封装为**开放服务层**，供外部团队/协议/Agent 服务调用。

#### 8.5.1 核心服务

| 服务 | 输入 | 输出 | 目标链 |
|------|------|------|--------|
| **Reputation Oracle** | Solana Agent Pubkey + EVM Address | ECDSA 签名的声誉证明 | 所有已部署 EVM 链 |
| **Task Result Oracle** | Task ID + 链上提交内容 | LLM-as-Judge 评分结果 | 回写到来源链 |
| **Price Oracle** | Token 地址对 | 链下聚合价格 + 签名 | EVM 合约验证使用 |

#### 8.5.2 Reputation Oracle API（对外开放）

```typescript
// POST /api/v1/oracle/reputation
interface ReputationRequest {
evmAddress: string;      // 0x...
solanaPubkey?: string;   // base58
chainId: string;         // xlayer | base | arbitrum | ethereum
}

interface ReputationResponse {
evmAddress: string;
solanaPubkey: string;
globalScore: number;     // 0-65535
categoryScores: number[]; // length 8
timestamp: number;       // unix seconds
oracleSignature: string; // ECDSA (secp256k1) signature: 0x...
txHash?: string;         // 若已提交链上，返回对应交易哈希
}
```

- 外部团队拿到 `ReputationResponse` 后，可直接调用任意 EVM 链上的 `GradienceReputationFeed.updateReputation()`。
- Oracle 节点提供**可选的代提交服务**（`?submit=true`），由 Oracle 支付 gas 将数据写到链上。

#### 8.5.3 多链提交路由

```typescript
// Oracle 内部路由表
const CHAIN_SUBMITTERS = {
xlayer:     new ViemSubmitter(xlayerClient, xlayerWallet),
base:       new ViemSubmitter(baseClient, baseWallet),
arbitrum:   new ViemSubmitter(arbitrumClient, arbitrumWallet),
ethereum:   new ViemSubmitter(ethereumClient, ethereumWallet),
};

async function submitReputationToChain(
chainId: string,
payload: ReputationPayload,
oracleSignature: string
): Promise<string> {
const submitter = CHAIN_SUBMITTERS[chainId];
return await submitter.send('GradienceReputationFeed', 'updateReputation', [
payload.evmAddress,
payload.solanaPubkey,
payload.globalScore,
payload.categoryScores,
payload.timestamp,
oracleSignature,
]);
}
```

#### 8.5.4 鉴权与限流

- **API Key**: 外部团队调用 Reputation Oracle 需要注册 API Key，用于统计和限流。
- **链下聚合透明**：Oracle 定期公开其聚合的原始输入数据（Solana RPC 快照），供第三方审计。
- **未来去中心化**：Phase 2 将 Oracle 升级为 **EigenLayer AVS** 或 **Chainlink Functions**，降低单点信任。

#### 8.5.5 SDK 封装

```typescript
// packages/sdk/src/oracle-client.ts
export class GradienceOracleClient {
constructor(private apiKey: string, private endpoint: string) {}

async getReputationProof(
evmAddress: string,
chainId: string,
solanaPubkey?: string
): Promise<ReputationResponse> {
// 调用 Oracle 服务获取签名证明
}

async syncReputationToChain(
chainId: string,
response: ReputationResponse
): Promise<string> {
// 用户自己提交上链（需钱包签名 gas）
const feed = getReputationFeed(chainId);
return await feed.updateReputation(response);
}
}
```

外部开发者只需 3 行代码即可集成 Gradience 声誉系统：
```typescript
const oracle = new GradienceOracleClient(apiKey);
const proof = await oracle.getReputationProof(evmAddress, 'xlayer');
await oracle.syncReputationToChain('xlayer', proof);
```

---

## 9. 测试策略

### 9.1 单元测试（Foundry）

| 测试文件 | 覆盖范围 |
|---------|---------|
| `test/AgentArenaEVM.test.js` | 任务全生命周期、费用分配、错误码、ERC20 路径 |
| `test/JudgeRegistry.test.js` | Judge 注册/解押/分配、权限、冷却期 |
| `test/AgentMRegistry.test.js` | 用户注册、Agent 创建、用户名冲突 |
| `test/SocialGraph.test.js` | 关注/取关、重复操作、事件 |
| `test/ReputationVerifier.test.js` | Ed25519 签名验证、重放保护、过期检查 |
| `test/GradienceReputationFeed.test.js` | Oracle 签名验证、权限、更新逻辑 |

### 9.2 集成测试

1. **跨链声誉桥接端到端**
- 在 Solana devnet 上完成一个任务，生成声誉
- Oracle 聚合并签名
- 提交到 `GradienceReputationFeed`
- `AgentArenaEVM` 读取并用于降低 stake

2. **Subgraph 同步测试**
- 部署本地 Graph Node
- 执行完整任务生命周期
- 验证 Subgraph 查询结果与链上状态一致

3. **SDK 链抽象测试**
- 用 Unified SDK 在 XLayer / Base / Arbitrum fork 上发布任务
- 用 Unified SDK 在 XLayer / Base / Arbitrum fork 上注册用户
- 验证接口一致性和类型安全

### 9.3 安全审计清单

- [ ] Slither 静态分析
- [ ] Echidna 模糊测试（状态机）
- [ ] Reentrancy 路径手动 review
- [ ] Oracle 签名重放测试
- [ ] 权限边界测试

---

## 10. 风险与回退方案

| 风险 | 影响 | 回退方案 |
|------|------|---------|
| **Gas 成本过高** | 小额任务不经济 | 1. 强制小额任务走 XLayer<br>2. 引入 Batch Poster 机制（第三方代付 gas） |
| **Oracle 中心化** | 声誉数据被操纵 | 1. 公开 Oracle 运算逻辑和输入数据<br>2. 长期迁移到 EigenLayer AVS 或 Chainlink Functions |
| **Ed25519 链上验证 gas 过高** | `ReputationVerifier` 调用昂贵 | 1. 改为链下 ZK Proof（Risc0）验证<br>2. 批量提交 Merkle Proof 减少链上计算 |
| **VRF 延迟** | Judge 分配慢 | Phase 1 回退到 poster 指定 Judge 或伪随机 |
| **合约漏洞** | 资金损失 | 1. 所有业务合约使用 UUPS 代理<br>2. 设置 `emergencyPause`（可选）<br>3. 上线前完成第三方审计 |
| **用户迁移意愿低** | EVM 扩展受阻 | 通过声誉桥接和 SDK 链抽象降低跨链感知，Solana 与 EVM 无差别运营 |

---

## 11. 验收标准（Phase 3 → Phase 4 入口检查清单）

- [ ] 所有 P0 合约的接口规范和数据模型已冻结
- [ ] `AgentArenaEVM` 覆盖完整的任务生命周期 + Judge Registry 集成
- [ ] `AgentMRegistry` + `SocialGraph` 覆盖用户/Agent/关注关系
- [ ] `ReputationVerifier` + `GradienceReputationFeed` 的跨链桥接流程明确
- [ ] Subgraph schema 设计完成
- [ ] SDK 的 `EVMAdapter` 接口设计完成
- [ ] 部署脚本和代理升级路径明确
- [ ] 测试策略和安全审计清单已定义
- [ ] Phase 4 Task Breakdown 已具备足够输入

---

*文档状态: Phase 3 Technical Spec — Ready for Phase 4 Task Breakdown*
