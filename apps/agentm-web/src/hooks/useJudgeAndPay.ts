'use client';

import { useCallback, useEffect, useState } from 'react';
import { useArenaTask, type TaskApi, type SubmissionApi } from '@/hooks/useArenaTask';
import type { Address } from '@solana/kit';

export interface JudgeTask {
  task: TaskApi;
  submissions: SubmissionApi[];
}

export interface UseJudgeAndPayResult {
  tasksToJudge: JudgeTask[];
  loading: boolean;
  error: string | null;
  txHash: string | null;
  judgeTask: (params: {
    taskId: number | bigint;
    winner: Address | `0x${string}`;
    poster: Address | `0x${string}`;
    score: number;
    reasonRef: string;
  }) => Promise<string | null>;
}

export function useJudgeAndPay(walletAddress: string | null): UseJudgeAndPayResult {
  const arena = useArenaTask(walletAddress);
  const [tasksToJudge, setTasksToJudge] = useState<JudgeTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!walletAddress) {
      setTasksToJudge([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const allOpen = await arena.fetchTasks({ status: 'open', limit: 200 });
      const myTasks = (allOpen || []).filter(
        (t) => (t.judge || '').toLowerCase() === walletAddress.toLowerCase()
      );
      const withSubmissions: JudgeTask[] = await Promise.all(
        myTasks.map(async (task) => {
          const subs = await arena.fetchSubmissions(task.task_id);
          return { task, submissions: subs || [] };
        })
      );
      setTasksToJudge(withSubmissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, arena]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const judgeTask = useCallback(
    async (params: {
      taskId: number | bigint;
      winner: Address | `0x${string}`;
      poster: Address | `0x${string}`;
      score: number;
      reasonRef: string;
    }): Promise<string | null> => {
      const sig = await arena.judgeAndPay(params);
      if (sig) {
        await loadTasks();
      }
      return sig;
    },
    [arena, loadTasks]
  );

  return {
    tasksToJudge,
    loading: loading || arena.loading,
    error: error || arena.error,
    txHash: arena.lastTxSignature,
    judgeTask,
  };
}
