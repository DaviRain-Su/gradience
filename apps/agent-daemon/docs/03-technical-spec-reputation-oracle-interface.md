> **任务**: GRA-2  
> **输入**: `docs/multi-chain/03-reputation-oracle-spec.md`, `protocol/design/reputation-feedback-loop.md`  
> **输出**: Phase 3 Technical Spec — ERC-8004-compatible Reputation Oracle Interface  
> **代码必须与本文档 100% 一致。**

---

## 1. 概述

### 1.1 目标

定义 **Gradience Reputation Oracle 的 ERC-8004-compatible 对外接口**。使第三方 dApp / 协议能够：

1. **通过标准 ERC-8004 接口**查询 Agent 声誉（on-chain EVM）
2. **通过 REST API**查询带密码学证明的声誉数据（off-chain）
3. **信任最小化**：Oracle 数据必须携带可验证的签名或 Merkle Proof

### 1.2 核心设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **核心链** | Solana | 所有任务 escrow、评分、声誉生成在此完成 |
| **对外接口链** | Base / Arbitrum (EVM) | 第三方 dApp 主要活动在 EVM 生态 |
| **接口标准** | ERC-8004 兼容 | 复用以太坊已出现的 Agent 声誉标准，降低集成门槛 |
| **数据新鲜度** | 异步推送 + 缓存 | 避免高频链上写；声誉天然适合批量/定时更新 |
| **验证方式** | ECDSA 签名 + 增量 nonce | Phase 1-2 轻量可验证；未来迁移至 ZK/TSS |

### 1.3 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Gradience Reputation Oracle                          │
│  (Solana Core → Aggregation Engine → Proof Generator → EVM Push Service)    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ pushes signed reputation data
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   GradienceReputationOracle (EVM Contract)                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  getReputation(agentId) → ReputationPayload                           │  │
│  │  getLatestAttestation(agentId) → AttestationMetadata                  │  │
│  │  verifySignature(payload, signature) → bool                           │  │
│  │  updateReputation(payload, signature) → onlyRelayer/Oracle            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                          │ ERC-8004 compatible interface                    │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           │ queried by
                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│    Third-Party dApp A        │  │    Third-Party dApp B        │
│  (Lending / Insurance / DAO) │  │  (Agent Marketplace)         │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## 2. 数据结构定义

### 2.1 EVM Contract 数据结构

#### `ReputationPayload`

```solidity
struct ReputationPayload {
    bytes32 agentId;           // ERC-8004 agent ID
    uint16 globalScore;        // 0-10000 (e.g. 8750 = 87.50)
    uint16[8] categoryScores;  // 8 category scores, same scale
    uint64 updatedAt;          // Unix timestamp (seconds)
    uint8 confidence;          // 0-100 (percentage)
    uint64 nonce;              // strict monotonic per agentId, anti-replay
    bytes32 merkleRoot;        // optional: Merkle root of source data
    string sourceChain;        // "solana"
}
```

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| agentId | bytes32 | 32 | 非零 | ERC-8004 Identity Registry 中的 agentId |
| globalScore | uint16 | 2 | 0-10000 | 全局声誉分数 |
| categoryScores | uint16[8] | 16 | 每项 0-10000 | 分类分数 |
| updatedAt | uint64 | 8 | > lastUpdatedAt | 数据生成时间戳（秒） |
| confidence | uint8 | 1 | 0-100 | 数据可信度 |
| nonce | uint64 | 8 | 严格递增 | 防重放 |
| merkleRoot | bytes32 | 32 | 可零值 | 源数据 Merkle Root |
| sourceChain | string | 动态 | "solana" | 声誉数据来源链 |

#### `AttestationMetadata`

```solidity
struct AttestationMetadata {
    bytes32 agentId;
    uint64 updatedAt;
    bytes32 merkleRoot;
    string attestationURI;     // ipfs:// or https:// 指向完整 JSON
    address signer;            // Oracle 签名者地址
}
```

### 2.2 链下 Attestation JSON Schema

```json
{
    "version": "gradience-reputation-v1.1",
    "agentId": "12345",
    "agentAddress": {
        "solana": "8oR...",
        "evm": "0xabc..."
    },
    "calculatedAt": 1712390400,
    "globalScore": 8750,
    "confidence": 94,
    "categoryScores": [9200, 8500, 0, 0, 8800, 0, 0, 7600],
    "nonce": 42,
    "sourceChain": "solana",
    "merkleRoot": "0xabc123...",
    "oracleSignature": {
        "r": "0x...",
        "s": "0x...",
        "v": 27
    },
    "payloadHash": "0x..."
}
```

### 2.3 配置与常量

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|-----|------|------|--------|
| `MAX_AGE_SECONDS` | 86400 | uint256 | 数据最大有效时间 (1天) | owner可调 |
| `CATEGORY_COUNT` | 8 | uint8 | 类别数量 | immutable |
| `SCORE_DECIMALS` | 2 | uint8 | 分数小数位 | immutable |

