/**
 * useCore Hook - Core SDK Access
 *
 * React hooks for accessing AgentM Core SDK features.
 * Provides convenient access to core functionality with
 * loading states, error handling, and auto-refresh.
 *
 * @module lib/core/useCore
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCoreContext, useCoreAvailable } from './CoreProvider.tsx';
import { getCoreService } from './CoreService.ts';
import type {
    CoreContextValue,
    AgentAccountData,
    UserProfileData,
    ReputationData,
    UpdateProfileInput,
    TransactionResult,
    CoreConfig,
} from './types.ts';

/**
 * useCore - Access core context with availability check
 *
 * @returns Core context and availability flag
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { core, available } = useCore();
 *
 *   if (!available) {
 *     return <div>Core not available</div>;
 *   }
 *
 *   return <div>Connected: {core.connectionState.connected}</div>;
 * }
 * ```
 */
export function useCore(): { core: CoreContextValue | null; available: boolean } {
    const available = useCoreAvailable();

    // We need to call the hook conditionally based on availability
    // This is safe because availability doesn't change during render
    let core: CoreContextValue | null = null;

    try {
        if (available) {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            core = useCoreContext();
        }
    } catch {
        // Context not available
    }

    return { core, available };
}

/**
 * useAgent hook options
 */
export interface UseAgentOptions {
    /** Auto-refresh interval in ms (0 to disable) */
    refreshInterval?: number;
}

/**
 * useAgent - Fetch and manage agent data
 *
 * @param address - Agent address to fetch
 * @param options - Hook options
 * @returns Agent data, reputation, and loading state
 *
 * @example
 * ```tsx
 * function AgentCard({ address }: { address: string }) {
 *   const { agent, reputation, loading, error } = useAgent(address);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!agent) return <div>Agent not found</div>;
 *
 *   return (
 *     <div>
 *       <h3>{agent.name}</h3>
 *       <p>Score: {reputation?.avgScore ?? 'N/A'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgent(
    address: string | null,
    options: UseAgentOptions = {}
): {
    agent: AgentAccountData | null;
    reputation: ReputationData | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
} {
    const { refreshInterval = 30_000 } = options;
    const { core } = useCore();

    const [agent, setAgent] = useState<AgentAccountData | null>(null);
    const [reputation, setReputation] = useState<ReputationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!address || !core?.connectionState.connected) {
            setAgent(null);
            setReputation(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [agentData, reputationData] = await Promise.all([
                core.getAgent(address),
                core.getReputation(address),
            ]);
            setAgent(agentData);
            setReputation(reputationData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load agent');
        } finally {
            setLoading(false);
        }
    }, [address, core]);

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh
    useEffect(() => {
        if (refreshInterval <= 0 || !address || !core?.connectionState.connected) return;

        const interval = setInterval(refresh, refreshInterval);
        return () => clearInterval(interval);
    }, [refresh, refreshInterval, address, core?.connectionState.connected]);

    return { agent, reputation, loading, error, refresh };
}

/**
 * useProfile hook options
 */
export interface UseProfileOptions {
    /** Auto-refresh interval in ms (0 to disable) */
    refreshInterval?: number;
}

/**
 * useProfile - Fetch and manage user profile
 *
 * @param address - User address to fetch
 * @param options - Hook options
 * @returns Profile data, loading state, and update function
 *
 * @example
 * ```tsx
 * function ProfileEditor({ address }: { address: string }) {
 *   const { profile, loading, update } = useProfile(address);
 *
 *   const handleSave = async (displayName: string) => {
 *     await update({ displayName });
 *   };
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); handleSave(displayName); }}>
 *       <input defaultValue={profile?.displayName} />
 *     </form>
 *   );
 * }
 * ```
 */
