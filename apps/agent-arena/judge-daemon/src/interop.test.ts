import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { address } from '@solana/kit';

import {
    HttpJsonSink,
    InteropPipeline,
    type OnChainAttestationWallet,
    SasOnChainAttestationSink,
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

    assert.equal(identitySink.calls, 3);
    assert.equal(feedbackSinkA.calls, 3);
    assert.equal(feedbackSinkB.calls, 3);
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

    assert.equal(feedbackSink.calls, 3);
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

    const signal = makeSignal();
    signal.poster = signal.winner;
    signal.judge = signal.winner;
    await pipeline.onTaskJudged(signal);
    assert.equal(attempts, 4);
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
        assert.equal(bodies.length, 3);
        const byRole = new Map(
            (bodies as Array<{ gradience?: { feedbackRole?: string } }>).map(item => [
                item.gradience?.feedbackRole ?? 'unknown',
                item,
            ]),
        );
        assert.ok(byRole.has('winner'));
        assert.ok(byRole.has('poster'));
        assert.ok(byRole.has('judge'));
        const payload = bodies[0] as {
            agentPubkey: string;
            tag1: string;
            value: number;
            feedbackURI: string;
            gradience: { taskId: number; feedbackRole: string };
        };
        assert.equal(payload.tag1, 'taskScore');
        assert.equal(payload.feedbackURI, 'cid://reason');
        assert.equal(payload.gradience.taskId, 12);
        const winnerPayload = byRole.get('winner') as {
            agentPubkey: string;
            value: number;
            gradience: { feedbackRole: string };
        };
        assert.equal(winnerPayload.agentPubkey, 'winner-agent');
        assert.equal(winnerPayload.value, 90);
        assert.equal(winnerPayload.gradience.feedbackRole, 'winner');
        const judgePayload = byRole.get('judge') as {
            agentPubkey: string;
            gradience: { feedbackRole: string };
        };
        assert.equal(judgePayload.agentPubkey, 'judge-agent');
        assert.equal(judgePayload.gradience.feedbackRole, 'judge');
        const posterPayload = byRole.get('poster') as {
            agentPubkey: string;
            gradience: { feedbackRole: string };
        };
        assert.equal(posterPayload.agentPubkey, 'poster-agent');
        assert.equal(posterPayload.gradience.feedbackRole, 'poster');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('buildInteropPublisherFromEnv maps 8004 identity payload shape', async () => {
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
            JUDGE_DAEMON_ERC8004_IDENTITY_ENDPOINT: 'https://example.com/identity',
        });
        assert.ok(publisher);
        await publisher.onTaskJudged(makeSignal(78));
        assert.equal(bodies.length, 3);
        const identities = new Set((bodies as Array<{ agentPubkey?: string }>).map(item => item.agentPubkey ?? ''));
        assert.ok(identities.has('winner-agent'));
        assert.ok(identities.has('poster-agent'));
        assert.ok(identities.has('judge-agent'));
        const payload = bodies[0] as {
            type: string;
            registrations: Array<{ agentId: string; agentRegistry: string }>;
        };
        assert.equal(payload.type, 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
        assert.equal(payload.registrations[0]?.agentRegistry, 'solana:101:metaplex');
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
        assert.equal(bodies.length, 3);
        const recipients = new Set(
            (bodies as Array<{ payload?: { agentPubkey?: string } }>).map(item => item.payload?.agentPubkey ?? ''),
        );
        assert.ok(recipients.has('winner-agent'));
        assert.ok(recipients.has('poster-agent'));
        assert.ok(recipients.has('judge-agent'));
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

test('feedback sinks include loser role when participants contain non-winner agents', async () => {
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
        await publisher.onTaskJudged({
            ...makeSignal(76),
            participants: ['winner-agent', 'loser-1', 'loser-2'],
        });
        const loserPayloads = (bodies as Array<{ gradience?: { feedbackRole?: string } }>).filter(
            item => item.gradience?.feedbackRole === 'loser',
        );
        assert.equal(loserPayloads.length, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('SasOnChainAttestationSink creates attestation instruction when not existing', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gradience-sas-module-'));
    const moduleFile = path.join(tempDir, 'sas-module.mjs');
    await writeFile(
        moduleFile,
        `
        export async function fetchSchema() { return { data: { mock: true } }; }
        export async function fetchMaybeAttestation() { return { exists: false }; }
        export function serializeAttestationData() { return new Uint8Array([1, 2, 3]); }
        export async function deriveAttestationPda() { return ['11111111111111111111111111111111', 255]; }
        export function getCreateAttestationInstruction(input) { return { __mockInstruction: true, input }; }
        `,
        'utf8',
    );

    const sentBatches: unknown[][] = [];
    const wallet: OnChainAttestationWallet = {
        signer: { address: '11111111111111111111111111111111' },
        async signAndSendTransaction(instructions: readonly unknown[]) {
            sentBatches.push([...instructions]);
            return 'sig-onchain';
        },
    };

    const sink = new SasOnChainAttestationSink({
        wallet,
        rpcEndpoint: 'http://127.0.0.1:8899',
        credentialPda: address('11111111111111111111111111111111'),
        schemaPda: address('11111111111111111111111111111111'),
        moduleName: pathToFileURL(moduleFile).href,
    });

    await sink.publish({
        ...makeSignal(90),
        winner: '11111111111111111111111111111111',
    });
    assert.equal(sentBatches.length, 1);
});

test('SasOnChainAttestationSink skips when attestation already exists (idempotent)', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gradience-sas-module-'));
    const moduleFile = path.join(tempDir, 'sas-module-existing.mjs');
    await writeFile(
        moduleFile,
        `
        export async function fetchSchema() { return { data: { mock: true } }; }
        export async function fetchMaybeAttestation() { return { exists: true }; }
        export function serializeAttestationData() { return new Uint8Array([1, 2, 3]); }
        export async function deriveAttestationPda() { return ['11111111111111111111111111111111', 255]; }
        export function getCreateAttestationInstruction(input) { return { __mockInstruction: true, input }; }
        `,
        'utf8',
    );

    let sent = 0;
    const wallet: OnChainAttestationWallet = {
        signer: { address: '11111111111111111111111111111111' },
        async signAndSendTransaction() {
            sent += 1;
            return 'sig-onchain';
        },
    };

    const sink = new SasOnChainAttestationSink({
        wallet,
        rpcEndpoint: 'http://127.0.0.1:8899',
        credentialPda: address('11111111111111111111111111111111'),
        schemaPda: address('11111111111111111111111111111111'),
        moduleName: pathToFileURL(moduleFile).href,
        idempotent: true,
    });

    await sink.publish({
        ...makeSignal(90),
        winner: '11111111111111111111111111111111',
    });
    assert.equal(sent, 0);
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
        feedbackPublishedCount: number;
        feedbackRecipients: unknown[];
    };
    assert.equal(summary.type, 'interop_sync');
    assert.equal(summary.erc8004FeedbackPublished, true);
    assert.equal(summary.feedbackPublishedCount, 3);
    assert.equal(summary.feedbackRecipients.length, 3);
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
