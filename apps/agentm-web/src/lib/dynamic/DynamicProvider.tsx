'use client';

import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { SolanaWalletConnectors } from '@dynamic-labs/solana';
import { ReactNode } from 'react';

const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '';

interface DynamicProviderProps {
    children: ReactNode;
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
                walletConnectors: [SolanaWalletConnectors],
                redirectUrl: undefined,
                events: {
                    onAuthFlowClose: () => {
                        console.log('Dynamic auth flow closed');
                    },
                    onAuthSuccess: (args) => {
                        console.log('Dynamic auth success:', args.user?.email);
                    },
                },

            }}
        >
            {children}
        </DynamicContextProvider>
    );
}
