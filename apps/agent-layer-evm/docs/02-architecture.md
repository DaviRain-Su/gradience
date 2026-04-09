# Phase 2: Architecture — agent-layer-evm

> **引用**: 项目级架构见 `docs/02-architecture.md`，多链架构见 `docs/multi-chain/02-architecture.md`  
> **策略**: Multi-Home Deployment + Unified SDK + Global Reputation Bridge

---

## 1. 架构设计决策

| 决策项          | 选择                              | 理由                                                               |
| --------------- | --------------------------------- | ------------------------------------------------------------------ |
| **部署模式**    | **Multi-Home**                    | 任务 escrow 和结算必须本地化，跨链 escrow 会引入桥风险和高延迟     |
| **首发链**      | **XLayer**                        | 零 Gas、TEE Agentic Wallet、原生 Solana 支持、Polygon CDK 技术成熟 |
| **扩展链**      | **Base / Arbitrum / Ethereum L1** | 合约和 SDK 完全通用，后续只需配置网络参数和地址映射                |
| **声誉策略**    | **全局统一 + Oracle 桥接**        | Agent 的核心资产是声誉，必须在所有 EVM 链间可验证、可携带          |
| **SDK 策略**    | **Unified SDK（链抽象层）**       | 前端和开发者无需为每条链写独立逻辑                                 |
| **Solana 定位** | **同级核心链**                    | 与 EVM 长期并行支持，新功能同步规划，不因 EVM 扩展而降级           |

---

## 2. 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Layer 4: Frontend                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      agentm-web (Next.js)                            │    │
│  │         Wallet-Driven Routing: Phantom → Solana, MetaMask → XLayer   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Layer 3: Unified SDK                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    @gradiences/sdk (Unified API)                     │    │
│  │                         ChainRouter                                  │    │
│  │            (按 chainId 路由到 SolanaAdapter / EVMAdapter)            │    │
│  │                                                                      │    │
│  │   chainId: 'solana'  →  SolanaTaskClient / SolanaUserClient          │    │
│  │   chainId: 'xlayer'  →  EVMTaskClient  / EVMUserClient               │    │
│  │   chainId: 'base'    →  EVMTaskClient  / EVMUserClient               │    │
│  │   chainId: 'arbitrum'→  EVMTaskClient  / EVMUserClient               │    │
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
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   Solana Devnet     │   │    XLayer Testnet   │   │  Base / Arbitrum    │
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
│                     │   │  ┌───────────────┐  │   │  ┌───────────────┐  │
│                     │   │  │Gradience      │  │   │  │Gradience      │  │
│                     │   │  │ReputationFeed │  │   │  │ReputationFeed │  │
│                     │   │  └───────────────┘  │   │  └───────────────┘  │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
           │                         │                         │
           └─────────────────────────┴─────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cross-Chain Reputation Layer                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Gradience Reputation Oracle                                        │    │
│  │  Flow: Solana PDA → Aggregation → ECDSA Sign → EVM ReputationFeed  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 合约关系

### 3.1 P0 核心合约

| 合约                      | 职责                             | 依赖                                       |
| ------------------------- | -------------------------------- | ------------------------------------------ |
| `AgentArenaEVM`           | 任务发布/申请/提交/评判/退款     | `JudgeRegistry`, `GradienceReputationFeed` |
| `JudgeRegistry`           | Judge 注册/质押/解押/分类/分配   | OpenZeppelin Ownable                       |
| `AgentMRegistry`          | 用户注册/Agent 创建/Profile 管理 | OpenZeppelin UUPS                          |
| `SocialGraph`             | 关注/取关关系                    | `AgentMRegistry`                           |
| `ReputationVerifier`      | 跨链声誉 proof 验证与存储        | `Ed25519.sol`, `Sha512.sol`                |
| `GradienceReputationFeed` | Oracle 更新的权威跨链声誉数据库  | OpenZeppelin Ownable                       |

### 3.2 P1 扩展合约

| 合约                 | 职责                      | 依赖                 |
| -------------------- | ------------------------- | -------------------- |
| `ChainHubRegistry`   | Protocol/Skill 注册与查询 | OpenZeppelin UUPS    |
| `DelegationManager`  | 委托任务创建与权限执行    | `ChainHubRegistry`   |
| `A2AChannelRegistry` | 链上通道状态注册          | OpenZeppelin UUPS    |
| `SubtaskMarket`      | 子任务竞标与支付通道      | `A2AChannelRegistry` |
| `WorkflowMarket`     | Workflow NFT 发行与交易   | OpenZeppelin UUPS    |

---

## 4. 数据流

### 4.1 任务流（单链内闭环）

```
Poster ──▶ AgentArenaEVM.postTask(ETH/ERC20 escrow)
             │
             ▼
Agent ──▶ AgentArenaEVM.applyForTask(stake)
             │
             ▼
Agent ──▶ AgentArenaEVM.submitResult(resultRef, traceRef)
             │
             ▼
Judge ──▶ AgentArenaEVM.judgeAndPay(winner, score)
             │
             ▼
       95% winner / 3% judge / 2% protocol
```

### 4.2 声誉流（跨链桥接）

```
Solana Agent Arena (Reputation PDA)
             │
             ▼
   Gradience Reputation Oracle
             │
   ┌─────────┴─────────┐
   ▼                   ▼
ReputationVerifier   GradienceReputationFeed
(Ed25519 proof)      (Oracle ECDSA signed)
   │                   │
   └─────────┬─────────┘
             ▼
   AgentArenaEVM.readReputation(agent)
             │
             ▼
       动态调整 minStake
```

### 4.3 SDK 路由流

```
User Wallet Connection
       │
       ├── Phantom ──▶ chainId = 'solana' ──▶ SolanaAdapter
       ├── MetaMask ──▶ chainId = 'xlayer' ──▶ EVMAdapter
       ├── MetaMask ──▶ chainId = 'base' ──▶ EVMAdapter
       └── MetaMask ──▶ chainId = 'arbitrum' ──▶ EVMAdapter
                             │
                             ▼
                   EVMTaskClient / EVMUserClient
                             │
                             ▼
                   AgentArenaEVM / AgentMRegistry
```

---

## 5. 安全设计

- **ReentrancyGuard**: 所有涉及资金转移的外部函数使用 `nonReentrant`
- **Ed25519 签名防伪造**: `ReputationVerifier` 链上验证 Solana Oracle 签名
- **Oracle ECDSA 签名**: `GradienceReputationFeed` 仅接受受信任 Oracle 地址的签名数据
- **时间戳单调递增**: `ReputationVerifier.submitReputation` 要求 `timestamp` 严格递增，防重放
- **UUPS 代理模式**: 所有业务合约支持升级，便于漏洞修复和功能迭代
- **Custom errors**: 统一使用 Solidity custom errors 减少 gas 消耗

---

## 6. 多链扩展策略

新增一条 EVM 链时，**无需修改任何合约代码**，只需执行以下步骤：

1. **配置 Foundry RPC 网络**: 在 `foundry.toml` 中添加新链的 RPC 和 chainId
2. **运行部署脚本**: 使用现有 UUPS 部署脚本在新链上部署全部合约
3. **更新地址映射**: 在 SDK 的 `CONTRACTS` 常量表中新增该链的合约地址
4. **配置 Subgraph**: 复制现有 subgraph 配置，修改网络名称和起始区块
5. **更新 Oracle 配置**: 在 Reputation Oracle 中增加新 EVM 链的 `updateReputation` 调用目标，同时确保 Solana 声誉回写通道正常

**XLayer → Base 的扩展时间预估**: 1 天（纯配置和部署工作）
