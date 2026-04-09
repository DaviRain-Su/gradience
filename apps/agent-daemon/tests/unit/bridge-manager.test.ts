/**
 * Bridge Manager Tests
 *
 * @module bridge/index.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BridgeManager, createBridgeManager } from '../../src/bridge/index.js';
import type { EvaluationResult } from '../../src/evaluator/runtime.js';

// Mock dependencies
vi.mock('../../src/keys/key-manager.js', () => ({
    FileKeyManager: vi.fn().mockImplementation(() => ({
        getPublicKey: vi.fn().mockReturnValue('mock-pubkey'),
        sign: vi.fn().mockReturnValue(Buffer.from('mock-signature')),
        initialize: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../../src/solana/transaction-manager.js', () => ({
    TransactionManager: vi.fn().mockImplementation(() => ({
        getConnection: vi.fn().mockReturnValue({}),
    })),
}));

describe('BridgeManager', () => {
    let bridgeManager: BridgeManager;
    const mockKeyManager = {
        getPublicKey: vi.fn().mockReturnValue('mock-pubkey'),
        sign: vi.fn().mockReturnValue(Buffer.from('mock-signature')),
        initialize: vi.fn().mockResolvedValue(undefined),
    };
    const mockTransactionManager = {
        getConnection: vi.fn().mockReturnValue({}),
    };

    beforeEach(async () => {
        bridgeManager = createBridgeManager(
            {
                rpcEndpoint: 'https://api.devnet.solana.com',
                chainHubProgramId: 'mock-program-id',
                enabled: true,
                autoSettle: false,
                keyDir: './test-keys',
                retry: {
                    maxAttempts: 2,
                    baseDelayMs: 100,
                    maxDelayMs: 1000,
                },
                confirmation: {
                    commitment: 'confirmed',
                    maxRetries: 3,
                    timeoutMs: 60000,
                },
                distribution: {
                    agentBps: 9500,
                    judgeBps: 300,
                    protocolBps: 200,
                },
            },
            mockKeyManager as any,
            mockTransactionManager as any,
        );
    });

    describe('initialization', () => {
        it('should create bridge manager with default config', async () => {
            const defaultManager = createBridgeManager({}, mockKeyManager as any, mockTransactionManager as any);
            expect(defaultManager).toBeDefined();
            expect(defaultManager.isEnabled()).toBe(true);
        });

        it('should create bridge manager with custom config', async () => {
            const customManager = createBridgeManager(
                {
                    enabled: false,
                    autoSettle: true,
                    chainHubProgramId: 'custom-program',
                },
                mockKeyManager as any,
                mockTransactionManager as any,
            );
            expect(customManager).toBeDefined();
            expect(customManager.isEnabled()).toBe(false);
        });

        it('should check if auto-settle is enabled', async () => {
            const autoSettleManager = createBridgeManager(
                {
                    enabled: true,
                    autoSettle: true,
                },
                mockKeyManager as any,
                mockTransactionManager as any,
            );
            await autoSettleManager.initialize();
            expect(autoSettleManager.isAutoSettleEnabled()).toBe(true);
        });
    });

    describe('distribution calculation', () => {
        it('should calculate correct distribution with default percentages', () => {
            bridgeManager.initialize();
            const totalAmount = BigInt(1000000);
            const distribution = bridgeManager.calculateDistribution(totalAmount);

            // 95% agent, 3% judge, 2% protocol
            expect(distribution.agent).toBe((totalAmount * BigInt(9500)) / BigInt(10000));
            expect(distribution.judge).toBe((totalAmount * BigInt(300)) / BigInt(10000));
            expect(distribution.protocol).toBe((totalAmount * BigInt(200)) / BigInt(10000));
        });

        it('should calculate correct distribution with custom percentages', () => {
            const customManager = createBridgeManager(
                {
                    distribution: {
                        agentBps: 9000,
                        judgeBps: 500,
                        protocolBps: 500,
                    },
                },
                mockKeyManager as any,
                mockTransactionManager as any,
            );
            customManager.initialize();
            const totalAmount = BigInt(1000000);
            const distribution = customManager.calculateDistribution(totalAmount);

            expect(distribution.agent).toBe((totalAmount * BigInt(9000)) / BigInt(10000));
            expect(distribution.judge).toBe((totalAmount * BigInt(500)) / BigInt(10000));
            expect(distribution.protocol).toBe((totalAmount * BigInt(500)) / BigInt(10000));
        });
    });

    describe('evaluator management', () => {
        it('should add and check authorized evaluators', async () => {
            await bridgeManager.initialize();
            const evaluatorAddress = 'evaluator-123';

            expect(bridgeManager.isAuthorizedEvaluator(evaluatorAddress)).toBe(false);
            bridgeManager.addAuthorizedEvaluator(evaluatorAddress);
            expect(bridgeManager.isAuthorizedEvaluator(evaluatorAddress)).toBe(true);
        });

        it('should list authorized evaluators', async () => {
            await bridgeManager.initialize();
            bridgeManager.addAuthorizedEvaluator('evaluator-1');
            bridgeManager.addAuthorizedEvaluator('evaluator-2');

            const evaluators = bridgeManager.listAuthorizedEvaluators();
            expect(evaluators).toContain('evaluator-1');
            expect(evaluators).toContain('evaluator-2');
        });
    });

    describe('settlement operations', () => {
        it('should throw error when not initialized', async () => {
            const uninitializedManager = createBridgeManager(
                { enabled: true },
                mockKeyManager as any,
                mockTransactionManager as any,
            );

            const mockEvaluationResult: EvaluationResult = {
                evaluationId: 'eval-123',
                score: 85,
                passed: true,
                categoryScores: [],
                checkResults: [],
                verificationHash: 'hash',
                executionLog: { sandboxType: 'docker', steps: [], stdout: '', stderr: '' },
                driftStatus: { driftDetected: false, contextWindowUsage: 0 },
                actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
                completedAt: Date.now(),
            };

            await expect(
                uninitializedManager.settleEvaluation(mockEvaluationResult, {
                    taskId: 'task-456',
                    paymentId: 'payment-789',
                    agentId: 'agent-abc',
                    payerAgentId: 'agent-payer',
                    amount: '1000000',
                    token: 'USDC',
                    taskAccount: 'task-account',
                    escrowAccount: 'escrow-account',
                }),
            ).rejects.toThrow('BridgeManager not initialized');
        });

        it('should throw error when bridge is disabled', async () => {
            const disabledManager = createBridgeManager(
                { enabled: false },
                mockKeyManager as any,
                mockTransactionManager as any,
            );
            await disabledManager.initialize();

            const mockEvaluationResult: EvaluationResult = {
                evaluationId: 'eval-123',
                score: 85,
                passed: true,
                categoryScores: [],
                checkResults: [],
                verificationHash: 'hash',
                executionLog: { sandboxType: 'docker', steps: [], stdout: '', stderr: '' },
                driftStatus: { driftDetected: false, contextWindowUsage: 0 },
                actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
                completedAt: Date.now(),
            };

            await expect(
                disabledManager.settleEvaluation(mockEvaluationResult, {
                    taskId: 'task-456',
                    paymentId: 'payment-789',
                    agentId: 'agent-abc',
                    payerAgentId: 'agent-payer',
                    amount: '1000000',
                    token: 'USDC',
                    taskAccount: 'task-account',
                    escrowAccount: 'escrow-account',
                }),
            ).rejects.toThrow('Bridge settlement not enabled');
        });
    });

    describe('external evaluation', () => {
        it('should submit external evaluation', async () => {
            await bridgeManager.initialize();

            // Add evaluator-1 to authorized list
            bridgeManager.addAuthorizedEvaluator('evaluator-1');

            const result = await bridgeManager.submitExternalEvaluation({
                taskId: 'task-123',
                proof: {
                    evaluationId: 'eval-123',
                    taskId: 'task-123',
                    evaluatorId: 'evaluator-1',
                    agentId: 'agent-1',
                    score: 85,
                    passed: true,
                    verificationHash: 'hash',
                    timestamp: Date.now(),
                    signature: 'signature',
                },
                evaluatorAuthority: 'evaluator-1',
            });

            // Should succeed since evaluator-1 is now authorized
            expect(result.success).toBe(true);
        });

        it('should reject unauthorized evaluators', async () => {
            await bridgeManager.initialize();

            const result = await bridgeManager.submitExternalEvaluation({
                taskId: 'task-123',
                proof: {
                    evaluationId: 'eval-123',
                    taskId: 'task-123',
                    evaluatorId: 'unauthorized',
                    agentId: 'agent-1',
                    score: 85,
                    passed: true,
                    verificationHash: 'hash',
                    timestamp: Date.now(),
                    signature: 'signature',
                },
                evaluatorAuthority: 'unauthorized-evaluator',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not authorized');
        });
    });

    describe('utility methods', () => {
        it('should return enabled status', () => {
            expect(bridgeManager.isEnabled()).toBe(true);
        });

        it('should return evaluator public key', async () => {
            await bridgeManager.initialize();
            const pubkey = bridgeManager.getEvaluatorPublicKey();
            expect(pubkey).toBeDefined();
        });
    });
});

describe('createBridgeManager factory', () => {
    it('should create BridgeManager instance', () => {
        const manager = createBridgeManager({}, { getPublicKey: vi.fn() } as any, {} as any);
        expect(manager).toBeInstanceOf(BridgeManager);
    });
});
