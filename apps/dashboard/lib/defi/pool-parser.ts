import { callZigCore, isZigCoreEnabled } from "../../../../src/integrations/zig-core.js";
import { createHash } from "node:crypto";
import { createClient } from "redis";

type DefiKind = "yield" | "lend";

type RawRow = Record<string, unknown>;

type ZigEnvelope = Record<string, unknown>;

export type DefiPoolQuery = {
  kind: DefiKind;
  chain?: string;
  asset?: string;
  provider?: string;
  limit: number;
  minTvlUsd?: number;
  liveMode?: string;
  liveProvider?: string;
  sortBy?: string;
  order?: "asc" | "desc";
};

export type DefiPool = {
  id: string;
  marketId: string | null;
  kind: DefiKind;
  provider: string | null;
  chain: string | null;
  asset: string | null;
  symbol: string | null;
  tvlUsd: number | null;
  apyPct: number | null;
  baseApyPct: number | null;
  rewardApyPct: number | null;
  borrowApyPct: number | null;
  utilizationPct: number | null;
  source: string | null;
  sourceProvider: string | null;
  fetchedAtUnix: number | null;
  address: string | null;
};

export type DefiFieldMapping = {
  id: string | null;
  marketId: string | null;
  provider: string | null;
  chain: string | null;
  asset: string | null;
  symbol: string | null;
  tvlUsd: string | null;
  apy: string | null;
  baseApy: string | null;
  rewardApy: string | null;
  borrowApy: string | null;
  utilization: string | null;
  source: string | null;
  sourceProvider: string | null;
  fetchedAtUnix: string | null;
  address: string | null;
};

export type DefiPoolEntry = {
  pool: DefiPool;
  raw: RawRow;
  fieldMapping: DefiFieldMapping;
};

type CacheInfo = {
  hit: boolean;
  stale: boolean;
  ttlSeconds: number;
  ageMs: number;
  backend: "memory" | "redis";
  retryCount: number;
};

type ParsedPoolsResponse = {
  pools: DefiPool[];
  entries: DefiPoolEntry[];
  source: string | null;
  sourceProvider: string | null;
  sourceUrl: string | null;
  sourceTransport: "registry" | "direct_url" | "morpho_api" | "unknown";
  fetchedAtUnix: number | null;
  rawCount: number;
  cache: CacheInfo;
};

const ARRAY_CANDIDATE_KEYS = ["opportunities", "markets", "pools", "rows", "items", "data"];
const DEFAULT_CACHE_TTL_SECONDS = 20;
const DEFAULT_ALLOW_STALE = true;
const DEFAULT_STALE_TTL_MULTIPLIER = 10;
const DEFAULT_UPSTREAM_RETRIES = 1;
const DEFAULT_UPSTREAM_RETRY_BACKOFF_MS = 250;

type CacheEntry = {
  envelope: ZigEnvelope;
  cachedAtMs: number;
  expiresAtMs: number;
};

const responseCache = new Map<string, CacheEntry>();
type RedisLikeClient = ReturnType<typeof createClient>;
let redisClient: RedisLikeClient | null = null;
let redisInitPromise: Promise<RedisLikeClient | null> | null = null;

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(row: RawRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return undefined;
}

function firstStringWithKey(row: RawRow, keys: string[]): { key: string | null; value: string | undefined } {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return { key, value };
  }
  return { key: null, value: undefined };
}

