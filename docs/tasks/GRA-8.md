---
linear-id: GRA-8
title: '[Daemon] ReputationOracleAgent 改成 Managed Agent 循环'
status: todo
priority: P1
project: 'Agent Daemon'
created: 2026-04-11
assignee: 'Code Agent'
tags: [task, p1, daemon, reputation, managed-agent, agent-loop]
depends-on: [GRA-6, GRA-7]
---

# GRA-8: ReputationOracleAgent 改成 Managed Agent 循环

## 目标

把 `ReputationOracleAgent` 从**被动 API 响应器**改造成**自主循环运行的 Managed Agent**，使其能够：

1. 在没有外部 HTTP 请求的情况下，按固定周期主动轮询 EVM / Solana 声誉状态
2. 自主完成「聚合 → 生成证明 → 推送 → 验证 → 记录日志」的完整闭环
3. 具备故障恢复、预算限制和可观测的决策轨迹

## 现状

- `reputation-oracle.ts` 只暴露 REST API，推送 reputation 依赖外部调用 `/push`
- `ReputationPushService`（GRA-7）已接入 daemon lifecycle，但**只在被显式调用时**执行推送
- EVM 链上的 `GradienceReputationOracle` 合约数据可能因缺少主动触发而 stale
- 没有长期运行的 agent 负责 reputation 系统的**自维护**

## 实现要求

### 1. Managed Agent 循环（核心）

引入 `ManagedReputationOracleAgent`，主循环逻辑简化为 **4 个顶层状态**：

```
IDLE → RUNNING → SLEEP → IDLE
              ↘ DEGRADED
```

`RUNNING` 内部顺序执行以下子步骤（不单独作为持久化状态）：
1. **fetch pending agents**：调用 `pushService.fetchActivity(agentAddress)` 获取待更新 agents
2. **aggregate**：`engine.calculateReputation(activity)` 计算分数
3. **generate proof**：`proofGenerator.generateSignedPayload()` 生成签名 payload
4. **push**：调用已有的 `pushService.batchPush(agentAddresses)` 完成推送（复用 Solana/ERC-8004/EVM Oracle 逻辑）
5. **verify**：读取链上 nonce 或调用 `evmRelayer.verifyOnChain()` 确认推送成功
6. **log**：将决策写入 `reputation_agent_log`

持久化 checkpoint **只在顶层状态转移时写入 SQLite**（`IDLE→RUNNING` 和 `RUNNING→SLEEP/DEGRADED`），避免高频写。

| 状态 | 行为 | 出错时转移 |
|------|------|-----------|
| `IDLE` | 等待 `setInterval` 触发；生成 `loopId` | - |
| `RUNNING` | 顺序执行上述 6 个子步骤 | 子步骤重试 ≤3 次后 → `SLEEP` |
| `SLEEP` | 等待下一次 tick（默认 5 min） | - |
| `DEGRADED` | 只执行 fetch + aggregate，不做 push | 定时尝试完整 loop → `RUNNING` |

### 2. Harness / Guardrails（Anthropic Managed Agent 模式映射）

#### 2.1 状态检查点（Checkpointing）
- 只在顶层状态变化时写入 `reputation_agent_state` 表：
  - `IDLE → RUNNING` 时记录 loop 开始
  - `RUNNING → SLEEP/DEGRADED` 时记录结果
- daemon 重启后读取检查点，决定从 `IDLE` 还是 `DEGRADED` 恢复

#### 2.2 失败重试
- `RUNNING` 内部的单个子步骤失败时，原地重试（max 3）
- 单次 `RUNNING` 总耗时超过 `MAX_LOOP_DURATION_MS`（默认 2 min）则强制转移到 `SLEEP`
- 连续失败 3 个完整 loop 后，agent 进入 `DEGRADED` 模式（只读查询，停止推送）

