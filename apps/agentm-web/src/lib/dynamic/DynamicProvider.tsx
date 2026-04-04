'use client';

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { SolanaWalletConnectors } from '@dynamic-labs/solana';
import { ReactNode } from 'react';

const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '';

interface DynamicProviderProps {
    children: ReactNode;
}

export function DynamicProvider({ children }: DynamicProviderProps) {
    // Hardcode environment ID if not set
    const envId = environmentId || '5a93f4bd-397a-43c1-b990-8874810ea0fc';

    return (
        <DynamicContextProvider
            settings={{
                environmentId: envId,
                appName: 'AgentM',
                appLogoUrl: '',
                walletConnectors: [SolanaWalletConnectors],
                socialProviders: {
                    google: {
                        enabled: true,
                    },
                    twitter: {
                        enabled: true,
                    },
                    discord: {
                        enabled: true,
                    },
                },
                // Prevent redirect after login, stay on same page
                redirectUrl: typeof window !== 'undefined' ? window.location.href : '/app',
            }}
        >
            {children}
        </DynamicContextProvider>
    );
}
