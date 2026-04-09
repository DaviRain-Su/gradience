# Agent Daemon (Client Daemon) - Product Requirements Document

> 每个用户 Agent 的本地守护进程

---

## 🎯 Vision

每个运行 Agent 的用户设备上都需要一个**本地守护进程**，作为 Agent 与 Gradience 网络之间的桥梁。

**核心职责**:

1. 持续保持与网络的连接
2. 接收并分发任务
3. 管理本地 Agent 生命周期
4. 处理安全和身份验证

---

## 🔍 现状分析

### 当前架构缺口

```
当前状态:
┌─────────────┐      ❌ 缺少连接层      ┌─────────────────┐
│ 用户 Agent   │  ←──────────────────→  │ Gradience 网络   │
│ (Electron)  │      (直接连接?)         │ (Chain Hub)      │
└─────────────┘                          └─────────────────┘

理想状态:
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│ 用户 Agent   │ ←→  │ Agent Daemon │ ←→   │ Gradience 网络   │
│ (UI/控制)   │      │ (本地守护进程) │      │ (Chain Hub)      │
└─────────────┘      └──────────────┘      └─────────────────┘
                            ↓
                     ┌──────────────┐
                     │ A2A Protocol │
                     │ (消息路由)    │
                     └──────────────┘
```

**结论**: Agent Daemon 是**必需但缺失**的核心组件！

---

## 📝 Requirements

### Functional Requirements

#### 1. 网络连接管理

- [ ] 保持与 Chain Hub 的 WebSocket 长连接
- [ ] 自动重连机制（指数退避）
- [ ] 心跳检测
- [ ] 连接状态监控和上报

#### 2. 任务管理

- [ ] 接收来自网络的 Task 分配
- [ ] 本地任务队列管理
- [ ] 任务执行状态跟踪
- [ ] 任务结果回传

#### 3. Agent 生命周期

- [ ] 启动/停止本地 Agent 进程
- [ ] Agent 健康检查
- [ ] Agent 崩溃恢复
- [ ] 资源限制管理（CPU/内存）

#### 4. 身份与安全

- [ ] 管理本地私钥
- [ ] 签名交易和消息
- [ ] 与钱包集成
- [ ] 安全的密钥存储

#### 5. 消息通信 (A2A Protocol)

- [ ] 实现 A2A 客户端
- [ ] 消息路由和分发
- [ ] 点对点通信
- [ ] 群组通信支持

#### 6. 数据同步

- [ ] 本地状态缓存
- [ ] 链上数据同步
- [ ] 离线模式支持
- [ ] 数据冲突解决

---

## 🏗️ Technical Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Daemon                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Core Services                                      │
│  ├── Connection Manager (WebSocket)                         │
│  ├── Task Queue & Scheduler                                 │
│  ├── Agent Process Manager                                  │
│  └── Message Router (A2A)                                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Security & Identity                                │
│  ├── Key Manager (Local secure storage)                     │
│  ├── Wallet Integration                                     │
│  └── Signer Service                                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Data Layer                                         │
│  ├── Local Cache (SQLite/LevelDB)                          │
│  ├── State Manager                                          │
│  └── Sync Engine                                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: API (for UI/CLI)                                   │
│  ├── REST API                                               │
│  ├── WebSocket Events                                       │
│  └── gRPC (optional)                                        │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Connection Manager

```typescript
interface ConnectionManager {
    // 连接管理
    connect(endpoint: string): Promise<void>;
    disconnect(): Promise<void>;
    reconnect(): Promise<void>;

    // 状态
    getStatus(): ConnectionStatus;
    onStatusChange(callback: (status: ConnectionStatus) => void): void;

    // 消息
    send(message: ProtocolMessage): Promise<void>;
    onMessage(callback: (message: ProtocolMessage) => void): void;
}
```

#### Task Manager

```typescript
interface TaskManager {
    // 任务接收
    onTaskAssigned(callback: (task: Task) => void): void;

    // 任务执行
    executeTask(task: Task): Promise<TaskResult>;

    // 任务队列
    getQueue(): Task[];
    pauseQueue(): void;
    resumeQueue(): void;

    // 上报
    reportProgress(taskId: string, progress: number): void;
    reportCompletion(taskId: string, result: TaskResult): void;
}
```

#### Agent Process Manager

```typescript
interface AgentProcessManager {
    // 生命周期
    startAgent(agentConfig: AgentConfig): Promise<AgentInstance>;
    stopAgent(agentId: string): Promise<void>;
    restartAgent(agentId: string): Promise<void>;

    // 监控
    getStatus(agentId: string): AgentStatus;
    getMetrics(agentId: string): AgentMetrics;

    // 健康检查
    healthCheck(agentId: string): HealthStatus;
    onCrash(agentId: string, callback: () => void): void;
}
```

---

## 💻 Implementation Options

### Option 1: Node.js/TypeScript (推荐)

**Pros**:

- 与现有技术栈一致
- 丰富的 npm 生态
- 易于调试和开发

**Cons**:

- 资源占用相对较高
- 需要 Node.js 运行时

### Option 2: Rust

**Pros**:

- 高性能
- 低资源占用
- 强类型安全

**Cons**:

- 开发速度慢
- 团队熟悉度低

### Option 3: Go

**Pros**:

- 性能好
- 编译为单二进制
- 适合系统编程

**Cons**:

- 需要学习成本

**推荐**: Node.js + pkg 打包为独立可执行文件

---

## 📊 Deployment Scenarios

### Scenario 1: Desktop (AgentM Pro)

```
AgentM Pro (Electron)
  ↓ IPC
Agent Daemon (Node.js)
  ↓ WebSocket
Chain Hub
```

### Scenario 2: Server/Cloud

```
Docker Container
├── Agent Daemon
├── User Agent
└── Monitoring
```

### Scenario 3: Embedded/Lightweight

```
Raspberry Pi / IoT Device
└── Agent Daemon (Rust/Go)
```

---

## 🔒 Security Considerations

1. **密钥管理**
    - 使用 OS 密钥链 (Keychain/Keyring)
    - 内存加密
    - 定期轮换

2. **网络安全**
    - TLS 1.3
    - 证书固定
    - 防重放攻击

3. **进程隔离**
    - 沙箱执行
    - 资源限制
    - 权限最小化

---

## 🚀 Roadmap

### Phase 1: MVP (2 weeks)

- [ ] Connection Manager (WebSocket)
- [ ] Basic Task Receiver
- [ ] Simple Agent Launcher

### Phase 2: Core Features (2 weeks)

- [ ] Task Queue Management
- [ ] Agent Health Monitoring
- [ ] Reconnection Logic

### Phase 3: Production Ready (2 weeks)

- [ ] Full A2A Protocol Support
- [ ] Security Hardening
- [ ] Metrics & Logging

---

## 📋 Dependencies

**Blocking**:

- A2A Protocol 设计完成
- Chain Hub API 稳定
- Agent SDK 可用

**Affected**:

- AgentM Pro (依赖 Daemon)
- Agent Arena (任务分发)
- All Agent Developers (需要 Daemon 运行)

---

_Created: 2026-04-03_  
_Status: Requirements Definition_  
_Priority: CRITICAL_
