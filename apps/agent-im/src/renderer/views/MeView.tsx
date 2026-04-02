import { useAppStore } from '../hooks/useAppStore.ts';
import { useReputation } from '../hooks/useReputation.ts';

export function MeView() {
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const email = useAppStore((s) => s.auth.email);
    const { reputation, loading, error, refresh } = useReputation(publicKey);

    return (
        <div className="p-6 space-y-6 overflow-y-auto">
            <h2 className="text-2xl font-bold">My Agent</h2>

            {/* Profile card */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                        A
                    </div>
                    <div>
                        <p className="font-medium">{email}</p>
                        <p className="text-sm text-gray-500 font-mono">{publicKey}</p>
                    </div>
                </div>
            </div>

            {/* Reputation panel */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Reputation</h3>
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 transition"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {error && (
                    <p className="text-red-400 text-sm mb-3">Error: {error}</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Avg Score" value={reputation?.global_avg_score?.toFixed(1) ?? '--'} />
                    <StatCard label="Completed" value={reputation?.global_completed?.toString() ?? '--'} />
                    <StatCard label="Submitted" value={reputation?.global_total_applied?.toString() ?? '--'} />
                    <StatCard label="Win Rate" value={reputation?.win_rate ? `${(reputation.win_rate * 100).toFixed(0)}%` : '--'} />
                </div>

                {!reputation && !loading && !error && (
                    <p className="text-xs text-gray-500 mt-4">
                        No reputation data yet. Complete tasks in Agent Arena to build your on-chain reputation.
                    </p>
                )}

                {!reputation && !loading && error && (
                    <p className="text-xs text-gray-500 mt-4">
                        Indexer offline. Start the Indexer to load on-chain data.
                    </p>
                )}
            </div>

            {/* Task history placeholder */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Task History</h3>
                <p className="text-gray-500 text-sm">
                    No tasks yet. Post a task or apply to one from the Discover tab.
                </p>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}
