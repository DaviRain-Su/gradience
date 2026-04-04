# Phase 5: Test Spec — Workflow Engine (功法引擎)

> **目的**: 定义测试用例，TDD 先行
> **输入**: `docs/workflow-engine/03-technical-spec.md`, `docs/workflow-engine/04-task-breakdown.md`
> **输出物**: 本文档 + 测试骨架代码

---

## 变更记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v0.1 | 2026-04-04 | 初稿 |

---

## 测试策略

```
┌─────────────────────────────────────────────────────────────┐
│  E2E Tests (端到端)                                         │
│  · 完整生命周期: 创建 → 购买 → 执行 → 评价                   │
│  · Devnet 集成测试                                          │
├─────────────────────────────────────────────────────────────┤
│  Integration Tests (集成测试)                               │
│  · SDK + Program 交互                                       │
│  · Engine + Chain Hub 集成                                  │
│  · Indexer 事件同步                                         │
├─────────────────────────────────────────────────────────────┤
│  Unit Tests (单元测试)                                      │
│  · Schema 验证                                              │
│  · 模板解析                                                 │
│  · Step 执行                                                │
│  · Action Handlers                                          │
│  · 收益分配计算                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 单元测试

### 1.1 Schema 验证 (`schema.test.ts`)

```typescript
describe('WorkflowSchema', () => {
  describe('validate()', () => {
    // ═══════════════════════════════════════════════════════════
    // Happy Path
    // ═══════════════════════════════════════════════════════════
    
    it('should accept valid minimal workflow', () => {
      const workflow = {
        id: 'test-workflow-001',
        name: 'Test Workflow',
        description: 'A test workflow',
        author: '5Y3d...',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1', chain: 'solana', action: 'transfer', params: {} }],
        pricing: { model: 'free' },
        revenueShare: { creator: 0, user: 9500, agent: 0, protocol: 200, judge: 300 },
        requirements: {},
        isPublic: true,
        isTemplate: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        contentHash: 'ipfs://Qm...',
        signature: 'base64...'
      };
      expect(validate(workflow).success).toBe(true);
    });

    it('should accept workflow with 50 steps (max)', () => {
      const steps = Array(50).fill(null).map((_, i) => ({
        id: `step${i}`,
        name: `Step ${i}`,
        chain: 'solana',
        action: 'log',
        params: {}
      }));
      const workflow = createValidWorkflow({ steps });
      expect(validate(workflow).success).toBe(true);
    });

    it('should accept workflow with DAG', () => {
      const workflow = createValidWorkflow({
        dag: {
          nodes: [
            { id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} },
            { id: 'b', name: 'B', chain: 'solana', action: 'log', params: {} }
          ],
          edges: [{ from: 'a', to: 'b' }]
        }
      });
      expect(validate(workflow).success).toBe(true);
    });

    it('should accept all supported chains', () => {
      const chains = ['solana', 'tempo', 'xlayer', 'sui', 'near', 'ethereum', 'arbitrum', 'base'];
      for (const chain of chains) {
        const workflow = createValidWorkflow({
          steps: [{ id: 'step1', name: 'Step', chain, action: 'log', params: {} }]
        });
        expect(validate(workflow).success).toBe(true);
      }
    });

    it('should accept all pricing models', () => {
      const models = ['free', 'oneTime', 'subscription', 'perUse', 'revenueShare'];
      for (const model of models) {
        const workflow = createValidWorkflow({ pricing: { model } });
        expect(validate(workflow).success).toBe(true);
      }
    });

    // ═══════════════════════════════════════════════════════════
    // Boundary Conditions
    // ═══════════════════════════════════════════════════════════

    it('should reject workflow with 0 steps', () => {
      const workflow = createValidWorkflow({ steps: [] });
      const result = validate(workflow);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(7000);
    });

    it('should reject workflow with 51 steps (over max)', () => {
      const steps = Array(51).fill(null).map((_, i) => ({
        id: `step${i}`, name: `Step ${i}`, chain: 'solana', action: 'log', params: {}
      }));
      const workflow = createValidWorkflow({ steps });
      const result = validate(workflow);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(7000);
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

    // ═══════════════════════════════════════════════════════════
    // Error Cases
    // ═══════════════════════════════════════════════════════════

    it('should reject unsupported chain', () => {
      const workflow = createValidWorkflow({
        steps: [{ id: 'step1', name: 'Step', chain: 'bitcoin', action: 'log', params: {} }]
      });
      const result = validate(workflow);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(7002);
    });

    it('should reject unsupported action', () => {
      const workflow = createValidWorkflow({
        steps: [{ id: 'step1', name: 'Step', chain: 'solana', action: 'invalid_action', params: {} }]
      });
      const result = validate(workflow);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(7003);
    });

    it('should reject circular DAG', () => {
      const workflow = createValidWorkflow({
        dag: {
          nodes: [
            { id: 'a', name: 'A', chain: 'solana', action: 'log', params: {} },
            { id: 'b', name: 'B', chain: 'solana', action: 'log', params: {} }
          ],
          edges: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a' }  // circular!
          ]
        }
      });
      const result = validate(workflow);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(7004);
    });

    it('should reject duplicate step ids', () => {
      const workflow = createValidWorkflow({
        steps: [
          { id: 'step1', name: 'Step 1', chain: 'solana', action: 'log', params: {} },
          { id: 'step1', name: 'Step 2', chain: 'solana', action: 'log', params: {} }
        ]
      });
      const result = validate(workflow);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(7001);
    });

    it('should reject invalid revenueShare total (not 10000)', () => {
      const workflow = createValidWorkflow({
        revenueShare: { creator: 1000, user: 9000, agent: 500, protocol: 200, judge: 300 }
      });
      expect(validate(workflow).success).toBe(false);
    });

    it('should reject revenueShare with wrong protocol value', () => {
      const workflow = createValidWorkflow({
        revenueShare: { creator: 0, user: 9600, agent: 0, protocol: 100, judge: 300 }
      });
      expect(validate(workflow).success).toBe(false);
    });
  });
});
```

### 1.2 模板解析 (`template-parser.test.ts`)

```typescript
describe('TemplateParser', () => {
  describe('parseTemplate()', () => {
    // ═══════════════════════════════════════════════════════════
    // Happy Path
    // ═══════════════════════════════════════════════════════════

    it('should parse simple variable', () => {
      const context = new Map([['step1', { stepId: 'step1', output: { value: 100 } }]]);
      expect(parseTemplate('{{step1.output.value}}', context)).toBe('100');
    });

    it('should parse multiple variables', () => {
      const context = new Map([
        ['step1', { stepId: 'step1', output: { a: 'hello' } }],
        ['step2', { stepId: 'step2', output: { b: 'world' } }]
      ]);
      expect(parseTemplate('{{step1.output.a}} {{step2.output.b}}', context)).toBe('hello world');
    });

    it('should parse nested object access', () => {
      const context = new Map([
        ['step1', { stepId: 'step1', output: { data: { nested: { value: 42 } } } }]
      ]);
      expect(parseTemplate('{{step1.output.data.nested.value}}', context)).toBe('42');
    });

    it('should parse step properties', () => {
      const context = new Map([
        ['step1', { stepId: 'step1', status: 'completed', txHash: '0xabc' }]
      ]);
      expect(parseTemplate('{{step1.txHash}}', context)).toBe('0xabc');
    });

    it('should handle mixed text and variables', () => {
      const context = new Map([['step1', { output: { amount: '1000' } }]]);
      expect(parseTemplate('Amount: {{step1.output.amount}} USDC', context)).toBe('Amount: 1000 USDC');
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    it('should keep original text if step not found', () => {
      const context = new Map();
      expect(parseTemplate('{{step1.output.value}}', context)).toBe('{{step1.output.value}}');
    });

    it('should keep original text if field not found', () => {
      const context = new Map([['step1', { output: {} }]]);
      expect(parseTemplate('{{step1.output.missing}}', context)).toBe('{{step1.output.missing}}');
    });

    it('should handle null output', () => {
      const context = new Map([['step1', { output: null }]]);
      expect(parseTemplate('{{step1.output.value}}', context)).toBe('{{step1.output.value}}');
    });

    it('should handle empty string', () => {
      expect(parseTemplate('', new Map())).toBe('');
    });

    it('should handle text without variables', () => {
      expect(parseTemplate('plain text', new Map())).toBe('plain text');
    });

    it('should handle malformed variables gracefully', () => {
      expect(parseTemplate('{{invalid}}', new Map())).toBe('{{invalid}}');
      expect(parseTemplate('{{}}', new Map())).toBe('{{}}');
      expect(parseTemplate('{{ step1.output }}', new Map())).toBe('{{ step1.output }}');
    });
  });
});
```

### 1.3 Step Executor (`step-executor.test.ts`)

```typescript
describe('StepExecutor', () => {
  let executor: StepExecutor;
  let mockHub: MockChainHub;

  beforeEach(() => {
    mockHub = createMockChainHub();
    executor = new StepExecutor(mockHub);
  });

  describe('execute()', () => {
    // ═══════════════════════════════════════════════════════════
    // Happy Path
    // ═══════════════════════════════════════════════════════════

    it('should execute simple step successfully', async () => {
      const step = { id: 'step1', name: 'Log', chain: 'solana', action: 'log', params: { message: 'hello' } };
      const result = await executor.execute(step, new Map());
      
      expect(result.status).toBe('completed');
      expect(result.stepId).toBe('step1');
    });

    it('should pass parsed params to handler', async () => {
      const step = {
        id: 'step2',
        name: 'Transfer',
        chain: 'solana',
        action: 'transfer',
        params: { amount: '{{step1.output.value}}', to: '5Y3d...' }
      };
      const context = new Map([['step1', { output: { value: '1000' } }]]);
      
      await executor.execute(step, context);
      
      expect(mockHub.lastCall.params.amount).toBe('1000');
    });

    it('should return output from handler', async () => {
      mockHub.setMockOutput({ txHash: '0xabc', balance: 500 });
      
      const step = { id: 'step1', name: 'Swap', chain: 'solana', action: 'swap', params: {} };
      const result = await executor.execute(step, new Map());
      
      expect(result.output).toEqual({ txHash: '0xabc', balance: 500 });
    });

    // ═══════════════════════════════════════════════════════════
    // Timeout
    // ═══════════════════════════════════════════════════════════

    it('should timeout after configured duration', async () => {
      mockHub.setDelay(5000); // 5 seconds
      
      const step = { id: 'step1', name: 'Slow', chain: 'solana', action: 'log', params: {}, timeout: 100 };
      const result = await executor.execute(step, new Map());
      
      expect(result.status).toBe('failed');
      expect(result.error).toContain('timeout');
    });

    it('should use default timeout of 60000ms', async () => {
      mockHub.setDelay(50000);
      
      const step = { id: 'step1', name: 'Slow', chain: 'solana', action: 'log', params: {} };
      // This should not timeout within the default 60s
      const startTime = Date.now();
      await executor.execute(step, new Map());
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(60000);
    });

    // ═══════════════════════════════════════════════════════════
    // Retry
    // ═══════════════════════════════════════════════════════════

    it('should retry on failure', async () => {
      let attempts = 0;
      mockHub.setHandler(() => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary failure');
        return { success: true };
      });
      
      const step = { id: 'step1', name: 'Flaky', chain: 'solana', action: 'log', params: {}, retries: 3 };
      const result = await executor.execute(step, new Map());
      
      expect(result.status).toBe('completed');
      expect(result.retryCount).toBe(2);
    });

    it('should fail after max retries', async () => {
      mockHub.setHandler(() => { throw new Error('Permanent failure'); });
      
      const step = { id: 'step1', name: 'Fail', chain: 'solana', action: 'log', params: {}, retries: 2 };
      const result = await executor.execute(step, new Map());
      
      expect(result.status).toBe('failed');
      expect(result.retryCount).toBe(2);
    });

    it('should respect retry delay', async () => {
      let callTimes: number[] = [];
      mockHub.setHandler(() => {
        callTimes.push(Date.now());
        if (callTimes.length < 3) throw new Error('Fail');
        return { success: true };
      });
      
      const step = { id: 'step1', name: 'Delayed', chain: 'solana', action: 'log', params: {}, retries: 3, retryDelay: 100 };
      await executor.execute(step, new Map());
      
      expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(100);
      expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(100);
    });

    // ═══════════════════════════════════════════════════════════
    // Condition
    // ═══════════════════════════════════════════════════════════

    it('should skip step when condition is false', async () => {
      const step = {
        id: 'step1',
        name: 'Conditional',
        chain: 'solana',
        action: 'log',
        params: {},
        condition: { expression: '{{step0.output.value}} > 100', onFalse: 'skip' }
      };
      const context = new Map([['step0', { output: { value: 50 } }]]);
      
      const result = await executor.execute(step, context);
      
      expect(result.status).toBe('skipped');
    });

    it('should abort workflow when condition onFalse is abort', async () => {
      const step = {
        id: 'step1',
        name: 'Guard',
        chain: 'solana',
        action: 'log',
        params: {},
        condition: { expression: '{{step0.output.ok}} == true', onFalse: 'abort' }
      };
      const context = new Map([['step0', { output: { ok: false } }]]);
      
      await expect(executor.execute(step, context)).rejects.toThrow('ConditionAbort');
    });

    // ═══════════════════════════════════════════════════════════
    // Optional Steps
    // ═══════════════════════════════════════════════════════════

    it('should not throw when optional step fails', async () => {
      mockHub.setHandler(() => { throw new Error('Fail'); });
      
      const step = { id: 'step1', name: 'Optional', chain: 'solana', action: 'log', params: {}, optional: true };
      const result = await executor.execute(step, new Map());
      
      expect(result.status).toBe('failed');
      // Should not throw
    });
  });
});
```

### 1.4 收益分配 (`revenue.test.ts`)

```typescript
describe('Revenue Distribution', () => {
  describe('distributeRevenue()', () => {
    // ═══════════════════════════════════════════════════════════
    // Happy Path
    // ═══════════════════════════════════════════════════════════

    it('should distribute revenue correctly with default shares', () => {
      const total = 10000n; // 10000 lamports
      const shares = { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(total, shares);
      
      expect(result.protocol).toBe(200n);  // 2%
      expect(result.judge).toBe(300n);     // 3%
      expect(result.creator).toBe(475n);   // 5% of remaining 9500
      expect(result.agent).toBe(0n);
      expect(result.user).toBe(9025n);     // remainder
      
      // Total should equal input
      expect(result.protocol + result.judge + result.creator + result.agent + result.user).toBe(total);
    });

    it('should handle large amounts', () => {
      const total = 1000000000000n; // 1 trillion
      const shares = { creator: 1000, user: 8500, agent: 0, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(total, shares);
      
      expect(result.protocol).toBe(20000000000n);
      expect(result.judge).toBe(30000000000n);
    });

    it('should handle zero creator share', () => {
      const total = 10000n;
      const shares = { creator: 0, user: 9500, agent: 0, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(total, shares);
      
      expect(result.creator).toBe(0n);
      expect(result.user).toBe(9500n);
    });

    it('should handle agent share', () => {
      const total = 10000n;
      const shares = { creator: 500, user: 8500, agent: 500, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(total, shares);
      
      expect(result.agent).toBe(475n);
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    it('should handle zero total revenue', () => {
      const shares = { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(0n, shares);
      
      expect(result.protocol).toBe(0n);
      expect(result.judge).toBe(0n);
      expect(result.creator).toBe(0n);
      expect(result.user).toBe(0n);
    });

    it('should handle very small amounts (rounding)', () => {
      const total = 100n; // 100 lamports
      const shares = { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(total, shares);
      
      // Protocol: 100 * 200 / 10000 = 2
      expect(result.protocol).toBe(2n);
      // Judge: 100 * 300 / 10000 = 3
      expect(result.judge).toBe(3n);
      // Remaining: 95, Creator: 95 * 500 / 10000 = 4 (floor)
      expect(result.creator).toBe(4n);
      // User gets remainder
      expect(result.protocol + result.judge + result.creator + result.user).toBe(total);
    });

    it('should give remainder to user', () => {
      const total = 999n; // Not evenly divisible
      const shares = { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 };
      
      const result = distributeRevenue(total, shares);
      
      // All adds up to total (user gets any remainder)
      expect(result.protocol + result.judge + result.creator + result.agent + result.user).toBe(total);
    });

    // ═══════════════════════════════════════════════════════════
    // Invariants
    // ═══════════════════════════════════════════════════════════

    it('should always have protocol = 2%', () => {
      for (const total of [100n, 1000n, 10000n, 1000000n]) {
        const shares = { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 };
        const result = distributeRevenue(total, shares);
        expect(result.protocol).toBe(total * 200n / 10000n);
      }
    });

    it('should always have judge = 3%', () => {
      for (const total of [100n, 1000n, 10000n, 1000000n]) {
        const shares = { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 };
        const result = distributeRevenue(total, shares);
        expect(result.judge).toBe(total * 300n / 10000n);
      }
    });
  });
});
```

---

## 2. 集成测试

### 2.1 Workflow Engine 集成 (`engine.integration.test.ts`)

```typescript
describe('WorkflowEngine Integration', () => {
  let engine: WorkflowEngine;
  let hub: GradienceChainHub;

  beforeAll(async () => {
    hub = await createTestChainHub('devnet');
    engine = new WorkflowEngine(hub);
  });

  describe('execute()', () => {
    it('should execute linear workflow end-to-end', async () => {
      const workflow = createTestWorkflow({
        steps: [
          { id: 'step1', name: 'Log Start', chain: 'solana', action: 'log', params: { message: 'start' } },
          { id: 'step2', name: 'Wait', chain: 'solana', action: 'wait', params: { ms: 100 } },
          { id: 'step3', name: 'Log End', chain: 'solana', action: 'log', params: { message: 'end' } }
        ]
      });

      const result = await engine.execute(workflow.id, {});

      expect(result.status).toBe('completed');
      expect(result.stepResults).toHaveLength(3);
      expect(result.stepResults.every(r => r.status === 'completed')).toBe(true);
    });

    it('should execute multi-chain workflow', async () => {
      const workflow = createTestWorkflow({
        steps: [
          { id: 'step1', name: 'Solana Log', chain: 'solana', action: 'log', params: {} },
          { id: 'step2', name: 'Arbitrum Log', chain: 'arbitrum', action: 'log', params: {} }
        ]
      });

      const result = await engine.execute(workflow.id, {});

      expect(result.status).toBe('completed');
      expect(result.stepResults[0].chain).toBe('solana');
      expect(result.stepResults[1].chain).toBe('arbitrum');
    });

    it('should handle step failure correctly', async () => {
      const workflow = createTestWorkflow({
        steps: [
          { id: 'step1', name: 'OK', chain: 'solana', action: 'log', params: {} },
          { id: 'step2', name: 'Fail', chain: 'solana', action: 'transfer', params: { amount: '999999999999' } },
          { id: 'step3', name: 'Never', chain: 'solana', action: 'log', params: {} }
        ]
      });

      const result = await engine.execute(workflow.id, {});

      expect(result.status).toBe('failed');
      expect(result.stepResults[0].status).toBe('completed');
      expect(result.stepResults[1].status).toBe('failed');
      expect(result.stepResults[2].status).toBe('pending');
    });

    it('should pass data between steps', async () => {
      const workflow = createTestWorkflow({
        steps: [
          { id: 'step1', name: 'Set', chain: 'solana', action: 'setVariable', params: { key: 'amount', value: 100 } },
          { id: 'step2', name: 'Use', chain: 'solana', action: 'log', params: { message: 'Amount: {{step1.output.amount}}' } }
        ]
      });

      const result = await engine.execute(workflow.id, {});

      expect(result.stepResults[1].output?.message).toContain('100');
    });
  });

  describe('simulate()', () => {
    it('should simulate without making real transactions', async () => {
      const workflow = createTestWorkflow({
        steps: [
          { id: 'step1', name: 'Transfer', chain: 'solana', action: 'transfer', params: { amount: '1000000000' } }
        ]
      });

      const balanceBefore = await hub.getBalance();
      const result = await engine.simulate(workflow, {});
      const balanceAfter = await hub.getBalance();

      expect(result.status).toBe('completed');
      expect(balanceBefore).toBe(balanceAfter); // No actual transfer
    });
  });
});
```

### 2.2 Solana Program 测试 (`program.test.ts`)

```typescript
describe('Workflow Marketplace Program', () => {
  let program: Program;
  let provider: AnchorProvider;
  let author: Keypair;
  let buyer: Keypair;

  beforeAll(async () => {
    // Setup using litesvm or bankrun
  });

  describe('create_workflow', () => {
    it('should create workflow metadata PDA', async () => {
      const contentHash = Buffer.alloc(64).fill(1);
      
      await program.methods
        .createWorkflow(contentHash, '1.0.0', 0, NATIVE_MINT, new BN(0), 500, true)
        .accounts({ author: author.publicKey })
        .signers([author])
        .rpc();

      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('workflow'), author.publicKey.toBuffer()],
        program.programId
      );

      const account = await program.account.workflowMetadata.fetch(pda);
      expect(account.author.toString()).toBe(author.publicKey.toString());
      expect(account.isPublic).toBe(true);
    });

    it('should reject invalid pricing model', async () => {
      await expect(
        program.methods
          .createWorkflow(Buffer.alloc(64), '1.0.0', 5, NATIVE_MINT, new BN(0), 0, true) // 5 is invalid
          .accounts({ author: author.publicKey })
          .signers([author])
          .rpc()
      ).rejects.toThrow();
    });
  });

  describe('purchase_workflow', () => {
    it('should create access PDA and transfer payment', async () => {
      // First create a workflow with price
      const workflowId = await createPaidWorkflow(author, 1_000_000_000); // 1 SOL
      
      const authorBalanceBefore = await provider.connection.getBalance(author.publicKey);
      
      await program.methods
        .purchaseWorkflow(workflowId)
        .accounts({ buyer: buyer.publicKey, author: author.publicKey })
        .signers([buyer])
        .rpc();

      // Check access PDA exists
      const [accessPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('access'), workflowId.toBuffer(), buyer.publicKey.toBuffer()],
        program.programId
      );
      const access = await program.account.workflowAccess.fetch(accessPda);
      expect(access.user.toString()).toBe(buyer.publicKey.toString());

      // Check payment (author gets 98%, protocol gets 2%)
      const authorBalanceAfter = await provider.connection.getBalance(author.publicKey);
      expect(authorBalanceAfter - authorBalanceBefore).toBe(980_000_000);
    });

    it('should increment total_purchases', async () => {
      const workflowId = await createPaidWorkflow(author, 1_000_000);
      
      const before = await getWorkflowMetadata(workflowId);
      await purchaseWorkflow(buyer, workflowId);
      const after = await getWorkflowMetadata(workflowId);

      expect(after.totalPurchases).toBe(before.totalPurchases + 1);
    });

    it('should reject if already purchased', async () => {
      const workflowId = await createPaidWorkflow(author, 1_000_000);
      await purchaseWorkflow(buyer, workflowId);

      await expect(purchaseWorkflow(buyer, workflowId)).rejects.toThrow();
    });
  });

  describe('review_workflow', () => {
    it('should create review and update avg_rating', async () => {
      const workflowId = await createAndPurchaseWorkflow(author, buyer);
      
      await program.methods
        .reviewWorkflow(5, Buffer.alloc(32).fill(0))
        .accounts({ reviewer: buyer.publicKey, workflowId })
        .signers([buyer])
        .rpc();

      const workflow = await getWorkflowMetadata(workflowId);
      expect(workflow.avgRating).toBe(10000); // 5/5 = 10000
    });

    it('should reject review without purchase', async () => {
      const workflowId = await createPaidWorkflow(author, 1_000_000);
      const nonBuyer = Keypair.generate();

      await expect(
        program.methods
          .reviewWorkflow(5, Buffer.alloc(32))
          .accounts({ reviewer: nonBuyer.publicKey, workflowId })
          .signers([nonBuyer])
          .rpc()
      ).rejects.toThrow();
    });

    it('should reject duplicate review', async () => {
      const workflowId = await createAndPurchaseWorkflow(author, buyer);
      await reviewWorkflow(buyer, workflowId, 5);

      await expect(reviewWorkflow(buyer, workflowId, 4)).rejects.toThrow();
    });
  });
});
```

---

## 3. E2E 测试

### 3.1 完整生命周期 (`e2e.test.ts`)

```typescript
describe('Workflow E2E', () => {
  let sdk: WorkflowEngineSDK;
  let author: Keypair;
  let user: Keypair;

  beforeAll(async () => {
    sdk = await createSDK('devnet');
    author = await createFundedKeypair();
    user = await createFundedKeypair();
  });

  it('should complete full lifecycle: create → purchase → execute → review', async () => {
    // 1. Author creates workflow
    const workflow: GradienceWorkflow = {
      id: '', // Will be assigned
      name: 'Test Arbitrage Workflow',
      description: 'A test workflow for E2E testing',
      author: author.publicKey.toString(),
      version: '1.0.0',
      steps: [
        { id: 'step1', name: 'Check Price A', chain: 'solana', action: 'httpRequest', params: { url: 'https://api.example.com/price/a' } },
        { id: 'step2', name: 'Check Price B', chain: 'solana', action: 'httpRequest', params: { url: 'https://api.example.com/price/b' } },
        { id: 'step3', name: 'Log Result', chain: 'solana', action: 'log', params: { message: 'Prices checked' } }
      ],
      pricing: { model: 'oneTime', oneTimePrice: { mint: NATIVE_MINT.toString(), amount: '100000000' } },
      revenueShare: { creator: 500, user: 9000, agent: 0, protocol: 200, judge: 300 },
      requirements: {},
      isPublic: true,
      isTemplate: false,
      tags: ['test', 'arbitrage'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      contentHash: '',
      signature: ''
    };

    const workflowId = await sdk.create(workflow);
    expect(workflowId).toBeTruthy();

    // 2. User purchases workflow
    const accessId = await sdk.purchase(workflowId);
    expect(accessId).toBeTruthy();

    // 3. User has access
    const hasAccess = await sdk.hasAccess(workflowId, user.publicKey.toString());
    expect(hasAccess).toBe(true);

    // 4. User executes workflow
    const result = await sdk.execute(workflowId, {});
    expect(result.status).toBe('completed');
    expect(result.stepResults).toHaveLength(3);

    // 5. User reviews workflow
    await sdk.review(workflowId, 5, 'Great workflow!');

    // 6. Verify review
    const workflowDetails = await sdk.get(workflowId);
    expect(workflowDetails.metadata.avgRating).toBeGreaterThan(0);
  }, 60000); // 60s timeout for E2E

  it('should handle multi-chain execution', async () => {
    const workflow = await createAndPurchaseWorkflow(author, user, {
      steps: [
        { id: 'step1', name: 'Solana', chain: 'solana', action: 'log', params: { message: 'solana' } },
        { id: 'step2', name: 'Arbitrum', chain: 'arbitrum', action: 'log', params: { message: 'arbitrum' } },
        { id: 'step3', name: 'Base', chain: 'base', action: 'log', params: { message: 'base' } }
      ]
    });

    const result = await sdk.execute(workflow.id, {});

    expect(result.status).toBe('completed');
    expect(result.stepResults.map(r => r.chain)).toEqual(['solana', 'arbitrum', 'base']);
  }, 60000);
});
```

---

## 4. 测试覆盖率目标

| 模块 | 目标覆盖率 | 重点 |
|------|-----------|------|
| Schema 验证 | ≥ 95% | 所有边界条件 |
| 模板解析 | ≥ 90% | 各种格式 |
| Step Executor | ≥ 90% | 超时、重试、条件 |
| Action Handlers | ≥ 80% | 主要路径 |
| 收益分配 | 100% | 精度、边界 |
| Solana Program | ≥ 90% | 所有指令 |
| **总体** | **≥ 85%** | |

---

## 5. 测试数据

### 5.1 有效 Workflow 模板

```typescript
function createValidWorkflow(overrides?: Partial<GradienceWorkflow>): GradienceWorkflow {
  return {
    id: 'test-workflow-' + Date.now(),
    name: 'Test Workflow',
    description: 'A valid test workflow',
    author: '5Y3dTfBzfV9CmqRWBGGHWNNZJTVPEEZJaYqKLwFKVmPP',
    version: '1.0.0',
    steps: [
      { id: 'step1', name: 'Step 1', chain: 'solana', action: 'log', params: { message: 'hello' } }
    ],
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
    ...overrides
  };
}
```

### 5.2 示例 Workflow

```typescript
// 跨链套利示例
const arbitrageWorkflow = createValidWorkflow({
  name: 'Cross-chain USDC Arbitrage',
  steps: [
    { id: 'price1', name: 'Get Solana USDC Price', chain: 'solana', action: 'httpRequest', params: { url: '...' } },
    { id: 'price2', name: 'Get Arbitrum USDC Price', chain: 'arbitrum', action: 'httpRequest', params: { url: '...' } },
    { id: 'check', name: 'Check Spread', chain: 'solana', action: 'condition', params: { expression: '{{price1.output.price}} > {{price2.output.price}} * 1.01' } },
    { id: 'buy', name: 'Buy on Arbitrum', chain: 'arbitrum', action: 'swap', params: { from: 'USDT', to: 'USDC', amount: '1000' } },
    { id: 'bridge', name: 'Bridge to Solana', chain: 'arbitrum', action: 'bridge', params: { toChain: 'solana', token: 'USDC' } },
    { id: 'sell', name: 'Sell on Solana', chain: 'solana', action: 'swap', params: { from: 'USDC', to: 'USDT' } }
  ]
});
```

---

## ✅ Phase 5 验收标准

- [x] 单元测试用例定义完整 (Schema, Parser, Executor, Revenue)
- [x] 集成测试用例定义 (Engine, Program)
- [x] E2E 测试用例定义 (完整生命周期)
- [x] 覆盖率目标设定 (≥85%)
- [x] 测试数据准备 (有效/无效 Workflow)
- [x] Happy path + Boundary + Error cases 覆盖

**验收通过后，进入 Phase 6: Implementation →**
