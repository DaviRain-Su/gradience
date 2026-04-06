/**
 * Nitro Stub Provider
 *
 * Placeholder for AWS Nitro Enclave integration.
 */

import type {
  TeeProviderConfig,
  EnclavePayload,
  EnclaveResponse,
  AttestationBundle,
  VerificationReport,
} from '../types.js';
import { VelError, VEL_ERROR_UNSUPPORTED_PROVIDER } from '../errors.js';
import { TeeProvider } from './base-provider.js';

export class NitroStubProvider implements TeeProvider {
  readonly name = 'nitro-local';

  async initialize(_config: TeeProviderConfig): Promise<void> {
    // no-op for stub
  }

  async executeInEnclave(_payload: EnclavePayload, _timeoutMs?: number): Promise<EnclaveResponse> {
    throw new VelError(
      VEL_ERROR_UNSUPPORTED_PROVIDER,
      'Nitro provider is a stub and not yet implemented. Use "gramine-local" for now.'
    );
  }

  async verifyAttestation(_bundle: AttestationBundle): Promise<VerificationReport> {
    throw new VelError(
      VEL_ERROR_UNSUPPORTED_PROVIDER,
      'Nitro provider is a stub and not yet implemented. Use "gramine-local" for now.'
    );
  }

  async terminate(): Promise<void> {
    // no-op
  }
}
