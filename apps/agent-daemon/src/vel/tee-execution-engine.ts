/**
 * TeeExecutionEngine abstraction + factory
 */

import {
  TeeExecutionEngine,
  TeeExecutionRequest,
  TeeExecutionResult,
  AttestationBundle,
  VerificationReport,
} from './types.js';
import { VelError, VEL_ERROR_UNSUPPORTED_PROVIDER } from './errors.js';
import { TeeProvider } from './providers/base-provider.js';
import { GramineLocalProvider } from './providers/gramine-local-provider.js';
import { NitroStubProvider } from './providers/nitro-stub-provider.js';

export { TeeProvider };

export class TeeProviderFactory {
  static create(providerName: string): TeeProvider {
    switch (providerName) {
      case 'gramine-local':
        return new GramineLocalProvider();
      case 'nitro-local':
        return new NitroStubProvider();
      default:
        throw new VelError(
          VEL_ERROR_UNSUPPORTED_PROVIDER,
          `Unsupported TEE provider: ${providerName}`
        );
    }
  }
}

export class DefaultTeeExecutionEngine implements TeeExecutionEngine {
  constructor(private readonly provider: TeeProvider) {}

  async execute(request: TeeExecutionRequest): Promise<TeeExecutionResult> {
    // Provider handles enclave communication internally
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const payload = {
      workflowDefinition: request.workflowDefinition,
      inputs: request.inputs,
      seed,
      taskId: request.taskId,
    };

    const response = await this.provider.executeInEnclave(payload, request.timeoutMs);

    return {
      success: response.success,
      stepResults: response.stepResults,
      summary: response.summary,
      logHash: response.logHash,
      resultHash: response.resultHash,
      attestationReport: response.attestationReport,
      executedAt: Date.now(),
    };
  }

  async verifyAttestation(bundle: AttestationBundle): Promise<VerificationReport> {
    // Delegated to provider-specific verifier
    return this.provider.verifyAttestation(bundle);
  }
}
