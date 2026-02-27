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

Open `http://127.0.0.1:4173` to view strategies and execution logs.

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
