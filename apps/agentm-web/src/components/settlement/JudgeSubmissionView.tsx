'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { useWalletChain } from '@/hooks/useWalletChain';
import type { SubmissionApi, TaskApi } from '@/hooks/useArenaTask';

interface JudgeSubmissionViewProps {
  task: TaskApi;
  submissions: SubmissionApi[];
  onJudge: (params: {
    winner: Address | `0x${string}`;
    score: number;
    reasonRef: string;
  }) => void;
  loading?: boolean;
}

function formatTokenAmount(amount: number, chain: 'solana' | 'evm' | null): string {
  const divisor = chain === 'evm' ? 1e18 : 1e9;
  return `${(amount / divisor).toFixed(4)} ${chain === 'evm' ? 'ETH' : 'SOL'}`;
}

export function JudgeSubmissionView({
  task,
  submissions,
  onJudge,
  loading,
}: JudgeSubmissionViewProps) {
  const { chain } = useWalletChain();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [score, setScore] = useState<number>(85);
  const [reasonRef, setReasonRef] = useState('');

  const handleJudge = () => {
    if (!selectedAgent) return;
    onJudge({
      winner: selectedAgent as Address | `0x${string}`,
      score,
      reasonRef,
    });
  };

  const reward = typeof task.reward === 'bigint' ? Number(task.reward) : task.reward;
  const agentPayout = (reward * 95) / 100;
  const judgeFee = (reward * 3) / 100;
  const protocolFee = (reward * 2) / 100;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Task #{task.task_id.toString()}</h2>
      <p style={styles.reward}>Reward: {formatTokenAmount(reward, chain)}</p>
      <p style={styles.split}>
        Winner: {formatTokenAmount(agentPayout, chain)} · Judge: {formatTokenAmount(judgeFee, chain)} · Protocol: {formatTokenAmount(protocolFee, chain)}
      </p>

      <div style={styles.submissions}>
        {submissions.length === 0 && <p style={styles.empty}>No submissions yet.</p>}
        {submissions.map((sub) => (
          <button
            key={sub.agent}
            type="button"
            onClick={() => setSelectedAgent(sub.agent)}
            style={{
              ...styles.submissionCard,
              ...(selectedAgent === sub.agent ? styles.selected : {}),
            }}
          >
            <div style={styles.agentLabel}>Agent</div>
            <div style={styles.agentAddress}>{sub.agent}</div>
            <div style={styles.resultRef}>{sub.result_ref}</div>
            <div style={styles.traceRef}>{sub.trace_ref}</div>
          </button>
        ))}
      </div>

      <div style={styles.controls}>
        <label style={styles.label}>
          Score (0–100)
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            style={styles.scoreInput}
          />
        </label>

        <label style={styles.label}>
          Reason Reference (IPFS / text)
          <input
            type="text"
            value={reasonRef}
            onChange={(e) => setReasonRef(e.target.value)}
            style={styles.reasonInput}
          />
        </label>

        <button
          type="button"
          onClick={handleJudge}
          disabled={!selectedAgent || loading}
          style={{
            ...styles.judgeButton,
            ...(loading || !selectedAgent ? styles.judgeButtonDisabled : {}),
          }}
        >
          {loading ? 'Judging...' : 'Confirm Winner & Pay'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  heading: {
    margin: 0,
    color: '#16161A',
    fontSize: '20px',
    fontWeight: 600,
  },
  reward: {
    margin: 0,
    color: '#16161A',
    fontSize: '16px',
    fontWeight: 500,
  },
  split: {
    margin: 0,
    color: '#555',
    fontSize: '14px',
  },
  submissions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  empty: {
    color: '#888',
    fontSize: '14px',
  },
  submissionCard: {
    textAlign: 'left',
    backgroundColor: '#F3F3F8',
    border: '1px solid transparent',
    borderRadius: '10px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'border 0.2s',
  },
  selected: {
    border: '2px solid #CDFF4D',
  },
  agentLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px',
  },
  agentAddress: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#16161A',
    wordBreak: 'break-all',
  },
  resultRef: {
    fontSize: '13px',
    color: '#333',
    marginTop: '8px',
  },
  traceRef: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '14px',
    color: '#16161A',
  },
  scoreInput: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #DDD',
    fontSize: '14px',
    width: '120px',
  },
  reasonInput: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #DDD',
    fontSize: '14px',
  },
  judgeButton: {
    marginTop: '8px',
    padding: '12px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#CDFF4D',
    color: '#16161A',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
  },
  judgeButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
