/**
 * Attestation Verifier
 *
 * For mock mode, delegates to provider-specific verifier.
 * Future: add generic SGX/Nitro quote signature verification.
 */

import { AttestationBundle, VerificationReport } from './types.js';
import type { TeeProvider } from './providers/base-provider.js';

export class AttestationVerifier {
    constructor(private readonly provider: TeeProvider) {}

    async verify(bundle: AttestationBundle): Promise<VerificationReport> {
        return this.provider.verifyAttestation(bundle);
    }
}
