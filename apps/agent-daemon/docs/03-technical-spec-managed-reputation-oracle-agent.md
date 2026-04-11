# Phase 3: Technical Spec — Managed Reputation Oracle Agent

> **任务**: GRA-8
> **输入**: `docs/tasks/GRA-8.md`, Anthropic Managed Agents pattern, GRA-6/7 基础设施
> **输出**: 本技术规格文档
> **代码必须与本文档 100% 一致。**

---

## 1. 目标与范围

将 daemon 中的 reputation oracle 能力从**被动请求响应**升级为**主动自管理的长期运行代理（Managed Agent）**。本 spec 只涉及 `apps/agent-daemon/` 内的 TypeScript 实现，不新建 Solana program 或 EVM 合约。

### 1.1 必须实现

1. `ManagedReputationOracleAgent` 类，带完整状态机循环
2. SQLite 持久化：agent 检查点 + 决策日志
3. Harness：重试、超时、降级模式、人工介入边界、资源预算
4. daemon 生命周期集成：启动初始化、优雅停止
5. REST 状态查询端点（可选但推荐）

### 1.2 明确不实现

- Wormhole VAA 路径（仍保留 GRA-6 的 RelayerSignature 路径）
- 复杂的链上事件监听基础设施（MVP 用轮询，不用 WebSocket subscription）
- ZK 证明（保持 ECDSA 签名）

---

## 2. 核心设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **运行时模型** | Node.js `setInterval` + async state machine | 最简单、与 daemon 现有模式一致 |
| **持久化** | SQLite（daemon 已有 db） | 无需额外依赖，检查点轻量 |
| **失败策略** | 状态级重试 + loop 级降级 | 避免单点错误导致 agent 崩溃 |
| **人工介入** | 软边界（flag + log），不阻塞 daemon | 告警由外部系统消费，不引入 UI 依赖 |
| **数据源** | `pushService.fetchActivity()` + `engine.calculateReputation()` | 复用 GRA-7 已有能力 |
| **推送执行** | 调用 `pushService.batchPush()` | 不重复实现推送、重试、状态跟踪逻辑 |

---

## 3. 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Daemon Process                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │         ManagedReputationOracleAgent                           │  │
│  │                                                                │  │
│  │   ┌─────────┐    ┌───────────┐    ┌─────────┐                │  │
│  │   │  IDLE   │───▶│  RUNNING  │───▶│  SLEEP  │───▶ (loop)     │  │
│  │   └────▲────┘    └─────┬─────┘    └─────────┘                │  │
│  │        │               │                                      │  │
│  │        └───────────────┘                                      │  │
│  │              (on repeated failures)                             │  │
│  │               ↓                                                 │  │
│  │         ┌───────────┐                                          │  │
│  │         │ DEGRADED  │───▶ periodic full-loop probe → RUNNING   │  │
│  │         └───────────┘                                          │  │
│  │                                                                │  │
│  │   Harness: checkpoint (SQLite) │ retry │ degrade │ budget      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│                    ┌───────────────────┐                           │
│                    │   PushService     │                           │
│                    │  (existing GRA-7) │                           │
│                    └───────────────────┘                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │  SQLite (daemon db) │
                  │  • reputation_agent_state
                  │  • reputation_agent_log
                  │  • reputation_agent_budget
                  └─────────────────────┘
```

---

## 4. 数据结构

### 4.1 Agent 状态类型

顶层状态机只保留 4 个状态：`IDLE`、`RUNNING`、`SLEEP`、`DEGRADED`。

```typescript
export type AgentLoopState = 'IDLE' | 'RUNNING' | 'SLEEP' | 'DEGRADED';

// RUNNING 内部子步骤（不持久化为顶层状态）
export type RunningSubStep =
    | 'FETCH_AGENTS'
    | 'AGGREGATE'
    | 'GENERATE_PROOF'
    | 'PUSH'
    | 'VERIFY'
    | 'LOG';

export interface AgentCheckpoint {
    loopId: string;
    state: AgentLoopState;
    agentAddress?: string;
    lastNonce?: number;
    lastTxHash?: string;
    retryCount: number;
    degradedMode: boolean;
    updatedAt: string; // ISO 8601
}

