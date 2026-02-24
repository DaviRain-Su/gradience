# Monad OpenClaw Skill

Minimal, purpose-built toolset for Monad + OpenClaw (implemented with ethers v6 + LI.FI SDK + Morpho SDK):

- Payment/settlement intents (per-call or subscription)
- ERC20/native transfers + DEX swap compose
- LI.FI quote via SDK
- Morpho vault compose (ERC4626)
- Analysis → simulate → execute workflow for transfers

> This repo is intentionally small and hackathon-focused. It avoids the full pi-chain-tools surface area.

## Install (local)

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

## Zig Core (optional)

This repo now includes a Zig PoC core in `zig-core/` and can route selected tools through Zig + zigeth.

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

Optional override if binary is not in the default path (`zig-core/zig-out/bin/gradience-zig`):

```bash
export GRADIENCE_ZIG_BIN="/absolute/path/to/gradience-zig"
```

Current Zig-routed tools:

- `monad_getBalance`
- `monad_getErc20Balance`
- `monad_getBlockNumber`
- `monad_buildTransferNative`
- `monad_buildTransferErc20`
- `monad_buildErc20Approve`
- `monad_buildDexSwap`
- `monad_sendSignedTransaction`
- `monad_runTransferWorkflow`

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
- `normalizeAmount`
- `cachePut`
- `cacheGet`
- `rpcCallCached`

`rpcCallCached` now applies method policy defaults (`ttlSeconds`, `maxStaleSeconds`, `allowStaleFallback`) and supports overriding via params.

Runtime controls (optional):

- `ZIG_CORE_ALLOWLIST` (comma-separated action allowlist)
- `ZIG_CORE_STRICT=1` (bypass fresh-cache short-circuit for `rpcCallCached`)
- In strict mode, raw broadcast is disabled unless `ZIG_CORE_ALLOW_BROADCAST=1`
- `ZIG_CORE_DEFAULT_CACHE_TTL` / `ZIG_CORE_DEFAULT_MAX_STALE`

## Tools

Core tools + strategy compiler/runner are documented in `skills/monad-pay-exec/SKILL.md`.

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
