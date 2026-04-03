import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildMockWebhookPayload,
    classifyJudgeMode,
    evaluateReplayConsistency,
    extractJudgeMode,
    isExpectedWsSequence,
    parsePrometheusMetrics,
    runT48EventLoopDrill,
    type CollectWsEventsInput,
    type JudgeMetricsSnapshot,
    type JudgeWindowSummary,
    type T48DrillConfig,
    type WsBroadcastEvent,
} from './t48-event-loop.ts';

test('parsePrometheusMetrics and extractJudgeMode parse labeled mode metric', () => {
    const metrics = parsePrometheusMetrics(
        `
        gradience_judge_daemon_events_processed_total 12
        gradience_judge_daemon_mode_info{mode="polling"} 1
        `,
    );
    assert.equal(metrics.get('gradience_judge_daemon_events_processed_total'), 12);
    assert.equal(extractJudgeMode(metrics), 'polling');
    assert.equal(classifyJudgeMode('triton'), 'primary');
    assert.equal(classifyJudgeMode('polling'), 'fallback');
});

test('buildMockWebhookPayload creates deterministic 3-event chain', () => {
    const payload = buildMockWebhookPayload(42, 1_710_000_000);
    assert.equal(payload.events.length, 3);
    const created = payload.events[0]?.event as { event: string; task_id: number };
    const submission = payload.events[1]?.event as { event: string; task_id: number };
    const judged = payload.events[2]?.event as { event: string; task_id: number };
    assert.equal(created.event, 'task_created');
    assert.equal(submission.event, 'submission_received');
    assert.equal(judged.event, 'task_judged');
    assert.equal(created.task_id, 42);
    assert.equal(submission.task_id, 42);
    assert.equal(judged.task_id, 42);
});

test('isExpectedWsSequence validates order and consistent task id', () => {
    const okSequence: WsBroadcastEvent[] = [
        { event: 'task_created', task_id: 9, slot: 1, timestamp: 1 },
        { event: 'submission_received', task_id: 9, slot: 2, timestamp: 2 },
        { event: 'task_judged', task_id: 9, slot: 3, timestamp: 3 },
    ];
    const badSequence: WsBroadcastEvent[] = [
        { event: 'task_created', task_id: 9, slot: 1, timestamp: 1 },
        { event: 'task_judged', task_id: 9, slot: 2, timestamp: 2 },
        { event: 'submission_received', task_id: 9, slot: 3, timestamp: 3 },
    ];
    assert.equal(isExpectedWsSequence(okSequence, ['task_created', 'submission_received', 'task_judged']), true);
    assert.equal(isExpectedWsSequence(badSequence, ['task_created', 'submission_received', 'task_judged']), false);
});

test('evaluateReplayConsistency rejects replay-driven judge counter drift', () => {
    const judgeBefore: JudgeMetricsSnapshot = {
        mode: 'polling',
        eventsProcessedTotal: 100,
        workflowsQueuedTotal: 50,
        pendingWorkflows: 0,
        sourceErrorsTotal: 0,
        lastEventTimestamp: 1_710_000_000,
    };
    const judgeAfterFirst: JudgeWindowSummary = {
        sampleCount: 3,
        mode: 'polling',
        maxEventsProcessedTotal: 102,
        maxWorkflowsQueuedTotal: 52,
        maxPendingWorkflows: 0,
        maxSourceErrorsTotal: 0,
        maxLastEventTimestamp: 1_710_000_010,
    };
    const judgeAfterReplay: JudgeWindowSummary = {
        sampleCount: 3,
        mode: 'polling',
        maxEventsProcessedTotal: 103,
        maxWorkflowsQueuedTotal: 53,
        maxPendingWorkflows: 0,
        maxSourceErrorsTotal: 0,
        maxLastEventTimestamp: 1_710_000_020,
    };

    const result = evaluateReplayConsistency({
        taskState: 'completed',
        submissionCount: 1,
        expectedSubmissionCount: 1,
        judgeBefore,
        judgeAfterFirst,
        judgeAfterReplay,
        judgeReplayEventTolerance: 0,
        judgeReplayWorkflowTolerance: 0,
        requireJudgeProgress: true,
    });
    assert.equal(result.indexerConsistent, true);
    assert.equal(result.judgeProgressed, true);
    assert.equal(result.judgeReplayDedup, false);
    assert.ok(result.failures.some(item => item.includes('judge replay dedupe failed')));
});

