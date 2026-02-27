# Monad OpenClaw Skill

Minimal, purpose-built toolset for Monad + OpenClaw (TypeScript bridge + Zig core runtime):

- Payment/settlement intents (per-call or subscription)
- ERC20/native transfers + DEX swap compose
- LI.FI quote/workflow via Zig core actions
- Morpho vault compose (ERC4626)
- Analysis → simulate → execute workflow for transfers

> This repo is intentionally small and hackathon-focused. It avoids the full pi-chain-tools surface area.

## Install (local)

Initialize submodules first (required for `zig-core/deps/zigeth` and pinned `defi-cli`):

```bash
npm run bootstrap:submodules
```

```bash
openclaw plugins install /Users/davirian/dev/gradience
openclaw plugins enable monad-openclaw-skill
openclaw gateway restart
```

## Default RPC

Set RPC URL if needed:

```bash
export MONAD_RPC_URL="https://rpc.monad.xyz"
```

## Zig Core

This repo includes the Zig core in `zig-core/`. Tool execution routes through Zig by default.

```bash
cd zig-core
zig build
python3 tests/offline.py
python3 tests/smoke.py
```

Or from repo root:

```bash
npm run zig:test
```

Zig-backed execution is enabled by default. Disable it if needed:

```bash
export MONAD_USE_ZIG_CORE=0
```

Bridge-only TS guard (ensures `src/` stays as a thin wrapper around Zig):

```bash
npm run src:verify-bridge
```

Full local verification:

```bash
npm run verify
```

`verify` includes an execution CLI smoke check to ensure CLI-first transaction flow remains available.

Full verification including Zig offline suite:

```bash
npm run verify:full
```

Bridge runtime smoke check:

```bash
npm run verify:bridge-smoke
```

Submodule-only verification:

```bash
npm run verify:submodules
```

`verify:submodules` also ensures submodules are checked out at the pinned commit in the parent repo index.
It also fails if any submodule working tree has uncommitted changes.

Optional override if binary is not in the default path (`zig-core/zig-out/bin/gradience-zig`):

```bash
export GRADIENCE_ZIG_BIN="/absolute/path/to/gradience-zig"
```

Current Zig-routed tools:

- All `monad_*` tools are routed through Zig core via the bridge manifest in `src/tools/monad-tool-manifest.ts`.

Zig foundation actions (defi-cli style groundwork) are available in `zig-core` protocol:

Protocol details: `zig-core/PROTOCOL.md`

- `schema`
- `version`
- `providersList`
- `runtimeInfo`
- `cachePolicy`
- `policyCheck`
- `normalizeChain`
- `assetsResolve`
- `chainsTop`
- `chainsAssets`
- `yieldOpportunities`
- `bridgeQuote`
- `swapQuote`
- `lendMarkets`
- `lendRates`
- `normalizeAmount`
- `cachePut`
- `cacheGet`
- `rpcCallCached`

`providersList` supports optional filters: `name`, `category`, `capability`, plus optional `select`.

Most listing/query actions support `resultsOnly: true` to place data under a `results` field.

`chainsTop` supports `limit` and optional `select` (for example: `chain,rank`).

`chainsAssets` supports `chain` (required), with optional `asset` and `limit` filters.

`yieldOpportunities` supports filters: `chain`, `asset`, `provider`, `minTvlUsd`, `sortBy`, `order`, `limit`, `select`.

`bridgeQuote` supports `from`, `to`, `asset`, `amount` with optional `provider` and `select`.

`swapQuote` supports exact-input and exact-output modes with aliases (`type`/`tradeType`/`trade_type`,
`amount`/`amountIn`, `amountOut`/`amount_out`, `amountOutDecimal`/`amount_out_decimal`), plus `source` and
`tradeType` in responses.

`lendMarkets` supports filters: `chain`, `asset`, `provider`, `minTvlUsd`, `sortBy`, `order`, `limit`, `select`.

`lendRates` supports `chain`, `asset`, `provider`, with optional `select`.

`rpcCallCached` now applies method policy defaults (`ttlSeconds`, `maxStaleSeconds`, `allowStaleFallback`) and supports overriding via params.

Runtime controls (optional):

- `ZIG_CORE_ALLOWLIST` (comma-separated action allowlist)
- `ZIG_CORE_STRICT=1` (bypass fresh-cache short-circuit for `rpcCallCached`)
- In strict mode, raw broadcast is disabled unless `ZIG_CORE_ALLOW_BROADCAST=1`
- `ZIG_CORE_DEFAULT_CACHE_TTL` / `ZIG_CORE_DEFAULT_MAX_STALE`

