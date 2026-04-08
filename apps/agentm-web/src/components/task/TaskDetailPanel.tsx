'use client';

import { useState, useEffect } from 'react';
import { useArenaTask, type TaskApi, type SubmissionApi, getExplorerUrl } from '@/hooks/useArenaTask';
import { useWalletChain } from '@/hooks/useWalletChain';
import type { Address } from '@solana/kit';

function formatTokenAmount(amount: number, chain: 'solana' | 'evm' | null): string {
  const divisor = chain === 'evm' ? 1e18 : 1e9;
  return `${(amount / divisor).toFixed(4)} ${chain === 'evm' ? 'ETH' : 'SOL'}`;
}

const CATEGORY_LABELS: Record<number, string> = {
  0: 'DeFi Analysis',
  1: 'Trading Bot',
  2: 'Smart Contract Audit',
  3: 'Data Analysis',
  4: 'Content Creation',
  5: 'Code Review',
  6: 'Research',
  7: 'Other',
};

const STATE_COLORS: Record<string, string> = {
  open: '#16a34a',
  completed: '#2563eb',
  refunded: '#dc2626',
};

export function TaskDetailPanel({
  task,
  walletAddress,
  onClose,
}: {
  task: TaskApi;
  walletAddress: string;
  onClose: () => void;
}) {
  const arena = useArenaTask(walletAddress);
  const { chain } = useWalletChain();
  const [submissions, setSubmissions] = useState<SubmissionApi[]>([]);
  const [resultRef, setResultRef] = useState('');
  const [traceRef, setTraceRef] = useState('');
  const [judgeScore, setJudgeScore] = useState(85);
  const [judgeReason, setJudgeReason] = useState('');
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [usePER, setUsePER] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const isMyTask = task.poster.toLowerCase() === walletAddress.toLowerCase();
  const isJudge = task.judge.toLowerCase() === walletAddress.toLowerCase();
  const isOpen = task.state === 'open';
  const rewardDisplay = formatTokenAmount(task.reward, chain);

  useEffect(() => {
    arena.fetchSubmissions(task.task_id).then(subs => {
      if (subs) setSubmissions(subs);
    });
  }, [task.task_id]);

  const handleApply = async () => {
    const sig = await arena.applyForTask(task.task_id);
    if (sig) setTxSuccess(sig);
  };

  const handleSubmit = async () => {
    if (!resultRef.trim()) return;
    const sig = await arena.submitResult({
      taskId: task.task_id,
      resultRef: resultRef.trim(),
      traceRef: traceRef.trim() || 'none',
    });
    if (sig) setTxSuccess(sig);
  };

  const handleJudge = async () => {
    if (!selectedWinner) return;
    const sig = await arena.judgeAndPay({
      taskId: task.task_id,
      winner: selectedWinner as Address,
      poster: task.poster as Address,
      score: judgeScore,
      reasonRef: judgeReason.trim() || 'Evaluated by judge',
      usePER,
    });
    if (sig) setTxSuccess(sig);
  };

  const handleCancel = async () => {
    const sig = await arena.cancelTask(task.task_id);
    if (sig) setTxSuccess(sig);
  };

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: '1.5px solid #16161A',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#16161A',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: '#dc2626',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#16161A' }}>Task #{task.task_id}</h3>
        <button onClick={onClose} style={{ ...btnPrimary, background: '#F3F3F8', color: '#16161A', border: '1.5px solid #16161A' }}>Back</button>
      </div>

      {/* Task Info */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
            background: STATE_COLORS[task.state] ?? '#666',
            color: '#fff',
          }}>{task.state.toUpperCase()}</span>
          <span style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
            {CATEGORY_LABELS[task.category] ?? `Category ${task.category}`}
          </span>
        </div>
        <p style={{ fontSize: '14px', color: '#16161A', marginBottom: '12px' }}>{task.eval_ref}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
          <div><span style={{ opacity: 0.5 }}>Reward:</span> <strong>{rewardDisplay}</strong></div>
          <div><span style={{ opacity: 0.5 }}>Min Stake:</span> <strong>{formatTokenAmount(task.min_stake, chain)}</strong></div>
          <div><span style={{ opacity: 0.5 }}>Deadline:</span> {new Date(task.deadline * 1000).toLocaleString()}</div>
          <div><span style={{ opacity: 0.5 }}>Submissions:</span> {task.submission_count}</div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ opacity: 0.5 }}>Poster:</span>{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{task.poster}</span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ opacity: 0.5 }}>Judge:</span>{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{task.judge}</span>
          </div>
        </div>
      </div>

      {/* Success */}
      {txSuccess && (
        <div style={{ ...cardStyle, background: '#f0fdf4', borderColor: '#86efac' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>Transaction confirmed!</p>
          <a
            href={getExplorerUrl(txSuccess)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'underline' }}
          >View on Explorer</a>
        </div>
      )}

      {/* Error */}
      {arena.error && (
        <div style={{ ...cardStyle, background: '#fef2f2', borderColor: '#fca5a5' }}>
          <p style={{ fontSize: '12px', color: '#991b1b' }}>{arena.error}</p>
        </div>
      )}

      {/* Agent Actions: Apply + Submit */}
      {isOpen && !isMyTask && (
        <div style={cardStyle}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', marginBottom: '12px' }}>Agent Actions</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={handleApply} disabled={arena.loading} style={btnPrimary}>
              {arena.loading ? 'Sending...' : `Apply (Stake ${formatTokenAmount(task.min_stake, chain)})`}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              value={resultRef}
              onChange={e => setResultRef(e.target.value)}
              placeholder="Result reference (IPFS hash or URL)"
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }}
            />
            <input
              value={traceRef}
              onChange={e => setTraceRef(e.target.value)}
              placeholder="Trace reference (optional)"
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }}
            />
            <button onClick={handleSubmit} disabled={arena.loading || !resultRef.trim()} style={btnPrimary}>
              {arena.loading ? 'Sending...' : 'Submit Result'}
            </button>
          </div>
        </div>
      )}

      {/* Poster Actions: Cancel */}
      {isOpen && isMyTask && (
        <div style={cardStyle}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', marginBottom: '12px' }}>Poster Actions</h4>
          <button onClick={handleCancel} disabled={arena.loading} style={btnDanger}>
            {arena.loading ? 'Sending...' : 'Cancel Task & Refund'}
          </button>
        </div>
      )}

      {/* Submissions */}
      <div style={cardStyle}>
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', marginBottom: '12px' }}>
          Submissions ({submissions.length})
        </h4>
        {submissions.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>No submissions yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {submissions.map((sub, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: selectedWinner === sub.agent ? '#CDFF4D' : '#F3F3F8',
                border: selectedWinner === sub.agent ? '1.5px solid #16161A' : '1px solid #E5E5E5',
                cursor: isJudge ? 'pointer' : 'default',
              }} onClick={() => isJudge && setSelectedWinner(sub.agent)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{sub.agent.slice(0, 8)}...{sub.agent.slice(-4)}</span>
                  <span style={{ fontSize: '11px', color: '#16161A', opacity: 0.5 }}>
                    {new Date(sub.submitted_at * 1000).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.7, marginTop: '4px' }}>
                  Result: {sub.result_ref.slice(0, 40)}{sub.result_ref.length > 40 ? '...' : ''}
                </p>
                <p style={{ fontSize: '11px', color: '#16161A', opacity: 0.5 }}>
                  Runtime: {sub.runtime_provider}/{sub.runtime_model}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Judge Actions */}
      {isJudge && submissions.length > 0 && isOpen && (
        <div style={cardStyle}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', marginBottom: '12px' }}>Judge Panel</h4>
          <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '8px' }}>
            Settlement: 95% winner / 3% judge / 2% protocol
          </p>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Selected Winner: </label>
            <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              {selectedWinner ? `${selectedWinner.slice(0, 8)}...${selectedWinner.slice(-4)}` : 'Click a submission above'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Score (0-100):</label>
            <input
              type="number"
              min={0}
              max={100}
              value={judgeScore}
              onChange={e => setJudgeScore(Number(e.target.value))}
              style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '12px' }}
            />
          </div>
          <input
            value={judgeReason}
            onChange={e => setJudgeReason(e.target.value)}
            placeholder="Evaluation reason"
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', marginBottom: '8px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={usePER}
              onChange={e => setUsePER(e.target.checked)}
            />
            Use MagicBlock PER (TEE)
          </label>
          <button
            onClick={handleJudge}
            disabled={arena.loading || !selectedWinner}
            style={{ ...btnPrimary, background: selectedWinner ? '#16161A' : '#ccc' }}
          >
            {arena.loading ? 'Sending...' : usePER ? `Judge & Settle via PER (${rewardDisplay})` : `Judge & Settle (${rewardDisplay})`}
          </button>
        </div>
      )}
    </div>
  );
}
