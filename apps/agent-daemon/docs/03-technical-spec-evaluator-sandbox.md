# Phase 3: Technical Spec — Evaluator Docker Sandbox

> **Scope**: `apps/agent-daemon/src/evaluator/runtime.ts` DockerSandbox implementation
> **Date**: 2026-04-10
> **Task**: GRA-253

## 3.1 数据结构

### `DockerSandboxConfig`
```typescript
interface DockerSandboxConfig {
    image: string;           // default: 'node:20-alpine'
    timeoutMs: number;       // default: 30000
    maxMemory: string;       // default: '512m'
    cpus: string;            // default: '1'
    network: 'none' | 'bridge'; // default: 'none'
    workDir: string;         // default: '/workspace'
}
```

## 3.2 接口定义

### `Sandbox` (existing)
`DockerSandbox` must implement existing `Sandbox` interface in `runtime.ts`.

### `EvaluationResult` (existing)
Reuse `EvaluationResult` from `runtime.ts`.

## 3.3 算法

### `code` evaluation
1. Create temp dir with `mkdtempSync`
2. Write submission files + package.json + test file into temp dir
3. Spawn: `docker run --rm --network=none --cpus=1 --memory=512m -v <temp>:/workspace -w /workspace node:20-alpine sh -c "npm install && npm test"`
4. Capture stdout/stderr and exit code via `Promise.race` with timeout
5. On timeout: `docker kill <container>`
6. Map exit code 0 → score 100, non-zero → score 0 with logs
7. `rmSync(tempDir, { recursive: true })`

### `api` evaluation
1. Create temp dir
2. Write a Node.js fetch script that calls the target endpoint
3. Spawn similar docker command (network may be `bridge` for external endpoints)
4. Validate response status and required fields

## 3.4 错误码

| Code | Meaning | Handling |
|---|---|---|
| `EVAL_TIMEOUT` | Docker execution exceeded timeout | Kill container, return score 0 |
| `EVAL_DOCKER_ERROR` | Docker daemon unreachable | Return score 0, log error |
| `EVAL_TEST_FAILED` | Tests exited non-zero | Return score 0, include stderr |

## 3.5 边界条件

1. Docker not installed → graceful degrade to MockSandbox with warning log
2. Large stdout (>1MB) → truncate to last 50KB
3. Network-none blocks external API calls; api tests requiring internet must explicitly set network=bridge
