/**
 * AgentM global state — Zustand store.
 * Used by both React views and API server.
 */

import { createStore } from 'zustand/vanilla';
import type {
    AuthState,
    ActiveView,
    Conversation,
    ChatMessage,
    AgentDiscoveryRow,
    AgentProfile,
    ArenaTaskSummary,
    TaskFlowRecord,
    InteropStatusSnapshot,
    InteropSyncEvent,
    IdentityRegistrationStatus,
} from '../../shared/types.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';

const DEFAULT_PERSIST_KEY = 'agent-im.store.v1';
type InteropRole = 'winner' | 'poster' | 'judge' | 'loser';

const EMPTY_ROLE_COUNTS: Record<InteropRole, number> = {
    winner: 0,
    poster: 0,
    judge: 0,
    loser: 0,
};

export interface AppStorePersistenceAdapter {
    load: () => Partial<PersistedAppStoreState> | null;
    save: (snapshot: PersistedAppStoreState) => void;
}

interface PersistedAppStoreState {
    auth: AuthState;
    activeView: ActiveView;
    activeConversation: string | null;
    conversations: Conversation[];
    messages: Array<[string, ChatMessage[]]>;
    discoveryRows: AgentDiscoveryRow[];
    discoveryQuery: string;
    agentProfiles: Array<[string, AgentProfile]>;
    trackedTasks: Array<[number, ArenaTaskSummary]>;
    taskFlow: Array<[number, TaskFlowRecord]>;
    interopStatus: Array<[string, InteropStatusSnapshot]>;
    identityRegistration: Array<[string, IdentityRegistrationStatus]>;
}

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
    agentProfiles: Map<string, AgentProfile>;
    setAgentProfile: (profile: AgentProfile) => void;
    getAgentProfile: (agent: string) => AgentProfile | null;

    // Arena task flow
    trackedTasks: Map<number, ArenaTaskSummary>;
    taskFlow: Map<number, TaskFlowRecord>;
    trackTasks: (tasks: ArenaTaskSummary[]) => void;
    applyToTask: (task: ArenaTaskSummary) => void;
    submitTaskResult: (taskId: number, resultRef: string, traceRef?: string | null) => void;
    syncTaskOutcome: (task: ArenaTaskSummary) => void;
    getTaskFlowHistory: () => TaskFlowRecord[];

    // Interoperability status
    interopStatus: Map<string, InteropStatusSnapshot>;
    applyInteropSyncEvent: (event: InteropSyncEvent) => InteropStatusSnapshot;
    getInteropStatus: (agent: string) => InteropStatusSnapshot | null;

    // Identity registration
    identityRegistration: Map<string, IdentityRegistrationStatus>;
    setIdentityRegistrationStatus: (status: IdentityRegistrationStatus) => void;
    getIdentityRegistrationStatus: (agent: string) => IdentityRegistrationStatus | null;
}

