import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runStageADemo } from './stage-a-demo.ts';

describe('Stage A demo script', () => {
    it('executes closed-loop flow and returns command/expectation outputs', async () => {
        const result = await runStageADemo({
            AGENT_IM_DEMO_REQUIRE_INDEXER: '0',
            AGENT_IM_DEMO_AGENT: 'StageADemoTestAgent111111111111111111111111111',
        });

        assert.ok(result.apiBaseUrl.startsWith('http://127.0.0.1:'));
        assert.ok(result.steps.length >= 6);
        assert.equal(result.steps[0]?.name, 'Login');
        assert.ok(result.steps.some((step) => step.name === 'Interop status'));
        assert.ok(result.steps.every((step) => step.command.length > 0));
        assert.ok(result.steps.every((step) => step.expected.length > 0));
        assert.ok(result.steps.every((step) => step.actual.length > 0));
    });
});
