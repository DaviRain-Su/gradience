'use client';

import { useState, useCallback } from 'react';
import { submitResult, type WalletAdapter } from '@/lib/solana/arena-client';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import { submitResultEVM } from '@/lib/evm/arena-client';
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
    const { chain, chainId, primaryWallet } = useWalletChain();

    const getEthereumProvider = useCallback((): unknown => {
        const provider = (primaryWallet?.connector as any)?.getProvider?.();
        if (provider) return provider;
        const walletClient = (primaryWallet?.connector as any)?.getWalletClient?.();
        if (walletClient) return walletClient;
        throw new Error('No EVM provider available from Dynamic wallet');
    }, [primaryWallet]);

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
                if (chain === 'evm') {
                    const txHash = await submitResultEVM({
                        ethereumProvider: getEthereumProvider(),
                        account: walletAddress as `0x${string}`,
                        chainId,
                        taskId: BigInt(params.taskId),
                        resultRef: params.resultRef,
                        traceRef: params.traceRef ?? '',
                    });
                    setLastSignature(txHash);
                    return txHash;
                }
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
        [walletAddress, chain, chainId, getEthereumProvider],
    );

    return { submit, loading, error, lastSignature };
}
