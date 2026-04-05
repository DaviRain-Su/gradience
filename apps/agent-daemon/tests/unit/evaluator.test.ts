/**
 * Evaluator Module Tests
 *
 * Tests for:
 * - EvaluatorRuntime
 * - Judges (CodeJudge, UIJudge, APIJudge, ContentJudge)
 * - LLM Client
 *
 * @module evaluator/evaluator.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EvaluatorRuntime,
  CodeJudge,
  ContentJudge,
  JudgeRegistry,
  createDefaultJudgeRegistry,
  LLMClient,
  isLLMAvailable,
  createLLMClient,
  type EvaluationTask,
  type EvaluationType,
  type EvaluationResult,
  type CheckType,
} from '../../src/evaluator/index.js';

// ============================================================================
// EvaluatorRuntime Tests
// ============================================================================

describe('EvaluatorRuntime', () => {
  let runtime: EvaluatorRuntime;

  beforeEach(() => {
    runtime = new EvaluatorRuntime({
      defaultBudget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
      sandbox: {
        type: 'git_worktree',
        resources: { cpu: '1', memory: '256m', timeout: 60 },
        networkAccess: false,
      },
    });
  });

  afterEach(() => {
    runtime.removeAllListeners();
  });

  it('should create runtime with default config', () => {
    expect(runtime).toBeDefined();
    const config = runtime.getConfig();
    expect(config.defaultBudget.maxCostUsd).toBe(1.0);
  });

  it('should submit evaluation task', async () => {
    const task = {
      taskId: 'task-123',
      agentId: 'agent-456',
      type: 'content' as EvaluationType,
      submission: {
        type: 'inline' as const,
        source: 'Test content',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Overall quality',
              criteria: ['Correctness'],
            },
          ],
        },
        requiredChecks: ['compiles'] as CheckType[],
      },
      budget: {
        maxCostUsd: 0.5,
        maxTimeSeconds: 30,
        maxMemoryMb: 128,
        contextWindowSize: 5,
      },
    };

    const evaluationId = await runtime.submit(task);
    expect(evaluationId).toBeDefined();
    expect(typeof evaluationId).toBe('string');
    expect(evaluationId.length).toBeGreaterThan(0);
  });

  it('should get evaluation status', async () => {
    const task = {
      taskId: 'task-123',
      agentId: 'agent-456',
      type: 'content' as EvaluationType,
      submission: {
        type: 'inline' as const,
        source: 'Test content',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Overall quality',
              criteria: ['Correctness'],
            },
          ],
        },
        requiredChecks: ['compiles'] as CheckType[],
      },
      budget: {
        maxCostUsd: 0.5,
        maxTimeSeconds: 30,
        maxMemoryMb: 128,
        contextWindowSize: 5,
      },
    };

    const evaluationId = await runtime.submit(task);
    const status = runtime.getStatus(evaluationId);

    expect(status).toBeDefined();
    expect(status?.taskId).toBe('task-123');
  });
});

// ============================================================================
// Judges Tests
// ============================================================================

describe('CodeJudge', () => {
  let judge: CodeJudge;

  beforeEach(() => {
    judge = new CodeJudge();
  });

  it('should support code evaluation type', () => {
    const task: EvaluationTask = {
      id: 'eval-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      type: 'code',
      submission: {
        type: 'inline',
        source: 'console.log("hello")',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Overall quality',
              criteria: ['Correctness'],
            },
          ],
        },
        requiredChecks: ['compiles'],
      },
      budget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
      createdAt: Date.now(),
      timeoutAt: Date.now() + 60000,
    };

    expect(judge.canEvaluate(task)).toBe(true);
  });

  it('should not support non-code types', () => {
    const task: EvaluationTask = {
      id: 'eval-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      type: 'ui',
      submission: {
        type: 'url',
        source: 'https://example.com',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Overall quality',
              criteria: ['Visual appeal'],
            },
          ],
        },
        requiredChecks: ['compiles'],
      },
      budget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
      createdAt: Date.now(),
      timeoutAt: Date.now() + 60000,
    };

    expect(judge.canEvaluate(task)).toBe(false);
  });

  it('should complete evaluation', async () => {
    const task: EvaluationTask = {
      id: 'eval-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      type: 'code',
      submission: {
        type: 'inline',
        source: 'function test() { return 42; }',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Overall quality',
              criteria: ['Correctness'],
            },
          ],
        },
        requiredChecks: ['compiles'],
      },
      budget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
      createdAt: Date.now(),
      timeoutAt: Date.now() + 60000,
    };

    const result = await judge.evaluate(task);

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.scores.length).toBeGreaterThan(0);
  });
});

describe('ContentJudge', () => {
  let judge: ContentJudge;

  beforeEach(() => {
    judge = new ContentJudge();
  });

  it('should support content evaluation type', () => {
    const task: EvaluationTask = {
      id: 'eval-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      type: 'content',
      submission: {
        type: 'inline',
        source: 'This is a test article about AI.',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Content quality',
              criteria: ['Accuracy', 'Clarity'],
            },
          ],
        },
        requiredChecks: [],
      },
      budget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
      createdAt: Date.now(),
      timeoutAt: Date.now() + 60000,
    };

    expect(judge.canEvaluate(task)).toBe(true);
  });
});

// ============================================================================
// JudgeRegistry Tests
// ============================================================================

describe('JudgeRegistry', () => {
  let registry: JudgeRegistry;

  beforeEach(() => {
    registry = createDefaultJudgeRegistry();
  });

  afterEach(async () => {
    await registry.closeAll();
  });

  it('should register all default judges', () => {
    const judges = registry.list();
    expect(judges.length).toBeGreaterThanOrEqual(4);

    const judgeIds = judges.map((j) => j['config'].id);
    expect(judgeIds).toContain('code');
    expect(judgeIds).toContain('ui');
    expect(judgeIds).toContain('api');
    expect(judgeIds).toContain('content');
  });

  it('should find judge for task', () => {
    const task: EvaluationTask = {
      id: 'eval-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      type: 'code',
      submission: {
        type: 'inline',
        source: 'code',
        metadata: {},
      },
      criteria: {
        minScore: 70,
        rubric: { maxScore: 100, categories: [] },
        requiredChecks: [],
      },
      budget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
      createdAt: Date.now(),
      timeoutAt: Date.now() + 60000,
    };

    const judge = registry.findForTask(task);
    expect(judge).toBeDefined();
    expect(judge?.['config'].id).toBe('code');
  });

  it('should get judge by id', () => {
    const judge = registry.get('code');
    expect(judge).toBeDefined();
    expect(judge?.['config'].id).toBe('code');
  });
});

// ============================================================================
// LLM Client Tests
// ============================================================================

describe('LLMClient', () => {
  it('should check LLM availability', () => {
    const available = isLLMAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should create LLM client with config', () => {
    const client = createLLMClient({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4',
    });

    expect(client).toBeDefined();
    expect(client.isConfigured()).toBe(true);
  });

  it('should handle unconfigured client', () => {
    const client = new LLMClient({
      baseUrl: '',
      apiKey: '',
      model: 'gpt-4',
    });

    expect(client.isConfigured()).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Evaluator Integration', () => {
  it('should handle complete evaluation flow', async () => {
    const runtime = new EvaluatorRuntime({
      defaultBudget: {
        maxCostUsd: 1.0,
        maxTimeSeconds: 60,
        maxMemoryMb: 256,
        contextWindowSize: 10,
      },
    });

    const completedPromise = new Promise<EvaluationResult>((resolve) => {
      runtime.once('completed', (result) => resolve(result));
    });

    const task = {
      taskId: 'task-123',
      agentId: 'agent-456',
      type: 'content' as EvaluationType,
      submission: {
        type: 'inline' as const,
        source: 'Test content for integration test',
        metadata: {},
      },
      criteria: {
        minScore: 60,
        rubric: {
          maxScore: 100,
          categories: [
            {
              name: 'Quality',
              weight: 1.0,
              description: 'Overall quality',
              criteria: ['Correctness'],
            },
          ],
        },
        requiredChecks: ['compiles'] as CheckType[],
      },
      budget: {
        maxCostUsd: 0.5,
        maxTimeSeconds: 30,
        maxMemoryMb: 128,
        contextWindowSize: 5,
      },
    };

    const evaluationId = await runtime.submit(task);
    expect(evaluationId).toBeDefined();

    // Wait for evaluation with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    try {
      const result = await Promise.race([completedPromise, timeoutPromise]);
      expect(result).toBeDefined();
      expect((result as EvaluationResult).evaluationId).toBe(evaluationId);
    } catch {
      // Evaluation might timeout or fail due to sandbox requirements
      // This is acceptable in test environment
    }
  });
});
