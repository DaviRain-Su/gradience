import { useEffect, useState } from 'react';
import { store } from '../lib/store';
import { getReputation, type ReputationApi } from '../lib/indexer-api';

export function MeView() {
    const auth = store.getState().auth;
    const [reputation, setReputation] = useState<ReputationApi | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!auth.publicKey) return;
        setLoading(true);
        getReputation(auth.publicKey).then((r) => {
            setReputation(r);
            setLoading(false);
        });
    }, [auth.publicKey]);

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold">My Agent</h2>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                        A
                    </div>
                    <div>
                        <p className="font-medium">{auth.email}</p>
                        <p className="text-sm text-gray-500 font-mono">{auth.publicKey}</p>
                    </div>
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Reputation</h3>
                {loading ? (
                    <p className="text-gray-500 text-sm">Loading...</p>
                ) : reputation ? (
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard label="Avg Score" value={reputation.avg_score?.toFixed(1) ?? '--'} />
                        <StatCard label="Completed" value={reputation.completed?.toString() ?? '0'} />
                        <StatCard label="Win Rate" value={reputation.win_rate ? `${(reputation.win_rate * 100).toFixed(0)}%` : '--'} />
                        <StatCard label="Earned" value={`${((reputation.total_earned ?? 0) / 1e9).toFixed(4)} SOL`} />
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm">No reputation data yet. Complete tasks to build your on-chain reputation.</p>
                )}
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
