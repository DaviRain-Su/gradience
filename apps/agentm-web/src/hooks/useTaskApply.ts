'use client';

import { useState, useCallback } from 'react';
import { applyForTask, type WalletAdapter } from '@/lib/solana/arena-client';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import type { Address } from '@solana/kit';

export interface UseTaskApplyResult {
  apply: (taskId: number | bigint, mint?: Address) => Promise<string | null>;
  loading: boolean;
  error: string | null;
  lastSignature: string | null;
}

export function useTaskApply(walletAddress: string | null): UseTaskApplyResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const apply = useCallback(
    async (taskId: number | bigint, mint?: Address): Promise<string | null> => {
      if (!walletAddress) {
        setError('Wallet not connected');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const wallet: WalletAdapter = createDynamicAdapter(walletAddress);
        const sig = await applyForTask({ wallet, taskId, mint });
        setLastSignature(sig);
        return sig;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply for task');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [walletAddress],
  );

  return { apply, loading, error, lastSignature };
}
