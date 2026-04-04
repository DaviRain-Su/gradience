import { useEffect, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnection } from '@/lib/connection/ConnectionContext';

export function useSessionAuth() {
    const { primaryWallet } = useDynamicContext();
    const { isConnected, sessionToken, authenticate, walletAddress } = useConnection();
    const attemptedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!primaryWallet) return;
        if (sessionToken && walletAddress === primaryWallet.address) return;
        if (attemptedRef.current === primaryWallet.address) return;

        attemptedRef.current = primaryWallet.address;

        const doAuth = async () => {
            try {
                const signer = await primaryWallet.getSigner();
                if (!signer || typeof signer.signMessage !== 'function') {
                    console.warn('Wallet does not support signMessage');
                    return;
                }
                await authenticate(
                    primaryWallet.address,
                    (msg: Uint8Array) => signer.signMessage(msg),
                );
            } catch (err) {
                console.error('Session auth failed:', err);
                attemptedRef.current = null;
            }
        };

        doAuth();
    }, [primaryWallet, sessionToken, walletAddress, authenticate]);

    return { isAuthenticated: !!sessionToken, walletAddress };
}
