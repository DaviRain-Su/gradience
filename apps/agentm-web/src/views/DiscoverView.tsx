import { useEffect, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore.ts';
import { useDiscover } from '../hooks/useDiscover.ts';
import { useArenaTasks } from '../hooks/useArenaTasks.ts';
import { sortAndFilterAgents } from '../lib/ranking.ts';
import { getAgentProfileApiClient } from '../lib/profile-api.ts';
import type { AgentDiscoveryRow, AgentProfile } from '../types.ts';

export function DiscoverView() {
    const discoveryRows = useAppStore((s) => s.discoveryRows);
    const setActiveView = useAppStore((s) => s.setActiveView);
    const setActiveConversation = useAppStore((s) => s.setActiveConversation);
    const setDiscoveryRows = useAppStore((s) => s.setDiscoveryRows);

    const [query, setQuery] = useState('');
    const [category, setCategory] = useState(0);
    const [selectedAgent, setSelectedAgent] = useState<AgentDiscoveryRow | null>(null);
    const [resultRefDrafts, setResultRefDrafts] = useState<Record<number, string>>({});
    const [traceRefDrafts, setTraceRefDrafts] = useState<Record<number, string>>({});
    const { loading, error, refresh, categories } = useDiscover(category);
    const {
        tasks,
        loading: tasksLoading,
        error: tasksError,
        refresh: refreshTasks,
        apply,
        submit,
    } = useArenaTasks();

    const ranked = sortAndFilterAgents(discoveryRows, query);

    // Fallback: load demo data if Indexer is offline
    const loadDemoData = () => {
        setDiscoveryRows([
            { agent: 'Alice_DeFi_Oracle', weight: 1500, reputation: { global_avg_score: 92.5, global_completed: 47, global_total_applied: 50, win_rate: 0.94 } },
            { agent: 'Bob_Code_Auditor', weight: 800, reputation: { global_avg_score: 85.0, global_completed: 23, global_total_applied: 28, win_rate: 0.82 } },
            { agent: 'Charlie_DataSci', weight: 600, reputation: { global_avg_score: 78.0, global_completed: 12, global_total_applied: 15, win_rate: 0.80 } },
            { agent: 'Dave_NewAgent', weight: 100, reputation: null },
        ]);
    };

    const inviteAgent = (agentAddr: string) => {
        setActiveConversation(agentAddr);
        setActiveView('chat');
    };

    return (
        <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Discover Agents</h2>
                <div className="flex gap-2">
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="text-sm px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 transition"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button
                        onClick={() => void refreshTasks()}
                        disabled={tasksLoading}
                        className="text-sm px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 transition"
                    >
                        {tasksLoading ? 'Loading tasks...' : 'Refresh Tasks'}
                    </button>
                    {discoveryRows.length === 0 && !loading && (
                        <button
                            onClick={loadDemoData}
                            className="text-sm px-3 py-1 bg-blue-800 rounded hover:bg-blue-700 transition"
                        >
                            Demo Data
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <p className="text-yellow-400 text-sm">Indexer offline. Showing cached/demo data.</p>
            )}
            {tasksError && (
                <p className="text-yellow-400 text-sm">Task feed unavailable. Please verify AgentM API /me/tasks or Indexer /api/tasks.</p>
            )}

            {/* Arena task flow */}
            <section className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Arena Tasks</h3>
                    <p className="text-xs text-gray-500">Browse → Apply → Submit → Track</p>
                </div>
                <div className="space-y-3">
                    {tasks.map(({ task, role, flow, latestSubmission, canApply, canSubmit }) => (
                        <div key={task.taskId} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="font-medium">Task #{task.taskId}</p>
                                    <p className="text-xs text-gray-500">
                                        role: {role} · poster: {task.poster} · reward: {task.reward} · state: {task.state}
                                    </p>
                                </div>
                                <div className="text-xs">
                                    <StatusBadge status={flow?.status ?? 'available'} />
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 items-center">
                                <button
                                    onClick={() => {
                                        void apply(task).then((ok) => {
                                            if (ok) {
                                                void refreshTasks();
                                            }
                                        });
                                    }}
                                    disabled={!canApply}
                                    className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition"
                                >
                                    {flow ? 'Applied' : 'Apply'}
                                </button>
                                <input
                                    value={resultRefDrafts[task.taskId] ?? ''}
                                    onChange={(e) =>
                                        setResultRefDrafts((prev) => ({ ...prev, [task.taskId]: e.target.value }))
                                    }
                                    placeholder="result_ref (cid/url)"
                                    className="min-w-[180px] flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                                />
                                <input
                                    value={traceRefDrafts[task.taskId] ?? ''}
                                    onChange={(e) =>
                                        setTraceRefDrafts((prev) => ({ ...prev, [task.taskId]: e.target.value }))
                                    }
                                    placeholder="trace_ref (optional)"
                                    className="min-w-[150px] flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                                />
                                <button
                                    onClick={() => {
                                        const resultRef = (resultRefDrafts[task.taskId] ?? '').trim();
                                        if (!resultRef) return;
                                        void submit(
                                            task.taskId,
                                            resultRef,
                                            (traceRefDrafts[task.taskId] ?? '').trim() || undefined,
                                        ).then((ok) => {
                                            if (ok) {
                                                void refreshTasks();
                                            }
                                        });
                                    }}
                                    disabled={!canSubmit || !(resultRefDrafts[task.taskId] ?? '').trim()}
                                    className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition"
                                >
                                    Submit
                                </button>
                            </div>
                            {(flow || latestSubmission) && (
                                <p className="mt-2 text-xs text-gray-500">
                                    Updated:{' '}
                                    {flow
                                        ? new Date(flow.updatedAt).toLocaleString()
                                        : latestSubmission?.submitted_at ?? 'N/A'}
                                    {flow?.resultRef ? ` · result_ref: ${flow.resultRef}` : ''}
                                    {!flow?.resultRef && latestSubmission?.result_ref
                                        ? ` · latest_submission: ${latestSubmission.result_ref}`
                                        : ''}
                                </p>
                            )}
                        </div>
                    ))}
                    {!tasksLoading && tasks.length === 0 && (
                        <p className="text-sm text-gray-500">No tasks available from Indexer.</p>
                    )}
                </div>
            </section>

            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
                {categories.map((cat, i) => (
                    <button
                        key={cat}
                        onClick={() => setCategory(i)}
                        className={`px-3 py-1 rounded text-xs transition ${
                            category === i
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Search */}
            <input
                type="text"
                placeholder="Search agents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />

            {/* Agent list */}
            <div className="space-y-2">
                {ranked.map((row, i) => (
                    <div
                        key={row.agent}
                        className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-600 transition"
                        onClick={() => setSelectedAgent(row)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                                {i + 1}
                            </div>
                            <div>
                                <p className="font-medium">{row.agent}</p>
                                <div className="flex gap-3 text-xs text-gray-500">
                                    <span>Score: {row.reputation?.global_avg_score?.toFixed(1) ?? 'N/A'}</span>
                                    <span>Completed: {row.reputation?.global_completed ?? 0}</span>
                                    <span>Win: {row.reputation?.win_rate ? `${(row.reputation.win_rate * 100).toFixed(0)}%` : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                inviteAgent(row.agent);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition"
                        >
                            Chat
                        </button>
                    </div>
                ))}
                {ranked.length === 0 && !loading && (
                    <p className="text-gray-500 text-sm text-center py-8">
                        {discoveryRows.length > 0 ? 'No agents match your search.' : 'No agents found. Try loading demo data or start the Indexer.'}
                    </p>
                )}
            </div>

            {/* Agent Detail Modal */}
            {selectedAgent && (
                <AgentDetailModal
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onChat={() => {
                        inviteAgent(selectedAgent.agent);
                        setSelectedAgent(null);
                    }}
                />
            )}
        </div>
    );
}

function AgentDetailModal({
    agent,
    onClose,
    onChat,
}: {
    agent: AgentDiscoveryRow;
    onClose: () => void;
    onChat: () => void;
}) {
    const [profile, setProfile] = useState<AgentProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);
    const rep = agent.reputation;

    useEffect(() => {
        let disposed = false;
        setProfileLoading(true);
        setProfileError(null);
        const client = getAgentProfileApiClient();
        void client
            .getAgentProfile(agent.agent)
            .then((nextProfile) => {
                if (disposed) return;
                setProfile(nextProfile);
            })
            .catch((error: unknown) => {
                if (disposed) return;
                const message = error instanceof Error ? error.message : String(error);
                setProfileError(message);
            })
            .finally(() => {
                if (disposed) return;
                setProfileLoading(false);
            });
        return () => {
            disposed = true;
        };
    }, [agent.agent]);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                        {(profile?.displayName ?? agent.agent).charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">{profile?.displayName ?? agent.agent}</h3>
                        {profile?.displayName && (
                            <p className="text-xs text-gray-500 font-mono">{agent.agent}</p>
                        )}
                        <p className="text-xs text-gray-500">weight: {agent.weight}</p>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-gray-500">Profile</p>
                    {profileLoading && <p className="text-sm text-gray-400">Loading profile...</p>}
                    {!profileLoading && profileError && (
                        <p className="text-sm text-amber-400">Profile unavailable: {profileError}</p>
                    )}
                    {!profileLoading && !profileError && profile && (
                        <>
                            <p className="text-sm text-gray-200">{profile.bio}</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                {profile.links.website && (
                                    <a
                                        className="text-blue-300 hover:underline"
                                        href={profile.links.website}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Website
                                    </a>
                                )}
                                {profile.links.github && (
                                    <a
                                        className="text-blue-300 hover:underline"
                                        href={profile.links.github}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        GitHub
                                    </a>
                                )}
                                {profile.links.x && (
                                    <a
                                        className="text-blue-300 hover:underline"
                                        href={profile.links.x}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        X
                                    </a>
                                )}
                            </div>
                        </>
                    )}
                    {!profileLoading && !profileError && !profile && (
                        <p className="text-sm text-gray-500">No published profile yet.</p>
                    )}
                </div>

                {rep ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Avg Score</p>
                            <p className="text-xl font-bold">{rep.global_avg_score.toFixed(1)}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Completed</p>
                            <p className="text-xl font-bold">{rep.global_completed}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Applied</p>
                            <p className="text-xl font-bold">{rep.global_total_applied}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Win Rate</p>
                            <p className="text-xl font-bold">{(rep.win_rate * 100).toFixed(0)}%</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">No reputation data yet.</p>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onChat}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
                    >
                        Start Chat
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const style = status === 'won'
        ? 'bg-emerald-700/30 text-emerald-300'
        : status === 'lost'
            ? 'bg-red-700/30 text-red-300'
            : status === 'submitted'
                ? 'bg-blue-700/30 text-blue-300'
                : status === 'applied'
                    ? 'bg-amber-700/30 text-amber-300'
                    : status === 'refunded'
                        ? 'bg-violet-700/30 text-violet-300'
                        : 'bg-gray-700/30 text-gray-300';
    return <span className={`px-2 py-1 rounded ${style}`}>{status}</span>;
}