## Tools

Core tools + strategy compiler/runner are documented in `skills/monad-pay-exec/SKILL.md`.

## Using with OpenCode / Pi / Codex agents

You can use this repo with generic coding agents even without OpenClaw skill loading.

- Give the agent `skills/monad-pay-exec/SKILL.md` as behavior/tooling reference.
- Ask the agent to run `npm run verify:full` before and after changes.
- For direct Zig action calls, use the binary protocol in `src/integrations/zig-core.ts`:
  send JSON on stdin with `{ "action": "...", "params": { ... } }`, parse JSON from stdout.
- Reusable prompt template: `docs/AGENT_PROMPT_TEMPLATE.md`.

## Dashboard

Start the local dashboard:

```bash
npm run dashboard:dev
```

Dashboard is observe-only by default (read APIs only).
To enable write/mutation APIs for local admin flows:

```bash
npm run dashboard:dev:mutate
```

Open `http://127.0.0.1:4173` to view strategies and execution logs.

## Execution CLI (primary)

Use the execution CLI for real transaction flow (build -> sign -> send):

```bash
npm run exec:cli -- help
```

Common examples:

```bash
# Native transfer
npm run exec:cli -- native-transfer --to-address 0x... --amount-wei 1000000000000000 --from-address 0x...

# Execute prebuilt txRequest JSON
npm run exec:cli -- tx-request --tx-request-file ./tx-request.json --from-address 0x...

# Build + send arbitrary Zig build action
npm run exec:cli -- build-send --build-action buildErc20Approve --build-params-json '{"tokenAddress":"0x...","spender":"0x...","amountRaw":"1000000"}'

# Dedicated execution commands
npm run exec:cli -- erc20-approve --token-address 0x... --spender 0x... --amount-raw 1000000
npm run exec:cli -- dex-swap --router 0x... --amount-in 1000000 --amount-out-min 990000 --path 0xTokenIn,0xTokenOut --to 0x... --deadline 1760000000
npm run exec:cli -- swap-flow --token-address 0xTokenIn --router 0xRouter --amount-in 1000000 --amount-out-min 990000 --path 0xTokenIn,0xTokenOut --to 0xReceiver --deadline 1760000000 --wait-approve true --watch true
npm run exec:cli -- vault-flow --token-address 0xUnderlying --vault-address 0xVault --amount-raw 1000000 --receiver 0xReceiver --wait-approve true --watch true
npm run exec:cli -- withdraw-swap-flow --vault-address 0xVault --withdraw-amount-raw 1000000 --receiver 0xReceiver --owner 0xOwner --router 0xRouter --amount-out-min 990000 --path 0xTokenIn,0xTokenOut --to 0xReceiver --deadline 1760000000 --wait-withdraw true --watch true
npm run exec:cli -- vault-exit-flow --mode withdraw --vault-address 0xVault --amount-raw 1000000 --receiver 0xReceiver --owner 0xOwner --swap true --router 0xRouter --amount-out-min 990000 --path 0xTokenIn,0xTokenOut --to 0xReceiver --deadline 1760000000 --watch true
npm run exec:cli -- swap-flow --token-address 0xTokenIn --router 0xRouter --amount-in 1000000 --amount-out-min 990000 --path 0xTokenIn,0xTokenOut --to 0xReceiver --deadline 1760000000 --dry-run true
npm run exec:cli -- morpho-vault-deposit --vault-address 0x... --amount-raw 1000000 --receiver 0x...

Flow risk controls (available on flow commands like `swap-flow`, `vault-flow`, `withdraw-swap-flow`, `vault-exit-flow`):

- `--max-gas-wei <integer>`: fail if built tx gas/gasLimit exceeds threshold
- `--require-receipt-confirmed true|false` (default `true`): require watch result to be confirmed
- `--fail-on-timeout true|false` (default `true`): treat watch timeout as failure
- `--dry-run true|false` (default `false`): build and validate txRequests only (no sign/send)
- `--output full|summary|txrequest` (default `full`): choose JSON verbosity / txRequest extraction mode

`summary` mode normalizes key fields for automation (`status`, `executionId`, `txHash`, `receiptStatus`, timing fields) and includes `flowSummary.steps` for flow commands.
`flowSummary.steps[*].kind` uses canonical values: `approve | swap | deposit | withdraw | exit`, and each step includes stable `order`.
`summary` also includes `commandType` (`execution|flow|observer`) and `resourceType` (for example `native-transfer|approve|vault-flow|watch|receipt`).
`summary` and `txrequest` both include `schemaVersion` (currently `"1"`) for parser compatibility.

Summary minimum fields by command type:

- `execution`: `schemaVersion`, `status`, `commandType=execution`, `resourceType`, `action`, `dryRun` (for dry-run cases)
- `flow`: `schemaVersion`, `status`, `commandType=flow`, `resourceType`, `flow`, `flowSummary.steps`
- `observer`: `schemaVersion`, `status`, `commandType=observer`, `resourceType`, `action`, `receiptStatus`

Common `resourceType` mapping:

- `native-transfer` dry-run summary -> `native-transfer`
- `erc20-approve` dry-run summary -> `approve`
- `tx-request` dry-run summary -> `txrequest`
- `morpho-vault-deposit` dry-run summary -> `vault-deposit`
- `receipt` summary -> `receipt`
- `watch` summary -> `watch`
- `swap-flow` / `vault-flow` / `withdraw-swap-flow` / `vault-exit-flow` summary -> same as flow id

Detailed schema reference: `docs/exec-cli-output-schema.md`.

Output mode examples:

```bash
# Compact flow summary
npm run exec:cli -- swap-flow --token-address 0xTokenIn --router 0xRouter --amount-in 1000000 --amount-out-min 990000 --path 0xTokenIn,0xTokenOut --to 0xReceiver --deadline 1760000000 --dry-run true --output summary