---

## 3. 接口定义

### 3.1 EVM Contract 接口

**合约名**: `GradienceReputationOracle`  
**标准兼容**: 查询端点语义兼容 ERC-8004 Reputation Registry（`getReputation` 返回 `(value, decimals, count)`）

#### 函数 1: `updateReputation`

| 属性 | 值 |
|------|-----|
| 调用者 | 白名单 Oracle Relayer |
| 前置条件 | `payload.nonce > nonces[agentId]` 且 ECDSA 签名有效 |
| 后置条件 | 更新 `reputations[agentId]` 和 `attestations[agentId]`，递增 nonce，emit `ReputationUpdated` |

```solidity
function updateReputation(
    ReputationPayload calldata payload,
    bytes calldata signature
) external;
```

#### 函数 2: `getReputation` (ERC-8004 兼容)

| 属性 | 值 |
|------|-----|
| 调用者 | 任何人 |
| 前置条件 | agent 至少被更新过一次 |
| 后置条件 | 无状态变更 |

```solidity
function getReputation(bytes32 agentId)
    external
    view
    returns (int128 value, uint8 decimals, uint256 count);
```

- `value` = `globalScore` 转为 int128（如 8750）
- `decimals` = `SCORE_DECIMALS`（即 2）
- `count` = `nonces[agentId]`（更新次数）

#### 函数 3: `getDetailedReputation`

```solidity
function getDetailedReputation(bytes32 agentId)
    external
    view
    returns (ReputationPayload memory);
```

#### 函数 4: `getLatestAttestation`

```solidity
function getLatestAttestation(bytes32 agentId)
    external
    view
    returns (AttestationMetadata memory);
```

#### 函数 5: `verifySignature`

```solidity
function verifySignature(
    ReputationPayload calldata payload,
    bytes calldata signature
) external view returns (bool);
```

- 使用 `oracleSigner` 地址验证 ECDSA 签名
- 签名内容：`keccak256(abi.encode(payload))`

#### 函数 6: `isFresh`

```solidity
function isFresh(bytes32 agentId, uint256 maxAge) external view returns (bool);
```

#### 事件

```solidity
event ReputationUpdated(
    bytes32 indexed agentId,
    uint16 globalScore,
    uint64 updatedAt,
    uint64 nonce,
    bytes32 merkleRoot
);

event OracleSignerUpdated(address indexed signer);
event RelayerAdded(address indexed relayer);
event RelayerRemoved(address indexed relayer);
```

### 3.2 Off-Chain REST API（Oracle Gateway）

在现有 `reputation-oracle.ts` 基础上，新增两个端点用于返回可直接上链验证的 payload+signature：

#### `GET /api/v1/oracle/reputation/:agentAddress/onchain`

返回可直接传入 `GradienceReputationOracle.updateReputation` 的参数。

**Response 200:**

```json
{
    "agentAddress": "0xabc...",
    "agentId": "12345",
    "payload": {
        "agentId": "0x0000000000000000000000000000000000000000000000000000000000003039",
        "globalScore": 8750,
        "categoryScores": [9200, 8500, 0, 0, 8800, 0, 0, 7600],
        "updatedAt": 1712390400,
        "confidence": 94,
        "nonce": 42,
        "merkleRoot": "0xabc123...",
        "sourceChain": "solana"
    },
    "signature": "0x...",
    "calculatedAt": "2026-04-11T12:00:00Z",
    "attestationURI": "ipfs://QmXyz..."
}
```

#### `GET /api/v1/oracle/reputation/:agentAddress/verify-onchain`

 Oracle 本地调用 `verifySignature` 并返回验证结果（帮助 dApp 在调用前预检）。

**Response 200:**

```json
{
    "agentAddress": "0xabc...",
    "verified": true,
    "contractAddress": "0x...",
    "chainId": 84532,
    "payload": { ... },
    "signature": "0x..."
}
```

### 3.3 Relayer 更新流程

```typescript
// apps/agent-daemon/src/reputation/evm-relayer.ts (新建)

interface RelayerConfig {
    rpcUrl: string;
    privateKey: string;
    oracleAddress: string;
    contractAddress: string;
}

export class ReputationEVMRelayer {
    async pushReputation(
        payload: ReputationPayload,
        signature: string,
    ): Promise<{ txHash: string }> {
        const tx = await this.contract.updateReputation(payload, signature);
        await tx.wait();
        return { txHash: tx.hash };
    }
}
```

---

## 4. 签名与验证流程

### 4.1 签名生成（Node.js / TypeScript）

