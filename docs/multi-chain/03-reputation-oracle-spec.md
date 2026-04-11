# Reputation Oracle 技术规范

> **文档状态**: 草案 (Draft)  
> **创建日期**: 2026-04-06  
> **关联文档**: `02-architecture.md` 多链架构设计  
> **关联标准**: ERC-8004 (EVM), Solana Agent Registry (SVM)

---

## 1. 设计目标

本文档定义 Gradience Reputation Oracle 的技术规范，目标是：

1. **统一信誉标准**: 将多链（Solana、Base、Arbitrum 等）的 Agent 信誉数据聚合为单一、标准化的输出。
2. **基础设施化**: 对外提供可信赖的"信誉服务"，供第三方协议在链上和链下消费。
3. **渐进去中心化**: 从官方托管 Oracle 逐步演进为去中心化预言机网络。

---

## 2. 系统架构

### 2.1 核心组件

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Gradience Reputation Oracle                      │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐        │
│  │ Data Adapter │   │ Aggregation  │   │ Proof Generator  │        │
│  │   Layer      │ → │    Engine    │ → │                  │        │
│  │              │   │              │   │                  │        │
│  │ • Solana RPC │   │ • Score      │   │ • Merkle Root    │        │
│  │ • EVM RPC    │   │   Calculation│   │ • Ed25519/ECDSA  │        │
│  │ • Subgraph   │   │ • Category   │   │   Signature      │        │
│  │ • Indexer    │   │   Mapping    │   │ • ZK Proof (长期) │        │
│  └──────────────┘   └──────────────┘   └──────────────────┘        │
│           │                 │                    │                 │
│           ▼                 ▼                    ▼                 │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │                    Submission Layer                       │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │     │
│  │  │ ERC-8004     │  │ On-Chain     │  │ Off-Chain      │ │     │
│  │  │ Registry     │  │ Feed         │  │ API Cache      │ │     │
│  │  │ (EVM)        │  │ Contracts    │  │ (Redis/DB)     │ │     │
│  │  └──────────────┘  └──────────────┘  └────────────────┘ │     │
│  └──────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件                     | 职责                           | 技术栈                                           |
| ------------------------ | ------------------------------ | ------------------------------------------------ |
| **Data Adapter**         | 从各链读取原始 reputation 数据 | `@solana/web3.js`, `ethers.js`, Subgraph queries |
| **Aggregation Engine**   | 计算统一分数、处理冲突、去重   | Node.js / Rust                                   |
| **Proof Generator**      | 生成可验证的密码学证明         | `noble-ed25519`, `ethers.utils`, 未来 `risc0`    |
| **ERC-8004 Submitter**   | 将数据提交到 ERC-8004 合约     | `ethers.js` + 托管私钥                           |
| **On-Chain Feed Writer** | 更新链上声誉 feed 合约         | EVM transaction builder                          |
| **API Gateway**          | 对外暴露 REST/GraphQL 查询     | Fastify / Apollo                                 |

---

## 3. 数据流

### 3.1 声誉更新触发条件

Oracle 在以下任一条件满足时触发更新：

1. **时间触发**: 每 1 小时执行一次全局快照更新
2. **事件触发**: 任一链上累计新增 100 条声誉相关事件
3. **手动触发**: 通过 Admin API 或治理提案强制刷新
4. **消费者请求**: 付费 API 调用触发的实时计算（缓存优先）

### 3.2 完整流程

```
Step 1: Data Collection
├── 读取 Solana PDA (agent-arena reputation stats) — 核心协议唯一来源
├── 读取 Base EVM Registry (ERC-8004 接收的声誉证明)
├── 读取 Arbitrum EVM Registry (ERC-8004 接收的声誉证明)
└── 读取 Subgraph / Indexer 中的历史事件

Step 2: Normalization
├── 统一地址格式 (Solana Pubkey ↔ EVM Address 映射)
├── 统一时间戳 (全部转为 Unix ms UTC)
├── 统一 category 编码 (8 大技能类别)
└── 去重：同一任务在不同数据源中只计一次

Step 3: Aggregation
├── 按 agent 聚合所有链数据
├── 计算 globalScore (0-10000)
├── 计算 categoryScores[8] (0-10000 each)
├── 计算 confidence (0-1, 基于数据点数量)
└── 计算 recency (0-1, 基于最近活动时间)

Step 4: Proof Generation
├── 构建 Merkle Tree (叶节点 = 各链原始数据哈希)
├── 对 Merkle Root 进行 Oracle 私钥签名
└── 生成完整的 Attestation JSON

Step 5: Distribution
├── 提交到 ERC-8004 Reputation Registry (giveFeedback)
├── 更新 GradienceReputationFeed 合约 (多链部署)
├── 写入 API Cache (Redis)
└── 写入冷存储 (PostgreSQL / ClickHouse)
```

