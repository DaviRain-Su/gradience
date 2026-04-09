/**
 * Schema Validation Tests
 * Based on docs/workflow-engine/05-test-spec.md
 */
import { describe, it, expect } from 'vitest';
import {
    validate,
    ErrorCodes,
    type GradienceWorkflow,
    type WorkflowStep,
    type RevenueShare,
} from '../src/schema/index.js';

// Helper to create a valid workflow
function createValidWorkflow(overrides?: Partial<GradienceWorkflow>): GradienceWorkflow {
    return {
        id: 'test-workflow-' + Date.now(),
        name: 'Test Workflow',
        description: 'A valid test workflow',
        author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1', chain: 'solana', action: 'log', params: { message: 'hello' } }],
        pricing: { model: 'free' },
        revenueShare: { creator: 0, user: 9500, agent: 0, protocol: 200, judge: 300 },
        requirements: {},
        isPublic: true,
        isTemplate: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        contentHash: 'ipfs://QmTest',
        signature: 'test-signature',
        ...overrides,
    };
}

describe('WorkflowSchema', () => {
    describe('validate()', () => {
        // ═══════════════════════════════════════════════════════════════
        // Happy Path
        // ═══════════════════════════════════════════════════════════════

        it('should accept valid minimal workflow', () => {
            const workflow = createValidWorkflow();
            expect(validate(workflow).success).toBe(true);
        });

        it('should accept workflow with 50 steps (max)', () => {
            const steps: WorkflowStep[] = Array(50)
                .fill(null)
                .map((_, i) => ({
                    id: `step${i}`,
                    name: `Step ${i}`,
                    chain: 'solana' as const,
                    action: 'log' as const,
                    params: {},
                }));
            const workflow = createValidWorkflow({ steps });
            expect(validate(workflow).success).toBe(true);
        });

        it('should accept workflow with DAG', () => {
            const workflow = createValidWorkflow({
                dag: {
                    nodes: [
                        { id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} },
                        { id: 'b', name: 'B', chain: 'solana', action: 'log', params: {} },
                    ],
                    edges: [{ from: 'a', to: 'b' }],
                },
            });
            expect(validate(workflow).success).toBe(true);
        });

        it('should accept all supported chains', () => {
            const chains = ['solana', 'tempo', 'xlayer', 'sui', 'near', 'ethereum', 'arbitrum', 'base'] as const;
            for (const chain of chains) {
                const workflow = createValidWorkflow({
                    steps: [{ id: 'step1', name: 'Step', chain, action: 'log', params: {} }],
                });
                expect(validate(workflow).success).toBe(true);
            }
        });

        it('should accept all pricing models', () => {
            const models = ['free', 'oneTime', 'subscription', 'perUse', 'revenueShare'] as const;
            for (const model of models) {
                const workflow = createValidWorkflow({ pricing: { model } });
                expect(validate(workflow).success).toBe(true);
            }
        });

        it('should accept all supported actions', () => {
            const actions = [
                'swap',
                'bridge',
                'transfer',
                'yieldFarm',
                'stake',
                'unstake',
                'borrow',
                'repay',
                'x402Payment',
                'mppStreamReward',
                'teePrivateSettle',
                'zeroGasExecute',
                'zkProveIdentity',
                'zkProveReputation',
                'verifyCredential',
                'linkIdentity',
                'nearIntent',
                'aiAnalyze',
                'aiDecide',
                'httpRequest',
                'wait',
                'condition',
                'parallel',
                'loop',
                'setVariable',
                'log',
            ] as const;
            for (const action of actions) {
                const workflow = createValidWorkflow({
                    steps: [{ id: 'step1', name: 'Step', chain: 'solana', action, params: {} }],
                });
                expect(validate(workflow).success).toBe(true);
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // Boundary Conditions
        // ═══════════════════════════════════════════════════════════════

        it('should reject workflow with 0 steps', () => {
            const workflow = createValidWorkflow({ steps: [] });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            // Steps validation errors use INVALID_STEP code
            expect(result.error?.code).toBe(ErrorCodes.INVALID_STEP);
        });

        it('should reject workflow with 51 steps (over max)', () => {
            const steps: WorkflowStep[] = Array(51)
                .fill(null)
                .map((_, i) => ({
                    id: `step${i}`,
                    name: `Step ${i}`,
                    chain: 'solana' as const,
                    action: 'log' as const,
                    params: {},
                }));
            const workflow = createValidWorkflow({ steps });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            // Steps validation errors use INVALID_STEP code
            expect(result.error?.code).toBe(ErrorCodes.INVALID_STEP);
        });

        it('should reject name longer than 64 chars', () => {
            const workflow = createValidWorkflow({ name: 'a'.repeat(65) });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject description longer than 2048 chars', () => {
            const workflow = createValidWorkflow({ description: 'a'.repeat(2049) });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject version longer than 16 chars', () => {
            const workflow = createValidWorkflow({ version: '1.0.0-alpha.beta.gamma.delta' });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject more than 10 tags', () => {
            const workflow = createValidWorkflow({ tags: Array(11).fill('tag') });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject tag longer than 32 chars', () => {
            const workflow = createValidWorkflow({ tags: ['a'.repeat(33)] });
            expect(validate(workflow).success).toBe(false);
        });

        // ═══════════════════════════════════════════════════════════════
        // Error Cases
        // ═══════════════════════════════════════════════════════════════

        it('should reject unsupported chain', () => {
            const workflow = createValidWorkflow({
                steps: [{ id: 'step1', name: 'Step', chain: 'bitcoin' as any, action: 'log', params: {} }],
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.UNSUPPORTED_CHAIN);
        });

        it('should reject unsupported action', () => {
            const workflow = createValidWorkflow({
                steps: [{ id: 'step1', name: 'Step', chain: 'solana', action: 'invalid_action' as any, params: {} }],
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.UNSUPPORTED_ACTION);
        });

        it('should reject circular DAG', () => {
            const workflow = createValidWorkflow({
                dag: {
                    nodes: [
                        { id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} },
                        { id: 'b', name: 'B', chain: 'solana', action: 'log', params: {} },
                    ],
                    edges: [
                        { from: 'a', to: 'b' },
                        { from: 'b', to: 'a' }, // circular!
                    ],
                },
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.CIRCULAR_DEPENDENCY);
        });

        it('should reject duplicate step ids', () => {
            const workflow = createValidWorkflow({
                steps: [
                    { id: 'step1', name: 'Step 1', chain: 'solana', action: 'log', params: {} },
                    { id: 'step1', name: 'Step 2', chain: 'solana', action: 'log', params: {} },
                ],
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.INVALID_STEP);
        });

        it('should reject invalid revenueShare total (not 10000)', () => {
            const workflow = createValidWorkflow({
                revenueShare: { creator: 1000, user: 9000, agent: 500, protocol: 200, judge: 300 } as RevenueShare,
            });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject revenueShare with wrong protocol value', () => {
            const workflow = createValidWorkflow({
                revenueShare: { creator: 0, user: 9600, agent: 0, protocol: 100 as any, judge: 300 },
            });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject revenueShare with wrong judge value', () => {
            const workflow = createValidWorkflow({
                revenueShare: { creator: 0, user: 9700, agent: 0, protocol: 200, judge: 100 as any },
            });
            expect(validate(workflow).success).toBe(false);
        });

        it('should reject step referencing non-existent next step', () => {
            const workflow = createValidWorkflow({
                steps: [
                    { id: 'step1', name: 'Step 1', chain: 'solana', action: 'log', params: {}, next: 'nonexistent' },
                ],
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.INVALID_STEP);
        });

        it('should reject step referencing non-existent onError step', () => {
            const workflow = createValidWorkflow({
                steps: [
                    { id: 'step1', name: 'Step 1', chain: 'solana', action: 'log', params: {}, onError: 'nonexistent' },
                ],
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.INVALID_STEP);
        });

        it('should reject condition with non-existent goto step', () => {
            const workflow = createValidWorkflow({
                steps: [
                    {
                        id: 'step1',
                        name: 'Step 1',
                        chain: 'solana',
                        action: 'log',
                        params: {},
                        condition: { expression: 'true', onFalse: 'goto', gotoStep: 'nonexistent' },
                    },
                ],
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.INVALID_STEP);
        });

        // ═══════════════════════════════════════════════════════════════
        // Complex DAG Tests
        // ═══════════════════════════════════════════════════════════════

        it('should accept valid complex DAG', () => {
            const workflow = createValidWorkflow({
                dag: {
                    nodes: [
                        { id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} },
                        { id: 'b', name: 'B', chain: 'solana', action: 'log', params: {} },
                        { id: 'c', name: 'C', chain: 'solana', action: 'log', params: {} },
                        { id: 'd', name: 'D', chain: 'solana', action: 'log', params: {} },
                    ],
                    edges: [
                        { from: 'a', to: 'b' },
                        { from: 'a', to: 'c' },
                        { from: 'b', to: 'd' },
                        { from: 'c', to: 'd' },
                    ],
                },
            });
            expect(validate(workflow).success).toBe(true);
        });

        it('should reject DAG with self-loop', () => {
            const workflow = createValidWorkflow({
                dag: {
                    nodes: [{ id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} }],
                    edges: [{ from: 'a', to: 'a' }],
                },
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.CIRCULAR_DEPENDENCY);
        });

        it('should reject DAG with 3-node cycle', () => {
            const workflow = createValidWorkflow({
                dag: {
                    nodes: [
                        { id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} },
                        { id: 'b', name: 'B', chain: 'solana', action: 'log', params: {} },
                        { id: 'c', name: 'C', chain: 'solana', action: 'log', params: {} },
                    ],
                    edges: [
                        { from: 'a', to: 'b' },
                        { from: 'b', to: 'c' },
                        { from: 'c', to: 'a' }, // cycle!
                    ],
                },
            });
            const result = validate(workflow);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ErrorCodes.CIRCULAR_DEPENDENCY);
        });
    });
});
