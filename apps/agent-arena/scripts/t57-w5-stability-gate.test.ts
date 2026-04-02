import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildChecklist,
    evaluateT57Gate,
    type T57PhaseResult,
} from './t57-w5-stability-gate.ts';
import type { T46DrillReport } from './t46-abnormal-paths.ts';
import type { T47DrillReport } from './t47-pool-alt.ts';
import type { T48DrillReport } from './t48-event-loop.ts';

function createT46Report(ok: boolean): T46DrillReport {
    return {
        generatedAt: '2026-04-02T00:00:00.000Z',
        repoRoot: '/repo',
        ok,
        passRate: ok ? 1 : 0,
        requiredTotal: 1,
        requiredPassed: ok ? 1 : 0,
        cases: [],
        coverage: [],
    };
}

function createT47Report(withBaselines = true): T47DrillReport {
    return {
        generatedAt: '2026-04-02T00:00:00.000Z',
        repoRoot: '/repo',
        ok: true,
        passRate: 1,
        requiredTotal: 1,
        requiredPassed: 1,
        cases: [],
        coverage: [
            {
                scenario: 'alt_switch',
                overall: 'pass',
                cells: [],
            },
        ],
        instructionBaselines: withBaselines
            ? [
                  {
                      instruction: 'post_task',
                      computeUnits: 1,
                      txSizeBytes: 1,
                      latencyMs: 1,
                  },
                  {
                      instruction: 'judge_and_pay',
                      computeUnits: 1,
                      txSizeBytes: 1,
                      latencyMs: 1,
                  },
              ]
            : [],
    };
}

function createT48Report(mode: T48DrillReport['modeClassification']): T48DrillReport {
    return {
        generatedAt: '2026-04-02T00:00:00.000Z',
        repoRoot: '/repo',
        ok: true,
        passRate: 1,
        requiredTotal: 1,
        requiredPassed: 1,
        taskId: 7,
        activeJudgeMode: mode === 'primary' ? 'triton' : 'polling',
        modeClassification: mode,
        cases: [
            { id: 'ws-primary-roundtrip', required: true, success: true, detail: 'ok' },
            { id: 'ws-reconnect-roundtrip', required: true, success: true, detail: 'ok' },
            { id: 'indexer-replay-idempotent', required: true, success: true, detail: 'ok' },
            { id: 'judge-replay-dedup', required: true, success: true, detail: 'ok' },
        ],
        observations: {
            wsRound1: [],
            wsRound2: [],
            indexer: {
                before: {
                    eventsProcessedTotal: 0,
                    wsEventsPublishedTotal: 0,
                    wsConnectionsTotal: 0,
                    wsActiveConnections: 0,
                    lastEventTimestamp: 0,
                },
                after: {
                    eventsProcessedTotal: 0,
                    wsEventsPublishedTotal: 0,
                    wsConnectionsTotal: 0,
                    wsActiveConnections: 0,
                    lastEventTimestamp: 0,
                },
            },
            judge: {
                before: {
                    mode: 'polling',
                    eventsProcessedTotal: 0,
                    workflowsQueuedTotal: 0,
                    pendingWorkflows: 0,
                    sourceErrorsTotal: 0,
                    lastEventTimestamp: 0,
                },
                afterFirst: {
                    sampleCount: 1,
                    mode: 'polling',
                    maxEventsProcessedTotal: 0,
                    maxWorkflowsQueuedTotal: 0,
                    maxPendingWorkflows: 0,
                    maxSourceErrorsTotal: 0,
                    maxLastEventTimestamp: 0,
                },
                afterReplay: {
                    sampleCount: 1,
                    mode: 'polling',
                    maxEventsProcessedTotal: 0,
                    maxWorkflowsQueuedTotal: 0,
                    maxPendingWorkflows: 0,
                    maxSourceErrorsTotal: 0,
                    maxLastEventTimestamp: 0,
                },
            },
            taskState: 'completed',
            submissionCount: 1,
        },
    };
}

test('buildChecklist maps T46/T47/T48 status into pass checklist', () => {
    const checklist = buildChecklist(
        createT46Report(true),
        createT47Report(true),
        createT48Report('fallback'),
    );
    assert.equal(checklist.length, 4);
    assert.ok(checklist.every((item) => item.status === 'pass'));
});

test('evaluateT57Gate fails when required baseline metrics are missing', () => {
    const phases: T57PhaseResult[] = [
        {
            id: 't46',
            label: 'T46',
            required: true,
            status: 'pass',
            passRate: 1,
            requiredTotal: 1,
            requiredPassed: 1,
            durationMs: 1,
            error: null,
        },
        {
            id: 't47',
            label: 'T47',
            required: true,
            status: 'pass',
            passRate: 1,
            requiredTotal: 1,
            requiredPassed: 1,
            durationMs: 1,
            error: null,
        },
        {
            id: 't48',
            label: 'T48',
            required: true,
            status: 'pass',
            passRate: 1,
            requiredTotal: 1,
            requiredPassed: 1,
            durationMs: 1,
            error: null,
        },
    ];

    const failures = evaluateT57Gate({
        phases,
        checklist: buildChecklist(
            createT46Report(true),
            createT47Report(false),
            createT48Report('fallback'),
        ),
        t47Report: createT47Report(false),
        t48Report: createT48Report('fallback'),
        allowUnknownMode: false,
    });

    assert.ok(failures.some((item) => item.includes('missing T47 baseline metric')));
});

test('evaluateT57Gate rejects unknown judge mode classification by default', () => {
    const failures = evaluateT57Gate({
        phases: [
            {
                id: 't46',
                label: 'T46',
                required: true,
                status: 'pass',
                passRate: 1,
                requiredTotal: 1,
                requiredPassed: 1,
                durationMs: 1,
                error: null,
            },
            {
                id: 't47',
                label: 'T47',
                required: true,
                status: 'pass',
                passRate: 1,
                requiredTotal: 1,
                requiredPassed: 1,
                durationMs: 1,
                error: null,
            },
            {
                id: 't48',
                label: 'T48',
                required: true,
                status: 'pass',
                passRate: 1,
                requiredTotal: 1,
                requiredPassed: 1,
                durationMs: 1,
                error: null,
            },
        ],
        checklist: buildChecklist(
            createT46Report(true),
            createT47Report(true),
            createT48Report('unknown'),
        ),
        t47Report: createT47Report(true),
        t48Report: createT48Report('unknown'),
        allowUnknownMode: false,
    });

    assert.ok(failures.some((item) => item.includes('unknown T48 judge mode')));
});
