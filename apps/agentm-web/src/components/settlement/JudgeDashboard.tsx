'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { useJudgeAndPay, type JudgeTask } from '@/hooks/useJudgeAndPay';
import { useWalletChain } from '@/hooks/useWalletChain';
import { JudgeSubmissionView } from './JudgeSubmissionView';
import { getExplorerUrl } from '@/hooks/useArenaTask';

function formatTokenAmount(amount: number, chain: 'solana' | 'evm' | null): string {
    const divisor = chain === 'evm' ? 1e18 : 1e9;
    return `${(amount / divisor).toFixed(4)} ${chain === 'evm' ? 'ETH' : 'SOL'}`;
}

interface JudgeDashboardProps {
    walletAddress: string | null;
}

export function JudgeDashboard({ walletAddress }: JudgeDashboardProps) {
    const { tasksToJudge, loading, error, txHash, judgeTask } = useJudgeAndPay(walletAddress);
    const { chain, chainId } = useWalletChain();
    const [selectedTask, setSelectedTask] = useState<JudgeTask | null>(null);

    const handleJudge = async (
        params: {
            winner: Address | `0x${string}`;
            score: number;
            reasonRef: string;
        },
        usePER?: boolean,
    ) => {
        if (!selectedTask) return;
        const sig = await judgeTask(
            selectedTask.task,
            {
                winner: params.winner,
                score: params.score,
                reasonRef: params.reasonRef,
            },
            { usePER },
        );
        if (sig) {
            setSelectedTask(null);
        }
    };

    return (
        <div style={styles.page}>
            <h1 style={styles.title}>Judge Dashboard</h1>

            {error && <div style={styles.errorBox}>{error}</div>}
            {txHash && (
                <div style={styles.successBox}>
                    Transaction confirmed:{' '}
                    <a
                        href={getExplorerUrl(txHash, chain ?? 'solana', chainId)}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.link}
                    >
                        {txHash.slice(0, 16)}…
                    </a>
                </div>
            )}

            {loading && tasksToJudge.length === 0 && <div style={styles.loading}>Loading tasks…</div>}

            {!selectedTask && (
                <div style={styles.taskList}>
                    {tasksToJudge.length === 0 && !loading && <p style={styles.empty}>No pending tasks to judge.</p>}
                    {tasksToJudge.map(({ task, submissions }) => (
                        <button
                            key={task.task_id}
                            type="button"
                            onClick={() => setSelectedTask({ task, submissions })}
                            style={styles.taskCard}
                        >
                            <div style={styles.taskHeader}>
                                <span style={styles.taskId}>Task #{task.task_id.toString()}</span>
                                <span style={styles.submissionCount}>{submissions.length} submissions</span>
                            </div>
                            <div style={styles.taskReward}>Reward: {formatTokenAmount(task.reward, chain)}</div>
                        </button>
                    ))}
                </div>
            )}

            {selectedTask && (
                <div style={styles.detail}>
                    <button type="button" onClick={() => setSelectedTask(null)} style={styles.backButton}>
                        ← Back to tasks
                    </button>
                    <JudgeSubmissionView
                        task={selectedTask.task}
                        submissions={selectedTask.submissions}
                        onJudge={handleJudge}
                        loading={loading}
                    />
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        padding: '24px',
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    title: {
        margin: 0,
        fontSize: '24px',
        fontWeight: 700,
        color: '#16161A',
    },
    errorBox: {
        backgroundColor: '#FFE5E5',
        color: '#B00020',
        padding: '12px 16px',
        borderRadius: '10px',
        fontSize: '14px',
    },
    successBox: {
        backgroundColor: '#E8F5E9',
        color: '#1B5E20',
        padding: '12px 16px',
        borderRadius: '10px',
        fontSize: '14px',
    },
    link: {
        color: '#1B5E20',
        textDecoration: 'underline',
    },
    loading: {
        color: '#555',
        fontSize: '14px',
    },
    empty: {
        color: '#888',
        fontSize: '14px',
    },
    taskList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    taskCard: {
        textAlign: 'left',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #E8E8ED',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    },
    taskHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
    },
    taskId: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#16161A',
    },
    submissionCount: {
        fontSize: '13px',
        color: '#666',
    },
    taskReward: {
        fontSize: '14px',
        color: '#333',
    },
    detail: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    backButton: {
        alignSelf: 'flex-start',
        padding: '8px 12px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#F3F3F8',
        color: '#16161A',
        fontSize: '14px',
        cursor: 'pointer',
    },
};
