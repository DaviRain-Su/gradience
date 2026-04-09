# Phase 3: Technical Spec — Workflow Execution Gateway

> **输入**: `docs/02-architecture-workflow-execution-gateway.md`
> **日期**: 2026-04-07
> **版本**: v0.1
> ⚠️ **代码必须与本文档 100% 一致。**

---

## 3.1 数据结构定义

### 3.1.1 链下核心数据结构

#### `PurchaseEvent`

```typescript
interface PurchaseEvent {
    /** Marketplace program 的 purchase 账户 PDA */
    purchaseId: string;
    /** Buyer 的 Solana 地址 */
    buyer: string;
    /** 购买的 workflow 的链上地址/PDA */
    workflowId: string;
    /** 支付金额（lamports 或 token units） */
    amount: bigint;
    /** 交易签名 */
    txSignature: string;
    /** 区块时间戳（秒） */
    blockTime: number;
    /** 可选：buyer 指定的执行 agent */
    preferredAgent?: string;
}
```

#### `GatewayPurchaseRecord`

```typescript
interface GatewayPurchaseRecord {
    /** Primary key */
    purchaseId: string;
    buyer: string;
    workflowId: string;
    amount: string; // bigint as string for SQLite
    txSignature: string;
    blockTime: number;
    preferredAgent?: string;

    /** Gateway-assigned state */
    status: PurchaseStatus;
    /** Arena taskId (u64 as string) */
    taskId?: string;
    /** Agent that applied for the task */
    agentId?: string;
    /** VEL execution result hash */
    resultHash?: string;
    /** Settlement transaction signature */
    settlementTx?: string;
    /** Final score given by judge (from bridge) */
    score?: number;
    /** Number of retry attempts */
    attempts: number;
    /** ISO 8601 timestamp */
    createdAt: string;
    updatedAt: string;
}
```

#### `PurchaseStatus` (string union)

```typescript
type PurchaseStatus =
    | 'PENDING'
    | 'TASK_CREATING'
    | 'TASK_CREATED'
    | 'APPLIED'
    | 'EXECUTING'
    | 'SETTLING'
    | 'SETTLED'
    | 'FAILED';
```

#### `PostTaskParams`

```typescript
interface PostTaskParams {
    taskId: bigint;
    evalRef: string;
    deadline: bigint;
    judgeDeadline: bigint;
    judgeMode: number; // 0 = single judge
    judge: string;
    category: number;
    minStake: bigint;
    reward: bigint;
}
```

#### `GatewayConfig`

```typescript
interface GatewayConfig {
    /** Marketplace program ID on Solana */
    marketplaceProgramId: string;
    /** Agent Arena program ID */
    arenaProgramId: string;
    /** RPC endpoint for logSubscribe and transactions */
    rpcEndpoint: string;
    /** Path to SQLite DB file */
    dbPath: string;
    /** Wallet adapter for posting tasks (system poster) */
    posterWallet: WalletAdapter;
    /** Wallet adapter for applying (agent) */
    agentWallet: WalletAdapter;
    /** Default judge address (usually same as poster or system evaluator) */
    defaultJudge: string;
    /** How often to poll for new logs (ms) */
    pollIntervalMs: number;
    /** Max retries per purchase before marking FAILED */
    maxRetries: number;
    /** Delay between retries (ms) */
    retryDelayMs: number;
}
```

---

### 3.1.2 数据库 Schema

```sql
-- Gateway purchase records
CREATE TABLE IF NOT EXISTS gateway_purchases (
    purchase_id TEXT PRIMARY KEY,
    buyer TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time INTEGER NOT NULL,
    preferred_agent TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    task_id TEXT,
    agent_id TEXT,
    result_hash TEXT,
    settlement_tx TEXT,
    score INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Index for fast status queries
CREATE INDEX IF NOT EXISTS idx_status ON gateway_purchases(status);
CREATE INDEX IF NOT EXISTS idx_tx_signature ON gateway_purchases(tx_signature);
CREATE INDEX IF NOT EXISTS idx_task_id ON gateway_purchases(task_id);
```

---

### 3.1.3 配置与常量