# TxRequest-focused output (single command)
npm run exec:cli -- native-transfer --to-address 0x... --amount-wei 1 --dry-run true --output txrequest

# TxRequest-focused output (flow command returns txRequest step list)
npm run exec:cli -- vault-flow --token-address 0xUnderlying --vault-address 0xVault --amount-raw 1000000 --receiver 0xReceiver --dry-run true --output txrequest
```

Example summary payload excerpt:

```json
{
  "status": "ok",
  "flow": "vault-flow",
  "flowSummary": {
    "steps": [
      { "step": "approve", "kind": "approve", "label": "Approve", "order": 1, "dryRun": true },
      { "step": "deposit", "kind": "deposit", "label": "Deposit", "order": 2, "dryRun": true }
    ]
  }
}
```

Example txrequest payload excerpt:

```json
{
  "status": "ok",
  "flow": "swap-flow",
  "source": "steps",
  "txRequest": [
    { "action": "buildErc20Approve", "txRequest": { "to": "0x..." } },
    { "action": "buildDexSwap", "txRequest": { "to": "0x..." } }
  ]
}
```

`txrequest` mode includes `source` values: `single` (direct txRequest), `steps` (flow dry-run steps), `nested` (extracted from nested result objects).

Note: observer commands (`receipt`, `watch`) do not support `--output txrequest`; they return `status=error` with `errorType=exec-cli`.

Script parsing recommendation:

- Check `schemaVersion` first, then branch by `--output` mode.
- In `summary`, branch by `commandType` then `resourceType`; for flows read `flowSummary.steps[*].kind`.
- In `txrequest`, branch by `source` (`single|steps|nested`) before decoding `txRequest` payload shape.

Minimal parser pseudocode:

```ts
function handleExecCliOutput(payload: any, mode: "summary" | "txrequest" | "full") {
  if (payload?.status === "error") {
    if (payload.schemaVersion !== "1") throw new Error("unsupported error schema");
    throw new Error(payload.message || "exec-cli error");
  }

  if (mode !== "full" && payload.schemaVersion !== "1") throw new Error("unsupported schema version");

  if (mode === "summary") {
    if (payload.commandType === "flow") return payload.flowSummary?.steps ?? [];
    if (payload.commandType === "observer") return { txHash: payload.txHash, receiptStatus: payload.receiptStatus };
    return { executionId: payload.executionId, resourceType: payload.resourceType };
  }

  if (mode === "txrequest") {
    if (payload.source === "single") return [payload.txRequest];
    if (payload.source === "steps") return payload.txRequest.map((x: any) => x.txRequest);
    if (payload.source === "nested") return payload.txRequest.map((x: any) => x.txRequest);
  }

  return payload;
}
```

npm run exec:cli -- morpho-vault-withdraw --vault-address 0x... --amount-raw 1000000 --receiver 0x... --owner 0x...
npm run exec:cli -- morpho-vault-redeem --vault-address 0x... --shares-raw 1000000 --receiver 0x... --owner 0x...

# Receipt + watch
npm run exec:cli -- receipt --tx-hash 0x...
npm run exec:cli -- watch --execution-id exec_cli_native_transfer_... --timeout-ms 60000 --interval-ms 3000
```

