# Phase 5: Test Spec — Agent Daemon

> **输入**: Phase 3 技术规格
> **输出物**: 测试用例表 + 测试代码骨架

---

## 5.1 测试策略

| 测试类型 | 覆盖范围            | 工具               | 运行环境 |
| -------- | ------------------- | ------------------ | -------- |
| 单元测试 | 每个 Manager / 模块 | vitest             | Node.js  |
| 集成测试 | API + 组件交互      | vitest + supertest | Node.js  |
| 安全测试 | 认证、签名验证      | vitest             | Node.js  |

## 5.2 测试用例表

### 5.2.1 ConnectionManager

**Happy Path**

| #   | 测试名称           | 输入            | 预期输出             | 预期状态变化                          |
| --- | ------------------ | --------------- | -------------------- | ------------------------------------- |
| H1  | 成功连接到 WS 端点 | 有效 wss:// URL | state=connected      | disconnected → connecting → connected |
| H2  | 收到心跳响应       | 服务端 pong     | heartbeat 计时器重置 | —                                     |
| H3  | 主动断开连接       | disconnect()    | WS closed            | connected → disconnected              |

**Boundary**

| #   | 测试名称                 | 输入                    | 预期行为                      |
| --- | ------------------------ | ----------------------- | ----------------------------- |
| B1  | 连接超时                 | 不响应的端点            | 进入 reconnecting             |
| B2  | 达到最大重连次数         | maxAttempts=3, 全部失败 | 进入 disconnected, emit event |
| B3  | maxAttempts=0 (无限重连) | 持续失败                | 不停重试，不进入 disconnected |

**Error/Attack**

| #   | 测试名称    | 输入/操作      | 预期行为           |
| --- | ----------- | -------------- | ------------------ |
| E1  | WS 意外关闭 | 服务端强制断开 | 自动重连，指数退避 |
| E2  | 无效 URL    | 'not-a-url'    | 抛出配置错误       |

### 5.2.2 TaskQueue

**Happy Path**

| #   | 测试名称     | 输入                 | 预期输出                      |
| --- | ------------ | -------------------- | ----------------------------- |
| H1  | 入队新任务   | Task 对象            | 写入 SQLite, state=queued     |
| H2  | 按优先级出队 | 3 个不同优先级任务   | priority DESC, created_at ASC |
| H3  | 更新任务状态 | taskId + newState    | SQLite 更新成功               |
| H4  | 取消任务     | queued 状态的 taskId | state → cancelled             |

**Boundary**

| #   | 测试名称         | 输入           | 预期行为                      |
| --- | ---------------- | -------------- | ----------------------------- |
| B1  | 空队列出队       | 无任务         | 返回 null                     |
| B2  | 取消已完成任务   | completed 状态 | 返回错误 TASK_NOT_CANCELLABLE |
| B3  | 重复任务 ID 入队 | 相同 id        | 幂等，不重复插入              |

**Error**

| #   | 测试名称        | 输入       | 预期行为     |
| --- | --------------- | ---------- | ------------ |
| E1  | SQLite 写入失败 | 模拟磁盘满 | 抛出存储错误 |

### 5.2.3 TaskExecutor

**Happy Path**

| #   | 测试名称     | 输入                | 预期输出                              |
| --- | ------------ | ------------------- | ------------------------------------- |
| H1  | 成功执行任务 | 有 agent 可用       | state: assigned → running → completed |
| H2  | 进度上报     | agent 发送 progress | emit task.progress event              |

**Error**

| #   | 测试名称       | 输入                    | 预期行为                      |
| --- | -------------- | ----------------------- | ----------------------------- |
| E1  | Agent 执行超时 | 超时任务                | state → failed, 重试          |
| E2  | 超过最大重试   | retries >= maxRetries   | state → dead                  |
| E3  | 执行中取消     | cancel() during running | 发 SIGTERM, state → cancelled |

### 5.2.4 ProcessManager

**Happy Path**

| #   | 测试名称       | 输入             | 预期输出                   |
| --- | -------------- | ---------------- | -------------------------- |
| H1  | 启动 Agent     | 有效 AgentConfig | pid != null, state=running |
| H2  | 停止 Agent     | 运行中的 agentId | SIGTERM, state=stopped     |
| H3  | Agent 正常退出 | 进程 exit code 0 | state=stopped              |

