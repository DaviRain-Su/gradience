# Phase 2: Architecture — Multi-Chain Core Deployment

> **任务**: GRA-175  
> **引用**: Phase 1 PRD 见 `01-prd.md`，项目级架构见 `ARCHITECTURE.md`

---

## 1. 架构设计决策

### 1.1 核心策略: Multi-Home + Unified SDK + Global Reputation Bridge

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **部署模式** | **Multi-Home**（全协议复制） | 任务 escrow 和结算必须本地化，跨链 escrow 会引入桥风险和高延迟 |
| **SDK 策略** | **Unified SDK（链抽象层）** | 否则前端和开发者需要为每条链写独立逻辑，不可扩展 |
| **声誉策略** | **全局统一 + Oracle 桥接** | Agent 的核心资产是声誉，必须在链间可验证、可携带 |
| **目标链优先级** | **Base > Arbitrum > Ethereum L1** | Base 生态活跃、成本低、机构友好；Arbitrum 技术成熟；L1 作为远期选项 |
| **Solana 定位** | **共存维护 → 逐步归档** | 现有用户和状态不强制迁移，新功能优先在 EVM 实现 |

### 1.2 什么该 Multi-Home，什么该统一

| 组件 | 策略 | 原因 |
|------|------|------|
| Agent Arena (任务核心) | **Multi-Home** | escrow、judge、结算必须同链完成 |
| AgentM Core (用户/社交) | **Multi-Home + IPFS 元数据** | 用户在哪活跃就在哪注册，profile 元数据链下化 |
| Chain Hub (Skill/Protocol) | **Multi-Home** | 需要与本地 DeFi/AA 生态组合 |
| A2A Protocol (通信) | **链下为主 + 链上通道状态 Multi-Home** | 消息内容不上链，支付通道状态本地化 |
| Workflow Marketplace | **Multi-Home** | NFT 化 workflow 可在各链独立发行 |
| **Reputation (声誉)** | **统一桥接** | 唯一应该跨链共享的核心数据层 |
| **Identity (DID)** | **统一** | 通过跨链 DID 或域名系统（ENS/SNS）统一 |

---

## 2. 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Layer 4: Frontend                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      agentm-web (Next.js)                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │    │
│  │  │ Task Market │  │  Profile    │  │  Messaging  │  │ Analytics │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │    │
│  │         └─────────────────┴─────────────────┴───────────────┘        │    │
│  │                        DynamicProvider (Wallet)                      │    │
│  │                   (Solana / EVM 双适配，用户无感知)                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Layer 3: Unified SDK                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    @gradiences/sdk (Unified API)                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │    │
│  │  │ TaskClient  │  │ UserClient  │  │ Reputation  │  │ Message   │  │    │
│  │  │  (ITask)    │  │  (IUser)    │  │  (IRep)     │  │ (IMessage)│  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │    │
│  │         └─────────────────┴─────────────────┴───────────────┘        │    │
│  │                         ChainRouter                                  │    │
│  │            (按 chainId 路由到 SolanaAdapter / EVMAdapter)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Layer 2: Daemon & Indexer                           │
│  ┌────────────────────────────┐    ┌────────────────────────────────────┐   │
│  │      agent-daemon          │    │         indexer-service            │   │
│  │  ┌────────────┬──────────┐ │    │  ┌────────────┐  ┌──────────────┐ │   │
│  │  │ Solana Tx  │ EVM Tx   │ │    │  │ Solana     │  │ EVM Subgraph │ │   │
│  │  │ Builder    │ Builder  │ │    │  │ Indexer    │  │ / Custom     │ │   │
│  │  │ (legacy)   │ (viem)   │ │    │  │ (Rust)     │  │ Indexer      │ │   │
│  │  └────────────┴──────────┘ │    │  └────────────┘  └──────────────┘ │   │
│  │  ┌────────────────────────┐ │    │  ┌──────────────────────────────┐ │   │
│  │  │   A2A Router           │ │    │  │   Reputation Oracle Bridge   │ │   │
│  │  │  (Nostr + XMTP)        │ │    │  │  (Solana ↔ EVM sync)        │ │   │
│  │  └────────────────────────┘ │    │  └──────────────────────────────┘ │   │
│  └────────────────────────────┘    └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   Solana Devnet     │   │    Base Mainnet     │   │  Arbitrum One       │
│   (Legacy Core)     │   │    (Primary EVM)    │   │  (Secondary EVM)    │
│  ┌───────────────┐  │   │  ┌───────────────┐  │   │  ┌───────────────┐  │
│  │ agent-arena   │  │   │  │AgentArenaEVM  │  │   │  │AgentArenaEVM  │  │
│  │ chain-hub     │  │   │  │AgentMCoreEVM  │  │   │  │AgentMCoreEVM  │  │
│  │ a2a-protocol  │  │   │  │ChainHubEVM    │  │   │  │ChainHubEVM    │  │
│  │ agentm-core   │  │   │  │A2AChannelEVM  │  │   │  │A2AChannelEVM  │  │
│  │ workflow-mkt  │  │   │  │WorkflowMktEVM │  │   │  │WorkflowMktEVM │  │
│  └───────────────┘  │   │  └───────────────┘  │   │  └───────────────┘  │
│  ┌───────────────┐  │   │  ┌───────────────┐  │   │  ┌───────────────┐  │
│  │ Reputation    │  │   │  │ Reputation    │  │   │  │ Reputation    │  │
│  │ PDA           │◄─┼───┼──┤VerifierEVM    │  │   │  │VerifierEVM    │  │
│  └───────────────┘  │   │  └───────────────┘  │   │  └───────────────┘  │
│                     │   │                     │   │                     │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
            │                         │                         │
            └─────────────────────────┴─────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cross-Chain Reputation Layer                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Reputation Oracle Network (渐进去中心化)                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ Relay Server │  │ Chainlink    │  │ EigenLayer   │               │    │
