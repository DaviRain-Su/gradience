'use client';

import { useState, useCallback } from 'react';
import { applyForTask, type WalletAdapter } from '@/lib/solana/arena-client';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import { applyForTaskEVM } from '@/lib/evm/arena-client';
import { useWalletChain } from './useWalletChain';

export interface UseTaskApplyResult {
  apply: (taskId: number | bigint, stake?: string) => Promise<string | null>;
  loading: boolean;
  error: string | null;
  lastSignature: string | null;
}

export function useTaskApply(walletAddress: string | null): UseTaskApplyResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const { chain, primaryWallet } = useWalletChain();

  const getEthereumProvider = useCallback((): unknown => {
    const provider = (primaryWallet?.connector as any)?.getProvider?.();
    if (provider) return provider;
    const walletClient = (primaryWallet?.connector as any)?.getWalletClient?.();
    if (walletClient) return walletClient;
    throw new Error('No EVM provider available from Dynamic wallet');
  }, [primaryWallet]);

  const apply = useCallback(
    async (taskId: number | bigint, stake?: string): Promise<string | null> => {
      if (!walletAddress) {
        setError('Wallet not connected');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        if (chain === 'evm') {
          const txHash = await applyForTaskEVM({
            ethereumProvider: getEthereumProvider(),
            account: walletAddress as `0x${string}`,
            taskId: BigInt(taskId),
            stake,
          });
          setLastSignature(txHash);
          return txHash;
        }
        const wallet: WalletAdapter = createDynamicAdapter(walletAddress);
        const sig = await applyForTask({ wallet, taskId });
        setLastSignature(sig);
        return sig;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply for task');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, chain, getEthereumProvider],
  );

  return { apply, loading, error, lastSignature };
}
