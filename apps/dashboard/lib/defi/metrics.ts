type MetricLabels = Record<string, string>;

type RequestMetricInput = {
  endpoint: "list" | "detail" | "smoke" | "prewarm";
  kind: "yield" | "lend";
  status: "ok" | "error" | "not_found" | "disabled" | "invalid";
  errorType?: "none" | "upstream" | "validation" | "cursor_mismatch" | "cursor_expired" | "config";
  durationMs: number;
  cache?: {
    backend: "memory" | "redis";
    hit: boolean;
    stale: boolean;
  };
};

type DurationState = {
  sumMs: number;
  count: number;
  maxMs: number;
};

type CacheAgeState = {
  buckets: number[];
  sumMs: number;
  count: number;
};

const counters = new Map<string, number>();
const durations = new Map<string, DurationState>();
const cacheAgeByBackend = new Map<string, CacheAgeState>();
const healthGauges = new Map<string, number>();
const prewarmGauges = new Map<string, number>();
const CACHE_AGE_BUCKETS_MS = [100, 500, 1_000, 5_000, 15_000, 60_000, 300_000];

function labelsKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

function labelsText(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  const rendered = entries.map(([key, value]) => `${key}="${value}"`).join(",");
  return `{${rendered}}`;
}

function counterKey(name: string, labels: MetricLabels): string {
  return `${name}|${labelsKey(labels)}`;
}

function durationKey(labels: MetricLabels): string {
  return labelsKey(labels);
}

function incrementCounter(name: string, labels: MetricLabels, delta = 1): void {
  const key = counterKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + delta);
}

function recordDuration(labels: MetricLabels, durationMs: number): void {
  const key = durationKey(labels);
  const current = durations.get(key) || { sumMs: 0, count: 0, maxMs: 0 };
  current.sumMs += durationMs;
  current.count += 1;
  current.maxMs = Math.max(current.maxMs, durationMs);
  durations.set(key, current);
}

export function recordDefiRequestMetric(input: RequestMetricInput): void {
  const requestLabels: MetricLabels = {
    endpoint: input.endpoint,
    kind: input.kind,
    status: input.status,
    error_type: input.errorType || "none",
  };

  incrementCounter("gradience_defi_requests_total", requestLabels, 1);
  recordDuration(
    {
      endpoint: input.endpoint,
      kind: input.kind,
    },
    Math.max(0, input.durationMs),
  );

  if (input.cache) {
    const event = input.cache.stale ? "stale" : input.cache.hit ? "hit" : "miss";
    incrementCounter(
      "gradience_defi_cache_events_total",
      {
        backend: input.cache.backend,
        event,
      },
      1,
    );
  }
}

export function recordDefiUpstreamError(code: string): void {
  const normalized = code.trim() || "unknown";
  incrementCounter(
    "gradience_defi_upstream_errors_total",
    {
      code: normalized,
    },
    1,
  );
}

export function recordDefiUpstreamRetries(retryCount: number, backend: "memory" | "redis"): void {
  if (!Number.isFinite(retryCount) || retryCount <= 0) return;
  incrementCounter(
    "gradience_defi_upstream_retries_total",
    {
      backend,
    },
    Math.trunc(retryCount),
  );
}

export function recordDefiCacheAge(ageMs: number, backend: "memory" | "redis"): void {
  if (!Number.isFinite(ageMs) || ageMs < 0) return;
  const key = backend;
  const current =
    cacheAgeByBackend.get(key) || {
      buckets: new Array(CACHE_AGE_BUCKETS_MS.length + 1).fill(0),
      sumMs: 0,
      count: 0,
    };
  let bucketIndex = CACHE_AGE_BUCKETS_MS.findIndex((value) => ageMs <= value);
  if (bucketIndex === -1) bucketIndex = CACHE_AGE_BUCKETS_MS.length;
  current.buckets[bucketIndex] += 1;
  current.sumMs += ageMs;
  current.count += 1;
  cacheAgeByBackend.set(key, current);
}

export function setDefiHealthGauge(
  check: "live_config" | "startup_smoke" | "prewarm" | "overall" | "overall_strict",
  status: "ok" | "error",
): void {
  const key = `gradience_defi_health_status|check=${check}`;
  healthGauges.set(key, status === "ok" ? 1 : 0);
}

export function setDefiPrewarmGauge(name: string, value: number): void {
  if (!Number.isFinite(value)) return;
  const normalized = Math.max(0, value);
  prewarmGauges.set(name, normalized);
}

export function recordDefiPrewarmAlertWebhookEvent(status: "sent" | "failed" | "suppressed"): void {
  incrementCounter(
    "gradience_defi_prewarm_alert_webhook_total",
    {
      status,
    },
    1,
  );
}

function renderCounterMetric(name: string): string[] {
  const lines: string[] = [];
  for (const [key, value] of counters.entries()) {
    const [metricName, labelsRaw] = key.split("|");
    if (metricName !== name) continue;
    const labels = Object.fromEntries(
      labelsRaw
        .split(",")
        .filter(Boolean)
        .map((entry) => {
          const [k, v] = entry.split("=");
          return [k, v];
        }),
    );
    lines.push(`${metricName}${labelsText(labels)} ${value}`);
  }
  return lines;
}

function formatFloat(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0";
}

