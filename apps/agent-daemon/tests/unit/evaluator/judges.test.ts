/**
 * Judges Tests
 *
 * @module evaluator/judges.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    BaseJudge,
    CodeJudge,
    UIJudge,
    APIJudge,
    ContentJudge,
    JudgeRegistry,
    createDefaultJudgeRegistry,
    type JudgeConfig,
    type JudgeEvaluation,
} from '../../../src/evaluator/judges.js';
import type { EvaluationTask } from '../../../src/evaluator/runtime.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../../src/evaluator/llm-client.js', () => ({
    getLLMClient: vi.fn(() => null),
    isLLMAvailable: vi.fn(() => false),
}));

vi.mock('../../../src/evaluator/playwright-harness.js', () => ({
    PlaywrightHarness: vi.fn().mockImplementation(() => ({
        verifyUI: vi.fn().mockResolvedValue({
            passed: true,
            score: 85,
            details: [
                { name: 'navigation', passed: true, score: 100, message: 'Navigation successful' },
                { name: 'visual', passed: true, score: 80, message: 'Visual check passed' },
            ],
            durationMs: 1000,
        }),
        verifyAPI: vi.fn().mockResolvedValue({
            passed: true,
            score: 90,
            details: [
                {
                    name: 'GET /health',
                    passed: true,
                    score: 100,
                    message: 'Health check passed',
                    metadata: { status: 200, duration: 50 },
                },
            ],
            durationMs: 500,
        }),
        shutdown: vi.fn().mockResolvedValue(undefined),
    })),
}));

// Test implementation of abstract BaseJudge
class TestJudge extends BaseJudge {
    constructor(config: JudgeConfig) {
        super(config);
    }

    protected async performEvaluation(
        task: EvaluationTask,
        evaluation: JudgeEvaluation,
    ): Promise<{ scores: any[]; checks: any[]; feedback: string[] }> {
        return {
            scores: [{ name: 'Test', score: 80, maxScore: 100, weight: 1, feedback: ['Test feedback'] }],
            checks: [{ type: 'compiles', passed: true, score: 100, details: 'OK', durationMs: 100 }],
            feedback: ['Test evaluation completed'],
        };
    }
}

describe('BaseJudge', () => {
    let judge: TestJudge;

    beforeEach(() => {
        judge = new TestJudge({
            id: 'test',
            name: 'Test Judge',
            supportedTypes: ['code', 'content'],
            weights: { test: 1 },
            minThreshold: 70,
        });
    });

    describe('canEvaluate', () => {
        it('should return true for supported types', () => {
            const task = { type: 'code' } as EvaluationTask;
            expect(judge.canEvaluate(task)).toBe(true);
        });

        it('should return false for unsupported types', () => {
            const task = { type: 'ui' } as EvaluationTask;
            expect(judge.canEvaluate(task)).toBe(false);
        });
    });

    describe('evaluate', () => {
        it('should complete evaluation successfully', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: { type: 'inline', source: 'test', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);

            expect(result.status).toBe('completed');
            expect(result.overallScore).toBe(80);
            expect(result.passed).toBe(true);
            expect(result.feedback).toContain('Test evaluation completed');
        });

        it('should emit evaluation_started event', async () => {
            const events: string[] = [];
            judge.on('evaluation_started', () => events.push('started'));

            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: { type: 'inline', source: 'test', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            await judge.evaluate(task);

            expect(events).toContain('started');
        });

        it('should emit evaluation_completed event', async () => {
            const events: JudgeEvaluation[] = [];
            judge.on('evaluation_completed', (e) => events.push(e));

            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: { type: 'inline', source: 'test', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            await judge.evaluate(task);

            expect(events).toHaveLength(1);
            expect(events[0].passed).toBe(true);
        });
    });

    describe('getEvaluation', () => {
        it('should return evaluation by id', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: { type: 'inline', source: 'test', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);
            const retrieved = judge.getEvaluation(result.evaluationId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.evaluationId).toBe(result.evaluationId);
        });

        it('should return undefined for unknown evaluation', () => {
            const retrieved = judge.getEvaluation('unknown-id');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('listEvaluations', () => {
        it('should list all evaluations', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: { type: 'inline', source: 'test', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            await judge.evaluate(task);
            const list = judge.listEvaluations();

            expect(list).toHaveLength(1);
        });
    });
});

describe('CodeJudge', () => {
    let judge: CodeJudge;

    beforeEach(() => {
        judge = new CodeJudge();
    });

    describe('configuration', () => {
        it('should have correct default configuration', () => {
            expect(judge['config'].id).toBe('code');
            expect(judge['config'].name).toBe('Code Quality Judge');
            expect(judge['config'].supportedTypes).toContain('code');
            expect(judge['config'].minThreshold).toBe(70);
        });

        it('should have correct weights', () => {
            const weights = judge['config'].weights;
            expect(weights.functionality).toBe(0.4);
            expect(weights.quality).toBe(0.3);
            expect(weights.tests).toBe(0.2);
            expect(weights.security).toBe(0.1);
        });
    });

    describe('evaluation', () => {
        it('should evaluate code with fallback scoring when LLM unavailable', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: {
                    type: 'inline',
                    source: 'function test() { return 42; } // comment\n test();',
                    metadata: {},
                },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);

            expect(result.status).toBe('completed');
            expect(result.scores).toHaveLength(4);
            expect(result.checks).toHaveLength(2);
            expect(result.feedback.some((f) => f.includes('heuristic'))).toBe(true);
        });

        it('should detect tests in code', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: {
                    type: 'inline',
                    source: 'describe("test", () => { it("works", () => { expect(true).toBe(true); }); });',
                    metadata: {},
                },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);
            const testCheck = result.checks.find((c) => c.type === 'tests_pass');

            expect(testCheck?.passed).toBe(true);
        });

        it('should detect error handling', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: {
                    type: 'inline',
                    source: 'try { risky(); } catch (e) { throw new Error("failed"); }',
                    metadata: {},
                },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);
            const securityScore = result.scores.find((s) => s.name === 'Security');

            expect(securityScore?.score).toBeGreaterThan(80);
        });
    });
});

describe('UIJudge', () => {
    let judge: UIJudge;

    beforeEach(() => {
        judge = new UIJudge();
    });

    afterEach(async () => {
        await judge.close();
    });

    describe('configuration', () => {
        it('should have correct default configuration', () => {
            expect(judge['config'].id).toBe('ui');
            expect(judge['config'].name).toBe('UI/UX Judge');
            expect(judge['config'].supportedTypes).toContain('ui');
            expect(judge['config'].minThreshold).toBe(75);
        });
    });

    describe('evaluation', () => {
        it('should evaluate UI using playwright', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'ui',
                submission: { type: 'url', source: 'https://example.com', metadata: {} },
                criteria: { minScore: 75, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);

            expect(result.status).toBe('completed');
            expect(result.scores.length).toBeGreaterThan(0);
        });
    });
});

describe('APIJudge', () => {
    let judge: APIJudge;

    beforeEach(() => {
        judge = new APIJudge();
    });

    afterEach(async () => {
        await judge.close();
    });

    describe('configuration', () => {
        it('should have correct default configuration', () => {
            expect(judge['config'].id).toBe('api');
            expect(judge['config'].name).toBe('API Contract Judge');
            expect(judge['config'].supportedTypes).toContain('api');
            expect(judge['config'].minThreshold).toBe(80);
        });
    });

    describe('evaluation', () => {
        it('should handle missing endpoints gracefully', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'api',
                submission: { type: 'url', source: 'https://api.example.com', metadata: {} },
                criteria: { minScore: 80, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);

            expect(result.status).toBe('completed');
            expect(result.feedback.some((f) => f.includes('No API endpoints'))).toBe(true);
        });

        it('should evaluate with endpoints', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'api',
                submission: {
                    type: 'url',
                    source: 'https://api.example.com',
                    metadata: {
                        endpoints: [{ method: 'GET', path: '/health', expectedStatus: 200 }],
                    },
                },
                criteria: { minScore: 80, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);

            expect(result.status).toBe('completed');
            expect(result.scores.length).toBeGreaterThan(0);
        });
    });
});

describe('ContentJudge', () => {
    let judge: ContentJudge;

    beforeEach(() => {
        judge = new ContentJudge();
    });

    describe('configuration', () => {
        it('should have correct default configuration', () => {
            expect(judge['config'].id).toBe('content');
            expect(judge['config'].name).toBe('Content Quality Judge');
            expect(judge['config'].supportedTypes).toContain('content');
            expect(judge['config'].minThreshold).toBe(70);
        });
    });

    describe('evaluation', () => {
        it('should evaluate content with fallback scoring', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'content',
                submission: {
                    type: 'inline',
                    source: '# Heading\n\nThis is a paragraph.\n\n- List item 1\n- List item 2',
                    metadata: {},
                },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);

            expect(result.status).toBe('completed');
            expect(result.scores).toHaveLength(4); // accuracy, clarity, completeness, originality
            expect(result.scores.some((s) => s.name === 'Clarity')).toBe(true);
        });

        it('should detect content structure', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'content',
                submission: {
                    type: 'inline',
                    source: '# Title\n\n## Section 1\nContent here.\n\n## Section 2\nMore content.',
                    metadata: {},
                },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);
            const clarityScore = result.scores.find((s) => s.name === 'Clarity');

            expect(clarityScore?.score).toBeGreaterThan(60);
        });

        it('should calculate completeness based on word count', async () => {
            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'content',
                submission: {
                    type: 'inline',
                    source: 'Word '.repeat(500), // 1000 words
                    metadata: {},
                },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const result = await judge.evaluate(task);
            const completenessScore = result.scores.find((s) => s.name === 'Completeness');

            expect(completenessScore?.score).toBe(100);
        });
    });
});

describe('JudgeRegistry', () => {
    let registry: JudgeRegistry;

    beforeEach(() => {
        registry = new JudgeRegistry();
    });

    describe('register', () => {
        it('should register a judge', () => {
            const judge = new CodeJudge();
            registry.register(judge);

            expect(registry.list()).toHaveLength(1);
        });

        it('should register multiple judges', () => {
            registry.register(new CodeJudge());
            registry.register(new UIJudge());
            registry.register(new APIJudge());

            expect(registry.list()).toHaveLength(3);
        });
    });

    describe('get', () => {
        it('should retrieve judge by id', () => {
            const judge = new CodeJudge();
            registry.register(judge);

            const retrieved = registry.get('code');
            expect(retrieved).toBeDefined();
        });

        it('should return undefined for unknown id', () => {
            const retrieved = registry.get('unknown');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('findForTask', () => {
        it('should find judge for code task', () => {
            registry.register(new CodeJudge());
            registry.register(new UIJudge());

            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'code',
                submission: { type: 'inline', source: '', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const judge = registry.findForTask(task);
            expect(judge).toBeDefined();
        });

        it('should return undefined if no judge supports task type', () => {
            registry.register(new CodeJudge());

            const task: EvaluationTask = {
                id: 'task-1',
                taskId: 'task-1',
                agentId: 'agent-1',
                type: 'ui',
                submission: { type: 'inline', source: '', metadata: {} },
                criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
                budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
                createdAt: Date.now(),
                timeoutAt: Date.now() + 60000,
            };

            const judge = registry.findForTask(task);
            expect(judge).toBeUndefined();
        });
    });

    describe('list', () => {
        it('should list all registered judges', () => {
            registry.register(new CodeJudge());
            registry.register(new ContentJudge());

            const list = registry.list();
            expect(list).toHaveLength(2);
        });
    });

    describe('closeAll', () => {
        it('should close all judges and clear registry', async () => {
            registry.register(new CodeJudge());
            registry.register(new UIJudge());

            await registry.closeAll();

            expect(registry.list()).toHaveLength(0);
        });
    });
});

describe('createDefaultJudgeRegistry', () => {
    it('should create registry with all judges', () => {
        const registry = createDefaultJudgeRegistry();

        expect(registry.get('code')).toBeDefined();
        expect(registry.get('ui')).toBeDefined();
        expect(registry.get('api')).toBeDefined();
        expect(registry.get('content')).toBeDefined();
    });

    it('should have correct judge count', () => {
        const registry = createDefaultJudgeRegistry();
        expect(registry.list()).toHaveLength(4);
    });
});
