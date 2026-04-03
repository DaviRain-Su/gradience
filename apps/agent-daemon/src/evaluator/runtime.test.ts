/**
 * Evaluator Runtime Tests
 *
 * @module evaluator/runtime.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvaluatorRuntime, type EvaluationTask } from './runtime.js';

describe('EvaluatorRuntime', () => {
  let runtime: EvaluatorRuntime;

  beforeEach(() => {
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
      scoringModel: {
        provider: 'anthropic',
        model: 'claude-opus-4',
        temperature: 0.1,
        maxTokens: 2048,
      },
      driftDetection: {
        enabled: true,
        threshold: 0.8,
        resetStrategy: 'sprint_boundary',
        checkpointIntervalMs: 30000,
      },
    });
  });

  describe('configuration', () => {
    it('should return configuration', () => {
      const config = runtime.getConfig();
      expect(config.defaultBudget.maxCostUsd).toBe(5);
      expect(config.sandbox.type).toBe('docker');
      expect(config.driftDetection.enabled).toBe(true);
    });
  });

  describe('task submission', () => {
    it('should submit code evaluation task', async () => {
      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'task-123',
        agentId: 'agent-456',
        type: 'code',
        submission: {
          type: 'git_repo',
          source: 'https://github.com/example/repo',
          commitHash: 'abc123',
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

      const evaluationId = await runtime.submit(task);

      expect(evaluationId).toBeDefined();
      expect(typeof evaluationId).toBe('string');

      const status = runtime.getStatus(evaluationId);
      expect(status).toBeDefined();
      expect(status?.taskId).toBe('task-123');
    });

    it('should reject task without taskId', async () => {
      const task = {
        taskId: '',
        agentId: 'agent-456',
        type: 'code' as const,
        submission: { type: 'inline' as const, source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      await expect(runtime.submit(task)).rejects.toThrow('Task ID is required');
    });

    it('should reject task without agentId', async () => {
      const task = {
        taskId: 'task-123',
        agentId: '',
        type: 'code' as const,
        submission: { type: 'inline' as const, source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      await expect(runtime.submit(task)).rejects.toThrow('Agent ID is required');
    });

    it('should reject task with invalid minScore', async () => {
      const task = {
        taskId: 'task-123',
        agentId: 'agent-456',
        type: 'code' as const,
        submission: { type: 'inline' as const, source: '', metadata: {} },
        criteria: { minScore: 150, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      await expect(runtime.submit(task)).rejects.toThrow('Min score must be 0-100');
    });
  });

  describe('cancellation', () => {
    it('should cancel pending evaluation', async () => {
      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'task-cancel',
        agentId: 'agent-456',
        type: 'code',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      const evaluationId = await runtime.submit(task);
      const cancelled = await runtime.cancel(evaluationId);

      expect(cancelled).toBe(true);
      expect(runtime.getStatus(evaluationId)).toBeUndefined();
    });

    it('should return false for non-existent evaluation', async () => {
      const cancelled = await runtime.cancel('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit submitted event', async () => {
      const submittedEvents: string[] = [];
      runtime.on('submitted', (task) => {
        submittedEvents.push(task.taskId);
      });

      const task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
        taskId: 'task-event',
        agentId: 'agent-456',
        type: 'code',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      };

      await runtime.submit(task);

      expect(submittedEvents).toContain('task-event');
    });
  });
});
