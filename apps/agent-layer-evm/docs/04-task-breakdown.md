# Phase 4: Task Breakdown — EVM Core Protocol Deployment (Multi-Chain, XLayer First)

> **目标链**: 所有 EVM 兼容链（首发 XLayer Testnet / Mainnet）  
> **参考文档**: `03-technical-spec.md`
> **方法论**: 严格遵循 7-phase 开发流程，无技术规范不进入实现阶段。

---

## 一、任务总览

| 阶段 | 任务数 | 预估总工时 |
|------|--------|-----------|
| P0 合约开发 | 5 | 10 天 |
| P1 合约开发 | 3 | 6 天 |
| P2 合约/工具 | 3 | 4 天 |
| 测试与审计 | 4 | 6 天 |
| 索引与中间件 | 3 | 5 天 |
| 部署与文档 | 3 | 3 天 |
| **总计** | **21** | **~34 天** |

---

## 二、P0 任务 — 阻塞上线

### 2.1 AgentArenaEVM 合约扩展

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P0-01 | 扩展 `AgentLayerRaceTask.sol` 为完整 `AgentArenaEVM.sol` | 增加 `paymentToken`、完整 `TaskState`、取消/过期逻辑、ERC20 路径 | — | 3d |
| EVM-P0-02 | 实现 `JudgeRegistry.sol` | Judge 注册/质押/解押/冷却期、分类管理 | — | 2d |
| EVM-P0-03 | AgentArenaEVM 集成 JudgeRegistry | `postTask(judge=address(0))` 自动分配 Judge、记录评判费 | EVM-P0-01, EVM-P0-02 | 2d |
| EVM-P0-04 | AgentArenaEVM 集成 Reputation 折扣 | 读取 `GradienceReputationFeed` 动态调整 `minStake` | EVM-P0-01, EVM-P0-09 | 1d |

### 2.2 AgentM Core (用户 + 社交)

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P0-05 | 实现 `AgentMRegistry.sol` | 用户注册、用户名唯一性、Agent 创建、元数据 URI 管理 | — | 2d |
| EVM-P0-06 | 实现 `SocialGraph.sol` | 关注/取关、双向映射、事件发射 | EVM-P0-05 | 1d |

### 2.3 Reputation Bridge

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P0-07 | 复用并冻结 `ReputationVerifier.sol` | 确保 Ed25519 验证通过现有测试，不做功能变更 | — | 0.5d |
| EVM-P0-08 | 实现 `GradienceReputationFeed.sol` | Oracle 签名验证、声誉更新、EVM/Solana 地址映射 | — | 1.5d |
| EVM-P0-09 | AgentArenaEVM 双轨声誉读取 | 优先读 Feed，fallback 到 Verifier | EVM-P0-01, EVM-P0-07, EVM-P0-08 | 1d |

### 2.4 部署与配置

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P0-10 | UUPS 代理部署脚本 | 所有业务合约使用 `ERC1967Proxy` 部署，支持升级 | — | 1d |
| EVM-P0-11 | 首发 EVM Testnet（XLayer）首次部署 | 部署全部 P0 合约到 首发 EVM Testnet（XLayer Testnet, Chain ID 195） | 全部 P0 合约完成 | 1d |
| EVM-P0-12 | EVM 多链网络配置 (Foundry) | 添加 `xlayer` 和 `xlayer-testnet` 到 `foundry.toml` | — | 0.5d |

---

## 三、P1 任务 — 核心扩展

### 3.1 Chain Hub

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P1-01 | 实现 `ChainHubRegistry.sol` | Protocol/Skill 注册、分类管理、元数据 URI | — | 2d |
| EVM-P1-02 | 实现 `DelegationManager.sol` | 委托任务创建、权限检查、事件记录 | EVM-P1-01 | 1.5d |

### 3.2 A2A Protocol

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P1-03 | 实现 `A2AChannelRegistry.sol` | 链上通道注册、Agent 绑定、状态管理 | — | 2d |
| EVM-P1-04 | 实现 `SubtaskMarket.sol` | 子任务竞标、支付通道状态 | EVM-P1-03 | 1.5d |

### 3.3 中间件与 SDK

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P1-05 | `agent-daemon` EVM Task Builder | viem 实现 `EVMTaskBuilder`，支持 post/apply/submit/judge | EVM-P0-11 | 2d |
| EVM-P1-06 | `packages/sdk` EVMAdapter | 实现 `EVMTaskClient`, `EVMUserClient`, `EVMReputationClient` | EVM-P0-11 | 2d |

---

## 四、P2 任务 — 增强与优化

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-P2-01 | 实现 `WorkflowMarket.sol` | Workflow NFT 发行、购买、版税 | — | 2d |
| EVM-P2-02 | Chainlink VRF Judge 分配 | 替换伪随机为 VRF，高价值任务使用 | EVM-P0-03 | 2d |
| EVM-P2-03 | Permit2 / 批量操作优化 | ERC20 Permit2 支持、批量 claim stake | EVM-P0-01 | 1.5d |
| EVM-P2-04 | Gas 优化审计 | 减少 storage write、优化事件字段 | 全部 P0 完成 | 1d |

