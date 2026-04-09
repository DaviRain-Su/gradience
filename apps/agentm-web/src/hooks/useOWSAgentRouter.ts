'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OWSSdkClient, type OWSCreateWalletReceipt, type OWSSignRouteReceipt } from '@/lib/ows/sdk-client';
import {
    OWSAgentRouter,
    type OWSAgentRoutingState,
    type OWSAgentSubWallet,
    type AgentSigningPolicy,
} from '@/lib/ows/agent-router';
import { OWSDaemonClient } from '@/lib/ows/daemon-client';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import type { EncryptionProvider } from '@/lib/ows/encrypted-store';
import type { CosignParams, MasterCosignReceipt } from '@/lib/ows/cosign';
import { submitSubWalletCreation, submitRouteSignature } from '@/lib/ows/indexer-submit';
import { calculatePolicyFromReputation, type ReputationPolicy } from '@/lib/ows/reputation-policy';

export interface SignRouteResult {
    receipt: OWSSignRouteReceipt;
    cosign: MasterCosignReceipt | null;
}

export interface AgentSubWallet {
    id: string;
    handle: string;
    walletAddress: string;
    createReceipt: OWSCreateWalletReceipt;
    isPasskeyProtected: boolean;
    policy?: AgentSigningPolicy;
    lastSignReceipt?: OWSSignRouteReceipt | null;
    createdAt?: number;
    updatedAt?: number;
    // GRA-225: Reputation data
    reputationScore?: number;
    reputationTier?: string;
    reputationPolicy?: ReputationPolicy;
}

/**
 * useOWSAgentRouter - Enhanced to use Daemon API for wallet operations
 *
 * GRA-222 Tasks:
 * - createSubWallet() calls daemon API -> OWS SDK createWallet()
 * - signWithActiveSubWallet() calls daemon /api/v1/ows/sign/transaction
 * - Sub-wallet list comes from daemon GET /api/v1/ows/wallets
 * - Falls back to local keypair when daemon is unreachable
 */
