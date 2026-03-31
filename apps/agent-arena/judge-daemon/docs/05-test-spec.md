# Phase 5: Test Spec — agent-arena/judge-daemon

---

## 1. 当前测试文件

| 文件 | 代码量 | 测试内容 | 状态 |
|------|--------|---------|------|
| `daemon.test.ts` | 151 行 | JudgeDaemon 生命周期、事件路由 | ✅ |
| `evaluators.test.ts` | 133 行 | PollingManualEvaluator / DspyHttpEvaluator | ✅ |
| `polling-sources.test.ts` | 106 行 | PollingEventSource、MockEventSource | ✅ |
| `test-cases-evaluator.test.ts` | 107 行 | WasmTestCasesEvaluator | ✅ |
| `workflow.test.ts` | 443 行 | JudgeWorkflowRunner 完整流程 | ✅ |

---

## 2. 运行方式

```bash
cd apps/agent-arena/judge-daemon
# 运行所有测试
bun test

# 运行单个测试文件
bun test src/workflow.test.ts

# 监听模式（开发时）
bun test --watch
```

---

## 3. 覆盖要求

### 已覆盖（✅）

| 场景 | 测试文件 |
|------|---------|
| JudgeDaemon 启动/停止生命周期 | daemon.test.ts |
| 事件到达 → 路由到 engine | daemon.test.ts |
| Mock 事件源触发工作流 | daemon.test.ts |
| PollingManualEvaluator 超时返回默认分 | evaluators.test.ts |
| DspyHttpEvaluator HTTP 调用 + 返回解析 | evaluators.test.ts |
| PollingEventSource 正常轮询 | polling-sources.test.ts |
| MockEventSource 事件回放 | polling-sources.test.ts |
| WasmTestCasesEvaluator 基础执行 | test-cases-evaluator.test.ts |
| WorkflowRunner 完整评判流程（mock chain client） | workflow.test.ts |
| dedupeKey 防重复执行 | workflow.test.ts |
| 失败重试逻辑 | workflow.test.ts |

### 缺失（P0）

| 场景 | 说明 |
|------|------|
| score < MIN_SCORE → 不调用 judgeAndPay | 分数门槛边界 |
| DSPy 服务不可用时的降级行为 | 网络故障处理 |
| PostgresWorkflowStore CRUD | 需要 DB（目前只测 InMemory） |
| `auto` 模式按 eval_ref 类型选择评判器 | 路由逻辑 |

### 缺失（P1）

| 场景 | 说明 |
|------|------|
| RefResolver：Arweave/IPFS 下载失败处理 | 容错性 |
| 并发多任务同时评判 | 并发安全 |
| 工作流状态机：pending → running → completed 完整转换 | 状态正确性 |
| Triton / Helius 流断连重连 | 长期运行稳定性 |

---

## 4. 测试策略说明

- **链上调用全部 mock**：WorkflowRunner 测试通过注入 mock `chainClient`，不实际调用链上
- **DSPy 服务 mock**：通过 `nock` 或 Bun 内置 mock 拦截 HTTP 请求
- **WASM 执行**：需要实际 WASM 二进制，test-cases-evaluator.test.ts 可能需要 fixture
- **PostgreSQL**：Store 集成测试需要真实 DB，建议用 Docker Compose 或 testcontainers
