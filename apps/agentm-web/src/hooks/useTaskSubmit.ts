'use client';

import { useState, useCallback } from 'react';
import { submitResult, type WalletAdapter } from '@/lib/solana/arena-client';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import { useWalletChain } from './useWalletChain';

export interface UseTaskSubmitResult {
    submit: (params: {
        taskId: number | bigint;
        resultRef: string;
        traceRef?: string;
        runtimeProvider?: string;
        runtimeModel?: string;
    }) => Promise<string | null>;
    loading: boolean;
    error: string | null;
    lastSignature: string | null;
}

export function useTaskSubmit(walletAddress: string | null): UseTaskSubmitResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSignature, setLastSignature] = useState<string | null>(null);
    const { chain } = useWalletChain();

    const submit = useCallback(
        async (params: {
            taskId: number | bigint;
            resultRef: string;
            traceRef?: string;
            runtimeProvider?: string;
            runtimeModel?: string;
        }): Promise<string | null> => {
            if (!walletAddress) {
                setError('Wallet not connected');
                return null;
            }
            setLoading(true);
            setError(null);
            try {
                const wallet: WalletAdapter = createDynamicAdapter(walletAddress);
                const sig = await submitResult({
                    wallet,
                    taskId: params.taskId,
                    resultRef: params.resultRef,
                    traceRef: params.traceRef ?? '',
                    runtimeProvider: params.runtimeProvider,
                    runtimeModel: params.runtimeModel,
                });
                setLastSignature(sig);
                return sig;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to submit result');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [walletAddress],
    );

    return { submit, loading, error, lastSignature };
}
