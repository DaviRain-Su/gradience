'use client';

import { useState, useCallback } from 'react';
import type { Address } from '@solana/kit';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { openChannel, type OpenChannelParams, tryGetDynamicSigner } from '@/lib/a2a/a2a-client';

export interface UseOpenChannelResult {
    openChannel: (params: {
        payee: Address;
        depositAmount: number;
        expiresAt: number;
        mediator?: Address;
        tokenMint?: Address;
    }) => Promise<string | null>;
    loading: boolean;
    error: string | null;
}

export function useOpenChannel(walletAddress: string | null): UseOpenChannelResult {
    const { primaryWallet } = useDynamicContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const doOpen = useCallback(
        async (params: {
            payee: Address;
            depositAmount: number;
            expiresAt: number;
            mediator?: Address;
            tokenMint?: Address;
        }): Promise<string | null> => {
            if (!walletAddress) {
                setError('Wallet not connected');
                return null;
            }
            setLoading(true);
            setError(null);
            try {
                const lamports = BigInt(Math.round(params.depositAmount * 1e9));
                const sdkParams: OpenChannelParams = {
                    payer: walletAddress as Address,
                    payee: params.payee,
                    channelId: BigInt(Date.now()),
                    mediator: params.mediator || (walletAddress as Address),
                    tokenMint: params.tokenMint || ('So11111111111111111111111111111111111111112' as Address),
                    depositAmount: lamports,
                    expiresAt: BigInt(params.expiresAt),
                };
                const signAndSend = tryGetDynamicSigner(primaryWallet);
                const sig = await openChannel(sdkParams, signAndSend);
                return sig;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to open channel');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [walletAddress, primaryWallet],
    );

    return {
        openChannel: doOpen,
        loading,
        error,
    };
}
