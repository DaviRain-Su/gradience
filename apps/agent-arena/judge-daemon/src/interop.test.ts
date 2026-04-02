import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
    HttpJsonSink,
    InteropPipeline,
    buildInteropPublisherFromEnv,
    type InteropSink,
    type ReputationInteropSignal,
} from './interop.js';

function makeSignal(score = 82): ReputationInteropSignal {
    return {
        taskId: 12,
        category: 1,
        winner: 'winner-agent',
        poster: 'poster-agent',
        judge: 'judge-agent',
        score,
        reward: 1_000_000,
        reasonRef: 'cid://reason',
        chainTx: 'sig-abc',
        judgedAt: 1_710_000_000,
        judgeMode: 'designated',
    };
}

class RecordingSink implements InteropSink {
    calls = 0;
    payloads: unknown[] = [];

    async publish(payload: unknown): Promise<void> {
        this.calls += 1;
        this.payloads.push(payload);
    }
}

test('buildInteropPublisherFromEnv returns null without endpoints', () => {
    const publisher = buildInteropPublisherFromEnv({});
    assert.equal(publisher, null);
});

test('InteropPipeline publishes to identity + feedback + attestation on passing score', async () => {
    const identitySink = new RecordingSink();
    const feedbackSinkA = new RecordingSink();
    const feedbackSinkB = new RecordingSink();
    const attestationSink = new RecordingSink();
    const pipeline = new InteropPipeline({
        identitySink,
        feedbackSinks: [
            { name: 'feedback_a', sink: feedbackSinkA },
            { name: 'feedback_b', sink: feedbackSinkB },
        ],
        attestationSink,
        retryPolicy: { maxAttempts: 1, baseDelayMs: 1 },
        minScoreForAttestation: 60,
        logger: { warn: () => {}, error: () => {} },
    });

    await pipeline.onTaskJudged(makeSignal(88));

    assert.equal(identitySink.calls, 1);
    assert.equal(feedbackSinkA.calls, 1);
    assert.equal(feedbackSinkB.calls, 1);
    assert.equal(attestationSink.calls, 1);
});

test('InteropPipeline skips attestation sink on low score', async () => {
    const feedbackSink = new RecordingSink();
    const attestationSink = new RecordingSink();
    const pipeline = new InteropPipeline({
        feedbackSinks: [{ name: 'feedback', sink: feedbackSink }],
        attestationSink,
        retryPolicy: { maxAttempts: 1, baseDelayMs: 1 },
        minScoreForAttestation: 60,
        logger: { warn: () => {}, error: () => {} },
    });

    await pipeline.onTaskJudged(makeSignal(59));

    assert.equal(feedbackSink.calls, 1);
    assert.equal(attestationSink.calls, 0);
});

test('InteropPipeline retries transient sink failures', async () => {
    let attempts = 0;
    const flakySink: InteropSink = {
        async publish(): Promise<void> {
            attempts += 1;
            if (attempts < 2) {
                throw new Error('temporary unavailable');
            }
        },
    };
    const pipeline = new InteropPipeline({
        feedbackSinks: [{ name: 'flaky', sink: flakySink }],
        retryPolicy: { maxAttempts: 2, baseDelayMs: 1 },
        logger: { warn: () => {}, error: () => {} },
    });

    await pipeline.onTaskJudged(makeSignal());
    assert.equal(attempts, 2);
});

