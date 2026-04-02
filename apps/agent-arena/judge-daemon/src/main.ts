import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createKeyPairSignerFromBytes } from '@solana/kit';
import {
    GradienceSDK,
    KeypairAdapter,
} from '../../clients/typescript/src/index.js';
import { AbsurdWorkflowEngine } from './engine.js';
import { JudgeDaemon } from './daemon.js';
import {
    DspyHttpEvaluator,
    EnvManualReviewProvider,
    PollingManualEvaluator,
} from './evaluators.js';
import { createIndexerPollingFetcher, loadMockEvents } from './polling.js';
import { RefResolver } from './refs.js';
import {
    AsyncStreamEventSource,
    MockEventSource,
    PollingEventSource,
    type EventSource,
} from './sources.js';
import {
    InMemoryWorkflowStore,
    PostgresWorkflowStore,
    type WorkflowStore,
} from './store.js';
import type { EventEnvelope } from './types.js';
import {
    JudgeWorkflowRunner,
    SdkJudgeChainClient,
    type JudgeMode,
} from './workflow.js';
import { buildInteropPublisherFromEnv } from './interop.js';
import { WasmTestCasesEvaluator } from './test-cases-evaluator.js';

export interface JudgeDaemonRuntime {
    daemon: JudgeDaemon;
    stop: () => Promise<void>;
}

export async function startJudgeDaemon(env: NodeJS.ProcessEnv = process.env): Promise<JudgeDaemonRuntime> {
    const store = createWorkflowStore(env);
    const engine = new AbsurdWorkflowEngine(store);
    const runner = await createWorkflowRunner(env, engine);
    if (runner) {
        engine.setOnWorkflowQueued((workflow) => runner.process(workflow));
    }
    const { tritonSource, heliusSource, pollingSource } = await createSources(env);

    const daemon = new JudgeDaemon(engine, {
        tritonSource,
        heliusSource,
        pollingSource,
    });
    await daemon.start();

    return {
        daemon,
        stop: async () => daemon.stop(),
    };
}

function createWorkflowStore(env: NodeJS.ProcessEnv): WorkflowStore {
    if (env.DATABASE_URL) {
        return new PostgresWorkflowStore({ databaseUrl: env.DATABASE_URL });
    }
    return new InMemoryWorkflowStore();
}

