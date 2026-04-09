'use client';

import { address } from '@solana/kit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReputationOnChain } from '@gradiences/sdk';

import { createSdk } from '../lib/sdk';

interface ReputationPanelProps {
    walletAddress: string | null;
}

export function ReputationPanel({ walletAddress }: ReputationPanelProps) {
    const sdk = useMemo(() => createSdk(), []);
    const [reputation, setReputation] = useState<ReputationOnChain | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!walletAddress) {
            setReputation(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const row = await sdk.reputation.get(address(walletAddress));
            setReputation(row);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
            setReputation(null);
        } finally {
            setLoading(false);
        }
    }, [sdk, walletAddress]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Reputation PDA</h2>
                <button type="button" className="secondary" onClick={() => void refresh()} disabled={!walletAddress}>
                    Refresh
                </button>
            </div>
            {!walletAddress && <p className="muted">Select wallet to query reputation.</p>}
            {loading && <p className="muted">Loading reputation…</p>}
            {error && <p className="error">{error}</p>}
            {walletAddress && !loading && !error && !reputation && (
                <p className="muted">No reputation account found for this wallet.</p>
            )}
            {reputation && (
                <div>
                    <p>
                        <strong>Global Average Score:</strong> {reputation.avgScore / 100}
                    </p>
                    <p>
                        <strong>Global Win Rate:</strong> {reputation.winRate / 100}%
                    </p>
                    <p>
                        <strong>Completed:</strong> {reputation.completed}
                    </p>
                    <p>
                        <strong>Total Applied:</strong> {reputation.totalApplied}
                    </p>
                    <p>
                        <strong>Total Earned:</strong> {reputation.totalEarned.toString()}
                    </p>

                    <h3 style={{ marginTop: 16 }}>Category Stats</h3>
                    {reputation.byCategory.length === 0 ? (
                        <p className="muted">No category-level records.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Avg Score</th>
                                    <th>Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reputation.byCategory.map((row) => (
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
    );
}
