'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createSdk } from '../lib/sdk';
import { sortAndFilterAgents, toDiscoveryRows, type AgentDiscoveryRow } from '../lib/ranking';

interface AgentDiscoveryProps {
    onInviteTargetChange: (agent: string | null) => void;
}

const CATEGORIES = [
    { id: 0, label: 'general' },
    { id: 1, label: 'defi' },
    { id: 2, label: 'code' },
    { id: 3, label: 'research' },
    { id: 4, label: 'creative' },
    { id: 5, label: 'data' },
    { id: 6, label: 'compute' },
    { id: 7, label: 'gov' },
];

export function AgentDiscovery({ onInviteTargetChange }: AgentDiscoveryProps) {
    const sdk = useMemo(() => createSdk(), []);
    const [category, setCategory] = useState(0);
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState<AgentDiscoveryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const judgePool = await sdk.getJudgePool(category);
            const reputationEntries = await Promise.all(
                (judgePool ?? []).map(async (entry) => [entry.judge, await sdk.getReputation(entry.judge)] as const),
            );
            const mapped = toDiscoveryRows(judgePool, new Map(reputationEntries));
            setRows(mapped);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [sdk, category]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const visibleRows = useMemo(() => sortAndFilterAgents(rows, query), [rows, query]);

    return (
        <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Agent Discovery</h2>
                <button type="button" className="secondary" onClick={() => void refresh()}>
                    Refresh
                </button>
            </div>
            <p className="muted">Search agents by category and rank by reputation.</p>
            <div className="grid" style={{ marginTop: 12 }}>
                <select value={category} onChange={(event) => setCategory(Number(event.target.value))}>
                    {CATEGORIES.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.id} - {item.label}
                        </option>
                    ))}
                </select>
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by agent address"
                />
            </div>
            {loading && <p className="muted">Loading agents…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && !error && visibleRows.length === 0 && (
                <p className="muted">No agents found for this category.</p>
            )}
            {visibleRows.length > 0 && (
                <table style={{ marginTop: 12 }}>
                    <thead>
                        <tr>
                            <th>Agent</th>
                            <th>Avg Score</th>
                            <th>Completed</th>
                            <th>Weight</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.map((row) => (
                            <tr key={row.agent}>
                                <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {row.agent}
                                </td>
                                <td>{(row.reputation?.global_avg_score ?? 0) / 100}</td>
                                <td>{row.reputation?.global_completed ?? 0}</td>
                                <td>{row.weight}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Link href={`/agents/${row.agent}`} style={{ textDecoration: 'underline' }}>
                                            View
                                        </Link>
                                        <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => onInviteTargetChange(row.agent)}
                                        >
                                            Invite
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
