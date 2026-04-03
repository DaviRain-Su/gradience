'use client';

import { useCallback, useRef } from 'react';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';

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
    const { wallets, ready } = useWallets();
    const { signMessage } = useSignMessage();
    const busyRef = useRef(false);

    const cosign = useCallback(
        async (params: CosignParams): Promise<MasterCosignReceipt | null> => {
            if (!ready || wallets.length === 0 || busyRef.current) return null;
            busyRef.current = true;

            try {
                const masterWallet = wallets[0];
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

                const { signature } = await signMessage({ message, wallet: masterWallet });

                return {
                    masterWallet: masterWallet.address,
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
        [wallets, ready, signMessage],
    );

    const deriveEncryptionSeed = useCallback(async (): Promise<Uint8Array | null> => {
        if (!ready || wallets.length === 0) return null;
        try {
            const masterWallet = wallets[0];
            const message = new TextEncoder().encode('agentm:ows:encryption-seed:v1');
            const { signature } = await signMessage({ message, wallet: masterWallet });
            return signature;
        } catch {
            return null;
        }
    }, [wallets, ready, signMessage]);

    return {
        ready: ready && wallets.length > 0,
        cosign,
        deriveEncryptionSeed,
        masterAddress: wallets[0]?.address ?? null,
    } as const;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
