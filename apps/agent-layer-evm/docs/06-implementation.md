# Phase 6: Implementation Log — agent-layer-evm

---

## 实现概览

| 组件 | 文件 | 行数 | 状态 |
|------|------|------|------|
| AgentLayerRaceTask | `contracts/AgentLayerRaceTask.sol` | 445 | ✅ 完成 |
| ReputationVerifier | `contracts/ReputationVerifier.sol` | 157 | ✅ 完成 |
| Ed25519 库 | `contracts/libraries/Ed25519.sol` | — | ✅ 完成 |
| Sha512 库 | `contracts/libraries/Sha512.sol` | — | ✅ 完成 |
| TestERC20 Mock | `contracts/mocks/TestERC20.sol` | — | ✅ 完成 |
| RaceTask 测试 | `test/AgentLayerRaceTask.test.js` | 430 | ✅ 完成 |
| Reputation 测试 | `test/ReputationVerifier.test.js` | 107 | ✅ 完成 |
| Relay Server | `scripts/reputation-relay-server.js` | 879 | ✅ 完成 |
| Relay 测试 | `scripts/reputation-relay-server.test.js` | 241 | ✅ 完成 |
| 部署脚本 | `scripts/deploy-*.js` | 58 | ✅ 完成 |
| 签名工具 | `scripts/sign-reputation.js` | 137 | ✅ 完成 |
| **合计** | | **~2,454** | |

## 关键实现决策

### 1. 双合约架构

将任务生命周期（RaceTask）与声誉验证（ReputationVerifier）分离为独立合约：
- RaceTask 专注于 escrow + judge 逻辑
- ReputationVerifier 专注于跨链 proof 验证
- 两者可独立升级和部署

### 2. Ed25519 纯 Solidity 实现

未使用预编译合约（EIP-665 不可用于所有 EVM 链），而是纯 Solidity 实现：
- 优点：全 EVM 兼容（Base、Arbitrum、Polygon 等）
- 缺点：Gas 成本较高

### 3. ETH-Only 支付

EVM 版本暂不支持 ERC20，仅使用 ETH：
- 简化 escrow 逻辑
- 避免 approve/transferFrom 攻击面
- ERC20 支持列为 P2（EVM-12）

### 4. Reputation Relay Server

离线签名服务器将 Solana 声誉数据签名后提交到 EVM：
- 使用 Ed25519 密钥对签名
- 支持 webhook 触发（Solana 声誉更新时自动同步）
- 防重放：时间戳单调递增校验

## 技术栈

- Hardhat 编译/测试/部署框架
- OpenZeppelin ReentrancyGuard
- ethers.js 脚本交互
- Base Sepolia 测试网

## 部署

```bash
cd apps/agent-layer-evm
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy-base-sepolia.js --network base-sepolia
```
