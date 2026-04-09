# Agent Daemon (客户端守护进程)

## ⚠️ 关键发现：核心组件缺失！

你提出了一个极其重要的问题。经过分析，我们发现：

> **Agent Daemon 是当前架构中缺失的核心组件！**

---

## 🔍 现状分析

### 当前架构 (不完整)

```
┌─────────────┐      ❌ 缺少连接层      ┌─────────────────┐
│ 用户 Agent   │  ←──────────────────→  │ Gradience 网络   │
│ (Electron)  │      (直接连接?)         │ (Chain Hub)      │
└─────────────┘                          └─────────────────┘
```

**问题**:

- AgentM Pro 如何与 Chain Hub 通信？
- 任务如何分配给本地 Agent？
- 私钥如何安全存储？
- 网络中断如何恢复？

### 理想架构 (完整)

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│ 用户 Agent   │ ←→  │ Agent Daemon │ ←→   │ Gradience 网络   │
│ (UI/控制)   │      │ (本地守护进程) │      │ (Chain Hub)      │
└─────────────┘      └──────────────┘      └─────────────────┘
                            ↓
                     ┌──────────────┐
                     │ A2A Protocol │
                     └──────────────┘
```

**Agent Daemon 职责**:

1. ✅ 保持与 Chain Hub 的 WebSocket 连接
2. ✅ 接收和分发任务
3. ✅ 管理本地 Agent 进程
4. ✅ 安全存储私钥
5. ✅ 自动重连和故障恢复

---

## 📋 已规划的组件

| 组件             | 当前状态      | 是否缺失        |
| ---------------- | ------------- | --------------- |
| Chain Hub SDK    | ❌ 未实现     | 🔴 缺失         |
| SQL 接口         | ❌ 未实现     | 🔴 缺失         |
| **Agent Daemon** | ❌ **不存在** | 🔴 **关键缺失** |
| AgentM Pro       | ⚠️ 框架中     | 🟡 待完善       |
| A2A Protocol SDK | ❌ 未实现     | 🔴 缺失         |

---

## 🎯 Agent Daemon 功能规格

### 核心模块

#### 1. Connection Manager

- WebSocket 长连接
- 自动重连（指数退避）
- 心跳检测
- 连接状态监控

#### 2. Task Manager

- 任务队列
- 任务分发
- 进度上报
- 结果回传

#### 3. Process Manager

- 启动/停止 Agent
- 健康检查
- 崩溃恢复
- 资源限制

#### 4. Key Manager

- 本地私钥管理
- OS 密钥链集成
- 交易签名
- 安全存储

#### 5. Message Router (A2A)

- A2A 协议实现
- 消息路由
- P2P 通信

---

## 📁 文档规划

已创建以下文档：

```
docs/agent-daemon/
├── 01-prd.md              # 产品需求文档
├── 04-task-breakdown.md   # 任务分解 (18个任务)
└── README.md              # 本文件
```

---

## 🚀 建议执行计划

### 立即开始 (本周)

1. **Initialize Agent Daemon project**
    - Node.js/TypeScript 项目
    - 构建系统配置

2. **Connection Manager**
    - WebSocket 客户端
    - 自动重连逻辑

3. **Task Queue System**
    - 内存队列
    - SQLite 持久化

### 第二周

4. **Task Executor**
5. **Agent Process Manager**
6. **REST API**

### 第三周

7. **Key Manager**
8. **AgentM Pro Integration**
9. **测试和优化**

---

## ❓ 关键决策

1. **Agent Daemon 是独立进程还是 AgentM Pro 内置？**
    - 推荐：独立进程（稳定性、可独立运行）
    - 备选：内置（简化部署）

2. **技术栈选择**
    - 推荐：Node.js + TypeScript
    - 备选：Rust（更高性能）

3. **是否需要支持无 GUI 部署？**
    - 服务器/云环境
    - Docker 容器
    - IoT 设备

---

## 🔥 重要性评估

**Agent Daemon 是阻塞性的！**

没有它：

- ❌ AgentM Pro 无法与网络通信
- ❌ 无法接收任务分配
- ❌ 无法安全管理密钥
- ❌ 无法实现离线功能

**建议优先级**: 🔴 **P0 - 立即开始**

---

## 📊 需要创建的任务 (建议添加到 Linear)

### MVP 核心任务 (10个)

| #   | 任务                               | 优先级 | 类型     |
| --- | ---------------------------------- | ------ | -------- |
| 1   | Initialize Agent Daemon project    | P1     | 🤖 Agent |
| 2   | Implement Connection Manager       | P1     | 🤖 Agent |
| 3   | Implement Message Protocol Handler | P1     | 🤖 Agent |
| 4   | Implement Task Queue System        | P1     | 🤖 Agent |
| 5   | Implement Task Executor            | P1     | 🤖 Agent |
| 6   | Implement Agent Process Manager    | P1     | 🤖 Agent |
| 7   | Implement Key Manager              | P1     | 🤖 Agent |
| 8   | Implement REST API for UI          | P1     | 🤖 Agent |
| 9   | Create AgentM Pro Integration      | P1     | 🤖 Agent |
| 10  | Security audit for key management  | P1     | 👤 人工  |

---

_分析完成: 2026-04-03_  
_状态: 需要立即开始开发_