export interface AgentDecisionLog {
    loopId: string;
    state: AgentLoopState;
    subStep?: RunningSubStep;
    agentAddress?: string;
    globalScore?: number;
    nonce?: number;
    txHash?: string;
    gasCostEth?: string;
    confidence?: number;
    humanReviewFlag?: boolean;
    budgetExceededFlag?: boolean;
    error?: string;
    createdAt: string;
}

export interface AgentConfig {
    enabled: boolean;
    intervalMs: number;
    maxLoopDurationMs: number;
    maxRetries: number;
    maxGasEth: number;
    dailyPushLimit: number;
    minConfidence: number;
    degradedRecoveryProbeInterval: number; // 几次 SLEEP 后尝试一次完整 loop，默认 3
}
```

### 4.2 资源预算跟踪器

```typescript
export interface DailyBudget {
    date: string; // YYYY-MM-DD
    pushCount: number;
    totalGasEth: string;
}
```

---

## 5. 状态机详细行为

### 5.1 主循环触发器

```typescript
private async runLoop(): Promise<void> {
    const loopId = crypto.randomUUID();
    const startTime = Date.now();

    this.transition('RUNNING', loopId);
    await this.saveCheckpoint(loopId);

    try {
        await this.executeRunningLoop(loopId, startTime);
    } catch (err) {
        this.consecutiveFailedLoops++;
        this.logError(loopId, 'RUNNING', err);
    }

    const nextState = this.shouldDegrade() ? 'DEGRADED' : 'SLEEP';
    this.transition(nextState, loopId);
    await this.saveCheckpoint(loopId);
}

private async executeRunningLoop(loopId: string, startTime: number): Promise<void> {
    // 1. Fetch agents
    const agents = await this.runSubStep(loopId, 'FETCH_AGENTS', () => this.fetchPendingAgents());
    if (agents.length === 0) return;

    // 2. Aggregate (per agent or batch)
    const scores = await this.runSubStep(loopId, 'AGGREGATE', () => this.aggregateScores(agents));

    // 3. Generate proofs
    const payloads = await this.runSubStep(loopId, 'GENERATE_PROOF', () => this.generateProofs(scores));

    // Guardrails: skip push if confidence too low or budget exceeded
    const filtered = this.applyGuardrails(loopId, payloads);
    if (filtered.length === 0) return;

    // 4. Push via existing PushService
    const pushResult = await this.runSubStep(loopId, 'PUSH', () => this.pushService.batchPush(filtered.map(p => p.agentAddress)));

    // 5. Verify on-chain
    await this.runSubStep(loopId, 'VERIFY', () => this.verifyPushResults(pushResult));

    // 6. Log & budget update
    await this.runSubStep(loopId, 'LOG', () => this.recordSuccess(loopId, pushResult));

    this.consecutiveFailedLoops = 0;
}
```

### 5.2 顶层状态行为

| 状态 | 触发条件 | 行为 | 下一状态 |
|------|---------|------|---------|
| `IDLE` | `setInterval` tick | 生成 `loopId`，重置 `retryCount=0` | `RUNNING` |
| `RUNNING` | 从 `IDLE` 转移 | 顺序执行 6 个子步骤（见 5.3） | 成功 → `SLEEP`；超时/重试耗尽 → `SLEEP`；连续失败 → `DEGRADED` |
| `SLEEP` | 从 `RUNNING` 或 `DEGRADED` 转移 | 等待 `intervalMs` | `IDLE` |
| `DEGRADED` | 连续 3 次 `RUNNING` 失败 | 只做 fetch + aggregate，不做 push | `SLEEP`；定时 probe 时 → `RUNNING` |

#### 降级模式恢复
- `DEGRADED` 模式下每 `degradedRecoveryProbeInterval` 个 tick（默认 3 次 = 15 min），强制进入一次完整 `RUNNING` loop
- 若该 probe loop 成功完成 push + verify，则恢复为 `IDLE`
- 否则回到 `DEGRADED`

### 5.3 RUNNING 子步骤与重试

```typescript
private async runSubStep<T>(
    loopId: string,
    subStep: RunningSubStep,
    fn: () => Promise<T>,
): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
            const result = await fn();
            this.retryCount = 0;
            return result;
        } catch (err) {
            lastErr = err;
            this.retryCount = attempt + 1;
            if (Date.now() - this.loopStartTime > this.config.maxLoopDurationMs) {
                throw new Error(`SubStep ${subStep} timed out`);
            }
        }
    }
    throw lastErr;
}
```

####  guardrails（人工介入边界）
- `confidence < minConfidence`：标记 `humanReviewFlag=true`，跳过 push，loop 继续到 LOG
- `estimatedGas > maxGasEth` 或 `dailyPushLimit` 已达：标记 `budgetExceededFlag=true`，跳过 push，loop 继续到 LOG

### 5.4 数据源

Managed Agent **不直接调用**不存在的 `evmRelayer.getReputation()`。它通过以下方式获取待更新 agents：

```typescript
private async fetchPendingAgents(): Promise<string[]> {
    // 策略 MVP：从本地 DB 或 ChainHub 查询所有近期有活动但未被推送的 agents
    // 具体实现：遍历本地 reputation 记录，对比链上 nonce / 本地缓存 nonce
    const candidates = await this.pushService.fetchActivity(''); // 或批量查询接口
    // 过滤出 nonce stale 的 agents
    return candidates.filter(/* ... */);
}
```

实际推送通过 `this.pushService.batchPush(agentAddresses)` 完成，复用 GRA-7 的全部封装逻辑。

---

## 6. 数据库 Schema

```sql
-- Agent 状态检查点（单行，每次更新覆盖）
CREATE TABLE IF NOT EXISTS reputation_agent_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_loop_id TEXT,              -- 可为 NULL（daemon 启动前未开始 loop）
    state TEXT NOT NULL,
    agent_address TEXT,
    last_nonce INTEGER,
    last_tx_hash TEXT,
    retry_count INTEGER DEFAULT 0,
    degraded_mode INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- Agent 决策日志（追加只读）
