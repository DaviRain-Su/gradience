'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useArenaTask } from '@/hooks/useArenaTask';
import { useWalletChain } from '@/hooks/useWalletChain';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import { useMagicBlock } from '@/hooks/useMagicBlock';
import { getExplorerUrl } from '@/hooks/useArenaTask';
import { ExecutionModeSelector, type ExecutionModeId } from '@/components/settlement/ExecutionModeSelector';
import { MagicBlockStatus } from '@/components/settlement/MagicBlockStatus';
import type { Address } from '@solana/kit';

const CATEGORY_OPTIONS = [
    { value: 0, label: 'DeFi Analysis' },
    { value: 1, label: 'Trading Bot' },
    { value: 2, label: 'Smart Contract Audit' },
    { value: 3, label: 'Data Analysis' },
    { value: 4, label: 'Content Creation' },
    { value: 5, label: 'Code Review' },
    { value: 6, label: 'Research' },
    { value: 7, label: 'Other' },
];

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

export default function CreateArenaTaskPage() {
    const router = useRouter();
    const { walletAddress } = useDaemonConnection();
    const arena = useArenaTask(walletAddress);
    const { chain, chainId } = useWalletChain();

    const [evalRef, setEvalRef] = useState('');
    const [category, setCategory] = useState<number>(7);
    const [reward, setReward] = useState('');
    const [minStake, setMinStake] = useState('');
    const [deadline, setDeadline] = useState('');
    const [judgeMode, setJudgeMode] = useState<number>(1);
    const [judgeAddress, setJudgeAddress] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'sealed'>('public');
    const [executionMode, setExecutionMode] = useState<ExecutionModeId>('l1');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        taskId: bigint;
        signature: string;
    } | null>(null);

    const tokenSymbol = chain === 'evm' ? 'ETH' : 'SOL';
    const magicBlock = useMagicBlock();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!walletAddress) {
            setError('Please connect your wallet first');
            return;
        }
        if (!evalRef.trim() || !reward || !deadline) {
            setError('Please fill in all required fields');
            return;
        }

        const now = Date.now();
        const deadlineMs = new Date(deadline).getTime();
        if (deadlineMs <= now) {
            setError('Deadline must be in the future');
            return;
        }

        const deadlineOffsetSeconds = Math.floor((deadlineMs - now) / 1000);

        let rewardValue: string | number | bigint = reward;
        let minStakeValue: string | number | bigint | undefined = minStake || undefined;

        if (chain !== 'evm') {
            rewardValue = BigInt(Math.round(parseFloat(reward) * 1e9));
            minStakeValue = minStake ? BigInt(Math.round(parseFloat(minStake) * 1e9)) : undefined;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            let sessionId: string | undefined;
            if (chain !== 'evm' && magicBlock.isAvailable && executionMode !== 'l1') {
                sessionId = await magicBlock.createSession(executionMode, [walletAddress]);
            }

            const res = await arena.postTask({
                evalRef: evalRef.trim(),
                category,
                reward: rewardValue,
                minStake: minStakeValue,
                deadlineOffsetSeconds,
                judgeMode,
                judge: judgeMode === 0 ? (judgeAddress as Address | `0x${string}`) : undefined,
                executionMode,
                sessionId,
            });

            if (!res) {
                throw new Error(arena.error || 'Failed to post task');
            }

            setResult(res);
            setTimeout(() => {
                router.push(`/tasks/${res.taskId.toString()}`);
            }, 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: c.bg, padding: '24px' }}>
            <div
                style={{
                    maxWidth: '720px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        background: c.surface,
                        borderRadius: '16px',
                        padding: '24px',
                        border: `1.5px solid ${c.ink}`,
                    }}
                >
                    <Link
                        href="/tasks"
                        style={{
                            color: '#666',
                            textDecoration: 'none',
                            fontSize: '14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '12px',
                        }}
                    >
                        ← Back to tasks
                    </Link>
                    <h1
                        style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '24px',
                            fontWeight: 700,
                            margin: 0,
                            color: c.ink,
                        }}
                    >
                        Post Arena Task
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
                        Create an on-chain task with escrow. Reward will be locked until a judge settles the task.
                    </p>
                </div>

                {/* Error / Success */}
                {error && (
                    <div
                        style={{
                            background: '#fee2e2',
                            border: '1.5px solid #dc2626',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: '#991b1b',
                            fontSize: '14px',
                        }}
                    >
                        {error}
                    </div>
                )}

                {result && (
                    <div
                        style={{
                            background: '#dcfce7',
                            border: '1.5px solid #16a34a',
                            borderRadius: '12px',
                            padding: '16px',
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#166534',
                            }}
                        >
                            Task #{result.taskId.toString()} created successfully!
                        </p>
                        <a
                            href={getExplorerUrl(result.signature, chain ?? 'solana', chainId)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'underline' }}
                        >
                            View transaction on Explorer
                        </a>
                    </div>
                )}

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    style={{
                        background: c.surface,
                        borderRadius: '16px',
                        padding: '24px',
                        border: `1.5px solid ${c.ink}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                    }}
                >
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontWeight: 600,
                                marginBottom: '8px',
                                fontSize: '14px',
                            }}
                        >
                            Task Description (evalRef) *
                        </label>
                        <textarea
                            value={evalRef}
                            onChange={(e) => setEvalRef(e.target.value)}
                            placeholder="Describe what you want agents to do..."
                            rows={4}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: '1.5px solid #e5e5e5',
                                fontSize: '14px',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontWeight: 600,
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                }}
                            >
                                Category *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e5e5e5',
                                    fontSize: '14px',
                                }}
                            >
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontWeight: 600,
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                }}
                            >
                                Reward ({tokenSymbol}) *
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={reward}
                                onChange={(e) => setReward(e.target.value)}
                                placeholder="0.1"
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e5e5e5',
                                    fontSize: '14px',
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontWeight: 600,
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                }}
                            >
                                Min Stake ({tokenSymbol})
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={minStake}
                                onChange={(e) => setMinStake(e.target.value)}
                                placeholder="0"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e5e5e5',
                                    fontSize: '14px',
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontWeight: 600,
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                }}
                            >
                                Deadline *
                            </label>
                            <input
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e5e5e5',
                                    fontSize: '14px',
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontWeight: 600,
                                marginBottom: '8px',
                                fontSize: '14px',
                            }}
                        >
                            Judge Mode *
                        </label>
                        <select
                            value={judgeMode}
                            onChange={(e) => setJudgeMode(Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: '1.5px solid #e5e5e5',
                                fontSize: '14px',
                            }}
                        >
                            <option value={1}>Self Judge (Poster judges)</option>
                            <option value={0}>Designated Judge</option>
                        </select>
                    </div>

                    {judgeMode === 0 && (
                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontWeight: 600,
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                }}
                            >
                                Judge Address *
                            </label>
                            <input
                                type="text"
                                value={judgeAddress}
                                onChange={(e) => setJudgeAddress(e.target.value)}
                                placeholder={chain === 'evm' ? '0x...' : 'Solana address'}
                                required={judgeMode === 0}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e5e5e5',
                                    fontSize: '14px',
                                }}
                            />
                        </div>
                    )}

                    {chain !== 'evm' && (
                        <>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontWeight: 600,
                                        marginBottom: '8px',
                                        fontSize: '14px',
                                    }}
                                >
                                    Task Visibility
                                </label>
                                <select
                                    value={visibility}
                                    onChange={(e) => setVisibility(e.target.value as 'public' | 'sealed')}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        border: '1.5px solid #e5e5e5',
                                        fontSize: '14px',
                                    }}
                                >
                                    <option value="public">Public (all submissions visible)</option>
                                    <option value="sealed">Sealed (encrypted until judged)</option>
                                </select>
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontWeight: 600,
                                        marginBottom: '8px',
                                        fontSize: '14px',
                                    }}
                                >
                                    Execution Mode
                                </label>
                                <ExecutionModeSelector
                                    value={executionMode}
                                    onChange={setExecutionMode}
                                    taskVisibility={visibility}
                                />
                            </div>

                            {magicBlock.sessions.length > 0 && (
                                <MagicBlockStatus
                                    sessions={[
                                        ...magicBlock.sessions.map((s) => ({
                                            id: s.id,
                                            mode: s.mode,
                                            status: (s.state === 'active'
                                                ? 'active'
                                                : 'connecting') as import('@/components/settlement/MagicBlockStatus').SessionStatus,
                                            latencyMs: s.mode === 'er' ? 8 : s.mode === 'per' ? 12 : 400,
                                            tps: s.mode === 'er' ? 5000 : s.mode === 'per' ? 3000 : 400,
                                        })),
                                    ]}
                                    preferredSessionId={magicBlock.preferredSessionId ?? undefined}
                                />
                            )}
                        </>
                    )}

                    <div
                        style={{
                            padding: '12px 16px',
                            background: '#f9f9fb',
                            borderRadius: '10px',
                            fontSize: '13px',
                            color: '#666',
                        }}
                    >
                        Settlement split: <strong>95%</strong> winner / <strong>3%</strong> judge / <strong>2%</strong>{' '}
                        protocol
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !walletAddress}
                        style={{
                            marginTop: '4px',
                            padding: '14px 28px',
                            background: loading || !walletAddress ? '#ccc' : c.lime,
                            color: c.ink,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: loading || !walletAddress ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading
                            ? 'Posting task...'
                            : walletAddress
                              ? `Post Task & Lock ${tokenSymbol}`
                              : 'Connect wallet to post'}
                    </button>
                </form>
            </div>
        </div>
    );
}
