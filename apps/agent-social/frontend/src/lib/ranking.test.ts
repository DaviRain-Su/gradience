import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sortAndFilterAgents, toDiscoveryRows } from './ranking';

test('sortAndFilterAgents orders by reputation score then weight', () => {
    const rows = sortAndFilterAgents(
        [
            {
                agent: 'agent-a',
                stake: 10,
                weight: 5,
                reputation: { global_avg_score: 7000, global_completed: 3 } as never,
            },
            {
                agent: 'agent-b',
                stake: 10,
                weight: 9,
                reputation: { global_avg_score: 9000, global_completed: 1 } as never,
            },
            {
                agent: 'agent-c',
                stake: 10,
                weight: 11,
                reputation: null,
            },
        ],
        '',
    );

    assert.equal(rows[0]?.agent, 'agent-b');
    assert.equal(rows[1]?.agent, 'agent-a');
    assert.equal(rows[2]?.agent, 'agent-c');
});

test('toDiscoveryRows maps judge pool with reputation map', () => {
    const rows = toDiscoveryRows(
        [
            { judge: 'agent-a', stake: 100, weight: 50 },
            { judge: 'agent-b', stake: 80, weight: 40 },
        ],
        new Map([
            ['agent-a', { global_avg_score: 8500, global_completed: 7 } as never],
            ['agent-b', null],
        ]),
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.agent, 'agent-a');
    assert.equal(rows[0]?.reputation?.global_avg_score, 8500);
    assert.equal(rows[1]?.reputation, null);
});