CREATE TABLE IF NOT EXISTS reputation_agent_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loop_id TEXT NOT NULL,
    state TEXT NOT NULL,
    sub_step TEXT,                     -- RunningSubStep 可选记录
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

-- 每日预算跟踪
CREATE TABLE IF NOT EXISTS reputation_agent_budget (
    date TEXT PRIMARY KEY,
    push_count INTEGER DEFAULT 0,
    total_gas_eth TEXT DEFAULT '0'
);

CREATE INDEX IF NOT EXISTS idx_reputation_agent_log_loop_id ON reputation_agent_log(loop_id);
CREATE INDEX IF NOT EXISTS idx_reputation_agent_log_agent_address ON reputation_agent_log(agent_address);
CREATE INDEX IF NOT EXISTS idx_reputation_agent_log_created_at ON reputation_agent_log(created_at);
```

---

## 7. _daemon.ts_ 集成

### 7.1 启动时初始化

在 daemon `start()` 方法中（Gateway Domain 之后，API Server 之前）：

```typescript
this.reputationOracleAgent = new ManagedReputationOracleAgent({
    config: {
        enabled: this.config.reputationAgentEnabled,
        intervalMs: this.config.reputationAgentIntervalMs,
        maxLoopDurationMs: this.config.reputationAgentMaxLoopDurationMs,
        maxRetries: this.config.reputationAgentMaxRetries,
        maxGasEth: this.config.reputationAgentMaxGasEth,
        dailyPushLimit: this.config.reputationAgentDailyPushLimit,
        minConfidence: this.config.reputationAgentMinConfidence,
        degradedRecoveryProbeInterval: 3,
    },
    pushService: this.pushService!,
    db,
});

if (this.config.reputationAgentEnabled) {
    await this.reputationOracleAgent.start();
}
```

### 7.2 停止时清理

```typescript
if (this.reputationOracleAgent) {
    await this.reputationOracleAgent.stop();
}
```

---

## 8. API 路由（可选增强）

在 `api/server.ts` 中暴露状态查询端点（通过 `reputation-oracle.ts` 或新建路由）：

```typescript
// GET /api/v1/reputation-agent/status
{
    "state": "SLEEP",
    "loopId": "...",
    "lastCheckpointAt": "2026-04-11T12:00:00Z",
    "degradedMode": false,
    "dailyPushCount": 12,
    "dailyGasEth": "0.0012"
}

