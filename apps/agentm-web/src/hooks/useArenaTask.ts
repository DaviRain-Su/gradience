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
  getExplorerUrl as getSolanaExplorerUrl,
  type TaskApi,
  type SubmissionApi,
  type WalletAdapter,
} from '@/lib/solana/arena-client';
import type { ReputationData } from '@gradiences/sdk';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import type { Address } from '@solana/kit';
import {
  postTaskEVM,
  applyForTaskEVM,
  submitResultEVM,
  judgeAndPayEVM,
  cancelTaskEVM,
  fetchTaskEVM,
} from '@/lib/evm/arena-client';
import { getExplorerUrl as getEVMExplorerUrl } from '@/lib/evm/explorer';
import {
  fetchTasksFromSubgraph,
  fetchTaskFromSubgraph,
  fetchSubmissionsFromSubgraph,
  fetchReputationFromSubgraph,
} from '@/lib/evm/subgraph-client';
import { useWalletChain } from './useWalletChain';
import { useIdentity } from './useIdentity';

export type { TaskApi, SubmissionApi };

export function getExplorerUrl(signature: string, chain: 'solana' | 'evm' = 'solana', chainId?: number): string {
  if (chain === 'evm') return getEVMExplorerUrl(signature, chainId);
  return getSolanaExplorerUrl(signature);
}

