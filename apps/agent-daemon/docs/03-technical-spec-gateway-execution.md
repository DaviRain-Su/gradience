# Phase 3: Technical Spec — Gateway Execution Layer

> **任务**: GRA-3, GRA-4, GRA-5  
> **输入**: `03-technical-spec-vel.md`, `02-architecture-vel.md`  
> **输出**: 让 Gateway 从「Stub 演示」变成「真实执行闭环」  
> ⚠️ **代码必须与本文档 100% 一致。**

---

## 1. 目标与范围

本规格补全 `apps/agent-daemon/src/gateway/` 执行层的最后缺口，使 Workflow Marketplace 的购买事件能够：

1. 通过 `WorkflowEngine` **真实执行 workflow**
2. 通过 `VelOrchestrator` 完成 TEE 执行 → attestation → 链上结算
3. 通过 REST API 暴露查询和 retry 入口

涉及修改的文件：
- `gateway-domain.ts` — 注入真实 `ExecutionClient`
- `api/server.ts` — 注册 Gateway 路由
- `executing-handler.ts` — 读取真实 workflow 定义并调用 `executionClient`
- 可能新增：workflow 定义解析器、Gateway Store schema 扩展

---

## 2. 核心设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| ExecutionClient 实现 | `VelOrchestrator` 包装 `WorkflowEngine` | VEL 已具备完整流程；Gateway 只需要桥接 |
| Workflow 定义来源 | `workflow-engine` schema + 链上/数据库查询 | marketplace 购买时只存 `workflowId`，执行时需反查定义 |
| TEE  vs 本地执行 | 先走本地 `WorkflowEngine` + mock TEE attestation | Solana-only 阶段先让链路跑通，TEE 硬件可后续切换 provider |
| API 认证 | 复用现有 `createAuthHook` | Gateway 路由与 daemon 其他路由共享 auth |

---

## 3. 数据结构

### 3.1 ExecutionClient 请求/响应

沿用 `gateway.ts` 中已有的 `ExecutionClient` 接口：

```typescript
export interface ExecutionClient {
    runAndSettle(request: {
        workflowId: string;
        workflowDefinition: { version: '1.0'; name: string; steps: any[] };
        inputs: Record<string, unknown>;
        taskId: number;
        executorAddress: string;
        timeoutMs: number;
    }): Promise<string>; // returns settlement tx signature
}
```

### 3.2 Gateway Store 扩展

`GatewayPurchaseRecord` 需要新增字段（用于追踪执行来源）：

```typescript
interface GatewayPurchaseRecord {
    // ... existing fields ...
    /** workflow 定义的来源：onchain / ipfs / local */
    workflowSource?: 'onchain' | 'ipfs' | 'local';
    /** 执行结果摘要 */
    executionSummary?: string;
}
```

> 本次实现只读不改 schema migration，新增字段以可选方式写入。

### 3.3 Workflow 解析结果

```typescript
interface ResolvedWorkflow {
    workflowId: string;
    version: '1.0';
    name: string;
    steps: any[];
    inputs: Record<string, unknown>;
}
```

---

## 4. 接口定义

### 4.1 `GatewayWorkflowResolver`

```typescript
export interface GatewayWorkflowResolver {
    /**
     * 根据 workflowId 解析完整 workflow 定义和输入参数
     * @throws GW_WORKFLOW_NOT_FOUND
     */
    resolve(workflowId: string, buyer: string, purchaseInputs?: Record<string, unknown>): Promise<ResolvedWorkflow>;
}
```

#### 实现 1: `LocalWorkflowResolver`
- 硬编码映射表（开发/测试用）
- 路径：`gateway/resolvers/local-resolver.ts`

#### 实现 2: `OnChainWorkflowResolver`（future）
- 从 Workflow Marketplace program account 读取
- 当前版本用 `LocalWorkflowResolver` fallback

### 4.2 `VelWorkflowExecutionClient`

`ExecutionClient` 的具体实现，包装 `DefaultVelOrchestrator` + `WorkflowEngine`：

