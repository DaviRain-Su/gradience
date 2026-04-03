'use client';

import { useCallback, useRef, useState } from 'react';
import { OWSWalletAdapter } from '@/lib/ows';
import type { OWSConfig, OWSIdentity, OWSWalletState, TaskAgreement } from '@/lib/ows';

const DEFAULT_STATE: OWSWalletState = {
    connected: false,
    connecting: false,
    identity: null,
    error: null,
};

export function useOWS(config?: Partial<OWSConfig>) {
    const [state, setState] = useState<OWSWalletState>(DEFAULT_STATE);
    const adapterRef = useRef<OWSWalletAdapter | null>(null);

    const getAdapter = useCallback(() => {
        if (!adapterRef.current) {
            adapterRef.current = new OWSWalletAdapter(config);
        }
        return adapterRef.current;
    }, [config]);

    const connect = useCallback(async () => {
        setState((s) => ({ ...s, connecting: true, error: null }));
        try {
            const adapter = getAdapter();
            const identity = await adapter.connect();
            setState({ connected: true, connecting: false, identity, error: null });
            return identity;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Connection failed';
            setState((s) => ({ ...s, connecting: false, error: message }));
            return null;
        }
    }, [getAdapter]);

    const disconnect = useCallback(async () => {
        const adapter = getAdapter();
        await adapter.disconnect();
        setState(DEFAULT_STATE);
    }, [getAdapter]);

    const signTaskAgreement = useCallback(
        async (agreement: TaskAgreement): Promise<string | null> => {
            try {
                const adapter = getAdapter();
                return await adapter.signTaskAgreement(agreement);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Signing failed';
                setState((s) => ({ ...s, error: message }));
                return null;
            }
        },
        [getAdapter]
    );

    const getReputationCredential = useCallback(async () => {
        const adapter = getAdapter();
        return adapter.getReputationCredential();
    }, [getAdapter]);

    return {
        ...state,
        connect,
        disconnect,
        signTaskAgreement,
        getReputationCredential,
    } as const;
}

/** Convenience: check if OWS wallet is available in the browser */
export function isOWSAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as { ows?: unknown; solana?: { isOWS?: boolean } };
    return !!(win.ows || win.solana?.isOWS);
}