│  │  │ (Phase 1)    │──│ Functions    │──│ AVS          │               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  │                                                                     │    │
│  │  Flow: Solana PDA → Ed25519/ZK Proof → EVM ReputationVerifier      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layer 3: Unified SDK 设计

### 3.1 设计原则

- **业务接口与链解耦**: `postTask()` 在任何链上语义一致
- **链选择可配置**: 支持自动路由（按用户钱包链）和手动指定
- **类型安全**: TypeScript 泛型保证不同链的返回类型一致
- **向后兼容**: 现有 Solana-only 调用方式不被破坏

### 3.2 核心接口规范

```typescript
// ========== 业务抽象接口 ==========

interface ITaskClient {
  postTask(params: PostTaskParams): Promise<TaskReceipt>;
  applyForTask(taskId: TaskId): Promise<TransactionReceipt>;
  submitResult(taskId: TaskId, resultRef: string, traceRef?: string): Promise<TransactionReceipt>;
  judgeAndPay(taskId: TaskId, winner: string, score: number): Promise<TransactionReceipt>;
  getTask(taskId: TaskId): Promise<Task>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;
}

interface IUserClient {
  registerUser(params: RegisterUserParams): Promise<TransactionReceipt>;
  getProfile(address: string): Promise<Profile>;
  updateProfile(params: UpdateProfileParams): Promise<TransactionReceipt>;
  follow(target: string): Promise<TransactionReceipt>;
  unfollow(target: string): Promise<TransactionReceipt>;
  createAgent(params: CreateAgentParams): Promise<TransactionReceipt>;
}

interface IReputationClient {
  getReputation(address: string): Promise<Reputation>;
  getCrossChainReputation(address: string): Promise<CrossChainReputation>;
  submitReputationProof(proof: ReputationProof): Promise<TransactionReceipt>;
}

interface IMessageClient {
  sendMessage(params: SendMessageParams): Promise<MessageReceipt>;
  getThreads(): Promise<Thread[]>;
  getMessages(threadId: string): Promise<Message[]>;
}

// ========== Chain Router ==========

type ChainId = 'solana-devnet' | 'solana-mainnet' | 'base' | 'arbitrum' | 'ethereum';

interface ChainRouter {
  getTaskClient(chainId: ChainId): ITaskClient;
  getUserClient(chainId: ChainId): IUserClient;
  getReputationClient(chainId: ChainId): IReputationClient;
  getMessageClient(chainId: ChainId): IMessageClient;
}
```

### 3.3 Adapter 层

