# Phase 3: Technical Spec — Agent Daemon

> **输入**: Phase 2 架构文档 (`docs/agent-daemon/02-architecture.md`)
> **输出物**: 本文档
>
> ⚠️ 代码必须与本规格 100% 一致。

---

## 3.1 数据结构定义

### 3.1.1 SQLite Schema (本地持久化)

```sql
-- 任务队列
CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,          -- A2A message ID
    type          TEXT NOT NULL,             -- A2AMessageType
    payload       TEXT NOT NULL,             -- JSON 序列化的任务数据
    priority      INTEGER NOT NULL DEFAULT 0,-- 0=normal, 1=high, 2=critical
    state         TEXT NOT NULL DEFAULT 'queued',
                                             -- queued|assigned|running|completed|failed|dead|cancelled
    retries       INTEGER NOT NULL DEFAULT 0,
    max_retries   INTEGER NOT NULL DEFAULT 3,
    result        TEXT,                      -- JSON 序列化的结果 (nullable)
    error         TEXT,                      -- 错误信息 (nullable)
    assigned_agent TEXT,                     -- 执行此任务的 agent ID (nullable)
    created_at    INTEGER NOT NULL,          -- Unix ms
    updated_at    INTEGER NOT NULL,          -- Unix ms
    completed_at  INTEGER                    -- Unix ms (nullable)
);

CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at ASC);

-- 消息历史
CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,          -- A2A message ID
    direction     TEXT NOT NULL,             -- 'inbound' | 'outbound'
    from_addr     TEXT NOT NULL,             -- Solana address
    to_addr       TEXT NOT NULL,             -- Solana address
    type          TEXT NOT NULL,             -- A2AMessageType
    payload       TEXT NOT NULL,             -- JSON
    protocol      TEXT,                      -- ProtocolType (nullable)
    created_at    INTEGER NOT NULL           -- Unix ms
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Agent 配置 (已注册的本地 Agent)
CREATE TABLE IF NOT EXISTS agents (
    id            TEXT PRIMARY KEY,          -- agent 唯一标识
    name          TEXT NOT NULL,             -- 显示名称
    command       TEXT NOT NULL,             -- 启动命令 (e.g. "node agent.js")
    args          TEXT NOT NULL DEFAULT '[]',-- JSON array of args
    cwd           TEXT,                      -- 工作目录 (nullable, 默认 daemon cwd)
    env           TEXT NOT NULL DEFAULT '{}',-- JSON object of env vars
    auto_start    INTEGER NOT NULL DEFAULT 0,-- 是否随 daemon 启动
    max_restarts  INTEGER NOT NULL DEFAULT 3,
    cpu_limit     REAL,                      -- CPU 限制 (0-1, nullable)
    memory_limit  INTEGER,                   -- 内存限制 bytes (nullable)
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);

-- 键值缓存 (链上状态等)
CREATE TABLE IF NOT EXISTS cache (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,             -- JSON
    expires_at    INTEGER                    -- Unix ms (nullable, null=永不过期)
);
```

### 3.1.2 TypeScript 核心类型

