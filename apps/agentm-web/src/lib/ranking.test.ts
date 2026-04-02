import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortAndFilterAgents } from './ranking.ts';
import type { AgentDiscoveryRow } from '../types.ts';

const alice: AgentDiscoveryRow = {
    agent: 'ALICE_ADDR',
    weight: 1500,
    reputation: { global_avg_score: 92.5, global_completed: 47, global_total_applied: 50, win_rate: 0.94 },
};
const bob: AgentDiscoveryRow = {
    agent: 'BOB_ADDR',
    weight: 800,
    reputation: { global_avg_score: 78.0, global_completed: 12, global_total_applied: 15, win_rate: 0.8 },
};
const charlie: AgentDiscoveryRow = {
    agent: 'CHARLIE_ADDR',
    weight: 200,
    reputation: null,
};

describe('sortAndFilterAgents', () => {
    it('ranks by score DESC, then completed DESC, then weight DESC', () => {
        const ranked = sortAndFilterAgents([bob, charlie, alice], '');
        assert.equal(ranked[0].agent, 'ALICE_ADDR');
        assert.equal(ranked[1].agent, 'BOB_ADDR');
        assert.equal(ranked[2].agent, 'CHARLIE_ADDR');
    });

    it('null reputation agents rank last', () => {
        const ranked = sortAndFilterAgents([charlie, alice], '');
        assert.equal(ranked[ranked.length - 1].agent, 'CHARLIE_ADDR');
    });

    it('query filters case-insensitive', () => {
        const ranked = sortAndFilterAgents([alice, bob, charlie], 'alice');
        assert.equal(ranked.length, 1);
        assert.equal(ranked[0].agent, 'ALICE_ADDR');
    });
});