```
sdk/
├── clients/
│   ├── abstract/
│   │   ├── task-client.ts
│   │   ├── user-client.ts
│   │   └── reputation-client.ts
│   ├── solana/
│   │   ├── solana-task-client.ts
│   │   ├── solana-user-client.ts
│   │   └── solana-reputation-client.ts
│   └── evm/
│       ├── evm-task-client.ts
│       ├── evm-user-client.ts
│       └── evm-reputation-client.ts
├── router/
│   └── chain-router.ts
└── types/
    └── unified.ts
```

### 3.4 路由策略

| 策略 | 说明 | 示例 |
|------|------|------|
| **Wallet-Driven** | 根据用户当前连接的钱包自动选择链 | Phantom → Solana, MetaMask → Base |
| **Explicit** | 调用方显式指定 chainId | `sdk.task('base').postTask(...)` |
| **Task-Affinity** | 根据任务所在链自动路由 | `judgeAndPay` 必须在任务发布链执行 |
| **Reputation-Aggregation** | 声誉查询默认聚合所有链 | `getCrossChainReputation` |

---

## 4. Layer 1: 链上组件映射

### 4.1 当前 Solana 程序 → EVM 合约映射

| Solana Program | EVM Contract | 状态 |
|----------------|--------------|------|
| `agent-arena` | `AgentArenaEVM.sol` | 🟠 部分实现（`AgentLayerRaceTask.sol` 为基础，需扩展 Judge Pool、ERC20 完整支持） |
| `agentm-core` | `AgentMRegistry.sol` + `SocialGraph.sol` + `ReputationEngine.sol` | 🔴 未实现 |
| `chain-hub` | `ChainHubRegistry.sol` + `DelegationManager.sol` | 🔴 未实现 |
| `a2a-protocol` | `A2ARegistry.sol` + `PaymentChannel.sol` + `SubtaskMarket.sol` | 🔴 未实现 |
| `workflow-marketplace` | `WorkflowMarket.sol` | 🔴 未实现 |
| N/A | `ReputationVerifier.sol` | 🟢 已实现（跨链声誉验证） |

### 4.2 AgentArenaEVM 需要新增的能力

在现有 `AgentLayerRaceTask.sol` 基础上，需要补充：

1. **Judge Registry & Staking**
   - `registerJudge(uint8[] categories)` payable
   - `unstakeJudge()` with cooldown
   - `selectJudge(uint8 category) → address` (Chainlink VRF 或伪随机)

2. **完整 Reputation 统计**
   - 按 category 的 `CategoryStats`
   - 与 `ReputationVerifier` 集成读取跨链声誉

3. **ERC20 完整支持**
   - 现有 `post_task_erc20` 可用，但需增加 Permit/Permit2 支持以优化 UX

4. **事件对齐**
   - 事件名称和字段需与 Solana indexer 的消费逻辑对齐

---

## 5. 跨链声誉桥接方案

### 5.1 架构

```
Solana Agent Arena
       │
       ▼ ① 链下 Oracle 读取 Reputation PDA
┌──────────────────────┐
│  Reputation Oracle   │  → ② 对 reputation 数据做 Ed25519 签名
│  (Node.js / Rust)    │
└──────────────────────┘
       │
       ▼ ③ 用户或 Relayer 提交 proof 到 EVM
┌──────────────────────┐
│ ReputationVerifier   │  → 验证签名并存储 snapshot
│    (EVM 合约)        │
└──────────────────────┘
       │
       ▼ ④ EVM 上的 AgentArena / AgentMCore 读取已验证声誉
  各 EVM 业务合约
```

### 5.2 渐进去中心化路线

| 阶段 | Oracle 实现 | 信任假设 | 时间线 |
|------|-------------|----------|--------|
| Phase 1 | 官方 Relay Server (Ed25519 签名) | 信任官方签名服务 | 立即 |
| Phase 2 | Chainlink Functions (去中心化 Oracle) | 信任 Chainlink 网络 | 3-6 个月 |
| Phase 3 | EigenLayer AVS (再质押验证网络) | 经济安全保证 | 6-12 个月 |
| Phase 4 | ZK Proof (Solana 状态 inclusion proof) | 密码学安全 | 长期 |

### 5.3 数据格式

