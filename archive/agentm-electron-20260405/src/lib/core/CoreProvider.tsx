/**
 * Core Provider - React Context for AgentM Core SDK
 *
 * Provides AgentM Core SDK functionality to the React component tree.
 * Handles connection management, transaction submission, and account fetching.
 *
 * @module lib/core/CoreProvider
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useMemo,
    type ReactNode,
} from 'react';
import { CoreService, getCoreService } from './CoreService.ts';
import type {
    CoreConfig,
    CoreConnectionState,
    CoreContextValue,
    CreateAgentInput,
    UpdateProfileInput,
    UpdateAgentConfigInput,
    UpdateReputationInput,
    TransactionResult,
    PendingTransaction,
    AgentAccountData,
    UserProfileData,
    ReputationData,
} from './types.ts';

// Default configuration
const DEFAULT_CONFIG: CoreConfig = {
    rpcEndpoint: 'https://api.devnet.solana.com',
    programId: 'AgntMCorexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    network: 'devnet',
    commitment: 'confirmed',
};

// Initial connection state
const INITIAL_CONNECTION_STATE: CoreConnectionState = {
    connected: false,
    connecting: false,
    endpoint: null,
    error: null,
    slot: null,
};

// Create context with undefined default
const CoreContext = createContext<CoreContextValue | undefined>(undefined);

/**
 * Core Provider Props
 */
export interface CoreProviderProps {
    /** Child components */
    children: ReactNode;
    /** Core configuration */
    config?: Partial<CoreConfig>;
    /** Wallet address for signing transactions */
    walletAddress?: string | null;
    /** Sign transaction callback */
    signTransaction?: (transaction: Uint8Array) => Promise<Uint8Array>;
    /** Auto-connect on mount */
    autoConnect?: boolean;
}

/**
 * Core Provider Component
 *
 * Wraps your application to provide AgentM Core SDK context.
 *
 * @example
 * ```tsx
 * <CoreProvider
 *   config={{ network: 'devnet' }}
 *   walletAddress={publicKey}
 *   autoConnect
 * >
 *   <App />
 * </CoreProvider>
 * ```
 */
