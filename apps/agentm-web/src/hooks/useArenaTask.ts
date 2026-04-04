'use client';

import { useCallback, useState } from 'react';
import {
  postTask,
  applyForTask,
  submitResult,
  judgeAndPay,
  cancelTask,
  fetchTasks,
  fetchTask,
  fetchSubmissions,
  fetchReputation,
  getExplorerUrl,
  type TaskApi,
  type SubmissionApi,
  type ReputationApi,
  type WalletAdapter,
} from '@/lib/solana/arena-client';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import type { Address } from '@solana/kit';

export type { TaskApi, SubmissionApi, ReputationApi };
export { getExplorerUrl };

export function useArenaTask(walletAddress: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

  const getWallet = useCallback((): WalletAdapter => {
    if (!walletAddress) throw new Error('Wallet not connected');
    return createDynamicAdapter(walletAddress);
  }, [walletAddress]);

  const doPostTask = useCallback(async (params: {
    evalRef: string;
    category: number;
    reward: number | bigint;
    minStake?: number | bigint;
    deadlineOffsetSeconds?: number;
    judgeMode?: number;
    judge?: Address;
    mint?: Address;
  }): Promise<{ taskId: bigint; signature: string } | null> => {
    setError(null);
    setLoading(true);
    try {
      const result = await postTask({ wallet: getWallet(), ...params });
      setLastTxSignature(result.signature);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getWallet]);

  const doApplyForTask = useCallback(async (taskId: number | bigint, mint?: Address): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      const sig = await applyForTask({ wallet: getWallet(), taskId, mint });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply for task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getWallet]);

  const doSubmitResult = useCallback(async (params: {
    taskId: number | bigint;
    resultRef: string;
    traceRef: string;
    runtimeProvider?: string;
    runtimeModel?: string;
  }): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      const sig = await submitResult({ wallet: getWallet(), ...params });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit result');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getWallet]);

  const doJudgeAndPay = useCallback(async (params: {
    taskId: number | bigint;
    winner: Address;
    poster: Address;
    score: number;
    reasonRef: string;
    mint?: Address;
  }): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      const sig = await judgeAndPay({ wallet: getWallet(), ...params });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to judge task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getWallet]);

  const doCancelTask = useCallback(async (taskId: number | bigint, mint?: Address): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      const sig = await cancelTask({ wallet: getWallet(), taskId, mint });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getWallet]);

  return {
    loading,
    error,
    lastTxSignature,
    postTask: doPostTask,
    applyForTask: doApplyForTask,
    submitResult: doSubmitResult,
    judgeAndPay: doJudgeAndPay,
    cancelTask: doCancelTask,
    fetchTasks,
    fetchTask,
    fetchSubmissions,
    fetchReputation,
    getExplorerUrl,
  } as const;
}
