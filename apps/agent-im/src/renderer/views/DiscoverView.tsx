import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore.ts';
import { sortAndFilterAgents } from '../lib/ranking.ts';

export function DiscoverView() {
    const discoveryRows = useAppStore((s) => s.discoveryRows);
    const setActiveView = useAppStore((s) => s.setActiveView);
    const setActiveConversation = useAppStore((s) => s.setActiveConversation);
    const setDiscoveryRows = useAppStore((s) => s.setDiscoveryRows);
    const [query, setQuery] = useState('');

    const ranked = sortAndFilterAgents(discoveryRows, query);

    // Load demo data if empty
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
                {discoveryRows.length === 0 && (
                    <button onClick={loadDemoData} className="text-sm px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 transition">
                        Load Demo Data
                    </button>
                )}
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
                    <div key={row.agent} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                                {i + 1}
                            </div>
                            <div>
                                <p className="font-medium">{row.agent}</p>
                                <div className="flex gap-3 text-xs text-gray-500">
                                    <span>Score: {row.reputation?.global_avg_score?.toFixed(1) ?? 'N/A'}</span>
                                    <span>Completed: {row.reputation?.global_completed ?? 0}</span>
                                    <span>Weight: {row.weight}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => inviteAgent(row.agent)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition"
                        >
                            Invite
                        </button>
                    </div>
                ))}
                {ranked.length === 0 && discoveryRows.length > 0 && (
                    <p className="text-gray-500 text-sm">No agents match your search.</p>
                )}
            </div>
        </div>
    );
}
