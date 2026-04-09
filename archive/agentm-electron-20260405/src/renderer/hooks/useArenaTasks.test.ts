import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeCanApply, computeCanSubmit } from './useArenaTasks.ts';
import type { ArenaTaskSummary } from '../../shared/types.ts';

const OPEN_TASK: ArenaTaskSummary = {
    taskId: 1,
    poster: 'poster-a',
    judge: 'judge-a',
    reward: 1000,
    state: 'open',
    category: 0,
    deadline: '123',
    submissionCount: 0,
    winner: null,
};

describe('useArenaTasks capability helpers', () => {
    it('computeCanApply requires auth, open state, and non-poster', () => {
        assert.equal(computeCanApply({ authenticatedAgent: null, task: OPEN_TASK, flowStatus: null }), false);
        assert.equal(computeCanApply({ authenticatedAgent: 'poster-a', task: OPEN_TASK, flowStatus: null }), false);
        assert.equal(
            computeCanApply({
                authenticatedAgent: 'agent-a',
                task: { ...OPEN_TASK, state: 'completed' },
                flowStatus: null,
            }),
            false,
        );
        assert.equal(computeCanApply({ authenticatedAgent: 'agent-a', task: OPEN_TASK, flowStatus: null }), true);
        assert.equal(computeCanApply({ authenticatedAgent: 'agent-a', task: OPEN_TASK, flowStatus: 'applied' }), false);
    });

    it('computeCanSubmit requires applied/submitted flow and non-poster', () => {
        assert.equal(computeCanSubmit({ authenticatedAgent: null, task: OPEN_TASK, flowStatus: 'applied' }), false);
        assert.equal(
            computeCanSubmit({ authenticatedAgent: 'poster-a', task: OPEN_TASK, flowStatus: 'applied' }),
            false,
        );
        assert.equal(computeCanSubmit({ authenticatedAgent: 'agent-a', task: OPEN_TASK, flowStatus: null }), false);
        assert.equal(computeCanSubmit({ authenticatedAgent: 'agent-a', task: OPEN_TASK, flowStatus: 'applied' }), true);
        assert.equal(
            computeCanSubmit({ authenticatedAgent: 'agent-a', task: OPEN_TASK, flowStatus: 'submitted' }),
            true,
        );
    });
});
