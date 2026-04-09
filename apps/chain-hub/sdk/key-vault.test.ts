import { describe, expect, it } from 'bun:test';
import { EnvKeyVaultAdapter, KeyVaultError, PolicyViolationError } from './key-vault';

describe('EnvKeyVaultAdapter', () => {
    it('resolves env secret and builds auth headers', () => {
        process.env.TEST_SECRET_REF = 'abc123';
        const adapter = new EnvKeyVaultAdapter();
        const headers = adapter.buildAuthHeaders('env:TEST_SECRET_REF');
        expect(headers.Authorization).toBe('Bearer abc123');
    });

    it('throws when secret is missing', () => {
        delete process.env.MISSING_SECRET_REF;
        const adapter = new EnvKeyVaultAdapter();
        expect(() => adapter.resolveSecret('env:MISSING_SECRET_REF')).toThrow(KeyVaultError);
    });

    it('enforces policy guard on capability, method and amount', () => {
        const adapter = new EnvKeyVaultAdapter();
        expect(() =>
            adapter.guard(
                { allowedCapabilities: ['swap'], allowedMethods: ['POST'], maxAmount: 10 },
                { capability: 'swap', method: 'POST', amount: 10 },
            ),
        ).not.toThrow();

        expect(() =>
            adapter.guard(
                { allowedCapabilities: ['swap'], allowedMethods: ['POST'], maxAmount: 10 },
                { capability: 'lend', method: 'POST', amount: 10 },
            ),
        ).toThrow(PolicyViolationError);

        expect(() =>
            adapter.guard(
                { allowedCapabilities: ['swap'], allowedMethods: ['POST'], maxAmount: 10 },
                { capability: 'swap', method: 'GET', amount: 10 },
            ),
        ).toThrow(PolicyViolationError);

        expect(() =>
            adapter.guard(
                { allowedCapabilities: ['swap'], allowedMethods: ['POST'], maxAmount: 10 },
                { capability: 'swap', method: 'POST', amount: 11 },
            ),
        ).toThrow(PolicyViolationError);
    });
});