function firstNumber(row: RawRow, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = asNumber(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function firstNumberWithKey(row: RawRow, keys: string[]): { key: string | null; value: number | undefined } {
  for (const key of keys) {
    const value = asNumber(row[key]);
    if (value !== undefined) return { key, value };
  }
  return { key: null, value: undefined };
}

function toPercent(value: number | undefined): number | null {
  if (value === undefined) return null;
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return Number.isFinite(normalized) ? normalized : null;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function stablePoolId(kind: DefiKind, row: RawRow, fallbackId: string): string {
  const idFromRow = firstString(row, ["id", "pool", "marketId", "market", "vaultAddress", "address", "lpToken"]);
  if (idFromRow) return idFromRow;

  const provider = firstString(row, ["provider", "protocol"]) || "unknown-provider";
  const chain = firstString(row, ["chain", "chainId"]) || "unknown-chain";
  const address = firstString(row, ["address", "vaultAddress", "pool"]) || "unknown-address";
  const asset = firstString(row, ["asset", "underlying", "underlyingSymbol"]) || "unknown-asset";
  const symbol = firstString(row, ["symbol", "poolSymbol", "name"]) || "unknown-symbol";

  const canonical = `${kind}|${provider.toLowerCase()}|${chain.toLowerCase()}|${address.toLowerCase()}|${asset.toLowerCase()}|${symbol.toLowerCase()}`;
  const id = `${kind}_${shortHash(canonical)}`;
  return id || fallbackId;
}

function inferMarketIdFromMarketLabel(market: string | undefined): string | undefined {
  if (!market) return undefined;
  const trimmed = market.trim();
  const match = /^morpho\s+(0x[a-f0-9]{64})$/i.exec(trimmed);
  return match?.[1];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asRows(value: unknown): RawRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RawRow => !!item && typeof item === "object" && !Array.isArray(item));
}

function extractRowsFromRecord(record: Record<string, unknown>): RawRow[] {
  for (const key of ARRAY_CANDIDATE_KEYS) {
    const rows = asRows(record[key]);
    if (rows.length > 0) return rows;
  }

  const nestedData = asRecord(record.data);
  if (nestedData) {
    for (const key of ARRAY_CANDIDATE_KEYS) {
      const rows = asRows(nestedData[key]);
      if (rows.length > 0) return rows;
    }
  }

  return [];
}

function extractRows(zig: ZigEnvelope): RawRow[] {
  const direct = extractRowsFromRecord(zig);
  if (direct.length > 0) return direct;
  const nested = asRecord(zig.results);
  if (!nested) return [];
  return extractRowsFromRecord(nested);
}

function normalizePool(
  kind: DefiKind,
  row: RawRow,
  fallback: { source: string | null; sourceProvider: string | null; fetchedAtUnix: number | null },
  fallbackId: string,
): DefiPoolEntry {
  const idInfo = firstStringWithKey(row, [
    "id",
    "pool",
    "marketId",
    "market",
    "vaultAddress",
    "address",
    "lpToken",
  ]);
  const providerInfo = firstStringWithKey(row, ["provider", "protocol"]);
  const marketIdInfo = firstStringWithKey(row, ["marketId", "uniqueKey", "pool", "id"]);
  const marketLabelInfo = firstStringWithKey(row, ["market", "poolMeta", "name"]);
  const chainInfo = firstStringWithKey(row, ["chain", "chainId"]);
  const assetInfo = firstStringWithKey(row, ["asset", "underlying", "underlyingSymbol"]);
  const symbolInfo = firstStringWithKey(row, ["symbol", "poolSymbol", "name"]);
  const sourceInfo = firstStringWithKey(row, ["source"]);
  const sourceProviderInfo = firstStringWithKey(row, ["sourceProvider"]);
  const addressInfo = firstStringWithKey(row, ["address", "vaultAddress", "pool"]);
  const tvlInfo = firstNumberWithKey(row, ["tvlUsd", "tvl", "liquidityUsd", "totalSupplyUsd"]);
  const apyInfo = firstNumberWithKey(row, ["apy", "supplyApy", "supplyApr"]);
  const baseApyInfo = firstNumberWithKey(row, ["apyBase", "baseApy", "baseApr"]);
  const rewardApyInfo = firstNumberWithKey(row, ["apyReward", "rewardApy", "rewardApr"]);
  const borrowApyInfo = firstNumberWithKey(row, ["borrowApy", "borrowApr"]);
  const utilizationInfo = firstNumberWithKey(row, ["utilization", "utilizationRate"]);
  const fetchedAtInfo = firstNumberWithKey(row, ["fetchedAtUnix"]);

  const pool: DefiPool = {
    id: stablePoolId(kind, row, fallbackId),
    marketId: marketIdInfo.value || inferMarketIdFromMarketLabel(marketLabelInfo.value) || null,
    kind,
    provider: providerInfo.value || null,
    chain: chainInfo.value || null,
    asset: assetInfo.value || null,
    symbol: symbolInfo.value || null,
    tvlUsd: tvlInfo.value ?? null,
    apyPct: toPercent(apyInfo.value),
    baseApyPct: toPercent(baseApyInfo.value),
    rewardApyPct: toPercent(rewardApyInfo.value),
    borrowApyPct: toPercent(borrowApyInfo.value),
    utilizationPct: toPercent(utilizationInfo.value),
    source: sourceInfo.value || fallback.source,
    sourceProvider: sourceProviderInfo.value || fallback.sourceProvider,
    fetchedAtUnix: fetchedAtInfo.value ?? fallback.fetchedAtUnix,
    address: addressInfo.value || null,
  };

  return {
    pool,
    raw: row,
    fieldMapping: {
      id: idInfo.key,
      marketId: marketIdInfo.key,
      provider: providerInfo.key,
      chain: chainInfo.key,
      asset: assetInfo.key,
      symbol: symbolInfo.key,
      tvlUsd: tvlInfo.key,
      apy: apyInfo.key,
      baseApy: baseApyInfo.key,
      rewardApy: rewardApyInfo.key,
      borrowApy: borrowApyInfo.key,
      utilization: utilizationInfo.key,
      source: sourceInfo.key,
      sourceProvider: sourceProviderInfo.key,
      fetchedAtUnix: fetchedAtInfo.key,
      address: addressInfo.key,
    },
  };
}

function pickAction(kind: DefiKind): string {
  return kind === "lend" ? "lendMarkets" : "yieldOpportunities";
}

export function zigDefiEnabled(): boolean {
  return isZigCoreEnabled();
}

function inferSourceTransport(input: { source: string | null; sourceProvider: string | null; sourceUrl: string | null }):
  | "registry"
  | "direct_url"
  | "morpho_api"
  | "unknown" {
  const source = String(input.source || "").toLowerCase();
  if (source === "registry") return "registry";

  const sourceProvider = String(input.sourceProvider || "").toLowerCase();
  const sourceUrl = String(input.sourceUrl || "").toLowerCase();
  if (sourceProvider === "morpho" && sourceUrl.includes("api.morpho.org/graphql")) {
    return "morpho_api";
  }
  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    return "direct_url";
  }
  return "unknown";
}

function getCacheTtlSeconds(): number {
  const parsed = Number(process.env.DEFI_POOL_PARSER_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS);
  if (!Number.isFinite(parsed)) return DEFAULT_CACHE_TTL_SECONDS;
  return Math.max(1, Math.trunc(parsed));
}

function cacheAllowsStale(): boolean {
  const value = String(process.env.DEFI_POOL_PARSER_ALLOW_STALE || "").trim().toLowerCase();
  if (!value) return DEFAULT_ALLOW_STALE;
  return value === "1" || value === "true" || value === "yes";
}

function getStaleTtlSeconds(ttlSeconds: number): number {
  const explicit = Number(process.env.DEFI_POOL_PARSER_STALE_TTL_SECONDS || "");
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(ttlSeconds, Math.trunc(explicit));
  }
  return Math.max(ttlSeconds, ttlSeconds * DEFAULT_STALE_TTL_MULTIPLIER);
}

