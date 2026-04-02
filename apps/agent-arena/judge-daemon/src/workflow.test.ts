import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AbsurdWorkflowEngine } from './engine.js';
import type { EvaluationRequest, EvaluationResult, ScoreEvaluator } from './evaluators.js';
import { InMemoryWorkflowStore } from './store.js';
import { JudgeWorkflowRunner, type JudgeChainClient } from './workflow.js';
import type { ReputationInteropSignal } from './interop.js';

class StaticEvaluator implements ScoreEvaluator {
    constructor(private readonly result: EvaluationResult) {}

    async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
        void request;
        return this.result;
    }
}

test('Type B high-confidence result submits judge_and_pay directly', async () => {
    const store = new InMemoryWorkflowStore();
    await store.init();
    const workflow = await store.enqueue({
        taskId: 9,
        trigger: 'submission_received',
        slot: 100,
        timestamp: 1_710_000_010,
        agent: '11111111111111111111111111111111',
        dedupeKey: 'submission_received:9:100',
    });

    const engine = new AbsurdWorkflowEngine(store);
    let judged:
        | {
              taskId: number;
              winner: string;
              poster: string;
              score: number;
              reasonRef: string;
          }
        | null = null;
    const chainClient: JudgeChainClient = {
        getTask: async () => ({
            task_id: 9,
            poster: '11111111111111111111111111111111',
            judge: '11111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1,
            mint: '11111111111111111111111111111111',
            min_stake: 1,
            state: 'open',
            category: 1,
            eval_ref: 'cid://eval',
            deadline: 0,
            judge_deadline: 0,
            submission_count: 1,
            winner: null,
            created_at: 0,
            slot: 0,
        }),
        getTaskSubmissions: async () => [
            {
                task_id: 9,
                agent: '11111111111111111111111111111111',
                result_ref: 'cid://result',
                trace_ref: 'cid://trace',
                runtime_provider: 'x',
                runtime_model: 'x',
                runtime_runtime: 'x',
                runtime_version: 'x',
                submission_slot: 100,
                submitted_at: 0,
            },
        ],
        judge: async (request) => {
            judged = {
                taskId: request.taskId,
                winner: request.winner,
                poster: request.poster,
                score: request.score,
                reasonRef: request.reasonRef,
            };
            return 'sig';
        },
    };

    const runner = new JudgeWorkflowRunner(engine, {
        mode: 'type_b',
        minConfidence: 0.7,
        chainClient,
        refResolver: {
            fetchText: async (ref) => {
                if (ref === 'cid://eval') {
                    return JSON.stringify({
                        task_description: 'judge output',
                        min_confidence: 0.7,
                    });
                }
                return `${ref}-content`;
            },
            publishReason: async () => 'cid://reason',
        },
        typeAEvaluator: new StaticEvaluator({
            score: 10,
            reasoning: 'manual',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_a',
        }),
        typeBEvaluator: new StaticEvaluator({
            score: 82,
            reasoning: 'auto',
            dimensionScores: { quality: 82 },
            confidence: 0.91,
            mode: 'type_b',
        }),
        typeCEvaluator: new StaticEvaluator({
            score: 55,
            reasoning: 'c1',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_c1',
        }),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await runner.process(workflow);

    const updated = store.getById(workflow.id);
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
    assert.ok(judged);
    assert.equal(judged.taskId, 9);
    assert.equal(judged.score, 82);
    assert.equal(judged.reasonRef, 'cid://reason');
});

test('Type B low-confidence result falls back to Type A manual evaluator', async () => {
    const store = new InMemoryWorkflowStore();
    await store.init();
    const workflow = await store.enqueue({
        taskId: 7,
        trigger: 'submission_received',
        slot: 70,
        timestamp: 1_710_000_070,
        agent: '11111111111111111111111111111111',
        dedupeKey: 'submission_received:7:70',
    });

    const engine = new AbsurdWorkflowEngine(store);
    let manualCalled = 0;
    let submittedScore = 0;

    const chainClient: JudgeChainClient = {
        getTask: async () => ({
            task_id: 7,
            poster: '11111111111111111111111111111111',
            judge: '11111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1,
            mint: '11111111111111111111111111111111',
            min_stake: 1,
            state: 'open',
            category: 1,
            eval_ref: 'cid://eval',
            deadline: 0,
            judge_deadline: 0,
            submission_count: 1,
            winner: null,
            created_at: 0,
            slot: 0,
        }),
        getTaskSubmissions: async () => [
            {
                task_id: 7,
                agent: '11111111111111111111111111111111',
                result_ref: 'cid://result',
                trace_ref: 'cid://trace',
                runtime_provider: 'x',
                runtime_model: 'x',
                runtime_runtime: 'x',
                runtime_version: 'x',
                submission_slot: 70,
                submitted_at: 0,
            },
        ],
        judge: async (request) => {
            submittedScore = request.score;
            return 'sig';
        },
    };

    const runner = new JudgeWorkflowRunner(engine, {
        mode: 'type_b',
        minConfidence: 0.7,
        chainClient,
        refResolver: {
            fetchText: async (ref) => {
                if (ref === 'cid://eval') {
                    return JSON.stringify({ min_confidence: 0.7 });
                }
                return `${ref}-content`;
            },
            publishReason: async () => 'cid://reason',
        },
        typeAEvaluator: {
            evaluate: async () => {
                manualCalled += 1;
                return {
                    score: 76,
                    reasoning: 'manual approved',
                    dimensionScores: {},
                    confidence: 1,
                    mode: 'type_a',
                };
            },
        },
        typeBEvaluator: new StaticEvaluator({
            score: 79,
            reasoning: 'uncertain',
            dimensionScores: {},
            confidence: 0.4,
            mode: 'type_b',
        }),
        typeCEvaluator: new StaticEvaluator({
            score: 45,
            reasoning: 'c1',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_c1',
        }),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await runner.process(workflow);
    const updated = store.getById(workflow.id);
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
    assert.equal(manualCalled, 1);
    assert.equal(submittedScore, 76);
});

test('Auto mode routes test_cases tasks to Type C-1 evaluator', async () => {
    const store = new InMemoryWorkflowStore();
    await store.init();
    const workflow = await store.enqueue({
        taskId: 11,
        trigger: 'submission_received',
        slot: 111,
        timestamp: 1_710_000_111,
        agent: '11111111111111111111111111111111',
        dedupeKey: 'submission_received:11:111',
    });
    const engine = new AbsurdWorkflowEngine(store);
    let usedTypeC = 0;
    let submittedScore = 0;
    const chainClient: JudgeChainClient = {
        getTask: async () => ({
            task_id: 11,
            poster: '11111111111111111111111111111111',
            judge: '11111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1,
            mint: '11111111111111111111111111111111',
            min_stake: 1,
            state: 'open',
            category: 2,
            eval_ref: 'cid://eval',
            deadline: 0,
            judge_deadline: 0,
            submission_count: 1,
            winner: null,
            created_at: 0,
            slot: 0,
        }),
        getTaskSubmissions: async () => [
            {
                task_id: 11,
                agent: '11111111111111111111111111111111',
                result_ref: 'cid://result',
                trace_ref: 'cid://trace',
                runtime_provider: 'x',
                runtime_model: 'x',
                runtime_runtime: 'x',
                runtime_version: 'x',
                submission_slot: 111,
                submitted_at: 0,
            },
        ],
        judge: async (request) => {
            submittedScore = request.score;
            return 'sig';
        },
    };

    const runner = new JudgeWorkflowRunner(engine, {
        mode: 'auto',
        chainClient,
        refResolver: {
            fetchText: async (ref) => {
                if (ref === 'cid://eval') {
                    return JSON.stringify({
                        type: 'test_cases',
                        test_cases: [{ input: 'a', expected_output: '1', weight: 1 }],
                    });
                }
                if (ref === 'cid://result') {
                    return JSON.stringify({ a: '1' });
                }
                return 'trace';
            },
            publishReason: async () => 'cid://reason',
        },
        typeAEvaluator: new StaticEvaluator({
            score: 0,
            reasoning: 'manual',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_a',
        }),
        typeBEvaluator: new StaticEvaluator({
            score: 0,
            reasoning: 'llm',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_b',
        }),
        typeCEvaluator: {
            evaluate: async () => {
                usedTypeC += 1;
                return {
                    score: 88,
                    reasoning: 'c1',
                    dimensionScores: {},
                    confidence: 1,
                    mode: 'type_c1',
                };
            },
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await runner.process(workflow);
    const updated = store.getById(workflow.id);
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
    assert.equal(usedTypeC, 1);
    assert.equal(submittedScore, 88);
});

test('Workflow processing is single-claim and skips duplicate runners', async () => {
    const store = new InMemoryWorkflowStore();
    await store.init();
    const workflow = await store.enqueue({
        taskId: 15,
        trigger: 'submission_received',
        slot: 150,
        timestamp: 1_710_000_150,
        agent: '11111111111111111111111111111111',
        dedupeKey: 'submission_received:15:150',
    });
    const engine = new AbsurdWorkflowEngine(store);
    let judgeCalls = 0;

    const chainClient: JudgeChainClient = {
        getTask: async () => ({
            task_id: 15,
            poster: '11111111111111111111111111111111',
            judge: '11111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1,
            mint: '11111111111111111111111111111111',
            min_stake: 1,
            state: 'open',
            category: 1,
            eval_ref: 'cid://eval',
            deadline: 0,
            judge_deadline: 0,
            submission_count: 1,
            winner: null,
            created_at: 0,
            slot: 0,
        }),
        getTaskSubmissions: async () => [
            {
                task_id: 15,
                agent: '11111111111111111111111111111111',
                result_ref: 'cid://result',
                trace_ref: 'cid://trace',
                runtime_provider: 'x',
                runtime_model: 'x',
                runtime_runtime: 'x',
                runtime_version: 'x',
                submission_slot: 150,
                submitted_at: 0,
            },
        ],
        judge: async () => {
            judgeCalls += 1;
            return 'sig';
        },
    };

    const runner = new JudgeWorkflowRunner(engine, {
        mode: 'type_b',
        chainClient,
        refResolver: {
            fetchText: async (ref) => {
                if (ref === 'cid://eval') {
                    return JSON.stringify({ min_confidence: 0.7 });
                }
                return `${ref}-content`;
            },
            publishReason: async () => 'cid://reason',
        },
        typeAEvaluator: new StaticEvaluator({
            score: 70,
            reasoning: 'manual',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_a',
        }),
        typeBEvaluator: new StaticEvaluator({
            score: 81,
            reasoning: 'auto',
            dimensionScores: {},
            confidence: 0.9,
            mode: 'type_b',
        }),
        typeCEvaluator: new StaticEvaluator({
            score: 50,
            reasoning: 'c1',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_c1',
        }),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await Promise.all([runner.process(workflow), runner.process(workflow)]);
    const updated = store.getById(workflow.id);
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
    assert.equal(judgeCalls, 1);
});

test('Workflow publishes interoperability signal after successful judgement', async () => {
    const store = new InMemoryWorkflowStore();
    await store.init();
    const workflow = await store.enqueue({
        taskId: 19,
        trigger: 'submission_received',
        slot: 190,
        timestamp: 1_710_000_190,
        agent: '11111111111111111111111111111111',
        dedupeKey: 'submission_received:19:190',
    });
    const engine = new AbsurdWorkflowEngine(store);
    let signal: ReputationInteropSignal | null = null;
    const chainClient: JudgeChainClient = {
        getTask: async () => ({
            task_id: 19,
            poster: '11111111111111111111111111111111',
            judge: '11111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1234,
            mint: '11111111111111111111111111111111',
            min_stake: 1,
            state: 'open',
            category: 3,
            eval_ref: 'cid://eval',
            deadline: 0,
            judge_deadline: 0,
            submission_count: 1,
            winner: null,
            created_at: 0,
            slot: 0,
        }),
        getTaskSubmissions: async () => [
            {
                task_id: 19,
                agent: '11111111111111111111111111111111',
                result_ref: 'cid://result',
                trace_ref: 'cid://trace',
                runtime_provider: 'x',
                runtime_model: 'x',
                runtime_runtime: 'x',
                runtime_version: 'x',
                submission_slot: 190,
                submitted_at: 0,
            },
        ],
        judge: async () => 'sig-interop-1',
    };

    const runner = new JudgeWorkflowRunner(engine, {
        mode: 'type_b',
        chainClient,
        refResolver: {
            fetchText: async (ref) =>
                ref === 'cid://eval'
                    ? JSON.stringify({ min_confidence: 0.7 })
                    : `${ref}-content`,
            publishReason: async () => 'cid://reason',
        },
        typeAEvaluator: new StaticEvaluator({
            score: 70,
            reasoning: 'manual',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_a',
        }),
        typeBEvaluator: new StaticEvaluator({
            score: 91,
            reasoning: 'auto',
            dimensionScores: {},
            confidence: 0.95,
            mode: 'type_b',
        }),
        typeCEvaluator: new StaticEvaluator({
            score: 40,
            reasoning: 'c1',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_c1',
        }),
        interopPublisher: {
            onTaskJudged: async (value) => {
                signal = value;
            },
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await runner.process(workflow);
    const updated = store.getById(workflow.id);
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
    assert.ok(signal);
    assert.equal(signal.taskId, 19);
    assert.equal(signal.chainTx, 'sig-interop-1');
    assert.equal(signal.score, 91);
});

test('Workflow still completes when interop publisher fails', async () => {
    const store = new InMemoryWorkflowStore();
    await store.init();
    const workflow = await store.enqueue({
        taskId: 20,
        trigger: 'submission_received',
        slot: 200,
        timestamp: 1_710_000_200,
        agent: '11111111111111111111111111111111',
        dedupeKey: 'submission_received:20:200',
    });
    const engine = new AbsurdWorkflowEngine(store);

    const chainClient: JudgeChainClient = {
        getTask: async () => ({
            task_id: 20,
            poster: '11111111111111111111111111111111',
            judge: '11111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 100,
            mint: '11111111111111111111111111111111',
            min_stake: 1,
            state: 'open',
            category: 1,
            eval_ref: 'cid://eval',
            deadline: 0,
            judge_deadline: 0,
            submission_count: 1,
            winner: null,
            created_at: 0,
            slot: 0,
        }),
        getTaskSubmissions: async () => [
            {
                task_id: 20,
                agent: '11111111111111111111111111111111',
                result_ref: 'cid://result',
                trace_ref: 'cid://trace',
                runtime_provider: 'x',
                runtime_model: 'x',
                runtime_runtime: 'x',
                runtime_version: 'x',
                submission_slot: 200,
                submitted_at: 0,
            },
        ],
        judge: async () => 'sig-interop-2',
    };

    const runner = new JudgeWorkflowRunner(engine, {
        mode: 'type_b',
        chainClient,
        refResolver: {
            fetchText: async (ref) =>
                ref === 'cid://eval'
                    ? JSON.stringify({ min_confidence: 0.7 })
                    : `${ref}-content`,
            publishReason: async () => 'cid://reason',
        },
        typeAEvaluator: new StaticEvaluator({
            score: 70,
            reasoning: 'manual',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_a',
        }),
        typeBEvaluator: new StaticEvaluator({
            score: 89,
            reasoning: 'auto',
            dimensionScores: {},
            confidence: 0.95,
            mode: 'type_b',
        }),
        typeCEvaluator: new StaticEvaluator({
            score: 30,
            reasoning: 'c1',
            dimensionScores: {},
            confidence: 1,
            mode: 'type_c1',
        }),
        interopPublisher: {
            onTaskJudged: async () => {
                throw new Error('interop down');
            },
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await runner.process(workflow);
    const updated = store.getById(workflow.id);
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
});
