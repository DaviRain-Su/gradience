'use client';

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { ToastProvider } from '@/components/ui/ToastProvider';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export default function AppLayoutClient({ children }: { children: ReactNode }) {
    if (!PRIVY_APP_ID) {
        return <ToastProvider>{children}</ToastProvider>;
    }

    return (
        <ToastProvider>
            <PrivyProvider
                appId={PRIVY_APP_ID}
                config={{
                    loginMethods: ['google', 'email'],
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
        </ToastProvider>
    );
}
