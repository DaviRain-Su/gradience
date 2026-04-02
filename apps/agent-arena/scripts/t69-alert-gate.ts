import process from 'node:process';
import { fileURLToPath } from 'node:url';

export interface AlertGateConfig {
    indexerHealthUrl: string;
    indexerMetricsUrl: string;
    judgeHealthUrl: string;
    judgeMetricsUrl: string;
    maxPendingWorkflows: number;
    maxSourceErrors: number;
    maxEventStalenessSeconds: number;
    requireEventActivity: boolean;
}

export interface AlertGateSnapshot {
    indexer: {
        healthOk: boolean;
        eventsProcessedTotal: number;
        lastEventTimestamp: number;
    };
    judgeDaemon: {
        healthOk: boolean;
        mode: string;
        pendingWorkflows: number;
        sourceErrorsTotal: number;
        lastEventTimestamp: number;
    };
    evaluatedAt: number;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
        return fallback;
    }
    return !['0', 'false', 'False', 'FALSE', 'no', 'off'].includes(value);
}

function parseNumber(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return parsed;
}

export function loadAlertGateConfig(env: NodeJS.ProcessEnv = process.env): AlertGateConfig {
    return {
        indexerHealthUrl: env.INDEXER_HEALTH_URL ?? 'http://127.0.0.1:8787/healthz',
        indexerMetricsUrl: env.INDEXER_METRICS_URL ?? 'http://127.0.0.1:8787/metrics',
        judgeHealthUrl: env.JUDGE_DAEMON_HEALTH_URL ?? 'http://127.0.0.1:9797/healthz',
        judgeMetricsUrl: env.JUDGE_DAEMON_METRICS_URL ?? 'http://127.0.0.1:9797/metrics',
        maxPendingWorkflows: parseNumber(env.ALERT_MAX_PENDING_WORKFLOWS, 200),
        maxSourceErrors: parseNumber(env.ALERT_MAX_SOURCE_ERRORS, 5),
        maxEventStalenessSeconds: parseNumber(env.ALERT_MAX_EVENT_STALENESS_SECONDS, 1_800),
        requireEventActivity: parseBoolean(env.ALERT_REQUIRE_EVENT_ACTIVITY, false),
    };
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`request failed: ${response.status} ${url}`);
    }
    return (await response.json()) as Record<string, unknown>;
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`request failed: ${response.status} ${url}`);
    }
    return response.text();
}

export function parsePrometheusMetrics(payload: string): Map<string, number> {
    const values = new Map<string, number>();
    for (const line of payload.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) {
            continue;
        }
        const metric = parts[0] ?? '';
        const value = Number(parts[parts.length - 1] ?? '');
        if (!Number.isFinite(value)) {
            continue;
        }
        values.set(metric, value);
    }
    return values;
}

function requireMetric(metrics: Map<string, number>, name: string): number {
    const value = metrics.get(name);
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`missing metric: ${name}`);
    }
    return value;
}

function findMode(metrics: Map<string, number>): string {
    for (const [key, value] of metrics.entries()) {
        if (!key.startsWith('gradience_judge_daemon_mode_info{')) {
            continue;
        }
        if (value !== 1) {
            continue;
        }
        const match = key.match(/mode="([^"]+)"/);
        if (match?.[1]) {
            return match[1];
        }
    }
    return 'none';
}

export async function collectAlertGateSnapshot(config: AlertGateConfig): Promise<AlertGateSnapshot> {
    const [indexerHealth, indexerMetricsRaw, judgeHealth, judgeMetricsRaw] = await Promise.all([
        fetchJson(config.indexerHealthUrl),
        fetchText(config.indexerMetricsUrl),
        fetchJson(config.judgeHealthUrl),
        fetchText(config.judgeMetricsUrl),
    ]);

    const indexerMetrics = parsePrometheusMetrics(indexerMetricsRaw);
    const judgeMetrics = parsePrometheusMetrics(judgeMetricsRaw);
    const now = Math.floor(Date.now() / 1000);

    return {
        indexer: {
            healthOk: indexerHealth.ok === true,
            eventsProcessedTotal: requireMetric(indexerMetrics, 'gradience_indexer_events_processed_total'),
            lastEventTimestamp: requireMetric(indexerMetrics, 'gradience_indexer_last_event_timestamp_unix'),
        },
        judgeDaemon: {
            healthOk: judgeHealth.ok === true,
            mode: findMode(judgeMetrics),
            pendingWorkflows: requireMetric(judgeMetrics, 'gradience_judge_daemon_pending_workflows'),
            sourceErrorsTotal: requireMetric(judgeMetrics, 'gradience_judge_daemon_source_errors_total'),
            lastEventTimestamp: requireMetric(judgeMetrics, 'gradience_judge_daemon_last_event_timestamp_unix'),
        },
        evaluatedAt: now,
    };
}

export function evaluateAlertGate(snapshot: AlertGateSnapshot, config: AlertGateConfig): string[] {
    const failures: string[] = [];
    if (!snapshot.indexer.healthOk) {
        failures.push('indexer /healthz not ok');
    }
    if (!snapshot.judgeDaemon.healthOk) {
        failures.push('judge-daemon /healthz not ok');
    }
    if (snapshot.judgeDaemon.mode === 'none') {
        failures.push('judge-daemon active mode is none');
    }
    if (snapshot.judgeDaemon.pendingWorkflows > config.maxPendingWorkflows) {
        failures.push(
            `pending workflows too high: ${snapshot.judgeDaemon.pendingWorkflows} > ${config.maxPendingWorkflows}`,
        );
    }
    if (snapshot.judgeDaemon.sourceErrorsTotal > config.maxSourceErrors) {
        failures.push(`source errors too high: ${snapshot.judgeDaemon.sourceErrorsTotal} > ${config.maxSourceErrors}`);
    }

    if (config.requireEventActivity) {
        if (snapshot.indexer.lastEventTimestamp <= 0) {
            failures.push('indexer has no observed event timestamp');
        }
        if (snapshot.judgeDaemon.lastEventTimestamp <= 0) {
            failures.push('judge-daemon has no observed event timestamp');
        }
        if (
            snapshot.indexer.lastEventTimestamp > 0 &&
            snapshot.evaluatedAt - snapshot.indexer.lastEventTimestamp > config.maxEventStalenessSeconds
        ) {
            failures.push(
                `indexer event timestamp stale by ${snapshot.evaluatedAt - snapshot.indexer.lastEventTimestamp}s`,
            );
        }
        if (
            snapshot.judgeDaemon.lastEventTimestamp > 0 &&
            snapshot.evaluatedAt - snapshot.judgeDaemon.lastEventTimestamp > config.maxEventStalenessSeconds
        ) {
            failures.push(
                `judge-daemon event timestamp stale by ${
                    snapshot.evaluatedAt - snapshot.judgeDaemon.lastEventTimestamp
                }s`,
            );
        }
    }

    return failures;
}

export async function runAlertGate(
    config: AlertGateConfig = loadAlertGateConfig(),
): Promise<{ snapshot: AlertGateSnapshot; failures: string[] }> {
    const snapshot = await collectAlertGateSnapshot(config);
    const failures = evaluateAlertGate(snapshot, config);
    return { snapshot, failures };
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runAlertGate()
        .then(({ snapshot, failures }) => {
            process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, failures, snapshot }, null, 2)}\n`);
            if (failures.length > 0) {
                process.exit(1);
            }
        })
        .catch(error => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