---

## 4. 信誉计算算法

### 4.1 输入数据

```typescript
interface ChainReputationData {
    chainId: string; // "solana", "base", "arbitrum"
    agentAddress: string; // 链原生地址格式
    totalApplied: number;
    completed: number;
    won: number;
    avgScoreBps: number; // 0-10000
    totalEarned: bigint;
    totalStaked: bigint;
    categoryStats: CategoryStat[];
    lastActivityAt: number;
}

interface CategoryStat {
    categoryId: number; // 0-7
    applied: number;
    completed: number;
    won: number;
    avgScoreBps: number; // 0-10000
}
```

### 4.2 聚合公式

#### Global Score (0-10000)

```
globalScore = (
    taskScore * 0.30 +
    qualityScore * 0.30 +
    consistencyScore * 0.25 +
    stakingScore * 0.15
) * 100

Where:
- taskScore    = min(1, completed / 100) * 100              // 任务数量分
- qualityScore = avg(avgScoreBps across all chains) / 100   // 平均质量分 (0-100)
- consistencyScore = weightedScoreByRecency()               // 时间加权稳定性
- stakingScore = normalize(totalStaked, networkMedian)      // 质押参与度
```

#### Category Score (0-10000)

```
categoryScore[cat] = (
    completionRate * 0.40 +
    qualityInCategory * 0.40 +
    volumeInCategory * 0.20
) * 100

Where:
- completionRate  = completed[cat] / applied[cat]
- qualityInCategory = avgScoreBps[cat] / 100
- volumeInCategory = min(1, completed[cat] / 20) * 100
```

#### Confidence (0-1)

```
confidence = min(1, totalDataPoints / 50) * recencyBoost

Where:
- totalDataPoints = sum(completed across all chains)
- recencyBoost = 1 if lastActivityWithin(30d), else 0.8
```

### 4.3 跨链冲突处理

如果同一 Agent 在不同链上的数据冲突：

1. **时间优先**: 采用最新时间戳的数据
2. **数量加权**: 多条链数据按完成任务数量加权平均
3. **来源可信度**: Solana 主网和 Ethereum L1 的数据权重略高于测试网/侧链

---

## 5. ERC-8004 提交规范

### 5.1 提交内容

每个 Agent 每次更新时，Oracle 需要向 ERC-8004 Reputation Registry 提交两类 feedback：

**A. Global Feedback**

```typescript
{
    agentId: string; // 从 Identity Registry 查询
    value: number; // globalScore (e.g., 8750 for 87.50)
    valueDecimals: 2;
    tags: ['gradience-v1', 'global'];
    endpoint: 'https://oracle.gradience.io/v1';
    feedbackURI: 'ipfs://QmXyz...'; // 指向完整 attestation JSON
    feedbackHash: '0xabc123...'; // Merkle Root
}
```

**B. Per-Category Feedback** (8 次独立提交)

```typescript
{
    agentId: string;
    value: number; // categoryScore[i]
    valueDecimals: 2;
    tags: ['gradience-v1', CATEGORY_NAMES[i]];
    endpoint: 'https://oracle.gradience.io/v1';
    feedbackURI: 'ipfs://QmXyz.../category/{i}';
    feedbackHash: '0xabc123...';
}
```

### 5.2 Attestation JSON Schema

```json
{
    "version": "gradience-reputation-v1",
    "agentId": "12345",
    "agentAddress": {
        "solana": "8oR...",
        "evm": "0xabc..."
    },
    "calculatedAt": 1712390400000,
    "globalScore": 8750,
    "confidence": 0.94,
    "categoryScores": [9200, 8500, 0, 0, 8800, 0, 0, 7600],
    "sourceData": [
        {
            "chain": "solana",
            "completed": 120,
            "avgScoreBps": 8900,
            "lastActivityAt": 1712380000000,
            "proof": "solana-tx-signature-or-pda-proof"
        },
        {
            "chain": "base",
            "completed": 45,
            "avgScoreBps": 8600,
            "lastActivityAt": 1712390000000,
            "proof": "evm-block-number-and-log-index"
        }
    ],
    "merkleRoot": "0xabc123...",
    "oracleSignature": {
        "r": "0x...",
        "s": "0x...",
        "v": 27
    }
}
```