#### 2.3 人工介入边界
- 当 `proofGenerator` 返回的 `confidence < minConfidence`（默认 50）时，跳过 push，记录 `human_review_flag=true`
- 当 EVM push 的预计 gas cost > `MAX_GAS_COST_ETH`（默认 0.01 ETH）时，跳过 push，记录 `budget_exceeded_flag=true`
- 人工介入事件通过 logger 上报，不阻塞 daemon

#### 2.4 资源预算限制
- 每 loop 最大 gas 预算可配置（环境变量 `AGENTD_REPUTATION_AGENT_MAX_GAS_ETH`）
- 每 24h 最大推送次数限制（默认 288 次 = 每 5 min 一次）
- 超出预算时 loop 跳过 push 阶段，只保留 fetch + aggregate
- `pushService.push()` 成功后，由 Managed Agent 读取 gas cost 并更新 `reputation_agent_budget`

### 3. 配置项（新增到 `DaemonConfig`）

```typescript
reputationAgentEnabled: boolean;        // default: true
reputationAgentIntervalMs: number;      // default: 300000 (5 min)
reputationAgentMaxLoopDurationMs: number; // default: 120000
reputationAgentMaxRetries: number;      // default: 3
reputationAgentMaxGasEth: number;      // default: 0.01
reputationAgentDailyPushLimit: number; // default: 288
reputationAgentMinConfidence: number;  // default: 50
```

对应环境变量前缀：`AGENTD_REPUTATION_AGENT_*`

### 4. 数据库 Schema（新增）

```sql
CREATE TABLE reputation_agent_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_loop_id TEXT,
    state TEXT NOT NULL,
    agent_address TEXT,
    last_nonce INTEGER,
    last_tx_hash TEXT,
    retry_count INTEGER DEFAULT 0,
    degraded_mode INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE TABLE reputation_agent_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loop_id TEXT NOT NULL,
    state TEXT NOT NULL,
    agent_address TEXT,
    global_score INTEGER,
    nonce INTEGER,
    tx_hash TEXT,
    gas_cost_eth TEXT,
    confidence INTEGER,
    human_review_flag INTEGER DEFAULT 0,
    budget_exceeded_flag INTEGER DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE reputation_agent_budget (
    date TEXT PRIMARY KEY,
    push_count INTEGER DEFAULT 0,
    total_gas_eth TEXT DEFAULT '0'
);
```

### 5. 集成点

- `daemon.ts` 启动时初始化 `ManagedReputationOracleAgent`
- `daemon.ts` stop 时优雅关闭 agent loop（等待当前 iteration 完成或超时中断）
- 复用已有的 `ReputationPushService`（核心推送逻辑）
- `PushService` 新增公共 getter 以便 Managed Agent 读取 `proofGenerator`、`evmRelayer`、`engine` 等依赖
- 可选：在 API server 暴露 `/api/v1/reputation-agent/status` 和 `/logs`

## 验收标准

- [ ] `ManagedReputationOracleAgent` 启动后进入自主循环，无需外部 HTTP 触发
- [ ] daemon 重启后能从 SQLite 检查点恢复，不重复推送同一 nonce
- [ ] 每个 loop 的关键状态转移写入 `reputation_agent_log`
- [ ] 连续失败 3 次后自动进入 `DEGRADED` 模式
- [ ] `confidence < 50` 或 `gas > maxGas` 时触发 human-review flag 并暂停 push
- [ ] `agent-daemon` build 和单元测试全绿
- [ ] Phase 3/4/5 文档完成

## 相关文件

- `apps/agent-daemon/src/daemon.ts`
- `apps/agent-daemon/src/config.ts`
- `apps/agent-daemon/src/reputation/push-service.ts`
- `apps/agent-daemon/src/reputation/proof-generator.ts`
- `apps/agent-daemon/src/reputation/evm-relayer.ts`
- `apps/agent-daemon/src/storage/database.ts`
- `apps/agent-daemon/src/api/server.ts`

## 相关任务

- [[GRA-6]] `UpdateReputationFromEvm` instruction（Solana program 侧）
- [[GRA-7]] `ReputationPushService` 接入 daemon lifecycle