```solidity
struct ReputationPayload {
    bytes32 agentPubkey;      // Solana 公钥（或 EVM 地址映射）
    uint16  globalScore;      // 0-10000
    uint16[8] categoryScores; // 各 category 得分
    bytes32 sourceChain;      // 来源链标识
    uint64  timestamp;        // 快照时间戳
}
```

**EVM 地址映射问题**: EVM 用户没有 Ed25519 公钥。建议：
- 在 `AgentMRegistry` 中允许用户绑定 `solanaPubkey ↔ evmAddress`
- 或在 Reputation 系统中为 EVM 地址单独维护一套统计

---

## 6. Reputation Oracle 基础设施

> 核心命题：Gradience 不应只在协议内部维护信誉，而应将经过验证的信誉数据作为 **公共基础设施服务** 输出到整个行业。

### 6.1 定位升级：从"协议内建"到"公共基础设施"

当前绝大多数 Web3 协议的信誉系统是**自闭环的**：自己产生数据、自己存储、自己消费。这导致每个协议都重复建设一套信任评估机制，且数据不可互操作。

Gradience 的升级方向是成为 **Agent 经济的信誉基础设施层**（Reputation Infrastructure Layer），类似于 Chainlink 在数据预言机领域的角色。

| 维度 | 传统模式 | 基础设施模式 |
|------|----------|--------------|
| 数据所有权 | 协议私有的 PDA / mapping | 公共可验证的标准化输出 |
| 消费方 | 仅 Gradience 内部 | 任何 dApp、协议、AI Agent |
| 查询接口 | 自定义 GraphQL / RPC | 标准化预言机接口（ERC-8004 + 自有 Oracle API） |
| 商业模式 | 内建功能 | 可对外提供收费/免费的信誉查询服务 |
| 网络效应 | 弱（数据孤岛） | 强（越多协议接入，数据越丰富） |

### 6.2 三层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 3: 消费层 (Consumers)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  Lending   │  │  Insurance │  │  DAO Voting│  │  Hiring    │   │
│  │  Protocol  │  │  Protocol  │  │  Protocol  │  │  Platform  │   │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘   │
│         │               │               │               │         │
│         └───────────────┴───────┬───────┴───────────────┘         │
│                                 ▼                                 │
│              ┌────────────────────────────────────┐               │
│              │   ERC-8004 Registry (Global Anchor)│               │
│              │   + Gradience Reputation Oracle API│               │
│              └────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 2: 预言机网络 (Oracle Network)             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Gradience Reputation Oracle                   │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │    │
│  │  │ Aggregation │→ │  Proof Gen  │→ │  Submit to      │     │    │
│  │  │   Engine    │  │  (Merkle/   │  │  ERC-8004 /     │     │    │
│  │  │             │  │  Signature) │  │  On-Chain Feeds │     │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘     │    │
│  │                                                             │    │
│  │  Functions:                                                 │    │
│  │  • 读取多链声誉状态 (Solana PDA, EVM contracts)             │    │
│  │  • 按标准算法计算统一分数                                   │    │
│  │  • 生成密码学证明                                           │    │
│  │  • 提交到 ERC-8004 Registry                                 │    │
│  │  • 维护 On-Chain Price Feed 式声誉数据流                    │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 1: 数据源层 (Data Sources)                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │ Solana       │    │ Base         │    │ Arbitrum     │         │
│  │ Agent Arena  │    │ Agent Arena  │    │ Agent Arena  │         │
│  │ (PDA Stats)  │    │ (Contract)   │    │ (Contract)   │         │
│  └──────────────┘    └──────────────┘    └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 标准化输出格式：ERC-8004 作为统一接口

ERC-8004 已经被设计为 Agent 信誉的**全球统一表述格式**。Gradience 作为其主要数据源，所有对外输出必须经过这一层。

**数据映射（已部分实现于 `erc8004-client.ts`）：**