export function createAppStore(options: {
    persistence?: AppStorePersistenceAdapter | null;
} = {}) {
    const persistence = options.persistence ?? createDefaultPersistenceAdapter();
    const store = createStore<AppStore>((set, get) => ({
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
        agentProfiles: new Map(),
        setAgentProfile: (profile) => {
            const next = new Map(get().agentProfiles);
            next.set(profile.agent, profile);
            set({ agentProfiles: next });
        },
        getAgentProfile: (agent) => get().agentProfiles.get(agent) ?? null,

        // Arena task flow
        trackedTasks: new Map(),
        taskFlow: new Map(),
        trackTasks: (tasks) => {
            const next = new Map(get().trackedTasks);
            for (const task of tasks) {
                next.set(task.taskId, task);
            }
            set({ trackedTasks: next });
        },
        applyToTask: (task) => {
            const { auth, trackedTasks, taskFlow } = get();
            if (!auth.authenticated || !auth.publicKey) return;
            const now = Date.now();
            const nextTrackedTasks = new Map(trackedTasks);
            nextTrackedTasks.set(task.taskId, task);
            const existing = taskFlow.get(task.taskId);
            const nextTaskFlow = new Map(taskFlow);
            nextTaskFlow.set(task.taskId, {
                taskId: task.taskId,
                status: existing?.status === 'submitted' ? existing.status : 'applied',
                appliedAt: existing?.appliedAt ?? now,
                updatedAt: now,
                resultRef: existing?.resultRef ?? null,
                traceRef: existing?.traceRef ?? null,
                lastKnownTaskState: task.state,
                winner: task.winner,
            });
            set({ trackedTasks: nextTrackedTasks, taskFlow: nextTaskFlow });
        },
        submitTaskResult: (taskId, resultRef, traceRef = null) => {
            const { trackedTasks, taskFlow } = get();
            const tracked = trackedTasks.get(taskId);
            if (!tracked) return;
            const existing = taskFlow.get(taskId);
            if (!existing) return;
            const now = Date.now();
            const nextTaskFlow = new Map(taskFlow);
            nextTaskFlow.set(taskId, {
                ...existing,
                status: 'submitted',
                updatedAt: now,
                resultRef,
                traceRef,
                lastKnownTaskState: tracked.state,
                winner: tracked.winner,
            });
            set({ taskFlow: nextTaskFlow });
        },
        syncTaskOutcome: (task) => {
            const { auth, trackedTasks, taskFlow } = get();
            const existing = taskFlow.get(task.taskId);
            const nextTrackedTasks = new Map(trackedTasks);
            nextTrackedTasks.set(task.taskId, task);
            if (!existing) {
                set({ trackedTasks: nextTrackedTasks });
                return;
            }

            const agent = auth.publicKey;
            let status = existing.status;
            if (task.state === 'completed') {
                status = task.winner && agent && task.winner === agent ? 'won' : 'lost';
            } else if (task.state === 'refunded') {
                status = 'refunded';
            } else if (existing.resultRef) {
                status = 'submitted';
            } else {
                status = 'applied';
            }
            const nextTaskFlow = new Map(taskFlow);
            nextTaskFlow.set(task.taskId, {
                ...existing,
                status,
                updatedAt: Date.now(),
                lastKnownTaskState: task.state,
                winner: task.winner,
            });
            set({ trackedTasks: nextTrackedTasks, taskFlow: nextTaskFlow });
        },
        getTaskFlowHistory: () =>
            Array.from(get().taskFlow.values()).sort(
                (a, b) => b.updatedAt - a.updatedAt || b.taskId - a.taskId,
            ),

        // Interoperability status
        interopStatus: new Map(),
        applyInteropSyncEvent: (event) => {
            const { interopStatus } = get();
            const nextMap = new Map(interopStatus);
            const feedbackDispatches = collectFeedbackDispatches(event);
            const identityDispatches = collectIdentityDispatches(event);
            const agents = new Set<string>([
                event.winner,
                ...feedbackDispatches.map((entry) => entry.agent),
                ...identityDispatches.map((entry) => entry.agent),
            ]);
            if (event.attestationPublished) {
                agents.add(event.winner);
            }

            for (const agent of agents) {
                if (!agent) {
                    continue;
                }
                const existing = normalizeInteropSnapshot(nextMap.get(agent), agent);
                const identityRoleCounts = collectRoleCounts(
                    identityDispatches
                        .filter((entry) => entry.agent === agent)
                        .map((entry) => entry.role),
                );
                const feedbackRoleCounts = collectRoleCounts(
                    feedbackDispatches
                        .filter((entry) => entry.agent === agent)
                        .map((entry) => entry.role),
                );
                const erc8004FeedbackIncrement = feedbackDispatches.filter(
                    (entry) =>
                        entry.agent === agent && entry.sink === 'erc8004_feedback',
                ).length;
                const evmFeedbackIncrement = feedbackDispatches.filter(
                    (entry) =>
                        entry.agent === agent && entry.sink === 'evm_reputation_relay',
                ).length;
                const istranaFeedbackIncrement = feedbackDispatches.filter(
                    (entry) =>
                        entry.agent === agent && entry.sink === 'istrana_feedback',
                ).length;

                const next: InteropStatusSnapshot = {
                    agent,
                    identityRegistered:
                        existing.identityRegistered ||
                        countRoleTotal(identityRoleCounts) > 0 ||
                        (agent === event.winner && event.identityRegistered),
                    erc8004FeedbackCount:
                        existing.erc8004FeedbackCount + erc8004FeedbackIncrement,
                    evmReputationCount:
                        existing.evmReputationCount + evmFeedbackIncrement,
                    istranaFeedbackCount:
                        existing.istranaFeedbackCount + istranaFeedbackIncrement,
                    attestationCount:
                        existing.attestationCount +
                        (agent === event.winner && event.attestationPublished ? 1 : 0),
                    identityRoleCounts: addRoleCounts(
                        existing.identityRoleCounts,
                        identityRoleCounts,
                    ),
                    feedbackRoleCounts: addRoleCounts(
                        existing.feedbackRoleCounts,
                        feedbackRoleCounts,
                    ),
                    lastTaskId: event.taskId,
                    lastScore: event.score,
                    lastChainTx: event.chainTx,
                    updatedAt: Date.now(),
                };
                nextMap.set(agent, next);
            }
            set({ interopStatus: nextMap });
            return normalizeInteropSnapshot(nextMap.get(event.winner), event.winner);
        },
        getInteropStatus: (agent) => get().interopStatus.get(agent) ?? null,

        // Identity registration
        identityRegistration: new Map(),
        setIdentityRegistrationStatus: (status) => {
            const next = new Map(get().identityRegistration);
            next.set(status.agent, status);
            set({ identityRegistration: next });
        },
        getIdentityRegistrationStatus: (agent) =>
            get().identityRegistration.get(agent) ?? null,
    }));

    if (persistence) {
        const loaded = persistence.load();
        if (loaded) {
            store.setState(rehydrateStore(loaded, store.getState()));
        }
        store.subscribe((state) => {
            persistence.save(snapshotStore(state));
        });
    }

    return store;
}

