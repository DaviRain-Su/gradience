import { useAppStore } from '../hooks/useAppStore.ts';

export function MeView() {
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const email = useAppStore((s) => s.auth.email);

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

            {/* Reputation panel (placeholder — connects to Indexer later) */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Reputation</h3>
                <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Avg Score" value="--" />
                    <StatCard label="Completed" value="--" />
                    <StatCard label="Submitted" value="--" />
                    <StatCard label="Win Rate" value="--" />
                </div>
                <p className="text-xs text-gray-500 mt-4">Connect to Indexer to load on-chain reputation data</p>
            </div>

            {/* Task history (placeholder) */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Task History</h3>
                <p className="text-gray-500 text-sm">No tasks yet. Post a task or apply to one from the Discover tab.</p>
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
