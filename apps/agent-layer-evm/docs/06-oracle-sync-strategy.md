# Oracle 多链同步策略

> **文档状态**: Implementation  
> **创建日期**: 2026-04-07  
> **关联文档**: `03-technical-spec.md`, `pre-implementation-review.md`  
> **优先级**: P1

---

## 1. 设计决策

### 1.1 接受最终一致性

Gradience Reputation Oracle 采用 **最终一致性（Eventual Consistency）** 模型：

- **最大可接受延迟**: 10 分钟
- **更新频率**: 每 5 分钟一个聚合窗口
- **冲突解决**: 以最新 `lastUpdatedAt` 为准；同时间戳以签名 Oracle 的链上提交顺序为准

这意味着在极短时间内，Solana 与 EVM 各链的声誉读数可能存在差异。UI / SDK 必须通过 `freshness` 字段向用户披露数据时效性，而非隐藏延迟。

### 1.2 为什么不选择强一致性？

| 方案                     | 优点                       | 缺点                                       | 结论     |
| ------------------------ | -------------------------- | ------------------------------------------ | -------- |
| **强一致性**（跨链共识） | 数据零差异                 | 需要 L2 消息桥或 ZK 同步层，延迟高、成本高 | 过度工程 |
| **最终一致性**           | 低延迟、低成本、水平可扩展 | 短时间窗口内多链读数可能不一致             | **选中** |

---

## 2. 链上数据结构

### 2.1 `GradienceReputationFeed.sol`

每条 EVM 链部署独立的 `GradienceReputationFeed` 合约：

```solidity
struct AggregatedReputation {
    uint16 globalScore;
    uint16[8] categoryScores;
    uint64 lastUpdatedAt;   // <-- 更新时间戳（秒级 Unix）
    bytes32 merkleRoot;     // <-- 可选：批量验证用的 Merkle 根
    address oracle;         // <-- 提交此次更新的 Oracle 地址
    bool exists;
}
```

- `oracle`: 由合约 `owner` 通过 `setOracle()` 设置。只有当前 `oracle` 可调用 `updateReputation()`。
- `lastUpdatedAt`: 每次 `updateReputation` 自动写入 `block.timestamp`。
- `exists`: 标识该地址是否已有有效声誉记录。

### 2.2 多链部署地址策略

使用 `DeterministicDeployer` + CREATE2 保证跨链同地址：

```
salt = keccak256("GRADIENCE_V1_GradienceReputationFeed")
```

各链的 `GradienceReputationFeed` 实例在相同 EOA 工厂地址 + 相同 salt + 相同 initcode 条件下，生成完全一致的合约地址。

---

## 3. SDK `freshness` 字段

### 3.1 类型定义

```typescript
export interface ReputationApi {
    agent: string;
    global_avg_score: number;
    global_win_rate: number;
    global_completed: number;
    global_total_applied: number;
    total_earned: number;
    updated_slot: number;
    last_updated_at?: number;
    oracle?: string;
    freshness?: 'fresh' | 'stale' | 'unknown';
}
```

### 3.2 `freshness` 计算规则

```typescript
function calculateFreshness(lastUpdatedAt?: number): 'fresh' | 'stale' | 'unknown' {
    if (lastUpdatedAt == null) return 'unknown';
    const ageSeconds = Date.now() / 1000 - lastUpdatedAt;
    if (ageSeconds <= 600) return 'fresh'; // ≤ 10 min
    return 'stale';
}
```

### 3.3 UI 提示建议

| freshness | 颜色 | 提示文案                           |
| --------- | ---- | ---------------------------------- |
| `fresh`   | 绿色 | "Reputation up-to-date"            |
| `stale`   | 橙色 | "Reputation data is >10 min old"   |
| `unknown` | 灰色 | "Reputation freshness unavailable" |

---

## 4. Oracle 更新流程

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Solana Indexer │     │  EVM Subgraph    │     │  Off-Chain DB       │
│  (Rust)         │     │  (The Graph)     │     │  (Aggregation Job)  │
└────────┬────────┘     └────────┬─────────┘     └──────────┬──────────┘
         │                       │                          │
         └───────────────────────┼──────────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Aggregation Engine    │
                    │  (Score Calculation)   │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │  Proof / Signature     │
                    │  (noble-ed25519/ECDSA) │
                    └───────────┬────────────┘
                                ▼
                    ┌────────────────────────┐
                    │  GradienceReputationFeed│
                    │  updateReputation()     │
                    │  (per EVM chain)        │
                    └────────────────────────┘
```

1. **Data Adapter** 从 Solana RPC、EVM RPC、Subgraph 拉取原始声誉事件。
2. **Aggregation Engine** 计算统一分数、去重、处理冲突。
3. **Proof Generator** 对聚合结果签名（当前阶段使用托管 Oracle ECDSA 私钥）。
4. **On-Chain Feed Writer** 调用各链 `GradienceReputationFeed.updateReputation()`，写入 `lastUpdatedAt` 和 `oracle`。

---

## 5. 超时与降级策略

| 场景                  | 策略                                                      |
| --------------------- | --------------------------------------------------------- |
| Oracle 5 分钟未更新   | 标记 `freshness = 'fresh'`，但 UI 可显示 "Syncing..."     |
| Oracle >10 分钟未更新 | 标记 `freshness = 'stale'`，并触发 PagerDuty/Datadog 告警 |
| Oracle 私钥泄露/异常  | `owner`（Multisig）调用 `setOracle()` 轮换到新地址        |
| 某条链 RPC 不可用     | 跳过该链更新，其他链继续；等 RPC 恢复后补同步             |

---

## 6. 安全与权限

- **Owner**: 部署时设置为 3/5 Multisig，负责 `setOracle()` 和紧急升级。
- **Oracle**: 单一受信地址，负责提交声誉数据。未来演进为多签 Oracle 委员会。
- **合约不可升级**: `GradienceReputationFeed` 为直接部署（非代理）。如需升级，Multisig 部署新合约并更新 SDK 地址表。

---

## 8. 跨链重放与测试网隔离

### 8.1 chainId 验证

`GradienceReputationFeed.updateReputation()` 要求调用者传入 `chainId`，合约内验证 `chainId == block.chainid`。这防止以下两类错误：

- Oracle 配置错误，将测试网签名数据提交到主网；
- 同一条链上的重复提交不会跨链生效。

### 8.2 Reputation proof 的消耗语义

Reputation proof **不是一次性凭证**，而是**可验证的声明（attestation）**。同一 Agent 的合法 reputation proof 允许在多条 EVM 链上分别使用。

- 如需“一次性消耗”语义，需引入跨链状态 oracle（不在当前 P0/P1 范围）。
- 当前设计下，消费者应关注 `lastUpdatedAt` 的新鲜度，而非 proof 的重放次数。

---

## 7. 监控指标

| 指标                        | 目标                     |
| --------------------------- | ------------------------ |
| `oracle_update_lag_seconds` | < 600s (p99)             |
| `cross_chain_address_match` | 100% (通过 CREATE2 保证) |
| `reputation_feed_hit_rate`  | > 99.9%                  |
| `oracle_tx_failure_rate`    | < 0.1%                   |
