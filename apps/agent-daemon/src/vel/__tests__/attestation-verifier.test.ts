import { describe, it, expect } from 'vitest';
import { AttestationVerifier } from '../attestation-verifier';
import { GramineLocalProvider } from '../providers/gramine-local-provider';
import type { AttestationBundle } from '../types';

describe('AttestationVerifier', () => {
  let provider: GramineLocalProvider;
  let verifier: AttestationVerifier;

  beforeEach(async () => {
    provider = new GramineLocalProvider();
    await provider.initialize({
      providerName: 'gramine-local',
      socketPath: '/tmp/mock.sock',
      allowedPcrValues: ['mock-pcr-allowed'],
    });
    verifier = new AttestationVerifier(provider);
  });

  afterEach(async () => {
    await provider.terminate();
  });

  function buildReport(pcr0: string, userDataHash: string): string {
    const obj = { pcr0, userDataHash, signerIdentity: 'mock-gramine-enclave', timestamp: Date.now() };
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  it('H5: verifies valid mock Gramine quote', async () => {
    const bundle: AttestationBundle = {
      version: 'vel-v1',
      taskId: 1,
      executorAddress: 'addr',
      resultHash: 'rh',
      logHash: 'lh',
      attestationReport: buildReport('mock-pcr-allowed', 'rhlh'),
      providerName: 'gramine-local',
      pcrValues: {},
      timestamp: Date.now(),
    };
    const report = await verifier.verify(bundle);
    expect(report.valid).toBe(true);
    expect(report.signerIdentity).toBe('mock-gramine-enclave');
  });

  it('E6: returns invalid when attestation report is tampered', async () => {
    const bundle: AttestationBundle = {
      version: 'vel-v1',
      taskId: 1,
      executorAddress: 'addr',
      resultHash: 'rh',
      logHash: 'lh',
      attestationReport: 'invalid-base64!!!',
      providerName: 'gramine-local',
      pcrValues: {},
      timestamp: Date.now(),
    };
    const report = await verifier.verify(bundle);
    expect(report.valid).toBe(false);
    expect(report.reason).toContain('VEL_0004');
  });

  it('E7: returns invalid when PCR is not in allowlist', async () => {
    const bundle: AttestationBundle = {
      version: 'vel-v1',
      taskId: 1,
      executorAddress: 'addr',
      resultHash: 'rh',
      logHash: 'lh',
      attestationReport: buildReport('bad-pcr', 'rhlh'),
      providerName: 'gramine-local',
      pcrValues: {},
      timestamp: Date.now(),
    };
    const report = await verifier.verify(bundle);
    expect(report.valid).toBe(false);
    expect(report.reason).toContain('VEL_0005');
  });

  it('E8: returns invalid when resultHash mismatches user-data', async () => {
    const bundle: AttestationBundle = {
      version: 'vel-v1',
      taskId: 1,
      executorAddress: 'addr',
      resultHash: 'rh',
      logHash: 'lh',
      attestationReport: buildReport('mock-pcr-allowed', 'wrong-user-data'),
      providerName: 'gramine-local',
      pcrValues: {},
      timestamp: Date.now(),
    };
    const report = await verifier.verify(bundle);
    expect(report.valid).toBe(false);
    expect(report.reason).toContain('VEL_0006');
  });
});