---

## 五、测试任务

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-TEST-01 | AgentArenaEVM 单元测试 | Happy path + 所有 custom error + 重入 + 费用精确计算 | EVM-P0-03 | 2.5d |
| EVM-TEST-02 | JudgeRegistry 单元测试 | 注册/解押/分配/权限/边界 | EVM-P0-02 | 1.5d |
| EVM-TEST-03 | AgentMRegistry + SocialGraph 单元测试 | 用户/Agent/关注全路径 | EVM-P0-06 | 1.5d |
| EVM-TEST-04 | Reputation Bridge 测试 | Ed25519 验证、Oracle 签名、重放保护、双轨读取 | EVM-P0-09 | 1.5d |
| EVM-TEST-05 | 集成测试：跨链声誉端到端 | Solana devnet 任务 → Oracle 聚合 → XLayer 更新 → 合约读取 | EVM-P0-11 | 2d |
| EVM-TEST-06 | Slither + Echidna 安全审计 | 静态分析 + 属性测试 | 全部 P0 完成 | 2d |

---

## 六、索引与基础设施任务

| Task ID | 任务 | 描述 | 依赖 | 预估 |
|---------|------|------|------|------|
| EVM-INFRA-01 | EVM Subgraph 设计（首发 XLayer） | schema 定义、实体关系、事件映射 | EVM-P0-11 | 1.5d |
| EVM-INFRA-02 | Subgraph 实现与部署（首发 XLayer） | mappings 编写、目标 EVM testnet 部署 | EVM-INFRA-01 | 2d |
| EVM-INFRA-03 | Reputation Oracle 适配多链 EVM | 更新 Oracle 提交逻辑，首发支持 XLayer | EVM-P0-11 | 1.5d |

---

## 七、任务依赖图

```
合约层 (可并行)
├─ EVM-P0-01 (AgentArenaEVM) ─┬─ EVM-P0-03 (集成 Judge) ─┬─ EVM-P0-04 (Reputation 折扣)
│                              │                           │
├─ EVM-P0-02 (JudgeRegistry) ──┘                           │
│                                                          │
├─ EVM-P0-05 (AgentMRegistry) ── EVM-P0-06 (SocialGraph)   │
│                                                          │
├─ EVM-P0-07 (ReputationVerifier)                          │
│                                                          │
└─ EVM-P0-08 (ReputationFeed) ──────────────────────────────┘
│
▼
EVM-P0-09 (双轨声誉读取)
│
▼
EVM-P0-10 (UUPS 部署脚本)
│
▼
EVM-P0-11 (XLayer Testnet 部署)
│
┌─────────────────────┼─────────────────────┐
▼                     ▼                     ▼
EVM-TEST-01~04       EVM-INFRA-01~03         EVM-P1-05~06
(合约测试)            (Subgraph + Oracle)      (Daemon + SDK)
│                     │                     │
└─────────────────────┼─────────────────────┘
▼
EVM-TEST-05 (集成测试)
│
▼
EVM-TEST-06 (安全审计)
```

---

## 八、验收标准（Phase 4 → Phase 5 入口）

- [ ] P0 合约代码全部完成并通过本地编译
- [ ] JudgeRegistry 与 AgentArenaEVM 的集成通过 happy path 测试
- [ ] Reputation Bridge 的双轨读取逻辑已验证
- [ ] UUPS 代理部署脚本可成功部署到 Anvil (local) / EVM testnet fork
- [ ] 所有任务 ID 已录入 Obsidian 并分配了负责人
- [ ] Phase 5 Test Spec 已具备足够的接口信息

---

## 九、Obsidian 任务映射表

> 以下任务已（或将）通过 `./scripts/task.sh create` 录入 Obsidian。

| Obsidian ID | 对应 Task ID | 标题 | 优先级 |
|-------------|-------------|------|--------|
| GRA-240 | EVM-P0-01 | [EVM] Implement AgentArenaEVM core contract | P0 |
| GRA-241 | EVM-P0-02 | [EVM] Implement JudgeRegistry with staking | P0 |
| GRA-242 | EVM-P0-03 | [EVM] Integrate JudgeRegistry into AgentArenaEVM | P0 |
| GRA-243 | EVM-P0-04 | [EVM] Add reputation-based stake discount | P0 |
| GRA-244 | EVM-P0-05 | [EVM] Implement AgentMRegistry | P0 |
| GRA-245 | EVM-P0-06 | [EVM] Implement SocialGraph | P0 |
| GRA-246 | EVM-P0-07 | [EVM] Finalize ReputationVerifier | P0 |
| GRA-247 | EVM-P0-08 | [EVM] Implement GradienceReputationFeed | P0 |
| GRA-248 | EVM-P0-09 | [EVM] Dual-track reputation read in AgentArenaEVM | P0 |
| GRA-249 | EVM-P0-10 | [EVM] UUPS proxy deployment scripts | P0 |
| GRA-250 | EVM-P0-11 | [EVM] Deploy P0 contracts to XLayer Testnet | P0 |
| GRA-251 | EVM-P0-12 | [EVM] Configure EVM networks in Foundry（XLayer, Base, Arbitrum） | P0 |
