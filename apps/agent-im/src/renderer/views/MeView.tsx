import { useAppStore } from '../hooks/useAppStore.ts';
import { useReputation } from '../hooks/useReputation.ts';
import { useAttestations } from '../hooks/useAttestations.ts';
import type { InteropStatusSnapshot } from '../../shared/types.ts';
import type { AttestationSummary } from '../../main/api-server.ts';

export function MeView() {
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const email = useAppStore((s) => s.auth.email);
    const identityRegistration = useAppStore((s) =>
        publicKey ? s.getIdentityRegistrationStatus(publicKey) : null,
    );
    const interopStatus = useAppStore((s) =>
        publicKey ? s.getInteropStatus(publicKey) : null,
    );
    const trackedTasks = useAppStore((s) => s.trackedTasks);
    const taskFlowHistory = useAppStore((s) => s.getTaskFlowHistory());
    const { reputation, loading, error, refresh } = useReputation(publicKey);
    const { attestations, loading: attLoading, error: attError, refresh: attRefresh } = useAttestations(publicKey);

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

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-3">Identity Registration</h3>
                <p className="text-sm text-gray-300">
                    state: <span className="font-mono">{identityRegistration?.state ?? 'unknown'}</span>
                </p>
                {identityRegistration?.agentId && (
                    <p className="text-xs text-gray-500 mt-1">
                        agent_id: {identityRegistration.agentId}
                    </p>
                )}
                {identityRegistration?.txHash && (
                    <p className="text-xs text-gray-500 mt-1 break-all">
                        tx: {identityRegistration.txHash}
                    </p>
                )}
                {identityRegistration?.error && (
                    <p className="text-xs text-amber-400 mt-1">{identityRegistration.error}</p>
                )}
            </div>

            {/* Interop Status */}
            {interopStatus && <InteropStatusPanel status={interopStatus} />}

            {/* Attestations */}
            <AttestationsPanel
                attestations={attestations}
                loading={attLoading}
                error={attError}
                refresh={attRefresh}
            />

            {/* Task history */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Task History</h3>
                {taskFlowHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        No tasks yet. Post a task or apply to one from the Discover tab.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {taskFlowHistory.map((record) => {
                            const task = trackedTasks.get(record.taskId);
                            return (
                                <div
                                    key={record.taskId}
                                    className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="font-medium">Task #{record.taskId}</p>
                                        <span className="text-xs text-gray-400">{record.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        state={record.lastKnownTaskState ?? 'unknown'}
                                        {task ? ` · reward=${task.reward}` : ''}
                                        {record.winner ? ` · winner=${record.winner}` : ''}
                                    </p>
                                    {record.resultRef && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            result_ref: {record.resultRef}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        updated_at: {new Date(record.updatedAt).toLocaleString()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
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

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="font-mono">{value}</span>
        </div>
    );
}

function RoleBar({ label, counts }: { label: string; counts: { winner: number; poster: number; judge: number; loser: number } }) {
    const total = counts.winner + counts.poster + counts.judge + counts.loser;
    return (
        <div className="space-y-1">
            <p className="text-xs text-gray-500">{label}</p>
            <div className="flex gap-2 text-xs">
                <span className="text-green-400">W:{counts.winner}</span>
                <span className="text-blue-400">P:{counts.poster}</span>
                <span className="text-yellow-400">J:{counts.judge}</span>
                <span className="text-red-400">L:{counts.loser}</span>
                <span className="text-gray-500">({total})</span>
            </div>
        </div>
    );
}

function AttestationsPanel({
    attestations,
    loading,
    error,
    refresh,
}: {
    attestations: AttestationSummary[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}) {
    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Attestations</h3>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 transition"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && <p className="text-red-400 text-sm mb-3">Error: {error}</p>}

            {attestations.length === 0 && !loading && !error && (
                <p className="text-gray-500 text-sm">
                    No attestations yet. Complete judged tasks to earn TaskCompletion credentials.
                </p>
            )}

            {attestations.length > 0 && (
                <div className="space-y-2">
                    {attestations.map((att) => (
                        <div
                            key={`${att.taskId}-${att.completedAt}`}
                            className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm"
                        >
                            <div className="flex items-center justify-between">
                                <p className="font-medium">Task #{att.taskId}</p>
                                <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">
                                    score: {att.score}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                category={att.category}
                                {' · '}
                                completed={new Date(att.completedAt * 1000).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 truncate">
                                credential: {att.credential}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function InteropStatusPanel({ status }: { status: InteropStatusSnapshot }) {
    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">Interop Status</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <StatCard label="8004 Feedback" value={status.erc8004FeedbackCount.toString()} />
                <StatCard label="Attestations" value={status.attestationCount.toString()} />
                <StatCard label="EVM Reputation" value={status.evmReputationCount.toString()} />
                <StatCard label="Istrana Feedback" value={status.istranaFeedbackCount.toString()} />
            </div>

            <div className="space-y-3 border-t border-gray-800 pt-3">
                <RoleBar label="Identity Dispatches" counts={status.identityRoleCounts} />
                <RoleBar label="Feedback Dispatches" counts={status.feedbackRoleCounts} />
            </div>

            {status.lastTaskId != null && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
                    <MiniStat label="Last Task" value={status.lastTaskId} />
                    {status.lastScore != null && <MiniStat label="Last Score" value={status.lastScore} />}
                </div>
            )}

            <p className="text-xs text-gray-600 mt-3">
                updated: {new Date(status.updatedAt).toLocaleString()}
            </p>
        </div>
    );
}
