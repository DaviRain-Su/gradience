import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_WS_SEQUENCE = ['task_created', 'submission_received', 'task_judged'] as const;

type RequiredWsEvent = (typeof REQUIRED_WS_SEQUENCE)[number];

export interface T48DrillConfig {
    indexerBaseUrl: string;
    judgeBaseUrl: string;
    indexerWebhookUrl: string;
    indexerWsUrl: string;
    wsTimeoutMs: number;
    judgeObserveWindowMs: number;
    judgePollIntervalMs: number;
    taskId?: number;
    judgeReplayEventTolerance: number;
    judgeReplayWorkflowTolerance: number;
    requireJudgeProgress: boolean;
}

export interface WsBroadcastEvent {
    event: string;
    task_id: number;
    slot: number;
    timestamp: number;
}

export interface IndexerMetricsSnapshot {
    eventsProcessedTotal: number;
    wsEventsPublishedTotal: number;
    wsConnectionsTotal: number;
    wsActiveConnections: number;
    lastEventTimestamp: number;
}

export interface JudgeMetricsSnapshot {
    mode: string;
    eventsProcessedTotal: number;
    workflowsQueuedTotal: number;
    pendingWorkflows: number;
    sourceErrorsTotal: number;
    lastEventTimestamp: number;
}

export interface JudgeWindowSummary {
    sampleCount: number;
    mode: string;
    maxEventsProcessedTotal: number;
    maxWorkflowsQueuedTotal: number;
    maxPendingWorkflows: number;
    maxSourceErrorsTotal: number;
    maxLastEventTimestamp: number;
}

export interface T48CaseResult {
    id: string;
    required: boolean;
    success: boolean;
    detail: string;
}

export interface ReplayConsistencyInput {
    taskState: string | null;
    submissionCount: number;
    expectedSubmissionCount: number;
    judgeBefore: JudgeMetricsSnapshot;
    judgeAfterFirst: JudgeWindowSummary;
    judgeAfterReplay: JudgeWindowSummary;
    judgeReplayEventTolerance: number;
    judgeReplayWorkflowTolerance: number;
    requireJudgeProgress: boolean;
}

export interface ReplayConsistencyResult {
    indexerConsistent: boolean;
    judgeProgressed: boolean;
    judgeReplayDedup: boolean;
    failures: string[];
}

export interface T48DrillReport {
    generatedAt: string;
    repoRoot: string;
    ok: boolean;
    passRate: number;
    requiredTotal: number;
    requiredPassed: number;
    taskId: number;
    activeJudgeMode: string;
    modeClassification: 'primary' | 'fallback' | 'unknown';
    cases: T48CaseResult[];
    observations: {
        wsRound1: WsBroadcastEvent[];
        wsRound2: WsBroadcastEvent[];
        indexer: {
            before: IndexerMetricsSnapshot;
            after: IndexerMetricsSnapshot;
        };
        judge: {
            before: JudgeMetricsSnapshot;
            afterFirst: JudgeWindowSummary;
            afterReplay: JudgeWindowSummary;
        };
        taskState: string | null;
        submissionCount: number;
    };
}

export interface CollectWsEventsInput {
    wsUrl: string;
    taskId: number;
    expectedEvents: readonly RequiredWsEvent[];
    timeoutMs: number;
    trigger: () => Promise<void>;
}

type CollectWsEvents = (input: CollectWsEventsInput) => Promise<WsBroadcastEvent[]>;

