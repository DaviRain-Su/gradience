'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { address } from '@solana/kit';
import type { SubmissionApi, TaskApi } from '@gradience/sdk';

import { createSdk } from '../lib/sdk';
import { useFrontendWallet } from '../lib/use-frontend-wallet';

interface JudgeFormState {
    winner: string;
    score: string;
    reasonRef: string;
}

function formatUnixTime(value: number): string {
    if (!value) {
        return '—';
    }
    return new Date(value * 1000).toLocaleString();
}

function defaultJudgeForm(taskId: number): JudgeFormState {
    return {
        winner: '',
        score: '80',
        reasonRef: `manual://judge/${taskId}/${Date.now()}`,
    };
}

export function TaskDetail({ taskId }: { taskId: number }) {
    const sdk = useMemo(() => createSdk(), []);
    const [task, setTask] = useState<TaskApi | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionApi[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [judgeForm, setJudgeForm] = useState<JudgeFormState>(() => defaultJudgeForm(taskId));
    const [judgeStatus, setJudgeStatus] = useState<string | null>(null);
    const [judgeError, setJudgeError] = useState<string | null>(null);
    const [judging, setJudging] = useState(false);

    const {
        adapter,
        signerAddress,
        activeWalletKind,
        secretInput,
        setSecretInput,
        localConnecting,
        connectLocal,
        disconnectLocal,
        injectedWallets,
        injectedConnecting,
        injectedError,
        connectInjected,
        disconnectInjected,
        refreshInjectedWallets,
    } = useFrontendWallet();

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [taskData, submissionData] = await Promise.all([
                sdk.getTask(taskId),
                sdk.getTaskSubmissions(taskId, { sort: 'score' }),
            ]);
            setTask(taskData);
            const rows = submissionData ?? [];
            setSubmissions(rows);
            if (rows.length > 0) {
                setJudgeForm(current =>
                    current.winner
                        ? current
                        : {
                              ...current,
                              winner: rows[0]?.agent ?? '',
                          },
                );
            }
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        } finally {
            setLoading(false);
        }
    }, [sdk, taskId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const connectWallet = async () => {
        setJudgeError(null);
        try {
            await connectLocal();
        } catch (connectError) {
            setJudgeError(connectError instanceof Error ? connectError.message : String(connectError));
        }
    };

    const canJudge = Boolean(task) && Boolean(signerAddress) && task?.judge === signerAddress && task?.state === 'open';

    const submitJudge = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!task || !adapter) {
            setJudgeError('Connect wallet and load task before judging.');
            return;
        }
        if (!canJudge) {
            setJudgeError('Only the designated judge for this open task can judge.');
            return;
        }
        setJudgeError(null);
        setJudgeStatus(null);
        setJudging(true);
        try {
            const signature = await sdk.task.judge(adapter, {
                taskId,
                poster: address(task.poster),
                winner: address(judgeForm.winner),
                score: Number(judgeForm.score),
                reasonRef: judgeForm.reasonRef.trim(),
            });
            setJudgeStatus(signature);
            await refresh();
        } catch (judgeActionError) {
            setJudgeError(judgeActionError instanceof Error ? judgeActionError.message : String(judgeActionError));
        } finally {
            setJudging(false);
        }
    };

    return (
        <main className="mx-auto min-h-screen max-w-5xl p-6">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Task #{taskId}</h1>
                <Link href="/" className="text-sm underline">
                    Back to list
                </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-zinc-700 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Task Detail</h2>
                        <button
                            type="button"
                            onClick={() => void refresh()}
                            className="rounded bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600"
                        >
                            Refresh
                        </button>
                    </div>
                    {loading && <p className="text-sm text-zinc-400">Loading task…</p>}
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {!loading && !task && !error && <p className="text-sm text-zinc-400">Task not found.</p>}
                    {task && (
                        <div className="space-y-1 text-sm">
                            <p>
                                <span className="text-zinc-400">State:</span> {task.state}
                            </p>
                            <p>
                                <span className="text-zinc-400">Judge:</span>{' '}
                                <span className="break-all">{task.judge}</span>
                            </p>
                            <p>
                                <span className="text-zinc-400">Poster:</span>{' '}
                                <span className="break-all">{task.poster}</span>
                            </p>
                            <p>
                                <span className="text-zinc-400">Deadline:</span> {formatUnixTime(task.deadline)}
                            </p>
                            <p>
                                <span className="text-zinc-400">Judge deadline:</span>{' '}
                                {formatUnixTime(task.judge_deadline)}
                            </p>
                            <p>
                                <span className="text-zinc-400">Eval ref:</span>{' '}
                                <span className="break-all">{task.eval_ref}</span>
                            </p>
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-zinc-700 p-4">
                    <h2 className="text-lg font-semibold">Submissions (sort=score)</h2>
                    {submissions.length === 0 ? (
                        <p className="mt-2 text-sm text-zinc-400">No submissions.</p>
                    ) : (
                        <ul className="mt-2 space-y-2">
                            {submissions.map(submission => (
                                <li
                                    key={`${submission.task_id}:${submission.agent}`}
                                    className="rounded border border-zinc-800 p-2 text-xs"
                                >
                                    <p className="break-all text-zinc-200">Agent: {submission.agent}</p>
                                    <p className="break-all text-zinc-400">result_ref: {submission.result_ref}</p>
                                    <p className="break-all text-zinc-400">trace_ref: {submission.trace_ref}</p>
                                    <p className="text-zinc-500">slot: {submission.submission_slot}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="mt-4 rounded-xl border border-zinc-700 p-4">
                <h2 className="text-lg font-semibold">Judge Action</h2>
                <p className="mt-1 text-sm text-zinc-400">
                    {signerAddress
                        ? `Connected (${activeWalletKind ?? 'local'}): ${signerAddress}`
                        : 'No wallet connected. Use Phantom/Solflare or paste 64-byte keypair JSON.'}
                </p>
                <div className="mt-3 space-y-2">
                    {injectedWallets.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {injectedWallets.map(wallet => (
                                <button
                                    key={wallet.id}
                                    type="button"
                                    onClick={() => void connectInjected(wallet.id)}
                                    disabled={injectedConnecting}
                                    className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-600 disabled:opacity-60"
                                >
                                    {injectedConnecting ? 'Connecting…' : `Connect ${wallet.name}`}
                                </button>
                            ))}
                            {activeWalletKind === 'injected' && (
                                <button
                                    type="button"
                                    onClick={() => void disconnectInjected()}
                                    className="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
                                >
                                    Disconnect Browser Wallet
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500">
                                No injected wallets detected. Install Phantom/Solflare/OKX.
                            </p>
                            <button
                                type="button"
                                onClick={refreshInjectedWallets}
                                className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
                            >
                                Retry detect
                            </button>
                        </div>
                    )}
                    <textarea
                        value={secretInput}
                        onChange={event => setSecretInput(event.target.value)}
                        className="h-20 w-full rounded border border-zinc-700 bg-transparent p-2 text-xs"
                        placeholder="[12,34,...,64 bytes]"
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void connectWallet()}
                            disabled={localConnecting}
                            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-60"
                        >
                            {localConnecting ? 'Connecting…' : 'Connect Local Keypair'}
                        </button>
                        {(activeWalletKind === 'local' || (activeWalletKind === null && signerAddress)) && (
                            <button
                                type="button"
                                onClick={() => {
                                    disconnectLocal();
                                    setJudgeStatus(null);
                                    setJudgeError(null);
                                }}
                                className="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
                            >
                                Disconnect
                            </button>
                        )}
                    </div>
                    {injectedError && <p className="text-sm text-red-400">{injectedError}</p>}
                </div>
                {task && signerAddress && task.judge !== signerAddress && (
                    <p className="mt-3 text-sm text-amber-400">
                        Connected wallet is not the designated judge for this task.
                    </p>
                )}
                {task && task.state !== 'open' && (
                    <p className="mt-3 text-sm text-zinc-400">Task is not open; judge action disabled.</p>
                )}

                {canJudge && (
                    <form onSubmit={submitJudge} className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <select
                            value={judgeForm.winner}
                            onChange={event => setJudgeForm({ ...judgeForm, winner: event.target.value })}
                            className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                            required
                        >
                            <option value="" disabled>
                                Select winner
                            </option>
                            {submissions.map(submission => (
                                <option key={submission.agent} value={submission.agent}>
                                    {submission.agent}
                                </option>
                            ))}
                        </select>
                        <input
                            value={judgeForm.score}
                            onChange={event => setJudgeForm({ ...judgeForm, score: event.target.value })}
                            placeholder="score 0-100"
                            className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                            required
                        />
                        <input
                            value={judgeForm.reasonRef}
                            onChange={event => setJudgeForm({ ...judgeForm, reasonRef: event.target.value })}
                            placeholder="reason-ref"
                            className="rounded border border-zinc-700 bg-transparent p-2 text-sm md:col-span-2"
                            required
                        />
                        <button
                            type="submit"
                            disabled={judging}
                            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                            {judging ? 'Judging…' : 'Judge Task'}
                        </button>
                    </form>
                )}
                {judgeError && <p className="mt-2 text-sm text-red-400">{judgeError}</p>}
                {judgeStatus && (
                    <p className="mt-2 break-all text-xs text-emerald-400">Judge submitted. Signature: {judgeStatus}</p>
                )}
            </section>
        </main>
    );
}
