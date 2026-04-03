'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    OWSAgentRouter,
    type OWSAgentRoutingState,
    type OWSAgentSubWallet,
} from '@/lib/ows/agent-router';

export function useOWSAgentRouter(params: {
    accountKey: string | null;
    masterWallet: string | null;
}) {
    const { accountKey, masterWallet } = params;
    const routerRef = useRef(new OWSAgentRouter());
    const [state, setState] = useState<OWSAgentRoutingState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!accountKey || !masterWallet) {
            setState(null);
            return;
        }
        try {
            const next = routerRef.current.ensureState(accountKey, masterWallet);
            setState(next);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to init OWS agent router');
            setState(null);
        }
    }, [accountKey, masterWallet]);

    const createSubWallet = useCallback(
        async (handle: string): Promise<OWSAgentRoutingState | null> => {
            if (!accountKey || !masterWallet) return null;
            try {
                setBusy(true);
                const next = await routerRef.current.createSubWallet({
                    accountKey,
                    masterWallet,
                    handle,
                });
                setState(next);
                setError(null);
                return next;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create agent sub wallet');
                return null;
            } finally {
                setBusy(false);
            }
        },
        [accountKey, masterWallet]
    );

    const setActiveSubWallet = useCallback(
        (subWalletId: string | null): OWSAgentRoutingState | null => {
            if (!accountKey) return null;
            try {
                const next = routerRef.current.setActiveSubWallet(accountKey, subWalletId);
                setState(next);
                setError(null);
                return next;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to switch active sub wallet');
                return null;
            }
        },
        [accountKey]
    );

    const signActiveRoute = useCallback(
        async (routeType: 'task_settlement' | 'agent_payment' | 'custom', payload: unknown) => {
            if (!accountKey) return null;
            try {
                setBusy(true);
                const result = await routerRef.current.signWithActiveSubWallet({
                    accountKey,
                    request: {
                        routeType,
                        payload,
                    },
                });
                setState(result.state);
                setError(null);
                return result.receipt;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to sign route');
                return null;
            } finally {
                setBusy(false);
            }
        },
        [accountKey]
    );

    const activeSubWallet: OWSAgentSubWallet | null =
        state?.subWallets.find((wallet) => wallet.id === state.activeSubWalletId) ?? null;

    return {
        state,
        activeSubWallet,
        error,
        busy,
        createSubWallet,
        setActiveSubWallet,
        signActiveRoute,
    } as const;
}
