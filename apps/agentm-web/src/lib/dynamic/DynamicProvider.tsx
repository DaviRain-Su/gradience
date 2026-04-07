'use client';

import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { SolanaWalletConnectors } from '@dynamic-labs/solana';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { ReactNode, useEffect, useRef } from 'react';
import { useConnection } from '@/lib/connection/ConnectionContext';

const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '';

interface DynamicProviderProps {
    children: ReactNode;
}

// Internal component to handle auth bridge
function DynamicAuthBridge({ children }: { children: ReactNode }) {
    const { primaryWallet, user } = useDynamicContext();
    const { sessionToken, authenticate } = useConnection();
    const attemptedRef = useRef<string | null>(null);

    // Auto-bridge Dynamic auth to ConnectionContext
    useEffect(() => {
        if (!user || !primaryWallet?.address) return;
        if (sessionToken && attemptedRef.current === primaryWallet.address) return;
        if (attemptedRef.current === primaryWallet.address) return;

        attemptedRef.current = primaryWallet.address;

        const doAuth = async () => {
            try {
                const signer = await (primaryWallet as any).getSigner?.();
                if (!signer || typeof signer.signMessage !== 'function') {
                    // Try connector as fallback
                    const connector = (primaryWallet as any).connector;
                    if (connector && typeof connector.signMessage === 'function') {
                        await authenticate(
                            primaryWallet.address,
                            (msg: Uint8Array) => connector.signMessage(msg),
                        );
                        return;
                    }
                    console.error('[DynamicAuthBridge] No signMessage method available on wallet');
                    attemptedRef.current = null;
                    return;
                }
                await authenticate(
                    primaryWallet.address,
                    (msg: Uint8Array) => signer.signMessage(msg),
                );
            } catch (err) {
                console.error('[DynamicAuthBridge] Session auth failed:', err);
                attemptedRef.current = null;
            }
        };

        doAuth();
    }, [user, primaryWallet, sessionToken, authenticate]);

    return <>{children}</>;
}

export function DynamicProvider({ children }: DynamicProviderProps) {
    // Clean environment ID - remove any whitespace or newlines
    const envId = (environmentId || '5a93f4bd-397a-43c1-b990-8874810ea0fc').trim();

    console.log('Dynamic Environment ID:', envId);

    return (
        <DynamicContextProvider
            settings={{
                environmentId: envId,
                appName: 'AgentM',
                appLogoUrl: '',
                walletConnectors: [
                    (props?: any) => SolanaWalletConnectors(props),
                    (props?: any) => EthereumWalletConnectors(props),
                ] as any,
                redirectUrl: undefined,
                events: {
                    onAuthFlowClose: () => {
                        console.log('Dynamic auth flow closed');
                    },
                    onAuthSuccess: (args) => {
                        console.log('Dynamic auth success:', args.user?.email);
                        // Auth bridge is handled by DynamicAuthBridge component
                    },
                },

            }}
        >
            <DynamicAuthBridge>
                {children}
            </DynamicAuthBridge>
        </DynamicContextProvider>
    );
}
