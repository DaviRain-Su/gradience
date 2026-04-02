import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAuthProvider } from './auth.ts';

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
});
