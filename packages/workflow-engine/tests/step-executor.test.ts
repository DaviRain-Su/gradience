/**
 * Step Executor Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { StepExecutor, executeStep, type ActionHandler, type ExecutionContext } from '../src/engine/step-executor.js';
import type { WorkflowStep, StepResult } from '../src/schema/types.js';

// Mock action handler
function createMockHandler(result: Record<string, unknown> = {}): ActionHandler {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function createFailingHandler(error: Error): ActionHandler {
  return {
    execute: vi.fn().mockRejectedValue(error),
  };
}

function createDelayedHandler(result: Record<string, unknown>, delay: number): ActionHandler {
  return {
    execute: vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(result), delay))
    ),
  };
}

function createStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: 'step1',
    name: 'Test Step',
    chain: 'solana',
    action: 'log',
    params: {},
    ...overrides,
  };
}

describe('StepExecutor', () => {
  describe('execute()', () => {
    // ═══════════════════════════════════════════════════════════════
    // Happy Path
    // ═══════════════════════════════════════════════════════════════

    it('should execute a simple step successfully', async () => {
      const executor = new StepExecutor();
      const handler = createMockHandler({ message: 'done' });
      executor.registerHandler('log', handler);

      const step = createStep();
      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
      });

      expect(result.status).toBe('completed');
      expect(result.output).toEqual({ message: 'done' });
      expect(result.retryCount).toBe(0);
    });

    it('should parse template variables in params', async () => {
      const executor = new StepExecutor();
      const handler = createMockHandler();
      executor.registerHandler('log', handler);

      const previousResult: StepResult = {
        stepId: 'step0',
        status: 'completed',
        chain: 'solana',
        action: 'log',
        output: { value: 'parsed-value' },
        duration: 100,
        retryCount: 0,
      };

      const step = createStep({
        params: { message: '{{step0.output.value}}' },
      });

      await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map([['step0', previousResult]]),
      });

      expect(handler.execute).toHaveBeenCalledWith(
        'solana',
        { message: 'parsed-value' },
        expect.any(Object)
      );
    });

    it('should call onStepStart and onStepComplete callbacks', async () => {
      const executor = new StepExecutor();
      executor.registerHandler('log', createMockHandler());

      const onStepStart = vi.fn();
      const onStepComplete = vi.fn();

      const step = createStep();
      await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
        onStepStart,
        onStepComplete,
      });

      expect(onStepStart).toHaveBeenCalledWith('step1');
      expect(onStepComplete).toHaveBeenCalledWith(
        expect.objectContaining({ stepId: 'step1', status: 'completed' })
      );
    });

    // ═══════════════════════════════════════════════════════════════
    // Timeout
    // ═══════════════════════════════════════════════════════════════

    it('should timeout after configured duration', async () => {
      const executor = new StepExecutor();
      executor.registerHandler('log', createDelayedHandler({}, 100));

      const step = createStep({ timeout: 50, optional: true }); // Make optional to not throw
      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('timeout');
    });

    // ═══════════════════════════════════════════════════════════════
    // Retry
    // ═══════════════════════════════════════════════════════════════

    it('should retry on failure and succeed', async () => {
      const executor = new StepExecutor();
      let attempts = 0;
      const handler: ActionHandler = {
        execute: vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        }),
      };
      executor.registerHandler('log', handler);

      const step = createStep({ retries: 3 });
      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
      });

      expect(result.status).toBe('completed');
      expect(result.retryCount).toBe(2);
      expect(handler.execute).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const executor = new StepExecutor();
      executor.registerHandler('log', createFailingHandler(new Error('Permanent failure')));

      const step = createStep({ retries: 2, optional: true }); // Make optional to not throw
      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
      });

      expect(result.status).toBe('failed');
      expect(result.retryCount).toBe(2);
    });

    // ═══════════════════════════════════════════════════════════════
    // Condition
    // ═══════════════════════════════════════════════════════════════

    it('should skip step when condition is false', async () => {
      const executor = new StepExecutor();
      const handler = createMockHandler();
      executor.registerHandler('log', handler);

      const previousResult: StepResult = {
        stepId: 'step0',
        status: 'completed',
        chain: 'solana',
        action: 'log',
        output: { value: 50 },
        duration: 100,
        retryCount: 0,
      };

      const step = createStep({
        condition: { expression: '{{step0.output.value}} > 100', onFalse: 'skip' },
      });

      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map([['step0', previousResult]]),
      });

      expect(result.status).toBe('skipped');
      expect(handler.execute).not.toHaveBeenCalled();
    });

    it('should abort when condition onFalse is abort', async () => {
      const executor = new StepExecutor();
      executor.registerHandler('log', createMockHandler());

      const step = createStep({
        condition: { expression: 'false', onFalse: 'abort' },
      });

      await expect(
        executor.execute(step, {
          workflowId: 'wf-1',
          executor: 'user-1',
          stepResults: new Map(),
        })
      ).rejects.toThrow('ConditionAbort');
    });

    // ═══════════════════════════════════════════════════════════════
    // Optional Steps
    // ═══════════════════════════════════════════════════════════════

    it('should not throw when optional step fails', async () => {
      const executor = new StepExecutor();
      executor.registerHandler('log', createFailingHandler(new Error('Fail')));

      const step = createStep({ optional: true });
      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Fail');
    });

    it('should throw when non-optional step fails', async () => {
      const executor = new StepExecutor();
      executor.registerHandler('log', createFailingHandler(new Error('Fail')));

      const step = createStep({ optional: false });
      await expect(
        executor.execute(step, {
          workflowId: 'wf-1',
          executor: 'user-1',
          stepResults: new Map(),
        })
      ).rejects.toThrow('StepExecutionFailed');
    });

    // ═══════════════════════════════════════════════════════════════
    // Handler Management
    // ═══════════════════════════════════════════════════════════════

    it('should fail when no handler registered', async () => {
      const executor = new StepExecutor();
      // No handlers registered

      const step = createStep();
      const result = await executor.execute(step, {
        workflowId: 'wf-1',
        executor: 'user-1',
        stepResults: new Map(),
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('No handler registered');
    });

    it('should register multiple handlers', async () => {
      const executor = new StepExecutor();
      const handlers = new Map([
        ['log', createMockHandler()],
        ['swap', createMockHandler()],
      ]);
      executor.registerHandlers(handlers);

      expect(executor.hasHandler('log')).toBe(true);
      expect(executor.hasHandler('swap')).toBe(true);
      expect(executor.getRegisteredActions()).toHaveLength(2);
    });
  });
});
