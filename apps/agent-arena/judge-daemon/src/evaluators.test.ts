import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    DspyHttpEvaluator,
    PollingManualEvaluator,
    RateLimitError,
    evaluateWithRetry,
    type EvaluationRequest,
    type ManualReviewDecision,
    type ManualReviewProvider,
} from './evaluators.js';

const REQUEST: EvaluationRequest = {
    taskId: 1,
    taskDescription: 'Evaluate output quality',
    criteria: { dimensions: [{ name: 'accuracy', weight: 1 }] },
    result: 'answer',
    trace: 'trace',
    agent: '11111111111111111111111111111111',
};

test('PollingManualEvaluator waits until manual decision becomes available', async () => {
    let calls = 0;
    const provider: ManualReviewProvider = {
        getDecision: async (): Promise<ManualReviewDecision | null> => {
            calls += 1;
            if (calls < 3) {
                return null;
            }
            return {
                score: 88,
                reasoning: 'manual override',
                confidence: 0.98,
                dimensionScores: { accuracy: 88 },
            };
        },
    };

    const evaluator = new PollingManualEvaluator({
        provider,
        pollIntervalMs: 1,
        timeoutMs: 100,
    });
    const result = await evaluator.evaluate(REQUEST);
    assert.equal(result.mode, 'type_a');
    assert.equal(result.score, 88);
    assert.equal(result.reasoning, 'manual override');
    assert.equal(calls, 3);
});

test('DspyHttpEvaluator posts /evaluate payload and parses response', async () => {
    let seenPath = '';
    let seenBody: unknown = null;
    const evaluator = new DspyHttpEvaluator({
        endpoint: 'http://localhost:8788',
        fetcher: async (input, init) => {
            seenPath = String(input);
            seenBody = init?.body ? JSON.parse(String(init.body)) : null;
            return new Response(
                JSON.stringify({
                    score: 82,
                    reasoning: 'solid output',
                    dimension_scores: { clarity: 80 },
                    confidence: 0.91,
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        },
    });
    const result = await evaluator.evaluate(REQUEST);
    assert.equal(seenPath, 'http://localhost:8788/evaluate');
    assert.deepEqual(seenBody, {
        task_desc: REQUEST.taskDescription,
        criteria: REQUEST.criteria,
        result: REQUEST.result,
        trace: REQUEST.trace,
    });
    assert.equal(result.mode, 'type_b');
    assert.equal(result.score, 82);
    assert.equal(result.confidence, 0.91);
    assert.deepEqual(result.dimensionScores, { clarity: 80 });
});

test('DspyHttpEvaluator forwards bearer auth token when configured', async () => {
    let seenAuth: string | null = null;
    const evaluator = new DspyHttpEvaluator({
        endpoint: 'http://localhost:8788',
        authToken: 'secret-token',
        fetcher: async (_input, init) => {
            const headers = new Headers(init?.headers);
            seenAuth = headers.get('authorization');
            return new Response(
                JSON.stringify({
                    score: 80,
                    reasoning: 'ok',
                    dimension_scores: {},
                    confidence: 0.9,
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        },
    });
    const result = await evaluator.evaluate(REQUEST);
    assert.equal(seenAuth, 'Bearer secret-token');
    assert.equal(result.score, 80);
});

test('evaluateWithRetry retries on rate limit with exponential backoff', async () => {
    let attempts = 0;
    const evaluator = {
        evaluate: async () => {
            attempts += 1;
            if (attempts < 3) {
                throw new RateLimitError('rate limited', 429, 1);
            }
            return {
                score: 79,
                reasoning: 'ok',
                dimensionScores: {},
                confidence: 0.8,
                mode: 'type_b' as const,
            };
        },
    };

    const result = await evaluateWithRetry(evaluator, REQUEST, {
        maxAttempts: 5,
        baseDelayMs: 1,
    });
    assert.equal(result.score, 79);
    assert.equal(attempts, 3);
});
