'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WalletAdapter } from '@gradiences/sdk';
import type { Address } from '@solana/kit';

import { createWalletAdapter } from './sdk';
import {
    extractWalletAddress,
    type InjectedWalletDescriptor,
    InjectedBrowserWalletAdapter,
    listInjectedWallets,
} from './injected-wallet';
import { useLocalSigner } from './use-local-signer';

type ActiveWalletKind = 'local' | 'injected' | null;

export interface FrontendWalletState {
    signerAddress: string | null;
    adapter: WalletAdapter | null;
    activeWalletKind: ActiveWalletKind;
    secretInput: string;
    setSecretInput: (value: string) => void;
    localConnecting: boolean;
    connectLocal: () => Promise<void>;
    disconnectLocal: () => void;
    injectedWallets: InjectedWalletDescriptor[];
    injectedConnecting: boolean;
    injectedError: string | null;
    refreshInjectedWallets: () => void;
    connectInjected: (id: string) => Promise<void>;
    disconnectInjected: () => Promise<void>;
}

export function useFrontendWallet(): FrontendWalletState {
    const local = useLocalSigner();
    const [activeWalletKind, setActiveWalletKind] = useState<ActiveWalletKind>(null);
    const [injectedWallets, setInjectedWallets] = useState<InjectedWalletDescriptor[]>([]);
    const [injectedAdapter, setInjectedAdapter] = useState<InjectedBrowserWalletAdapter | null>(null);
    const [injectedConnecting, setInjectedConnecting] = useState(false);
    const [injectedError, setInjectedError] = useState<string | null>(null);

    const refreshInjectedWallets = useCallback(() => {
        const next = listInjectedWallets();
        setInjectedWallets(current => {
            if (sameWalletList(current, next)) {
                return current;
            }
            return next;
        });
    }, []);

    useEffect(() => {
        refreshInjectedWallets();
        const interval = setInterval(refreshInjectedWallets, 1500);
        const onVisibility = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                refreshInjectedWallets();
            }
        };
        const onFocus = () => refreshInjectedWallets();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', onFocus);
        }
        return () => {
            clearInterval(interval);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibility);
            }
            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', onFocus);
            }
        };
    }, [refreshInjectedWallets]);

    const connectLocal = useCallback(async () => {
        await local.connect();
        setActiveWalletKind('local');
        setInjectedError(null);
    }, [local]);

    const disconnectLocal = useCallback(() => {
        local.disconnect();
        if (activeWalletKind === 'local') {
            setActiveWalletKind(injectedAdapter ? 'injected' : null);
        }
    }, [activeWalletKind, injectedAdapter, local]);

    const connectInjected = useCallback(
        async (id: string) => {
            const selected = injectedWallets.find(wallet => wallet.id === id);
            if (!selected) {
                setInjectedError(`Wallet ${id} not found`);
                return;
            }

            setInjectedConnecting(true);
            setInjectedError(null);
            try {
                const response = await selected.provider.connect();
                const connectedAddress = extractWalletAddress(selected.provider, response);
                if (!connectedAddress) {
                    throw new Error('Wallet connected but no public key returned');
                }
                setInjectedAdapter(new InjectedBrowserWalletAdapter(selected.provider, connectedAddress as Address));
                setActiveWalletKind('injected');
            } catch (error) {
                setInjectedError(error instanceof Error ? error.message : String(error));
            } finally {
                setInjectedConnecting(false);
            }
        },
        [injectedWallets],
    );

    const disconnectInjected = useCallback(async () => {
        if (injectedAdapter?.provider.disconnect) {
            await injectedAdapter.provider.disconnect();
        }
        setInjectedAdapter(null);
        setInjectedError(null);
        if (activeWalletKind === 'injected') {
            setActiveWalletKind(local.signer ? 'local' : null);
        }
    }, [activeWalletKind, injectedAdapter, local.signer]);

    const adapter = useMemo<WalletAdapter | null>(() => {
        if (activeWalletKind === 'injected' && injectedAdapter) {
            return injectedAdapter;
        }
        if (local.signer) {
            return createWalletAdapter(local.signer);
        }
        return null;
    }, [activeWalletKind, injectedAdapter, local.signer]);

    const signerAddress = useMemo(() => {
        if (activeWalletKind === 'injected' && injectedAdapter) {
            return String(injectedAdapter.address);
        }
        return local.signerAddress;
    }, [activeWalletKind, injectedAdapter, local.signerAddress]);

    return {
        signerAddress,
        adapter,
        activeWalletKind,
        secretInput: local.secretInput,
        setSecretInput: local.setSecretInput,
        localConnecting: local.connecting,
        connectLocal,
        disconnectLocal,
        injectedWallets,
        injectedConnecting,
        injectedError,
        refreshInjectedWallets,
        connectInjected,
        disconnectInjected,
    };
}

function sameWalletList(current: InjectedWalletDescriptor[], next: InjectedWalletDescriptor[]): boolean {
    if (current.length !== next.length) {
        return false;
    }
    return current.every((wallet, index) => {
        const target = next[index];
        if (!target) {
            return false;
        }
        return wallet.id === target.id && wallet.provider === target.provider;
    });
}