Execution CLI requires signer adapter URL:

- `GRADIENCE_SIGNER_URL`

Example signer adapter contract (`GRADIENCE_SIGNER_URL` target):

- Request: `{ "txRequest": { ... }, "fromAddress": "0x..." }`
- Response: `{ "signedTxHex": "0x...", "signer": "my-signer" }`

## Dashboard execute API (optional, disabled by default)

Dashboard write endpoints are disabled unless explicitly enabled:

- `DASHBOARD_ENABLE_MUTATION_API=1`
- `DASHBOARD_OBSERVE_ONLY=0`
- `DASHBOARD_ENABLE_EXECUTE_API=1`
- By default, execute endpoints accept loopback requests only (`127.0.0.1` / `::1`).
- To allow remote callers (not recommended), set `DASHBOARD_ALLOW_REMOTE_EXECUTE_API=1`.

Runtime mode visibility endpoint:

- `GET /api/runtime/capabilities`

When enabled, available endpoints are:

- `POST /api/execute/native-transfer`
- Body: `{ "toAddress": "0x...", "amountWei": "...", "fromAddress": "0x...", "rpcUrl": "..." }`

Additional execution endpoints:

- `POST /api/execute/tx-request`
  - Body: `{ "txRequest": { ... }, "fromAddress": "0x...", "rpcUrl": "..." }`
- `POST /api/execute/erc20-approve`
  - Body: `{ "tokenAddress": "0x...", "spender": "0x...", "amountRaw": "...", "fromAddress": "0x...", "rpcUrl": "..." }`
- `POST /api/execute/dex-swap`
  - Body: `{ "router": "0x...", "amountIn": "...", "amountOutMin": "...", "path": ["0x...","0x..."], "to": "0x...", "deadline": "..." }`
- `POST /api/execute/morpho-vault-deposit`
  - Body: `{ "vaultAddress": "0x...", "amountRaw": "...", "receiver": "0x...", "fromAddress": "0x...", "rpcUrl": "..." }`
- `POST /api/execute/morpho-vault-withdraw`
  - Body: `{ "vaultAddress": "0x...", "amountRaw": "...", "receiver": "0x...", "owner": "0x...", "fromAddress": "0x...", "rpcUrl": "..." }`
- `POST /api/execute/morpho-vault-redeem`
  - Body: `{ "vaultAddress": "0x...", "sharesRaw": "...", "receiver": "0x...", "owner": "0x...", "fromAddress": "0x...", "rpcUrl": "..." }`
- `GET /api/executions/:id/receipt?rpcUrl=https://...`
  - Fetches `eth_getTransactionReceipt` for stored execution `txHash`
- `POST /api/executions/:id/watch`
  - Body (optional): `{ "rpcUrl": "https://...", "timeoutMs": 60000, "intervalMs": 3000 }`
  - Polls receipt until `confirmed` / `failed` or returns `status: "timeout"`
  - On `confirmed` / `failed`, execution row status is updated in storage

## FastAPI (optional, read-only)

Run the parallel FastAPI service (read-only + write proxy) for gradual migration:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will listen on `http://127.0.0.1:8000`.

FastAPI can serve the dashboard static files at `/` (set `DASHBOARD_STATIC_PATH` if needed).

The dashboard includes API Base URL quick switches for Node (`:4173`) and FastAPI (`:8000`) and shows the current API type label.

FastAPI `/health` now includes version + config details + start time + uptime + instanceId + buildCommit + errors, and `/health/node` checks Node reachability + latency. The dashboard auto-pauses refresh on health failures and resumes with duration info, with health details copy and collapsible error list plus last-error/updated time and collapse status, plus API settings panel toggle and status label; error details/last error can be copied, and error details hide when empty, with interval display shown only when auto refresh is enabled and countdown tooltip for next refresh (click to refresh), and advanced settings hint when collapsed (click to expand) plus copy/reset URL buttons (reset -> Node default) and active button highlight. Alt+N/Alt+F switches API base quickly; invalid URLs are blocked on save, Base URL history is stored and selectable with clear/copy current URL (confirm to clear) with max 5 entries.

The dashboard API info can auto-refresh with configurable interval (default 5s).

In the dashboard, set **API Base URL** to `http://127.0.0.1:8000` to use FastAPI instead of Node.

To export templates for FastAPI:

```bash
npm run export:templates
```

Write endpoints (`POST /api/strategies`, `POST /api/strategies/:id/run`) proxy to the Node dashboard API.
Set `NODE_API_URL` if the Node dashboard runs elsewhere.