test('HttpJsonSink sends json payload with bearer auth', async () => {
    const originalFetch = globalThis.fetch;
    let capturedRequest: RequestInit | null = null;
    let capturedUrl = '';
    globalThis.fetch = async (input, init) => {
        capturedUrl = String(input);
        capturedRequest = init ?? null;
        return new Response('', { status: 200 });
    };

    try {
        const sink = new HttpJsonSink({
            endpoint: 'https://example.com/hook',
            name: 'hook',
            authToken: 'token-1',
            timeoutMs: 50,
        });
        await sink.publish(makeSignal());
        assert.equal(capturedUrl, 'https://example.com/hook');
        assert.ok(capturedRequest);
        const headers = (capturedRequest.headers ?? {}) as Record<string, string>;
        assert.equal(headers.authorization, 'Bearer token-1');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('buildInteropPublisherFromEnv maps 8004 feedback payload shape', async () => {
    const originalFetch = globalThis.fetch;
    const bodies: unknown[] = [];
    globalThis.fetch = async (_input, init) => {
        if (init?.body && typeof init.body === 'string') {
            bodies.push(JSON.parse(init.body));
        }
        return new Response('', { status: 200 });
    };

    try {
        const publisher = buildInteropPublisherFromEnv({
            JUDGE_DAEMON_ERC8004_FEEDBACK_ENDPOINT: 'https://example.com/feedback',
        });
        assert.ok(publisher);
        await publisher.onTaskJudged(makeSignal(90));
        assert.equal(bodies.length, 1);
        const payload = bodies[0] as { tag1: string; value: number; gradience: { taskId: number } };
        assert.equal(payload.tag1, 'taskScore');
        assert.equal(payload.value, 90);
        assert.equal(payload.gradience.taskId, 12);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('buildInteropPublisherFromEnv maps EVM reputation relay payload shape', async () => {
    const originalFetch = globalThis.fetch;
    const bodies: unknown[] = [];
    globalThis.fetch = async (_input, init) => {
        if (init?.body && typeof init.body === 'string') {
            bodies.push(JSON.parse(init.body));
        }
        return new Response('', { status: 200 });
    };

    try {
        const publisher = buildInteropPublisherFromEnv({
            JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT: 'https://example.com/evm-relay',
        });
        assert.ok(publisher);
        await publisher.onTaskJudged(makeSignal(77));
        assert.equal(bodies.length, 1);
        const payload = bodies[0] as {
            event: string;
            payload: { globalScore: number; categoryScores: number[] };
        };
        assert.equal(payload.event, 'submit_reputation');
        assert.equal(payload.payload.globalScore, 77);
        assert.equal(payload.payload.categoryScores[1], 77);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('HttpJsonSink signs payload when signature secret is configured', async () => {
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = async (_input, init) => {
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        return new Response('', { status: 200 });
    };

    try {
        const sink = new HttpJsonSink({
            endpoint: 'https://example.com/signed',
            name: 'signed',
            signatureSecret: 'secret-1',
        });
        await sink.publish(makeSignal());
        assert.ok(capturedHeaders['x-gradience-signature']);
        assert.ok(capturedHeaders['x-gradience-signature-ts']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('InteropPipeline emits status summary when status sink is configured', async () => {
    const statusSink = new RecordingSink();
    const pipeline = new InteropPipeline({
        feedbackSinks: [{ name: 'erc8004_feedback', sink: new RecordingSink() }],
        statusSink,
        retryPolicy: { maxAttempts: 1, baseDelayMs: 1 },
        logger: { warn: () => {}, error: () => {} },
    });

    await pipeline.onTaskJudged(makeSignal(86));
    assert.equal(statusSink.calls, 1);
    const summary = statusSink.payloads[0] as {
        type: string;
        erc8004FeedbackPublished: boolean;
    };
    assert.equal(summary.type, 'interop_sync');
    assert.equal(summary.erc8004FeedbackPublished, true);
});

test('InteropPipeline persists failed publish into outbox and replays later', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gradience-interop-'));
    const outboxFile = path.join(tempDir, 'outbox.ndjson');
    let fail = true;
    const flakySink: InteropSink = {
        async publish(): Promise<void> {
            if (fail) {
                throw new Error('network down');
            }
        },
    };
    const pipeline = new InteropPipeline({
        feedbackSinks: [{ name: 'flaky', sink: flakySink }],
        outboxFilePath: outboxFile,
        retryPolicy: { maxAttempts: 1, baseDelayMs: 1 },
        logger: { warn: () => {}, error: () => {} },
    });

    await assert.rejects(() => pipeline.onTaskJudged(makeSignal()));
    const persisted = await readFile(outboxFile, 'utf8');
    assert.ok(persisted.includes('"taskId":12'));

    fail = false;
    const replayResult = await pipeline.flushOutbox?.();
    assert.ok(replayResult);
    assert.equal(replayResult.processed, 1);
    assert.equal(replayResult.remaining, 0);

    const afterReplay = await readFile(outboxFile, 'utf8');
    assert.equal(afterReplay, '');
});