function cacheBackend(): "memory" | "redis" {
  const value = String(process.env.DEFI_POOL_CACHE_BACKEND || "memory").trim().toLowerCase();
  return value === "redis" ? "redis" : "memory";
}

function redisPrefix(): string {
  return String(process.env.DEFI_POOL_REDIS_PREFIX || "defi-pool-parser").trim() || "defi-pool-parser";
}

function redisKeyPrefix(action: string, params: Record<string, unknown>): string {
  return `${redisPrefix()}:${shortHash(cacheKey(action, params))}`;
}

async function getRedisClient(): Promise<RedisLikeClient | null> {
  if (redisClient) return redisClient;
  if (redisInitPromise) return redisInitPromise;
  redisInitPromise = (async () => {
    const redisUrl = String(process.env.DEFI_POOL_REDIS_URL || "").trim();
    if (!redisUrl) return null;
    const client = createClient({ url: redisUrl });
    client.on("error", () => {
      // ignore: callers fall back to memory cache
    });
    await client.connect();
    redisClient = client;
    return client;
  })().catch(() => null);
  const client = await redisInitPromise;
  redisInitPromise = null;
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUpstreamRetries(): number {
  const parsed = Number(process.env.DEFI_POOL_PARSER_UPSTREAM_RETRIES || DEFAULT_UPSTREAM_RETRIES);
  if (!Number.isFinite(parsed)) return DEFAULT_UPSTREAM_RETRIES;
  return Math.max(0, Math.min(5, Math.trunc(parsed)));
}

function getUpstreamRetryBackoffMs(): number {
  const parsed = Number(process.env.DEFI_POOL_PARSER_RETRY_BACKOFF_MS || DEFAULT_UPSTREAM_RETRY_BACKOFF_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_UPSTREAM_RETRY_BACKOFF_MS;
  return Math.max(50, Math.trunc(parsed));
}

function shouldRetryUpstreamError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("failed to start zig core") ||
    lower.includes("exited with code") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused")
  );
}

async function callZigCoreWithRetry(
  action: string,
  params: Record<string, unknown>,
): Promise<{ envelope: ZigEnvelope; retryCount: number }> {
  const retries = getUpstreamRetries();
  const backoffMs = getUpstreamRetryBackoffMs();
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const envelope = await callZigCore({ action, params });
      return { envelope, retryCount: attempt };
    } catch (error) {
      if (attempt >= retries || !shouldRetryUpstreamError(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(backoffMs * attempt);
    }
  }
}

function cacheKey(action: string, params: Record<string, unknown>): string {
  return JSON.stringify({ action, params });
}

