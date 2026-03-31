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
            const parsed = new URL(url);
            const limit = Number(parsed.searchParams.get('limit') ?? '50');
            const offset = Number(parsed.searchParams.get('offset') ?? '0');
            if (offset === 0) {
                tick += 1;
            }
            const snapshot =
                tick === 1
                    ? [task(5), task(4), task(3), task(2), task(1)]
                    : tick === 2
                      ? [task(9), task(8), task(7), task(6), task(5), task(4), task(3), task(2), task(1)]
                      : [task(9), task(8), task(7), task(6), task(5), task(4), task(3), task(2), task(1)];
            return json(snapshot.slice(offset, offset + limit));
        }
        return new Response(null, { status: 404 });
    };

    const poll = createIndexerPollingFetcher('http://indexer.local', {
        maxSeenTaskIds: 100,
        maxSeenSubmissionKeys: 100,
        tasksPageSize: 2,
        maxTaskPages: 10,
        fetcher,
    });

    const first = await poll();
    const second = await poll();
    const third = await poll();

    const firstTaskIds = first
        .filter((event) => event.event.event === 'task_created')
        .map((event) => (event.event.event === 'task_created' ? event.event.task_id : -1));
    const secondTaskIds = second
        .filter((event) => event.event.event === 'task_created')
        .map((event) => (event.event.event === 'task_created' ? event.event.task_id : -1));
    const thirdTaskIds = third
        .filter((event) => event.event.event === 'task_created')
        .map((event) => (event.event.event === 'task_created' ? event.event.task_id : -1));

    assert.deepEqual(firstTaskIds, [5, 4, 3, 2, 1]);
    assert.deepEqual(secondTaskIds, [9, 8, 7, 6]);
    assert.deepEqual(thirdTaskIds, []);
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
