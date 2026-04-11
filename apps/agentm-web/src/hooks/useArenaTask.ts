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
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import type { Address } from '@solana/kit';
import { useWalletChain } from './useWalletChain';
import { useIdentity } from './useIdentity';

export type { TaskApi, SubmissionApi };

export function getExplorerUrl(signature: string): string {
    return getSolanaExplorerUrl(signature);
}

async function postDaemonJudgePER(
    daemonUrl: string,
    token: string | null,
    body: Record<string, unknown>,
): Promise<{ txSignature?: string; error?: string }> {
    const res = await fetch(`${daemonUrl}/api/v1/magicblock/judge-per`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) {
        throw new Error(String(data.error || `Daemon PER request failed: ${res.status}`));
    }
    return data as { txSignature?: string; error?: string };
}

export function useArenaTask(walletAddress: string | null) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);
    const { getTier } = useIdentity();
    const { daemonUrl, sessionToken } = useDaemonConnection();

    const getWallet = useCallback((): WalletAdapter => {
        if (!walletAddress) throw new Error('Wallet not connected');
        return createDynamicAdapter(walletAddress);
    }, [walletAddress]);

    const doPostTask = useCallback(
        async (params: {
            evalRef: string;
            category: number;
            reward: number | bigint;
            minStake?: number | bigint;
            deadlineOffsetSeconds?: number;
            judgeMode?: number;
            judge?: Address;
            executionMode?: 'l1' | 'er' | 'per';
            sessionId?: string;
        }): Promise<{ taskId: bigint; signature: string } | null> => {
            setError(null);
            setLoading(true);
            try {
                // Tier check for Solana: guests cannot post tasks
                if (walletAddress) {
                    const tier = await getTier(walletAddress);
                    if (tier && tier.tier === 'guest') {
                        throw new Error(
                            'Account verification required. Please link a social account in Settings to post tasks.',
                        );
                    }
                }

                const result = await postTask({
                    wallet: getWallet(),
                    evalRef: params.evalRef,
                    category: params.category,
                    reward: params.reward,
                    minStake: params.minStake,
                    deadlineOffsetSeconds: params.deadlineOffsetSeconds,
                    judgeMode: params.judgeMode,
                    judge: params.judge,
                });
                setLastTxSignature(result.signature);
                return result;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to post task');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [getWallet, walletAddress, getTier],
    );

    const doApplyForTask = useCallback(
        async (taskId: number | bigint): Promise<string | null> => {
            setError(null);
            setLoading(true);
            try {
                const sig = await applyForTask({ wallet: getWallet(), taskId });
                setLastTxSignature(sig);
                return sig;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to apply for task');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [getWallet],
    );

    const doSubmitResult = useCallback(
        async (params: {
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
        },
        [getWallet],
    );

    const doJudgeAndPay = useCallback(
        async (params: {
            taskId: number | bigint;
            winner: Address;
            poster: Address;
            score: number;
            reasonRef: string;
            usePER?: boolean;
        }): Promise<string | null> => {
            setError(null);
            setLoading(true);
            try {
                if (params.usePER) {
                    const data = await postDaemonJudgePER(daemonUrl, sessionToken, {
                        taskId: String(params.taskId),
                        taskIdOnChain: String(params.taskId),
                        agentId: params.winner,
                        amount: '0',
                        token: 'SOL',
                        poster: params.poster,
                        score: params.score,
                        reasonRef: params.reasonRef,
                    });
                    if (data.txSignature) {
                        setLastTxSignature(data.txSignature);
                    }
                    return data.txSignature ?? null;
                }
                const sig = await judgeAndPay({
                    wallet: getWallet(),
                    taskId: params.taskId,
                    winner: params.winner,
                    poster: params.poster,
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
        },
        [getWallet, daemonUrl, sessionToken],
    );

    const doCancelTask = useCallback(
        async (taskId: number | bigint): Promise<string | null> => {
            setError(null);
            setLoading(true);
            try {
                const sig = await cancelTask({ wallet: getWallet(), taskId });
                setLastTxSignature(sig);
                return sig;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to cancel task');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [getWallet],
    );

    const doFetchTasks = useCallback(
        async (params?: {
            status?: 'open' | 'completed' | 'refunded';
            category?: number;
            poster?: string;
            limit?: number;
            offset?: number;
        }): Promise<TaskApi[]> => {
            return fetchTasks(params);
        },
        [],
    );

    const doFetchTask = useCallback(
        async (taskId: number): Promise<TaskApi | null> => {
            return fetchTask(taskId);
        },
        [],
    );

    const doFetchSubmissions = useCallback(
        async (taskId: number): Promise<SubmissionApi[] | null> => {
            return fetchSubmissions(taskId);
        },
        [],
    );

    const doFetchReputation = useCallback(
        async (agent: string): Promise<ReputationData | null> => {
            return fetchReputation(agent);
        },
        [],
    );

    return {
        loading,
        error,
        lastTxSignature,
        postTask: doPostTask,
        applyForTask: doApplyForTask,
        submitResult: doSubmitResult,
        judgeAndPay: doJudgeAndPay,
        cancelTask: doCancelTask,
        fetchTasks: doFetchTasks,
        fetchTask: doFetchTask,
        fetchSubmissions: doFetchSubmissions,
        fetchReputation: doFetchReputation,
        getExplorerUrl,
    } as const;
}