function snapshotStore(state: AppStore): PersistedAppStoreState {
    return {
        auth: state.auth,
        activeView: state.activeView,
        activeConversation: state.activeConversation,
        conversations: state.conversations,
        messages: Array.from(state.messages.entries()),
        discoveryRows: state.discoveryRows,
        discoveryQuery: state.discoveryQuery,
        agentProfiles: Array.from(state.agentProfiles.entries()),
        trackedTasks: Array.from(state.trackedTasks.entries()),
        taskFlow: Array.from(state.taskFlow.entries()),
        interopStatus: Array.from(state.interopStatus.entries()),
        identityRegistration: Array.from(state.identityRegistration.entries()),
    };
}

function rehydrateStore(
    persisted: Partial<PersistedAppStoreState>,
    current: AppStore,
): Partial<AppStore> {
    return {
        auth: persisted.auth ?? current.auth,
        activeView: persisted.activeView ?? current.activeView,
        activeConversation: persisted.activeConversation ?? current.activeConversation,
        conversations: persisted.conversations ?? current.conversations,
        messages: persisted.messages ? new Map(persisted.messages) : current.messages,
        discoveryRows: persisted.discoveryRows ?? current.discoveryRows,
        discoveryQuery: persisted.discoveryQuery ?? current.discoveryQuery,
        agentProfiles: persisted.agentProfiles
            ? new Map(persisted.agentProfiles)
            : current.agentProfiles,
        trackedTasks: persisted.trackedTasks
            ? new Map(persisted.trackedTasks)
            : current.trackedTasks,
        taskFlow: persisted.taskFlow ? new Map(persisted.taskFlow) : current.taskFlow,
        interopStatus: persisted.interopStatus
            ? new Map(
                  persisted.interopStatus.map(([agent, snapshot]) => [
                      agent,
                      normalizeInteropSnapshot(snapshot, agent),
                  ]),
              )
            : current.interopStatus,
        identityRegistration: persisted.identityRegistration
            ? new Map(persisted.identityRegistration)
            : current.identityRegistration,
    };
}

function collectFeedbackDispatches(
    event: InteropSyncEvent,
): Array<{ sink: string; role: InteropRole; agent: string }> {
    if (event.feedbackRecipients && event.feedbackRecipients.length > 0) {
        return event.feedbackRecipients
            .filter(
                (entry): entry is { sink: string; role: InteropRole; agent: string } =>
                    !!entry &&
                    typeof entry.sink === 'string' &&
                    isInteropRole(entry.role) &&
                    typeof entry.agent === 'string' &&
                    entry.agent.trim().length > 0,
            )
            .map((entry) => ({
                sink: entry.sink,
                role: entry.role,
                agent: entry.agent.trim(),
            }));
    }

    const fallbackCount = Math.max(1, event.feedbackPublishedCount ?? 1);
    const fallback: Array<{ sink: string; role: InteropRole; agent: string }> = [];
    if (event.erc8004FeedbackPublished) {
        for (let index = 0; index < fallbackCount; index += 1) {
            fallback.push({ sink: 'erc8004_feedback', role: 'winner', agent: event.winner });
        }
    }
    if (event.evmReputationPublished) {
        for (let index = 0; index < fallbackCount; index += 1) {
            fallback.push({
                sink: 'evm_reputation_relay',
                role: 'winner',
                agent: event.winner,
            });
        }
    }
    if (event.istranaFeedbackPublished) {
        for (let index = 0; index < fallbackCount; index += 1) {
            fallback.push({ sink: 'istrana_feedback', role: 'winner', agent: event.winner });
        }
    }
    return fallback;
}

