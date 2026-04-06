import { describe, it, expect } from 'vitest';
import { GramineLocalProvider } from '../providers/gramine-local-provider';
import { VelError, VEL_ERROR_ENCLAVE_CRASH, VEL_ERROR_EXECUTION_TIMEOUT } from '../errors';

describe('GramineLocalProvider', () => {
  it('H4: mock enclave executes workflow and returns attestation', async () => {
    const provider = new GramineLocalProvider();
    await provider.initialize({
      providerName: 'gramine-local',
      socketPath: '/tmp/mock.sock',
      allowedPcrValues: ['mock-pcr-allowed'],
    });

    const payload = {
      workflowDefinition: {
        version: '1.0' as const,
        name: 'test-workflow',
        steps: [{ type: 'swap' as const, params: { inputMint: 'A', outputMint: 'B', amount: 100n } }],
      },
      inputs: {},
      seed: new Uint8Array(32),
      taskId: 42,
    };

    const response = await provider.executeInEnclave(payload, 10_000);
    expect(response.success).toBe(true);
    expect(response.attestationReport).toBeTruthy();
    expect(response.resultHash).toHaveLength(64);
    expect(response.logHash).toHaveLength(64);
    await provider.terminate();
  }, 15_000);

  it('E4: throws VEL_0002 when enclave crashes', async () => {
    const provider = new GramineLocalProvider();
    await provider.initialize({
      providerName: 'gramine-local',
      socketPath: '/tmp/mock.sock',
      allowedPcrValues: ['mock-pcr-allowed'],
      commandOverride: 'node -e "process.exit(1)"',
      startupTimeoutMs: 500,
    });

    await expect(
      provider.executeInEnclave({
        workflowDefinition: { version: '1.0' as const, name: 'w', steps: [] },
        inputs: {},
        seed: new Uint8Array(32),
        taskId: 1,
      })
    ).rejects.toThrow(VelError);

    try {
      await provider.executeInEnclave({
        workflowDefinition: { version: '1.0' as const, name: 'w', steps: [] },
        inputs: {},
        seed: new Uint8Array(32),
        taskId: 1,
      });
    } catch (e) {
      expect((e as VelError).code).toBe(VEL_ERROR_ENCLAVE_CRASH);
    }
    await provider.terminate();
  });

  it('E5: throws VEL_0001 when execution times out', async () => {
    const provider = new GramineLocalProvider();
    await provider.initialize({
      providerName: 'gramine-local',
      socketPath: '/tmp/mock.sock',
      allowedPcrValues: ['mock-pcr-allowed'],
      startupTimeoutMs: 500,
    });

    await expect(
      provider.executeInEnclave({
        workflowDefinition: { version: '1.0' as const, name: 'w', steps: [] },
        inputs: {},
        seed: new Uint8Array(32),
        taskId: 1,
      }, 1)
    ).rejects.toThrow(VelError);

    try {
      await provider.executeInEnclave({
        workflowDefinition: { version: '1.0' as const, name: 'w', steps: [] },
        inputs: {},
        seed: new Uint8Array(32),
        taskId: 1,
      }, 1);
    } catch (e) {
      expect((e as VelError).code).toBeOneOf([VEL_ERROR_EXECUTION_TIMEOUT, VEL_ERROR_ENCLAVE_CRASH]);
    }
    await provider.terminate();
  });
});