export function CoreProvider({
    children,
    config: configOverride,
    walletAddress,
    autoConnect = false,
}: CoreProviderProps) {
    const config = useMemo(
        () => ({ ...DEFAULT_CONFIG, ...configOverride }),
        [configOverride]
    );

    const [connectionState, setConnectionState] = useState<CoreConnectionState>(INITIAL_CONNECTION_STATE);
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [service] = useState(() => getCoreService(config));

    /**
     * Connect to Solana network
     */
    const connect = useCallback(async (): Promise<void> => {
        setConnectionState((prev) => ({ ...prev, connecting: true, error: null }));

        try {
            await service.connect();
            setConnectionState(service.connectionState);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Connection failed';
            setConnectionState({
                connected: false,
                connecting: false,
                endpoint: null,
                error: errorMessage,
                slot: null,
            });
            throw error;
        }
    }, [service]);

    /**
     * Disconnect from network
     */
    const disconnect = useCallback((): void => {
        service.disconnect();
        setConnectionState(INITIAL_CONNECTION_STATE);
        setPendingTransactions([]);
    }, [service]);

    /**
     * Add pending transaction
     */
    const addPendingTransaction = useCallback(
        (type: PendingTransaction['type'], signature: string): void => {
            const tx: PendingTransaction = {
                id: signature,
                type,
                status: 'pending',
                submittedAt: Date.now(),
                updatedAt: Date.now(),
            };
            setPendingTransactions((prev) => [...prev, tx]);
        },
        []
    );

    /**
     * Update pending transaction status
     */
    const updateTransactionStatus = useCallback(
        (signature: string, status: PendingTransaction['status'], error?: string): void => {
            setPendingTransactions((prev) =>
                prev.map((tx) =>
                    tx.id === signature
                        ? { ...tx, status, error, updatedAt: Date.now() }
                        : tx
                )
            );
        },
        []
    );

    /**
     * Register a new user
     */
    const registerUser = useCallback(
        async (username: string): Promise<TransactionResult> => {
            if (!walletAddress) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            try {
                const result = await service.registerUser(username, walletAddress);
                addPendingTransaction('register_user', result.signature);

                if (result.status === 'confirmed' || result.status === 'finalized') {
                    updateTransactionStatus(result.signature, result.status);
                }

                return result;
            } finally {
                setLoading(false);
            }
        },
        [service, walletAddress, addPendingTransaction, updateTransactionStatus]
    );

    /**
     * Update user profile
     */
    const updateProfile = useCallback(
        async (input: UpdateProfileInput): Promise<TransactionResult> => {
            if (!walletAddress) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            try {
                const result = await service.updateProfile(input, walletAddress);
                addPendingTransaction('update_profile', result.signature);

                if (result.status === 'confirmed' || result.status === 'finalized') {
                    updateTransactionStatus(result.signature, result.status);
                }

                return result;
            } finally {
                setLoading(false);
            }
        },
        [service, walletAddress, addPendingTransaction, updateTransactionStatus]
    );

    /**
     * Create a new agent
     */
    const createAgent = useCallback(
        async (input: CreateAgentInput): Promise<TransactionResult> => {
            if (!walletAddress) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            try {
                const result = await service.createAgent(input, walletAddress);
                addPendingTransaction('create_agent', result.signature);

                if (result.status === 'confirmed' || result.status === 'finalized') {
                    updateTransactionStatus(result.signature, result.status);
                }

                return result;
            } finally {
                setLoading(false);
            }
        },
        [service, walletAddress, addPendingTransaction, updateTransactionStatus]
    );

    /**
     * Update agent configuration
     */
    const updateAgentConfig = useCallback(
        async (agentAddress: string, input: UpdateAgentConfigInput): Promise<TransactionResult> => {
            if (!walletAddress) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            try {
                const result = await service.updateAgentConfig(agentAddress, input, walletAddress);
                addPendingTransaction('update_agent', result.signature);

                if (result.status === 'confirmed' || result.status === 'finalized') {
                    updateTransactionStatus(result.signature, result.status);
                }

                return result;
            } finally {
                setLoading(false);
            }
        },
        [service, walletAddress, addPendingTransaction, updateTransactionStatus]
    );

    /**
     * Update agent reputation
     */
    const updateReputation = useCallback(
        async (agentAddress: string, input: UpdateReputationInput): Promise<TransactionResult> => {
            if (!walletAddress) {
                throw new Error('Wallet not connected');
            }

            setLoading(true);
            try {
                const result = await service.updateReputation(agentAddress, input, walletAddress);
                addPendingTransaction('update_reputation', result.signature);

                if (result.status === 'confirmed' || result.status === 'finalized') {
                    updateTransactionStatus(result.signature, result.status);
                }

                return result;
            } finally {
                setLoading(false);
            }
        },
        [service, walletAddress, addPendingTransaction, updateTransactionStatus]
    );

    /**
     * Get user profile
     */
    const getUserProfile = useCallback(
        async (address: string): Promise<UserProfileData | null> => {
            return service.getUserProfile(address);
        },
        [service]
    );

    /**
     * Get agent data
     */
    const getAgent = useCallback(
        async (address: string): Promise<AgentAccountData | null> => {
            return service.getAgent(address);
        },
        [service]
    );

    /**
     * Get reputation data
     */
    const getReputation = useCallback(
        async (agentAddress: string): Promise<ReputationData | null> => {
            return service.getReputation(agentAddress);
        },
        [service]
    );

    /**
     * List user's agents
     */
    const listUserAgents = useCallback(
        async (ownerAddress: string): Promise<AgentAccountData[]> => {
            return service.listUserAgents(ownerAddress);
        },
        [service]
    );

    // Auto-connect on mount if configured
    useEffect(() => {
        if (autoConnect && CoreService.isAvailable()) {
            connect().catch(() => {
                // Silent fail on auto-connect
            });
        }
    }, [autoConnect, connect]);

    // Clean up stale pending transactions (older than 5 minutes)
    useEffect(() => {
        const interval = setInterval(() => {
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            setPendingTransactions((prev) =>
                prev.filter(
                    (tx) =>
                        tx.status === 'pending' ||
                        tx.status === 'processing' ||
                        tx.updatedAt > fiveMinutesAgo
                )
            );
        }, 60_000);

        return () => clearInterval(interval);
    }, []);

    const contextValue: CoreContextValue = useMemo(
        () => ({
            connectionState,
            config,
            connect,
            disconnect,
            registerUser,
            updateProfile,
            createAgent,
            updateAgentConfig,
            updateReputation,
            getUserProfile,
            getAgent,
            getReputation,
            listUserAgents,
            pendingTransactions,
            loading,
        }),
        [
            connectionState,
            config,
            connect,
            disconnect,
            registerUser,
            updateProfile,
            createAgent,
            updateAgentConfig,
            updateReputation,
            getUserProfile,
            getAgent,
            getReputation,
            listUserAgents,
            pendingTransactions,
            loading,
        ]
    );

    return <CoreContext.Provider value={contextValue}>{children}</CoreContext.Provider>;
}

/**
 * Hook to access Core context
 *
 * @returns Core context value
 * @throws Error if used outside CoreProvider
 *
 * @example
 * ```tsx
 * function CreateAgentButton() {
 *   const { createAgent, loading } = useCoreContext();
 *
 *   const handleCreate = async () => {
 *     await createAgent({ name: 'My Agent', agentType: 'task_executor' });
 *   };
 *
 *   return (
 *     <button onClick={handleCreate} disabled={loading}>
 *       Create Agent
 *     </button>
 *   );
 * }
 * ```
 */
export function useCoreContext(): CoreContextValue {
    const context = useContext(CoreContext);
    if (!context) {
        throw new Error('useCoreContext must be used within a CoreProvider');
    }
    return context;
}

/**
 * Hook to check if CoreProvider is available
 *
 * @returns Whether Core context is available
 */
export function useCoreAvailable(): boolean {
    const context = useContext(CoreContext);
    return context !== undefined;
}

export default CoreProvider;