test('runT48EventLoopDrill produces passing report with replay-stable judge counters', async () => {
    const indexerState = {
        eventsProcessedTotal: 0,
        wsEventsPublishedTotal: 0,
        wsConnectionsTotal: 0,
        wsActiveConnections: 0,
        lastEventTimestamp: 0,
    };
    const judgeState = {
        mode: 'polling',
        eventsProcessedTotal: 5,
        workflowsQueuedTotal: 2,
        pendingWorkflows: 0,
        sourceErrorsTotal: 0,
        lastEventTimestamp: 1_710_000_000,
    };
    let webhookCalls = 0;

    const config: T48DrillConfig = {
        indexerBaseUrl: 'http://indexer.local',
        judgeBaseUrl: 'http://judge.local',
        indexerWebhookUrl: 'http://indexer.local/webhook/events',
        indexerWsUrl: 'ws://indexer.local/ws',
        wsTimeoutMs: 1_000,
        judgeObserveWindowMs: 10,
        judgePollIntervalMs: 10,
        taskId: 77,
        judgeReplayEventTolerance: 0,
        judgeReplayWorkflowTolerance: 0,
        requireJudgeProgress: true,
    };

    const fetchImpl: typeof fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const target = String(input);
        const url = new URL(target);
        if (url.pathname === '/healthz') {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url.pathname === '/metrics' && url.host === 'indexer.local') {
            return new Response(
                [
                    `gradience_indexer_events_processed_total ${indexerState.eventsProcessedTotal}`,
                    `gradience_indexer_ws_events_published_total ${indexerState.wsEventsPublishedTotal}`,
                    `gradience_indexer_ws_connections_total ${indexerState.wsConnectionsTotal}`,
                    `gradience_indexer_ws_active_connections ${indexerState.wsActiveConnections}`,
                    `gradience_indexer_last_event_timestamp_unix ${indexerState.lastEventTimestamp}`,
                ].join('\n'),
                { status: 200 },
            );
        }
        if (url.pathname === '/metrics' && url.host === 'judge.local') {
            return new Response(
                [
                    `gradience_judge_daemon_events_processed_total ${judgeState.eventsProcessedTotal}`,
                    `gradience_judge_daemon_workflows_queued_total ${judgeState.workflowsQueuedTotal}`,
                    `gradience_judge_daemon_pending_workflows ${judgeState.pendingWorkflows}`,
                    `gradience_judge_daemon_source_errors_total ${judgeState.sourceErrorsTotal}`,
                    `gradience_judge_daemon_last_event_timestamp_unix ${judgeState.lastEventTimestamp}`,
                    `gradience_judge_daemon_mode_info{mode="${judgeState.mode}"} 1`,
                ].join('\n'),
                { status: 200 },
            );
        }
        if (url.pathname === '/webhook/events') {
            webhookCalls += 1;
            indexerState.eventsProcessedTotal += 3;
            indexerState.wsEventsPublishedTotal += 3;
            indexerState.lastEventTimestamp += 3;
            if (webhookCalls === 1) {
                judgeState.eventsProcessedTotal += 2;
                judgeState.workflowsQueuedTotal += 2;
                judgeState.lastEventTimestamp += 2;
            }
            return new Response(JSON.stringify({ processed_events: 3 }), { status: 200 });
        }
        if (url.pathname === '/api/tasks/77') {
            return new Response(JSON.stringify({ task_id: 77, state: 'completed' }), {
                status: 200,
            });
        }
        if (url.pathname === '/api/tasks/77/submissions') {
            return new Response(JSON.stringify([{ task_id: 77, agent: 'A', submission_slot: 2 }]), { status: 200 });
        }
        throw new Error(`unexpected url in test fetch: ${target} (${init?.method ?? 'GET'})`);
    };

    const collectWsEvents = async (input: CollectWsEventsInput): Promise<WsBroadcastEvent[]> => {
        await input.trigger();
        return [
            { event: 'task_created', task_id: input.taskId, slot: 1, timestamp: 1 },
            {
                event: 'submission_received',
                task_id: input.taskId,
                slot: 2,
                timestamp: 2,
            },
            { event: 'task_judged', task_id: input.taskId, slot: 3, timestamp: 3 },
        ];
    };

    const report = await runT48EventLoopDrill(config, {
        fetchImpl,
        collectWsEvents,
        sleep: async () => {},
        nowUnix: () => 1_710_000_000,
    });
    assert.equal(report.ok, true);
    assert.equal(report.requiredPassed, report.requiredTotal);
    assert.equal(report.modeClassification, 'fallback');
});
