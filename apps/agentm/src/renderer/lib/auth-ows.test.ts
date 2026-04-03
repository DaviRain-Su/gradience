import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OWSAuthProvider, createOWSAuthProvider } from './auth-ows.ts';

describe('OWSAuthProvider', () => {
    it('should create provider with default config', () => {
        const provider = createOWSAuthProvider();
        assert.ok(provider instanceof OWSAuthProvider);
        assert.equal(provider.isAuthenticated(), false);
    });

    it('should create provider with custom config', () => {
        const provider = createOWSAuthProvider({
            network: 'mainnet',
            defaultChain: 'ethereum'
        });
        assert.ok(provider instanceof OWSAuthProvider);
    });

    it('should have empty state initially', () => {
        const provider = createOWSAuthProvider();
        const state = provider.getState();
        assert.equal(state.authenticated, false);
        assert.equal(state.publicKey, null);
        assert.equal(state.owsDID, undefined);
    });

    it('should track authentication state', async () => {
        const provider = createOWSAuthProvider();
        
        // Initially not authenticated
        assert.equal(provider.isAuthenticated(), false);
        
        // After login, should be authenticated
        // Note: This would need mock OWS adapter in real test
        // For now, just test the state tracking
    });

    it('should return empty addresses when not authenticated', () => {
        const provider = createOWSAuthProvider();
        const addresses = provider.getAddresses();
        assert.deepEqual(addresses, {});
    });

    it('should return empty credentials when not authenticated', () => {
        const provider = createOWSAuthProvider();
        const credentials = provider.getCredentials();
        assert.deepEqual(credentials, []);
    });

    it('should throw when signing without authentication', async () => {
        const provider = createOWSAuthProvider();
        
        await assert.rejects(
            provider.signMessage('test'),
            /Not authenticated with OWS/
        );
        
        await assert.rejects(
            provider.signTransaction({}),
            /Not authenticated with OWS/
        );
    });

    it('should clear state on logout', async () => {
        const provider = createOWSAuthProvider();
        
        // Logout should clear state even if not logged in
        await provider.logout();
        
        const state = provider.getState();
        assert.equal(state.authenticated, false);
        assert.equal(state.owsDID, undefined);
    });
});
