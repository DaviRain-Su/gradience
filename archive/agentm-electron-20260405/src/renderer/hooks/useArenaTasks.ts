import { useCallback, useEffect, useMemo, useState } from 'react';
import { getIndexerClient, type TaskApi } from '../lib/indexer-api.ts';
import { getAgentImApiClient, type MeTasksResponse } from '../lib/me-api.ts';
import { useAppStore } from './useAppStore.ts';
import type { ArenaTaskSummary } from '../../shared/types.ts';
import { registerIdentity } from '../lib/identity-registration.ts';

export function useArenaTasks() {
    const authPublicKey = useAppStore((s) => s.auth.publicKey);
    const trackedTasks = useAppStore((s) => s.trackedTasks);
    const taskFlow = useAppStore((s) => s.taskFlow);
    const trackTasks = useAppStore((s) => s.trackTasks);
    const applyToTask = useAppStore((s) => s.applyToTask);
    const submitTaskResult = useAppStore((s) => s.submitTaskResult);
    const syncTaskOutcome = useAppStore((s) => s.syncTaskOutcome);

    const [tasks, setTasks] = useState<
        Array<{
            task: ArenaTaskSummary;
            role: 'poster' | 'participant' | 'both' | 'unknown';
            latestSubmission: MeTasksResponse['items'][number]['latestSubmission'] | null;
        }>
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (authPublicKey) {
                const response = await getAgentImApiClient().getMeTasks({
                    role: 'all',
                    sort: 'task_id_desc',
                    limit: 50,
                    offset: 0,
                });
                const mapped = response.items.map((item) => ({
                    task: mapTask(item.task),
                    role: item.role,
                    latestSubmission: item.latestSubmission,
                }));
                setTasks(mapped);
                trackTasks(mapped.map((entry) => entry.task));
                mapped.forEach((entry) => {
                    syncTaskOutcome(entry.task);
                    if ((entry.role === 'participant' || entry.role === 'both') && entry.latestSubmission) {
                        applyToTask(entry.task);
                        submitTaskResult(
                            entry.task.taskId,
                            entry.latestSubmission.result_ref,
                            entry.latestSubmission.trace_ref,
                        );
                        syncTaskOutcome(entry.task);
                    }
                });
            } else {
                const rows = await getIndexerClient().getTasks({ limit: 20, offset: 0 });
                const mapped = rows.map((task) => ({
                    task: mapTask(task),
                    role: 'unknown' as const,
                    latestSubmission: null,
                }));
                setTasks(mapped);
                trackTasks(mapped.map((entry) => entry.task));
                mapped.forEach((entry) => syncTaskOutcome(entry.task));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }, [applyToTask, authPublicKey, submitTaskResult, syncTaskOutcome, trackTasks]);

    useEffect(() => {
        void refresh();
        // Auto-refresh every 30s for task status updates
        const interval = setInterval(() => void refresh(), 30_000);
        return () => clearInterval(interval);
    }, [refresh]);

    const enriched = useMemo(() => {
        return tasks.map(({ task, role, latestSubmission }) => {
            const flow = taskFlow.get(task.taskId);
            const tracked = trackedTasks.get(task.taskId);
            const resolvedTask = tracked ?? task;
            const canApply = computeCanApply({
                authenticatedAgent: authPublicKey,
                task: resolvedTask,
                flowStatus: flow?.status ?? null,
            });
            const canSubmit = computeCanSubmit({
                authenticatedAgent: authPublicKey,
                task: resolvedTask,
                flowStatus: flow?.status ?? null,
            });
            return {
                task: resolvedTask,
                role,
                flow,
                latestSubmission,
                canApply,
                canSubmit,
            };
        });
    }, [tasks, taskFlow, trackedTasks, authPublicKey]);

    const getIdentityRegistrationStatus = useAppStore((s) => s.getIdentityRegistrationStatus);
    const setIdentityRegistrationStatus = useAppStore((s) => s.setIdentityRegistrationStatus);
    const email = useAppStore((s) => s.auth.email);

    const apply = useCallback(
        async (task: ArenaTaskSummary) => {
            setError(null);
            try {
                if (authPublicKey) {
                    // Ensure identity is registered on first participation
                    const idStatus = getIdentityRegistrationStatus(authPublicKey);
                    if (!idStatus || idStatus.state === 'unknown' || idStatus.state === 'failed') {
                        setIdentityRegistrationStatus({
                            agent: authPublicKey,
                            state: 'pending',
                            agentId: null,
                            txHash: null,
                            error: null,
                            updatedAt: Date.now(),
                        });
                        registerIdentity({ agent: authPublicKey, email }).then((status) => {
                            setIdentityRegistrationStatus(status);
                        });
                    }
                    await getAgentImApiClient().applyToTask(task.taskId);
                }
                applyToTask(task);
                syncTaskOutcome(task);
                return true;
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to apply task');
                return false;
            }
        },
        [
            applyToTask,
            authPublicKey,
            email,
            getIdentityRegistrationStatus,
            setIdentityRegistrationStatus,
            syncTaskOutcome,
        ],
    );

    const submit = useCallback(
        async (taskId: number, resultRef: string, traceRef?: string) => {
            setError(null);
            try {
                if (authPublicKey) {
                    await getAgentImApiClient().submitTask(taskId, { resultRef, traceRef });
                }
                submitTaskResult(taskId, resultRef, traceRef);
                const latestTask = trackedTasks.get(taskId);
                if (latestTask) {
                    syncTaskOutcome(latestTask);
                }
                return true;
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to submit task');
                return false;
            }
        },
        [authPublicKey, submitTaskResult, syncTaskOutcome, trackedTasks],
    );

    return {
        tasks: enriched,
        loading,
        error,
        refresh,
        apply,
        submit,
    };
}

export function computeCanApply(input: {
    authenticatedAgent: string | null;
    task: ArenaTaskSummary;
    flowStatus: string | null;
}): boolean {
    if (!input.authenticatedAgent) return false;
    if (input.task.state !== 'open') return false;
    if (input.task.poster === input.authenticatedAgent) return false;
    if (!input.flowStatus || input.flowStatus === 'available') return true;
    return false;
}

export function computeCanSubmit(input: {
    authenticatedAgent: string | null;
    task: ArenaTaskSummary;
    flowStatus: string | null;
}): boolean {
    if (!input.authenticatedAgent) return false;
    if (input.task.state !== 'open') return false;
    if (input.task.poster === input.authenticatedAgent) return false;
    return input.flowStatus === 'applied' || input.flowStatus === 'submitted';
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