async function createWorkflowRunner(
    env: NodeJS.ProcessEnv,
    engine: AbsurdWorkflowEngine,
): Promise<JudgeWorkflowRunner | null> {
    const keypairPath = env.JUDGE_DAEMON_JUDGE_KEYPAIR;
    if (!keypairPath) {
        return null;
    }
    const rpcEndpoint = env.GRADIENCE_RPC_ENDPOINT ?? env.RPC_URL ?? 'http://127.0.0.1:8899';
    const sdk = new GradienceSDK({
        indexerEndpoint: env.JUDGE_DAEMON_INDEXER_ENDPOINT,
        rpcEndpoint,
    });
    const signer = await loadKeypairSigner(keypairPath);
    const wallet = new KeypairAdapter({ signer, rpcEndpoint });
    const chainClient = new SdkJudgeChainClient(sdk, wallet);
    const refResolver = new RefResolver({
        arweaveGateway: env.JUDGE_DAEMON_ARWEAVE_GATEWAY,
        ipfsGateway: env.JUDGE_DAEMON_IPFS_GATEWAY,
        cidGateway: env.JUDGE_DAEMON_CID_GATEWAY,
        reasonPublisherEndpoint: env.JUDGE_DAEMON_REASON_PUBLISHER,
    });
    const mode = parseMode(env.JUDGE_DAEMON_EVALUATOR_MODE);
    const typeAEvaluator = new PollingManualEvaluator({
        provider: new EnvManualReviewProvider(env),
        pollIntervalMs: toPositiveNumber(env.JUDGE_DAEMON_MANUAL_POLL_MS, 1_000),
        timeoutMs: toPositiveNumber(env.JUDGE_DAEMON_MANUAL_TIMEOUT_MS, 300_000),
    });
    const typeBEvaluator = new DspyHttpEvaluator({
        endpoint: env.JUDGE_DAEMON_DSPY_ENDPOINT ?? 'http://127.0.0.1:8788',
        timeoutMs: toPositiveNumber(env.JUDGE_DAEMON_DSPY_TIMEOUT_MS, 20_000),
        authToken: env.JUDGE_DAEMON_DSPY_AUTH_TOKEN,
    });
    const typeCEvaluator = new WasmTestCasesEvaluator(refResolver, {
        timeoutMs: toPositiveNumber(env.JUDGE_DAEMON_WASM_TIMEOUT_MS, 2_000),
    });
    const retryPolicy = {
        maxAttempts: toPositiveNumber(env.JUDGE_DAEMON_RETRY_MAX_ATTEMPTS, 5),
        baseDelayMs: toPositiveNumber(env.JUDGE_DAEMON_RETRY_BASE_MS, 500),
    };
    const interopPublisher = buildInteropPublisherFromEnv(env, {
        retryPolicy,
        logger: console,
    });
    if (interopPublisher?.flushOutbox) {
        try {
            const drained = await interopPublisher.flushOutbox();
            if (drained.processed > 0 || drained.failed > 0) {
                console.info(
                    `[judge-daemon] interop outbox replay processed=${drained.processed} failed=${drained.failed} remaining=${drained.remaining}`,
                );
            }
        } catch (error) {
            console.error(
                `[judge-daemon] failed to replay interop outbox: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
    return new JudgeWorkflowRunner(engine, {
        mode,
        chainClient,
        refResolver,
        typeAEvaluator,
        typeBEvaluator,
        typeCEvaluator,
        minConfidence: toConfidence(env.JUDGE_DAEMON_MIN_CONFIDENCE, 0.7),
        retryPolicy,
        interopPublisher,
    });
}

async function createSources(env: NodeJS.ProcessEnv): Promise<{
    tritonSource: EventSource;
    heliusSource: EventSource;
    pollingSource: EventSource;
}> {
    const indexerEndpoint = env.JUDGE_DAEMON_INDEXER_ENDPOINT ?? 'http://127.0.0.1:3001';
    const pollIntervalMs = Number(env.JUDGE_DAEMON_POLL_INTERVAL_MS ?? '5000');

    if (isTruthy(env.MOCK_EVENT)) {
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        const mockFile =
            env.MOCK_EVENT_FILE ??
            path.resolve(moduleDir, '../../indexer/mock/webhook.json');
        const events = await loadMockEvents(mockFile);
        return {
            tritonSource: new MockEventSource('triton', { events }),
            heliusSource: new MockEventSource('helius', { events: [], throwOnStart: true }),
            pollingSource: new PollingEventSource({
                pollIntervalMs,
                pollEvents: createIndexerPollingFetcher(indexerEndpoint),
            }),
        };
    }

    return {
        tritonSource: new AsyncStreamEventSource({
            name: 'triton',
            streamFactory: () => missingStream("Triton Dragon's Mouth stream factory is not configured"),
        }),
        heliusSource: new AsyncStreamEventSource({
            name: 'helius',
            streamFactory: () => missingStream('Helius LaserStream stream factory is not configured'),
        }),
        pollingSource: new PollingEventSource({
            pollIntervalMs,
            pollEvents: createIndexerPollingFetcher(indexerEndpoint),
        }),
    };
}

function missingStream(message: string): AsyncIterable<EventEnvelope> {
    return {
        [Symbol.asyncIterator]() {
            throw new Error(message);
        },
    };
}

function isTruthy(value: string | undefined): boolean {
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

async function loadKeypairSigner(keypairPath: string) {
    const raw = await readFile(keypairPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (
        !Array.isArray(parsed) ||
        parsed.length !== 64 ||
        parsed.some((item) => !isByte(item))
    ) {
        throw new Error(
            `Invalid keypair file ${keypairPath}; expected 64-byte array`,
        );
    }
    return createKeyPairSignerFromBytes(Uint8Array.from(parsed as number[]));
}

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function toPositiveNumber(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

function toConfidence(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        return fallback;
    }
    return parsed;
}

function parseMode(value: string | undefined): JudgeMode {
    if (value === 'type_a' || value === 'type_b' || value === 'type_c1' || value === 'auto') {
        return value;
    }
    return 'auto';
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    void startJudgeDaemon(process.env).then((runtime) => {
        process.on('SIGINT', () => {
            void runtime.stop().finally(() => process.exit(0));
        });
        process.on('SIGTERM', () => {
            void runtime.stop().finally(() => process.exit(0));
        });
    });
}
