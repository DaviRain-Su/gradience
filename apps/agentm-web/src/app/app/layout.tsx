'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { ConnectionProvider as DaemonConnectionProvider } from '../../lib/connection/ConnectionContext';
import { DynamicProvider } from '../../lib/dynamic/DynamicProvider';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function AppLayout({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ color: '#16161A', opacity: 0.6 }}>Loading AgentM...</div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <DynamicProvider>
                <DaemonConnectionProvider>
                    {children}
                </DaemonConnectionProvider>
            </DynamicProvider>
        </ErrorBoundary>
    );
}
