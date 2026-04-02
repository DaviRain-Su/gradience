import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAppStore, type AppStore } from './store.ts';
import type { ChatMessage } from '../../shared/types.ts';

let store: ReturnType<typeof createAppStore>;

function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: `${Date.now()}-${Math.random()}`,
        peerAddress: 'bob',
        direction: 'incoming',
        topic: 'test',
        message: 'hello',
        paymentMicrolamports: 100,
        status: 'delivered',
        createdAt: Date.now(),
        ...overrides,
    };
}

describe('AppStore', () => {
    beforeEach(() => {
        store = createAppStore();
    });

    it('addMessage creates conversation automatically', () => {
        store.getState().addMessage(msg());
        const convs = store.getState().conversations;
        assert.equal(convs.length, 1);
        assert.equal(convs[0].peerAddress, 'bob');
        assert.equal(convs[0].lastMessage, 'hello');
    });

    it('addMessage incoming increments unreadCount', () => {
        store.getState().addMessage(msg({ direction: 'incoming' }));
        assert.equal(store.getState().conversations[0].unreadCount, 1);

        store.getState().addMessage(msg({ direction: 'incoming' }));
        assert.equal(store.getState().conversations[0].unreadCount, 2);
    });

    it('setActiveConversation clears unreadCount', () => {
        store.getState().addMessage(msg({ direction: 'incoming' }));
        store.getState().addMessage(msg({ direction: 'incoming' }));
        assert.equal(store.getState().conversations[0].unreadCount, 2);

        store.getState().setActiveConversation('bob');
        assert.equal(store.getState().conversations[0].unreadCount, 0);
    });

    it('setAuth login sets authenticated + publicKey', () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'abc123',
            email: 'test@gmail.com',
            privyUserId: 'privy-1',
        });
        assert.equal(store.getState().auth.authenticated, true);
        assert.equal(store.getState().auth.publicKey, 'abc123');
    });

    it('setAuth logout clears publicKey but keeps conversations', () => {
        // Add a message first
        store.getState().addMessage(msg());
        assert.equal(store.getState().conversations.length, 1);

        // Logout
        store.getState().setAuth({
            authenticated: false,
            publicKey: null,
            email: null,
            privyUserId: null,
        });
        assert.equal(store.getState().auth.publicKey, null);
        // Messages should be preserved
        assert.equal(store.getState().conversations.length, 1);
    });

    it('setDiscoveryQuery updates query', () => {
        store.getState().setDiscoveryQuery('defi');
        assert.equal(store.getState().discoveryQuery, 'defi');
    });
});
