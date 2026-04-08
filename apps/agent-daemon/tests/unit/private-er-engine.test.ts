import { describe, it, expect, vi } from 'vitest';
import { PrivateEREngine } from '../../src/settlement/private-er-engine.js';

describe('PrivateEREngine', () => {
  function createEngine(): PrivateEREngine {
    return new PrivateEREngine({
      bridge: {
        judgeAndPay: vi.fn().mockResolvedValue('mock-tx-sig'),
      },
      storage: {
        upload: vi.fn().mockResolvedValue('file:///tmp/vel/per-judge.json'),
      },
    });
  }

  it('should pick a winner from sealed submissions in the mock TEE', async () => {
    const engine = createEngine();
    await engine.initialize();

    const result = await engine.judgeInPrivateSession({
      taskId: 42,
      submissions: [
        { agentId: 'agent-a', encryptedPayload: 'a'.repeat(50), commitment: '0x1' },
        { agentId: 'agent-b', encryptedPayload: 'b'.repeat(90), commitment: '0x2' },
        { agentId: 'agent-c', encryptedPayload: 'c'.repeat(30), commitment: '0x3' },
      ],
      criteria: { quality: 0.5 },
    });

    expect(result.winnerAgentId).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.attestationReport).toBeTruthy();
    expect(result.bundleHash).toHaveLength(64);
    expect(result.storageUri).toBe('file:///tmp/vel/per-judge.json');
  }, 15_000);

  it('should throw when there are no submissions', async () => {
    const engine = createEngine();
    await engine.initialize();

    await expect(
      engine.judgeInPrivateSession({
        taskId: 43,
        submissions: [],
        criteria: {},
      })
    ).rejects.toThrow('Private judge execution failed');
  }, 15_000);

  it('should settle on-chain after judging', async () => {
    const engine = createEngine();
    await engine.initialize();

    const { txSig, result } = await engine.judgeAndSettle({
      taskId: 44,
      submissions: [
        { agentId: 'agent-x', encryptedPayload: 'x'.repeat(100), commitment: '0x4' },
      ],
      criteria: {},
    });

    expect(txSig).toBe('mock-tx-sig');
    expect(result.winnerAgentId).toBe('agent-x');
  }, 15_000);
});
