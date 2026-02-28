import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createHmac } from "node:crypto";
import { compileStrategy } from "./lib/strategy/compiler.js";
import { validateStrategy } from "./lib/strategy/validator.js";
import { runStrategy } from "./lib/strategy/runner.js";
import { STRATEGY_TEMPLATES } from "./lib/strategy/templates.js";
import {
  addExecution,
  getExecution,
  getStrategy,
  listExecutions,
  listStrategies,
  openDb,
  saveStrategy,
  updateExecution,
} from "./lib/storage/db.js";
import { createSignerAdapterFromEnv } from "../execution/signer-adapter.js";
import {
  executeSignedBuildAction,
  executeSignedNativeTransfer,
  fetchTransactionReceipt,
  signAndSendTxRequest,
} from "../execution/zig-executor.js";
import type { SignerAdapter } from "../execution/signer-adapter.js";
import {
  type DefiPool,
  type DefiPoolEntry,
  fetchParsedDefiPools,
  zigDefiEnabled,
  type DefiPoolQuery,
} from "./lib/defi/pool-parser.js";
import {
  recordDefiCacheAge,
  recordDefiRequestMetric,
  recordDefiUpstreamError,
  recordDefiUpstreamRetries,
  renderDefiMetrics,
} from "./lib/defi/metrics.js";

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT || 4173);
const MAX_DEFI_POOL_FETCH_LIMIT = 5000;
const CURRENT_CURSOR_VERSION = 1;
const dbHandle = await openDb(process.env.STRATEGY_DB_PATH);
const dashboardObserveOnly = process.env.DASHBOARD_OBSERVE_ONLY !== "0";
const dashboardMutationApiEnabled = process.env.DASHBOARD_ENABLE_MUTATION_API === "1";
const executeApiEnabled = process.env.DASHBOARD_ENABLE_EXECUTE_API === "1";
const executeApiAllowRemote = process.env.DASHBOARD_ALLOW_REMOTE_EXECUTE_API === "1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createExecutionId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

function getSignerOrRespond(res: express.Response): SignerAdapter | null {
  const signer = createSignerAdapterFromEnv();
  if (signer.id === "disabled") {
    res.status(501).json({
      status: "not_configured",
      message: "configure GRADIENCE_SIGNER_URL to enable transaction signing",
    });
    return null;
  }
  return signer;
}

function persistManualExecution(input: {
  idPrefix: string;
  type: string;
  payload: Record<string, unknown>;
  evidence: Record<string, unknown>;
}): string {
  const executionId = createExecutionId(input.idPrefix);
  addExecution(dbHandle, {
    id: executionId,
    strategyId: "manual",
    mode: "execute",
    status: "submitted",
    payload: input.payload,
    evidence: {
      type: input.type,
      ...input.evidence,
    },
  });
  return executionId;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLoopbackAddress(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1" ||
    normalized === "localhost"
  );
}

function isLocalExecuteRequest(req: express.Request): boolean {
  const remoteAddress = req.socket?.remoteAddress;
  const ip = req.ip;
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return false;
  return isLoopbackAddress(remoteAddress) || isLoopbackAddress(ip);
}

