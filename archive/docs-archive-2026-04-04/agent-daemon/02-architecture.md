# Phase 2: Architecture — Agent Daemon

> **输入**: Phase 1 PRD (`docs/agent-daemon/01-prd.md`)
> **输出物**: 本文档

---

## 2.1 系统概览

### 一句话描述

Agent Daemon 是运行在用户设备上的本地守护进程，作为 Agent UI（AgentM / AgentM Pro）与 Gradience 网络（Chain Hub Indexer、A2A Relay、Solana RPC）之间的持久连接桥梁，负责任务接收与分发、Agent 进程管理、密钥管理和 A2A 消息路由。

### 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User Device                                                            │
│                                                                         │
│  ┌──────────────┐   IPC / REST    ┌──────────────────────────────────┐  │
│  │  AgentM UI   │ ◄──────────────►│         Agent Daemon              │  │
│  │  (Electron)  │                 │                                    │  │
│  └──────────────┘                 │  ┌────────────┐  ┌─────────────┐  │  │
│                                   │  │ Connection  │  │  Task Queue │  │  │
│  ┌──────────────┐   REST / WS     │  │  Manager    │  │  + Executor │  │  │
│  │ AgentM Pro   │ ◄──────────────►│  └─────┬──────┘  └──────┬──────┘  │  │
│  │  (Web/Elec)  │                 │        │                 │         │  │
│  └──────────────┘                 │  ┌─────┴──────┐  ┌──────┴──────┐  │  │
│                                   │  │  Message    │  │  Process    │  │  │
│  ┌──────────────┐   CLI / REST    │  │  Router     │  │  Manager   │  │  │
│  │  CLI Tools   │ ◄──────────────►│  └─────┬──────┘  └─────────────┘  │  │
│  └──────────────┘                 │        │                           │  │
│                                   │  ┌─────┴──────┐  ┌─────────────┐  │  │
│                                   │  │  Key        │  │  Local      │  │  │
│                                   │  │  Manager    │  │  Cache      │  │  │
│                                   │  └─────────────┘  │  (SQLite)   │  │  │
│                                   │                   └─────────────┘  │  │
│                                   └──────────────────────────────────┘  │
└────────────────────────────────────────────┬────────────────────────────┘
                                             │ WebSocket / HTTPS
                                             ▼
                            ┌─────────────────────────────────┐
                            │       Gradience Network          │
                            │                                  │
                            │  ┌───────────┐  ┌────────────┐  │
                            │  │ Chain Hub │  │ Solana RPC │  │
                            │  │ Indexer   │  │ (devnet)   │  │
                            │  └───────────┘  └────────────┘  │
                            │                                  │
                            │  ┌───────────┐  ┌────────────┐  │
                            │  │ A2A Relay │  │ Other      │  │
                            │  │ (Nostr)   │  │ Agents     │  │
                            │  └───────────┘  └────────────┘  │
                            └─────────────────────────────────┘
```

## 2.2 组件定义

| 组件 | 职责 | 不做什么 | 技术选型 | 状态 |
|------|------|---------|---------|------|
| **ConnectionManager** | WebSocket 长连接到 Chain Hub Indexer；自动重连（指数退避）；心跳 | 不处理消息语义 | ws (npm) | 新建 |
| **MessageRouter** | 解析 A2A 消息；按 type 分发到 handler；多协议出站选择 | 不做协议适配（交给 adapter） | 内部实现 | 新建 |
| **TaskQueue** | 接收任务入队；优先级排序；持久化到 SQLite；恢复未完成任务 | 不执行任务 | better-sqlite3 | 新建 |
| **TaskExecutor** | 从队列取任务；调用 Agent 进程执行；收集结果；上报进度和完成状态 | 不管理进程生命周期 | 内部实现 | 新建 |
| **ProcessManager** | 启动/停止 Agent 子进程；健康检查；崩溃重启；资源限制 | 不做任务调度 | child_process | 新建 |
| **KeyManager** | 生成/存储密钥对；交易签名；消息签名；OS keychain 集成 | 不做链上交互 | keytar + tweetnacl | 新建 |
| **LocalCache** | SQLite 数据库；缓存链上状态；离线数据；配置持久化 | 不做跨设备同步 | better-sqlite3 | 新建 |
| **APIServer** | REST API + WebSocket events 给 UI；认证中间件 | 不做 Agent 逻辑 | Fastify | 新建 |
| **ConfigManager** | 加载/合并配置（文件 + env + CLI）；运行时配置变更通知 | 不做 UI | cosmiconfig | 新建 |

## 2.3 数据流

### 核心数据流 1: 任务接收与执行

```
Chain Hub Indexer ──WS──► ConnectionManager ──► MessageRouter
    ──► TaskQueue (入队 + 持久化) ──► TaskExecutor
    ──► ProcessManager (执行) ──► TaskExecutor (收集结果)
    ──► MessageRouter ──► ConnectionManager ──WS──► Chain Hub
