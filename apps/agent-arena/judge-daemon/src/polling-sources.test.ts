import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createIndexerPollingFetcher } from './polling.js';
import { PollingEventSource } from './sources.js';

test('PollingEventSource executes ticks sequentially without overlap', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let calls = 0;

    const source = new PollingEventSource({
        pollIntervalMs: 1,
        pollEvents: async () => {
            calls += 1;
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await delay(20);
            concurrent -= 1;
            return [];
        },
    });

    await source.start(
        async () => {},
        async () => {},
    );
    await delay(70);
    await source.stop();

    assert.ok(calls >= 2);
    assert.equal(maxConcurrent, 1);
});

test('createIndexerPollingFetcher bounds seen task ids to avoid unbounded growth', async () => {
    let tick = 0;
    const fetcher: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes('/api/tasks?')) {
            tick += 1;
            const tasks =
                tick === 1
                    ? [task(1), task(2)]
                    : tick === 2
                      ? [task(3)]
                      : [task(1)];
            return json(tasks);
        }
        return new Response(null, { status: 404 });
    };

    const poll = createIndexerPollingFetcher('http://indexer.local', {
        maxSeenTaskIds: 2,
        maxSeenSubmissionKeys: 2,
        fetcher,
    });

    const first = await poll();
    const second = await poll();
    const third = await poll();

    assert.deepEqual(
        first.map((event) => event.event.event),
        ['task_created', 'task_created'],
    );
    assert.equal(second.length, 1);
    assert.equal(second[0]?.event.event, 'task_created');
    assert.equal(third.length, 1);
    assert.equal(third[0]?.event.event, 'task_created');
    if (third[0]?.event.event === 'task_created') {
        assert.equal(third[0].event.task_id, 1);
    }
});

function task(taskId: number) {
    return {
        task_id: taskId,
        poster: '11111111111111111111111111111111',
        judge: '11111111111111111111111111111111',
        reward: 1,
        category: 1,
        deadline: 0,
    };
}

function json(payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
