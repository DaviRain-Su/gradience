import { describe, it, expect, vi } from 'vitest';
import { DefaultVelOrchestrator } from '../orchestrator';
import { DefaultTeeExecutionEngine } from '../tee-execution-engine';
import { AttestationVerifier } from '../attestation-verifier';
import { GramineLocalProvider } from '../providers/gramine-local-provider';
import { VelError, VEL_ERROR_EXECUTION_TIMEOUT, VEL_ERROR_BUNDLE_HASH_MISMATCH } from '../errors';
import type { VelOrchestratorConfig, VerificationReport } from '../types';

describe('VEL Integration', () => {
    function createConfig(overrides: Partial<VelOrchestratorConfig> = {}): VelOrchestratorConfig {
        return {
            bridge: {
                judgeAndPay: vi.fn().mockResolvedValue('mock-tx-sig'),
            },
            keyManager: {
                getSeedForTask: vi.fn().mockResolvedValue(new Uint8Array(32)),
            },
            storage: {
                upload: vi.fn().mockResolvedValue('file:///tmp/vel/integration.json'),
            },
            defaultProvider: 'gramine-local',
            ...overrides,
        };
    }

    it('I1: full happy path with mock provider', async () => {
        const provider = new GramineLocalProvider();
        await provider.initialize({
            providerName: 'gramine-local',
            socketPath: '/tmp/mock.sock',
            allowedPcrValues: ['mock-pcr-allowed'],
        });

        const engine = new DefaultTeeExecutionEngine(provider);
        const verifier = new AttestationVerifier(provider);
        const config = createConfig();
        const orchestrator = new DefaultVelOrchestrator(engine, verifier, config);

        const txSig = await orchestrator.runAndSettle({
            workflowId: 'wf-integration',
            workflowDefinition: {
                version: '1.0',
                name: 'integration-workflow',
                steps: [{ type: 'swap', params: { inputMint: 'A', outputMint: 'B', amount: 100n } }],
            },
            inputs: {},
            taskId: 999,
            executorAddress: 'So11111111111111111111111111111111111111112',
            timeoutMs: 10_000,
        });

        expect(txSig).toBe('mock-tx-sig');
        await provider.terminate();
    }, 15_000);

    it('I2: provider cleans up after timeout', async () => {
        const provider = new GramineLocalProvider();
        await provider.initialize({
            providerName: 'gramine-local',
            socketPath: '/tmp/mock.sock',
            allowedPcrValues: ['mock-pcr-allowed'],
        });

        const engine = new DefaultTeeExecutionEngine(provider);
        const verifier = new AttestationVerifier(provider);
        const config = createConfig();
        const orchestrator = new DefaultVelOrchestrator(engine, verifier, config);

        await expect(
            orchestrator.runAndSettle({
                workflowId: 'wf-timeout',
                workflowDefinition: { version: '1.0', name: 'to', steps: [] },
                inputs: {},
                taskId: 998,
                executorAddress: 'addr',
                timeoutMs: 1,
            }),
        ).rejects.toThrow(VelError);

        await provider.terminate();
    }, 10_000);

    it('I3: verification fails when result is tampered post-execution', async () => {
        const provider = new GramineLocalProvider();
        await provider.initialize({
            providerName: 'gramine-local',
            socketPath: '/tmp/mock.sock',
            allowedPcrValues: ['mock-pcr-allowed'],
        });

        const engine = new DefaultTeeExecutionEngine(provider);
        // We create a tampering verifier wrapper
        const realVerifier = new AttestationVerifier(provider);
        const tamperingVerifier = {
            verify: vi.fn(async (bundle) => {
                // Tamper the bundle before verifying
                bundle.resultHash = 'tampered-hash';
                return realVerifier.verify(bundle);
            }),
        };

        const config = createConfig();
        const orchestrator = new DefaultVelOrchestrator(engine, tamperingVerifier as any, config);

        await expect(
            orchestrator.runAndSettle({
                workflowId: 'wf-tamper',
                workflowDefinition: {
                    version: '1.0',
                    name: 'tp',
                    steps: [{ type: 'tool_call', params: { toolName: 't', arguments: {} } }],
                },
                inputs: {},
                taskId: 997,
                executorAddress: 'addr',
                timeoutMs: 10_000,
            }),
        ).rejects.toThrow(VEL_ERROR_BUNDLE_HASH_MISMATCH);

        await provider.terminate();
    }, 15_000);
});
