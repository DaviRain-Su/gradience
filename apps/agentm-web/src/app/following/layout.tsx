'use client';

import { type ReactNode } from 'react';
import { ConnectionProvider as DaemonConnectionProvider } from '../../lib/connection/ConnectionContext';
import { DynamicProvider } from '../../lib/dynamic/DynamicProvider';

export default function FollowingLayout({ children }: { children: ReactNode }) {
    return (
        <DynamicProvider>
            <DaemonConnectionProvider>
                {children}
            </DaemonConnectionProvider>
        </DynamicProvider>
    );
}