function collectIdentityDispatches(
    event: InteropSyncEvent,
): Array<{ role: InteropRole; agent: string }> {
    if (event.identityDispatches && event.identityDispatches.length > 0) {
        return event.identityDispatches
            .filter(
                (entry): entry is { role: InteropRole; agent: string } =>
                    !!entry &&
                    isInteropRole(entry.role) &&
                    typeof entry.agent === 'string' &&
                    entry.agent.trim().length > 0,
            )
            .map((entry) => ({ role: entry.role, agent: entry.agent.trim() }));
    }

    if (event.identityRecipients && event.identityRecipients.length > 0) {
        return event.identityRecipients
            .filter((agent): agent is string => typeof agent === 'string' && agent.trim().length > 0)
            .map((agent) => {
                const normalized = agent.trim();
                return {
                    role: inferRole(event, normalized),
                    agent: normalized,
                };
            });
    }

    if (!event.identityRegistered || !event.winner.trim()) {
        return [];
    }
    return [{ role: 'winner', agent: event.winner.trim() }];
}

function inferRole(event: InteropSyncEvent, agent: string): InteropRole {
    if (agent === event.winner) {
        return 'winner';
    }
    const fallback = event.feedbackRecipients?.find((entry) => entry.agent === agent)?.role;
    if (fallback && isInteropRole(fallback)) {
        return fallback;
    }
    return 'loser';
}

function collectRoleCounts(roles: InteropRole[]): Record<InteropRole, number> {
    const counts = createEmptyRoleCounts();
    for (const role of roles) {
        counts[role] += 1;
    }
    return counts;
}

function addRoleCounts(
    left: Record<InteropRole, number>,
    right: Record<InteropRole, number>,
): Record<InteropRole, number> {
    return {
        winner: left.winner + right.winner,
        poster: left.poster + right.poster,
        judge: left.judge + right.judge,
        loser: left.loser + right.loser,
    };
}

function countRoleTotal(counts: Record<InteropRole, number>): number {
    return counts.winner + counts.poster + counts.judge + counts.loser;
}

function createEmptyRoleCounts(): Record<InteropRole, number> {
    return {
        winner: EMPTY_ROLE_COUNTS.winner,
        poster: EMPTY_ROLE_COUNTS.poster,
        judge: EMPTY_ROLE_COUNTS.judge,
        loser: EMPTY_ROLE_COUNTS.loser,
    };
}

function normalizeInteropSnapshot(
    snapshot: InteropStatusSnapshot | undefined,
    agent: string,
): InteropStatusSnapshot {
    if (!snapshot) {
        return {
            agent,
            identityRegistered: false,
            erc8004FeedbackCount: 0,
            evmReputationCount: 0,
            istranaFeedbackCount: 0,
            attestationCount: 0,
            identityRoleCounts: createEmptyRoleCounts(),
            feedbackRoleCounts: createEmptyRoleCounts(),
            lastTaskId: null,
            lastScore: null,
            lastChainTx: null,
            updatedAt: 0,
        };
    }
    return {
        ...snapshot,
        agent,
        identityRoleCounts: {
            ...createEmptyRoleCounts(),
            ...(snapshot.identityRoleCounts ?? {}),
        },
        feedbackRoleCounts: {
            ...createEmptyRoleCounts(),
            ...(snapshot.feedbackRoleCounts ?? {}),
        },
    };
}

function isInteropRole(value: unknown): value is InteropRole {
    return value === 'winner' || value === 'poster' || value === 'judge' || value === 'loser';
}

function createDefaultPersistenceAdapter(): AppStorePersistenceAdapter | null {
    const storage = getLocalStorage();
    if (!storage) {
        return null;
    }
    return {
        load: () => {
            const raw = storage.getItem(DEFAULT_PERSIST_KEY);
            if (!raw) {
                return null;
            }
            try {
                return JSON.parse(raw) as Partial<PersistedAppStoreState>;
            } catch {
                return null;
            }
        },
        save: (snapshot) => {
            try {
                storage.setItem(DEFAULT_PERSIST_KEY, JSON.stringify(snapshot));
            } catch {
                // ignore quota / browser privacy errors
            }
        },
    };
}

function getLocalStorage(): Storage | null {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
        return null;
    }
    try {
        const storage = globalThis.localStorage as Partial<Storage> | undefined;
        if (
            !storage ||
            typeof storage.getItem !== 'function' ||
            typeof storage.setItem !== 'function'
        ) {
            return null;
        }
        return storage as Storage;
    } catch {
        return null;
    }
}
