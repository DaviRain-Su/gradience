'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ConnectionProvider } from '@/lib/connection/ConnectionContext';
import { DynamicProvider } from '../lib/dynamic/DynamicProvider';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Prevent SSR/hydration mismatch and window access during server render.
        // Children that depend on DynamicProvider (e.g. /app) must wait until
        // the client has mounted to avoid calling useDynamicContext() too early.
        return <div style={{ minHeight: '100vh', background: '#F3F3F8' }} />;
    }

    return (
        <ConnectionProvider>
            <DynamicProvider>{children}</DynamicProvider>
        </ConnectionProvider>
    );
}
