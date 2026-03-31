# Phase 3: Technical Spec — agent-arena/judge-daemon

> **范围**: `apps/agent-arena/judge-daemon/` — 链外评判守护进程
> **上游**: Indexer REST API / Triton gRPC / Helius LaserStream
> **下游**: `agent-arena/program`（调用 `judge_and_pay` 指令）

---

## 1. 模块职责

Judge Daemon 是**链外自动评判服务**：

- 监听链上事件（TaskCreated / SubmissionReceived）
- 对提交结果进行自动评分（3 种评判模式）
- 调用链上 `judge_and_pay` 指令完成结算
- 维护工作流状态（防重复执行、失败重试）

**不做**：
- 链上状态写入（除 judge_and_pay）
- 任务数据持久化（Indexer 负责）
- 人工评判 UI（仅提供 CLI hook）

---

## 2. 技术栈

| 项目 | 说明 |
|------|------|
| TypeScript + tsx (Node.js) | 运行时（测试：`tsx --test`；生产：tsx 或编译后运行） |
| GradienceSDK | 调用链上指令 |
| `@solana/kit` | 密钥对管理 |
| Python DSPy | Type B LLM 评判微服务（独立进程） |
| PostgreSQL / InMemory | 工作流状态存储 |

---

## 3. 文件结构与职责

```
judge-daemon/src/
├── main.ts          — startJudgeDaemon()：组装所有组件，暴露 stop()（236 行）
├── index.ts         — re-export startJudgeDaemon（11 行）
├── daemon.ts        — JudgeDaemon：管理三路事件源，路由到 WorkflowEngine（137 行）
├── engine.ts        — AbsurdWorkflowEngine：入队、去重、触发 WorkflowRunner（94 行）
├── workflow.ts      — JudgeWorkflowRunner：评判流程编排，调用 chainClient.judgeAndPay（289 行）
├── evaluators.ts    — 3 种评判器实现（284 行）：
│   ├── PollingManualEvaluator  — Type A：等待人工 review（通过环境变量注入结果）
│   ├── DspyHttpEvaluator       — Type B：调用 DSPy HTTP 微服务
│   └── （WasmTestCasesEvaluator 在 test-cases-evaluator.ts）
├── test-cases-evaluator.ts — Type C：WASM 执行测试用例，自动评分（540 行）
├── polling.ts       — PollingEventSource：轮询 Indexer REST API（202 行）
├── sources.ts       — EventSource 抽象 + MockEventSource / AsyncStreamEventSource（155 行）
├── store.ts         — InMemoryWorkflowStore / PostgresWorkflowStore（223 行）
├── refs.ts          — RefResolver：解析 Arweave/IPFS CID，下载评判标准（108 行）
├── types.ts         — 共享类型定义（57 行）
│
├── daemon.test.ts            — JudgeDaemon 单元测试
├── evaluators.test.ts        — 评判器单元测试
├── polling-sources.test.ts   — EventSource 单元测试
├── workflow.test.ts          — WorkflowRunner 集成测试
└── test-cases-evaluator.test.ts — WASM 评判器测试

dspy_service/
└── server.py        — Python DSPy HTTP 服务（独立进程，127.0.0.1:8788）
```

---

## 4. 核心数据类型

### EventEnvelope（事件信封）

```typescript
interface EventEnvelope {
  slot: number;
  timestamp: number;
  event: ProgramEvent;  // TaskCreatedEvent | SubmissionReceivedEvent | GenericProgramEvent
}
```

### WorkflowRecord（工作流记录）

```typescript
interface WorkflowRecord {
  id: string;
  taskId: number;
  trigger: 'task_created' | 'submission_received';
  slot: number;
  timestamp: number;
  agent: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  dedupeKey: string;   // 防重复：`${trigger}:${taskId}:${agent ?? 'null'}`
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. 评判模式（JudgeMode）

| 模式 | 环境变量值 | 说明 |
|------|-----------|------|
| `type_a` | `JUDGE_DAEMON_EVALUATOR_MODE=type_a` | 人工评判（等待外部注入 score） |
| `type_b` | `JUDGE_DAEMON_EVALUATOR_MODE=type_b` | DSPy LLM 评判（HTTP 微服务） |
| `type_c1` | `JUDGE_DAEMON_EVALUATOR_MODE=type_c1` | WASM 测试用例执行 |
| `auto` | `JUDGE_DAEMON_EVALUATOR_MODE=auto`（默认） | 按任务 eval_ref 类型自动选择 |

---

## 6. 事件源三层架构

```
┌─ Triton Dragon's Mouth gRPC ─── AsyncStreamEventSource（主，实时）
│
├─ Helius LaserStream ──────────── AsyncStreamEventSource（备，实时）
│
└─ Indexer REST Polling ────────── PollingEventSource（兜底，5s 轮询）
                                   └── GET /api/tasks?status=open
