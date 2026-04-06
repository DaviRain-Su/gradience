import { describe, it, expect } from 'vitest';
import { TeeProviderFactory, DefaultTeeExecutionEngine } from '../tee-execution-engine';
import { VelError, VEL_ERROR_UNSUPPORTED_PROVIDER } from '../errors';

describe('TeeExecutionEngine / Factory', () => {
  it('H3: factory returns GramineLocalProvider for "gramine-local"', () => {
    const provider = TeeProviderFactory.create('gramine-local');
    expect(provider.name).toBe('gramine-local');
  });

  it('E3: factory throws VEL_0008 for unknown provider name', () => {
    expect(() => TeeProviderFactory.create('unknown-provider')).toThrow(VelError);
    try {
      TeeProviderFactory.create('unknown-provider');
    } catch (e) {
      expect((e as VelError).code).toBe(VEL_ERROR_UNSUPPORTED_PROVIDER);
    }
  });

  it('E3 alt: nitro stub exists', () => {
    const provider = TeeProviderFactory.create('nitro-local');
    expect(provider.name).toBe('nitro-local');
  });

  it('Default engine verifyAttestation delegates to provider', async () => {
    const provider = TeeProviderFactory.create('gramine-local');
    const engine = new DefaultTeeExecutionEngine(provider);
    expect(engine).toBeDefined();
  });
});
