/**
 * useA2A Hook
 *
 * React Hook for A2A multi-protocol communication
 *
 * @module hooks/useA2A
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { A2ARouter } from '../../main/a2a-router/router.js';
import type {
    A2AIntent,
    A2AMessage,
    A2AResult,
    AgentInfo,
    AgentFilter,
    RouterHealthStatus,
    A2ARouterOptions,
} from '../../shared/a2a-router-types.js';

export interface UseA2AOptions extends A2ARouterOptions {
    /** Auto-initialize on mount */
    autoInit?: boolean;
    /** Agent info for broadcasting capabilities */
    agentInfo?: AgentInfo;
}

export interface UseA2AReturn {
    /** Router instance */
    router: A2ARouter | null;
    /** Initialization state */
    isInitialized: boolean;
    /** Loading state */
    isLoading: boolean;
    /** Error state */
    error: Error | null;
    /** Initialize the router */
    initialize: () => Promise<void>;
    /** Shutdown the router */
    shutdown: () => Promise<void>;
    /** Send a message */
    send: (intent: A2AIntent) => Promise<A2AResult>;
    /** Subscribe to incoming messages */
    subscribe: (handler: (message: A2AMessage) => void) => Promise<() => Promise<void>>;
    /** Discover agents */
    discoverAgents: (filter?: AgentFilter) => Promise<AgentInfo[]>;
    /** Broadcast capabilities */
    broadcastCapabilities: () => Promise<void>;
    /** Get health status */
    health: RouterHealthStatus;
    /** Discovered agents */
    agents: AgentInfo[];
    /** Refresh agents list */
    refreshAgents: () => Promise<void>;
}

/**
 * React Hook for A2A multi-protocol communication
 */
export function useA2A(options: UseA2AOptions = {}): UseA2AReturn {
    const { autoInit = true, agentInfo, ...routerOptions } = options;

    // Use ref for router to avoid re-renders
    const routerRef = useRef<A2ARouter | null>(null);
    const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);

    // State
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [health, setHealth] = useState<RouterHealthStatus>({
        initialized: false,
        availableProtocols: [],
        protocolStatus: {
            nostr: { available: false, peerCount: 0, subscribedTopics: [] },
            libp2p: { available: false, peerCount: 0, subscribedTopics: [] },
            magicblock: { available: false, peerCount: 0, subscribedTopics: [] },
            webrtc: { available: false, peerCount: 0, subscribedTopics: [] },
            'cross-chain': { available: false, peerCount: 0, subscribedTopics: [] },
        },
        totalPeers: 0,
        activeSubscriptions: 0,
    });
    const [agents, setAgents] = useState<AgentInfo[]>([]);

    // Initialize router instance
    useEffect(() => {
        routerRef.current = new A2ARouter(routerOptions);
        return () => {
            // Cleanup on unmount
            if (routerRef.current?.isInitialized()) {
                routerRef.current.shutdown();
            }
        };
    }, []);

    // Auto-initialize
    useEffect(() => {
        if (autoInit && routerRef.current && !isInitialized) {
            initialize();
        }
    }, [autoInit]);

    // Health check interval
    useEffect(() => {
        if (!isInitialized) return;

        const interval = setInterval(() => {
            if (routerRef.current) {
                setHealth(routerRef.current.health());
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isInitialized]);

    // Initialize function
    const initialize = useCallback(async () => {
        if (!routerRef.current || isInitialized) return;

        setIsLoading(true);
        setError(null);

        try {
            await routerRef.current.initialize();
            setIsInitialized(true);
            setHealth(routerRef.current.health());

            // Subscribe to messages
            const unsubscribe = await routerRef.current.subscribe((message) => {
                console.log('[useA2A] Received message:', message);
            });
            unsubscribeRef.current = unsubscribe;

            // Initial agent discovery
            await refreshAgents();

            // Broadcast capabilities if agent info provided
            if (agentInfo) {
                await routerRef.current.broadcastCapabilities(agentInfo);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            console.error('[useA2A] Initialization failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isInitialized, agentInfo]);

    // Shutdown function
    const shutdown = useCallback(async () => {
        if (!routerRef.current || !isInitialized) return;

        setIsLoading(true);

        try {
            // Unsubscribe from messages
            if (unsubscribeRef.current) {
                await unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            await routerRef.current.shutdown();
            setIsInitialized(false);
            setAgents([]);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            console.error('[useA2A] Shutdown failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isInitialized]);

    // Send message
    const send = useCallback(async (intent: A2AIntent): Promise<A2AResult> => {
        if (!routerRef.current || !isInitialized) {
            return {
                success: false,
                messageId: '',
                protocol: 'nostr',
                error: 'Router not initialized',
                errorCode: 'ROUTER_001',
                timestamp: Date.now(),
            };
        }

        try {
            return await routerRef.current.send(intent);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            return {
                success: false,
                messageId: '',
                protocol: 'nostr',
                error: error.message,
                errorCode: 'ROUTER_004',
                timestamp: Date.now(),
            };
        }
    }, [isInitialized]);

    // Subscribe to messages
    const subscribe = useCallback(
        async (handler: (message: A2AMessage) => void): Promise<() => Promise<void>> => {
            if (!routerRef.current || !isInitialized) {
                throw new Error('Router not initialized');
            }

            return await routerRef.current.subscribe(handler);
        },
        [isInitialized]
    );

    // Discover agents
    const discoverAgents = useCallback(
        async (filter?: AgentFilter): Promise<AgentInfo[]> => {
            if (!routerRef.current || !isInitialized) {
                return [];
            }

            try {
                return await routerRef.current.discoverAgents(filter);
            } catch (err) {
                console.error('[useA2A] Discover agents failed:', err);
                return [];
            }
        },
        [isInitialized]
    );

    // Broadcast capabilities
    const broadcastCapabilities = useCallback(async () => {
        if (!routerRef.current || !isInitialized || !agentInfo) {
            return;
        }

        try {
            await routerRef.current.broadcastCapabilities(agentInfo);
        } catch (err) {
            console.error('[useA2A] Broadcast capabilities failed:', err);
        }
    }, [isInitialized, agentInfo]);

    // Refresh agents list
    const refreshAgents = useCallback(async () => {
        const discovered = await discoverAgents();
        setAgents(discovered);
    }, [discoverAgents]);

    return {
        router: routerRef.current,
        isInitialized,
        isLoading,
        error,
        initialize,
        shutdown,
        send,
        subscribe,
        discoverAgents,
        broadcastCapabilities,
        health,
        agents,
        refreshAgents,
    };
}

export default useA2A;
