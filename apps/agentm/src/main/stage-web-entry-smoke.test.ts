import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runWebEntrySmoke } from './stage-web-entry-smoke.ts';

describe('Web entry smoke script', () => {
    it('runs pair->bridge->text->voice flow and returns step outputs', async () => {
        const result = await runWebEntrySmoke();
        assert.ok(result.apiBaseUrl.startsWith('http://127.0.0.1:'));
        assert.ok(result.steps.length >= 5);
        assert.ok(result.steps.some((step) => step.name === 'Voice relay'));
        assert.ok(result.steps.every((step) => step.expected.length > 0));
        assert.ok(result.steps.every((step) => step.actual.length > 0));
    });
});