export interface T48DrillDeps {
    fetchImpl?: typeof fetch;
    collectWsEvents?: CollectWsEvents;
    sleep?: (ms: number) => Promise<void>;
    nowUnix?: () => number;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARENA_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(ARENA_ROOT, '..', '..');

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

export function loadT48DrillConfig(env: NodeJS.ProcessEnv = process.env): T48DrillConfig {
    const indexerBaseUrl = env.T48_INDEXER_BASE_URL ?? 'http://127.0.0.1:8787';
    return {
        indexerBaseUrl,
        judgeBaseUrl: env.T48_JUDGE_BASE_URL ?? 'http://127.0.0.1:9797',
        indexerWebhookUrl: `${indexerBaseUrl.replace(/\/$/, '')}/webhook/events`,
        indexerWsUrl: env.T48_INDEXER_WS_URL ?? 'ws://127.0.0.1:8787/ws',
        wsTimeoutMs: parseNumber(env.T48_WS_TIMEOUT_MS, 12_000),
        judgeObserveWindowMs: parseNumber(env.T48_JUDGE_OBSERVE_WINDOW_MS, 12_000),
        judgePollIntervalMs: parseNumber(env.T48_JUDGE_POLL_INTERVAL_MS, 2_000),
        taskId: env.T48_TASK_ID ? Number(env.T48_TASK_ID) : undefined,
        judgeReplayEventTolerance: parseNumber(env.T48_JUDGE_REPLAY_EVENT_TOLERANCE, 0),
        judgeReplayWorkflowTolerance: parseNumber(env.T48_JUDGE_REPLAY_WORKFLOW_TOLERANCE, 0),
        requireJudgeProgress: parseBoolean(env.T48_REQUIRE_JUDGE_PROGRESS, true),
    };
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

export function extractJudgeMode(metrics: Map<string, number>): string {
    for (const [key, value] of metrics.entries()) {
        if (!key.startsWith('gradience_judge_daemon_mode_info{')) {
            continue;
        }
        if (value !== 1) {
            continue;
        }
        const matched = key.match(/mode="([^"]+)"/);
        if (matched?.[1]) {
            return matched[1];
        }
    }
    return 'none';
}

export function classifyJudgeMode(mode: string): 'primary' | 'fallback' | 'unknown' {
    if (mode === 'triton') {
        return 'primary';
    }
    if (mode === 'helius' || mode === 'polling') {
        return 'fallback';
    }
    return 'unknown';
}

export function buildMockWebhookPayload(
    taskId: number,
    timestamp: number,
): {
    events: Array<Record<string, unknown>>;
} {
    const slotBase = Math.max(1, timestamp);
    return {
        events: [
            {
                slot: slotBase,
                timestamp,
                event: {
                    event: 'task_created',
                    task_id: taskId,
                    poster: bytePubkey(11),
                    judge: bytePubkey(22),
                    reward: 100_000_000,
                    category: 1,
                    deadline: timestamp + 3_600,
                },
            },
            {
                slot: slotBase + 1,
                timestamp: timestamp + 1,
                event: {
                    event: 'submission_received',
                    task_id: taskId,
                    agent: bytePubkey(33),
                    result_ref: `ar://t48-result-${taskId}`,
                    trace_ref: `ar://t48-trace-${taskId}`,
                    submission_slot: slotBase + 1,
                },
            },
            {
                slot: slotBase + 2,
                timestamp: timestamp + 2,
                event: {
                    event: 'task_judged',
                    task_id: taskId,
                    winner: bytePubkey(33),
                    score: 88,
                    agent_payout: 95_000_000,
                    judge_fee: 3_000_000,
                    protocol_fee: 2_000_000,
                },
            },
        ],
    };
}

function bytePubkey(seed: number): number[] {
    return Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}

export function isExpectedWsSequence(events: WsBroadcastEvent[], expected: readonly RequiredWsEvent[]): boolean {
    if (events.length !== expected.length) {
        return false;
    }
    const expectedTaskId = events[0]?.task_id;
    if (typeof expectedTaskId !== 'number') {
        return false;
    }
    for (let index = 0; index < expected.length; index += 1) {
        const event = events[index];
        if (!event || event.event !== expected[index] || event.task_id !== expectedTaskId) {
            return false;
        }
    }
    return true;
}

export function evaluateReplayConsistency(input: ReplayConsistencyInput): ReplayConsistencyResult {
    const failures: string[] = [];

    const indexerConsistent =
        input.taskState === 'completed' && input.submissionCount === input.expectedSubmissionCount;
    if (!indexerConsistent) {
        failures.push(`indexer state drift: state=${input.taskState ?? 'null'}, submissions=${input.submissionCount}`);
    }

    const judgeProgressed = input.judgeAfterFirst.maxEventsProcessedTotal > input.judgeBefore.eventsProcessedTotal;
    if (input.requireJudgeProgress && !judgeProgressed) {
        failures.push('judge-daemon did not consume new events during first pass');
    }

    const replayEventsDelta =
        input.judgeAfterReplay.maxEventsProcessedTotal - input.judgeAfterFirst.maxEventsProcessedTotal;
    const replayWorkflowDelta =
        input.judgeAfterReplay.maxWorkflowsQueuedTotal - input.judgeAfterFirst.maxWorkflowsQueuedTotal;

    const judgeReplayDedup =
        replayEventsDelta <= input.judgeReplayEventTolerance &&
        replayWorkflowDelta <= input.judgeReplayWorkflowTolerance;
    if (!judgeReplayDedup) {
        failures.push(
            `judge replay dedupe failed: events_delta=${replayEventsDelta}, workflows_delta=${replayWorkflowDelta}`,
        );
    }

    return {
        indexerConsistent,
        judgeProgressed,
        judgeReplayDedup,
        failures,
    };
}

export async function collectWsEventsViaWebSocket(input: CollectWsEventsInput): Promise<WsBroadcastEvent[]> {
    const WebSocketCtor = globalThis.WebSocket;
    if (typeof WebSocketCtor !== 'function') {
        throw new Error('global WebSocket is not available in this Node runtime');
    }

    const wsUrl = withTaskFilter(input.wsUrl, input.taskId);

    return await new Promise((resolve, reject) => {
        const socket = new WebSocketCtor(wsUrl);
        const received: WsBroadcastEvent[] = [];
        let settled = false;
        let triggerStarted = false;
        const timeoutHandle = setTimeout(() => {
            fail(
                new Error(
                    `websocket timeout waiting for ${input.expectedEvents.length} events (${received.length} received)`,
                ),
            );
        }, input.timeoutMs);

        const fail = (error: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeoutHandle);
            try {
                socket.close();
            } catch (error) {
                void error;
            }
            reject(error);
        };

        const succeed = (): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeoutHandle);
            try {
                socket.close();
            } catch (error) {
                void error;
            }
            resolve(received);
        };