```typescript
// === Daemon 状态 ===

type DaemonStatus = 'starting' | 'running' | 'stopping' | 'stopped';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type TaskState = 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'dead' | 'cancelled';

type AgentProcessState = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'failed';

// === Task ===

interface Task {
    id: string;
    type: string;
    payload: unknown;
    priority: 0 | 1 | 2;
    state: TaskState;
    retries: number;
    maxRetries: number;
    result: unknown | null;
    error: string | null;
    assignedAgent: string | null;
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
}

// === Agent 进程 ===

interface AgentConfig {
    id: string;
    name: string;
    command: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
    autoStart: boolean;
    maxRestarts: number;
    cpuLimit?: number;
    memoryLimit?: number;
}

interface AgentProcess {
    config: AgentConfig;
    state: AgentProcessState;
    pid: number | null;
    restartCount: number;
    lastStartedAt: number | null;
    lastExitCode: number | null;
    lastError: string | null;
}

// === Config ===

interface DaemonConfig {
    /** REST API 监听端口 */
    port: number;                        // default: 7420
    /** REST API 绑定地址 */
    host: string;                        // default: '127.0.0.1'
    /** Chain Hub Indexer WebSocket URL */
    chainHubUrl: string;                 // default: 'wss://indexer.gradiences.xyz/ws'
    /** Solana RPC endpoint */
    solanaRpcUrl: string;                // default: 'https://api.devnet.solana.com'
    /** SQLite 数据库路径 */
    dbPath: string;                      // default: '~/.agentd/data.db'
    /** 日志级别 */
    logLevel: 'debug' | 'info' | 'warn' | 'error'; // default: 'info'
    /** 最大并发 Agent 进程 */
    maxAgentProcesses: number;           // default: 8
    /** WebSocket 心跳间隔 ms */
    heartbeatInterval: number;           // default: 30000
    /** WebSocket 重连初始延迟 ms */
    reconnectBaseDelay: number;          // default: 1000
    /** WebSocket 重连最大延迟 ms */
    reconnectMaxDelay: number;           // default: 30000
    /** WebSocket 最大重连尝试 (0=无限) */
    reconnectMaxAttempts: number;        // default: 0
    /** API 认证 token (启动时自动生成) */
    authToken: string;                   // auto-generated
    /** 密钥存储方式 */
    keyStorage: 'keychain' | 'file';     // default: 'keychain'
}
```

### 3.1.3 常量

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|----|----|------|--------|
| DEFAULT_PORT | 7420 | number | API 端口 | configurable |
| DEFAULT_HOST | '127.0.0.1' | string | 仅本地访问 | configurable |
| HEARTBEAT_INTERVAL_MS | 30000 | number | WS 心跳间隔 | configurable |
| RECONNECT_BASE_DELAY_MS | 1000 | number | 重连初始延迟 | configurable |
| RECONNECT_MAX_DELAY_MS | 30000 | number | 重连最大延迟 | configurable |
| TASK_DEFAULT_MAX_RETRIES | 3 | number | 任务默认最大重试 | configurable |
| AGENT_HEALTH_CHECK_INTERVAL_MS | 10000 | number | Agent 健康检查间隔 | configurable |
| AGENT_HEALTH_CHECK_TIMEOUT_MS | 5000 | number | Agent 健康检查超时 | configurable |
| MAX_AGENT_PROCESSES | 8 | number | 最大并发 Agent | configurable |
| DB_FILENAME | 'data.db' | string | SQLite 文件名 | configurable |
| AUTH_TOKEN_BYTES | 32 | number | token 随机字节数 | immutable |

## 3.2 接口定义

### 3.2.1 REST API

所有请求必须携带 `Authorization: Bearer <token>` header（token 在 daemon 启动时生成并写入 `~/.agentd/auth-token`）。

---

**`GET /api/v1/status`** — 守护进程状态

```
Response 200:
{
    "status": "running",
    "connection": "connected",
    "uptime": 123456,
    "version": "0.1.0",
    "agents": { "total": 3, "running": 2 },
    "tasks": { "queued": 5, "running": 2, "completed": 42, "failed": 1 }
}
```

---

**`GET /api/v1/tasks`** — 任务列表

```
Request:
  Query: state=queued|running|completed|failed (optional, comma-separated)
         limit=50 (optional, default 50, max 200)
         offset=0 (optional)

Response 200:
{
    "tasks": [Task],
    "total": 100
}
```

---

**`GET /api/v1/tasks/:id`** — 任务详情

```
Response 200: Task

Response 404:
{ "error": "TASK_NOT_FOUND", "message": "Task not found" }
```

---

**`POST /api/v1/tasks/:id/cancel`** — 取消任务

```
Response 200:
{ "success": true }

Response 404:
{ "error": "TASK_NOT_FOUND", "message": "Task not found" }

Response 409:
{ "error": "TASK_NOT_CANCELLABLE", "message": "Task in state 'completed' cannot be cancelled" }
```