export function useOWSAgentRouter(params: {
    accountKey: string | null;
    masterWallet: string | null;
    cosign?: ((p: CosignParams) => Promise<MasterCosignReceipt | null>) | null;
    encryptionProvider?: EncryptionProvider | null;
    indexerBase?: string | null;
}) {
    const { accountKey, masterWallet, cosign, indexerBase } = params;
    const { daemonUrl, sessionToken } = useDaemonConnection();

    const [state, setState] = useState<OWSAgentRoutingState | null>(null);
    const [daemonWallets, setDaemonWallets] = useState<AgentSubWallet[]>([]);
    const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Local SDK client for fallback
    const localRouter = useMemo(() => {
        const sdk = new OWSSdkClient(params.encryptionProvider ?? null);
        return new OWSAgentRouter(sdk);
    }, [params.encryptionProvider]);

    const localRouterRef = useRef(localRouter);
    localRouterRef.current = localRouter;

    const daemonClient = useMemo(() => {
        return new OWSDaemonClient(daemonUrl, sessionToken);
    }, [daemonUrl, sessionToken]);

    // Initialize local state
    useEffect(() => {
        if (!accountKey || !masterWallet) {
            setState(null);
            return;
        }
        try {
            const next = localRouterRef.current.ensureState(accountKey, masterWallet);
            setState(next);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to init OWS agent router');
            setState(null);
        }
    }, [accountKey, masterWallet]);

    // Sync daemon wallets
    useEffect(() => {
        if (!sessionToken) {
            setDaemonWallets([]);
            return;
        }

        const syncWallets = async () => {
            try {
                const wallets = await daemonClient.listWallets();
                const agentWallets: AgentSubWallet[] = wallets.map((w) => ({
                    id: w.id,
                    handle: w.name,
                    walletAddress: w.solanaAddress || w.accounts.find((a) => a.chainId === 'solana')?.address || '',
                    createReceipt: {
                        method: 'daemon_wallet_sync',
                        txRef: null,
                        signature: null,
                        raw: { daemonWalletId: w.id },
                    },
                    isPasskeyProtected: false,
                }));
                setDaemonWallets(agentWallets);
            } catch {
                setDaemonWallets([]);
            }
        };

        syncWallets();
    }, [daemonClient, sessionToken]);

    /**
     * Create sub-wallet via daemon API
     * GRA-222 Task 2: Calls daemon -> OWS SDK createWallet()
     */
    const createSubWallet = useCallback(
        async (handle: string): Promise<OWSAgentRoutingState | null> => {
            if (!accountKey || !masterWallet) return null;

            setBusy(true);
            setError(null);

            try {
                // Try daemon first
                if (sessionToken) {
                    const wallet = await daemonClient.createWallet(handle);

                    // Add to local list
                    const newWallet: AgentSubWallet = {
                        id: wallet.id,
                        handle: wallet.name,
                        walletAddress: wallet.solanaAddress || '',
                        createReceipt: {
                            method: 'daemon_create_wallet',
                            txRef: null,
                            signature: null,
                            raw: { daemonWalletId: wallet.id },
                        },
                        isPasskeyProtected: false,
                    };
                    setDaemonWallets((prev) => [...prev, newWallet]);

                    // Also create local state for compatibility
                    const next = await localRouterRef.current.createSubWallet({
                        accountKey,
                        masterWallet,
                        handle,
                    });
                    setState(next);

                    // Submit to indexer
                    if (indexerBase && wallet.solanaAddress) {
                        const receipt: OWSCreateWalletReceipt = {
                            method: 'daemon_create_wallet',
                            txRef: null,
                            signature: null,
                            raw: { daemonWalletId: wallet.id },
                        };
                        submitSubWalletCreation(indexerBase, {
                            masterWallet,
                            subWalletAddress: wallet.solanaAddress,
                            handle: wallet.name,
                            receipt,
                        }).catch(() => {});
                    }

                    return next;
                }

                // Fallback to local
                const next = await localRouterRef.current.createSubWallet({
                    accountKey,
                    masterWallet,
                    handle,
                });
                setState(next);
                return next;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create agent sub wallet');
                return null;
            } finally {
                setBusy(false);
            }
        },
        [accountKey, masterWallet, daemonClient, sessionToken, indexerBase],
    );

    const setActiveSubWallet = useCallback(
        (subWalletId: string | null): OWSAgentRoutingState | null => {
            setActiveWalletId(subWalletId);
            if (!accountKey) return null;
            try {
                const next = localRouterRef.current.setActiveSubWallet(accountKey, subWalletId);
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

    /**
     * Sign with active sub-wallet via daemon API
     * GRA-222 Task 3: Calls daemon /api/v1/ows/sign/transaction
     */
    const signActiveRoute = useCallback(
        async (
            routeType: 'task_settlement' | 'agent_payment' | 'custom',
            payload: unknown,
        ): Promise<SignRouteResult | null> => {
            if (!accountKey) return null;

            setBusy(true);
            setError(null);

            try {
                const activeWallet =
                    daemonWallets.find((w) => w.id === activeWalletId) ||
                    state?.subWallets.find((w) => w.id === state.activeSubWalletId);

                if (!activeWallet) {
                    throw new Error('No active sub-wallet selected');
                }

                // Try daemon signing first
                if (sessionToken && activeWalletId) {
                    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
                    const txHex = Buffer.from(payloadStr).toString('hex');

                    const result = await daemonClient.signTransaction({
                        wallet: activeWalletId,
                        chain: 'solana',
                        txHex,
                    });

                    const receipt: OWSSignRouteReceipt = {
                        method: 'daemon_sign_transaction',
                        signature: result.signature,
                        publicKey: activeWallet.walletAddress,
                        signedPayload: txHex,
                        txRef: null,
                        raw: result,
                    };

                    // Handle cosign if needed
                    let cosignReceipt: MasterCosignReceipt | null = null;
                    if (cosign) {
                        cosignReceipt = await cosign({
                            subWalletAddress: activeWallet.walletAddress,
                            subWalletSignature: result.signature,
                            routeType,
                        });
                    }

                    // Submit to indexer
                    if (indexerBase) {
                        submitRouteSignature(indexerBase, {
                            walletAddress: activeWallet.walletAddress,
                            routeType,
                            receipt,
                            cosign: cosignReceipt,
                        }).catch(() => {});
                    }

                    return { receipt, cosign: cosignReceipt };
                }

                // Fallback to local signing
                const result = await localRouterRef.current.signWithActiveSubWallet({
                    accountKey,
                    request: { routeType, payload },
                });
                setState(result.state);

                let cosignReceipt: MasterCosignReceipt | null = null;
                if (cosign && activeWallet) {
                    cosignReceipt = await cosign({
                        subWalletAddress: activeWallet.walletAddress,
                        subWalletSignature: result.receipt.signature,
                        routeType,
                    });
                }

                if (indexerBase && activeWallet) {
                    submitRouteSignature(indexerBase, {
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
        [accountKey, activeWalletId, daemonWallets, state, daemonClient, sessionToken, cosign, indexerBase],
    );

    // Combine daemon and local wallets for display
    const allSubWallets: (OWSAgentSubWallet | AgentSubWallet)[] = useMemo(() => {
        const localWallets = state?.subWallets ?? [];

        // Merge, preferring daemon wallets when IDs match
        const merged: (OWSAgentSubWallet | AgentSubWallet)[] = [...daemonWallets];
        for (const local of localWallets) {
            if (!merged.find((d) => d.walletAddress === local.walletAddress)) {
                merged.push(local);
            }
        }
        return merged;
    }, [state?.subWallets, daemonWallets]);

    const activeSubWallet: (OWSAgentSubWallet | AgentSubWallet) | null =
        allSubWallets.find((w) => w.id === (activeWalletId || state?.activeSubWalletId)) ?? null;

    const isPasskeyProtected = useCallback(
        (address: string): boolean => {
            // Check daemon first
            const daemonWallet = daemonWallets.find((w) => w.walletAddress === address);
            if (daemonWallet) return daemonWallet.isPasskeyProtected;

            // Fallback to local
            try {
                const sdk = new OWSSdkClient(params.encryptionProvider ?? null);
                return sdk.hasPasskeyProtection(address);
            } catch {
                return false;
            }
        },
        [daemonWallets, params.encryptionProvider],
    );

    return {
        state,
        daemonWallets,
        allSubWallets,
        activeSubWallet,
        error,
        busy,
        createSubWallet,
        setActiveSubWallet,
        signActiveRoute,
        isPasskeyProtected,
    } as const;
}
