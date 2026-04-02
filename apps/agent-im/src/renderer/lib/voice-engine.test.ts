import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NoopVoiceEngine, createVoiceEngine } from './voice-engine.ts';

describe('NoopVoiceEngine', () => {
    it('supported is false', () => {
        const engine = new NoopVoiceEngine();
        assert.equal(engine.supported, false);
    });

    it('stopAndTranscribe returns empty string', async () => {
        const engine = new NoopVoiceEngine();
        const result = await engine.stopAndTranscribe();
        assert.equal(result, '');
    });

    it('speak resolves without error', async () => {
        const engine = new NoopVoiceEngine();
        await engine.speak('hello world');
        // No throw = pass
    });
});

describe('createVoiceEngine', () => {
    it('returns NoopVoiceEngine in Node.js (no browser APIs)', () => {
        const engine = createVoiceEngine();
        assert.equal(engine.supported, false);
        assert.equal(engine.isRecording(), false);
    });
});
