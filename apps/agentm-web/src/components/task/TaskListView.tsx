'use client';

import { useEffect, useState } from 'react';
import { useArenaTask, type TaskApi } from '@/hooks/useArenaTask';
import { useWalletChain } from '@/hooks/useWalletChain';
import Link from 'next/link';

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

const colors = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
};

interface TaskListViewProps {
  walletAddress: string | null;
}

function formatTokenAmount(amount: number, chain: 'solana' | 'evm' | null): string {
  const divisor = chain === 'evm' ? 1e18 : 1e9;
  return `${(amount / divisor).toFixed(4)} ${chain === 'evm' ? 'ETH' : 'SOL'}`;
}

export function TaskListView({ walletAddress }: TaskListViewProps) {
  const arena = useArenaTask(walletAddress);
  const { chain } = useWalletChain();
  const [tasks, setTasks] = useState<TaskApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed' | 'refunded'>('all');
  const [sortBy, setSortBy] = useState<'reward' | 'deadline'>('deadline');

  useEffect(() => {
    setLoading(true);
    arena
      .fetchTasks({ status: filter === 'all' ? undefined : filter, limit: 50 })
      .then((data) => {
        setTasks(data || []);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'reward') return b.reward - a.reward;
    return a.deadline - b.deadline;
  });

  const tokenLabel = chain === 'evm' ? 'ETH' : 'SOL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            color: colors.ink,
            fontFamily: "'Oswald', sans-serif",
          }}
        >
          Open Tasks
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${colors.ink}`,
              fontSize: '14px',
              background: colors.surface,
            }}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${colors.ink}`,
              fontSize: '14px',
              background: colors.surface,
            }}
          >
            <option value="deadline">Sort by Deadline</option>
            <option value="reward">Sort by Reward</option>
          </select>
        </div>
      </div>

      {loading && tasks.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>Loading tasks...</div>
      )}

      {!loading && tasks.length === 0 && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            background: colors.surface,
            borderRadius: '16px',
            border: `1.5px solid ${colors.ink}`,
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, marginBottom: '8px' }}>
            No Tasks Found
          </h3>
          <p style={{ fontSize: '14px', color: colors.ink, opacity: 0.6 }}>
            There are no tasks matching the selected filter.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sortedTasks.map((task) => (
          <Link
            key={task.task_id}
            href={`/tasks/${task.task_id}`}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                background: colors.surface,
                borderRadius: '16px',
                padding: '20px',
                border: `1.5px solid ${colors.ink}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: STATE_COLORS[task.state] ?? '#666',
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}
                >
                  {task.state}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink, opacity: 0.7 }}>
                  {CATEGORY_LABELS[task.category] ?? `Category ${task.category}`}
                </span>
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: colors.ink, margin: 0 }}>
                {task.eval_ref.slice(0, 80)}
                {task.eval_ref.length > 80 ? '...' : ''}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ opacity: 0.5 }}>Reward:</span>{' '}
                  <strong>{formatTokenAmount(task.reward, chain)}</strong>
                </div>
                <div>
                  <span style={{ opacity: 0.5 }}>Min Stake:</span>{' '}
                  <strong>{formatTokenAmount(task.min_stake, chain)}</strong>
                </div>
                <div>
                  <span style={{ opacity: 0.5 }}>Deadline:</span>{' '}
                  {new Date(task.deadline * 1000).toLocaleString()}
                </div>
                <div>
                  <span style={{ opacity: 0.5 }}>Submissions:</span> {task.submission_count}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