**Boundary**

| #   | 测试名称         | 输入                             | 预期行为                   |
| --- | ---------------- | -------------------------------- | -------------------------- |
| B1  | 启动达上限       | maxAgentProcesses 个已运行       | 返回 AGENT_LIMIT_REACHED   |
| B2  | 启动已运行 Agent | running 状态                     | 返回 AGENT_ALREADY_RUNNING |
| B3  | 崩溃自动重启     | 进程异常退出, restartCount < max | 自动重启                   |
| B4  | 超过最大重启     | restartCount >= maxRestarts      | state=stopped, 不再重启    |

**Error**

| #   | 测试名称       | 输入                  | 预期行为                |
| --- | -------------- | --------------------- | ----------------------- |
| E1  | 命令不存在     | command='nonexistent' | state=failed, 明确错误  |
| E2  | Agent OOM kill | exit code 137         | state=crashed, 触发重启 |

### 5.2.5 MessageRouter

**Happy Path**

| #   | 测试名称           | 输入                          | 预期输出                    |
| --- | ------------------ | ----------------------------- | --------------------------- |
| H1  | 路由 task_proposal | A2AMessage type=task_proposal | 任务入队到 TaskQueue        |
| H2  | 发送出站消息       | A2AIntent                     | 通过 ConnectionManager 发出 |
| H3  | 持久化消息         | 入站消息                      | 写入 messages 表            |

**Error**

| #   | 测试名称     | 输入           | 预期行为          |
| --- | ------------ | -------------- | ----------------- |
| E1  | 无效消息格式 | 缺少必填字段   | 丢弃，log warning |
| E2  | 未知消息类型 | type='unknown' | 丢弃，log warning |

### 5.2.6 KeyManager

**Happy Path**

| #   | 测试名称   | 输入                            | 预期输出                |
| --- | ---------- | ------------------------------- | ----------------------- |
| H1  | 生成密钥对 | —                               | 返回 publicKey (base58) |
| H2  | 签名消息   | bytes                           | 返回有效 Ed25519 签名   |
| H3  | 验证签名   | message + signature + publicKey | 返回 true               |

**Security**

| #   | 测试名称              | 输入     | 预期行为             |
| --- | --------------------- | -------- | -------------------- |
| S1  | 无 getPrivateKey 方法 | —        | 接口不暴露私钥       |
| S2  | 签名后密钥不在内存    | 签名操作 | 私钥仅在签名期间持有 |

### 5.2.7 API Server (认证)

**Security**

| #   | 测试名称      | 操作                          | 预期行为               |
| --- | ------------- | ----------------------------- | ---------------------- |
| S1  | 无 token 请求 | GET /api/v1/status 无 header  | 401 AUTH_REQUIRED      |
| S2  | 错误 token    | Authorization: Bearer wrong   | 401 AUTH_INVALID       |
| S3  | 正确 token    | Authorization: Bearer correct | 200                    |
| S4  | host=0.0.0.0  | 启动配置 host='0.0.0.0'       | 配置校验拒绝，启动失败 |

## 5.3 集成测试场景

| #   | 场景名称        | 步骤                                                                                                                  | 预期结果                                            |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| I1  | 完整任务流      | 1. 启动 daemon → 2. 注册 agent → 3. 入站 task_proposal → 4. 任务入队 → 5. executor 分配 → 6. agent 执行 → 7. 结果上报 | task state: queued → assigned → running → completed |
| I2  | 断线恢复        | 1. 连接 WS → 2. 模拟断线 → 3. 等待重连 → 4. 验证恢复后消息收发正常                                                    | 连接状态: connected → reconnecting → connected      |
| I3  | Daemon 重启恢复 | 1. 入队任务 → 2. 关闭 daemon → 3. 重启 → 4. 检查 SQLite 中的任务                                                      | 未完成任务仍在队列中                                |
| I4  | Agent 崩溃恢复  | 1. 启动 agent → 2. kill agent 进程 → 3. 等待自动重启                                                                  | restartCount++, agent 重新运行                      |

## 5.4 安全测试场景