function queryString(req: express.Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function queryNumber(req: express.Request, key: string): number | undefined {
  const value = queryString(req, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePoolsQuery(req: express.Request, defaults?: { limit?: number }): DefiPoolQuery {
  const kind = queryString(req, "kind") === "lend" ? "lend" : "yield";
  const chain = queryString(req, "chain");
  const asset = queryString(req, "asset");
  const provider = queryString(req, "provider");
  const liveMode = queryString(req, "liveMode") || "auto";
  const liveProvider = queryString(req, "liveProvider") || "auto";
  const sortBy = queryString(req, "sortBy");
  const order = queryString(req, "order") === "asc" ? "asc" : "desc";
  const rawLimit = queryNumber(req, "limit");
  const limit = Math.max(1, Math.min(MAX_DEFI_POOL_FETCH_LIMIT, Math.trunc(rawLimit ?? defaults?.limit ?? 100)));
  const minTvlUsd = queryNumber(req, "minTvlUsd");
  return {
    kind,
    chain,
    asset,
    provider,
    liveMode,
    liveProvider,
    sortBy,
    order,
    limit,
    minTvlUsd,
  };
}

function poolsQuerySignature(query: DefiPoolQuery): string {
  const payload = JSON.stringify({
    kind: query.kind,
    chain: query.chain || null,
    asset: query.asset || null,
    provider: query.provider || null,
    minTvlUsd: query.minTvlUsd ?? null,
    liveMode: query.liveMode || "auto",
    liveProvider: query.liveProvider || "auto",
    sortBy: query.sortBy || null,
    order: query.order || "desc",
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

function parsePageSize(req: express.Request, fallback = 50): number {
  const raw = queryNumber(req, "pageSize");
  const value = raw ?? fallback;
  return Math.max(1, Math.min(500, Math.trunc(value)));
}

function cursorTtlSeconds(): number {
  const parsed = Number(process.env.DEFI_POOL_CURSOR_TTL_SECONDS || 300);
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return Math.max(30, Math.trunc(parsed));
}

function cursorSecret(): string {
  const configured = String(process.env.DEFI_POOL_CURSOR_SECRET || "").trim();
  if (configured) return configured;
  return "gradience-cursor-dev-secret";
}

function cursorPayloadString(payload: { o: number; q: string; p: number; i: number }): string {
  return JSON.stringify(payload);
}

function cursorMacV0(payload: { o: number; q: string; p: number; i: number }): string {
  return createHmac("sha256", cursorSecret()).update(cursorPayloadString(payload)).digest("hex");
}

function cursorPayloadStringV1(payload: { v: number; o: number; q: string; p: number; i: number }): string {
  return JSON.stringify(payload);
}

function cursorMacV1(payload: { v: number; o: number; q: string; p: number; i: number }): string {
  return createHmac("sha256", cursorSecret()).update(cursorPayloadStringV1(payload)).digest("hex");
}

function encodeCursor(offset: number, signature: string, pageSize: number): string {
  const payload = { v: CURRENT_CURSOR_VERSION, o: offset, q: signature, p: pageSize, i: Date.now() };
  const token = JSON.stringify({ ...payload, m: cursorMacV1(payload) });
  return Buffer.from(token).toString("base64url");
}

function decodeCursor(
  token: string,
): { offset: number; signature: string; pageSize: number; issuedAtMs: number; version: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      v?: unknown;
      o?: unknown;
      q?: unknown;
      p?: unknown;
      i?: unknown;
      m?: unknown;
    };
    const version = Number(parsed.v ?? 0);
    const offset = Number(parsed.o);
    const signature = typeof parsed.q === "string" ? parsed.q : "";
    const pageSize = Number(parsed.p);
    const issuedAtMs = Number(parsed.i);
    const mac = typeof parsed.m === "string" ? parsed.m : "";
    if (!Number.isFinite(version) || version < 0) return null;
    if (!Number.isFinite(offset) || offset < 0) return null;
    if (!signature) return null;
    if (!Number.isFinite(pageSize) || pageSize <= 0) return null;
    if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return null;

    const normalizedVersion = Math.trunc(version);
    const o = Math.trunc(offset);
    const p = Math.trunc(pageSize);
    const i = Math.trunc(issuedAtMs);

    if (normalizedVersion === 0) {
      const payloadV0 = { o, q: signature, p, i };
      if (mac !== cursorMacV0(payloadV0)) return null;
    } else if (normalizedVersion === 1) {
      const payloadV1 = { v: normalizedVersion, o, q: signature, p, i };
      if (mac !== cursorMacV1(payloadV1)) return null;
    } else {
      return null;
    }

    return {
      offset: o,
      signature,
      pageSize: p,
      issuedAtMs: i,
      version: normalizedVersion,
    };
  } catch {
    return null;
  }
}

function isCursorExpired(cursor: { issuedAtMs: number }): boolean {
  const ttlMs = cursorTtlSeconds() * 1000;
  return Date.now() - cursor.issuedAtMs > ttlMs;
}

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined, order: "asc" | "desc"): number {
  const av = a ?? (order === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  const bv = b ?? (order === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  return order === "asc" ? av - bv : bv - av;
}

function compareNullableString(a: string | null | undefined, b: string | null | undefined, order: "asc" | "desc"): number {
  const av = (a || "").toLowerCase();
  const bv = (b || "").toLowerCase();
  if (av === bv) return 0;
  const result = av < bv ? -1 : 1;
  return order === "asc" ? result : -result;
}

function applyLocalPoolSort(pools: DefiPool[], sortBy: string | undefined, order: "asc" | "desc" | undefined): DefiPool[] {
  const normalizedOrder = order === "asc" ? "asc" : "desc";
  const key = String(sortBy || "apyPct").trim();
  const sorted = [...pools].sort((left, right) => {
    let result = 0;
    if (key === "tvlUsd") {
      result = compareNullableNumber(left.tvlUsd, right.tvlUsd, normalizedOrder);
    } else if (key === "apyPct") {
      result = compareNullableNumber(left.apyPct, right.apyPct, normalizedOrder);
    } else if (key === "baseApyPct") {
      result = compareNullableNumber(left.baseApyPct, right.baseApyPct, normalizedOrder);
    } else if (key === "rewardApyPct") {
      result = compareNullableNumber(left.rewardApyPct, right.rewardApyPct, normalizedOrder);
    } else if (key === "borrowApyPct") {
      result = compareNullableNumber(left.borrowApyPct, right.borrowApyPct, normalizedOrder);
    } else if (key === "utilizationPct") {
      result = compareNullableNumber(left.utilizationPct, right.utilizationPct, normalizedOrder);
    } else if (key === "fetchedAtUnix") {
      result = compareNullableNumber(left.fetchedAtUnix, right.fetchedAtUnix, normalizedOrder);
    } else if (key === "provider") {
      result = compareNullableString(left.provider, right.provider, normalizedOrder);
    } else if (key === "chain") {
      result = compareNullableString(left.chain, right.chain, normalizedOrder);
    } else if (key === "asset") {
      result = compareNullableString(left.asset, right.asset, normalizedOrder);
    } else {
      result = compareNullableNumber(left.apyPct, right.apyPct, normalizedOrder);
    }
    if (result !== 0) return result;
    return compareNullableString(left.id, right.id, "asc");
  });
  return sorted;
}

function sortPoolEntries(
  entries: DefiPoolEntry[],
  sortBy: string | undefined,
  order: "asc" | "desc" | undefined,
): DefiPoolEntry[] {
  const sortedPools = applyLocalPoolSort(
    entries.map((entry) => entry.pool),
    sortBy,
    order,
  );
  const queueByPoolId = new Map<string, DefiPoolEntry[]>();
  for (const entry of entries) {
    const key = entry.pool.id;
    const queue = queueByPoolId.get(key) || [];
    queue.push(entry);
    queueByPoolId.set(key, queue);
  }
  const sortedEntries: DefiPoolEntry[] = [];
  for (const pool of sortedPools) {
    const queue = queueByPoolId.get(pool.id);
    if (!queue || queue.length === 0) continue;
    const next = queue.shift();
    if (next) sortedEntries.push(next);
  }
  return sortedEntries;
}

function parseDiagnosticsSelection(req: express.Request): {
  includeDiagnostics: boolean;
  includeFieldMapping: boolean;
  includeRaw: boolean;
} {
  const includeDiagnostics = queryString(req, "includeDiagnostics") === "1";
  if (!includeDiagnostics) {
    return {
      includeDiagnostics: false,
      includeFieldMapping: false,
      includeRaw: false,
    };
  }

  const rawFields = queryString(req, "diagnosticsFields") || "fieldMapping";
  const fields = new Set(
    rawFields
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  const includeRawFromLegacy = queryString(req, "includeRaw") === "1";
  return {
    includeDiagnostics: true,
    includeFieldMapping: fields.has("fieldMapping") || fields.size === 0,
    includeRaw: includeRawFromLegacy || fields.has("raw"),
  };
}

function metricDurationMs(startedAtMs: number): number {
  return Date.now() - startedAtMs;
}

function extractUpstreamErrorCode(message: string): string {
  const match = /\(code=(\d+)\)/.exec(message);
  if (!match) return "unknown";
  return match[1] || "unknown";
}

function isMorphoLiveConfigError(message: string): boolean {
  return message.includes("no source is configured") || message.includes("DEFI_MORPHO_POOLS_URL is unset");
}

function liveConfigSnapshot() {
  const morphoPoolsUrl = String(process.env.DEFI_MORPHO_POOLS_URL || "").trim();
  const morphoApiUrl = String(process.env.DEFI_MORPHO_API_URL || "https://api.morpho.org/graphql").trim();
  return {
    morpho: {
      envKey: "DEFI_MORPHO_POOLS_URL|DEFI_MORPHO_API_URL",
      configured: Boolean(morphoPoolsUrl || morphoApiUrl),
      source: morphoPoolsUrl ? "direct_url" : "morpho_api",
      endpoint: morphoPoolsUrl || morphoApiUrl || null,
    },
    aave: {
      envKey: "DEFI_AAVE_POOLS_URL",
      configured: Boolean(String(process.env.DEFI_AAVE_POOLS_URL || "").trim()),
    },
    kamino: {
      envKey: "DEFI_KAMINO_POOLS_URL",
      configured: Boolean(String(process.env.DEFI_KAMINO_POOLS_URL || "").trim()),
    },
  };
}

function canonicalDirectProvider(value: string | undefined): "morpho" | "aave" | "kamino" | null {
  const v = String(value || "").trim().toLowerCase();
  if (v.includes("morpho")) return "morpho";
  if (v.includes("aave")) return "aave";
  if (v.includes("kamino")) return "kamino";
  return null;
}

function resolveEffectiveDirectProvider(poolQuery: DefiPoolQuery): "morpho" | "aave" | "kamino" | null {
  const requestedLiveProvider = String(poolQuery.liveProvider || "auto").trim().toLowerCase();
  if (requestedLiveProvider && requestedLiveProvider !== "auto") {
    return canonicalDirectProvider(requestedLiveProvider);
  }

  const providerHint = canonicalDirectProvider(poolQuery.provider || undefined);
  if (providerHint) return providerHint;

  const cfg = liveConfigSnapshot();
  if (cfg.morpho.configured) return "morpho";
  if (cfg.aave.configured) return "aave";
  if (cfg.kamino.configured) return "kamino";
  return null;
}

function livePlan(poolQuery: DefiPoolQuery) {
  const cfg = liveConfigSnapshot();
  const requestedLiveMode = String(poolQuery.liveMode || "auto").trim().toLowerCase() || "auto";
  const requestedLiveProvider = String(poolQuery.liveProvider || "auto").trim().toLowerCase() || "auto";
  const effectiveProvider = resolveEffectiveDirectProvider(poolQuery);
  const envByProvider = {
    morpho: cfg.morpho,
    aave: cfg.aave,
    kamino: cfg.kamino,
  };
  const requiredEnvKey = effectiveProvider ? envByProvider[effectiveProvider].envKey : null;
  const readyForLive =
    requestedLiveMode !== "live"
      ? true
      : effectiveProvider
        ? envByProvider[effectiveProvider].configured
        : false;

  return {
    requestedLiveMode,
    requestedLiveProvider,
    effectiveProvider,
    requiredEnvKey,
    readyForLive,
    config: cfg,
  };
}

app.use(express.json());
app.use("/", express.static(path.join(__dirname, "public")));
app.use("/api", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const method = req.method.toUpperCase();
  const isReadOnly = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (isReadOnly) {
    next();
    return;
  }
  if (!dashboardMutationApiEnabled) {
    res.status(403).json({
      status: "disabled",
      message:
        "dashboard mutation APIs are disabled; use CLI workflows or set DASHBOARD_ENABLE_MUTATION_API=1",
    });
    return;
  }
  next();
});
app.use("/api/execute", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (dashboardObserveOnly) {
    res.status(403).json({
      status: "disabled",
      message:
        "dashboard is in observe-only mode; use exec CLI (npm run exec:cli -- help) or set DASHBOARD_OBSERVE_ONLY=0",
    });
    return;
  }
  if (!executeApiEnabled) {
    res.status(403).json({
      status: "disabled",
      message: "dashboard execute API is disabled; use exec CLI or set DASHBOARD_ENABLE_EXECUTE_API=1",
    });
    return;
  }
  if (!executeApiAllowRemote && !isLocalExecuteRequest(req)) {
    res.status(403).json({
      status: "forbidden",
      message:
        "dashboard execute API accepts loopback requests only; use exec CLI for remote execution or set DASHBOARD_ALLOW_REMOTE_EXECUTE_API=1",
    });
    return;
  }
  next();
});

app.get("/api/runtime/capabilities", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    capabilities: {
      dashboardObserveOnly,
      dashboardMutationApiEnabled,
      executeApiEnabled,
      executeApiAllowRemote,
      executionPath: "cli-primary",
      execCliCommand: "npm run exec:cli -- help",
    },
  });
});

app.get("/api/templates", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", templates: STRATEGY_TEMPLATES });
});

