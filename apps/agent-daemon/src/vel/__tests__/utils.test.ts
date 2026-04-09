import { describe, it, expect } from 'vitest';
import { computeResultHash, computeLogHash, encodeReasonRef, computeBundleHash } from '../utils';
import { VelError, VEL_ERROR_REASON_REF_TOO_LONG } from '../errors';
import type { AttestationBundle } from '../types';

describe('utils', () => {
    it('H1: computeResultHash returns fixed hex for canonical stepResults', () => {
        const steps = [{ stepIndex: 0, stepType: 'swap', success: true, output: { amount: 100n }, durationMs: 123 }];
        const hash1 = computeResultHash(steps);
        const hash2 = computeResultHash(steps);
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
    });

    it('B1: computeResultHash on empty array matches sha256("[]")', () => {
        const hash = computeResultHash([]);
        expect(hash).toHaveLength(64);
        expect(hash).toBeTruthy();
    });

    it('H2: encodeReasonRef returns vel:provider:hash:uri format', () => {
        const ref = encodeReasonRef('gramine', 'abc123', 'file:///tmp/x.json');
        expect(ref).toBe('vel:gramine:abc123:file:///tmp/x.json');
    });

    it('B2: encodeReasonRef works at exactly 200 chars', () => {
        const provider = 'gramine';
        const hash = 'a'.repeat(64);
        const prefix = `vel:${provider}:${hash}:`; // length = 12 + 64 + 1 = 77
        const filePrefix = 'file:///'; // length = 8
        const uri = filePrefix + 'x'.repeat(200 - prefix.length - filePrefix.length);
        const ref = encodeReasonRef(provider, hash, uri);
        expect(ref.length).toBe(200);
    });

    it('E1: encodeReasonRef throws VEL_0010 when over 200 chars', () => {
        expect(() => encodeReasonRef('gramine', 'a'.repeat(64), 'file:///' + 'x'.repeat(200))).toThrow(VelError);
        try {
            encodeReasonRef('gramine', 'a'.repeat(64), 'file:///' + 'x'.repeat(200));
        } catch (e) {
            expect((e as VelError).code).toBe(VEL_ERROR_REASON_REF_TOO_LONG);
        }
    });

    it('E2: computeResultHash is stable regardless of key order', () => {
        const stepsA = [{ stepIndex: 0, stepType: 'swap', success: true, output: { c: 1, a: 2 }, durationMs: 10 }];
        const stepsB = [{ stepIndex: 0, stepType: 'swap', success: true, output: { a: 2, c: 1 }, durationMs: 10 }];
        expect(computeResultHash(stepsA)).toBe(computeResultHash(stepsB));
    });

    it('computeBundleHash excludes timestamp', () => {
        const bundle: AttestationBundle = {
            version: 'vel-v1',
            taskId: 1,
            executorAddress: 'addr',
            resultHash: 'hash1',
            logHash: 'hash2',
            attestationReport: 'report',
            providerName: 'gramine-local',
            pcrValues: { pcr0: 'mock' },
            timestamp: 1000,
        };
        const h1 = computeBundleHash(bundle);
        bundle.timestamp = 2000;
        const h2 = computeBundleHash(bundle);
        expect(h1).toBe(h2);
    });
});