| 常量名                                | 值        | 类型       | 说明                                             | 可变性       |
| ------------------------------------- | --------- | ---------- | ------------------------------------------------ | ------------ |
| `DEFAULT_POLL_INTERVAL_MS`            | `15000`   | number     | 日志轮询间隔                                     | configurable |
| `DEFAULT_MAX_RETRIES`                 | `3`       | number     | 每个 purchase 最大重试次数                       | configurable |
| `DEFAULT_RETRY_DELAY_MS`              | `5000`    | number     | 重试基础延迟                                     | configurable |
| `POST_TASK_DEADLINE_OFFSET_SEC`       | `3600`    | number     | task deadline = now + 1h                         | immutable    |
| `POST_TASK_JUDGE_DEADLINE_OFFSET_SEC` | `7200`    | number     | judge deadline = now + 2h                        | immutable    |
| `MIN_STAKE_LAMPORTS`                  | `0`       | bigint     | 当前最小质押                                     | immutable    |
| `EVENT_DISCRIMINATOR`                 | `[0x...]` | Uint8Array | Marketplace `purchase` instruction discriminator | immutable    |

---

## 3.2 接口定义

### 3.2.1 `MarketplaceEventListener`

```typescript
export interface MarketplaceEventListener {
    /** 启动监听循环 */
    start(onEvent: (event: PurchaseEvent) => void | Promise<void>): void;
    /** 停止监听 */
    stop(): Promise<void>;
    /** 当前是否正在运行 */
    isRunning(): boolean;
}
```

### 3.2.2 `WorkflowExecutionGateway`

```typescript
export interface WorkflowExecutionGateway {
    /**
     * 处理一个新的 purchase 事件
     * @param event — 解析后的 PurchaseEvent
     * @throws GatewayError — 插入/转换失败
     */
    processPurchase(event: PurchaseEvent): Promise<void>;

    /**
     * 手动重试一个失败的 purchase
     * @param purchaseId — purchase PDA
     * @returns — 是否成功发起重试
     * @throws GatewayError — purchase not found or not retryable
     */
    retry(purchaseId: string): Promise<boolean>;

    /**
     * 获取 purchase 完整记录
     */
    getStatus(purchaseId: string): Promise<GatewayPurchaseRecord | null>;
}
```

### 3.2.3 `GatewayStore`

```typescript
export interface GatewayStore {
    insert(record: GatewayPurchaseRecord): void;
    update(purchaseId: string, patch: Partial<GatewayPurchaseRecord>): void;
    getByPurchaseId(purchaseId: string): GatewayPurchaseRecord | null;
    getByTxSignature(txSignature: string): GatewayPurchaseRecord | null;
    getByTaskId(taskId: string): GatewayPurchaseRecord | null;
    listByStatus(status: PurchaseStatus, limit?: number): GatewayPurchaseRecord[];
}
```

### 3.2.4 `ArenaTaskFactory`

```typescript
export interface ArenaTaskFactory {
    /**
     * 从 purchase 记录构造 Arena post_task 参数
     * @param record — 已持久化的 purchase 记录
     * @param nextTaskId — 从 Arena config 获取的下一个 taskId
     * @returns — PostTaskParams
     */
    buildPostTaskParams(record: GatewayPurchaseRecord, nextTaskId: bigint): PostTaskParams;
}
```

### 3.2.5 REST API

#### `GET /gateway/purchases/:purchaseId`

**Response 200:**

```json
{
    "purchaseId": "abc...",
    "buyer": "8uAP...",
    "workflowId": "def...",
    "amount": "10000000",
    "txSignature": "5FoB...",
    "status": "SETTLED",
    "taskId": "9",
    "agentId": "3DKZ...",
    "resultHash": "a3f2...",
    "settlementTx": "4EAi...",
    "score": 100,
    "attempts": 1,
    "createdAt": "2026-04-07T06:00:00.000Z",
    "updatedAt": "2026-04-07T06:05:00.000Z"
}
```

**Response 404:**

```json
{ "error": "NOT_FOUND", "message": "Purchase not found" }
```

#### `POST /gateway/purchases/:purchaseId/retry`

**Response 200:**

```json
{ "success": true }
```

**Response 400:**

```json
{ "error": "NOT_RETRYABLE", "message": "Purchase status is SETTLED" }
```

---

## 3.3 错误码定义

