/**
 * ArenaAutoJudgeService unit tests
 *
 * Validates the end-to-end auto-judge pipeline:
 * 1. Fetch judgeable tasks from indexer
 * 2. Evaluate submissions using EvaluatorRuntime
 * 3. Select winner and settle via BridgeManager (L1 or PER)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { ArenaAutoJudgeService } from '../../src/services/arena-auto-judge.js';
import type { BridgeManager } from '../../src/bridge/index.js';
import type { EvaluatorRuntime, EvaluationResult } from '../../src/evaluator/runtime.js';

class MockEvaluatorRuntime extends EventEmitter {
    submit = vi.fn().mockResolvedValue('eval-123');
}

const mockBridgeManager = {
    settleWithPER: vi.fn().mockResolvedValue({
        settlementId: 'settle-123',
        txSignature: 'tx-abc',
        status: 'confirmed',
    }),
    settleEvaluation: vi.fn().mockResolvedValue({
        settlementId: 'settle-456',
        txSignature: 'tx-def',
        status: 'confirmed',
    }),
} as unknown as BridgeManager;

describe('ArenaAutoJudgeService', () => {
    let service: ArenaAutoJudgeService;
    let evaluatorRuntime: MockEvaluatorRuntime;
    const indexerUrl = 'https://test-indexer.example.com';

    beforeEach(() => {
        evaluatorRuntime = new MockEvaluatorRuntime();
        service = new ArenaAutoJudgeService(
            mockBridgeManager,
            evaluatorRuntime as unknown as EvaluatorRuntime,
            indexerUrl,
            {
                enabled: true,
                intervalMs: 60000,
                minSubmissions: 1,
                perEnabled: true,
            },
            'JudgePubKey1111111111111111111111111111111',
        );
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        service.stop();
        vi.restoreAllMocks();
    });

    it('should scan indexer and settle winning submission via PER', async () => {
        const mockTask = {
            task_id: 42,
            poster: 'PosterPubKey1111111111111111111111111111111',
            judge: 'JudgePubKey1111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1000000000,
            mint: 'SOL',
            min_stake: 100000000,
            state: 'open',
            category: 1,
            eval_ref: 'Test task eval ref',
            deadline: Math.floor(Date.now() / 1000) - 100,
            judge_deadline: Math.floor(Date.now() / 1000) - 10,
            submission_count: 2,
            winner: null,
            created_at: Math.floor(Date.now() / 1000) - 1000,
            slot: 12345,
        };

        const mockSubmissions = [
            {
                task_id: 42,
                agent: 'AgentA1111111111111111111111111111111111111',
                result_ref: 'https://result-a.example.com',
                trace_ref: 'trace-a',
                runtime_provider: 'openai',
                runtime_model: 'gpt-4',
                runtime_runtime: 'node',
                runtime_version: '20',
                submission_slot: 12346,
                submitted_at: Math.floor(Date.now() / 1000) - 500,
            },
            {
                task_id: 42,
                agent: 'AgentB1111111111111111111111111111111111111',
                result_ref: 'https://result-b.example.com',
                trace_ref: 'trace-b',
                runtime_provider: 'anthropic',
                runtime_model: 'claude',
                runtime_runtime: 'node',
                runtime_version: '20',
                submission_slot: 12347,
                submitted_at: Math.floor(Date.now() / 1000) - 400,
            },
        ];

        vi.mocked(global.fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [mockTask],
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSubmissions,
            } as Response);

        // Simulate evaluator completing with AgentB scoring higher
        evaluatorRuntime.submit.mockResolvedValueOnce('eval-1').mockResolvedValueOnce('eval-2');

        setTimeout(() => {
            evaluatorRuntime.emit('completed', {
                evaluationId: 'eval-1',
                score: 75,
                passed: true,
                categoryScores: [],
                checkResults: [],
                verificationHash: 'hash-1',
                executionLog: { sandboxType: 'vm', steps: [], stdout: '', stderr: '' },
                driftStatus: { driftDetected: false, contextWindowUsage: 0 },
                actualCost: { usd: 0.1, timeSeconds: 1, peakMemoryMb: 100 },
                completedAt: Date.now(),
            } as EvaluationResult);
        }, 10);

        setTimeout(() => {
            evaluatorRuntime.emit('completed', {
                evaluationId: 'eval-2',
                score: 85,
                passed: true,
                categoryScores: [],
                checkResults: [],
                verificationHash: 'hash-2',
                executionLog: { sandboxType: 'vm', steps: [], stdout: '', stderr: '' },
                driftStatus: { driftDetected: false, contextWindowUsage: 0 },
                actualCost: { usd: 0.1, timeSeconds: 1, peakMemoryMb: 100 },
                completedAt: Date.now(),
            } as EvaluationResult);
        }, 20);

        (service as any).running = true;
        (service as any).running = true;
        await (service as any).tick();

        // Wait for async settlement
        await new Promise((r) => setTimeout(r, 50));

        expect(global.fetch).toHaveBeenCalledWith(`${indexerUrl}/api/tasks?status=open&limit=50`);
        expect(global.fetch).toHaveBeenCalledWith(`${indexerUrl}/api/tasks/42/submissions`);
        expect(evaluatorRuntime.submit).toHaveBeenCalledTimes(2);
        expect(mockBridgeManager.settleWithPER).toHaveBeenCalledOnce();

        const settleCall = vi.mocked(mockBridgeManager.settleWithPER).mock.calls[0];
        const evalResult = settleCall[0] as EvaluationResult;
        const params = settleCall[1] as Record<string, unknown>;

        expect(evalResult.score).toBe(85);
        expect(params.agentId).toBe('AgentB1111111111111111111111111111111111111');
        expect(params.taskId).toBe('42');
        expect(params.taskIdOnChain).toBe('42');
    });

    it('should skip tasks with insufficient submissions', async () => {
        service = new ArenaAutoJudgeService(
            mockBridgeManager,
            evaluatorRuntime as unknown as EvaluatorRuntime,
            indexerUrl,
            {
                enabled: true,
                intervalMs: 60000,
                minSubmissions: 3,
                perEnabled: true,
            },
            'JudgePubKey1111111111111111111111111111111',
        );

        const mockTask = {
            task_id: 99,
            poster: 'PosterPubKey1111111111111111111111111111111',
            judge: 'JudgePubKey1111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 1000000000,
            mint: 'SOL',
            min_stake: 100000000,
            state: 'open',
            category: 1,
            eval_ref: 'Test task eval ref',
            deadline: Math.floor(Date.now() / 1000) - 100,
            judge_deadline: Math.floor(Date.now() / 1000) - 10,
            submission_count: 1,
            winner: null,
            created_at: Math.floor(Date.now() / 1000) - 1000,
            slot: 12345,
        };

        vi.mocked(global.fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [mockTask],
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    {
                        task_id: 99,
                        agent: 'AgentA1111111111111111111111111111111111111',
                        result_ref: 'https://result.example.com',
                        trace_ref: 'trace',
                        runtime_provider: 'openai',
                        runtime_model: 'gpt-4',
                        runtime_runtime: 'node',
                        runtime_version: '20',
                        submission_slot: 12346,
                        submitted_at: Math.floor(Date.now() / 1000) - 500,
                    },
                ],
            } as Response);

        (service as any).running = true;
        await (service as any).tick();

        expect(evaluatorRuntime.submit).not.toHaveBeenCalled();
        expect(mockBridgeManager.settleWithPER).not.toHaveBeenCalled();
    });

    it('should fall back to L1 settlement when perEnabled is false', async () => {
        service = new ArenaAutoJudgeService(
            mockBridgeManager,
            evaluatorRuntime as unknown as EvaluatorRuntime,
            indexerUrl,
            {
                enabled: true,
                intervalMs: 60000,
                minSubmissions: 1,
                perEnabled: false,
            },
            'JudgePubKey1111111111111111111111111111111',
        );

        const mockTask = {
            task_id: 7,
            poster: 'PosterPubKey1111111111111111111111111111111',
            judge: 'JudgePubKey1111111111111111111111111111111',
            judge_mode: 'designated',
            reward: 500000000,
            mint: 'SOL',
            min_stake: 50000000,
            state: 'open',
            category: 2,
            eval_ref: 'L1 task',
            deadline: Math.floor(Date.now() / 1000) - 100,
            judge_deadline: Math.floor(Date.now() / 1000) - 10,
            submission_count: 1,
            winner: null,
            created_at: Math.floor(Date.now() / 1000) - 1000,
            slot: 9999,
        };

        vi.mocked(global.fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [mockTask],
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    {
                        task_id: 7,
                        agent: 'AgentC1111111111111111111111111111111111111',
                        result_ref: 'https://result-c.example.com',
                        trace_ref: 'trace-c',
                        runtime_provider: 'openai',
                        runtime_model: 'gpt-4',
                        runtime_runtime: 'node',
                        runtime_version: '20',
                        submission_slot: 10000,
                        submitted_at: Math.floor(Date.now() / 1000) - 500,
                    },
                ],
            } as Response);

        evaluatorRuntime.submit.mockResolvedValueOnce('eval-l1');
        setTimeout(() => {
            evaluatorRuntime.emit('completed', {
                evaluationId: 'eval-l1',
                score: 90,
                passed: true,
                categoryScores: [],
                checkResults: [],
                verificationHash: 'hash-l1',
                executionLog: { sandboxType: 'vm', steps: [], stdout: '', stderr: '' },
                driftStatus: { driftDetected: false, contextWindowUsage: 0 },
                actualCost: { usd: 0.1, timeSeconds: 1, peakMemoryMb: 100 },
                completedAt: Date.now(),
            } as EvaluationResult);
        }, 10);

        (service as any).running = true;
        await (service as any).tick();
        await new Promise((r) => setTimeout(r, 50));

        expect(mockBridgeManager.settleWithPER).not.toHaveBeenCalled();
        expect(mockBridgeManager.settleEvaluation).toHaveBeenCalledOnce();
    });
});
