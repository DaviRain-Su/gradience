import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JudgeDaemon } from './daemon.js';
import { AbsurdWorkflowEngine } from './engine.js';
import { MockEventSource, PollingEventSource } from './sources.js';
import { InMemoryWorkflowStore } from './store.js';
import type { EventEnvelope } from './types.js';

function quietLogger(): Pick<Console, 'info' | 'warn' | 'error'> {
    return {
        info: () => {},
        warn: () => {},
        error: () => {},
    };
}

test('mock TaskCreated event queues evaluate workflow under 200ms', async () => {
    const store = new InMemoryWorkflowStore();
    const engine = new AbsurdWorkflowEngine(store);
    const events: EventEnvelope[] = [
        {
            slot: 100,
            timestamp: 1_710_000_000,
            event: { event: 'task_created', task_id: 42, category: 1 },
        },
    ];

    const daemon = new JudgeDaemon(engine, {
        tritonSource: new MockEventSource('triton', { events }),
        heliusSource: new MockEventSource('helius', { events: [], throwOnStart: true }),
        pollingSource: new PollingEventSource({
            pollEvents: async () => [],
        }),
        logger: quietLogger(),
    });

    const startedAt = Date.now();
    await daemon.start();
    const pending = await engine.listPending();
    const latency = Date.now() - startedAt;

    assert.equal(daemon.mode(), 'triton');
    assert.equal(pending.length, 1);
    const first = pending[0];
    assert.ok(first);
    assert.equal(first.taskId, 42);
    assert.equal(first.trigger, 'task_created');
    assert.ok(latency < 200);

    await daemon.stop();
});

test('daemon falls back from Triton to Helius to polling', async () => {
    const store = new InMemoryWorkflowStore();
    const engine = new AbsurdWorkflowEngine(store);
    const pollingSource = new PollingEventSource({
        pollEvents: async () => [],
    });

    const daemon = new JudgeDaemon(engine, {
        tritonSource: new MockEventSource('triton', { events: [], throwOnStart: true }),
        heliusSource: new MockEventSource('helius', { events: [], throwOnStart: true }),
        pollingSource,
        logger: quietLogger(),
    });

    await daemon.start();
    assert.equal(daemon.mode(), 'polling');
    assert.equal(pollingSource.pollIntervalMs, 5_000);
    await daemon.stop();
});

test('SubmissionReceived event queues workflow with agent context', async () => {
    const store = new InMemoryWorkflowStore();
    const engine = new AbsurdWorkflowEngine(store);
    const events: EventEnvelope[] = [
        {
            slot: 101,
            timestamp: 1_710_000_010,
            event: {
                event: 'submission_received',
                task_id: 9,
                agent: '11111111111111111111111111111111',
                submission_slot: 101,
            },
        },
    ];

    const daemon = new JudgeDaemon(engine, {
        tritonSource: new MockEventSource('triton', { events }),
        heliusSource: new MockEventSource('helius', { events: [], throwOnStart: true }),
        pollingSource: new PollingEventSource({
            pollEvents: async () => [],
        }),
        logger: quietLogger(),
    });

    await daemon.start();
    const pending = await engine.listPending();
    assert.equal(pending.length, 1);
    const first = pending[0];
    assert.ok(first);
    assert.equal(first.trigger, 'submission_received');
    assert.equal(first.agent, '11111111111111111111111111111111');
    await daemon.stop();
});
