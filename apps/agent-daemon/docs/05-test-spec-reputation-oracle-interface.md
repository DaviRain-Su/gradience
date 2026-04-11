# Phase 5: Test Spec — ERC-8004-compatible Reputation Oracle Interface

> **目的**: 定义所有验收测试，确保实现符合技术规格
> **输入**: `03-technical-spec-reputation-oracle-interface.md` + `04-task-breakdown-reputation-oracle-interface.md`
> **输出物**: 本测试规格文档 + 测试代码骨架

---

## 5.1 测试策略

| 层级 | 工具 | 覆盖范围 |
| --- | --- | --- |
| 单元测试 | Foundry | Solidity 合约函数、签名验证、访问控制 |
| 集成测试 | Vitest + tsx | TypeScript 服务（Proof Generator、Relayer、API 路由） |
| 端到端测试 | Forge script / Anvil | 链下签名 → 链上验证完整流程 |

---

## 5.2 Solidity 合约测试（Foundry）

### 测试文件
`packages/evm-oracle-contracts/test/GradienceReputationOracle.t.sol`

### 测试用例

#### TC-SOL-01: 合约部署
- **目的**: 验证合约可正确部署，初始状态正确
- **步骤**:
  1. 部署 `GradienceReputationOracle`
  2. 传入 `oracleSigner` 和 `initialRelayer`
- **期望**:
  - `oracleSigner()` 返回传入地址
  - `relayers(initialRelayer)` 为 true
  - `nonces(bytes32(0))` 为 0

#### TC-SOL-02: updateReputation 成功
- **目的**: 验证合法 payload 和签名可更新声誉
- **步骤**:
  1. 生成有效 `ReputationPayload`（nonce = 1）
  2. 使用 `oracleSigner` 私钥签名
  3. relayer 调用 `updateReputation(payload, signature)`
- **期望**:
  - 调用成功
  - `nonces[agentId]` = 1
  - `getDetailedReputation(agentId)` 返回相同 payload
  - 触发 `ReputationUpdated` 事件

#### TC-SOL-03: updateReputation 签名无效
- **目的**: 验证非 oracleSigner 签名会被拒绝
- **步骤**:
  1. 使用非 signer 私钥签名
  2. relayer 调用 `updateReputation(payload, signature)`
- **期望**:
  - revert: `InvalidSignature()`

#### TC-SOL-04: updateReputation nonce 防重放
- **目的**: 验证旧 nonce 无法重放
- **步骤**:
  1. 成功更新 nonce = 2 的 payload
  2. 再次使用 nonce = 1 的 payload 调用
- **期望**:
  - 第二次调用 revert: `InvalidNonce()`

#### TC-SOL-05: updateReputation 非 relayer 调用
- **目的**: 验证访问控制
- **步骤**:
  1. 非 relayer 地址调用 `updateReputation`
- **期望**:
  - revert: `NotRelayer()`

#### TC-SOL-06: getReputation ERC-8004 兼容
- **目的**: 验证返回值格式兼容 ERC-8004
- **步骤**:
  1. 更新 reputations[agentId]
  2. 调用 `getReputation(agentId)`
- **期望**:
  - `value` = globalScore (int128)
  - `decimals` = 2
  - `count` = nonce

#### TC-SOL-07: isFresh 数据新鲜度
- **目的**: 验证过期数据检测
- **步骤**:
  1. 更新 payload（updatedAt = block.timestamp）
  2. 调用 `isFresh(agentId, 86400)`
  3. 时间跳跃 2 天
  4. 再次调用 `isFresh(agentId, 86400)`
- **期望**:
  - 第一次返回 true
  - 第二次返回 false

#### TC-SOL-08: verifySignature 正确性
- **目的**: 验证链上签名验证逻辑
- **步骤**:
  1. 生成 payload 并签名
  2. 调用 `verifySignature(payload, signature)`
- **期望**:
  - 返回 true（有效签名）
  - 篡改 payload 后返回 false

---

## 5.3 TypeScript 服务测试（Vitest）

### 测试文件
`apps/agent-daemon/src/reputation/__tests__/proof-generator.test.ts`

#### TC-TS-01: Proof Generator 签名可链上验证
- **目的**: 验证生成的签名可被 Solidity 合约验证
- **步骤**:
  1. 调用 `generateReputationPayload(agentAddress, score)`
  2. 使用 `signPayload(payload, signer)` 签名
- **期望**:
  - payload 结构完整
  - signature 为 65 bytes
  - 使用相同 hash 逻辑在合约中恢复出 signer 地址

### 测试文件
`apps/agent-daemon/src/reputation/__tests__/evm-relayer.test.ts`