---

**`GET /api/v1/agents`** — Agent 列表

```
Response 200:
{
    "agents": [AgentProcess]
}
```

---

**`POST /api/v1/agents`** — 注册 Agent

```
Request:
{
    "id": "string",
    "name": "string",
    "command": "string",
    "args": ["string"],
    "cwd": "string?",
    "env": { "key": "value" },
    "autoStart": true,
    "maxRestarts": 3
}

Response 201: AgentConfig

Response 409:
{ "error": "AGENT_ALREADY_EXISTS", "message": "Agent with id 'x' already exists" }
```

---

**`POST /api/v1/agents/:id/start`** — 启动 Agent

```
Response 200:
{ "success": true, "pid": 12345 }

Response 404:
{ "error": "AGENT_NOT_FOUND", "message": "Agent not found" }

Response 409:
{ "error": "AGENT_ALREADY_RUNNING", "message": "Agent is already running" }
```

---

**`POST /api/v1/agents/:id/stop`** — 停止 Agent

```
Response 200:
{ "success": true }

Response 404:
{ "error": "AGENT_NOT_FOUND", "message": "Agent not found" }
```

---

**`POST /api/v1/messages/send`** — 发送 A2A 消息

```
Request:
{
    "to": "string (Solana address)",
    "type": "A2AMessageType",
    "payload": {}
}

Response 200:
{
    "success": true,
    "messageId": "string",
    "protocol": "nostr"
}

Response 502:
{ "error": "SEND_FAILED", "message": "No protocol available" }
```

---

**`GET /api/v1/messages`** — 消息历史

```
Request:
  Query: direction=inbound|outbound (optional)
         limit=50 (optional, max 200)
         offset=0 (optional)

Response 200:
{
    "messages": [Message],
    "total": 100
}
```

---

**`POST /api/v1/keys/sign`** — 签名请求

```
Request:
{
    "message": "string (base64 encoded bytes)"
}

Response 200:
{
    "signature": "string (base64)",
    "publicKey": "string (base58 Solana address)"
}

Response 403:
{ "error": "KEY_LOCKED", "message": "Keychain is locked" }
```

### 3.2.2 WebSocket Events

连接: `ws://127.0.0.1:{port}/events?token={authToken}`

事件格式（JSON）:

```typescript
interface DaemonEvent {
    event: string;
    data: unknown;
    timestamp: number;
}
```

| 事件名 | 触发时机 | data 格式 |
|--------|---------|-----------|
| `connection.changed` | 连接状态变更 | `{ state: ConnectionState, endpoint: string }` |
| `task.queued` | 新任务入队 | `Task` |
| `task.started` | 任务开始执行 | `{ taskId: string, agentId: string }` |
| `task.progress` | 任务进度更新 | `{ taskId: string, progress: number }` |
| `task.completed` | 任务完成 | `Task` |
| `task.failed` | 任务失败 | `Task` |
| `agent.started` | Agent 进程启动 | `AgentProcess` |
| `agent.stopped` | Agent 进程停止 | `{ agentId: string, exitCode: number }` |
| `agent.crashed` | Agent 进程崩溃 | `{ agentId: string, error: string }` |
| `message.received` | 收到 A2A 消息 | `A2AMessage` |

## 3.3 错误码定义

| 错误码 | 名称 | 触发条件 | HTTP 状态码 |
|--------|------|---------|------------|
| AUTH_REQUIRED | 未提供认证 token | 请求无 Authorization header | 401 |
| AUTH_INVALID | token 无效 | token 不匹配 | 401 |
| TASK_NOT_FOUND | 任务不存在 | 查询/操作不存在的 task ID | 404 |
| TASK_NOT_CANCELLABLE | 任务不可取消 | 任务已在 completed/dead/cancelled 状态 | 409 |
| AGENT_NOT_FOUND | Agent 不存在 | 查询/操作不存在的 agent ID | 404 |
| AGENT_ALREADY_EXISTS | Agent 已注册 | 注册重复 ID 的 agent | 409 |
| AGENT_ALREADY_RUNNING | Agent 已在运行 | 启动已在运行的 agent | 409 |
| AGENT_LIMIT_REACHED | Agent 数量达上限 | 启动超过 maxAgentProcesses | 429 |
| SEND_FAILED | 消息发送失败 | 无可用协议或所有协议失败 | 502 |
| KEY_LOCKED | 密钥链锁定 | OS keychain 需要解锁 | 403 |
| KEY_NOT_FOUND | 密钥不存在 | 尚未生成或导入密钥 | 404 |
| CONNECTION_LOST | 连接断开 | WebSocket 未连接 | 503 |
| INVALID_REQUEST | 请求格式错误 | zod 校验失败 | 400 |