export function useArenaTask(walletAddress: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);
  const { chain, chainId, primaryWallet } = useWalletChain();
  const { getTier } = useIdentity();

  const getWallet = useCallback((): WalletAdapter => {
    if (!walletAddress) throw new Error('Wallet not connected');
    return createDynamicAdapter(walletAddress);
  }, [walletAddress]);

  const getEthereumProvider = useCallback((): unknown => {
    const provider = (primaryWallet?.connector as any)?.getProvider?.();
    if (provider) return provider;
    const walletClient = (primaryWallet?.connector as any)?.getWalletClient?.();
    if (walletClient) return walletClient;
    throw new Error('No EVM provider available from Dynamic wallet');
  }, [primaryWallet]);

  const doPostTask = useCallback(async (params: {
    evalRef: string;
    category: number;
    reward: number | bigint | string;
    minStake?: number | bigint | string;
    deadlineOffsetSeconds?: number;
    judgeMode?: number;
    judge?: Address | `0x${string}`;
  }): Promise<{ taskId: bigint; signature: string } | null> => {
    setError(null);
    setLoading(true);
    try {
      // Tier check for Solana: guests cannot post tasks
      if (chain !== 'evm' && walletAddress) {
        const tier = await getTier(walletAddress);
        if (tier && tier.tier === 'guest') {
          throw new Error('Account verification required. Please link a social account in Settings to post tasks.');
        }
      }

      if (chain === 'evm' && walletAddress) {
        const account = walletAddress as `0x${string}`;
        const result = await postTaskEVM({
          ethereumProvider: getEthereumProvider(),
          account,
          chainId,
          evalRef: params.evalRef,
          category: params.category,
          reward: params.reward as string,
          minStake: params.minStake as string | undefined,
          deadlineOffsetSeconds: params.deadlineOffsetSeconds,
          judgeDeadlineOffsetSeconds: params.deadlineOffsetSeconds,
          judge: params.judge as `0x${string}` | undefined,
        });
        setLastTxSignature(result.txHash);
        return { taskId: result.taskId, signature: result.txHash };
      }
      const result = await postTask({
        wallet: getWallet(),
        evalRef: params.evalRef,
        category: params.category,
        reward: params.reward as number | bigint,
        minStake: params.minStake as number | bigint | undefined,
        deadlineOffsetSeconds: params.deadlineOffsetSeconds,
        judgeMode: params.judgeMode,
        judge: params.judge as Address | undefined,
      });
      setLastTxSignature(result.signature);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chain, getWallet, getEthereumProvider, walletAddress, getTier]);

  const doApplyForTask = useCallback(async (taskId: number | bigint): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      if (chain === 'evm' && walletAddress) {
        const txHash = await applyForTaskEVM({
          ethereumProvider: getEthereumProvider(),
          account: walletAddress as `0x${string}`,
          chainId,
          taskId: BigInt(taskId),
        });
        setLastTxSignature(txHash);
        return txHash;
      }
      const sig = await applyForTask({ wallet: getWallet(), taskId });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply for task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chain, getWallet, getEthereumProvider, walletAddress]);

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
      if (chain === 'evm' && walletAddress) {
        const txHash = await submitResultEVM({
          ethereumProvider: getEthereumProvider(),
          account: walletAddress as `0x${string}`,
          chainId,
          taskId: BigInt(params.taskId),
          resultRef: params.resultRef,
          traceRef: params.traceRef,
        });
        setLastTxSignature(txHash);
        return txHash;
      }
      const sig = await submitResult({ wallet: getWallet(), ...params });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit result');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chain, getWallet, getEthereumProvider, walletAddress]);

  const doJudgeAndPay = useCallback(async (params: {
    taskId: number | bigint;
    winner: Address | `0x${string}`;
    poster: Address | `0x${string}`;
    score: number;
    reasonRef: string;
  }): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      if (chain === 'evm' && walletAddress) {
        const txHash = await judgeAndPayEVM({
          ethereumProvider: getEthereumProvider(),
          account: walletAddress as `0x${string}`,
          chainId,
          taskId: BigInt(params.taskId),
          winner: params.winner as `0x${string}`,
          score: params.score,
        });
        setLastTxSignature(txHash);
        return txHash;
      }
      const sig = await judgeAndPay({
        wallet: getWallet(),
        taskId: params.taskId,
        winner: params.winner as Address,
        poster: params.poster as Address,
        score: params.score,
        reasonRef: params.reasonRef,
      });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to judge task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chain, getWallet, getEthereumProvider, walletAddress]);

  const doCancelTask = useCallback(async (taskId: number | bigint): Promise<string | null> => {
    setError(null);
    setLoading(true);
    try {
      if (chain === 'evm' && walletAddress) {
        const txHash = await cancelTaskEVM({
          ethereumProvider: getEthereumProvider(),
          account: walletAddress as `0x${string}`,
          chainId,
          taskId: BigInt(taskId),
        });
        setLastTxSignature(txHash);
        return txHash;
      }
      const sig = await cancelTask({ wallet: getWallet(), taskId });
      setLastTxSignature(sig);
      return sig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chain, getWallet, getEthereumProvider, walletAddress]);

  const doFetchTasks = useCallback(async (params?: {
    status?: 'open' | 'completed' | 'refunded';
    category?: number;
    poster?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskApi[]> => {
    if (chain === 'evm') {
      return fetchTasksFromSubgraph({
        state: params?.status,
        poster: params?.poster,
        limit: params?.limit,
      });
    }
    return fetchTasks(params);
  }, [chain]);

  const doFetchTask = useCallback(async (taskId: number): Promise<TaskApi | null> => {
    if (chain === 'evm') {
      return fetchTaskFromSubgraph(taskId, chainId);
    }
    return fetchTask(taskId);
  }, [chain, chainId]);

  const doFetchSubmissions = useCallback(async (taskId: number): Promise<SubmissionApi[] | null> => {
    if (chain === 'evm') {
      return fetchSubmissionsFromSubgraph(taskId, chainId);
    }
    return fetchSubmissions(taskId);
  }, [chain, chainId]);

  const doFetchReputation = useCallback(async (agent: string): Promise<ReputationData | null> => {
    if (chain === 'evm') {
      return fetchReputationFromSubgraph(agent, chainId);
    }
    return fetchReputation(agent);
  }, [chain, chainId]);

  return {
    loading,
    error,
    lastTxSignature,
    chain,
    postTask: doPostTask,
    applyForTask: doApplyForTask,
    submitResult: doSubmitResult,
    judgeAndPay: doJudgeAndPay,
    cancelTask: doCancelTask,
    fetchTasks: doFetchTasks,
    fetchTask: doFetchTask,
    fetchSubmissions: doFetchSubmissions,
    fetchReputation: doFetchReputation,
    getExplorerUrl: (sig: string) => getExplorerUrl(sig, chain ?? 'solana', chainId),
  } as const;
}
