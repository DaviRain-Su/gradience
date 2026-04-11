import { describe, it, expect, vi } from 'vitest';
import { createVelWorkflowExecutionClient } from '../execution-client.js';
import { createLocalWorkflowResolver } from '../resolvers/local-resolver.js';

describe('VelWorkflowExecutionClient', () => {
  const resolver = createLocalWorkflowResolver();

  it('should resolve workflow and delegate to orchestrator', async () => {
    const orchestrator = {
      runAndSettle: vi.fn().mockResolvedValue('mock-tx-sig'),
    };

    const client = createVelWorkflowExecutionClient(orchestrator as any, resolver);

    const result = await client.runAndSettle({
      workflowId: 'swap-demo',
      workflowDefinition: { version: '1.0', name: 'stub', steps: [] },
      inputs: { amount: 200 },
      taskId: 42,
      executorAddress: 'buyer1',
      timeoutMs: 5000,
    });

    expect(result).toBe('mock-tx-sig');
    expect(orchestrator.runAndSettle).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'swap-demo',
        workflowDefinition: expect.objectContaining({
          version: '1.0',
          name: 'Simple SOL-USDC Swap',
          steps: expect.any(Array),
        }),
        inputs: { amount: 200 },
        taskId: 42,
        executorAddress: 'buyer1',
        timeoutMs: 5000,
      }),
    );
  });

  it('should propagate resolver errors', async () => {
    const orchestrator = { runAndSettle: vi.fn() };
    const client = createVelWorkflowExecutionClient(orchestrator as any, resolver);

    await expect(
      client.runAndSettle({
        workflowId: 'unknown',
        workflowDefinition: { version: '1.0', name: 'stub', steps: [] },
        inputs: {},
        taskId: 1,
        executorAddress: 'buyer',
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('Workflow unknown not found');

    expect(orchestrator.runAndSettle).not.toHaveBeenCalled();
  });
});