async function callZigCoreWithCache(
  action: string,
  params: Record<string, unknown>,
): Promise<{ envelope: ZigEnvelope; cache: CacheInfo }> {
  const ttlSeconds = getCacheTtlSeconds();
  const staleTtlSeconds = getStaleTtlSeconds(ttlSeconds);
  const allowStale = cacheAllowsStale();
  const key = cacheKey(action, params);
  const nowMs = Date.now();
  const backend = cacheBackend();

  if (backend === "redis") {
    const client = await getRedisClient();
    if (client) {
      const keyPrefix = redisKeyPrefix(action, params);
      const freshKey = `${keyPrefix}:fresh`;
      const staleKey = `${keyPrefix}:stale`;
      const freshRaw = await client.get(freshKey);
      if (freshRaw) {
        const freshParsed = JSON.parse(freshRaw) as { envelope: ZigEnvelope; cachedAtMs: number };
        return {
          envelope: freshParsed.envelope,
          cache: {
            hit: true,
            stale: false,
            ttlSeconds,
            ageMs: nowMs - freshParsed.cachedAtMs,
            backend: "redis",
            retryCount: 0,
          },
        };
      }

      try {
        const { envelope, retryCount } = await callZigCoreWithRetry(action, params);
        const payload = JSON.stringify({ envelope, cachedAtMs: nowMs });
        await client.set(freshKey, payload, { EX: ttlSeconds });
        await client.set(staleKey, payload, { EX: staleTtlSeconds });
        return {
          envelope,
          cache: {
            hit: false,
            stale: false,
            ttlSeconds,
            ageMs: 0,
            backend: "redis",
            retryCount,
          },
        };
      } catch (error) {
        if (!allowStale) throw error;
        const staleRaw = await client.get(staleKey);
        if (!staleRaw) throw error;
        const staleParsed = JSON.parse(staleRaw) as { envelope: ZigEnvelope; cachedAtMs: number };
        return {
          envelope: staleParsed.envelope,
          cache: {
            hit: true,
            stale: true,
            ttlSeconds,
            ageMs: nowMs - staleParsed.cachedAtMs,
            backend: "redis",
            retryCount: 0,
          },
        };
      }
    }
  }

  const cached = responseCache.get(key);

  if (cached && nowMs <= cached.expiresAtMs) {
    return {
      envelope: cached.envelope,
      cache: {
        hit: true,
        stale: false,
        ttlSeconds,
        ageMs: nowMs - cached.cachedAtMs,
        backend: "memory",
        retryCount: 0,
      },
    };
  }

  try {
    const { envelope, retryCount } = await callZigCoreWithRetry(action, params);
    responseCache.set(key, {
      envelope,
      cachedAtMs: nowMs,
      expiresAtMs: nowMs + ttlSeconds * 1000,
    });
    return {
      envelope,
      cache: {
        hit: false,
        stale: false,
        ttlSeconds,
        ageMs: 0,
        backend: "memory",
        retryCount,
      },
    };
  } catch (error) {
    if (!cached || !allowStale) {
      throw error;
    }
    return {
      envelope: cached.envelope,
      cache: {
        hit: true,
        stale: true,
        ttlSeconds,
        ageMs: nowMs - cached.cachedAtMs,
        backend: "memory",
        retryCount: 0,
      },
    };
  }
}

export async function fetchParsedDefiPools(query: DefiPoolQuery): Promise<ParsedPoolsResponse> {
  const action = pickAction(query.kind);
  const params = {
    chain: query.chain,
    asset: query.asset,
    provider: query.provider,
    limit: query.limit,
    minTvlUsd: query.minTvlUsd,
    liveMode: query.liveMode,
    liveProvider: query.liveProvider,
    sortBy: query.sortBy,
    order: query.order,
    resultsOnly: true,
  };
  const { envelope: response, cache } = await callZigCoreWithCache(action, params);

  const status = String(response.status || "error");
  if (status !== "ok") {
    const message = String(response.error || response.message || `${action} failed`);
    const code = Number(response.code || 2);
    throw new Error(`${message} (code=${code})`);
  }

  const source = asString(response.source) || null;
  const sourceProvider = asString(response.sourceProvider) || null;
  const sourceUrl = asString(response.sourceUrl) || null;
  const sourceTransport = inferSourceTransport({ source, sourceProvider, sourceUrl });
  const fetchedAtUnix = asNumber(response.fetchedAtUnix) ?? null;

  const rows = extractRows(response);
  const entries = rows.map((row, index) =>
    normalizePool(query.kind, row, {
      source,
      sourceProvider,
      fetchedAtUnix,
    }, `${query.kind}_pool_${index + 1}`),
  );
  const pools = entries.map((entry) => entry.pool);

  return {
    pools,
    entries,
    source,
    sourceProvider,
    sourceUrl,
    sourceTransport,
    fetchedAtUnix,
    rawCount: rows.length,
    cache,
  };
}
