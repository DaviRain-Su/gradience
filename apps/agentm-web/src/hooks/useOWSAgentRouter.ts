'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    OWSAgentRouter,
    type OWSAgentRoutingState,
    type OWSAgentSubWallet,
} from '@/lib/ows/agent-router';
import { OWSSdkClient, type OWSSignRouteReceipt } from '@/lib/ows/sdk-client';
import type { EncryptionProvider } from '@/lib/ows/encrypted-store';
import type { CosignParams, MasterCosignReceipt } from '@/lib/ows/cosign';
import { submitSubWalletCreation, submitRouteSignature } from '@/lib/ows/indexer-submit';

export interface SignRouteResult {
    receipt: OWSSignRouteReceipt;
    cosign: MasterCosignReceipt | null;
}

export function useOWSAgentRouter(params: {
    accountKey: string | null;
    masterWallet: string | null;
    cosign?: ((p: CosignParams) => Promise<MasterCosignReceipt | null>) | null;
    encryptionProvider?: EncryptionProvider | null;
    indexerBase?: string | null;
}) {
    const { accountKey, masterWallet } = params;
    const [state, setState] = useState<OWSAgentRoutingState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const router = useMemo(() => {
        const sdk = new OWSSdkClient(params.encryptionProvider ?? null);
        return new OWSAgentRouter(sdk);
    }, [params.encryptionProvider]);

    const routerRef = useRef(router);
    routerRef.current = router;

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
    }, [accountKey, masterWallet, router]);

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

                const created = next.subWallets.find((w) => w.handle === handle.trim().toLowerCase().replace(/\s+/g, '-'));
                if (created && params.indexerBase) {
                    submitSubWalletCreation(params.indexerBase, {
                        masterWallet,
                        subWalletAddress: created.walletAddress,
                        handle: created.handle,
                        receipt: created.createReceipt,
                    }).catch(() => {});
                }

                return next;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create agent sub wallet');
                return null;
            } finally {
                setBusy(false);
            }
        },
        [accountKey, masterWallet, params.indexerBase],
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
        [accountKey],
    );

    const signActiveRoute = useCallback(
        async (
            routeType: 'task_settlement' | 'agent_payment' | 'custom',
            payload: unknown,
        ): Promise<SignRouteResult | null> => {
            if (!accountKey) return null;
            try {
                setBusy(true);
                const result = await routerRef.current.signWithActiveSubWallet({
                    accountKey,
                    request: { routeType, payload },
                });
                setState(result.state);
                setError(null);

                let cosignReceipt: MasterCosignReceipt | null = null;
                const activeWallet = result.state.subWallets.find(
                    (w) => w.id === result.state.activeSubWalletId,
                );
                if (params.cosign && activeWallet) {
                    cosignReceipt = await params.cosign({
                        subWalletAddress: activeWallet.walletAddress,
                        subWalletSignature: result.receipt.signature,
                        routeType,
                    });
                }

                if (params.indexerBase && activeWallet) {
                    submitRouteSignature(params.indexerBase, {
                        walletAddress: activeWallet.walletAddress,
                        routeType,
                        receipt: result.receipt,
                        cosign: cosignReceipt,
                    }).catch(() => {});
                }

                return { receipt: result.receipt, cosign: cosignReceipt };
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to sign route');
                return null;
            } finally {
                setBusy(false);
            }
        },
        [accountKey, params.cosign, params.indexerBase],
    );

    const activeSubWallet: OWSAgentSubWallet | null =
        state?.subWallets.find((wallet) => wallet.id === state.activeSubWalletId) ?? null;

    const isPasskeyProtected = useCallback(
        (address: string): boolean => {
            try {
                const sdk = new OWSSdkClient(params.encryptionProvider ?? null);
                return sdk.hasPasskeyProtection(address);
            } catch {
                return false;
            }
        },
        [params.encryptionProvider],
    );

    return {
        state,
        activeSubWallet,
        error,
        busy,
        createSubWallet,
        setActiveSubWallet,
        signActiveRoute,
        isPasskeyProtected,
    } as const;
}