```

| 步骤 | 数据 | 从 | 到 | 格式 |
|------|------|----|----|------|
| 1 | task_proposal A2A 消息 | Chain Hub | ConnectionManager | JSON over WebSocket |
| 2 | 解析后的 A2AMessage | ConnectionManager | MessageRouter | TypeScript 对象 |
| 3 | Task 对象 | MessageRouter | TaskQueue | 入队 + SQLite INSERT |
| 4 | 待执行 Task | TaskQueue | TaskExecutor | 内存引用 |
| 5 | 执行指令 | TaskExecutor | ProcessManager | IPC / stdin |
| 6 | 执行结果 | ProcessManager | TaskExecutor | IPC / stdout |
| 7 | task_complete A2A 消息 | TaskExecutor → MessageRouter | ConnectionManager | JSON over WebSocket |

### 核心数据流 2: Agent 间 P2P 通信

```
UI (发送消息) ──REST──► APIServer ──► MessageRouter
    ──► ConnectionManager ──WS──► 目标 Agent Daemon
```

### 核心数据流 3: UI 状态查询

```
AgentM UI ──REST──► APIServer ──► LocalCache / TaskQueue / ProcessManager
    ──► APIServer ──REST──► UI
```

## 2.4 依赖关系

### 内部依赖

```
APIServer → MessageRouter（转发出站消息）
APIServer → TaskQueue（查询任务状态）
APIServer → ProcessManager（查询/控制 Agent）
APIServer → KeyManager（签名请求）

TaskExecutor → TaskQueue（取任务）
TaskExecutor → ProcessManager（执行）
TaskExecutor → MessageRouter（上报结果）

MessageRouter → ConnectionManager（网络出站）
MessageRouter → TaskQueue（任务消息入队）

ConnectionManager → ConfigManager（端点配置）
LocalCache → ConfigManager（数据库路径）
KeyManager → ConfigManager（keychain 配置）
```

### 外部依赖

| 依赖 | 版本 | 用途 | 可替换 |
|------|------|------|--------|
| ws | ^8.x | WebSocket 客户端 | 可用 undici WS |
| better-sqlite3 | ^11.x | 本地持久化 | 可用 sql.js |
| fastify | ^5.x | REST API 服务器 | 可用 express |
| keytar | ^7.x | OS keychain 集成 | 可用文件加密 |
| tweetnacl | ^1.x | Ed25519 签名 | 可用 @noble/ed25519 |
| pino | ^9.x | 结构化日志 | 可用 winston |
| cosmiconfig | ^9.x | 配置加载 | 可用手动实现 |
| zod | ^3.x | 运行时校验 | — |
| @solana/web3.js | ^1.98.x | Solana 交互 | — |

## 2.5 状态管理

### 状态枚举

| 状态名 | 含义 | 谁拥有 | 持久化方式 |
|--------|------|--------|-----------|
| DaemonStatus | 守护进程整体状态 | Daemon 主进程 | 内存 |
| ConnectionState | 网络连接状态 | ConnectionManager | 内存 |
| TaskState | 单个任务的生命周期状态 | TaskQueue | SQLite |
| AgentProcessState | Agent 子进程状态 | ProcessManager | 内存 |
| KeychainState | 密钥是否已解锁 | KeyManager | 内存 (keychain on disk) |

### 连接状态机

```
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting : connect()
    Connecting --> Connected : WS open
    Connecting --> Reconnecting : WS error / timeout
    Connected --> Disconnected : disconnect()
    Connected --> Reconnecting : WS close / error
    Reconnecting --> Connecting : backoff elapsed
    Reconnecting --> Disconnected : max retries exceeded