#### TC-TS-02: EVM Relayer 构造交易
- **目的**: 验证 Relayer 可构造有效的 updateReputation 调用
- **步骤**:
  1. mock `ethers.Contract`
  2. 调用 `relayer.pushReputation(payload, signature)`
- **期望**:
  - `contract.updateReputation` 被调用一次
  - 传入参数正确
  - 返回 txHash

#### TC-TS-03: EVM Relayer 网络异常处理
- **目的**: 验证失败时抛出明确错误
- **步骤**:
  1. mock 交易失败（revert）
  2. 调用 `relayer.pushReputation(payload, signature)`
- **期望**:
  - 抛出带有 revert reason 的 Error

### 测试文件
`apps/agent-daemon/src/reputation/__tests__/push-service-evm-oracle.test.ts`

#### TC-TS-04: Push Service 集成 EVM Oracle
- **目的**: 验证 Push Service 同时推送至 ERC-8004 和 EVM Oracle
- **步骤**:
  1. mock `erc8004Client`、`solanaClient`、`evmRelayer`
  2. 调用 `pushService.push(agentAddress, score)`
- **期望**:
  - `evmRelayer.pushReputation` 被调用一次
  - PushResult 包含 `evmOracle` 字段

---

## 5.4 API 路由测试（Vitest）

### 测试文件
`apps/agent-daemon/src/api/routes/__tests__/reputation-oracle-onchain.test.ts`

#### TC-API-01: GET /onchain 返回完整 payload
- **目的**: 验证 `/onchain` 返回可直接上链的数据
- **步骤**:
  1. mock `engine.calculateReputation` 和 `proofGenerator`
  2. GET `/api/v1/oracle/reputation/:agentAddress/onchain`
- **期望**:
  - HTTP 200
  - 响应包含 `payload`、`signature`、`calculatedAt`、`attestationURI`
  - payload.agentId 为 bytes32 hex

#### TC-API-02: GET /verify-onchain 本地验证
- **目的**: 验证预检端点工作正常
- **步骤**:
  1. mock `verifySignature` 返回 true
  2. GET `/api/v1/oracle/reputation/:agentAddress/verify-onchain`
- **期望**:
  - HTTP 200
  - `verified` = true
  - 包含 `contractAddress`、`chainId`

#### TC-API-03: GET /onchain agent 不存在
- **目的**: 验证 404 处理
- **步骤**:
  1. mock `fetchAgentActivity` 返回 null
  2. GET `/api/v1/oracle/reputation/:agentAddress/onchain`
- **期望**:
  - HTTP 404
  - `error: 'Agent not found'`

---

## 5.5 端到端测试（Anvil + Forge Script）

### 测试文件
`packages/evm-oracle-contracts/script/E2ESignVerify.s.sol`

#### TC-E2E-01: 链下签名 → 链上验证
- **目的**: 打通完整签名验证流程
- **步骤**:
  1. Anvil 启动本地链
  2. 部署合约
  3. Node.js script 生成 signed payload
  4. Forge script 调用 `updateReputation`
  5. 查询 `getReputation`
- **期望**:
  - 交易成功
  - `getReputation` 返回预期值
  - `verifySignature` 返回 true

---

## 5.6 测试覆盖率目标

| 层级 | 语句覆盖率 | 分支覆盖率 | 目标 |
| --- | --- | --- | --- |
| Solidity | ≥ 95% | ≥ 90% | Foundry coverage |
| TypeScript (服务) | ≥ 85% | ≥ 80% | Vitest coverage |
| API 路由 | ≥ 80% | ≥ 75% | Vitest coverage |

---

## 5.7 测试环境需求

- **Foundry**: `forge` 已安装
- **Node.js**: 22+
- **Anvil**: 用于本地 EVM 测试（随 Foundry 安装）
- **环境变量**:
  - `ORACLE_SIGNER_PRIVATE_KEY` (测试用)
  - `BASE_SEPOLIA_RPC_URL` (可选)

---

## 5.8 测试执行命令

```bash
# Solidity 测试
cd packages/evm-oracle-contracts
forge test

# TypeScript 测试
cd apps/agent-daemon
npm test -- reputation/__tests__/proof-generator.test.ts
npm test -- reputation/__tests__/evm-relayer.test.ts
npm test -- src/api/routes/__tests__/reputation-oracle-onchain.test.ts

# E2E
forge script script/E2ESignVerify.s.sol --fork-url http://localhost:8545
```

---

## ✅ Phase 5 验收标准

- [x] 所有关键行为都有测试用例覆盖
- [x] 每个测试用例有明确的期望结果
- [x] 规定了覆盖率目标
- [x] 定义了测试执行命令
- [x] 测试代码骨架已就绪（随实现一起提交）
