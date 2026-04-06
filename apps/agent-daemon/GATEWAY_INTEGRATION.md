# Gateway Integration Guide

> Workflow Execution Gateway (WEG) connects Marketplace Purchase → Arena Task → VEL Settlement

## Quick Start

### 1. Environment Variables (optional)

Create a `.env` file in `apps/agent-daemon/`:

```bash
RPC_ENDPOINT=https://api.devnet.solana.com/
ARENA_PROGRAM_ID=5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs
MARKETPLACE_PROGRAM_ID=3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW
DEFAULT_JUDGE=8uAPC2UxiBjKmUksVVwUA6q4RctiXkgSAsovBR39cd1i
POSTER_WALLET_PATH=~/.config/solana/id.json
AGENT_WALLET_PATH=/tmp/agent2.json
```

### 2. Run the Devnet E2E

```bash
cd apps/agent-daemon
pnpm run build
node scripts/e2e-gateway-devnet.mjs
```

Expected output:
```
✅ GATEWAY E2E SUCCESS
Task ID     : 10
Settlement  : vF63Lt67...
Explorer    : https://explorer.solana.com/tx/...?cluster=devnet
```

## Architecture

```
Marketplace purchase tx
          │
          ▼
PurchaseEvent ──▶ GatewayStore (SQLite)
          │
          ▼
WorkflowExecutionGateway.drive()
          │
          ├──▶ ArenaTaskClient.post()   → on-chain task
          ├──▶ ArenaTaskClient.apply()  → agent apply
          ├──▶ ArenaTaskClient.submit() → result submission
          └──▶ ExecutionClient.runAndSettle() → VEL proof + settlement
```

## Core Abstractions

| Component | File | Responsibility |
|-----------|------|----------------|
| `GatewayStore` | `src/gateway/store.ts` | SQLite persistence for purchase record lifecycle |
| `PurchaseStateMachine` | `src/gateway/state-machine.ts` | Valid transitions: PENDING → TASK_CREATING → TASK_CREATED → APPLIED → SUBMITTED → EXECUTING → SETTLING → SETTLED |
| `DefaultWorkflowExecutionGateway` | `src/gateway/gateway.ts` | Orchestrates the end-to-end flow |
| `PollingMarketplaceEventListener` | `src/gateway/event-listener.ts` | Polls signatures for marketplace program and parses `purchase_workflow_v2` (opcode 8) |
| `DefaultArenaTaskFactory` | `src/gateway/arena-factory.ts` | Maps purchase record to `PostTaskParams` |

## API Routes

Registered under `/api/v1/gateway/`:

- **GET** `/purchases/:purchaseId`
  - Returns the full `GatewayPurchaseRecord`
- **POST** `/purchases/:purchaseId/retry`
  - Retries a failed purchase (checks `attempts < maxRetries`)

## Event Listener

`PollingMarketplaceEventListener` uses `getSignaturesForAddress` polling with:
- configurable `pollIntervalMs` (default 15s)
- automatic deduplication via `processedSignatures` LRU
- fallback friendly compared to websocket logSubscribe

## Retry Semantics

- `maxRetries` defaults to **3**
- Only purchases in `FAILED` status are retryable
- Each retry increments `attempts` and transitions back to `TASK_CREATING`

## Running Tests

```bash
# Unit + integration tests
npx vitest run src/gateway/__tests__/

# Build check
pnpm run build

# Full workspace typecheck
cd ../.. && pnpm run typecheck
```

## Known Limitations

1. **Event Listener amount estimation** is approximated from buyer balance delta, not from CPI transfer parsing.
2. **Marketplace purchase creation** is not yet automated in E2E; the script injects a synthetic `PurchaseEvent`. A full Marketplace → Gateway integration (create workflow → purchase → auto-detect) is planned.
3. **Real TEE** provider path exists but default E2E uses `gramine-local` mock.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `RefTooLong (6034)` on `post_task` | `evalRef` exceeds 128 bytes | Shorten `workflowId` / `purchaseId` or use `buildEvalRef` |
| `post_task failed` repeatedly | Arena program config/taskCount mismatch | Ensure `getNextTaskId` returns the on-chain `taskCount` |
| E2E times out at `EXECUTING` | VEL provider not initialized | Check `/tmp/gateway-e2e.sock` and `provider.initialize()` |

## Related Docs

- `docs/03-technical-spec-workflow-execution-gateway.md`
- `docs/05-test-spec-workflow-execution-gateway.md`
- `TEE_INTEGRATION.md` (for VEL configuration)
