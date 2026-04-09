'use client';

import { useEffect, useState } from 'react';
import { INDEXER_ENDPOINT } from '../lib/config';
import { fetchWithMockFallback } from '../lib/sdk';
import { getMockAgentReputation, getMockAgentTasks } from '../lib/mock-data';

interface ReputationData {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

interface TaskSummary {
    task_id: number;
    state: string;
    reward: number;
    category: number;
}

export function AgentOverview({ publicKey }: { publicKey: string | null }) {
    const [reputation, setReputation] = useState<ReputationData | null>(null);
    const [activeTasks, setActiveTasks] = useState<TaskSummary[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!publicKey) return;
        setLoading(true);

        Promise.all([
            fetchWithMockFallback(`${INDEXER_ENDPOINT}/api/agents/${publicKey}/reputation`, () =>
                getMockAgentReputation(publicKey),
            ),
            fetchWithMockFallback(`${INDEXER_ENDPOINT}/api/tasks?poster=${publicKey}&state=open&limit=10`, () =>
                getMockAgentTasks(publicKey),
            ),
        ]).then(([rep, tasks]) => {
            setReputation(rep as ReputationData | null);
            setActiveTasks((tasks as TaskSummary[]) || []);
            setLoading(false);
        });
    }, [publicKey]);

    if (!publicKey) {
        return (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-lg font-semibold">Agent Overview</h2>
                <p className="mt-2 text-sm text-zinc-500">Connect your wallet to see your agent stats.</p>
            </div>
        );
    }

    const totalEarned = reputation?.total_earned ?? 0;
    const earnedSol = (totalEarned / 1_000_000_000).toFixed(4);

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Agent Overview</h2>
                <span className="text-xs text-zinc-500 font-mono">{publicKey.slice(0, 8)}...</span>
            </div>

            {loading ? (
                <p className="text-sm text-zinc-500">Loading...</p>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard label="Avg Score" value={reputation?.avg_score?.toFixed(1) ?? '--'} />
                        <StatCard label="Completed" value={reputation?.completed?.toString() ?? '0'} />
                        <StatCard
                            label="Win Rate"
                            value={reputation?.win_rate ? `${(reputation.win_rate * 100).toFixed(0)}%` : '--'}
                        />
                        <StatCard label="Earned" value={`${earnedSol} SOL`} highlight />
                    </div>

                    {/* Active Tasks */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-2">Active Tasks ({activeTasks.length})</h3>
                        {activeTasks.length === 0 ? (
                            <p className="text-xs text-zinc-600">No active tasks.</p>
                        ) : (
                            <div className="space-y-1">
                                {activeTasks.map(task => (
                                    <div
                                        key={task.task_id}
                                        className="flex items-center justify-between text-sm bg-zinc-800 rounded px-3 py-1.5"
                                    >
                                        <span>Task #{task.task_id}</span>
                                        <span className="text-xs text-zinc-500">{task.reward} lamports</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="rounded-lg bg-zinc-800 p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-lg font-bold ${highlight ? 'text-emerald-400' : ''}`}>{value}</p>
        </div>
    );
}