```typescript
// Gradience 内部多链信誉聚合后，统一映射为 ERC-8004 feedback
interface GradienceToERC8004Mapping {
  identity: {
    agentURI: string;           // e.g., "https://gradience.io/agents/{address}"
    metadata: {
      name: string;
      description: string;
      capabilities: string;     // JSON string of skills
      gradienceEndpoint: string;
      sourceChains: string;     // ["solana", "base", "arbitrum"]
    };
  };
  
  reputation: {
    // Global score
    agentId: string;
    value: number;              // overall score (0-100 or normalized)
    valueDecimals: number;      // e.g., 2
    tags: [string, string];     // ["gradience-v1", "global"]
    
    // Per-category scores (multiple giveFeedback calls)
    // tag1="gradience-v1", tag2="smart-contract-audit"
    // tag1="gradience-v1", tag2="defi-strategy"
    
    endpoint: string;           // Oracle API endpoint
    feedbackURI: string;        // IPFS CID of detailed attestation
    feedbackHash: string;       // Merkle root of source data
  };
}
```

**关键原则**：
1. **单一 truth source**：ERC-8004 上的 Gradience feedback 必须是经过 Oracle 签名的权威数据。
2. **可验证性**：每个 feedback 附带 `feedbackHash`，可以追溯到多链原始数据。
3. **时效性**：Oracle 按固定周期（如每 1 小时或每 100 个任务）刷新全局声誉快照。

### 6.4 对外服务模式：像 Chainlink 一样提供"信誉服务"

Gradience Reputation Oracle 可以对外提供两种服务模式：

#### 模式 A: 链上预言机 feed（On-Chain Oracle Feeds）

类似于 Chainlink Data Feeds，Oracle 网络定期将聚合后的信誉数据写入链上合约，供其他协议在智能合约中直接读取。

```solidity
// 外部协议可以直接调用
interface IGradienceReputationFeed {
    function getAgentScore(address agent) external view returns (uint16 score, uint64 updatedAt);
    function getAgentCategoryScore(address agent, bytes32 category) external view returns (uint16 score);
}
```

**适用场景**：
- Lending Protocol 根据 Agent 信誉动态调整抵押率
- Insurance Protocol 根据信誉决定是否承保
- DAO 根据信誉分配投票权重

#### 模式 B: 链下 API 服务（Off-Chain Reputation API）

通过 REST API / GraphQL 提供实时声誉查询，供前端、AI Agent、搜索引擎消费。

```http
GET /api/v1/oracle/reputation/{agentAddress}

Response:
{
  "agentAddress": "0x...",
  "reputation": {
    "overallScore": 87.5,
    "tier": "platinum",
    "confidence": 0.94,
    "calculatedAt": "2026-04-06T12:00:00Z"
  },
  "components": {
    "taskScore": 92,
    "qualityScore": 85,
    "consistencyScore": 88,
    "stakingScore": 76
  },
  "erc8004": {
    "agentId": "12345",
    "feedbackCount": 47,
    "registryUrl": "https://8004scan.io/agents/12345"
  },
  "sources": [
    { "chain": "solana", "score": 89, "tasks": 120 },
    { "chain": "base", "score": 86, "tasks": 45 }
  ],
  "proof": "0xabc123..."  // 验证证明
}
```

**适用场景**：
- 招聘平台查询 Agent 能力背景
- AI Agent 在协作前评估对方可信度
- 搜索引擎展示 Agent 信誉徽章

### 6.5 经济模型（初步构想）

为了让 Reputation Oracle 网络具备可持续性，需要设计经济激励：

| 参与者 | 角色 | 激励来源 |
|--------|------|----------|
| **Data Aggregator** | 运行 Aggregation Engine，读取多链数据 | 协议国库补贴 + 查询费用分成 |
| **Proof Submitter** | 将数据提交到 ERC-8004 / 链上 feed | gas 补贴 + 任务奖励 |
| **Verifier** | 验证 Oracle 提交数据的真实性 | 惩罚作恶者，奖励诚实者（EigenLayer 模式） |
| **Consumer** | 调用 API 或链上 feed | 按查询付费（高级 API）或免费（基础 feed） |

**收费模式参考 Chainlink**：
- 链上 feed 读取：由 feed 合约的 sponsor 支付（项目方质押代币）
- 高级 API 查询：API Key + 按调用量计费
- 批量数据导出：定制企业级服务

### 6.6 信任假设与去中心化路线图

| 阶段 | Oracle 形式 | 信任假设 | 里程碑 |
|------|-------------|----------|--------|
| **Phase 1** | 官方托管 Oracle | 信任 Gradience 团队 | 立即可用，建立早期生态 |
| **Phase 2** | 许可节点联盟 | 信任白名单节点集合 | 引入 Chainlink Functions |
| **Phase 3** | 无许可节点网络 | 经济安全（质押代币） | EigenLayer AVS 或自建质押 |
| **Phase 4** | ZK 证明 | 纯密码学安全 | Solana/EVM 状态 inclusion ZK proof |

