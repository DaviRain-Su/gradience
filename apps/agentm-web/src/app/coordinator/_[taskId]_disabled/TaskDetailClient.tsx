'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CoordinatorTask {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: string;
  budget: {
    total: string;
    allocated: string;
    spent: string;
    token: string;
  };
  timeline: {
    createdAt: number;
    startedAt?: number;
    deadline: number;
    completedAt?: number;
  };
  subtasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    assignee?: string;
    dependencies: string[];
    deliverables: Array<{
      id: string;
      title: string;
      type: string;
    }>;
    evaluation?: {
      score: number;
      feedback: string;
    };
  }>;
  agents: Array<{
    agentId: string;
    agentName: string;
    agentAvatar?: string;
    role: string;
    assignedSubtasks: string[];
  }>;
  messages: Array<{
    id: string;
    from: string;
    fromName: string;
    content: string;
    type: string;
    timestamp: number;
  }>;
  metadata: {
    priority: string;
    tags?: string[];
  };
}

export default function TaskDetailClient() {
  const params = useParams();
  const taskId = params.taskId as string;

  const [task, setTask] = useState<CoordinatorTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'agents' | 'messages'>('board');

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/v1/coordinator/tasks/${taskId}`);
      const data = await res.json();
      setTask(data);
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Task not found</p>
        <Link href="/coordinator" style={{ color: '#3b82f6' }}>
          ← Back to tasks
        </Link>
      </div>
    );
  }

  // Group subtasks by status for Kanban
  const kanbanColumns = [
    { id: 'pending', title: 'To Do', status: 'pending' },
    { id: 'in_progress', title: 'In Progress', status: 'assigned' },
    { id: 'submitted', title: 'Review', status: 'submitted' },
    { id: 'done', title: 'Done', status: 'approved' },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/coordinator" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
          ← Back to tasks
        </Link>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '16px 0 8px 0' }}>
          {task.title}
        </h1>
        <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
          {task.description}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '24px', padding: '16px 24px', background: '#f9f9fb', borderRadius: '12px', marginBottom: '24px' }}>
        <div><span style={{ color: '#666' }}>Budget: </span><strong>{parseInt(task.budget.spent) / 1e6} / {parseInt(task.budget.total) / 1e6} {task.budget.token}</strong></div>
        <div><span style={{ color: '#666' }}>Agents: </span><strong>{task.agents.length}</strong></div>
        <div><span style={{ color: '#666' }}>Subtasks: </span><strong>{task.subtasks.filter((s) => s.status === 'approved').length} / {task.subtasks.length}</strong></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e5e5' }}>
        {(['board', 'agents', 'messages'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '12px 24px', border: 'none', background: 'transparent', borderBottom: activeTab === tab ? '2px solid #16161a' : 'none', fontWeight: activeTab === tab ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Board Tab */}
      {activeTab === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {kanbanColumns.map((column) => (
            <div key={column.id}>
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{column.title}</h3>
              {task.subtasks.filter((s) => s.status === column.status).map((subtask) => (
                <div key={subtask.id} style={{ padding: '16px', background: '#fff', borderRadius: '10px', border: '1px solid #e5e5e5', marginTop: '8px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{subtask.title}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div>
          {task.agents.map((agent) => (
            <div key={agent.agentId} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e5e5', marginBottom: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f3f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                {agent.agentAvatar || '🤖'}
              </div>
              <div>
                <h4 style={{ margin: 0 }}>{agent.agentName}</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Role: {agent.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div>
          {task.messages.map((message) => (
            <div key={message.id} style={{ padding: '16px', background: message.type === 'system' ? '#f9f9fb' : '#fff', borderRadius: '10px', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600 }}>{message.fromName}</span>
              <p style={{ margin: '8px 0 0 0' }}>{message.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
