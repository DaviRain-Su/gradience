'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { address } from '@solana/kit';

import { createSdk } from '../lib/sdk';
import { useFrontendWallet } from '../lib/use-frontend-wallet';

interface FormState {
    taskId: string;
    evalRef: string;
    reward: string;
    minStake: string;
    category: string;
    judgeMode: string;
    judge: string;
    deadlineSeconds: string;
    judgeDeadlineSeconds: string;
}

const DEFAULTS: FormState = {
    taskId: '',
    evalRef: '',
    reward: '1000000',
    minStake: '10000',
    category: '0',
    judgeMode: '0',
    judge: '',
    deadlineSeconds: '3600',
    judgeDeadlineSeconds: '7200',
};

export function PostTaskForm({ onPosted }: { onPosted: () => void }) {
    const sdk = useMemo(() => createSdk(), []);
    const [form, setForm] = useState<FormState>(DEFAULTS);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
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

    useEffect(() => {
        if (!adapter) {
            setStatus(null);
        }
    }, [adapter]);

    const connectWallet = async () => {
        setError(null);
        setStatus(null);
        try {
            await connectLocal();
        } catch (connectError) {
            setError(connectError instanceof Error ? connectError.message : String(connectError));
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setStatus(null);
        if (!adapter) {
            setError('Connect wallet first.');
            return;
        }

        setSubmitting(true);
        try {
            const now = Math.floor(Date.now() / 1000);
            const taskId = parseUnsignedBigInt(form.taskId, 'task-id');
            const reward = parseUnsignedBigInt(form.reward, 'reward');
            const minStake = parseUnsignedBigInt(form.minStake, 'min-stake');
            const category = parseBoundedInteger(form.category, 'category', 0, 7);
            const judgeMode = parseBoundedInteger(form.judgeMode, 'judge-mode', 0, 1);
            const evalRef = form.evalRef.trim();
            if (!evalRef) {
                throw new Error('eval-ref is required.');
            }
            const deadlineSeconds = parsePositiveInteger(form.deadlineSeconds, 'deadline in seconds from now');
            const judgeDeadlineSeconds = parsePositiveInteger(
                form.judgeDeadlineSeconds,
                'judge-deadline in seconds from now',
            );
            if (judgeDeadlineSeconds < deadlineSeconds) {
                throw new Error('judge-deadline must be greater than or equal to deadline.');
            }

            const signature = await sdk.task.post(adapter, {
                taskId,
                evalRef,
                reward,
                minStake,
                category,
                judgeMode,
                judge: form.judge.trim() ? address(form.judge.trim()) : undefined,
                deadline: BigInt(now + deadlineSeconds),
                judgeDeadline: BigInt(now + judgeDeadlineSeconds),
            });
            setStatus(signature);
            setForm(current => ({ ...current, taskId: '', evalRef: '' }));
            onPosted();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : String(submitError));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="rounded-xl border border-zinc-700 p-4">
            <h2 className="text-lg font-semibold">Post Task</h2>
            <p className="mt-1 text-sm text-zinc-400">
                {signerAddress
                    ? `Connected (${activeWalletKind ?? 'local'}): ${signerAddress}`
                    : 'No wallet connected. Use Phantom/Solflare or paste a 64-byte keypair JSON.'}
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
                                setStatus(null);
                                setError(null);
                            }}
                            className="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
                        >
                            Disconnect
                        </button>
                    )}
                </div>
                {injectedError && <p className="text-sm text-red-400">{injectedError}</p>}
            </div>

            <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={form.taskId}
                    onChange={event => setForm({ ...form, taskId: event.target.value })}
                    placeholder="task-id (u64)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.evalRef}
                    onChange={event => setForm({ ...form, evalRef: event.target.value })}
                    placeholder="eval-ref (cid/ipfs/ar)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.reward}
                    onChange={event => setForm({ ...form, reward: event.target.value })}
                    placeholder="reward (lamports)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.minStake}
                    onChange={event => setForm({ ...form, minStake: event.target.value })}
                    placeholder="min-stake (lamports)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.category}
                    onChange={event => setForm({ ...form, category: event.target.value })}
                    placeholder="category (0-7)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.judgeMode}
                    onChange={event => setForm({ ...form, judgeMode: event.target.value })}
                    placeholder="judge-mode (0 designated, 1 pool)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.judge}
                    onChange={event => setForm({ ...form, judge: event.target.value })}
                    placeholder="judge address (optional)"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                />
                <input
                    value={form.deadlineSeconds}
                    onChange={event => setForm({ ...form, deadlineSeconds: event.target.value })}
                    placeholder="deadline in seconds from now"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <input
                    value={form.judgeDeadlineSeconds}
                    onChange={event => setForm({ ...form, judgeDeadlineSeconds: event.target.value })}
                    placeholder="judge-deadline in seconds from now"
                    className="rounded border border-zinc-700 bg-transparent p-2 text-sm"
                    required
                />
                <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                    {submitting ? 'Posting…' : 'Post Task'}
                </button>
            </form>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {status && <p className="mt-2 break-all text-xs text-emerald-400">Task posted. Signature: {status}</p>}
        </section>
    );
}

function parseUnsignedBigInt(value: string, field: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
        throw new Error(`${field} must be an unsigned integer.`);
    }
    return BigInt(normalized);
}

function parsePositiveInteger(value: string, field: string): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
        throw new Error(`${field} must be a positive integer.`);
    }
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed <= 0 || !Number.isFinite(parsed)) {
        throw new Error(`${field} must be a positive integer.`);
    }
    return parsed;
}

function parseBoundedInteger(value: string, field: string, min: number, max: number): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
        throw new Error(`${field} must be an integer between ${min} and ${max}.`);
    }
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new Error(`${field} must be an integer between ${min} and ${max}.`);
    }
    return parsed;
}
