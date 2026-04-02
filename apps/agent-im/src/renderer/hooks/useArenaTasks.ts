import { useCallback, useEffect, useMemo, useState } from 'react';
import { getIndexerClient, type TaskApi } from '../lib/indexer-api.ts';
import { useAppStore } from './useAppStore.ts';
import type { ArenaTaskSummary } from '../../shared/types.ts';

export function useArenaTasks() {
    const authPublicKey = useAppStore((s) => s.auth.publicKey);
    const trackedTasks = useAppStore((s) => s.trackedTasks);
    const taskFlow = useAppStore((s) => s.taskFlow);
    const trackTasks = useAppStore((s) => s.trackTasks);
    const applyToTask = useAppStore((s) => s.applyToTask);
    const submitTaskResult = useAppStore((s) => s.submitTaskResult);
    const syncTaskOutcome = useAppStore((s) => s.syncTaskOutcome);

    const [tasks, setTasks] = useState<ArenaTaskSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await getIndexerClient().getTasks({ limit: 20, offset: 0 });
            const mapped = rows.map(mapTask);
            setTasks(mapped);
            trackTasks(mapped);
            mapped.forEach((task) => syncTaskOutcome(task));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }, [syncTaskOutcome, trackTasks]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const enriched = useMemo(() => {
        return tasks.map((task) => {
            const flow = taskFlow.get(task.taskId);
            const tracked = trackedTasks.get(task.taskId);
            return {
                task: tracked ?? task,
                flow,
                canApply:
                    !!authPublicKey &&
                    task.state === 'open' &&
                    (!flow || flow.status === 'available'),
                canSubmit:
                    !!authPublicKey &&
                    task.state === 'open' &&
                    !!flow &&
                    (flow.status === 'applied' || flow.status === 'submitted'),
            };
        });
    }, [tasks, taskFlow, trackedTasks, authPublicKey]);

    const apply = useCallback((task: ArenaTaskSummary) => {
        applyToTask(task);
    }, [applyToTask]);

    const submit = useCallback((taskId: number, resultRef: string, traceRef?: string) => {
        submitTaskResult(taskId, resultRef, traceRef);
    }, [submitTaskResult]);

    return {
        tasks: enriched,
        loading,
        error,
        refresh,
        apply,
        submit,
    };
}

function mapTask(task: TaskApi): ArenaTaskSummary {
    return {
        taskId: task.task_id,
        poster: task.poster,
        judge: task.judge,
        reward: task.reward,
        state: task.state,
        category: task.category,
        deadline: task.deadline,
        submissionCount: task.submission_count,
        winner: task.winner,
    };
}
