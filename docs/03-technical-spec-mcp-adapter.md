# Phase 3: Technical Spec — Gradience MCP Adapter

> **Scope**: `packages/mcp-adapter/`
> **Date**: 2026-04-10
> **Task**: GRA-254

## 3.1 数据结构

### `McpAdapterConfig`
```typescript
interface McpAdapterConfig {
    gradienceSdk: GradienceSDK;
    gatewayBaseUrl: string;
    transport: 'stdio' | 'sse';
    ssePort?: number;
}
```

## 3.2 Tools Mapping

| MCP Tool | Input Schema | Gradience Call |
|---|---|---|
| `gradience_list_skills` | `{ category?: string, limit?: number }` | `sdk.chainHub.listSkills(...)` |
| `gradience_purchase_workflow` | `{ workflowId: string, inputs: object }` | Gateway REST `POST /gateway/purchases` |
| `gradience_get_task_status` | `{ taskId: string }` | `sdk.arena.getTask(...)` |
| `gradience_post_arena_task` | `{ evalRef: string, reward: string, deadline: number }` | `sdk.arena.postTask(...)` |

## 3.3 接口定义

```typescript
export function createGradienceMcpServer(config: McpAdapterConfig): Server;
```

## 3.4 目录结构

```
packages/mcp-adapter/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── tools/
│   │   ├── list-skills.ts
│   │   ├── purchase-workflow.ts
│   │   ├── get-task-status.ts
│   │   └── post-arena-task.ts
│   └── types.ts
├── package.json
└── tsconfig.json
```

## 3.5 边界条件

1. SDK method missing → tool returns clear error description
2. Gateway unreachable → return 503-style message in tool result
3. Stdio transport must flush after each JSON-RPC message