        socket.addEventListener('open', () => {
            if (triggerStarted) {
                return;
            }
            triggerStarted = true;
            input.trigger().catch(error => {
                fail(error instanceof Error ? error : new Error(String(error)));
            });
        });

        socket.addEventListener('error', () => {
            fail(new Error(`websocket connection failed: ${wsUrl}`));
        });

        socket.addEventListener('close', () => {
            if (settled) {
                return;
            }
            if (received.length >= input.expectedEvents.length) {
                succeed();
                return;
            }
            fail(
                new Error(
                    `websocket closed before all events arrived (${received.length}/${input.expectedEvents.length})`,
                ),
            );
        });

        socket.addEventListener('message', (message: unknown) => {
            normalizeWsMessage(message)
                .then(event => {
                    if (!event || event.task_id !== input.taskId) {
                        return;
                    }
                    received.push(event);
                    if (received.length >= input.expectedEvents.length) {
                        succeed();
                    }
                })
                .catch(error => {
                    fail(error instanceof Error ? error : new Error(String(error)));
                });
        });
    });
}

async function normalizeWsMessage(message: unknown): Promise<WsBroadcastEvent | null> {
    if (!message || typeof message !== 'object') {
        return null;
    }
    const data = (message as { data?: unknown }).data;
    const text = await normalizeWsData(data);
    if (!text) {
        return null;
    }
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (
        typeof parsed.event !== 'string' ||
        typeof parsed.task_id !== 'number' ||
        typeof parsed.slot !== 'number' ||
        typeof parsed.timestamp !== 'number'
    ) {
        return null;
    }
    return {
        event: parsed.event,
        task_id: parsed.task_id,
        slot: parsed.slot,
        timestamp: parsed.timestamp,
    };
}

async function normalizeWsData(data: unknown): Promise<string> {
    if (typeof data === 'string') {
        return data;
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString('utf8');
    }
    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
    }
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        const raw = await data.arrayBuffer();
        return Buffer.from(raw).toString('utf8');
    }
    return typeof data === 'undefined' ? '' : String(data);
}

