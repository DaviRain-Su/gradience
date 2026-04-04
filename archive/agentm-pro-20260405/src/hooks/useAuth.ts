'use client';

import { useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function useAuth() {
    const { ready, authenticated, login, logout, user } = usePrivy();

    const publicKey = useMemo(() => {
        const wallet = user?.linkedAccounts?.find((account) => {
            return account.type === 'wallet' && account.chainType === 'solana' && 'address' in account;
        });
        return wallet && 'address' in wallet ? wallet.address : null;
    }, [user]);

    return {
        ready,
        authenticated,
        login,
        logout,
        user,
        publicKey,
        email: user?.email?.address ?? null,
    };
}
