import { useEffect, useRef, useCallback, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnection } from '@/lib/connection/ConnectionContext';

export function useSessionAuth() {
    const { primaryWallet } = useDynamicContext();
    const { sessionToken, authenticate, walletAddress } = useConnection();
    const attemptedRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!primaryWallet) return;
        if (sessionToken && walletAddress === primaryWallet.address) return;
        if (attemptedRef.current === primaryWallet.address) return;

        attemptedRef.current = primaryWallet.address;

        const doAuth = async () => {
            try {
                const signer = await (primaryWallet as any).getSigner?.();
                if (!signer || typeof signer.signMessage !== 'function') {
                    console.warn('Wallet does not support signMessage, trying connector.signMessage');
                    const connector = (primaryWallet as any).connector;
                    if (connector && typeof connector.signMessage === 'function') {
                        await authenticate(
                            primaryWallet.address,
                            (msg: Uint8Array) => connector.signMessage(msg),
                        );
                        return;
                    }
                    console.error('No signMessage method available on wallet');
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

    const logout = useCallback(() => {
        localStorage.removeItem('sessionToken');
        window.location.reload();
    }, []);

    const refreshSession = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to refresh session');
            }
            const data = await response.json();
            localStorage.setItem('sessionToken', data.sessionToken);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [sessionToken]);

    return {
        isAuthenticated: !!sessionToken,
        walletAddress,
        sessionToken,
        isLoading,
        error,
        authenticate,
        logout,
        refreshSession,
    };
}
