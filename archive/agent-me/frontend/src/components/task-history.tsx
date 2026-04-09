'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SubmissionApi, TaskApi } from '@gradiences/sdk';

import { createSdk } from '../lib/sdk';

interface TaskHistoryProps {
    walletAddress: string | null;
}

interface SubmittedTaskHistoryRow {
    task: TaskApi;
    submission: SubmissionApi;
}

function formatUnixTime(value: number): string {
    if (!value) {
        return '—';
    }
    return new Date(value * 1000).toLocaleString();
}

export function TaskHistory({ walletAddress }: TaskHistoryProps) {
    const sdk = useMemo(() => createSdk(), []);
    const [postedTasks, setPostedTasks] = useState<TaskApi[]>([]);
    const [submittedRows, setSubmittedRows] = useState<SubmittedTaskHistoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!walletAddress) {
            setPostedTasks([]);
            setSubmittedRows([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const [posted, recentTasks] = await Promise.all([
                sdk.getTasks({
                    poster: walletAddress,
                    limit: 50,
                }),
                sdk.getTasks({
                    limit: 40,
                }),
            ]);

            setPostedTasks(posted);

            const submissionsByTask = await Promise.all(
                recentTasks.map(async (task) => {
                    const submissions = await sdk.getTaskSubmissions(task.task_id, {
                        sort: 'slot',
                    });
                    return {
                        task,
                        submissions: submissions ?? [],
                    };
                }),
            );

            const matched: SubmittedTaskHistoryRow[] = [];
            for (const row of submissionsByTask) {
                const mine = row.submissions.filter((submission) => submission.agent === walletAddress);
                for (const submission of mine) {
                    matched.push({
                        task: row.task,
                        submission,
                    });
                }
            }
            matched.sort((a, b) => b.submission.submission_slot - a.submission.submission_slot);
            setSubmittedRows(matched);
        } catch (historyError) {
            setError(historyError instanceof Error ? historyError.message : String(historyError));
            setPostedTasks([]);
            setSubmittedRows([]);
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
                <h2>Task History</h2>
                <button type="button" className="secondary" onClick={() => void refresh()} disabled={!walletAddress}>
                    Refresh
                </button>
            </div>
            {!walletAddress && <p className="muted">Select wallet to query task history.</p>}
            {loading && <p className="muted">Loading history…</p>}
            {error && <p className="error">{error}</p>}

            {walletAddress && !loading && !error && (
                <div className="grid">
                    <div>
                        <h3>Posted tasks ({postedTasks.length})</h3>
                        {postedTasks.length === 0 ? (
                            <p className="muted">No posted task records.</p>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>State</th>
                                        <th>Reward</th>
                                        <th>Deadline</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {postedTasks.map((task) => (
                                        <tr key={`posted-${task.task_id}`}>
                                            <td>#{task.task_id}</td>
                                            <td>{task.state}</td>
                                            <td>{task.reward}</td>
                                            <td>{formatUnixTime(task.deadline)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div>
                        <h3>Submitted tasks ({submittedRows.length})</h3>
                        {submittedRows.length === 0 ? (
                            <p className="muted">No submissions found in recent tasks.</p>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>Submission Slot</th>
                                        <th>State</th>
                                        <th>Result Ref</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submittedRows.map((row) => (
                                        <tr key={`submitted-${row.task.task_id}-${row.submission.submission_slot}`}>
                                            <td>#{row.task.task_id}</td>
                                            <td>{row.submission.submission_slot}</td>
                                            <td>{row.task.state}</td>
                                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {row.submission.result_ref}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