// GET /api/v1/reputation-agent/logs?limit=20
[
    {
        "loopId": "...",
        "state": "PUSH_EVM",
        "agentAddress": "0xabc...",
        "globalScore": 7200,
        "txHash": "0x...",
        "createdAt": "2026-04-11T12:00:00Z"
    }
]
```

---

## 9. 错误码定义

```typescript
export const AGENT_ERR_LOOP_TIMEOUT = 'AGENT_0001';
export const AGENT_ERR_MAX_RETRIES = 'AGENT_0002';
export const AGENT_ERR_DEGRADED_MODE = 'AGENT_0003';
export const AGENT_ERR_CONFIDENCE_TOO_LOW = 'AGENT_0004';
export const AGENT_ERR_BUDGET_EXCEEDED = 'AGENT_0005';
export const AGENT_ERR_NO_AGENTS_TO_PUSH = 'AGENT_0006';
export const AGENT_ERR_CHECKPOINT_FAILED = 'AGENT_0007';
```

---

## 10. 新建/修改文件清单

| 文件路径 | 动作 | 说明 |
|----------|------|------|
| `src/reputation/push-service.ts` | 修改 | 增加公共 getter：`proofGenerator`、`evmRelayer`、`engine`、`chainHubClient`、`fetchActivity` |
| `src/reputation/managed-oracle-agent.ts` | 新建 | `ManagedReputationOracleAgent` 核心实现 |
| `src/reputation/managed-oracle-agent.db.ts` | 新建 | SQLite DAO（checkpoint + log + budget） |
| `src/reputation/managed-oracle-agent.types.ts` | 新建 | 类型定义 |
| `src/reputation/index.ts` | 修改 | 导出 managed agent |
| `src/config.ts` | 修改 | 新增 7 个 `reputationAgent*` 配置项 |
| `src/daemon.ts` | 修改 | 初始化 / 停止 agent |
| `src/api/routes/reputation-oracle.ts` | 修改 | 新增 `/reputation-agent/status` 和 `/logs` |
| `src/api/server.ts` | 修改 | 注入 `reputationOracleAgent`（若暴露路由需要） |
| `src/storage/database.ts` | 修改 | 初始化 `reputation_agent_*` 表 |

---

## 11. 测试策略

### 单元测试（`src/reputation/__tests__/managed-oracle-agent.test.ts`）

1. **状态机测试**: 正常 loop `IDLE → RUNNING → SLEEP`
2. **子步骤重试测试**: `PUSH` 子步骤失败 3 次后当前 loop 失败，进入 `SLEEP`
3. **降级测试**: 连续 3 次 `RUNNING` 失败后进入 `DEGRADED`；probe 成功一次后恢复 `IDLE`
4. **预算测试**: 超出 `dailyPushLimit` 后跳过 push，记录 `budgetExceededFlag`
5. **信心度测试**: `confidence < minConfidence` 时跳过 push，记录 `humanReviewFlag`
6. **检查点测试**: daemon 崩溃重启后从 SQLite 恢复状态
7. **PushService 复用测试**: Managed Agent 调用 `pushService.batchPush()`，不重复实现推送逻辑

### 集成测试

- agent 启动后 1 个 tick 内完成完整 loop（使用 mock evmRelayer）
- REST `/reputation-agent/status` 返回正确状态

---

## 12. 验收标准

- [x] 状态机定义完整（4 个顶层状态 + RUNNING 内部 6 个子步骤）
- [x] 数据库 Schema 精确（3 张表 + 索引），包含 flag 字段
- [x] Harness 4 要素覆盖：checkpoint、retry、human-review boundary、budget
- [x] PushService 复用设计明确
- [x] daemon 生命周期集成方式明确（合法依赖注入）
- [x] 测试策略已定义
- [ ] 代码实现后所有测试通过
- [ ] build 零失败

---

## 参考

- Anthropic: *Managed Agents* pattern (checkpoints, guardrails, resource budgets)
- `docs/tasks/GRA-8.md`
- `apps/agent-daemon/docs/03-technical-spec-evm-to-solana-reputation-sync.md`
- `apps/agent-daemon/docs/06-implementation-reputation-oracle-interface.md`
