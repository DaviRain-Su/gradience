/**
 * Verifiable Execution Layer (VEL) — Error Definitions
 */

export class VelError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'VelError';
  }
}

// ------------------------------------------------------------------
// Execution Errors
// ------------------------------------------------------------------

export const VEL_ERROR_EXECUTION_TIMEOUT = 'VEL_0001';
export const VEL_ERROR_ENCLAVE_CRASH = 'VEL_0002';

// ------------------------------------------------------------------
// Attestation Errors
// ------------------------------------------------------------------

export const VEL_ERROR_INVALID_ATTESTATION_FORMAT = 'VEL_0003';
export const VEL_ERROR_ATTESTATION_VERIFICATION_FAILED = 'VEL_0004';
export const VEL_ERROR_PC_MISMATCH = 'VEL_0005';
export const VEL_ERROR_BUNDLE_HASH_MISMATCH = 'VEL_0006';

// ------------------------------------------------------------------
// Settlement Errors
// ------------------------------------------------------------------

export const VEL_ERROR_BRIDGE_SETTLEMENT_FAILED = 'VEL_0007';

// ------------------------------------------------------------------
// Configuration / Provider Errors
// ------------------------------------------------------------------

export const VEL_ERROR_UNSUPPORTED_PROVIDER = 'VEL_0008';
export const VEL_ERROR_SEED_DERIVATION_FAILED = 'VEL_0009';
export const VEL_ERROR_REASON_REF_TOO_LONG = 'VEL_0010';