export function useProfile(
    address: string | null,
    options: UseProfileOptions = {}
): {
    profile: UserProfileData | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    update: (input: UpdateProfileInput) => Promise<TransactionResult>;
} {
    const { refreshInterval = 30_000 } = options;
    const { core } = useCore();

    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!address || !core?.connectionState.connected) {
            setProfile(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await core.getUserProfile(address);
            setProfile(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, [address, core]);

    const update = useCallback(
        async (input: UpdateProfileInput): Promise<TransactionResult> => {
            if (!core) {
                throw new Error('Core not available');
            }

            const result = await core.updateProfile(input);

            // Refresh profile after successful update
            if (result.status === 'confirmed' || result.status === 'finalized') {
                await refresh();
            }

            return result;
        },
        [core, refresh]
    );

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh
    useEffect(() => {
        if (refreshInterval <= 0 || !address || !core?.connectionState.connected) return;

        const interval = setInterval(refresh, refreshInterval);
        return () => clearInterval(interval);
    }, [refresh, refreshInterval, address, core?.connectionState.connected]);

    return { profile, loading, error, refresh, update };
}

/**
 * useReputation hook options
 */
export interface UseCoreReputationOptions {
    /** Auto-refresh interval in ms (0 to disable) */
    refreshInterval?: number;
    /** Optional custom config */
    config?: Partial<CoreConfig>;
}

/**
 * useCoreReputation - Fetch reputation from Core SDK
 *
 * Can be used standalone (without CoreProvider) for read-only access.
 *
 * @param agentAddress - Agent address to fetch reputation for
 * @param options - Hook options
 * @returns Reputation data and loading state
 *
 * @example
 * ```tsx
 * function ReputationBadge({ address }: { address: string }) {
 *   const { reputation, loading } = useCoreReputation(address);
 *
 *   if (loading) return <span>...</span>;
 *   if (!reputation) return null;
 *
 *   return (
 *     <span>
 *       Score: {reputation.avgScore.toFixed(1)}
 *     </span>
 *   );
 * }
 * ```
 */
export function useCoreReputation(
    agentAddress: string | null,
    options: UseCoreReputationOptions = {}
): {
    reputation: ReputationData | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
} {
    const { refreshInterval = 30_000, config } = options;

    const [reputation, setReputation] = useState<ReputationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const service = useMemo(() => getCoreService(config), [config]);

    const refresh = useCallback(async () => {
        if (!agentAddress) {
            setReputation(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Ensure connected
            if (!service.connectionState.connected) {
                await service.connect();
            }

            const data = await service.getReputation(agentAddress);
            setReputation(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load reputation');
        } finally {
            setLoading(false);
        }
    }, [agentAddress, service]);

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh
    useEffect(() => {
        if (refreshInterval <= 0 || !agentAddress) return;

        const interval = setInterval(refresh, refreshInterval);
        return () => clearInterval(interval);
    }, [refresh, refreshInterval, agentAddress]);

    return { reputation, loading, error, refresh };
}

/**
 * useUserAgents - List agents owned by a user
 *
 * @param ownerAddress - Owner address to fetch agents for
 * @returns List of agents and loading state
 *
 * @example
 * ```tsx
 * function AgentList({ owner }: { owner: string }) {
 *   const { agents, loading, refresh } = useUserAgents(owner);
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {agents.map((agent) => (
 *         <li key={agent.address}>{agent.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useUserAgents(
    ownerAddress: string | null
): {
    agents: AgentAccountData[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
} {
    const { core } = useCore();

    const [agents, setAgents] = useState<AgentAccountData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!ownerAddress || !core?.connectionState.connected) {
            setAgents([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await core.listUserAgents(ownerAddress);
            setAgents(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load agents');
        } finally {
            setLoading(false);
        }
    }, [ownerAddress, core]);

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    return { agents, loading, error, refresh };
}

/**
 * useConnectionState - Access connection state
 *
 * @returns Connection state from core context
 *
 * @example
 * ```tsx
 * function ConnectionStatus() {
 *   const { connected, connecting, error, slot } = useConnectionState();
 *
 *   if (connecting) return <span>Connecting...</span>;
 *   if (error) return <span>Error: {error}</span>;
 *   if (!connected) return <span>Disconnected</span>;
 *
 *   return <span>Connected (slot: {slot})</span>;
 * }
 * ```
 */
export function useConnectionState() {
    const { core, available } = useCore();

    if (!available || !core) {
        return {
            connected: false,
            connecting: false,
            endpoint: null,
            error: null,
            slot: null,
        };
    }

    return core.connectionState;
}

/**
 * usePendingTransactions - Access pending transactions
 *
 * @returns Pending transactions from core context
 */
export function usePendingTransactions() {
    const { core, available } = useCore();

    if (!available || !core) {
        return [];
    }

    return core.pendingTransactions;
}

export default useCore;
