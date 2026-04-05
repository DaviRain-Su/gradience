'use client';

import { ReactNode } from 'react';
import { ConnectionProvider } from '@/lib/connection/ConnectionContext';
import { DynamicProviderClient } from './DynamicProviderClient';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <ConnectionProvider>
            <DynamicProviderClient>
                {children}
            </DynamicProviderClient>
        </ConnectionProvider>
    );
}
