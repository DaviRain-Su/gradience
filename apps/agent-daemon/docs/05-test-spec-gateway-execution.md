# Phase 5: Test Spec — Gateway Execution Layer

> **输入**: `03-technical-spec-gateway-execution.md` + `04-task-breakdown-gateway-execution.md`
> **输出**: 本测试规格文档 + 测试代码骨架

---

## 5.1 测试策略

| 层级 | 工具 | 覆盖范围 |
| --- | --- | --- |
| 单元测试 | Vitest | WorkflowResolver、ExecutionClient、ExecutingHandler |
| 集成测试 | Vitest + Fastify inject | API 路由可用性、Gateway 端到端状态流转 |

---

## 5.2 单元测试

### TC-01: LocalWorkflowResolver 成功解析
**文件**: `gateway/resolvers/__tests__/local-resolver.test.ts`
- 步骤: 调用 `resolver.resolve('swap-demo', 'buyer-address', { amount: 100 })`
- 期望: 返回 `ResolvedWorkflow`，`steps.length > 0`，`inputs.amount === 100`

### TC-02: LocalWorkflowResolver 未知 workflowId
**文件**: `gateway/resolvers/__tests__/local-resolver.test.ts`
- 步骤: 调用 `resolver.resolve('unknown-id', 'buyer')`
- 期望: 抛出 `GW_WORKFLOW_NOT_FOUND`

### TC-03: VelWorkflowExecutionClient 调用链完整
**文件**: `gateway/__tests__/execution-client.test.ts`
- 步骤:
  1. mock `orchestrator.runAndSettle` 返回 `'mock-tx-sig'`
  2. mock `resolver.resolve` 返回测试 workflow
  3. 调用 `client.runAndSettle(...)`
- 期望:
  - `resolver.resolve` 被调用一次
  - `orchestrator.runAndSettle` 收到正确 `TeeExecutionRequest`
  - 返回 `'mock-tx-sig'`

### TC-04: VelWorkflowExecutionClient resolver 失败时传播错误
**文件**: `gateway/__tests__/execution-client.test.ts`
- 步骤: mock `resolver.resolve` 抛错
- 期望: `client.runAndSettle` 同步抛出相同错误

### TC-05: ExecutingHandler 真实 workflow 调用
**文件**: `gateway/handlers/__tests__/executing-handler.test.ts`
- 步骤:
  1. mock `executionClient.runAndSettle` 返回 `'tx-sig'`
  2. 构造 `GatewayPurchaseRecord`（含 `workflowId`）
  3. 调用 `handler.handle(record)`
- 期望: `executionClient.runAndSettle` 收到的 `workflowDefinition` 不是硬编码 swap

### TC-06: ExecutingHandler 执行失败时返回 FAILED
**文件**: `gateway/handlers/__tests__/executing-handler.test.ts`
- 步骤: mock `runAndSettle` 抛错
- 期望: 返回 `{ nextState: 'FAILED' }`

---

## 5.3 集成测试

### TC-07: API Server 注册 Gateway 路由
**文件**: `api/__tests__/server-gateway.test.ts`
- 步骤:
  1. 构造 `createAPIServer` 并传入 `gateway` mock
  2. 注入 `GET /api/v1/gateway/purchases/test-id`
- 期望:
  - HTTP 200
  - 返回 purchase 记录

### TC-08: Gateway retry 端点工作正常
**文件**: `api/__tests__/server-gateway.test.ts`
- 步骤: `POST /api/v1/gateway/purchases/test-id/retry`
- 期望: HTTP 200，`{ success: true }`

### TC-09: Gateway 路由未传入时不注册
**文件**: `api/__tests__/server-gateway.test.ts`
- 步骤: 构造 `createAPIServer` 不传 `gateway`
- 期望: `/api/v1/gateway/purchases/any` 返回 404

---

## 5.4 端到端测试

### TC-10: Gateway drive 完整状态流转
**文件**: `gateway/__tests__/gateway-drive.test.ts`
- 步骤:
  1. mock ArenaTaskClient（post/apply/getNextTaskId）
  2. mock ExecutionClient（runAndSettle 返回 `'tx-sig'`）
  3. 调用 `gateway.processPurchase(purchaseEvent)`
- 期望:
  - 最终状态为 `SETTLING` 或 `SETTLED`
  - `settlementTx` 被写入

---

## 5.5 覆盖率目标

- 单元测试: ≥ 85% 语句覆盖
- 集成测试: 所有新增 API 端点至少 1 个测试

---

## 5.6 测试执行命令

```bash
cd apps/agent-daemon
SKIP_E2E_TESTS=true npx vitest run \
  src/gateway/resolvers/__tests__/local-resolver.test.ts \
  src/gateway/__tests__/execution-client.test.ts \
  src/gateway/handlers/__tests__/executing-handler.test.ts \
  src/api/__tests__/server-gateway.test.ts \
  src/gateway/__tests__/gateway-drive.test.ts
```

---

## ✅ Phase 5 验收标准

- [x] 所有关键行为都有测试用例
- [x] 每个测试有明确期望
- [x] 定义了覆盖率目标
- [x] 定义了执行命令
