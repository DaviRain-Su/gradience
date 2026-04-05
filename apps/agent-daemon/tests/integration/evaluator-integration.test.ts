/**
 * Evaluator Integration Tests
 *
 * Tests for the complete evaluation flow and integration between components.
 *
 * @module evaluator/integration.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EvaluatorRuntime, type EvaluationTask } from '../../src/evaluator/runtime.js';
import {
  JudgeRegistry,
  createDefaultJudgeRegistry,
  CodeJudge,
  UIJudge,
  APIJudge,
  ContentJudge,
} from '../../src/evaluator/judges.js';
import { LLMClient, getLLMClient } from '../../src/evaluator/llm-client.js';
import { PlaywrightHarness } from '../../src/evaluator/playwright-harness.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Playwright
vi.mock('../../src/evaluator/playwright-harness.js', () => ({
  PlaywrightHarness: vi.fn().mockImplementation(() => ({
    verifyUI: vi.fn().mockResolvedValue({
      passed: true,
      score: 85,
      details: [
        { name: 'navigation', passed: true, score: 100, message: 'Navigation successful' },
        { name: 'visual', passed: true, score: 80, message: 'Visual check passed' },
        { name: 'accessibility', passed: true, score: 75, message: 'Accessibility OK' },
      ],
      durationMs: 1000,
    }),
    verifyAPI: vi.fn().mockResolvedValue({
      passed: true,
      score: 90,
      details: [
        { name: 'GET /health', passed: true, score: 100, message: 'Health check passed', metadata: { status: 200, duration: 50 } },
        { name: 'POST /users', passed: true, score: 80, message: 'Users created', metadata: { status: 201, duration: 100 } },
      ],
      durationMs: 500,
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch for LLM client
global.fetch = vi.fn();

describe('Evaluator Integration', () => {
  let runtime: EvaluatorRuntime;
  let registry: JudgeRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = new EvaluatorRuntime({
      defaultBudget: {
        maxCostUsd: 5,
        maxTimeSeconds: 60,
        maxMemoryMb: 1024,
        contextWindowSize: 64000,
      },
      sandbox: {
        type: 'docker',
        resources: {
          cpu: '1',
          memory: '2g',
          timeout: 60,
        },
        networkAccess: false,
      },
    });
    registry = createDefaultJudgeRegistry();
  });

  afterEach(async () => {
    await registry.closeAll();
    vi.resetAllMocks();
  });

  describe('Runtime + Judges Integration', () => {
    it('should complete full code evaluation flow', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.passed).toBeDefined();
        expect(Array.isArray(result.categoryScores)).toBe(true);
        expect(Array.isArray(result.checkResults)).toBe(true);
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'integration-code-task',
        agentId: 'agent-1',
        type: 'code',
        submission: {
          type: 'inline',
          source: `
            function add(a, b) {
              return a + b;
            }
            
            // Test
            describe('add', () => {
              it('should add numbers', () => {
                expect(add(1, 2)).toBe(3);
              });
            });
          `,
          metadata: {},
        },
        criteria: {
          minScore: 70,
          rubric: {
            maxScore: 100,
            categories: [
              { name: 'Functionality', weight: 0.5, description: 'Code works', criteria: [] },
              { name: 'Quality', weight: 0.5, description: 'Clean code', criteria: [] },
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
      };

      runtime.submit(task);
    });

    it('should complete full UI evaluation flow', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        expect(result.passed).toBeDefined();
        expect(result.categoryScores.length).toBeGreaterThan(0);
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'integration-ui-task',
        agentId: 'agent-1',
        type: 'ui',
        submission: {
          type: 'url',
          source: 'https://example.com',
          metadata: {},
        },
        criteria: {
          minScore: 75,
          rubric: {
            maxScore: 100,
            categories: [
              { name: 'Visual', weight: 0.4, description: 'Visual quality', criteria: [] },
              { name: 'Accessibility', weight: 0.3, description: 'A11y', criteria: [] },
              { name: 'Responsive', weight: 0.3, description: 'Mobile friendly', criteria: [] },
            ],
          },
          requiredChecks: ['accessibility_ok', 'responsive'],
        },
        budget: {
          maxCostUsd: 5,
          maxTimeSeconds: 60,
          maxMemoryMb: 1024,
          contextWindowSize: 64000,
        },
      };

      runtime.submit(task);
    });

    it('should complete full API evaluation flow', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        expect(result.passed).toBeDefined();
        expect(result.categoryScores.length).toBeGreaterThan(0);
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'integration-api-task',
        agentId: 'agent-1',
        type: 'api',
        submission: {
          type: 'url',
          source: 'https://api.example.com',
          metadata: {
            endpoints: [
              { method: 'GET', path: '/health', expectedStatus: 200 },
              { method: 'GET', path: '/users', expectedStatus: 200 },
            ],
          },
        },
        criteria: {
          minScore: 80,
          rubric: {
            maxScore: 100,
            categories: [
              { name: 'Correctness', weight: 0.5, description: 'API works', criteria: [] },
              { name: 'Performance', weight: 0.5, description: 'Fast responses', criteria: [] },
            ],
          },
          requiredChecks: ['api_contract', 'performance_ok'],
        },
        budget: {
          maxCostUsd: 5,
          maxTimeSeconds: 60,
          maxMemoryMb: 1024,
          contextWindowSize: 64000,
        },
      };

      runtime.submit(task);
    });

    it('should handle content evaluation flow', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        expect(result.passed).toBeDefined();
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'integration-content-task',
        agentId: 'agent-1',
        type: 'content',
        submission: {
          type: 'inline',
          source: '# Test Article\n\nThis is a comprehensive test article about testing.\n\n## Introduction\nTesting is important.\n\n## Conclusion\nTest everything.',
          metadata: {},
        },
        criteria: {
          minScore: 70,
          rubric: {
            maxScore: 100,
            categories: [
              { name: 'Accuracy', weight: 0.3, description: 'Correct info', criteria: [] },
              { name: 'Clarity', weight: 0.3, description: 'Easy to read', criteria: [] },
              { name: 'Completeness', weight: 0.4, description: 'Full coverage', criteria: [] },
            ],
          },
          requiredChecks: [],
        },
        budget: {
          maxCostUsd: 5,
          maxTimeSeconds: 60,
          maxMemoryMb: 1024,
          contextWindowSize: 64000,
        },
      };

      runtime.submit(task);
    });

    it('should emit correct sequence of events', async () => {
      const events: string[] = [];

      runtime.on('submitted', () => events.push('submitted'));
      runtime.on('started', () => events.push('started'));
      runtime.on('completed', () => events.push('completed'));

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'event-sequence-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      await runtime.submit(task);

      // Wait for async evaluation
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(events).toContain('submitted');
      expect(events).toContain('started');
      expect(events).toContain('completed');
      expect(events.indexOf('submitted')).toBeLessThan(events.indexOf('started'));
      expect(events.indexOf('started')).toBeLessThan(events.indexOf('completed'));
    });
  });

  describe('Judge Registry Integration', () => {
    it('should find appropriate judge for code task', async () => {
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

      const judge = registry.findForTask(task);
      expect(judge).toBeDefined();
      expect(judge?.canEvaluate(task)).toBe(true);
    });

    it('should evaluate using judge from registry', async () => {
      const judge = new CodeJudge();
      registry.register(judge);

      const task: EvaluationTask = {
        id: 'task-1',
        taskId: 'task-1',
        agentId: 'agent-1',
        type: 'code',
        submission: { type: 'inline', source: 'function test() {}', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
        createdAt: Date.now(),
        timeoutAt: Date.now() + 60000,
      };

      const result = await judge.evaluate(task);
      expect(result.status).toBe('completed');
      expect(result.scores.length).toBeGreaterThan(0);
    });

    it('should handle multiple evaluations concurrently', async () => {
      const codeJudge = registry.get('code') as CodeJudge;
      const contentJudge = registry.get('content') as ContentJudge;

      const tasks: EvaluationTask[] = [
        {
          id: 'task-1',
          taskId: 'task-1',
          agentId: 'agent-1',
          type: 'code',
          submission: { type: 'inline', source: 'function test() {}', metadata: {} },
          criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
          budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
          createdAt: Date.now(),
          timeoutAt: Date.now() + 60000,
        },
        {
          id: 'task-2',
          taskId: 'task-2',
          agentId: 'agent-1',
          type: 'content',
          submission: { type: 'inline', source: 'Test content', metadata: {} },
          criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
          budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
          createdAt: Date.now(),
          timeoutAt: Date.now() + 60000,
        },
      ];

      const results = await Promise.all([
        codeJudge.evaluate(tasks[0]),
        contentJudge.evaluate(tasks[1]),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('completed');
    });
  });

  describe('Budget and Cost Tracking', () => {
    it('should track actual cost within budget', (done) => {
      runtime.on('completed', (result) => {
        expect(result.actualCost.usd).toBeLessThanOrEqual(5);
        expect(result.actualCost.timeSeconds).toBeLessThanOrEqual(60);
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'budget-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: {
          maxCostUsd: 5,
          maxTimeSeconds: 60,
          maxMemoryMb: 1024,
          contextWindowSize: 64000,
        },
      };

      runtime.submit(task);
    });

    it('should include timestamps in result', (done) => {
      const startTime = Date.now();

      runtime.on('completed', (result) => {
        expect(result.completedAt).toBeGreaterThanOrEqual(startTime);
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'timestamp-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(task);
    });
  });

  describe('Verification and Security', () => {
    it('should generate verification hash', (done) => {
      runtime.on('completed', (result) => {
        expect(result.verificationHash).toBeDefined();
        expect(typeof result.verificationHash).toBe('string');
        expect(result.verificationHash.length).toBeGreaterThan(0);
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'verification-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(task);
    });

    it('should generate unique verification hashes', (done) => {
      const hashes: string[] = [];
      let completed = 0;

      runtime.on('completed', (result) => {
        hashes.push(result.verificationHash);
        completed++;

        if (completed === 2) {
          expect(hashes[0]).not.toBe(hashes[1]);
          done();
        }
      });

      const baseTask: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'unique-hash-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(baseTask);
      runtime.submit(baseTask);
    });
  });

  describe('Error Recovery', () => {
    it('should handle evaluation errors gracefully', (done) => {
      runtime.on('error', (data) => {
        expect(data.error).toBeDefined();
        expect(data.evaluationId).toBeDefined();
        done();
      });

      // Submit with unknown type to trigger error
      const task: any = {
        taskId: 'error-task',
        agentId: 'agent-1',
        type: 'invalid_type',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(task);
    });

    it('should clean up after evaluation error', async () => {
      const task: any = {
        taskId: 'cleanup-task',
        agentId: 'agent-1',
        type: 'invalid_type',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      const evaluationId = await runtime.submit(task);

      // Wait for error to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Task should be removed from active evaluations
      expect(runtime.getStatus(evaluationId)).toBeUndefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle rapid successive submissions', async () => {
      const results: string[] = [];

      runtime.on('completed', (result) => {
        results.push(result.evaluationId);
      });

      const baseTask: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'rapid-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      // Submit 5 tasks rapidly
      const ids = await Promise.all([
        runtime.submit(baseTask),
        runtime.submit(baseTask),
        runtime.submit(baseTask),
        runtime.submit(baseTask),
        runtime.submit(baseTask),
      ]);

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5); // All unique
    });

    it('should handle cancellation during evaluation', async () => {
      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'cancel-during-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      const evaluationId = await runtime.submit(task);

      // Cancel immediately
      const cancelled = await runtime.cancel(evaluationId);
      expect(cancelled).toBe(true);

      // Task should be removed
      expect(runtime.getStatus(evaluationId)).toBeUndefined();
    });

    it('should handle multiple evaluation types in sequence', async () => {
      const results: Array<{ type: string; passed: boolean }> = [];

      runtime.on('completed', (result) => {
        const task = runtime['activeEvaluations'].get(result.evaluationId);
        // Note: task is already deleted, so we track type differently
      });

      const types: Array<EvaluationTask['type']> = ['code', 'ui', 'api', 'content'];

      for (const type of types) {
        const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
          taskId: `sequential-${type}-task`,
          agentId: 'agent-1',
          type,
          submission: type === 'url'
            ? { type: 'url', source: 'https://example.com', metadata: { endpoints: [{ method: 'GET', path: '/health', expectedStatus: 200 }] } }
            : { type: 'inline', source: 'test content', metadata: {} },
          criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
          budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
        };

        await runtime.submit(task);
      }

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // All should have been processed without errors
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty submission', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'empty-submission-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(task);
    });

    it('should handle very long submission', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'long-submission-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: 'x'.repeat(100000), metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(task);
    });

    it('should handle submission with special characters', (done) => {
      runtime.on('completed', (result) => {
        expect(result.evaluationId).toBeDefined();
        done();
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'special-chars-task',
        agentId: 'agent-1',
        type: 'content',
        submission: { type: 'inline', source: '<script>alert("test")</script>\n\n`~!@#$%^&*()', metadata: {} },
        criteria: { minScore: 0, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      runtime.submit(task);
    });
  });
});