```

任意一路事件到达 → JudgeDaemon 路由到 AbsurdWorkflowEngine → 去重入队 → JudgeWorkflowRunner 处理

---

## 7. 工作流执行流程

```
EventEnvelope（task_created / submission_received）
  ↓
AbsurdWorkflowEngine.enqueue(input)
  → dedupeKey 已存在 → 跳过
  → 新 workflow → 持久化为 pending → 触发 onWorkflowQueued 回调
  ↓
JudgeWorkflowRunner.process(workflow)
  1. 更新状态为 running
  2. 通过 SDK 获取任务详情（indexer）
  3. 下载 eval_ref（RefResolver → Arweave/IPFS）
  4. 选择评判器，执行评判 → score (0-100)
  5. score >= MIN_SCORE → chainClient.judgeAndPay(taskId, agent, score)
  6. 更新状态为 completed / failed
  → 失败时按 retryPolicy 重试（默认 5 次，指数退避，base 500ms）
```

---

## 8. 环境变量

| 变量 | 必须 | 默认 | 说明 |
|------|------|------|------|
| `JUDGE_DAEMON_JUDGE_KEYPAIR` | ✅ | — | Judge keypair 文件路径（64 字节 JSON 数组） |
| `GRADIENCE_RPC_ENDPOINT` | ❌ | `http://127.0.0.1:8899` | Solana RPC 端点 |
| `JUDGE_DAEMON_INDEXER_ENDPOINT` | ❌ | `http://127.0.0.1:3001` | Indexer 地址 |
| `JUDGE_DAEMON_EVALUATOR_MODE` | ❌ | `auto` | 评判模式（type_a/type_b/type_c1/auto） |
| `JUDGE_DAEMON_DSPY_ENDPOINT` | ❌ | `http://127.0.0.1:8788` | DSPy 服务地址 |
| `JUDGE_DAEMON_ARWEAVE_GATEWAY` | ❌ | — | Arweave 网关 |
| `JUDGE_DAEMON_IPFS_GATEWAY` | ❌ | — | IPFS 网关 |
| `JUDGE_DAEMON_REASON_PUBLISHER` | ❌ | — | 评判原因上传端点 |
| `DATABASE_URL` | ❌ | — | 有则用 PostgreSQL store，无则用 InMemory |
| `JUDGE_DAEMON_RETRY_MAX_ATTEMPTS` | ❌ | `5` | 最大重试次数 |
| `JUDGE_DAEMON_RETRY_BASE_MS` | ❌ | `500` | 重试基础延迟（ms） |
| `JUDGE_DAEMON_MIN_CONFIDENCE` | ❌ | `0.7` | Type B 评判最低置信度 |
| `JUDGE_DAEMON_POLL_INTERVAL_MS` | ❌ | `5000` | Indexer 轮询间隔（ms） |
| `MOCK_EVENT` | ❌ | — | 设为 `true` 启用 mock 事件源（本地测试） |
| `MOCK_EVENT_FILE` | ❌ | `indexer/mock/webhook.json` | mock 事件文件路径 |
| `JUDGE_DAEMON_WASM_TIMEOUT_MS` | ❌ | `2000` | WASM 执行超时（ms） |

---

## 9. 接口契约

### ← Indexer（上游）
- 轮询：`GET /api/tasks?status=open`
- 实时：Triton gRPC / Helius WebSocket（stream factory 需外部注入）

### → Program（下游）
- 调用：`GradienceSDK.judgeAndPay(taskId, agent, score)`
- 最终触发链上 `judge_and_pay` 指令

### ↔ DSPy Service（Type B）
- `POST http://127.0.0.1:8788/evaluate`
- 输入：`{ task_description, submission, eval_criteria }`
- 输出：`{ score: number, confidence: number, reason: string }`