```typescript
import { ethers } from 'ethers';

function hashPayload(payload: ReputationPayload): string {
    return ethers.solidityPackedKeccak256(
        [
            'bytes32', 'uint16', 'uint16[8]', 'uint64',
            'uint8', 'uint64', 'bytes32', 'string'
        ],
        [
            payload.agentId,
            payload.globalScore,
            payload.categoryScores,
            payload.updatedAt,
            payload.confidence,
            payload.nonce,
            payload.merkleRoot,
            payload.sourceChain,
        ],
    );
}

function signPayload(payload: ReputationPayload, signer: ethers.Wallet): string {
    const hash = hashPayload(payload);
    return signer.signingKey.sign(hash).serialized;
}
```

### 4.2 链上验证（Solidity）

```solidity
function _hashPayload(ReputationPayload memory payload) internal pure returns (bytes32) {
    return keccak256(abi.encode(
        payload.agentId,
        payload.globalScore,
        payload.categoryScores,
        payload.updatedAt,
        payload.confidence,
        payload.nonce,
        payload.merkleRoot,
        payload.sourceChain
    ));
}

function verifySignature(
    ReputationPayload calldata payload,
    bytes calldata signature
) external view returns (bool) {
    bytes32 hash = _hashPayload(payload);
    bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
    return ecrecover(ethHash, v, r, s) == oracleSigner;
}
```

---

## 5. 部署策略

| 链 | 优先级 | 合约 | 用途 |
|----|--------|------|------|
| Base Sepolia | P0 | `GradienceReputationOracle` | 测试网验证 |
| Base Mainnet | P0 | `GradienceReputationOracle` | 主生产消费链 |
| Arbitrum One | P1 | `GradienceReputationOracle` | 扩展 EVM 生态 |
| Solana | P1 | Rust Program/Pinocchio | 核心协议链（数据生成） |

**注**：Solana 上不部署等价的 EVM Contract；声誉在 Solana 生成后，由 Relayer 签名并推送至 EVM 合约。

---

## 6. 安全与信任模型

| 威胁 | 缓解方案 |
|------|----------|
| **Oracle 伪造数据** | 仅白名单 Relayer 可写链上；dApp 可本地验证签名 |
| **重放攻击** | `nonce` 严格递增，旧 payload 无法再次 `updateReputation` |
| **数据过期** | `isFresh` + `MAX_AGE_SECONDS`；dApp 可拒绝 stale 数据 |
| **Relayer 单点故障** | 多 Relayer + retry queue；链上支持多 Relayer 地址 |
| **合约升级** | 使用 UUPS 代理（可选），owner 为多签 |

---

## 7. 与现有代码的对接

### 7.1 复用/新建文件

| 文件 | 动作 | 说明 |
|------|------|------|
| `apps/agent-daemon/src/api/routes/reputation-oracle.ts` | 修改 | 新增 `/onchain` 和 `/verify-onchain` 端点 |
| `apps/agent-daemon/src/reputation/push-service.ts` | 修改 | `pushToERC8004` 后追加 `pushToEVMOracle` |
| `apps/agent-daemon/src/reputation/evm-relayer.ts` | 新建 | EVM Relayer 封装 `GradienceReputationOracle.updateReputation` |
| `apps/agent-daemon/src/reputation/proof-generator.ts` | 新建 | 生成 `ReputationPayload` + ECDSA 签名 |
| `apps/agent-layer-evm/src/GradienceReputationOracle.sol` | 不存在（已删） | 改为在 `packages/cross-chain-adapters/contracts/` 或新目录新建 |

### 7.2 合约开发路径

建议新建目录（因为 `apps/agent-layer-evm` 已删除）：

```
packages/cross-chain-adapters/contracts/GradienceReputationOracle.sol
```

或单独建立一个轻量 EVM 工具包：

```
packages/evm-oracle-contracts/
  ├── src/GradienceReputationOracle.sol
  ├── src/interfaces/IGradienceReputationOracle.sol
  ├── test/GradienceReputationOracle.t.sol
  └── foundry.toml
```

---

## 8. 验收标准

- [ ] `ReputationPayload` 和 `AttestationMetadata` 结构在 Solidity 和 TypeScript 中完全一致
- [ ] ECDSA 签名链下生成 → 链上验证流程端到端通过
- [ ] `GradienceReputationOracle.sol` 实现并通过 Foundry 单元测试
- [ ] REST API 新增 `/onchain` 和 `/verify-onchain` 端点
- [ ] Relayer 能把 Solana 聚合的 reputation 定时 push 到 Base testnet 合约
- [ ] `getReputation` 返回值语义兼容 ERC-8004（外部 dApp 可直接调用）

---

## 9. 参考文档

- `docs/multi-chain/03-reputation-oracle-spec.md` — 原始 Oracle 架构
- `protocol/design/reputation-feedback-loop.md` — 声誉反馈循环
- `apps/agent-daemon/src/integrations/erc8004-client.ts` — ERC-8004 交互
- [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004) — Agentic Commerce Standard
