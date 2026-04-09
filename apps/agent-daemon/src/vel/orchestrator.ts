/**
 * VelOrchestrator
 *
 * Orchestrates the full VEL workflow: execute in TEE → verify → build proof → settle on-chain.
 */

import {
    TeeExecutionRequest,
    TeeExecutionResult,
    AttestationBundle,
    VelOrchestratorConfig,
    VEL_VERSION,
    TeeExecutionEngine,
} from './types.js';
import { VelError, VEL_ERROR_BRIDGE_SETTLEMENT_FAILED, VEL_ERROR_BUNDLE_HASH_MISMATCH } from './errors.js';
import { computeBundleHash, buildProofPayload, normalizeTimeoutMs } from './utils.js';
import { AttestationVerifier } from './attestation-verifier.js';

export class DefaultVelOrchestrator {
    constructor(
        private readonly engine: TeeExecutionEngine,
        private readonly verifier: AttestationVerifier,
        private readonly config: VelOrchestratorConfig,
    ) {}

    async runAndSettle(request: TeeExecutionRequest): Promise<string> {
        const { workflowId, taskId, executorAddress, workflowDefinition, inputs } = request;
        const timeoutMs = normalizeTimeoutMs(request.timeoutMs);

        // 1. Execute workflow inside TEE
        const execResult = await this.engine.execute({
            workflowId,
            workflowDefinition,
            inputs,
            taskId,
            executorAddress,
            timeoutMs,
        });

        if (!execResult.success) {
            throw new Error(`Workflow execution failed in TEE: ${execResult.summary}`);
        }

        // 2. Build AttestationBundle
        const bundle: AttestationBundle = {
            version: VEL_VERSION,
            taskId,
            executorAddress,
            resultHash: execResult.resultHash,
            logHash: execResult.logHash,
            attestationReport: execResult.attestationReport,
            providerName: this.config.defaultProvider,
            pcrValues: { pcr0: 'mock-pcr-allowed' }, // populated from verifier later if available
            timestamp: Date.now(),
        };

        // 3. Verify attestation
        const report = await this.verifier.verify(bundle);
        if (!report.valid) {
            throw new VelError('VEL_0004', `Attestation verification failed: ${report.reason}`);
        }

        // Update bundle with real PCR values from report
        if (report.pcrValues) {
            bundle.pcrValues = report.pcrValues;
        }

        // Recompute bundleHash after PCR values are finalized
        const computedBundleHash = computeBundleHash(bundle);

        // 4. Upload bundle to storage (local file / IPFS / etc.)
        let storageUri: string;
        try {
            storageUri = await this.config.storage.upload(bundle);
        } catch (err) {
            throw new VelError(
                VEL_ERROR_BRIDGE_SETTLEMENT_FAILED,
                `Failed to upload attestation bundle: ${err instanceof Error ? err.message : String(err)}`,
                err,
            );
        }

        // 5. Build proof payload
        const { reasonRef } = buildProofPayload(bundle, storageUri);

        // 6. On-chain settlement via bridge
        try {
            const txSig = await this.config.bridge.judgeAndPay({
                taskId,
                winner: executorAddress,
                score: 100, // TEE execution gets max score if attestation passes
                reasonRef,
            });
            return txSig;
        } catch (err) {
            throw new VelError(
                VEL_ERROR_BRIDGE_SETTLEMENT_FAILED,
                `On-chain settlement failed: ${err instanceof Error ? err.message : String(err)}`,
                err,
            );
        }
    }
}
