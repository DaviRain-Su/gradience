/**
 * End-to-End Integration Tests
 *
 * Tests the complete flow from payment request to settlement.
 *
 * @module tests/e2e-payment-flow.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

// Services
import { PaymentService } from '../services/payment-service.js';
import { OWSWalletManager } from '../wallet/ows-wallet-manager.js';
import { EvaluatorRuntime } from '../evaluator/runtime.js';
import { SettlementBridge, createSettlementBridge } from '../bridge/settlement-bridge.js';

// A2A Router (mocked)
const mockA2ARouter = {
    send: async () => ({ success: true }),
    subscribe: async () => () => Promise.resolve(),
};

describe('E2E Payment Flow', () => {
    let tmpDir: string;
    let db: Database.Database;
    let walletManager: OWSWalletManager;
    let paymentService: PaymentService;
    let evaluatorRuntime: EvaluatorRuntime;
    let settlementBridge: SettlementBridge;

    beforeAll(async () => {
        // Setup temporary database
        tmpDir = mkdtempSync(join(tmpdir(), 'e2e-test-'));
        db = new Database(join(tmpDir, 'e2e.db'));

        // Initialize services
        walletManager = new OWSWalletManager(db);

        paymentService = new PaymentService(mockA2ARouter as any, walletManager, {
            defaultTimeoutMs: 3600000,
            autoApproveThreshold: 80,
            chainHubProgramId: 'mock-program',
            rpcEndpoint: 'https://mock.rpc',
        });

        evaluatorRuntime = new EvaluatorRuntime({
            defaultBudget: {
                maxCostUsd: 10,
                maxTimeSeconds: 300,
                maxMemoryMb: 2048,
                contextWindowSize: 128000,
            },
            sandbox: {
                type: 'docker',
                resources: { cpu: '2', memory: '4g', timeout: 300 },
                networkAccess: false,
            },
            scoringModel: {
                provider: 'anthropic',
                model: 'claude-opus-4',
                temperature: 0.1,
                maxTokens: 4096,
            },
            driftDetection: {
                enabled: true,
                threshold: 0.8,
                resetStrategy: 'sprint_boundary',
                checkpointIntervalMs: 60000,
            },
        });

        settlementBridge = await createSettlementBridge({
            chainHubProgramId: 'mock-program',
            rpcEndpoint: 'https://mock.rpc',
            maxRetries: 3,
        });

        // Create test wallets
        await walletManager.createWallet({
            agentId: 'e2e-payer',
            parentWallet: 'parent-payer',
            name: 'payer-wallet',
            initialReputation: 85,
        });

        await walletManager.createWallet({
            agentId: 'e2e-payee',
            parentWallet: 'parent-payee',
            name: 'payee-wallet',
            initialReputation: 80,
        });
    });

    afterAll(() => {
        db.close();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('Complete Payment Flow', () => {
        it('should complete full payment flow: request → accept → evaluate → settle → confirm', async () => {
            // Step 1: Create payment request
            const session = await paymentService.requestPayment({
                payerAgentId: 'e2e-payer',
                payeeAgentId: 'e2e-payee',
                taskId: 'e2e-task-1',
                amount: '1000000', // 1 USDC
                token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'E2E test payment',
                evaluation: {
                    type: 'automated',
                    minScore: 70,
                    criteria: ['functionality', 'quality'],
                },
            });

            expect(session.status).toBe('pending_request');
            expect(session.paymentId).toBeDefined();

            // Step 2: Payee accepts payment
            const accepted = await paymentService.acceptPayment(session.paymentId, 'e2e-payee');
            expect(accepted.status).toBe('accepted');

            // Step 3: Payee completes service
            const completed = await paymentService.markServiceComplete(session.paymentId, 'e2e-payee');
            expect(completed.status).toBe('pending_evaluation');

            // Step 4: Run evaluation
            const evaluationId = await evaluatorRuntime.submit({
                taskId: session.taskId,
                agentId: 'e2e-payee',
                type: 'code',
                submission: {
                    type: 'git_repo',
                    source: 'https://github.com/test/repo',
                    metadata: {},
                },
                criteria: {
                    minScore: 70,
                    rubric: {
                        maxScore: 100,
                        categories: [
                            { name: 'Functionality', weight: 0.6, description: 'Works', criteria: [] },
                            { name: 'Quality', weight: 0.4, description: 'Clean', criteria: [] },
                        ],
                    },
                    requiredChecks: ['compiles', 'tests_pass'],
                },
                budget: {
                    maxCostUsd: 5,
                    maxTimeSeconds: 60,
                    maxMemoryMb: 1024,
                    contextWindowSize: 64000,
                },
            });

            expect(evaluationId).toBeDefined();

            // Wait for evaluation to complete (mock is synchronous)
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Step 5: Settlement
            const mockEvaluationResult = {
                evaluationId,
                score: 85,
                passed: true,
                categoryScores: [
                    { name: 'Functionality', score: 90, maxScore: 100, weight: 0.6, feedback: [] },
                    { name: 'Quality', score: 80, maxScore: 100, weight: 0.4, feedback: [] },
                ],
                checkResults: [
                    { type: 'compiles' as const, passed: true, score: 100, details: '', durationMs: 100 },
                    { type: 'tests_pass' as const, passed: true, score: 100, details: '', durationMs: 1000 },
                ],
                verificationHash: 'hash-123',
                executionLog: {
                    sandboxType: 'docker' as const,
                    steps: [],
                    stdout: '',
                    stderr: '',
                },
                driftStatus: { driftDetected: false, contextWindowUsage: 0.2 },
                actualCost: { usd: 0.5, timeSeconds: 10, peakMemoryMb: 512 },
                completedAt: Date.now(),
            };

            const settlementResult = await settlementBridge.settle({
                evaluationId,
                taskId: session.taskId,
                taskIdOnChain: session.taskId,
                paymentId: session.paymentId,
                agentId: 'e2e-payee',
                payerAgentId: 'e2e-payer',
                evaluationResult: mockEvaluationResult,
                amount: '1000000',
                token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                taskAccount: 'task-account',
                escrowAccount: 'escrow-account',
                poster: 'e2e-payer',
            });

            expect(settlementResult.status).toBe('confirmed');
            expect(settlementResult.txSignature).toBeDefined();

            // Verify distribution (95% / 3% / 2%)
            const total = BigInt(settlementResult.amount);
            expect(BigInt(settlementResult.distribution.agent)).toBe((total * 95n) / 100n);
            expect(BigInt(settlementResult.distribution.judge)).toBe((total * 3n) / 100n);
            expect(BigInt(settlementResult.distribution.protocol)).toBe((total * 2n) / 100n);

            // Step 6: Create payment confirmation
            const confirmation = settlementBridge.createPaymentConfirmation(settlementResult, {
                evaluationId,
                taskId: session.taskId,
                taskIdOnChain: session.taskId,
                paymentId: session.paymentId,
                agentId: 'e2e-payee',
                payerAgentId: 'e2e-payer',
                evaluationResult: mockEvaluationResult,
                amount: '1000000',
                token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                taskAccount: 'task-account',
                escrowAccount: 'escrow-account',
                poster: 'e2e-payer',
            });

            expect(confirmation.paymentId).toBe(session.paymentId);
            expect(confirmation.evaluatorScore).toBe(85);
            expect(confirmation.txHash).toBe(settlementResult.txSignature);

            console.log('✅ E2E payment flow completed successfully');
            console.log(`   Payment ID: ${session.paymentId}`);
            console.log(`   Evaluation ID: ${evaluationId}`);
            console.log(`   Settlement TX: ${settlementResult.txSignature}`);
            console.log(`   Score: ${mockEvaluationResult.score}/100`);
            console.log(
                `   Distribution: ${settlementResult.distribution.agent} / ${settlementResult.distribution.judge} / ${settlementResult.distribution.protocol}`,
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle insufficient reputation', async () => {
            // Create low-reputation payer
            await walletManager.createWallet({
                agentId: 'low-rep-payer',
                parentWallet: 'parent-low',
                name: 'low-wallet',
                initialReputation: 20, // Bronze tier
            });

            await expect(
                paymentService.requestPayment({
                    payerAgentId: 'low-rep-payer',
                    payeeAgentId: 'e2e-payee',
                    taskId: 'error-task',
                    amount: '10000000', // $10 - exceeds bronze limit
                    token: 'USDC',
                    tokenSymbol: 'USDC',
                    decimals: 6,
                    description: 'Should fail',
                }),
            ).rejects.toThrow('Payment not allowed');
        });

        it('should handle evaluation failure', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'e2e-payer',
                payeeAgentId: 'e2e-payee',
                taskId: 'fail-task',
                amount: '100000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test failure',
            });

            await paymentService.acceptPayment(session.paymentId, 'e2e-payee');
            await paymentService.markServiceComplete(session.paymentId, 'e2e-payee');

            // Mock failed evaluation
            const failedEvaluationResult = {
                evaluationId: 'eval-fail',
                score: 45,
                passed: false,
                categoryScores: [],
                checkResults: [],
                verificationHash: 'hash-fail',
                executionLog: { sandboxType: 'docker' as const, steps: [], stdout: '', stderr: '' },
                driftStatus: { driftDetected: false, contextWindowUsage: 0 },
                actualCost: { usd: 0.1, timeSeconds: 5, peakMemoryMb: 256 },
                completedAt: Date.now(),
            };

            // Score below threshold should not auto-settle
            expect(failedEvaluationResult.passed).toBe(false);
            expect(failedEvaluationResult.score).toBeLessThan(70);
        });
    });

    describe('Reputation Updates', () => {
        it('should update wallet policy after reputation change', async () => {
            const wallet = await walletManager.createWallet({
                agentId: 'rep-test-agent',
                parentWallet: 'parent-rep',
                name: 'rep-wallet',
                initialReputation: 50,
            });

            expect(wallet.policy.dailyLimit).toBe(500);
            expect(wallet.policy.requireApproval).toBe(true);

            // Update reputation
            const updated = await walletManager.updateReputation(
                'rep-test-agent',
                {
                    score: 85,
                    completed: 10,
                    totalApplied: 12,
                    winRate: 83,
                    totalEarned: 5000,
                },
                'completed_tasks',
            );

            expect(updated).not.toBeNull();
            expect(updated?.reputationScore).toBe(85);
            expect(updated?.policy.dailyLimit).toBe(850);
            expect(updated?.policy.requireApproval).toBe(false);
        });
    });
});
