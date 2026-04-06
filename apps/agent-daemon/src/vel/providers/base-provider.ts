/**
 * Base TeeProvider — shared utilities for enclave communication
 */

import { createHash } from 'node:crypto';
import type {
  TeeProviderConfig,
  EnclavePayload,
  EnclaveResponse,
  AttestationBundle,
  VerificationReport,
} from '../types.js';
import { VelError, VEL_ERROR_INVALID_ATTESTATION_FORMAT, VEL_ERROR_BUNDLE_HASH_MISMATCH } from '../errors.js';

export interface TeeProvider {
  readonly name: string;
  initialize(config: TeeProviderConfig): Promise<void>;
  executeInEnclave(payload: EnclavePayload, timeoutMs?: number): Promise<EnclaveResponse>;
  verifyAttestation(bundle: AttestationBundle): Promise<VerificationReport>;
  terminate(): Promise<void>;
}

export function serializePayload(payload: EnclavePayload): string {
  return JSON.stringify(payload, (key, value) => {
    if (value instanceof Uint8Array) {
      return { __type: 'Uint8Array', data: Array.from(value) };
    }
    if (typeof value === 'bigint') {
      return { __type: 'bigint', value: value.toString() };
    }
    return value;
  });
}

export function deserializePayload(json: string): EnclavePayload {
  return JSON.parse(json, (key, value) => {
    if (value && value.__type === 'Uint8Array') {
      return new Uint8Array(value.data);
    }
    if (value && value.__type === 'bigint') {
      return BigInt(value.value);
    }
    return value;
  }) as EnclavePayload;
}

export function deserializeEnclaveResponse(json: string): EnclaveResponse {
  return JSON.parse(json) as EnclaveResponse;
}

export function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function decodeBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export function deriveKeypairFromSeed(seed: Uint8Array): { publicKey: string; secretKey: Uint8Array } {
  // Simple deterministic derivation for mock/demo purposes.
  // In real TEE, this should use Ed25519 keygen from secure entropy inside enclave.
  const hash = createHash('sha256').update(seed).digest();
  // Pad to 64 bytes for ed25519 secret key (mock does not do real crypto)
  const secretKey = new Uint8Array(64);
  secretKey.set(hash);
  const publicKey = createHash('sha256').update(secretKey).digest('hex').slice(0, 64);
  return { publicKey, secretKey };
}

export function validateBundleIntegrity(bundle: AttestationBundle): void {
  if (bundle.version !== 'vel-v1') {
    throw new VelError(VEL_ERROR_INVALID_ATTESTATION_FORMAT, `Unsupported bundle version: ${bundle.version}`);
  }
  if (!bundle.attestationReport || bundle.attestationReport.length === 0) {
    throw new VelError(VEL_ERROR_INVALID_ATTESTATION_FORMAT, 'Missing attestationReport');
  }
}

export function checkResultHashMatch(bundle: AttestationBundle, computedResultHash: string): void {
  // For mock verification we recompute the expected resultHash from the embedded stepResults.
  // In real TEE verification, the attestation's user-data field contains the resultHash binding.
  if (bundle.resultHash !== computedResultHash) {
    throw new VelError(
      VEL_ERROR_BUNDLE_HASH_MISMATCH,
      `resultHash mismatch: bundle=${bundle.resultHash}, computed=${computedResultHash}`
    );
  }
}