---

## 7. Indexer 策略

### 7.1 EVM 索引方案

| 方案 | 推荐度 | 用途 |
|------|--------|------|
| **The Graph (Subgraph)** | ⭐⭐⭐ 首选 | 标准事件索引，GraphQL 查询，社区成熟 |
| **Alchemy Custom Webhooks** | ⭐⭐ 辅助 | 实时推送特定事件到 webhook |
| **自建 EVM Indexer (ethers-rs)** | ⭐⭐ 备选 | 若团队想统一 Rust 技术栈 |

### 7.2 推荐架构

```
Frontend / SDK
      │
      ▼
┌─────────────────┐
│  Unified API    │  ← 聚合 Solana Indexer + EVM Subgraph 的数据
│  Gateway        │
└─────────────────┘
      │
   ┌──┴──┐
   ▼     ▼
Solana    EVM
Indexer   Subgraph
(Rust)    (The Graph)
```

**关键要求**: Unified API Gateway 必须对前端暴露一致的 Schema，无论底层是 Solana Indexer 还是 EVM Subgraph。

---

## 8. 目标链部署优先级

| 优先级 | 链 | 理由 | 预计时间 |
|--------|-----|------|----------|
| P0 | **Base** | Coinbase 生态、低成本、机构友好、与 Solana 用户重叠度高 | Q2 2026 |
| P1 | **Arbitrum** | 技术最成熟的 L2、DeFi 生态丰富、AA 支持好 | Q3 2026 |
| P2 | **Optimism** | Superchain 愿景、与 Base 同栈 | Q4 2026 |
| P3 | **Ethereum L1** | 最高安全性、但成本过高，仅高价值任务 | 2027 |

---

## 9. 安全与风险

### 9.1 多链特有的风险

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| **流动性碎片化** | 同一代币在不同链上 escrow，流动性分散 | 每条链独立计价，不接受跨链 escrow |
| **声誉双花** | 同一 agent 在多条链上重复提交声誉 proof | `timestamp` 单调递增 + `agentPubkey` 全局锁定 |
| **Oracle 中心化** | 官方 Relay 作恶可伪造声誉 | 渐进迁移到 Chainlink → EigenLayer → ZK |
| **合约差异** | Solana 和 EVM 的行为不完全一致 | 核心状态机严格对齐，差异在 SDK 层兼容 |
| **桥接风险** | 任务 escrow 永远不走跨链桥 | 明确禁止跨链 escrow，每条链自给自足 |

### 9.2 升级策略

- **EVM 合约**: 使用 OpenZeppelin Transparent Proxy / UUPS，保留升级能力
- **Solana Program**: 继续用现有 upgrade authority 机制
- **SDK**: Semantic Versioning，多链支持作为 minor version 增量发布

---

## 10. 与现有组件的集成关系

| 现有组件 | 改动点 |
|----------|--------|
| `agentm-web` | 增加 EVM chain selector；Wallet 适配 MetaMask/Rainbow/Rabby |
| `agent-daemon` | 增加 `EVMTxBuilder`；A2A Router 保持链下不变 |
| `@gradiences/sdk` | 重构为 Unified SDK，Solana 客户端保留兼容 |
| `indexer-service` | 增加 EVM Subgraph 查询代理或自建 EVM indexer |
| `packages/cli` | 增加 `--chain` 参数，支持 EVM 合约调用 |

---

## 11. 交付物清单（Phase 3 输入）

1. `03-technical-spec.md` — 各 EVM 合约的详细技术规范
2. `04-task-breakdown.md` — 多链迁移的 WBS 和任务拆分
3. `05-test-spec.md` — 跨链一致性测试、SDK 兼容性测试
4. `06-implementation.md` — Base 首发合约的实现日志
5. `sdk-interface-spec.ts` — Unified SDK 的 TypeScript 接口定义文档
6. `deployment-playbook.md` — 各链部署操作手册

---

*文档版本: v1.0*  
*关联任务: GRA-175*  
*维护方: Gradience Protocol Team*
