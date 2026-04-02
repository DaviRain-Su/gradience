'use client';

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export default function AppLayout({ children }: { children: ReactNode }) {
    if (!PRIVY_APP_ID) {
        return <>{children}</>;
    }

    return (
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                loginMethods: ['google'],
                embeddedWallets: {
                    solana: { createOnLogin: 'users-without-wallets' },
                },
                appearance: {
                    theme: 'dark',
                },
            }}
        >
            {children}
        </PrivyProvider>
    );
}
