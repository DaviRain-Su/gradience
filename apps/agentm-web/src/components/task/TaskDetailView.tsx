'use client';

import { useEffect, useState } from 'react';
import { useArenaTask, type TaskApi } from '@/hooks/useArenaTask';
import { TaskDetailPanel } from './TaskDetailPanel';

const colors = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
};

interface TaskDetailViewProps {
  taskId: number;
  walletAddress: string | null;
  onBack: () => void;
}

export function TaskDetailView({ taskId, walletAddress, onBack }: TaskDetailViewProps) {
  const arena = useArenaTask(walletAddress);
  const [task, setTask] = useState<TaskApi | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    arena
      .fetchTask(taskId)
      .then((data) => {
        if (data) setTask(data);
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          background: colors.surface,
          borderRadius: '16px',
          border: `1.5px solid ${colors.ink}`,
        }}
      >
        Loading task...
      </div>
    );
  }

  if (!task) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          background: colors.surface,
          borderRadius: '16px',
          border: `1.5px solid ${colors.ink}`,
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink }}>Task not found</h3>
        <p style={{ fontSize: '14px', color: colors.ink, opacity: 0.6 }}>
          The task ID #{taskId} does not exist or has been removed.
        </p>
        <button
          onClick={onBack}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: colors.ink,
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  return (
    <TaskDetailPanel
      task={task}
      walletAddress={walletAddress || ''}
      onClose={onBack}
    />
  );
}