app.get("/api/defi/metrics", (_req: express.Request, res: express.Response) => {
  res.type("text/plain; version=0.0.4; charset=utf-8").send(renderDefiMetrics());
});

app.get("/api/defi/live-config", (_req: express.Request, res: express.Response) => {
  const config = liveConfigSnapshot();
  const ok = config.morpho.configured || config.aave.configured || config.kamino.configured;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "incomplete",
    config,
    hints: ok
      ? []
      : [
          "set DEFI_MORPHO_POOLS_URL or DEFI_MORPHO_API_URL to enable morpho live provider",
          "or force another provider with liveProvider=morpho|aave|kamino",
        ],
  });
});

app.get("/api/defi/live-plan", (req: express.Request, res: express.Response) => {
  const poolQuery = parsePoolsQuery(req, { limit: 5 });
  const plan = livePlan(poolQuery);
  res.status(plan.readyForLive ? 200 : 503).json({
    status: plan.readyForLive ? "ok" : "incomplete",
    query: {
      provider: poolQuery.provider || null,
      liveMode: poolQuery.liveMode || null,
      liveProvider: poolQuery.liveProvider || null,
    },
    plan,
    hints: plan.readyForLive
      ? []
      : [
          `set ${plan.requiredEnvKey || "a direct provider URL env"} for current live selection`,
          "or force another provider with liveProvider=morpho|aave|kamino",
        ],
  });
});