## 3.4 状态机精确定义

### 连接状态

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| disconnected | connect() | — | connecting | 创建 WS 连接 |
| connecting | WS 'open' | — | connected | 发送 heartbeat；emit event |
| connecting | WS 'error' / timeout | — | reconnecting | 记录错误 |
| connected | WS 'close' / 'error' | — | reconnecting | emit event；启动退避计时器 |
| connected | disconnect() | — | disconnected | 关闭 WS；emit event |
| reconnecting | 退避定时器触发 | attempts < max (or max=0) | connecting | attempts++ |
| reconnecting | — | attempts >= max && max > 0 | disconnected | emit event；log error |

### 任务状态

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| queued | executor dequeue | — | assigned | UPDATE tasks SET state='assigned' |
| assigned | process spawned | — | running | UPDATE state='running' |
| running | result received | success=true | completed | UPDATE state='completed', result=... |
| running | error/timeout | retries < maxRetries | failed → queued | retries++; re-queue |
| running | error/timeout | retries >= maxRetries | dead | UPDATE state='dead', error=... |
| queued/assigned/running | cancel() | — | cancelled | UPDATE state='cancelled'; kill process if running |

## 3.5 算法与计算

### 指数退避重连

```
delay = min(baseDelay * 2^attempt, maxDelay)
jitter = random(0, delay * 0.2)
actual_delay = delay + jitter

// 示例 (base=1000, max=30000):
// attempt 0: 1000-1200ms
// attempt 1: 2000-2400ms
// attempt 2: 4000-4800ms
// attempt 3: 8000-9600ms
// attempt 4: 16000-19200ms
// attempt 5+: 30000-36000ms (capped)
```

### 任务优先级排序

```
ORDER BY priority DESC, created_at ASC

// priority 2 (critical) 先于 1 (high) 先于 0 (normal)
// 同优先级 FIFO
```

### Agent 进程健康检查

```
// 每 AGENT_HEALTH_CHECK_INTERVAL_MS 执行一次
for each running agent:
    1. 检查 process.exitCode (是否已退出)
    2. 如果 agent 注册了 health endpoint:
       GET http://127.0.0.1:{agent_port}/health (timeout: AGENT_HEALTH_CHECK_TIMEOUT_MS)
       如果 timeout 或 status != 200: mark unhealthy
    3. 如果连续 3 次 unhealthy: restart agent
```

## 3.6 安全规则

| 规则 | 实现方式 | 验证方法 |
|------|---------|---------|
| API 认证 | 启动时 crypto.randomBytes(32) 生成 token，写入 `~/.agentd/auth-token`（权限 0600），每个请求校验 | 单元测试 |
| 仅本地访问 | 默认 bind 127.0.0.1 | 集成测试 |
| 密钥不暴露 | KeyManager 接口只有 sign()，不提供 getPrivateKey() | API 审查 |
| 进程隔离 | Agent 子进程 uid/gid 降权（Linux）；ulimit 资源限制 | 集成测试 |
| 消息签名验证 | 入站 A2A 消息必须有有效 Ed25519 签名 | 单元测试 |
| SQLite 文件权限 | 创建时 chmod 0600 | 启动检查 |
| 无远程 API 暴露 | 严禁 host 配置为 0.0.0.0 | zod 校验 reject |

