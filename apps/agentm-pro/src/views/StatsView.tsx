'use client';

import { useEffect } from 'react';
import { ReputationScore } from '@/components/stats/ReputationScore';
import { RevenueChart } from '@/components/stats/RevenueChart';
import { useToast } from '@/components/ui/ToastProvider';
import { useStats } from '@/hooks/useStats';

export function StatsView({ owner }: { owner: string }) {
    const { stats, loading, error, refreshStats } = useStats(owner);
    const toast = useToast();

    useEffect(() => {
        void refreshStats();
    }, [refreshStats]);

    useEffect(() => {
        if (error) {
            toast.info(error);
        }
    }, [error, toast]);

    return (
        <div data-testid="stats-view" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Stats</h1>
                    <p className="text-gray-400">Reputation and revenue overview for your agent account.</p>
                </div>
                <button
                    onClick={() => void refreshStats()}
                    disabled={loading}
                    className="px-4 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Refresh
                </button>
            </div>

            {loading && <p className="text-sm text-gray-500">Loading stats...</p>}

            {!stats && !loading && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-sm text-gray-400">No stats available yet.</p>
                </div>
            )}

            {stats && (
                <>
                    {loading ? (
                        <LoadingStats />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard
                                    testId="stats-total-earned-value"
                                    label="Total Earned"
                                    value={`${(stats.reputation.total_earned / 1_000_000_000).toFixed(4)} SOL`}
                                />
                                <StatCard
                                    testId="stats-completed-value"
                                    label="Completed Tasks"
                                    value={String(stats.reputation.completed)}
                                />
                                <StatCard
                                    testId="stats-data-source-value"
                                    label="Data Source"
                                    value={stats.source}
                                />
                            </div>
                    <ReputationScore reputation={stats.reputation} />
                            <RevenueChart values={stats.monthlyRevenueLamports} />
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function StatCard({ label, value, testId }: { label: string; value: string; testId: string }) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p data-testid={testId} className="text-xl font-semibold mt-1">{value}</p>
        </div>
    );
}

function LoadingStats() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-20 bg-gray-900 border border-gray-800 rounded-xl" />
                <div className="h-20 bg-gray-900 border border-gray-800 rounded-xl" />
                <div className="h-20 bg-gray-900 border border-gray-800 rounded-xl" />
            </div>
            <div className="h-56 bg-gray-900 border border-gray-800 rounded-xl" />
            <div className="h-72 bg-gray-900 border border-gray-800 rounded-xl" />
        </div>
    );
}
