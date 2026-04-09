'use client';

import { useState, useCallback } from 'react';
import type { Address } from '@solana/kit';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { cooperativeCloseChannel, type CloseChannelParams, tryGetDynamicSigner } from '@/lib/a2a/a2a-client';

export interface UseCloseChannelResult {
    closeChannel: (params: {
        payee: Address;
        channelId: string;
        nonce: number;
        spentAmount: number;
        payerSig?: { r: string; s: string };
        payeeSig?: { r: string; s: string };
    }) => Promise<string | null>;
    loading: boolean;
    error: string | null;
}

export function useCloseChannel(walletAddress: string | null): UseCloseChannelResult {
    const { primaryWallet } = useDynamicContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const doClose = useCallback(
        async (params: {
            payee: Address;
            channelId: string;
            nonce: number;
            spentAmount: number;
            payerSig?: { r: string; s: string };
            payeeSig?: { r: string; s: string };
        }): Promise<string | null> => {
            if (!walletAddress) {
                setError('Wallet not connected');
                return null;
            }
            setLoading(true);
            setError(null);
            try {
                const sdkParams: CloseChannelParams = {
                    payer: walletAddress as Address,
                    payee: params.payee,
                    channelId: BigInt(params.channelId),
                    nonce: BigInt(params.nonce),
                    spentAmount: BigInt(Math.round(params.spentAmount * 1e9)),
                    payerSig: params.payerSig || { r: 'mock_r', s: 'mock_s' },
                    payeeSig: params.payeeSig || { r: 'mock_r', s: 'mock_s' },
                };
                const signAndSend = tryGetDynamicSigner(primaryWallet);
                const sig = await cooperativeCloseChannel(sdkParams, signAndSend);
                return sig;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to close channel');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [walletAddress, primaryWallet],
    );

    return {
        closeChannel: doClose,
        loading,
        error,
    };
}
