/**
 * Verifiable Execution Layer (VEL) — Utilities
 */

import { createHash } from 'node:crypto';
import { AttestationBundle, MAX_REASON_REF_LENGTH, PROOF_PAYLOAD_VERSION, StepResult, VEL_VERSION } from './types.js';
import { VelError, VEL_ERROR_REASON_REF_TOO_LONG } from './errors.js';

function canonicalize(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'bigint') return value.toString();
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (value instanceof Uint8Array) {
        return Array.from(value);
    }
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return sorted;
}

export function computeResultHash(stepResults: StepResult[]): string {
    const canonical = JSON.stringify(canonicalize(stepResults));
    return createHash('sha256').update(canonical).digest('hex');
}

export function computeLogHash(logs: string[]): string {
    const canonical = logs.join('\n');
    return createHash('sha256').update(canonical).digest('hex');
}

export function computeBundleHash(bundle: AttestationBundle): string {
    const { timestamp, ...canonicalBundle } = bundle;
    const json = JSON.stringify(canonicalBundle, Object.keys(canonicalBundle).sort());
    return createHash('sha256').update(json).digest('hex');
}

export function encodeReasonRef(providerName: string, bundleHash: string, storageUri: string): string {
    const ref = `vel:${providerName}:${bundleHash}:${storageUri}`;
    if (ref.length > MAX_REASON_REF_LENGTH) {
        throw new VelError(
            VEL_ERROR_REASON_REF_TOO_LONG,
            `Encoded reason ref exceeds ${MAX_REASON_REF_LENGTH} chars (${ref.length})`,
        );
    }
    return ref;
}

export function buildProofPayload(
    bundle: AttestationBundle,
    storageUri: string,
): {
    proofBytes: Uint8Array;
    reasonRef: string;
} {
    const bundleHash = computeBundleHash(bundle);
    const reasonRef = encodeReasonRef(bundle.providerName, bundleHash, storageUri);

    const encoder = new TextEncoder();
    const version = PROOF_PAYLOAD_VERSION;
    const hashBytes = encoder.encode(bundleHash);
    const refBytes = encoder.encode(reasonRef);

    const proofBytes = new Uint8Array(1 + hashBytes.length + refBytes.length);
    proofBytes[0] = version;
    proofBytes.set(hashBytes, 1);
    proofBytes.set(refBytes, 1 + hashBytes.length);

    return { proofBytes, reasonRef };
}

export function normalizeTimeoutMs(value: number | undefined): number {
    if (!value || value <= 0) return 300_000;
    return value;
}
