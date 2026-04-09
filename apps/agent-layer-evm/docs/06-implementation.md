# Phase 6: Implementation Log — agent-layer-evm

---

## 实现概览

### 核心合约（`src/`）

| 组件                        | 文件                                  | 行数 | 状态    | 说明                                                                    |
| --------------------------- | ------------------------------------- | ---- | ------- | ----------------------------------------------------------------------- |
| **AgentArenaEVM**           | `src/AgentArenaEVM.sol`               | ~989 | ✅ 完成 | Phase 6 生产合约；UUPS 代理、ERC20 支付、JudgeRegistry、Dispute、Quorum |
| AgentLayerRaceTask          | `src/AgentLayerRaceTask.sol`          | ~989 | ✅ 兼容 | 旧版兼容合约；与 AgentArenaEVM 保持 ABI 兼容                            |
| **JudgeRegistry**           | `src/JudgeRegistry.sol`               | ~200 | ✅ 完成 | Judge 注册、评分、 inactive slash 与重新指派                            |
| **AgentMRegistry**          | `src/AgentMRegistry.sol`              | ~180 | ✅ 完成 | 用户 profile 与 Agent profile 链上注册                                  |
| **GradienceReputationFeed** | `src/GradienceReputationFeed.sol`     | ~220 | ✅ 完成 | 跨链声誉 Oracle Feed；ECDSA 验证 + chainId 隔离                         |
| ReputationVerifier          | `src/ReputationVerifier.sol`          | 157  | ✅ 完成 | Ed25519 跨链签名验证（旧版保留）                                        |
| DeterministicDeployer       | `src/utils/DeterministicDeployer.sol` | ~120 | ✅ 完成 | CREATE2 多链确定性部署器                                                |
| Ed25519 库                  | `src/libraries/Ed25519.sol`           | —    | ✅ 完成 | 纯 Solidity Ed25519                                                     |
| Sha512 库                   | `src/libraries/Sha512.sol`            | —    | ✅ 完成 | 纯 Solidity SHA-512                                                     |

### 测试矩阵

| 框架        | 文件                                 | 测试数 | 说明                                                                |
| ----------- | ------------------------------------ | ------ | ------------------------------------------------------------------- |
| **Hardhat** | `test/AgentArenaEVM.test.js`         | 26     | 完整功能覆盖（post/apply/submit/judge/cancel/dispute/quorum/ERC20） |
| **Hardhat** | `test/AgentLayerRaceTask.test.js`    | 26     | 兼容合约测试                                                        |
| **Hardhat** | `test/JudgeRegistry.test.js`         | —      | Judge 生命周期测试                                                  |
| **Hardhat** | `test/ReputationVerifier.test.js`    | —      | Ed25519 验证测试                                                    |
| **Foundry** | `test/AgentLayerRaceTask.t.sol`      | 4      | Smoke + integration                                                 |
| **Foundry** | `test/AgentLayerRaceTask.fuzz.t.sol` | 2 fuzz | Cancel 公平性 + ProtocolFee 上界不变量                              |
| **Foundry** | `test/AgentMRegistry.t.sol`          | —      | 注册/更新/分辨率测试                                                |
| **Foundry** | `test/GradienceReputationFeed.t.sol` | —      | Oracle 更新 + chainId 隔离测试                                      |
| **Foundry** | `test/DeterministicDeployer.t.sol`   | —      | CREATE2 盐值预测测试                                                |
| **Foundry** | `test/IReputationVerifier.t.sol`     | —      | 接口兼容性测试                                                      |

### 链下基础设施

| 组件                 | 路径                                 | 状态    | 说明                                |
| -------------------- | ------------------------------------ | ------- | ----------------------------------- |
| **Subgraph**         | `subgraph/`                          | ✅ 完成 | The Graph 索引 AgentArenaEVM 全事件 |
| **Reputation Relay** | `scripts/reputation-relay-server.js` | ✅ 完成 | Solana → EVM 声誉桥接签名服务       |

### 部署脚本

| 脚本       | 路径                               | 说明                                |
| ---------- | ---------------------------------- | ----------------------------------- |
| 标准部署   | `script/Deploy.s.sol`              | UUPS Proxy + JudgeRegistry 直接部署 |
| 确定性部署 | `script/DeterministicDeploy.s.sol` | CREATE2 跨链统一地址部署            |