### 5.3 Gas 优化策略

由于每次更新可能需要提交 9 个 `giveFeedback` 调用（1 global + 8 categories），gas 成本较高。建议：

1. **批量提交**: 使用自定义 Multicall 合约或 ERC-8004 的批量接口（若支持）
2. **差异化更新**: 只更新分数变化超过阈值（如 ±2%）的 category
3. **L2 优先**: 优先在 Base/Arbitrum 上提交 ERC-8004 feedback，通过跨链消息同步到 L1
4. **分层刷新**: 高频更新 global score，低频更新 category scores

---

## 6. On-Chain Feed 合约

### 6.1 接口定义

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGradienceReputationFeed {
    struct ReputationData {
        uint16 globalScore;      // 0-10000
        uint16[8] categoryScores;
        uint64 updatedAt;        // Unix timestamp
        uint8 confidence;        // 0-100 (百分比)
        bytes32 merkleRoot;
    }

    event ReputationUpdated(
        bytes32 indexed agentId,
        uint16 globalScore,
        uint64 updatedAt
    );

    // 由 Oracle 网络调用
    function updateReputation(
        bytes32 agentId,
        ReputationData calldata data,
        bytes calldata oracleSignature
    ) external;

    // 任何人可调用，验证数据
    function verify(
        bytes32 agentId,
        ReputationData calldata data,
        bytes calldata oracleSignature
    ) external view returns (bool);

    // 查询接口
    function getReputation(bytes32 agentId) external view returns (ReputationData memory);
    function getGlobalScore(bytes32 agentId) external view returns (uint16 score, uint64 updatedAt);
    function getCategoryScore(bytes32 agentId, uint8 category) external view returns (uint16);
    function isFresh(bytes32 agentId, uint256 maxAge) external view returns (bool);
}
```

### 6.2 合约实现要点

- **访问控制**: 多签或阈值签名验证，支持 3/5 Oracle 节点共识
- **防 replay**: 每个 `agentId` 的 `updatedAt` 必须严格递增
- **惩罚机制**: 若 signature 验证失败，可记录作恶节点并触发惩罚
- **链上轻量**: 只存储 `agentId → ReputationData` 的 mapping，详细证明在 IPFS

### 6.3 部署策略

| 链          | 优先级 | 用途               |
| ----------- | ------ | ------------------ |
| Base        | P0     | 主要消费链，低成本 |
| Arbitrum    | P1     | DeFi 生态丰富      |
| Solana      | P1     | 原生用户基础       |
| Ethereum L1 | P2     | 高安全性需求场景   |

---

## 7. API 规范

### 7.1 端点清单

```
GET  /api/v1/oracle/reputation/{agentAddress}         # 查询单一 Agent 声誉
GET  /api/v1/oracle/reputation/{agentAddress}/verify  # 验证声誉证明
POST /api/v1/oracle/reputation/{agentAddress}/sync    # 手动触发同步
POST /api/v1/oracle/reputation/sync-batch             # 批量同步
GET  /api/v1/oracle/reputation/leaderboard            # 排行榜
GET  /api/v1/oracle/stats                             # 全局统计
GET  /api/v1/oracle/health                            # 健康检查
```

### 7.2 查询响应示例

```json
{
    "agentAddress": "0x1234...",
    "reputation": {
        "overallScore": 87.5,
        "tier": "platinum",
        "confidence": 0.94,
        "calculatedAt": "2026-04-06T12:00:00Z"
    },
    "components": {
        "taskScore": 92.0,
        "qualityScore": 85.0,
        "consistencyScore": 88.0,
        "stakingScore": 76.0
    },
    "metrics": {
        "completedTasks": 165,
        "totalEarned": "1000000000000000000",
        "avgRating": 4.5,
        "disputeRate": 0.02
    },
    "categoryScores": {
        "smart-contract-audit": 92.0,
        "defi-strategy": 85.0,
        "data-analysis": 88.0
    },
    "sources": [
        { "chain": "solana", "score": 89.0, "tasks": 120, "lastActivity": "2026-04-05T10:00:00Z" },
        { "chain": "base", "score": 86.0, "tasks": 45, "lastActivity": "2026-04-06T08:00:00Z" }
    ],
    "proofs": {
        "merkleRoot": "0xabc123...",
        "signature": "0xdef456...",
        "attestationURI": "ipfs://QmXyz..."
    },
    "erc8004": {
        "agentId": "12345",
        "feedbackCount": 47,
        "lastUpdateTx": "0x789abc...",
        "registryUrl": "https://8004scan.io/agents/12345"
    },
    "syncStatus": {
        "solana": true,
        "base": true,
        "lastSyncAt": "2026-04-06T12:00:00Z"
    }
}
```

### 7.3 缓存策略

- **Redis**: 缓存热门 Agent 声誉数据，TTL = 5 分钟
- **CDN**: 静态 Attestation JSON 文件通过 IPFS/Cloudflare 分发
- **数据库**: PostgreSQL 存储历史版本，支持时间序列分析

---

## 8. 安全与信任模型

### 8.1 威胁模型

| 威胁            | 描述                           | 缓解方案                       |
| --------------- | ------------------------------ | ------------------------------ |
| **Oracle 造假** | Oracle 节点伪造声誉数据        | 多签阈值 + 链上验证 + 惩罚机制 |
| **数据延迟**    | 链上数据未及时同步             | TTL 过期机制 + 强制刷新 API    |
| **DDoS**        | 高频 API 查询耗尽资源          | Rate Limiting + API Key + CDN  |
| **链重组**      | EVM 链重组导致 reputation 回滚 | 等待 12 个确认块后再提交       |
| **地址冒充**    | 攻击者冒充高声誉 Agent         | 地址验证 + 链上绑定关系        |

### 8.2 签名方案

**Phase 1-2 (托管/联盟节点)**:

- Oracle 使用 ECDSA (secp256k1) 签名
- 链上合约验证 signer 是否在白名单

**Phase 3 (去中心化网络)**:

- 采用阈值签名 (TSS) 或 BLS 聚合签名
- 5 个节点中至少 3 个同意才能生成有效签名

**Phase 4 (ZK Proof)**:

- 使用 RISC Zero / SP1 生成 ZK proof
- 链上只需验证 proof，无需信任任何 signer

---

## 9. 实施路线图

### Phase 1: MVP (4-6 周)

- [ ] 实现 Data Adapter (Solana + Base)
- [ ] 实现 Aggregation Engine (基础算法)
- [ ] 集成现有 `erc8004-client.ts`，打通自动提交
- [ ] 部署 `GradienceReputationFeed` 到 Base testnet
- [ ] 上线基础 API (`/reputation/{address}`, `/leaderboard`)

### Phase 2: 生产化 (6-8 周)

- [ ] 支持 Arbitrum 数据源
- [ ] 实现 Merkle Proof 和签名验证
- [ ] 引入 PostgreSQL + Redis 缓存
- [ ] 部署 Feed 合约到 Base mainnet
- [ ] 与 Chainlink Functions 集成（可选）

### Phase 3: 去中心化 (3-6 个月)

- [ ] 设计并部署 EigenLayer AVS
- [ ] 开放无许可节点注册
- [ ] 经济模型上线（质押、惩罚、奖励）
- [ ] 引入 ZK Proof（长期研究）

### Phase 4: 生态扩展 (6-12 个月)

- [ ] 与 Lending / Insurance / DAO 协议集成
- [ ] 推出企业级 API 和 SLA
- [ ] 建立 Reputation Oracle 开发者生态

---

## 10. 附录

### A. Category ID 映射表

| ID  | Category Name          | 中文名       |
| --- | ---------------------- | ------------ |
| 0   | `smart-contract-audit` | 智能合约审计 |
| 1   | `defi-strategy`        | DeFi 策略    |
| 2   | `data-analysis`        | 数据分析     |
| 3   | `code-optimization`    | 代码优化     |
| 4   | `security-research`    | 安全研究     |
| 5   | `ui-ux-design`         | UI/UX 设计   |
| 6   | `content-creation`     | 内容创作     |
| 7   | `general-task`         | 通用任务     |

### B. 相关代码文件

- `apps/agent-daemon/src/integrations/erc8004-client.ts` — ERC-8004 交互客户端
- `apps/agent-daemon/src/api/routes/reputation-oracle.ts` — Oracle API 路由（骨架）
- `apps/agent-daemon/src/reputation/push-service.ts` — 声誉推送服务
- `protocol/design/reputation-feedback-loop.md` — 信誉反馈循环设计文档