export function renderDefiMetrics(): string {
  const lines: string[] = [];

  lines.push("# HELP gradience_defi_requests_total Total DeFi pool API requests by endpoint/kind/status/error_type");
  lines.push("# TYPE gradience_defi_requests_total counter");

  lines.push(...renderCounterMetric("gradience_defi_requests_total"));

  lines.push("# HELP gradience_defi_cache_events_total DeFi cache event counts by backend and event type");
  lines.push("# TYPE gradience_defi_cache_events_total counter");
  lines.push(...renderCounterMetric("gradience_defi_cache_events_total"));

  lines.push("# HELP gradience_defi_upstream_errors_total DeFi upstream error counts by code");
  lines.push("# TYPE gradience_defi_upstream_errors_total counter");
  lines.push(...renderCounterMetric("gradience_defi_upstream_errors_total"));

  lines.push("# HELP gradience_defi_upstream_retries_total DeFi upstream retry attempts by cache backend");
  lines.push("# TYPE gradience_defi_upstream_retries_total counter");
  lines.push(...renderCounterMetric("gradience_defi_upstream_retries_total"));

  lines.push("# HELP gradience_defi_cache_age_ms Cache age in milliseconds by backend");
  lines.push("# TYPE gradience_defi_cache_age_ms histogram");
  for (const [backend, state] of cacheAgeByBackend.entries()) {
    let cumulative = 0;
    for (let i = 0; i < CACHE_AGE_BUCKETS_MS.length; i += 1) {
      cumulative += state.buckets[i] || 0;
      lines.push(
        `gradience_defi_cache_age_ms_bucket{backend="${backend}",le="${CACHE_AGE_BUCKETS_MS[i]}"} ${cumulative}`,
      );
    }
    cumulative += state.buckets[CACHE_AGE_BUCKETS_MS.length] || 0;
    lines.push(`gradience_defi_cache_age_ms_bucket{backend="${backend}",le="+Inf"} ${cumulative}`);
    lines.push(`gradience_defi_cache_age_ms_sum{backend="${backend}"} ${formatFloat(state.sumMs)}`);
    lines.push(`gradience_defi_cache_age_ms_count{backend="${backend}"} ${state.count}`);
  }

  lines.push("# HELP gradience_defi_health_status DeFi health status by check (1=ok,0=error)");
  lines.push("# TYPE gradience_defi_health_status gauge");
  for (const [key, value] of healthGauges.entries()) {
    const [metricName, labelsRaw] = key.split("|");
    const labels = Object.fromEntries(
      labelsRaw
        .split(",")
        .filter(Boolean)
        .map((entry) => {
          const [k, v] = entry.split("=");
          return [k, v];
        }),
    );
    lines.push(`${metricName}${labelsText(labels)} ${value}`);
  }

  lines.push("# HELP gradience_defi_prewarm_recent_success_rate Recent prewarm success rate in [0,1]");
  lines.push("# TYPE gradience_defi_prewarm_recent_success_rate gauge");
  lines.push("# HELP gradience_defi_prewarm_total_runs Total prewarm runs observed");
  lines.push("# TYPE gradience_defi_prewarm_total_runs gauge");
  lines.push("# HELP gradience_defi_prewarm_total_checks Total prewarm checks observed");
  lines.push("# TYPE gradience_defi_prewarm_total_checks gauge");
  lines.push("# HELP gradience_defi_prewarm_total_check_error Total prewarm check failures observed");
  lines.push("# TYPE gradience_defi_prewarm_total_check_error gauge");
  lines.push("# HELP gradience_defi_prewarm_consecutive_failure_runs Current consecutive prewarm failure runs");
  lines.push("# TYPE gradience_defi_prewarm_consecutive_failure_runs gauge");
  lines.push("# HELP gradience_defi_prewarm_max_consecutive_failure_runs Maximum observed consecutive prewarm failure runs");
  lines.push("# TYPE gradience_defi_prewarm_max_consecutive_failure_runs gauge");
  lines.push("# HELP gradience_defi_prewarm_alert_active Prewarm alert state (1=active,0=inactive)");
  lines.push("# TYPE gradience_defi_prewarm_alert_active gauge");
  lines.push("# HELP gradience_defi_prewarm_alert_webhook_total Prewarm alert webhook events by status");
  lines.push("# TYPE gradience_defi_prewarm_alert_webhook_total counter");
  lines.push(...renderCounterMetric("gradience_defi_prewarm_alert_webhook_total"));
  for (const [name, value] of prewarmGauges.entries()) {
    lines.push(`${name} ${formatFloat(value)}`);
  }

  lines.push("# HELP gradience_defi_request_duration_ms_sum Total DeFi request latency in milliseconds");
  lines.push("# TYPE gradience_defi_request_duration_ms_sum counter");
  lines.push("# HELP gradience_defi_request_duration_ms_count Total DeFi request count for latency average");
  lines.push("# TYPE gradience_defi_request_duration_ms_count counter");
  lines.push("# HELP gradience_defi_request_duration_ms_max Maximum observed DeFi request latency in milliseconds");
  lines.push("# TYPE gradience_defi_request_duration_ms_max gauge");

  for (const [labelsRaw, state] of durations.entries()) {
    const labels = Object.fromEntries(
      labelsRaw
        .split(",")
        .filter(Boolean)
        .map((entry) => {
          const [k, v] = entry.split("=");
          return [k, v];
        }),
    );
    const labelText = labelsText(labels);
    lines.push(`gradience_defi_request_duration_ms_sum${labelText} ${formatFloat(state.sumMs)}`);
    lines.push(`gradience_defi_request_duration_ms_count${labelText} ${state.count}`);
    lines.push(`gradience_defi_request_duration_ms_max${labelText} ${formatFloat(state.maxMs)}`);
  }

  return `${lines.join("\n")}\n`;
}
