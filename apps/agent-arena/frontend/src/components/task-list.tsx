'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskApi } from '@gradience/sdk';

import { createSdk } from '../lib/sdk';

function formatUnixTime(value: number): string {
    if (!value) {
        return '—';
    }
    return new Date(value * 1000).toLocaleString();
}

export function TaskList({ refreshToken }: { refreshToken: number }) {
    const sdk = useMemo(() => createSdk(), []);
    const [tasks, setTasks] = useState<TaskApi[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await sdk.getTasks({ limit: 20 });
            setTasks(rows);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        } finally {
            setLoading(false);
        }
    }, [sdk]);

    useEffect(() => {
        void refresh();
    }, [refresh, refreshToken]);

    return (
        <section className="rounded-xl border border-zinc-700 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tasks</h2>
                <button
                    type="button"
                    onClick={() => void refresh()}
                    className="rounded bg-zinc-200 px-3 py-1 text-sm text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                    Refresh
                </button>
            </div>
            {loading && <p className="text-sm text-zinc-400">Loading tasks…</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {!loading && tasks.length === 0 && <p className="text-sm text-zinc-400">No tasks yet.</p>}
            <ul className="space-y-3">
                {tasks.map(task => (
                    <li key={task.task_id} className="rounded border border-zinc-800 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">Task #{task.task_id}</span>
                            <span className="rounded bg-zinc-800 px-2 py-0.5 uppercase">{task.state}</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">Category: {task.category}</p>
                        <p className="mt-1 text-xs text-zinc-400">Reward: {task.reward}</p>
                        <p className="mt-1 break-all text-xs text-zinc-400">Poster: {task.poster}</p>
                        <p className="mt-1 text-xs text-zinc-400">Deadline: {formatUnixTime(task.deadline)}</p>
                        <Link href={`/tasks/${task.task_id}`} className="mt-2 inline-block text-xs underline">
                            Open detail
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
