import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAuthProvider, createAuthProvider } from './auth.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';

describe('MockAuthProvider', () => {
    it('login sets authenticated + publicKey', async () => {
        const auth = new MockAuthProvider();
        const state = await auth.login();
        assert.equal(state.authenticated, true);
        assert.ok(state.publicKey?.startsWith('DEMO_'));
        assert.equal(state.email, 'demo@agent.im');
    });

    it('logout clears state', async () => {
        const auth = new MockAuthProvider();
        await auth.login();
        await auth.logout();
        const state = auth.getState();
        assert.equal(state.authenticated, false);
        assert.equal(state.publicKey, null);
    });

    it('getState reflects current auth', async () => {
        const auth = new MockAuthProvider();
        assert.equal(auth.getState().authenticated, false);
        await auth.login();
        assert.equal(auth.getState().authenticated, true);
    });

    it('login generates unique publicKey each time', async () => {
        const auth = new MockAuthProvider();
        const state1 = await auth.login();
        await auth.logout();
        const state2 = await auth.login();
        assert.notEqual(state1.publicKey, state2.publicKey);
    });

    it('privyUserId has mock- prefix', async () => {
        const auth = new MockAuthProvider();
        const state = await auth.login();
        assert.ok(state.privyUserId?.startsWith('mock-'));
    });

    it('initial state matches EMPTY_AUTH', () => {
        const auth = new MockAuthProvider();
        assert.deepEqual(auth.getState(), EMPTY_AUTH);
    });
});

describe('createAuthProvider', () => {
    it('returns MockAuthProvider in non-Privy context', () => {
        const provider = createAuthProvider();
        assert.ok(provider instanceof MockAuthProvider);
    });
});