## 3.7 目录结构

```
apps/agent-daemon/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 入口：解析 CLI 参数，启动 daemon
│   ├── daemon.ts                   # Daemon 主类：编排所有组件
│   ├── config.ts                   # 配置加载 + zod schema
│   ├── connection/
│   │   ├── connection-manager.ts   # WebSocket 连接管理
│   │   └── heartbeat.ts           # 心跳逻辑
│   ├── messages/
│   │   ├── message-router.ts      # A2A 消息路由
│   │   └── message-store.ts       # 消息持久化
│   ├── tasks/
│   │   ├── task-queue.ts          # 任务队列 (SQLite 持久化)
│   │   └── task-executor.ts       # 任务执行器
│   ├── agents/
│   │   ├── process-manager.ts     # Agent 进程管理
│   │   └── health-checker.ts      # 健康检查
│   ├── keys/
│   │   ├── key-manager.ts         # 密钥管理接口
│   │   ├── keychain-store.ts      # OS keychain 实现
│   │   └── file-store.ts          # 文件存储后备
│   ├── storage/
│   │   ├── database.ts            # SQLite 初始化 + migrations
│   │   └── cache.ts               # 键值缓存
│   ├── api/
│   │   ├── server.ts              # Fastify 服务器
│   │   ├── routes/
│   │   │   ├── status.ts
│   │   │   ├── tasks.ts
│   │   │   ├── agents.ts
│   │   │   ├── messages.ts
│   │   │   └── keys.ts
│   │   ├── ws-events.ts           # WebSocket 事件分发
│   │   └── auth-middleware.ts     # Bearer token 校验
│   └── utils/
│       ├── logger.ts              # pino logger
│       └── errors.ts              # 错误码定义
├── tests/
│   ├── unit/
│   │   ├── connection-manager.test.ts
│   │   ├── task-queue.test.ts
│   │   ├── task-executor.test.ts
│   │   ├── process-manager.test.ts
│   │   ├── key-manager.test.ts
│   │   ├── message-router.test.ts
│   │   └── database.test.ts
│   └── integration/
│       ├── api.test.ts
│       └── daemon.test.ts
└── docs/                           # → symlink 到 docs/agent-daemon/
```

## 3.8 边界条件清单

| # | 边界条件 | 预期行为 |
|---|---------|---------|
| 1 | WebSocket 连接时 Chain Hub 不可达 | 进入 reconnecting，指数退避重试 |
| 2 | SQLite 文件被外部删除 | 启动时检测并重建表结构 |
| 3 | Agent 进程 OOM kill | ProcessManager 检测 exit code 137，标记 crashed，触发重启 |
| 4 | 同时收到 100 个任务 | 全部入队 SQLite，executor 按优先级+FIFO 逐个执行 |
| 5 | 取消一个正在运行的任务 | 发送 SIGTERM 给对应 agent 进程；等待 5s 后 SIGKILL |
| 6 | API token 文件被删除 | 下次请求全部 401；需重启 daemon 重新生成 |
| 7 | 配置文件不存在 | 使用默认配置，log warning |
| 8 | 端口已被占用 | 启动失败，明确错误提示 |
| 9 | Agent 启动命令不存在 | state → failed，log error，不重试 spawn 错误 |
| 10 | 磁盘空间不足 SQLite 写入失败 | 任务入队返回错误，daemon 继续运行 |
| 11 | 重复的消息 ID | 幂等处理，忽略重复 |
| 12 | daemon 意外崩溃后重启 | 从 SQLite 恢复 queued/assigned/running 状态的任务，重新入队 |

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型
- [x] 所有 REST API 有完整的参数、返回值、错误码定义
- [x] WebSocket 事件格式已定义
- [x] 错误码统一编号
- [x] 状态机转换条件精确
- [x] 算法（退避、排序、健康检查）有伪代码
- [x] 安全规则已映射到具体实现
- [x] 边界条件已列出 (12 个)
- [x] 目录结构已定义，可直接创建

**→ 进入 Phase 5: Test Spec**
