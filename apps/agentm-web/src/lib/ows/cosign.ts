'use client';

import { useCallback, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

export interface MasterCosignReceipt {
    masterWallet: string;
    masterSignature: string;
    subWalletAddress: string;
    subWalletSignature: string;
    routeType: string;
    cosignedAt: number;
}

export interface CosignParams {
    subWalletAddress: string;
    subWalletSignature: string;
    routeType: string;
}

export function useMasterCosign() {
    const { primaryWallet } = useDynamicContext();
    const busyRef = useRef(false);

    const ready = !!primaryWallet?.address;

    const signMessageWithWallet = useCallback(
        async (message: Uint8Array): Promise<Uint8Array | null> => {
            if (!primaryWallet) return null;
            try {
                const signer = await (primaryWallet as any).getSigner?.();
                if (!signer || typeof signer.signMessage !== 'function') {
                    // Try connector as fallback
                    const connector = (primaryWallet as any).connector;
                    if (connector && typeof connector.signMessage === 'function') {
                        return await connector.signMessage(message);
                    }
                    return null;
                }
                return await signer.signMessage(message);
            } catch {
                return null;
            }
        },
        [primaryWallet],
    );

    const cosign = useCallback(
        async (params: CosignParams): Promise<MasterCosignReceipt | null> => {
            if (!ready || !primaryWallet || busyRef.current) return null;
            busyRef.current = true;

            try {
                const masterWallet = primaryWallet.address;
                const now = Date.now();
                const message = new TextEncoder().encode(
                    JSON.stringify({
                        type: 'master_cosign',
                        subWalletAddress: params.subWalletAddress,
                        subWalletSignature: params.subWalletSignature,
                        routeType: params.routeType,
                        timestamp: now,
                    }),
                );

                const signature = await signMessageWithWallet(message);
                if (!signature) return null;

                return {
                    masterWallet,
                    masterSignature: toHex(signature),
                    subWalletAddress: params.subWalletAddress,
                    subWalletSignature: params.subWalletSignature,
                    routeType: params.routeType,
                    cosignedAt: now,
                };
            } catch {
                return null;
            } finally {
                busyRef.current = false;
            }
        },
        [primaryWallet, ready, signMessageWithWallet],
    );

    const deriveEncryptionSeed = useCallback(async (): Promise<Uint8Array | null> => {
        if (!ready || !primaryWallet) return null;
        try {
            const message = new TextEncoder().encode('agentm:ows:encryption-seed:v1');
            return await signMessageWithWallet(message);
        } catch {
            return null;
        }
    }, [primaryWallet, ready, signMessageWithWallet]);

    return {
        ready,
        cosign,
        deriveEncryptionSeed,
        masterAddress: primaryWallet?.address ?? null,
    } as const;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