| #   | 攻击名称        | 攻击方式                | 预期防御             |
| --- | --------------- | ----------------------- | -------------------- |
| S1  | 未认证 API 访问 | 不带 token 调用所有端点 | 全部 401             |
| S2  | 远程 API 访问   | 从非 127.0.0.1 请求     | 连接拒绝 (bind 限制) |
| S3  | 消息伪造        | 发送无效签名的 A2A 消息 | 消息被拒绝           |
| S4  | 重放攻击        | 重发已处理的消息        | 幂等处理，不重复入队 |

## 5.5 测试代码骨架

```typescript
// tests/unit/connection-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ConnectionManager', () => {
    // Happy Path
    it('H1: should connect to valid WebSocket endpoint', async () => {
        // TODO: implement
    });

    it('H2: should reset heartbeat on pong', async () => {
        // TODO: implement
    });

    it('H3: should disconnect cleanly', async () => {
        // TODO: implement
    });

    // Boundary
    it('B1: should enter reconnecting on connection timeout', async () => {
        // TODO: implement
    });

    it('B2: should stop reconnecting after max attempts', async () => {
        // TODO: implement
    });

    it('B3: should reconnect indefinitely when maxAttempts=0', async () => {
        // TODO: implement
    });

    // Error
    it('E1: should auto-reconnect on unexpected close', async () => {
        // TODO: implement
    });

    it('E2: should throw on invalid URL', async () => {
        // TODO: implement
    });
});
```

```typescript
// tests/unit/task-queue.test.ts
import { describe, it, expect } from 'vitest';

describe('TaskQueue', () => {
    it('H1: should enqueue a new task', async () => {
        // TODO: implement
    });

    it('H2: should dequeue by priority then FIFO', async () => {
        // TODO: implement
    });

    it('H3: should update task state', async () => {
        // TODO: implement
    });

    it('H4: should cancel a queued task', async () => {
        // TODO: implement
    });

    it('B1: should return null on empty queue', async () => {
        // TODO: implement
    });

    it('B2: should reject cancel on completed task', async () => {
        // TODO: implement
    });

    it('B3: should handle duplicate task ID idempotently', async () => {
        // TODO: implement
    });
});
```

```typescript
// tests/unit/process-manager.test.ts
import { describe, it, expect } from 'vitest';

describe('ProcessManager', () => {
    it('H1: should start agent and return pid', async () => {
        // TODO: implement
    });

    it('H2: should stop running agent with SIGTERM', async () => {
        // TODO: implement
    });

    it('B1: should reject start when at max capacity', async () => {
        // TODO: implement
    });

    it('B3: should auto-restart crashed agent', async () => {
        // TODO: implement
    });

    it('B4: should stop restarting after maxRestarts', async () => {
        // TODO: implement
    });

    it('E1: should fail with clear error for nonexistent command', async () => {
        // TODO: implement
    });
});
```

```typescript
// tests/unit/key-manager.test.ts
import { describe, it, expect } from 'vitest';

describe('KeyManager', () => {
    it('H1: should generate a new keypair', async () => {
        // TODO: implement
    });

    it('H2: should sign message with valid Ed25519 signature', async () => {
        // TODO: implement
    });

    it('H3: should verify valid signature', async () => {
        // TODO: implement
    });

    it('S1: should not expose private key', () => {
        // TODO: implement
    });
});
```

```typescript
// tests/integration/api.test.ts
import { describe, it, expect } from 'vitest';

describe('API Server', () => {
    it('S1: should return 401 without auth token', async () => {
        // TODO: implement
    });

    it('S2: should return 401 with wrong token', async () => {
        // TODO: implement
    });

    it('S3: should return 200 with correct token', async () => {
        // TODO: implement
    });

    it('I1: full task lifecycle via API', async () => {
        // TODO: implement
    });
});
```

## 5.6 测试覆盖目标

| 指标         | 目标     |
| ------------ | -------- |
| 语句覆盖率   | ≥ 85%    |
| 分支覆盖率   | ≥ 80%    |
| 安全测试场景 | 全部通过 |
| 集成测试场景 | 全部通过 |

---

## ✅ Phase 5 验收标准

- [x] 每个模块都有 Happy/Boundary/Error 测试
- [x] 安全测试场景覆盖认证、签名、隔离
- [x] 集成测试至少 4 个完整场景
- [x] 测试代码骨架已编写
- [x] 覆盖目标已定义

**→ 进入 Phase 6: Implementation**