app.get("/api/defi/smoke/morpho-live", async (req: express.Request, res: express.Response) => {
  const startedAtMs = Date.now();
  if (!zigDefiEnabled()) {
    recordDefiRequestMetric({
      endpoint: "smoke",
      kind: "lend",
      status: "disabled",
      errorType: "none",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(503).json({ status: "disabled", message: "zig core is disabled" });
    return;
  }

  const kind = queryString(req, "kind") === "yield" ? "yield" : "lend";
  const asset = queryString(req, "asset") || "USDC";
  const limit = Math.max(1, Math.min(25, Math.trunc(queryNumber(req, "limit") ?? 5)));
  const expectSourceTransport = queryString(req, "expectSourceTransport") || "morpho_api";

  const query: DefiPoolQuery = {
    kind,
    chain: "monad",
    asset,
    provider: "morpho",
    liveMode: "live",
    liveProvider: "auto",
    limit,
    order: "desc",
    sortBy: "tvlUsd",
  };

  try {
    const parsed = await fetchParsedDefiPools(query);
    const first = parsed.pools[0] || null;
    const transportMatched = !expectSourceTransport || parsed.sourceTransport === expectSourceTransport;
    if (!transportMatched) {
      recordDefiRequestMetric({
        endpoint: "smoke",
        kind,
        status: "invalid",
        errorType: "validation",
        durationMs: metricDurationMs(startedAtMs),
        cache: {
          backend: parsed.cache.backend,
          hit: parsed.cache.hit,
          stale: parsed.cache.stale,
        },
      });
      recordDefiUpstreamRetries(parsed.cache.retryCount, parsed.cache.backend);
      recordDefiCacheAge(parsed.cache.ageMs, parsed.cache.backend);
      res.status(409).json({
        status: "transport_mismatch",
        elapsedMs: metricDurationMs(startedAtMs),
        expectedSourceTransport: expectSourceTransport,
        actualSourceTransport: parsed.sourceTransport,
        query,
        source: parsed.source,
        sourceProvider: parsed.sourceProvider,
        sourceUrl: parsed.sourceUrl,
        cache: parsed.cache,
        count: parsed.pools.length,
        first,
      });
      return;
    }

    recordDefiRequestMetric({
      endpoint: "smoke",
      kind,
      status: "ok",
      errorType: "none",
      durationMs: metricDurationMs(startedAtMs),
      cache: {
        backend: parsed.cache.backend,
        hit: parsed.cache.hit,
        stale: parsed.cache.stale,
      },
    });
    recordDefiUpstreamRetries(parsed.cache.retryCount, parsed.cache.backend);
    recordDefiCacheAge(parsed.cache.ageMs, parsed.cache.backend);
    res.json({
      status: "ok",
      elapsedMs: metricDurationMs(startedAtMs),
      query,
      expectedSourceTransport: expectSourceTransport,
      source: parsed.source,
      sourceProvider: parsed.sourceProvider,
      sourceUrl: parsed.sourceUrl,
      sourceTransport: parsed.sourceTransport,
      fetchedAtUnix: parsed.fetchedAtUnix,
      cache: parsed.cache,
      count: parsed.pools.length,
      first,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMorphoLiveConfigError(message)) {
      recordDefiRequestMetric({
        endpoint: "smoke",
        kind,
        status: "invalid",
        errorType: "config",
        durationMs: metricDurationMs(startedAtMs),
      });
      res.status(400).json({
        status: "invalid_config",
        elapsedMs: metricDurationMs(startedAtMs),
        message,
        query,
      });
      return;
    }
    const upstreamCode = extractUpstreamErrorCode(message);
    recordDefiRequestMetric({
      endpoint: "smoke",
      kind,
      status: "error",
      errorType: "upstream",
      durationMs: metricDurationMs(startedAtMs),
    });
    recordDefiUpstreamError(upstreamCode);
    res.status(502).json({
      status: "error",
      elapsedMs: metricDurationMs(startedAtMs),
      message,
      query,
    });
  }
});

app.get("/api/defi/pools", async (req: express.Request, res: express.Response) => {
  const startedAtMs = Date.now();
  const requestedKind = queryString(req, "kind") === "lend" ? "lend" : "yield";
  if (!zigDefiEnabled()) {
    recordDefiRequestMetric({
      endpoint: "list",
      kind: requestedKind,
      status: "disabled",
      errorType: "none",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(503).json({
      status: "disabled",
      message: "DeFi pool parsing requires zig core; set MONAD_USE_ZIG_CORE=1",
    });
    return;
  }

  const cursorRaw = queryString(req, "cursor");
  const pageSize = parsePageSize(req, 50);
  const diagnosticsSelection = parseDiagnosticsSelection(req);
  const parsedCursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !parsedCursor) {
    recordDefiRequestMetric({
      endpoint: "list",
      kind: requestedKind,
      status: "invalid",
      errorType: "validation",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(400).json({
      status: "invalid",
      message: "invalid cursor",
      expectedCursorVersion: CURRENT_CURSOR_VERSION,
    });
    return;
  }
  if (parsedCursor && isCursorExpired(parsedCursor)) {
    recordDefiRequestMetric({
      endpoint: "list",
      kind: requestedKind,
      status: "invalid",
      errorType: "cursor_expired",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(400).json({
      status: "invalid",
      message: "cursor expired",
      cursorTtlSeconds: cursorTtlSeconds(),
    });
    return;
  }
  if (parsedCursor && parsedCursor.pageSize !== pageSize) {
    recordDefiRequestMetric({
      endpoint: "list",
      kind: requestedKind,
      status: "invalid",
      errorType: "validation",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(400).json({
      status: "invalid",
      message: "cursor pageSize does not match requested pageSize",
    });
    return;
  }

  const offset = parsedCursor?.offset || 0;
  const baseQuery = parsePoolsQuery(req, { limit: Math.max(100, pageSize) });
  const signature = poolsQuerySignature(baseQuery);
  if (parsedCursor && parsedCursor.signature !== signature) {
    recordDefiRequestMetric({
      endpoint: "list",
      kind: baseQuery.kind,
      status: "invalid",
      errorType: "cursor_mismatch",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(400).json({ status: "invalid", message: "cursor does not match current query" });
    return;
  }

  const poolQuery: DefiPoolQuery = {
    ...baseQuery,
    limit: Math.max(baseQuery.limit, Math.min(MAX_DEFI_POOL_FETCH_LIMIT, offset + pageSize)),
  };

  try {
    const parsed = await fetchParsedDefiPools(poolQuery);
    const sortedEntries = sortPoolEntries(parsed.entries, poolQuery.sortBy, poolQuery.order);
    const pagedEntries = sortedEntries.slice(offset, offset + pageSize);
    const pagedPools = pagedEntries.map((entry) => entry.pool);
    const hasMore = sortedEntries.length > offset + pageSize;
    const truncatedByLimit = parsed.pools.length >= poolQuery.limit && poolQuery.limit >= MAX_DEFI_POOL_FETCH_LIMIT;
    const exhausted = !hasMore && !truncatedByLimit;
    const nextCursor = hasMore ? encodeCursor(offset + pageSize, signature, pageSize) : null;

    recordDefiRequestMetric({
      endpoint: "list",
      kind: poolQuery.kind,
      status: "ok",
      errorType: "none",
      durationMs: metricDurationMs(startedAtMs),
      cache: {
        backend: parsed.cache.backend,
        hit: parsed.cache.hit,
        stale: parsed.cache.stale,
      },
    });
    recordDefiUpstreamRetries(parsed.cache.retryCount, parsed.cache.backend);
    recordDefiCacheAge(parsed.cache.ageMs, parsed.cache.backend);

    res.json({
      status: "ok",
      query: {
        kind: poolQuery.kind,
        chain: poolQuery.chain || null,
        asset: poolQuery.asset || null,
        provider: poolQuery.provider || null,
        limit: poolQuery.limit,
        minTvlUsd: poolQuery.minTvlUsd ?? null,
        liveMode: poolQuery.liveMode,
        liveProvider: poolQuery.liveProvider,
        sortBy: poolQuery.sortBy || null,
        order: poolQuery.order,
      },
      pagination: {
        pageSize,
        offset,
        totalAvailable: sortedEntries.length,
        totalReturned: pagedPools.length,
        exhausted,
        truncatedByLimit,
        querySignature: signature,
        cursorVersion: CURRENT_CURSOR_VERSION,
        cursorTtlSeconds: cursorTtlSeconds(),
        nextCursor,
      },
      source: parsed.source,
      sourceProvider: parsed.sourceProvider,
      sourceUrl: parsed.sourceUrl,
      sourceTransport: parsed.sourceTransport,
      fetchedAtUnix: parsed.fetchedAtUnix,
      cache: parsed.cache,
      rawCount: parsed.rawCount,
      pools: pagedPools,
      diagnostics: diagnosticsSelection.includeDiagnostics
        ? pagedEntries.map((entry) => ({
            id: entry.pool.id,
            fieldMapping: diagnosticsSelection.includeFieldMapping ? entry.fieldMapping : undefined,
            raw: diagnosticsSelection.includeRaw ? entry.raw : undefined,
          }))
        : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMorphoLiveConfigError(message)) {
      const plan = livePlan(poolQuery);
      recordDefiRequestMetric({
        endpoint: "list",
        kind: poolQuery.kind,
        status: "invalid",
        errorType: "config",
        durationMs: metricDurationMs(startedAtMs),
      });
      res.status(400).json({
        status: "invalid_config",
        message,
        plan,
        hints: [
          `set ${plan.requiredEnvKey || "DEFI_MORPHO_POOLS_URL"} for current live provider`,
          "or set liveProvider=morpho|aave|kamino explicitly",
        ],
      });
      return;
    }
    const upstreamCode = extractUpstreamErrorCode(message);
    recordDefiRequestMetric({
      endpoint: "list",
      kind: poolQuery.kind,
      status: "error",
      errorType: "upstream",
      durationMs: metricDurationMs(startedAtMs),
    });
    recordDefiUpstreamError(upstreamCode);
    res.status(502).json({ status: "error", message });
  }
});

app.get("/api/defi/pools/:id", async (req: express.Request, res: express.Response) => {
  const startedAtMs = Date.now();
  const requestedKind = queryString(req, "kind") === "lend" ? "lend" : "yield";
  if (!zigDefiEnabled()) {
    recordDefiRequestMetric({
      endpoint: "detail",
      kind: requestedKind,
      status: "disabled",
      errorType: "none",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(503).json({
      status: "disabled",
      message: "DeFi pool parsing requires zig core; set MONAD_USE_ZIG_CORE=1",
    });
    return;
  }

  const poolId = String(req.params.id || "").trim();
  if (!poolId) {
    recordDefiRequestMetric({
      endpoint: "detail",
      kind: requestedKind,
      status: "invalid",
      errorType: "validation",
      durationMs: metricDurationMs(startedAtMs),
    });
    res.status(400).json({ status: "invalid", message: "pool id is required" });
    return;
  }

  const deepSearchEnabled = queryString(req, "deepSearch") !== "0";
  const poolQuery = parsePoolsQuery(req, { limit: 2000 });

  try {
    const primary = await fetchParsedDefiPools(poolQuery);
    let parsed = primary;
    let entry = parsed.entries.find((item) => item.pool.id.toLowerCase() === poolId.toLowerCase());
    let escalatedSearch = false;
    let initialLimit = poolQuery.limit;
    let finalLimit = poolQuery.limit;

    if (!entry && deepSearchEnabled && poolQuery.limit < MAX_DEFI_POOL_FETCH_LIMIT) {
      const expandedQuery: DefiPoolQuery = {
        ...poolQuery,
        limit: MAX_DEFI_POOL_FETCH_LIMIT,
      };
      parsed = await fetchParsedDefiPools(expandedQuery);
      entry = parsed.entries.find((item) => item.pool.id.toLowerCase() === poolId.toLowerCase());
      escalatedSearch = true;
      finalLimit = expandedQuery.limit;
    }

    if (!entry) {
      recordDefiRequestMetric({
        endpoint: "detail",
        kind: poolQuery.kind,
        status: "not_found",
        errorType: "none",
        durationMs: metricDurationMs(startedAtMs),
        cache: {
          backend: parsed.cache.backend,
          hit: parsed.cache.hit,
          stale: parsed.cache.stale,
        },
      });
      recordDefiUpstreamRetries(parsed.cache.retryCount, parsed.cache.backend);
      recordDefiCacheAge(parsed.cache.ageMs, parsed.cache.backend);
      res.status(404).json({
        status: "not_found",
        message: `pool not found in current result set: ${poolId}`,
        query: {
          kind: poolQuery.kind,
          chain: poolQuery.chain || null,
          asset: poolQuery.asset || null,
          provider: poolQuery.provider || null,
          limit: poolQuery.limit,
          minTvlUsd: poolQuery.minTvlUsd ?? null,
          liveMode: poolQuery.liveMode,
          liveProvider: poolQuery.liveProvider,
          sortBy: poolQuery.sortBy || null,
          order: poolQuery.order,
        },
        lookup: {
          deepSearchEnabled,
          escalatedSearch,
          initialLimit,
          finalLimit,
          searchedLimit: parsed.pools.length,
        },
        rawCount: parsed.rawCount,
      });
      return;
    }

    recordDefiRequestMetric({
      endpoint: "detail",
      kind: poolQuery.kind,
      status: "ok",
      errorType: "none",
      durationMs: metricDurationMs(startedAtMs),
      cache: {
        backend: parsed.cache.backend,
        hit: parsed.cache.hit,
        stale: parsed.cache.stale,
      },
    });
    recordDefiUpstreamRetries(parsed.cache.retryCount, parsed.cache.backend);
    recordDefiCacheAge(parsed.cache.ageMs, parsed.cache.backend);

    res.json({
      status: "ok",
      pool: entry.pool,
      diagnostics: {
        fieldMapping: entry.fieldMapping,
        raw: entry.raw,
      },
      source: parsed.source,
      sourceProvider: parsed.sourceProvider,
      sourceUrl: parsed.sourceUrl,
      sourceTransport: parsed.sourceTransport,
      fetchedAtUnix: parsed.fetchedAtUnix,
      cache: parsed.cache,
      lookupTrace: {
        deepSearchEnabled,
        escalatedSearch,
        initialLimit,
        finalLimit,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMorphoLiveConfigError(message)) {
      const plan = livePlan(poolQuery);
      recordDefiRequestMetric({
        endpoint: "detail",
        kind: poolQuery.kind,
        status: "invalid",
        errorType: "config",
        durationMs: metricDurationMs(startedAtMs),
      });
      res.status(400).json({
        status: "invalid_config",
        message,
        plan,
        hints: [
          `set ${plan.requiredEnvKey || "DEFI_MORPHO_POOLS_URL"} for current live provider`,
          "or set liveProvider=morpho|aave|kamino explicitly",
        ],
      });
      return;
    }
    const upstreamCode = extractUpstreamErrorCode(message);
    recordDefiRequestMetric({
      endpoint: "detail",
      kind: poolQuery.kind,
      status: "error",
      errorType: "upstream",
      durationMs: metricDurationMs(startedAtMs),
    });
    recordDefiUpstreamError(upstreamCode);
    res.status(502).json({ status: "error", message });
  }
});

app.get("/api/strategies", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", strategies: listStrategies(dbHandle) });
});

app.get("/api/strategies/:id", (req: express.Request, res: express.Response) => {
  const strategy = getStrategy(dbHandle, req.params.id);
  if (!strategy) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  res.json({ status: "ok", strategy });
});

app.post("/api/strategies", (req: express.Request, res: express.Response) => {
  const spec = compileStrategy({
    intentText: req.body.intentText,
    template: req.body.template,
    params: req.body.params,
    owner: req.body.owner,
    chain: req.body.chain,
    risk: req.body.risk,
  });
  const validation = validateStrategy(spec);
  if (!validation.ok) {
    res.status(400).json({ status: "invalid", errors: validation.errors });
    return;
  }
  saveStrategy(dbHandle, spec);
  res.json({ status: "ok", strategy: spec });
});

app.post("/api/strategies/:id/run", (req: express.Request, res: express.Response) => {
  const strategy = getStrategy(dbHandle, req.params.id);
  if (!strategy) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  const modeInput = String(req.body.mode || "plan");
  const mode = modeInput === "execute" ? "execute" : modeInput === "simulate" ? "simulate" : "plan";
  const result = runStrategy(strategy.spec, mode);
  const summary = {
    template: strategy.template,
    runId: result.runId,
    status: result.status,
    mode,
    executedAt: new Date().toISOString(),
  };
  const extraEvidence =
    req.body && typeof req.body.evidence === "object" ? req.body.evidence : {};
  const lifiResult =
    req.body && typeof req.body.lifiResult === "object" ? req.body.lifiResult : {};
  const lifiEvidence = {
    routeId: lifiResult.routeId || lifiResult.id,
    tool: lifiResult.tool,
    estimateGas: lifiResult.estimateGas,
    txHash: lifiResult.txHash,
  };
  const paramEvidence = {
    templateParams: strategy.spec?.metadata?.params || {},
  };
  addExecution(dbHandle, {
    id: result.runId,
    strategyId: strategy.id,
    mode,
    status: result.status,
    payload: result,
    evidence: {
      ...summary,
      steps: result.evidence.steps,
      ...lifiEvidence,
      ...paramEvidence,
      ...extraEvidence,
    },
  });
  res.json({
    status: "ok",
    result,
    summary,
    evidence: { ...lifiEvidence, ...paramEvidence, ...extraEvidence },
  });
});

app.get("/api/executions", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", executions: listExecutions(dbHandle) });
});

app.get("/api/executions/:id", (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  res.json({ status: "ok", execution });
});

app.post("/api/execute/native-transfer", async (req: express.Request, res: express.Response) => {
  const toAddress = typeof req.body?.toAddress === "string" ? req.body.toAddress : "";
  const amountWei = typeof req.body?.amountWei === "string" ? req.body.amountWei : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!toAddress || !amountWei) {
    res.status(400).json({ status: "invalid", errors: ["toAddress and amountWei are required"] });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedNativeTransfer({
      signer,
      toAddress,
      amountWei,
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_native_transfer",
      type: "native-transfer",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        toAddress,
        amountWei,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/tx-request", async (req: express.Request, res: express.Response) => {
  const txRequest = req.body?.txRequest;
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!txRequest || typeof txRequest !== "object" || Array.isArray(txRequest)) {
    res.status(400).json({ status: "invalid", errors: ["txRequest object is required"] });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await signAndSendTxRequest({
      signer,
      txRequest: txRequest as Record<string, unknown>,
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_tx_request",
      type: "tx-request",
      payload: {
        txRequest,
        ...result,
      },
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/erc20-approve", async (req: express.Request, res: express.Response) => {
  const tokenAddress = typeof req.body?.tokenAddress === "string" ? req.body.tokenAddress : "";
  const spender = typeof req.body?.spender === "string" ? req.body.spender : "";
  const amountRaw = typeof req.body?.amountRaw === "string" ? req.body.amountRaw : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!tokenAddress || !spender || !amountRaw) {
    res.status(400).json({
      status: "invalid",
      errors: ["tokenAddress, spender, and amountRaw are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildErc20Approve",
      buildParams: { tokenAddress, spender, amountRaw },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_erc20_approve",
      type: "erc20-approve",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        tokenAddress,
        spender,
        amountRaw,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/dex-swap", async (req: express.Request, res: express.Response) => {
  const router = typeof req.body?.router === "string" ? req.body.router : "";
  const amountIn = typeof req.body?.amountIn === "string" ? req.body.amountIn : "";
  const amountOutMin = typeof req.body?.amountOutMin === "string" ? req.body.amountOutMin : "";
  const to = typeof req.body?.to === "string" ? req.body.to : "";
  const deadline = typeof req.body?.deadline === "string" ? req.body.deadline : "";
  const pathInput = req.body?.path;
  const path = Array.isArray(pathInput) ? pathInput.filter((item) => typeof item === "string") : [];
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!router || !amountIn || !amountOutMin || !to || !deadline || path.length < 2) {
    res.status(400).json({
      status: "invalid",
      errors: ["router, amountIn, amountOutMin, path(>=2), to, and deadline are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildDexSwap",
      buildParams: { router, amountIn, amountOutMin, path, to, deadline },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_dex_swap",
      type: "dex-swap",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        router,
        amountIn,
        amountOutMin,
        path,
        to,
        deadline,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/morpho-vault-deposit", async (req: express.Request, res: express.Response) => {
  const vaultAddress = typeof req.body?.vaultAddress === "string" ? req.body.vaultAddress : "";
  const amountRaw = typeof req.body?.amountRaw === "string" ? req.body.amountRaw : "";
  const receiver = typeof req.body?.receiver === "string" ? req.body.receiver : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!vaultAddress || !amountRaw || !receiver) {
    res.status(400).json({
      status: "invalid",
      errors: ["vaultAddress, amountRaw, and receiver are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultDeposit",
      buildParams: { vaultAddress, amountRaw, receiver },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_morpho_vault_deposit",
      type: "morpho-vault-deposit",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        vaultAddress,
        amountRaw,
        receiver,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/morpho-vault-withdraw", async (req: express.Request, res: express.Response) => {
  const vaultAddress = typeof req.body?.vaultAddress === "string" ? req.body.vaultAddress : "";
  const amountRaw = typeof req.body?.amountRaw === "string" ? req.body.amountRaw : "";
  const receiver = typeof req.body?.receiver === "string" ? req.body.receiver : "";
  const owner = typeof req.body?.owner === "string" ? req.body.owner : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!vaultAddress || !amountRaw || !receiver || !owner) {
    res.status(400).json({
      status: "invalid",
      errors: ["vaultAddress, amountRaw, receiver, and owner are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultWithdraw",
      buildParams: { vaultAddress, amountRaw, receiver, owner },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_morpho_vault_withdraw",
      type: "morpho-vault-withdraw",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        vaultAddress,
        amountRaw,
        receiver,
        owner,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/execute/morpho-vault-redeem", async (req: express.Request, res: express.Response) => {
  const vaultAddress = typeof req.body?.vaultAddress === "string" ? req.body.vaultAddress : "";
  const sharesRaw = typeof req.body?.sharesRaw === "string" ? req.body.sharesRaw : "";
  const receiver = typeof req.body?.receiver === "string" ? req.body.receiver : "";
  const owner = typeof req.body?.owner === "string" ? req.body.owner : "";
  const fromAddress = typeof req.body?.fromAddress === "string" ? req.body.fromAddress : undefined;
  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;

  if (!vaultAddress || !sharesRaw || !receiver || !owner) {
    res.status(400).json({
      status: "invalid",
      errors: ["vaultAddress, sharesRaw, receiver, and owner are required"],
    });
    return;
  }

  const signer = getSignerOrRespond(res);
  if (!signer) return;

  try {
    const result = await executeSignedBuildAction({
      signer,
      buildAction: "buildMorphoVaultRedeem",
      buildParams: { vaultAddress, sharesRaw, receiver, owner },
      fromAddress,
      rpcUrl,
    });
    const executionId = persistManualExecution({
      idPrefix: "exec_morpho_vault_redeem",
      type: "morpho-vault-redeem",
      payload: result,
      evidence: {
        signer: result.signer,
        txHash: result.txHash,
        vaultAddress,
        sharesRaw,
        receiver,
        owner,
        rpcUrl: rpcUrl || null,
      },
    });
    res.json({ status: "ok", executionId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.get("/api/executions/:id/receipt", async (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }
  const payload = execution.payload && typeof execution.payload === "object" ? execution.payload : {};
  const txHash = typeof (payload as Record<string, unknown>).txHash === "string" ? String((payload as Record<string, unknown>).txHash) : "";
  if (!txHash) {
    res.status(400).json({ status: "invalid", message: "execution payload has no txHash" });
    return;
  }
  const rpcUrl = typeof req.query.rpcUrl === "string" ? req.query.rpcUrl : undefined;
  try {
    const receipt = await fetchTransactionReceipt({ txHash, rpcUrl });
    if (receipt.status === "confirmed" || receipt.status === "failed") {
      updateExecution(dbHandle, execution.id, {
        status: receipt.status,
        evidence: {
          ...(execution.evidence || {}),
          txHash,
          receiptStatus: receipt.status,
          lastReceiptCheckAt: new Date().toISOString(),
          receipt: receipt.receipt,
        },
      });
    }
    res.json({
      status: "ok",
      txHash,
      receiptStatus: receipt.status,
      receipt: receipt.receipt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});

app.post("/api/executions/:id/watch", async (req: express.Request, res: express.Response) => {
  const execution = getExecution(dbHandle, req.params.id);
  if (!execution) {
    res.status(404).json({ status: "not_found" });
    return;
  }

  const payload = execution.payload && typeof execution.payload === "object" ? execution.payload : {};
  const txHash =
    typeof (payload as Record<string, unknown>).txHash === "string"
      ? String((payload as Record<string, unknown>).txHash)
      : "";
  if (!txHash) {
    res.status(400).json({ status: "invalid", message: "execution payload has no txHash" });
    return;
  }

  const rpcUrl = typeof req.body?.rpcUrl === "string" ? req.body.rpcUrl : undefined;
  const timeoutMsRaw = Number(req.body?.timeoutMs ?? 60000);
  const intervalMsRaw = Number(req.body?.intervalMs ?? 3000);
  const timeoutMs = Number.isFinite(timeoutMsRaw)
    ? Math.max(1000, Math.min(300000, Math.trunc(timeoutMsRaw)))
    : 60000;
  const intervalMs = Number.isFinite(intervalMsRaw)
    ? Math.max(500, Math.min(30000, Math.trunc(intervalMsRaw)))
    : 3000;

  const startedAt = Date.now();
  let attempts = 0;

  while (Date.now() - startedAt <= timeoutMs) {
    attempts += 1;
    try {
      const receiptResult = await fetchTransactionReceipt({ txHash, rpcUrl });
      if (receiptResult.status !== "pending") {
        updateExecution(dbHandle, execution.id, {
          status: receiptResult.status,
          evidence: {
            ...(execution.evidence || {}),
            txHash,
            receiptStatus: receiptResult.status,
            lastReceiptCheckAt: new Date().toISOString(),
            receipt: receiptResult.receipt,
          },
        });
        res.json({
          status: "ok",
          txHash,
          executionId: execution.id,
          receiptStatus: receiptResult.status,
          receipt: receiptResult.receipt,
          attempts,
          elapsedMs: Date.now() - startedAt,
        });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        status: "error",
        message,
        txHash,
        executionId: execution.id,
        attempts,
      });
      return;
    }

    await sleep(intervalMs);
  }

  updateExecution(dbHandle, execution.id, {
    evidence: {
      ...(execution.evidence || {}),
      txHash,
      receiptStatus: "pending",
      lastReceiptCheckAt: new Date().toISOString(),
      watchTimeout: true,
    },
  });

  res.json({
    status: "timeout",
    txHash,
    executionId: execution.id,
    receiptStatus: "pending",
    attempts,
    elapsedMs: Date.now() - startedAt,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard listening on http://127.0.0.1:${PORT}`);
});