| 错误码    | 名称                          | 触发条件                                   | 用户提示                             |
| --------- | ----------------------------- | ------------------------------------------ | ------------------------------------ |
| `GW_0001` | `GATEWAY_PURCHASE_EXISTS`     | 插入时发现 purchase_id 已存在              | Duplicate purchase ignored           |
| `GW_0002` | `GATEWAY_PURCHASE_NOT_FOUND`  | 查询/重试时找不到记录                      | Purchase record not found            |
| `GW_0003` | `GATEWAY_INVALID_EVENT`       | EventListener 解析出的数据结构缺少必填字段 | Invalid marketplace event            |
| `GW_0004` | `GATEWAY_POST_TASK_FAILED`    | `sdk.task.post()` 抛出错误或返回失败       | Failed to create arena task          |
| `GW_0005` | `GATEWAY_APPLY_FAILED`        | `sdk.task.apply()` 失败                    | Agent failed to apply for task       |
| `GW_0006` | `GATEWAY_EXECUTION_FAILED`    | VEL orchestrator 执行失败                  | Workflow execution failed            |
| `GW_0007` | `GATEWAY_SETTLEMENT_FAILED`   | Bridge settlement 最终失败                 | On-chain settlement failed           |
| `GW_0008` | `GATEWAY_NOT_RETRYABLE`       | 尝试重试一个非 FAILED 状态的 purchase      | Purchase is not in a retryable state |
| `GW_0009` | `GATEWAY_STORE_ERROR`         | SQLite 操作失败                            | Database error                       |
| `GW_0010` | `GATEWAY_TASK_ID_UNAVAILABLE` | 无法从 Arena config 获取 nextTaskId        | Cannot determine next task id        |

---

## 3.4 状态机精确定义

| 当前状态        | 触发动作                       | 条件                   | 新状态          | 副作用                              |
| --------------- | ------------------------------ | ---------------------- | --------------- | ----------------------------------- |
| `PENDING`       | `processPurchase`              | event 有效             | `TASK_CREATING` | `store.insert()`                    |
| `TASK_CREATING` | `sdk.task.post()`              | success                | `TASK_CREATED`  | `store.update(taskId)`              |
| `TASK_CREATING` | `sdk.task.post()`              | fail                   | `FAILED`        | `store.update(attempts++)`          |
| `TASK_CREATED`  | `autoApplicant.apply()`        | success                | `APPLIED`       | `store.update(agentId)`             |
| `TASK_CREATED`  | timeout / apply fail           | after 60s              | `FAILED`        | `store.update(attempts++)`          |
| `APPLIED`       | `gateway.startExecution()`     | —                      | `EXECUTING`     | `store.update(status)`              |
| `EXECUTING`     | `orchestrator.runAndSettle()`  | success                | `SETTLING`      | —                                   |
| `EXECUTING`     | `orchestrator.runAndSettle()`  | fail                   | `FAILED`        | `store.update(attempts++)`          |
| `SETTLING`      | `bridge.settleWithReasonRef()` | success                | `SETTLED`       | `store.update(settlementTx, score)` |
| `SETTLING`      | `bridge.settleWithReasonRef()` | fail                   | `FAILED`        | `store.update(attempts++)`          |
| `FAILED`        | `retry()`                      | attempts < maxRetries  | `TASK_CREATING` | `store.update(attempts++)`          |
| `FAILED`        | `retry()`                      | attempts >= maxRetries | `FAILED`        | throw `GW_0008`                     |

---

## 3.5 算法与计算

### 3.5.1 `logSubscribe` 过滤逻辑

```typescript
function createLogFilter(programId: string, discriminator: Uint8Array): LogsFilter {
    return {
        mentionsAccountsOrProgram: programId,
        // 在收到日志后，用 discriminator 匹配 instruction data 的前 8 bytes
    };
}
```

实际实现中，由于 Solana RPC `logsSubscribe` 不直接暴露 instruction data，我们将：

1. 订阅所有包含 `programId` 的交易日志
2. 对每个 signature，调用 `connection.getTransaction(sig, { commitment: 'confirmed' })`
3. 遍历 transaction message 的 instructions
4. 检查 `instruction.programId === programId` 且 `instruction.data.slice(0, 8)` 匹配 discriminator
5. 用 borsh/codama 解码 instruction data 得到 `PurchaseEvent`

> **注意**: 为了效率，使用 `lastProcessedSignature` 机制避免重复拉取。

