import { useEffect, useState } from 'react';
import { store } from '../lib/store';
import { getJudgePool } from '../lib/indexer-api';
import type { AgentDiscoveryRow } from '../types';

export function DiscoverView() {
    const [agents, setAgents] = useState<AgentDiscoveryRow[]>([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<AgentDiscoveryRow | null>(null);

    useEffect(() => {
        setLoading(true);
        getJudgePool(0).then((rows) => {
            setAgents(rows.map((r) => ({
                agent: r.agent,
                weight: r.weight,
                reputation: r.reputation,
            })));
            setLoading(false);
        });
    }, []);

    const filtered = agents.filter((a) =>
        !query || a.agent.toLowerCase().includes(query.toLowerCase()),
    );

    const startChat = (agent: string) => {
        store.getState().setActiveConversation(agent);
        store.getState().setActiveView('chat');
    };

    return (
        <div className="p-6 space-y-4 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold">Discover Agents</h2>

            <input
                type="text"
                placeholder="Search agents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />

            {loading && <p className="text-gray-500 text-sm">Loading agents...</p>}

            {agents.length === 0 && !loading && (
                <div className="text-center py-12">
                    <p className="text-gray-500">No agents found from Indexer.</p>
                    <button
                        onClick={() => {
                            setAgents([
                                { agent: 'Alice_DeFi', weight: 1500, reputation: { global_avg_score: 92, global_completed: 47, global_total_applied: 50, win_rate: 0.94 } },
                                { agent: 'Bob_Auditor', weight: 800, reputation: { global_avg_score: 85, global_completed: 23, global_total_applied: 28, win_rate: 0.82 } },
                                { agent: 'Charlie_Data', weight: 600, reputation: { global_avg_score: 78, global_completed: 12, global_total_applied: 15, win_rate: 0.80 } },
                            ]);
                        }}
                        className="mt-3 px-4 py-2 bg-blue-800 rounded hover:bg-blue-700 text-sm transition"
                    >
                        Load Demo Agents
                    </button>
                </div>
            )}

            <div className="space-y-2">
                {filtered.map((row, i) => (
                    <div
                        key={row.agent}
                        className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between cursor-pointer hover:border-gray-600 transition"
                        onClick={() => setSelected(row)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                                {i + 1}
                            </div>
                            <div>
                                <p className="font-medium">{row.agent}</p>
                                <div className="flex gap-3 text-xs text-gray-500">
                                    <span>Score: {row.reputation?.global_avg_score?.toFixed(1) ?? 'N/A'}</span>
                                    <span>Win: {row.reputation?.win_rate ? `${(row.reputation.win_rate * 100).toFixed(0)}%` : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); startChat(row.agent); }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition"
                        >
                            Chat
                        </button>
                    </div>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold">{selected.agent}</h3>
                        {selected.reputation ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Score</p><p className="text-xl font-bold">{selected.reputation.global_avg_score.toFixed(1)}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Completed</p><p className="text-xl font-bold">{selected.reputation.global_completed}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Applied</p><p className="text-xl font-bold">{selected.reputation.global_total_applied}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3"><p className="text-xs text-gray-500">Win Rate</p><p className="text-xl font-bold">{(selected.reputation.win_rate * 100).toFixed(0)}%</p></div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No reputation data.</p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => { startChat(selected.agent); setSelected(null); }} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition">Start Chat</button>
                            <button onClick={() => setSelected(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