```

### 任务状态机

```
stateDiagram-v2
    [*] --> Queued
    Queued --> Assigned : executor picks up
    Assigned --> Running : process started
    Running --> Completed : result received
    Running --> Failed : process error / timeout
    Failed --> Queued : retry (if retries < max)
    Failed --> Dead : max retries exceeded
    Queued --> Cancelled : cancel()
    Assigned --> Cancelled : cancel()
    Running --> Cancelled : cancel()
    Completed --> [*]
    Dead --> [*]
    Cancelled --> [*]
```

### Agent 进程状态机

```
stateDiagram-v2
    [*] --> Stopped
    Stopped --> Starting : start()
    Starting --> Running : process spawned + health OK
    Starting --> Failed : spawn error / health timeout
    Running --> Stopping : stop()
    Running --> Crashed : unexpected exit
    Stopping --> Stopped : process exited
    Crashed --> Starting : auto-restart (if enabled)
    Crashed --> Stopped : max restarts exceeded
    Failed --> Stopped : acknowledged
```

## 2.6 接口概览

| 接口 | 类型 | 调用方 | 说明 |
|------|------|--------|------|
| `GET /api/v1/status` | REST | UI | 守护进程状态 |
| `GET /api/v1/tasks` | REST | UI | 任务列表 |
| `POST /api/v1/tasks/:id/cancel` | REST | UI | 取消任务 |
| `GET /api/v1/agents` | REST | UI | Agent 进程列表 |
| `POST /api/v1/agents/:id/start` | REST | UI | 启动 Agent |
| `POST /api/v1/agents/:id/stop` | REST | UI | 停止 Agent |
| `POST /api/v1/messages/send` | REST | UI | 发送 A2A 消息 |
| `GET /api/v1/messages` | REST | UI | 消息历史 |
| `POST /api/v1/keys/sign` | REST | UI | 签名请求 |
| `ws://localhost:{port}/events` | WebSocket | UI | 实时事件流 |

## 2.7 安全考虑

| 威胁 | 影响 | 缓解措施 |
|------|------|---------|
| 本地 API 未授权访问 | 任意操作 Agent、读取密钥 | 启动时生成一次性 token，UI 必须携带 |
| 密钥泄露 | 资金损失 | OS keychain 存储；内存中仅持有签名期间 |
| 恶意任务执行 | 资源耗尽、数据泄露 | 进程沙箱；CPU/内存限制；网络白名单 |
| 中间人攻击 (WS) | 消息篡改 | TLS（wss://）；消息签名验证 |
| 重放攻击 | 重复执行任务 | 消息 nonce + 时间戳验证 |
| 本地 SQLite 篡改 | 状态不一致 | 文件权限 0600；可选 HMAC 完整性校验 |

## 2.8 性能考虑

| 指标 | 目标 | 约束 |
|------|------|------|
| WebSocket 重连延迟 | < 5s (首次)，< 30s (退避上限) | 指数退避 1s → 2s → 4s → ... → 30s |
| 任务入队延迟 | < 10ms | SQLite WAL 模式 |
| API 响应延迟 | < 50ms (p99) | 本地调用，无网络 |
| 内存占用 | < 100MB (daemon 本体) | 不含 Agent 子进程 |
| 并发 Agent 进程 | ≤ 8 (可配置) | 受 CPU 核数限制 |

## 2.9 部署架构

### 场景 1: Desktop（与 AgentM 同机）
```
AgentM (Electron) ◄─── REST/IPC ───► Agent Daemon (独立进程)
                                          │
                                     WebSocket / HTTPS
                                          │
                                     Gradience Network
```
- Daemon 随 AgentM 自动启动（或系统服务）
- 通过 localhost REST API 通信
- pkg 打包为平台二进制

### 场景 2: Server / Cloud
```
Docker Container
├── Agent Daemon (entrypoint)
├── Agent Worker(s)
└── SQLite volume mount
```

### 场景 3: Headless CLI
```
$ agentd start --config ./agentd.toml
$ agentd status
$ agentd task list
```

---

## ✅ Phase 2 验收标准

- [x] 架构图清晰，组件边界明确
- [x] 所有组件的职责已定义
- [x] 数据流完整，无断点
- [x] 依赖关系（内部 + 外部）已列出
- [x] 状态管理方案已定义
- [x] 接口已概览
- [x] 安全威胁已识别

**→ 进入 Phase 3: Technical Spec**