### 3.5.2 `evalRef` 构造规则

```typescript
function buildEvalRef(workflowId: string, purchaseId: string): string {
    return `workflow://${workflowId}?purchase=${purchaseId}`;
}
```

### 3.5.3 `nextTaskId` 获取

```typescript
async function getNextTaskId(sdk: GradienceSDK): Promise<bigint> {
    const config = await sdk.config.get();
    if (!config) throw new GatewayError('GW_0010', 'Arena config account not found');
    return config.taskCount;
}
```

---

## 3.6 安全规则

| 规则             | 实现方式                                                  | 验证方法                                        |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------- |
| 防止伪造事件     | `getTransaction` 拉取完整 tx，验证 `meta.err === null`    | 单元测试：提供失败 tx 应被拒绝                  |
| 防止重复处理     | SQLite `UNIQUE(tx_signature)` + `insert` catch conflict   | 单元测试：同一 signature 插入两次只产生一条记录 |
| 状态非法转换拦截 | StateMachine 只允许上述表格中的转换，其余 throw `GW_0008` | 单元测试：每对非法转换                          |
| 无权限调用 API   | Gateway API 复用 daemon 已有的 auth middleware            | 集成测试：未授权请求返回 401                    |

---

## 3.7 目录结构与文件命名

```
apps/agent-daemon/src/gateway/
├── index.ts                    # 公开导出 Gateway 类和类型
├── gateway.ts                  # WorkflowExecutionGateway 实现
├── state-machine.ts            # PurchaseStateMachine 实现
├── store.ts                    # better-sqlite3 GatewayStore 实现
├── event-listener.ts           # MarketplaceEventListener 实现
├── arena-factory.ts            # ArenaTaskFactory 实现
├── auto-applicant.ts           # AgentAutoApplicant 实现
├── types.ts                    # 所有 Gateway 类型定义
├── errors.ts                   # GatewayError + 错误码
└── __tests__/
    ├── store.test.ts
    ├── state-machine.test.ts
    ├── event-listener.test.ts
    ├── gateway.test.ts
    └── integration.test.ts

apps/agent-daemon/src/api/routes/gateway.ts   # REST API 路由
apps/agent-daemon/scripts/e2e-gateway-devnet.mjs  # Devnet E2E 脚本
```

---

## 3.8 边界条件清单

| #   | 边界条件                                      | 预期行为                                                                            | 备注               |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| 1   | `purchaseId` 重复插入                         | 忽略或更新现有记录，不抛异常                                                        | 幂等性             |
| 2   | `nextTaskId` 被其他并发进程抢占               | Gateway 使用自己读取时的 taskCount；如果 post_task 因 taskId 冲突失败，自动重试一次 | race condition     |
| 3   | Agent apply 后长时间不 submit                 | Gateway 在 120s 超时后标记 FAILED，可重试                                           | 配置参数           |
| 4   | VEL 执行成功但 bridge settlement 失败         | 进入 FAILED，retry 会从 TASK_CREATING 重新开始                                      | 完整重试           |
| 5   | RPC 断开导致 event listener 停止              | 自动指数退避重连，最长间隔 60s                                                      | 容错               |
| 6   | Database 文件被外部删除                       | 启动时自动重新建表，丢失的历史记录通过链上重扫描恢复                                | 自愈               |
| 7   | `preferredAgent` 未指定                       | 使用 `config.agentWallet` 作为默认执行 agent                                        | 默认策略           |
| 8   | Marketplace 购买金额为 0                      | 仍然创建 Arena task，reward = 0                                                     | 免费 workflow 边界 |
| 9   | `getTransaction` 因 RPC 缓存延迟返回 null     | 延迟 5s 后重试，最多 3 次                                                           | RPC 容错           |
| 10  | GatewayAPI 查询一个正在 EXECUTING 的 purchase | 返回当前状态，所有后续字段为 null/undefined                                         | 部分数据           |

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型
- [x] 所有接口有完整的参数、返回值、错误码定义
- [x] 错误码统一编号，无遗漏
- [x] 状态机转换条件精确，无歧义
- [x] 所有计算有伪代码/公式
- [x] 安全规则已从架构文档映射到具体实现
- [x] 目录结构已定义
- [x] 边界条件已列出（≥10 个）

**验收通过后，进入 Phase 4: Task Breakdown →**
