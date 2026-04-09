import { describe, it, expect, vi } from 'vitest';
import { DefaultVelOrchestrator } from '../orchestrator';
import { VelError, VEL_ERROR_BRIDGE_SETTLEMENT_FAILED } from '../errors';
import type {
    TeeExecutionEngine,
    VelOrchestratorConfig,
    TeeExecutionResult,
    AttestationBundle,
    VerificationReport,
} from '../types';

describe('VelOrchestrator', () => {
    function createMockEngine(result: Partial<TeeExecutionResult> = {}): TeeExecutionEngine {
        return {
            execute: vi.fn().mockResolvedValue({
                success: true,
                stepResults: [],
                summary: 'ok',
                logHash: 'loghash',
                resultHash: 'resulthash',
                attestationReport: Buffer.from(
                    JSON.stringify({
                        pcr0: 'mock-pcr-allowed',
                        userDataHash: 'resulthashloghash',
                        signerIdentity: 'mock',
                    }),
                ).toString('base64'),
                executedAt: Date.now(),
                ...result,
            } as TeeExecutionResult),
            verifyAttestation: vi.fn().mockResolvedValue({
                valid: true,
                pcrValues: { pcr0: 'mock-pcr-allowed' },
                signerIdentity: 'mock',
            } as VerificationReport),
        };
    }

    function createConfig(overrides: Partial<VelOrchestratorConfig> = {}): VelOrchestratorConfig {
        return {
            bridge: {
                judgeAndPay: vi.fn().mockResolvedValue('mock-tx-sig'),
            },
            keyManager: {
                getSeedForTask: vi.fn().mockResolvedValue(new Uint8Array(32)),
            },
            storage: {
                upload: vi.fn().mockResolvedValue('file:///tmp/vel/1.json'),
            },
            defaultProvider: 'gramine-local',
            ...overrides,
        };
    }

    it('H6: runAndSettle returns tx signature through mock bridge', async () => {
        const engine = createMockEngine();
        const verifier = {
            verify: vi
                .fn()
                .mockResolvedValue({ valid: true, pcrValues: { pcr0: 'mock-pcr-allowed' } } as VerificationReport),
        };
        const config = createConfig();
        const orchestrator = new DefaultVelOrchestrator(engine, verifier as any, config);

        const txSig = await orchestrator.runAndSettle({
            workflowId: 'wf-1',
            workflowDefinition: { version: '1.0', name: 'w', steps: [] },
            inputs: {},
            taskId: 1,
            executorAddress: 'So11111111111111111111111111111111111111112',
            timeoutMs: 5000,
        });

        expect(txSig).toBe('mock-tx-sig');
        expect(config.bridge.judgeAndPay).toHaveBeenCalledWith(
            expect.objectContaining({
                taskId: 1,
                winner: 'So11111111111111111111111111111111111111112',
                score: 100,
                reasonRef: expect.stringContaining('vel:gramine-local:'),
            }),
        );
    });

    it('E9: throws VEL_0007 when bridge settlement fails', async () => {
        const engine = createMockEngine();
        const verifier = { verify: vi.fn().mockResolvedValue({ valid: true } as VerificationReport) };
        const config = createConfig({
            bridge: {
                judgeAndPay: vi.fn().mockRejectedValue(new Error('Simulated settlement failure')),
            },
        });
        const orchestrator = new DefaultVelOrchestrator(engine, verifier as any, config);

        await expect(
            orchestrator.runAndSettle({
                workflowId: 'wf-1',
                workflowDefinition: { version: '1.0', name: 'w', steps: [] },
                inputs: {},
                taskId: 1,
                executorAddress: 'So11111111111111111111111111111111111111112',
                timeoutMs: 5000,
            }),
        ).rejects.toThrow(VelError);
        try {
            await orchestrator.runAndSettle({
                workflowId: 'wf-1',
                workflowDefinition: { version: '1.0', name: 'w', steps: [] },
                inputs: {},
                taskId: 1,
                executorAddress: 'So11111111111111111111111111111111111111112',
                timeoutMs: 5000,
            });
        } catch (e) {
            expect((e as import('../errors').VelError).code).toBe(VEL_ERROR_BRIDGE_SETTLEMENT_FAILED);
        }
    });

    it('throws when TEE execution returns failure', async () => {
        const engine = createMockEngine({ success: false, summary: 'step failed' });
        const verifier = { verify: vi.fn() };
        const config = createConfig();
        const orchestrator = new DefaultVelOrchestrator(engine, verifier as any, config);

        await expect(
            orchestrator.runAndSettle({
                workflowId: 'wf-1',
                workflowDefinition: { version: '1.0', name: 'w', steps: [] },
                inputs: {},
                taskId: 1,
                executorAddress: 'addr',
                timeoutMs: 5000,
            }),
        ).rejects.toThrow('Workflow execution failed in TEE');
    });

    it('throws when attestation verification fails', async () => {
        const engine = createMockEngine();
        const verifier = {
            verify: vi.fn().mockResolvedValue({ valid: false, reason: 'PC tampered' } as VerificationReport),
        };
        const config = createConfig();
        const orchestrator = new DefaultVelOrchestrator(engine, verifier as any, config);

        await expect(
            orchestrator.runAndSettle({
                workflowId: 'wf-1',
                workflowDefinition: { version: '1.0', name: 'w', steps: [] },
                inputs: {},
                taskId: 1,
                executorAddress: 'addr',
                timeoutMs: 5000,
            }),
        ).rejects.toThrow(VelError);
        try {
            await orchestrator.runAndSettle({
                workflowId: 'wf-1',
                workflowDefinition: { version: '1.0', name: 'w', steps: [] },
                inputs: {},
                taskId: 1,
                executorAddress: 'addr',
                timeoutMs: 5000,
            });
        } catch (e) {
            expect((e as import('../errors').VelError).code).toBe('VEL_0004');
        }
    });
});