function withTaskFilter(wsUrl: string, taskId: number): string {
    const url = new URL(wsUrl);
    url.searchParams.set('task_id', String(taskId));
    return url.toString();
}

async function fetchJson<T>(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetchImpl(url, init);
    } catch (error) {
        throw new Error(`request failed (network): ${url}: ${asMessage(error)}`);
    }
    if (!response.ok) {
        throw new Error(`request failed: ${response.status} ${url}`);
    }
    return (await response.json()) as T;
}

async function fetchText(fetchImpl: typeof fetch, url: string): Promise<string> {
    let response: Response;
    try {
        response = await fetchImpl(url);
    } catch (error) {
        throw new Error(`request failed (network): ${url}: ${asMessage(error)}`);
    }
    if (!response.ok) {
        throw new Error(`request failed: ${response.status} ${url}`);
    }
    return response.text();
}

async function fetchIndexerMetrics(fetchImpl: typeof fetch, baseUrl: string): Promise<IndexerMetricsSnapshot> {
    const body = await fetchText(fetchImpl, `${baseUrl.replace(/\/$/, '')}/metrics`);
    const metrics = parsePrometheusMetrics(body);
    return {
        eventsProcessedTotal: requireMetric(metrics, 'gradience_indexer_events_processed_total'),
        wsEventsPublishedTotal: requireMetric(metrics, 'gradience_indexer_ws_events_published_total'),
        wsConnectionsTotal: requireMetric(metrics, 'gradience_indexer_ws_connections_total'),
        wsActiveConnections: requireMetric(metrics, 'gradience_indexer_ws_active_connections'),
        lastEventTimestamp: requireMetric(metrics, 'gradience_indexer_last_event_timestamp_unix'),
    };
}

async function fetchJudgeMetrics(fetchImpl: typeof fetch, baseUrl: string): Promise<JudgeMetricsSnapshot> {
    const body = await fetchText(fetchImpl, `${baseUrl.replace(/\/$/, '')}/metrics`);
    const metrics = parsePrometheusMetrics(body);
    return {
        mode: extractJudgeMode(metrics),
        eventsProcessedTotal: requireMetric(metrics, 'gradience_judge_daemon_events_processed_total'),
        workflowsQueuedTotal: requireMetric(metrics, 'gradience_judge_daemon_workflows_queued_total'),
        pendingWorkflows: requireMetric(metrics, 'gradience_judge_daemon_pending_workflows'),
        sourceErrorsTotal: requireMetric(metrics, 'gradience_judge_daemon_source_errors_total'),
        lastEventTimestamp: requireMetric(metrics, 'gradience_judge_daemon_last_event_timestamp_unix'),
    };
}

async function fetchHealthOk(fetchImpl: typeof fetch, url: string): Promise<boolean> {
    const json = await fetchJson<Record<string, unknown>>(fetchImpl, url);
    return json.ok === true;
}

async function observeJudgeWindow(
    config: T48DrillConfig,
    fetchImpl: typeof fetch,
    sleep: (ms: number) => Promise<void>,
): Promise<JudgeWindowSummary> {
    const sampleCount = Math.max(1, Math.ceil(config.judgeObserveWindowMs / config.judgePollIntervalMs));
    const samples: JudgeMetricsSnapshot[] = [];
    for (let index = 0; index < sampleCount; index += 1) {
        samples.push(await fetchJudgeMetrics(fetchImpl, config.judgeBaseUrl));
        if (index + 1 < sampleCount) {
            await sleep(config.judgePollIntervalMs);
        }
    }
    return summarizeJudgeSamples(samples);
}

