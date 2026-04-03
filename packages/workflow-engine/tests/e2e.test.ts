/**
 * E2E Integration Tests for Workflow Engine
 * 
 * Tests the complete lifecycle:
 * 1. Create workflow
 * 2. Register to engine
 * 3. Execute workflow
 * 4. Verify results
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  WorkflowEngine,
  WorkflowSDK,
  createWorkflowEngine,
  createWorkflowSDK,
  validate,
  type GradienceWorkflow,
  type WorkflowExecutionResult,
} from '../src/index.js';

// Helper to create a test workflow
function createTestWorkflow(overrides?: Partial<GradienceWorkflow>): GradienceWorkflow {
  return {
    id: 'test-workflow-' + Date.now(),
    name: 'Test Workflow',
    description: 'A test workflow for E2E testing',
    author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
    version: '1.0.0',
    steps: [
      { id: 'step1', name: 'Log Start', chain: 'solana', action: 'log', params: { message: 'Starting workflow' } },
      { id: 'step2', name: 'Wait', chain: 'solana', action: 'wait', params: { ms: 10 } },
      { id: 'step3', name: 'Log End', chain: 'solana', action: 'log', params: { message: 'Workflow complete' } },
    ],
    pricing: { model: 'free' },
    revenueShare: { creator: 0, user: 9500, agent: 0, protocol: 200, judge: 300 },
    requirements: {},
    isPublic: true,
    isTemplate: false,
    tags: ['test', 'e2e'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentHash: 'ipfs://QmTest',
    signature: 'test-signature',
    ...overrides,
  };
}

function createArbitrageWorkflow(): GradienceWorkflow {
  return {
    id: 'arb-workflow-' + Date.now(),
    name: 'Cross-chain USDC Arbitrage',
    description: 'Monitor and execute USDC arbitrage across chains',
    author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
    version: '2.0.0',
    steps: [
      { 
        id: 'check-solana', 
        name: 'Check Solana USDC Price', 
        chain: 'solana', 
        action: 'httpRequest', 
        params: { url: 'https://api.jupiter.ag/v4/price?id=USDC', method: 'GET' },
        next: 'check-arbitrum'
      },
      { 
        id: 'check-arbitrum', 
        name: 'Check Arbitrum USDC Price', 
        chain: 'arbitrum', 
        action: 'httpRequest', 
        params: { url: 'https://api.arbitrum.io/price/USDC', method: 'GET' },
        next: 'compare'
      },
      { 
        id: 'compare', 
        name: 'Compare Prices', 
        chain: 'solana', 
        action: 'condition', 
        params: { expression: '{{check-solana.output.price}} > {{check-arbitrum.output.price}} * 1.01' },
        next: 'log-result'
      },
      { 
        id: 'log-result', 
        name: 'Log Result', 
        chain: 'solana', 
        action: 'log', 
        params: { message: 'Arbitrage opportunity found' } 
      },
    ],
    pricing: { model: 'oneTime', oneTimePrice: { mint: 'SOL', amount: '1000000000' } },
    revenueShare: { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 },
    requirements: { minReputation: 80 },
    isPublic: true,
    isTemplate: true,
    tags: ['arbitrage', 'cross-chain', 'usdc', 'advanced'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentHash: 'ipfs://QmArbitrage',
    signature: 'arb-signature',
  };
}

function createPrivacyWorkflow(): GradienceWorkflow {
  return {
    id: 'privacy-workflow-' + Date.now(),
    name: 'ZK Privacy Payment',
    description: 'Privacy-preserving payment using ZK proofs',
    author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
    version: '1.0.0',
    steps: [
      { 
        id: 'zk-prove', 
        name: 'Generate ZK Proof', 
        chain: 'solana', 
        action: 'zkProveIdentity', 
        params: { prove: 'kycVerified', notReveal: ['name', 'address'] },
        next: 'private-settle'
      },
      { 
        id: 'private-settle', 
        name: 'Private Settlement', 
        chain: 'xlayer', 
        action: 'teePrivateSettle', 
        params: { recipient: '{{config.recipient}}', amount: '{{config.amount}}', hideAmount: true } 
      },
    ],
    pricing: { model: 'perUse', perUsePrice: { mint: 'USDC', amount: '1000000' } },
    revenueShare: { creator: 1000, user: 8500, agent: 0, protocol: 200, judge: 300 },
    requirements: { zkProofs: [{ type: 'kyc' }] },
    isPublic: true,
    isTemplate: false,
    tags: ['privacy', 'zk', 'kyc'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentHash: 'ipfs://QmPrivacy',
    signature: 'privacy-signature',
  };
}

describe('Workflow E2E', () => {
  let engine: WorkflowEngine;
  let sdk: WorkflowSDK;

  beforeAll(() => {
    engine = createWorkflowEngine();
    sdk = createWorkflowSDK({
      rpcEndpoint: 'https://api.devnet.solana.com',
    });
  });

  describe('Complete Lifecycle', () => {
    it('should create, register, and execute a simple workflow', async () => {
      // 1. Create workflow
      const workflow = createTestWorkflow();
      
      // Validate
      const validation = validate(workflow);
      expect(validation.success).toBe(true);

      // 2. Register to engine
      engine.registerWorkflow(workflow);
      
      // Verify registration
      const registered = engine.getWorkflow(workflow.id);
      expect(registered).toBeDefined();
      expect(registered?.name).toBe(workflow.name);

      // 3. Execute workflow
      const result = await engine.execute(workflow.id, {});

      // 4. Verify results
      expect(result.status).toBe('completed');
      expect(result.stepResults).toHaveLength(3);
      expect(result.stepResults.every(r => r.status === 'completed')).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    }, 30000);

    it('should execute multi-chain arbitrage workflow', async () => {
      const workflow = createArbitrageWorkflow();
      // Make HTTP request steps optional so they don't fail the workflow
      workflow.steps = workflow.steps.map(s => 
        s.action === 'httpRequest' ? { ...s, optional: true } : s
      );
      
      // Validate
      const validation = validate(workflow);
      expect(validation.success).toBe(true);

      // Register and execute
      engine.registerWorkflow(workflow);
      const result = await engine.execute(workflow.id, {});

      // Should complete (even if HTTP steps fail as optional)
      expect(result.status).toBe('completed');
      
      // Verify chain distribution (at least condition and log should complete)
      const completedSteps = result.stepResults.filter(r => r.status === 'completed');
      expect(completedSteps.length).toBeGreaterThanOrEqual(2);
    }, 30000);

    it('should execute privacy workflow with ZK', async () => {
      const workflow = createPrivacyWorkflow();
      
      // Validate
      const validation = validate(workflow);
      expect(validation.success).toBe(true);

      // Register and execute with config
      engine.registerWorkflow(workflow);
      const result = await engine.execute(workflow.id, {
        recipient: '5Y3d...',
        amount: '1000000',
      });

      expect(result.status).toBe('completed');
      expect(result.stepResults).toHaveLength(2);
      
      // Verify ZK and TEE steps
      expect(result.stepResults[0].action).toBe('zkProveIdentity');
      expect(result.stepResults[1].action).toBe('teePrivateSettle');
    }, 30000);
  });

  describe('Simulation', () => {
    it('should simulate workflow without side effects', async () => {
      const workflow = createTestWorkflow();
      
      const result = await engine.simulate(workflow, { test: true });

      expect(result.status).toBe('completed');
      expect(result.stepResults).toHaveLength(3);
      
      // All steps should be simulated
      result.stepResults.forEach(step => {
        expect(step.output).toHaveProperty('simulated');
      });
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid workflow gracefully', async () => {
      const invalidWorkflow = createTestWorkflow({ steps: [] });
      
      const validation = validate(invalidWorkflow);
      expect(validation.success).toBe(false);
      
      // Should not be able to register invalid workflow
      expect(() => engine.registerWorkflow(invalidWorkflow)).toThrow();
    });

    it('should handle execution timeout', async () => {
      const workflow = createTestWorkflow({
        steps: [
          { id: 'slow', name: 'Slow Step', chain: 'solana', action: 'wait', params: { ms: 10000 }, timeout: 50, optional: true },
        ],
      });

      engine.registerWorkflow(workflow);
      
      // Should complete with failed status on optional step
      const result = await engine.execute(workflow.id, {});
      
      expect(result.stepResults[0].status).toBe('failed');
      expect(result.stepResults[0].error).toContain('timeout');
    }, 30000);
  });

  describe('SDK Integration', () => {
    it('should browse workflows via SDK', async () => {
      const workflows = await sdk.browse({ tags: ['test'] });
      
      expect(Array.isArray(workflows)).toBe(true);
      // Mock returns 1 workflow
      expect(workflows.length).toBeGreaterThan(0);
    });

    it('should check access via SDK', async () => {
      // Mock SDK with connected wallet
      const mockSdk = createWorkflowSDK({
        rpcEndpoint: 'https://api.devnet.solana.com',
        wallet: {
          publicKey: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
          signTransaction: async (tx) => tx,
          signAllTransactions: async (txs) => txs,
        },
      });
      
      const hasAccess = await mockSdk.hasAccess('any-workflow-id');
      
      // Mock returns true when wallet is connected
      expect(hasAccess).toBe(true);
    });
  });

  describe('Execution Tracking', () => {
    it('should track execution history', async () => {
      const workflow = createTestWorkflow();
      engine.registerWorkflow(workflow);

      // Execute multiple times
      await engine.execute(workflow.id, {});
      await engine.execute(workflow.id, {});
      await engine.execute(workflow.id, {});

      // Get executions
      const executions = engine.getExecutions(workflow.id);
      
      expect(executions.length).toBe(3);
      executions.forEach(exec => {
        expect(exec.workflowId).toBe(workflow.id);
        expect(exec.status).toBe('completed');
      });
    }, 60000);
  });
});
