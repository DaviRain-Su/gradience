'use client';

import Link from 'next/link';
import { address } from '@solana/kit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReputationApi, ReputationOnChain } from '@gradience/sdk';

import { createSdk } from '../lib/sdk';

interface AgentProfileProps {
    agent: string;
}

export function AgentProfile({ agent }: AgentProfileProps) {
    const sdk = useMemo(() => createSdk(), []);
    const [indexerReputation, setIndexerReputation] = useState<ReputationApi | null>(null);
    const [onChainReputation, setOnChainReputation] = useState<ReputationOnChain | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const parsedAddress = address(agent);
            const [indexerRow, onChainRow] = await Promise.all([
                sdk.getReputation(agent),
                sdk.reputation.get(parsedAddress),
            ]);
            setIndexerReputation(indexerRow);
            setOnChainReputation(onChainRow);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
            setIndexerReputation(null);
            setOnChainReputation(null);
        } finally {
            setLoading(false);
        }
    }, [sdk, agent]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <main className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Agent Profile</h1>
                <Link href="/" style={{ textDecoration: 'underline' }}>
                    Back
                </Link>
            </div>
            <p className="muted" style={{ wordBreak: 'break-all' }}>
                {agent}
            </p>
            <div style={{ marginTop: 12 }}>
                <button type="button" className="secondary" onClick={() => void refresh()}>
                    Refresh
                </button>
            </div>
            {loading && <p className="muted">Loading reputation…</p>}
            {error && <p className="error">{error}</p>}

            {!loading && !error && (
                <div className="grid" style={{ marginTop: 16 }}>
                    <section className="panel">
                        <h2>Indexer Reputation</h2>
                        {!indexerReputation ? (
                            <p className="muted">No indexer reputation record.</p>
                        ) : (
                            <div>
                                <p>
                                    <strong>Avg score:</strong>{' '}
                                    {indexerReputation.global_avg_score / 100}
                                </p>
                                <p>
                                    <strong>Win rate:</strong>{' '}
                                    {indexerReputation.global_win_rate / 100}%
                                </p>
                                <p>
                                    <strong>Completed:</strong> {indexerReputation.global_completed}
                                </p>
                                <p>
                                    <strong>Total applied:</strong>{' '}
                                    {indexerReputation.global_total_applied}
                                </p>
                                <p>
                                    <strong>Total earned:</strong>{' '}
                                    {indexerReputation.total_earned}
                                </p>
                            </div>
                        )}
                    </section>

                    <section className="panel">
                        <h2>Reputation PDA (On-chain)</h2>
                        {!onChainReputation ? (
                            <p className="muted">No on-chain Reputation PDA found.</p>
                        ) : (
                            <div>
                                <p>
                                    <strong>Avg score:</strong> {onChainReputation.avgScore / 100}
                                </p>
                                <p>
                                    <strong>Win rate:</strong> {onChainReputation.winRate / 100}%
                                </p>
                                <p>
                                    <strong>Completed:</strong> {onChainReputation.completed}
                                </p>
                                <p>
                                    <strong>Total applied:</strong> {onChainReputation.totalApplied}
                                </p>
                                <h3 style={{ marginTop: 12 }}>Category stats</h3>
                                {onChainReputation.byCategory.length === 0 ? (
                                    <p className="muted">No category records.</p>
                                ) : (
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Category</th>
                                                <th>Avg score</th>
                                                <th>Completed</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {onChainReputation.byCategory.map((row) => (
                                                <tr key={row.category}>
                                                    <td>{row.category}</td>
                                                    <td>{row.avgScore / 100}</td>
                                                    <td>{row.completed}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}
