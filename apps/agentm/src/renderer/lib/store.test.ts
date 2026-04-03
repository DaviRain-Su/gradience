import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    createAppStore,
    type AppStore,
    type AppStorePersistenceAdapter,
} from './store.ts';
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

    it('task flow: apply -> submit -> outcome sync', () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'agent-a',
            email: 'a@agent.im',
            privyUserId: 'privy-a',
        });

        const baseTask = {
            taskId: 42,
            poster: 'poster-a',
            judge: 'judge-a',
            reward: 1000,
            state: 'open',
            category: 1,
            deadline: '999999',
            submissionCount: 0,
            winner: null,
        };

        store.getState().applyToTask(baseTask);
        const applied = store.getState().taskFlow.get(42);
        assert.equal(applied?.status, 'applied');

        store.getState().submitTaskResult(42, 'ipfs://result-42', 'ipfs://trace-42');
        const submitted = store.getState().taskFlow.get(42);
        assert.equal(submitted?.status, 'submitted');
        assert.equal(submitted?.resultRef, 'ipfs://result-42');

        store.getState().syncTaskOutcome({
            ...baseTask,
            state: 'completed',
            winner: 'agent-a',
            submissionCount: 1,
        });
        const won = store.getState().taskFlow.get(42);
        assert.equal(won?.status, 'won');
    });

    it('getTaskFlowHistory returns latest-updated first', () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'agent-a',
            email: 'a@agent.im',
            privyUserId: 'privy-a',
        });
        store.getState().applyToTask({
            taskId: 1,
            poster: 'p',
            judge: 'j',
            reward: 10,
            state: 'open',
            category: 0,
            deadline: '1',
            submissionCount: 0,
            winner: null,
        });
        store.getState().applyToTask({
            taskId: 2,
            poster: 'p',
            judge: 'j',
            reward: 10,
            state: 'open',
            category: 0,
            deadline: '1',
            submissionCount: 0,
            winner: null,
        });
        const history = store.getState().getTaskFlowHistory();
        assert.equal(history[0].taskId, 2);
        assert.equal(history[1].taskId, 1);
    });

    it('applyInteropSyncEvent updates per-agent interoperability counters', () => {
        const snapshot1 = store.getState().applyInteropSyncEvent({
            type: 'interop_sync',
            winner: 'agent-a',
            taskId: 100,
            score: 88,
            category: 1,
            chainTx: 'sig-1',
            judgedAt: Date.now(),
            identityRegistered: true,
            feedbackTargets: ['erc8004_feedback'],
            erc8004FeedbackPublished: true,
            istranaFeedbackPublished: false,
            attestationPublished: true,
        });
        assert.equal(snapshot1.identityRegistered, true);
        assert.equal(snapshot1.erc8004FeedbackCount, 1);
        assert.equal(snapshot1.evmReputationCount, 0);
        assert.equal(snapshot1.istranaFeedbackCount, 0);
        assert.equal(snapshot1.attestationCount, 1);
        assert.equal(snapshot1.identityRoleCounts.winner, 1);
        assert.equal(snapshot1.feedbackRoleCounts.winner, 1);

        const snapshot2 = store.getState().applyInteropSyncEvent({
            type: 'interop_sync',
            winner: 'agent-a',
            taskId: 101,
            score: 92,
            category: 2,
            chainTx: 'sig-2',
            judgedAt: Date.now(),
            identityRegistered: false,
            feedbackTargets: ['istrana_feedback'],
            erc8004FeedbackPublished: false,
            evmReputationPublished: true,
            istranaFeedbackPublished: true,
            attestationPublished: false,
        });
        assert.equal(snapshot2.identityRegistered, true);
        assert.equal(snapshot2.erc8004FeedbackCount, 1);
        assert.equal(snapshot2.evmReputationCount, 1);
        assert.equal(snapshot2.istranaFeedbackCount, 1);
        assert.equal(snapshot2.lastTaskId, 101);
        assert.equal(snapshot2.lastScore, 92);
        assert.equal(snapshot2.feedbackRoleCounts.winner, 3);

        const snapshot3 = store.getState().applyInteropSyncEvent({
            type: 'interop_sync',
            winner: 'agent-a',
            taskId: 102,
            score: 90,
            category: 2,
            chainTx: 'sig-3',
            judgedAt: Date.now(),
            identityRegistered: true,
            feedbackTargets: ['erc8004_feedback'],
            feedbackPublishedCount: 3,
            feedbackRecipients: [
                { sink: 'erc8004_feedback', role: 'winner', agent: 'agent-a' },
                { sink: 'erc8004_feedback', role: 'poster', agent: 'poster-a' },
                { sink: 'erc8004_feedback', role: 'judge', agent: 'judge-a' },
                { sink: 'erc8004_feedback', role: 'loser', agent: 'loser-a' },
            ],
            identityDispatches: [
                { role: 'winner', agent: 'agent-a' },
                { role: 'poster', agent: 'poster-a' },
                { role: 'judge', agent: 'judge-a' },
                { role: 'loser', agent: 'loser-a' },
            ],
            erc8004FeedbackPublished: true,
            evmReputationPublished: false,
            istranaFeedbackPublished: false,
            attestationPublished: false,
        });
        assert.equal(snapshot3.erc8004FeedbackCount, 2);
        assert.equal(snapshot3.identityRoleCounts.winner, 2);
        assert.equal(snapshot3.feedbackRoleCounts.winner, 4);

        const posterStatus = store.getState().getInteropStatus('poster-a');
        assert.equal(posterStatus?.erc8004FeedbackCount, 1);
        assert.equal(posterStatus?.identityRoleCounts.poster, 1);
        assert.equal(posterStatus?.feedbackRoleCounts.poster, 1);
    });

    it('identity registration status can be stored and queried', () => {
        store.getState().setIdentityRegistrationStatus({
            agent: 'agent-a',
            state: 'registered',
            agentId: '42',
            txHash: '0xabc',
            error: null,
            updatedAt: 1,
        });
        const status = store.getState().getIdentityRegistrationStatus('agent-a');
        assert.equal(status?.state, 'registered');
        assert.equal(status?.agentId, '42');
    });

    it('agent profile can be stored and queried', () => {
        store.getState().setAgentProfile({
            agent: 'agent-a',
            displayName: 'Agent A',
            bio: 'A profile bio',
            links: {
                website: 'https://agent-a.example.com',
            },
            onchainRef: null,
            publishMode: 'manual',
            updatedAt: 10,
        });
        const profile = store.getState().getAgentProfile('agent-a');
        assert.equal(profile?.displayName, 'Agent A');
        assert.equal(profile?.links.website, 'https://agent-a.example.com');
    });

    it('persists and rehydrates auth/messages/identity snapshot with adapter', () => {
        let persisted: unknown = null;
        const persistence: AppStorePersistenceAdapter = {
            load: () => persisted as never,
            save: (snapshot) => {
                persisted = snapshot;
            },
        };
        const storeA = createAppStore({ persistence });
        storeA.getState().setAuth({
            authenticated: true,
            publicKey: 'persist-agent',
            email: 'persist@agent.im',
            privyUserId: 'privy-persist',
        });
        storeA.getState().addMessage(
            msg({
                peerAddress: 'persist-peer',
                message: 'persisted-message',
            }),
        );
        storeA.getState().setIdentityRegistrationStatus({
            agent: 'persist-agent',
            state: 'registered',
            agentId: '7',
            txHash: '0x7',
            error: null,
            updatedAt: 7,
        });
        storeA.getState().setAgentProfile({
            agent: 'persist-agent',
            displayName: 'Persist Agent',
            bio: 'Persisted bio',
            links: {
                github: 'https://github.com/persist-agent',
            },
            onchainRef: 'sha256:abc',
            publishMode: 'manual',
            updatedAt: 11,
        });

        const storeB = createAppStore({ persistence });
        assert.equal(storeB.getState().auth.publicKey, 'persist-agent');
        assert.equal(
            storeB.getState().messages.get('persist-peer')?.[0]?.message,
            'persisted-message',
        );
        assert.equal(
            storeB.getState().getIdentityRegistrationStatus('persist-agent')?.agentId,
            '7',
        );
        assert.equal(
            storeB.getState().getAgentProfile('persist-agent')?.displayName,
            'Persist Agent',
        );
    });
});