```typescript
export class VelWorkflowExecutionClient implements ExecutionClient {
    constructor(
        private readonly orchestrator: DefaultVelOrchestrator,
        private readonly workflowResolver: GatewayWorkflowResolver,
    ) {}

    async runAndSettle(request): Promise<string> {
        // 1. 解析 workflow
        const resolved = await this.workflowResolver.resolve(
            request.workflowId,
            request.executorAddress,
            request.inputs,
        );

        // 2. 构造 TeeExecutionRequest
        const teeRequest: TeeExecutionRequest = {
            workflowId: request.workflowId,
            workflowDefinition: {
                version: '1.0',
                name: resolved.name,
                steps: resolved.steps,
            },
            inputs: resolved.inputs,
            taskId: request.taskId,
            executorAddress: request.executorAddress,
            timeoutMs: request.timeoutMs,
        };

        // 3. 走 VEL 完整流程：TEE execute → verify → settle
        return this.orchestrator.runAndSettle(teeRequest);
    }
}
```

---

## 5. 状态机更新

`ExecutingHandler` 从硬编码改为真实调用：`gateway.ts` 中的状态机本身不变，只是 `ExecutingHandler` 的行为改变。

```
SUBMITTED → ExecutingHandler.handle()
    → 调用 executionClient.runAndSettle()
    → success:  SETTLING (patch: settlementTx)
    → failure:  FAILED
```

---

## 6. API 路由

在 `api/server.ts` 中注册：

```typescript
import { registerGatewayRoutes } from './routes/gateway.js';

// 在 createAPIServer 中，after registerMagicBlockRoutes:
if (deps.gateway) {
    registerGatewayRoutes(app, deps.gateway);
    logger.info('Gateway routes registered');
}
```

### `APIServerDeps` 扩展

```typescript
export interface APIServerDeps {
    // ... existing fields ...
    gateway?: DefaultWorkflowExecutionGateway;
}
```

### 已有路由功能（`gateway.ts`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/gateway/purchases/:purchaseId` | 查询 purchase 状态和执行进度 |
| POST | `/api/v1/gateway/purchases/:purchaseId/retry` | 手动重试失败 purchase |

---

## 7. 错误码

| 错误码 | 名称 | 触发条件 |
|--------|------|---------|
| `GW_WORKFLOW_NOT_FOUND` | workflow 定义未找到 | resolver 无法解析 workflowId |
| `GW_EXECUTION_TIMEOUT` | 执行超时 | `runAndSettle` 超过 timeoutMs |
| `GW_SETTLEMENT_FAILED` | 链上结算失败 | bridge.judgeAndPay 抛异常 |

---

## 8. 目录结构变更

```
apps/agent-daemon/src/
├── gateway/
│   ├── resolvers/
│   │   └── local-resolver.ts          [新建]
│   ├── execution-client.ts            [新建] VelWorkflowExecutionClient
│   └── handlers/
│       └── executing-handler.ts       [修改] 真实 workflow + 输入
├── api/
│   └── server.ts                      [修改] 注册 gateway routes + deps.gateway
└── daemon/
    └── gateway-domain.ts              [修改] 注入真实 executionClient
```

---

## 9. 边界条件

| # | 边界条件 | 预期行为 |
|---|---------|---------|
| 1 | `workflowId` 无法解析 | `ExecutingHandler` 捕获并返回 `FAILED` |
| 2 | `executionClient.runAndSettle` 超时 | 返回 `FAILED`，`error` 写入 patch |
| 3 | `taskId` 为 0 / undefined | 仍尝试执行，但链上结算会失败（由下层捕获） |
| 4 | retry 时 workflow 定义已变更 | 重新 resolve，使用最新定义 |
| 5 | `deps.gateway` 未传入 | `api/server.ts` 跳过路由注册，不抛错 |

---

## ✅ Phase 3 验收标准

- [x] ExecutionClient 接口与 VEL `runAndSettle` 对齐
- [x] Gateway 路由注册逻辑明确
- [x] ExecutingHandler 不再硬编码 workflow
- [x] 错误处理完整
- [x] 目录结构已定义
