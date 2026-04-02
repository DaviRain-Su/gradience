/**
 * Agent.im global state — Zustand store.
 * Used by both React views and API server.
 */

import { createStore } from 'zustand/vanilla';
import type {
    AuthState,
    ActiveView,
    Conversation,
    ChatMessage,
    AgentDiscoveryRow,
    InteropStatusSnapshot,
    InteropSyncEvent,
} from '../../shared/types.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';

export interface AppStore {
    // Auth
    auth: AuthState;
    setAuth: (auth: AuthState) => void;

    // Navigation
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;

    // Conversations
    conversations: Conversation[];
    activeConversation: string | null;
    setActiveConversation: (peer: string | null) => void;

    // Messages (grouped by peerAddress)
    messages: Map<string, ChatMessage[]>;
    addMessage: (msg: ChatMessage) => void;

    // Discovery
    discoveryRows: AgentDiscoveryRow[];
    discoveryQuery: string;
    setDiscoveryQuery: (q: string) => void;
    setDiscoveryRows: (rows: AgentDiscoveryRow[]) => void;

    // Interoperability status
    interopStatus: Map<string, InteropStatusSnapshot>;
    applyInteropSyncEvent: (event: InteropSyncEvent) => InteropStatusSnapshot;
    getInteropStatus: (agent: string) => InteropStatusSnapshot | null;
}

export function createAppStore() {
    return createStore<AppStore>((set, get) => ({
        // Auth
        auth: EMPTY_AUTH,
        setAuth: (auth) => set({ auth }),

        // Navigation
        activeView: 'me',
        setActiveView: (activeView) => set({ activeView }),

        // Conversations
        conversations: [],
        activeConversation: null,
        setActiveConversation: (peer) => {
            // Clear unread when opening a conversation
            if (peer) {
                const conversations = get().conversations.map((c) =>
                    c.peerAddress === peer ? { ...c, unreadCount: 0 } : c,
                );
                set({ activeConversation: peer, conversations });
            } else {
                set({ activeConversation: peer });
            }
        },

        // Messages
        messages: new Map(),
        addMessage: (msg) => {
            const { messages, conversations, activeConversation } = get();
            const newMessages = new Map(messages);
            const peerMsgs = [...(newMessages.get(msg.peerAddress) ?? []), msg];
            newMessages.set(msg.peerAddress, peerMsgs);

            // Update or create conversation
            const isUnread = msg.direction === 'incoming' && msg.peerAddress !== activeConversation;
            const existing = conversations.find((c) => c.peerAddress === msg.peerAddress);
            let newConversations: Conversation[];

            if (existing) {
                newConversations = conversations.map((c) =>
                    c.peerAddress === msg.peerAddress
                        ? {
                              ...c,
                              lastMessage: msg.message,
                              lastMessageAt: msg.createdAt,
                              unreadCount: isUnread ? c.unreadCount + 1 : c.unreadCount,
                          }
                        : c,
                );
            } else {
                newConversations = [
                    ...conversations,
                    {
                        peerAddress: msg.peerAddress,
                        peerName: null,
                        lastMessage: msg.message,
                        lastMessageAt: msg.createdAt,
                        unreadCount: isUnread ? 1 : 0,
                    },
                ];
            }

            set({ messages: newMessages, conversations: newConversations });
        },

        // Discovery
        discoveryRows: [],
        discoveryQuery: '',
        setDiscoveryQuery: (discoveryQuery) => set({ discoveryQuery }),
        setDiscoveryRows: (discoveryRows) => set({ discoveryRows }),

        // Interoperability status
        interopStatus: new Map(),
        applyInteropSyncEvent: (event) => {
            const { interopStatus } = get();
            const existing = interopStatus.get(event.winner);
            const next: InteropStatusSnapshot = {
                agent: event.winner,
                identityRegistered:
                    event.identityRegistered || existing?.identityRegistered || false,
                erc8004FeedbackCount:
                    (existing?.erc8004FeedbackCount ?? 0) +
                    (event.erc8004FeedbackPublished ? 1 : 0),
                istranaFeedbackCount:
                    (existing?.istranaFeedbackCount ?? 0) +
                    (event.istranaFeedbackPublished ? 1 : 0),
                attestationCount:
                    (existing?.attestationCount ?? 0) +
                    (event.attestationPublished ? 1 : 0),
                lastTaskId: event.taskId,
                lastScore: event.score,
                lastChainTx: event.chainTx,
                updatedAt: Date.now(),
            };
            const nextMap = new Map(interopStatus);
            nextMap.set(event.winner, next);
            set({ interopStatus: nextMap });
            return next;
        },
        getInteropStatus: (agent) => get().interopStatus.get(agent) ?? null,
    }));
}
