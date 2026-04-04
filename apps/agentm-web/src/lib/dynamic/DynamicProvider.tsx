'use client';

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { SolanaWalletConnectors } from '@dynamic-labs/solana';
import { ReactNode } from 'react';

const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '';

interface DynamicProviderProps {
    children: ReactNode;
}

export function DynamicProvider({ children }: DynamicProviderProps) {
    if (!environmentId) {
        console.warn('Dynamic Environment ID not configured');
        return <>{children}</>;
    }

    return (
        <DynamicContextProvider
            settings={{
                environmentId,
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
            }}
        >
            {children}
        </DynamicContextProvider>
    );
}
