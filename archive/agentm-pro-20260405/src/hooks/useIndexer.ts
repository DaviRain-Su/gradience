'use client';

import { useCallback, useRef, useState } from 'react';
import { IndexerClient } from '@/lib/indexer';
import type { TaskApi, AgentProfileApi, ReputationApi, TaskListParams } from '@/lib/indexer';

export function useIndexer() {
    const clientRef = useRef(new IndexerClient());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        setError(null);
        try {
            const result = await fn();
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getTasks = useCallback(
        (params?: TaskListParams) => withLoading(() => clientRef.current.getTasks(params)),
        [withLoading],
    );

    const getTask = useCallback(
        (taskId: number) => withLoading(() => clientRef.current.getTask(taskId)),
        [withLoading],
    );

    const getAgentProfile = useCallback(
        (pubkey: string) => withLoading(() => clientRef.current.getAgentProfile(pubkey)),
        [withLoading],
    );

    const getAgentReputation = useCallback(
        (pubkey: string) => withLoading(() => clientRef.current.getAgentReputation(pubkey)),
        [withLoading],
    );

    return {
        loading,
        error,
        getTasks,
        getTask,
        getAgentProfile,
        getAgentReputation,
    } as const;
}