function summarizeJudgeSamples(samples: JudgeMetricsSnapshot[]): JudgeWindowSummary {
    const fallback: JudgeWindowSummary = {
        sampleCount: samples.length,
        mode: 'none',
        maxEventsProcessedTotal: 0,
        maxWorkflowsQueuedTotal: 0,
        maxPendingWorkflows: 0,
        maxSourceErrorsTotal: 0,
        maxLastEventTimestamp: 0,
    };
    if (samples.length === 0) {
        return fallback;
    }
    return {
        sampleCount: samples.length,
        mode: samples[samples.length - 1]?.mode ?? 'none',
        maxEventsProcessedTotal: Math.max(...samples.map(item => item.eventsProcessedTotal)),
        maxWorkflowsQueuedTotal: Math.max(...samples.map(item => item.workflowsQueuedTotal)),
        maxPendingWorkflows: Math.max(...samples.map(item => item.pendingWorkflows)),
        maxSourceErrorsTotal: Math.max(...samples.map(item => item.sourceErrorsTotal)),
        maxLastEventTimestamp: Math.max(...samples.map(item => item.lastEventTimestamp)),
    };
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function createCase(id: string, success: boolean, detail: string, required = true): T48CaseResult {
    return {
        id,
        required,
        success,
        detail,
    };
}

async function ingestMockEvents(
    fetchImpl: typeof fetch,
    webhookUrl: string,
    payload: { events: Array<Record<string, unknown>> },
): Promise<number> {
    const response = await fetchJson<{ processed_events?: number }>(fetchImpl, webhookUrl, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return Number(response.processed_events ?? 0);
}

async function fetchTaskState(
    fetchImpl: typeof fetch,
    baseUrl: string,
    taskId: number,
): Promise<{ state: string | null; submissionCount: number }> {
    const task = await fetchJson<Record<string, unknown>>(
        fetchImpl,
        `${baseUrl.replace(/\/$/, '')}/api/tasks/${taskId}`,
    );
    const submissions = await fetchJson<Array<Record<string, unknown>>>(
        fetchImpl,
        `${baseUrl.replace(/\/$/, '')}/api/tasks/${taskId}/submissions?sort=slot`,
    );
    return {
        state: typeof task.state === 'string' ? task.state : null,
        submissionCount: submissions.length,
    };
}

function nextTaskId(nowUnix: number): number {
    return nowUnix * 1_000 + Math.floor(Math.random() * 1_000);
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export async function runT48EventLoopDrill(
    config: T48DrillConfig = loadT48DrillConfig(),
    deps: T48DrillDeps = {},
): Promise<T48DrillReport> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const collectWsEvents = deps.collectWsEvents ?? collectWsEventsViaWebSocket;
    const sleep = deps.sleep ?? defaultSleep;
    const nowUnix = deps.nowUnix ?? (() => Math.floor(Date.now() / 1000));
    const taskId = config.taskId ?? nextTaskId(nowUnix());
    const payload = buildMockWebhookPayload(taskId, nowUnix());
    const cases: T48CaseResult[] = [];

    const [indexerHealthOk, judgeHealthOk, indexerBefore, judgeBefore] = await Promise.all([
        fetchHealthOk(fetchImpl, `${config.indexerBaseUrl.replace(/\/$/, '')}/healthz`),
        fetchHealthOk(fetchImpl, `${config.judgeBaseUrl.replace(/\/$/, '')}/healthz`),
        fetchIndexerMetrics(fetchImpl, config.indexerBaseUrl),
        fetchJudgeMetrics(fetchImpl, config.judgeBaseUrl),
    ]);

    cases.push(
        createCase(
            'indexer-health',
            indexerHealthOk,
            indexerHealthOk ? 'indexer /healthz ok' : 'indexer /healthz not ok',
        ),
    );
    cases.push(
        createCase(
            'judge-health',
            judgeHealthOk,
            judgeHealthOk ? 'judge-daemon /healthz ok' : 'judge-daemon /healthz not ok',
        ),
    );

    const wsRound1 = await collectWsEvents({
        wsUrl: config.indexerWsUrl,
        taskId,
        expectedEvents: REQUIRED_WS_SEQUENCE,
        timeoutMs: config.wsTimeoutMs,
        trigger: async () => {
            const processedEvents = await ingestMockEvents(fetchImpl, config.indexerWebhookUrl, payload);
            if (processedEvents !== payload.events.length) {
                throw new Error(
                    `webhook ingest mismatch for round1: processed=${processedEvents}, expected=${payload.events.length}`,
                );
            }
        },
    });
    cases.push(
        createCase(
            'ws-primary-roundtrip',
            isExpectedWsSequence(wsRound1, REQUIRED_WS_SEQUENCE),
            `ws round1 events=${wsRound1.map(entry => entry.event).join('>')}`,
        ),
    );

    const judgeAfterFirst = await observeJudgeWindow(config, fetchImpl, sleep);
    const judgeProgressed = judgeAfterFirst.maxEventsProcessedTotal > judgeBefore.eventsProcessedTotal;
    cases.push(
        createCase(
            'judge-consumption',
            !config.requireJudgeProgress || judgeProgressed,
            `judge events before=${judgeBefore.eventsProcessedTotal}, after_first=${judgeAfterFirst.maxEventsProcessedTotal}`,
        ),
    );

    const wsRound2 = await collectWsEvents({
        wsUrl: config.indexerWsUrl,
        taskId,
        expectedEvents: REQUIRED_WS_SEQUENCE,
        timeoutMs: config.wsTimeoutMs,
        trigger: async () => {
            const processedEvents = await ingestMockEvents(fetchImpl, config.indexerWebhookUrl, payload);
            if (processedEvents !== payload.events.length) {
                throw new Error(
                    `webhook ingest mismatch for round2: processed=${processedEvents}, expected=${payload.events.length}`,
                );
            }
        },
    });
    cases.push(
        createCase(
            'ws-reconnect-roundtrip',
            isExpectedWsSequence(wsRound2, REQUIRED_WS_SEQUENCE),
            `ws round2 events=${wsRound2.map(entry => entry.event).join('>')}`,
        ),
    );

    const [{ state: taskState, submissionCount }, indexerAfter] = await Promise.all([
        fetchTaskState(fetchImpl, config.indexerBaseUrl, taskId),
        fetchIndexerMetrics(fetchImpl, config.indexerBaseUrl),
    ]);
    const judgeAfterReplay = await observeJudgeWindow(config, fetchImpl, sleep);

    const replayEvaluation = evaluateReplayConsistency({
        taskState,
        submissionCount,
        expectedSubmissionCount: 1,
        judgeBefore,
        judgeAfterFirst,
        judgeAfterReplay,
        judgeReplayEventTolerance: config.judgeReplayEventTolerance,
        judgeReplayWorkflowTolerance: config.judgeReplayWorkflowTolerance,
        requireJudgeProgress: config.requireJudgeProgress,
    });

    cases.push(
        createCase(
            'indexer-replay-idempotent',
            replayEvaluation.indexerConsistent,
            replayEvaluation.indexerConsistent
                ? 'indexer task/submission state stable after replay'
                : replayEvaluation.failures.join('; '),
        ),
    );
    cases.push(
        createCase(
            'judge-replay-dedup',
            replayEvaluation.judgeReplayDedup,
            replayEvaluation.judgeReplayDedup
                ? 'judge counters unchanged after replay'
                : replayEvaluation.failures.join('; '),
        ),
    );

    const required = cases.filter(entry => entry.required);
    const requiredPassed = required.filter(entry => entry.success).length;
    const requiredTotal = required.length;
    const passRate = requiredTotal === 0 ? 1 : Math.round((requiredPassed / requiredTotal) * 10_000) / 10_000;
    const activeJudgeMode = judgeAfterReplay.mode;

    return {
        generatedAt: new Date().toISOString(),
        repoRoot: REPO_ROOT,
        ok: requiredPassed === requiredTotal,
        passRate,
        requiredTotal,
        requiredPassed,
        taskId,
        activeJudgeMode,
        modeClassification: classifyJudgeMode(activeJudgeMode),
        cases,
        observations: {
            wsRound1,
            wsRound2,
            indexer: {
                before: indexerBefore,
                after: indexerAfter,
            },
            judge: {
                before: judgeBefore,
                afterFirst: judgeAfterFirst,
                afterReplay: judgeAfterReplay,
            },
            taskState,
            submissionCount,
        },
    };
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runT48EventLoopDrill()
        .then(report => {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
            if (!report.ok) {
                process.exit(1);
            }
        })
        .catch(error => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