---

## 关键实现决策

### 1. UUPS 可升级代理（AgentArenaEVM）

生产合约采用 OpenZeppelin `ERC1967Proxy` + `UUPSUpgradeable`：

- 支持后续追加功能（如批量任务、新 Judge 模式）而无需迁移 escrow 资金
- 初始化函数 `initialize(owner, treasury)` 在 proxy 部署时执行

### 2. 原生 ERC20 支持

AgentArenaEVM 同时支持 ETH（`address(0)`）和任意 ERC20 作为任务奖励/质押：

- `postTask` / `postTaskERC20` 双入口
- escrow 逻辑内统一 `_payout(task, to, amount)` 处理 ETH transfer 或 ERC20 transfer
- Hardhat 测试覆盖 ERC20 全流程（26 个测试包含 ERC20 分支）

### 3. 协议费累积模型（非即时转账）

所有任务结算路径（`judgeAndPay`、`settleWithQuorum`、`forceRefund`、`cancelTask`）将 2% protocol fee 累积到 `mapping(address => uint256) protocolFees` 中，由 treasury 通过 `withdrawProtocolFees(token)` 统一提取：

- 降低 multi-sig treasury 的 gas 开销
- 支持 ETH 和多种 ERC20 费用累积

### 4. 三阶段取消公平规则（cancelTask）

防止 Poster 恶意剥削 Applicants：

- **0 applicants**：Poster 获得 100% reward 退款，不扣 protocol fee
- **>0 applicants，0 submissions**：扣除 5% reward 平分给所有 applicants 作为补偿，剩余扣除 protocol fee 后退款
- **any submission exists**：`cancelTask` 直接 revert，必须走 `claimExpired` 或 `forceRefund`

### 5. JudgeRegistry + Auto-Assignment

链上 Judge 注册表解决 Judge 缺勤问题：

- `registerJudge(minScore, maxTasks)` 注册
- `pickJudge()` 按可用容量随机指派
- `reassignJudge(taskId)` 在 Judge 超期未评判时 slash 质押并重新指派

### 6. 多链 RPC 与确定性部署

`foundry.toml` 预置 5 条链的 RPC 与 Etherscan 验证配置：

- `xlayer` / `xlayer-testnet`
- `base`
- `arbitrum`
- `ethereum`

`.env.example` 中提供对应私钥与 API Key 模板。`forge script` 可直接面向任意网络部署：`forge script script/Deploy.s.sol --rpc-url base --broadcast --verify`。

### 7. 跨链声誉桥接

`GradienceReputationFeed` 接受 Oracle ECDSA 签名：

- 校验 `chainId == block.chainid` 防止 testnet/mainnet 污染
- 校验 `timestamp` 单调递增防止重放
- 与 Solana Reputation Oracle 通过 `ReputationVerifier` / Relay Server 联动

### 8. The Graph Subgraph

`subgraph/` 目录包含完整事件索引：

- 实体：Task、Application、Submission、Dispute、User、AgentProfile、Reputation、ProtocolMetric、LLMJudgeOracle
- 数据源：`AgentArenaEVM`、`AgentMRegistry`、`GradienceReputationFeed`

---

## 技术栈

- **编译/测试**：Hardhat + Foundry 双轨制
    - Hardhat：功能回归（26+ tests，覆盖 JS 工具链）
    - Foundry：fuzz + invariant + gas snapshot
- **合约**：Solidity ^0.8.24，OpenZeppelin Contracts v5
- **部署**：Forge Scripts（`Deploy.s.sol`、`DeterministicDeploy.s.sol`）
- **索引**：The Graph（AssemblyScript mappings）
- **测试网**：Base Sepolia（主验证网），XLayer Testnet（多链验证）

---

## 常用命令

```bash
cd apps/agent-layer-evm

# Hardhat
npx hardhat compile
npx hardhat test
npx hardhat test test/AgentArenaEVM.test.js

# Foundry
forge build
forge test
forge test --fork-url xlayer-testnet

# 部署示例（Base）
source .env
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify

# 确定性部署（跨链统一地址）
forge script script/DeterministicDeploy.s.sol --rpc-url xlayer-testnet --broadcast

# Subgraph
cd subgraph
pnpm exec graph codegen
pnpm exec graph build
```
