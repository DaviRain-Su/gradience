import { describe, it, expect } from 'vitest';
import { createLocalWorkflowResolver, GW_WORKFLOW_NOT_FOUND } from '../local-resolver.js';

describe('LocalWorkflowResolver', () => {
  const resolver = createLocalWorkflowResolver();

  it('should resolve swap-demo with injected inputs', async () => {
    const result = await resolver.resolve('swap-demo', 'buyer1', { amount: 500 });
    expect(result.workflowId).toBe('swap-demo');
    expect(result.name).toBe('Simple SOL-USDC Swap');
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].params.amount).toBe(500);
    expect(result.inputs.amount).toBe(500);
  });

  it('should default missing inputs to raw template string', async () => {
    const result = await resolver.resolve('transfer-demo', 'buyer2', {});
    expect(result.steps[0].params.recipient).toBe('{{recipient}}');
  });

  it('should throw GW_WORKFLOW_NOT_FOUND for unknown id', async () => {
    await expect(resolver.resolve('unknown', 'buyer')).rejects.toThrow(
      'Workflow unknown not found',
    );
  });
});
