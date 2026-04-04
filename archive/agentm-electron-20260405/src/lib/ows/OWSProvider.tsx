/**
 * OWS Provider - React Context for Wallet Connection
 *
 * Provides OWS wallet connection state and methods to the React component tree.
 * Integrates with Chain Hub for reputation data.
 *
 * @module lib/ows/OWSProvider
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
import { OWSService, getOWSService } from './OWSService.ts';
import type {
    OWSConfig,
    OWSIdentity,
    OWSWalletState,
    OWSContextValue,
    ReputationData,
} from './types.ts';

// Default configuration
const DEFAULT_CONFIG: OWSConfig = {
    network: 'devnet',
    defaultChain: 'solana',
    chainHubBaseUrl: 'https://indexer.gradiences.xyz',
};

// Initial wallet state
const INITIAL_WALLET_STATE: OWSWalletState = {
    connected: false,
    connecting: false,
    identity: null,
    error: null,
};

// Create context with undefined default (will be checked in useOWS)
const OWSContext = createContext<OWSContextValue | undefined>(undefined);

/**
 * OWS Provider Props
 */
export interface OWSProviderProps {
    /** Child components */
    children: ReactNode;
    /** OWS configuration */
    config?: Partial<OWSConfig>;
    /** Auto-reconnect on mount if previously connected */
    autoReconnect?: boolean;
}

/**
 * OWS Provider Component
 *
 * Wraps your application to provide OWS wallet connection context.
 *
 * @example
 * ```tsx
 * <OWSProvider config={{ network: 'devnet' }}>
 *   <App />
 * </OWSProvider>
 * ```
 */
export function OWSProvider({
    children,
    config: configOverride,
    autoReconnect = false,
}: OWSProviderProps) {
    const config = useMemo(
        () => ({ ...DEFAULT_CONFIG, ...configOverride }),
        [configOverride]
    );

    const [state, setState] = useState<OWSWalletState>(INITIAL_WALLET_STATE);
    const [reputation, setReputation] = useState<ReputationData | null>(null);
    const [reputationLoading, setReputationLoading] = useState(false);
    const [service] = useState(() => getOWSService(config));

    /**
     * Connect to OWS wallet
     */
    const connect = useCallback(async (): Promise<OWSIdentity> => {
        setState((prev) => ({ ...prev, connecting: true, error: null }));

        try {
            const identity = await service.connect();

            setState({
                connected: true,
                connecting: false,
                identity,
                error: null,
            });

            // Store connection state for auto-reconnect
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('ows-connected', 'true');
            }

            return identity;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
            setState({
                connected: false,
                connecting: false,
                identity: null,
                error: errorMessage,
            });
            throw error;
        }
    }, [service]);

    /**
     * Disconnect from OWS wallet
     */
    const disconnect = useCallback(async (): Promise<void> => {
        await service.disconnect();

        setState(INITIAL_WALLET_STATE);
        setReputation(null);

        // Clear connection state
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('ows-connected');
        }
    }, [service]);

    /**
     * Sign a message with connected wallet
     */
    const signMessage = useCallback(
        async (message: string): Promise<string> => {
            if (!state.connected) {
                throw new Error('Wallet not connected');
            }
            return service.signMessage(message);
        },
        [service, state.connected]
    );

    /**
     * Get reputation for connected wallet
     */
    const getReputation = useCallback(async (): Promise<ReputationData | null> => {
        if (!state.identity?.address) {
            return null;
        }
        return service.getReputation(state.identity.address);
    }, [service, state.identity?.address]);

    /**
     * Refresh reputation data
     */
    const refreshReputation = useCallback(async (): Promise<void> => {
        if (!state.identity?.address) {
            setReputation(null);
            return;
        }

        setReputationLoading(true);
        try {
            const data = await service.getReputation(state.identity.address);
            setReputation(data);
        } catch {
            // Keep existing reputation data on error
        } finally {
            setReputationLoading(false);
        }
    }, [service, state.identity?.address]);

    // Auto-reconnect on mount if configured and previously connected
    useEffect(() => {
        if (autoReconnect && typeof localStorage !== 'undefined') {
            const wasConnected = localStorage.getItem('ows-connected') === 'true';
            if (wasConnected && OWSService.isAvailable()) {
                connect().catch(() => {
                    // Silent fail on auto-reconnect - user can manually connect
                    localStorage.removeItem('ows-connected');
                });
            }
        }
    }, [autoReconnect, connect]);

    // Fetch reputation when identity changes
    useEffect(() => {
        if (state.identity?.address) {
            refreshReputation();

            // Set up periodic refresh (every 30 seconds)
            const interval = setInterval(() => {
                refreshReputation();
            }, 30_000);

            return () => clearInterval(interval);
        } else {
            setReputation(null);
        }
    }, [state.identity?.address, refreshReputation]);

    const contextValue: OWSContextValue = useMemo(
        () => ({
            state,
            connect,
            disconnect,
            signMessage,
            getReputation,
            refreshReputation,
            reputation,
            reputationLoading,
            config,
        }),
        [
            state,
            connect,
            disconnect,
            signMessage,
            getReputation,
            refreshReputation,
            reputation,
            reputationLoading,
            config,
        ]
    );

    return <OWSContext.Provider value={contextValue}>{children}</OWSContext.Provider>;
}

/**
 * Hook to access OWS context
 *
 * @returns OWS context value
 * @throws Error if used outside OWSProvider
 *
 * @example
 * ```tsx
 * function WalletButton() {
 *   const { state, connect, disconnect } = useOWS();
 *
 *   if (state.connected) {
 *     return <button onClick={disconnect}>Disconnect</button>;
 *   }
 *   return <button onClick={connect}>Connect Wallet</button>;
 * }
 * ```
 */
export function useOWS(): OWSContextValue {
    const context = useContext(OWSContext);
    if (!context) {
        throw new Error('useOWS must be used within an OWSProvider');
    }
    return context;
}

/**
 * Hook to check if OWS wallet is available in browser
 *
 * @returns Whether OWS is available
 */
export function useOWSAvailable(): boolean {
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        setAvailable(OWSService.isAvailable());
    }, []);

    return available;
}

export default OWSProvider;
