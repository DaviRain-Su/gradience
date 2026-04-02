import { createStore } from 'zustand/vanilla';
import type { AuthState, ActiveView, AgentDiscoveryRow, ChatMessage, Conversation } from '../types';
import { EMPTY_AUTH } from '../types';

export interface WebAppStore {
    auth: AuthState;
    setAuth: (auth: AuthState) => void;

    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;

    discoveryRows: AgentDiscoveryRow[];
    setDiscoveryRows: (rows: AgentDiscoveryRow[]) => void;
    discoveryQuery: string;
    setDiscoveryQuery: (q: string) => void;

    conversations: Conversation[];
    activeConversation: string | null;
    setActiveConversation: (peer: string | null) => void;

    messages: Map<string, ChatMessage[]>;
    addMessage: (msg: ChatMessage) => void;
}

export const store = createStore<WebAppStore>((set, get) => ({
    auth: EMPTY_AUTH,
    setAuth: (auth) => set({ auth }),

    activeView: 'discover',
    setActiveView: (activeView) => set({ activeView }),

    discoveryRows: [],
    setDiscoveryRows: (discoveryRows) => set({ discoveryRows }),
    discoveryQuery: '',
    setDiscoveryQuery: (discoveryQuery) => set({ discoveryQuery }),

    conversations: [],
    activeConversation: null,
    setActiveConversation: (peer) => {
        set({ activeConversation: peer });
        if (peer) {
            const convs = get().conversations.map((c) =>
                c.peerAddress === peer ? { ...c, unreadCount: 0 } : c,
            );
            set({ conversations: convs });
        }
    },

    messages: new Map(),
    addMessage: (msg) => {
        const { messages, conversations } = get();
        const peer = msg.peerAddress;
        const existing = messages.get(peer) ?? [];
        const next = new Map(messages);
        next.set(peer, [...existing, msg]);

        const convIdx = conversations.findIndex((c) => c.peerAddress === peer);
        let nextConvs: Conversation[];
        if (convIdx >= 0) {
            nextConvs = conversations.map((c, i) =>
                i === convIdx
                    ? {
                          ...c,
                          lastMessage: msg.message,
                          lastMessageAt: msg.createdAt,
                          unreadCount: msg.direction === 'incoming' ? c.unreadCount + 1 : c.unreadCount,
                      }
                    : c,
            );
        } else {
            nextConvs = [
                ...conversations,
                {
                    peerAddress: peer,
                    peerName: null,
                    lastMessage: msg.message,
                    lastMessageAt: msg.createdAt,
                    unreadCount: msg.direction === 'incoming' ? 1 : 0,
                },
            ];
        }

        set({ messages: next, conversations: nextConvs });
    },
}));

export function useStore<T>(selector: (s: WebAppStore) => T): T {
    // Simple hook — in production use zustand/react
    return selector(store.getState());
}
