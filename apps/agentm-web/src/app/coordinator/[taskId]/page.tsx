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

/**
 * Task Detail Page - GRA-230
 * 
 * Shows task details with Kanban board and agent coordination.
 */
export default function TaskDetailPage() {
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
        <Link href="/app/coordinator" style={{ color: '#3b82f6' }}>
          ← Back to tasks
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#6b7280',
      assigned: '#3b82f6',
      in_progress: '#f59e0b',
      submitted: '#8b5cf6',
      approved: '#22c55e',
      rejected: '#dc2626',
    };
    return colors[status] || '#6b7280';
  };

  // Group subtasks by status for Kanban
  const kanbanColumns = [
    { id: 'pending', title: 'To Do', status: 'pending' },
    { id: 'in_progress', title: 'In Progress', status: 'assigned' },
    { id: 'submitted', title: 'Review', status: 'submitted' },
    { id: 'done', title: 'Done', status: 'approved' },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/app/coordinator"
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '16px',
          }}
        >
          ← Back to tasks
        </Link>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0' }}>
              {task.title}
            </h1>
            <p style={{ fontSize: '16px', color: '#666', margin: 0, maxWidth: '800px' }}>
              {task.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={{
                padding: '10px 20px',
                background: '#f3f3f8',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              style={{
                padding: '10px 20px',
                background: '#16161a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Invite Agents
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          padding: '16px 24px',
          background: '#f9f9fb',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '14px',
        }}
      >
        <div>
          <span style={{ color: '#666' }}>Budget: </span>
          <strong>
            {parseInt(task.budget.spent) / 1e6} / {parseInt(task.budget.total) / 1e6}{' '}
            {task.budget.token}
          </strong>
        </div>
        <div>
          <span style={{ color: '#666' }}>Agents: </span>
          <strong>{task.agents.length}</strong>
        </div>
        <div>
          <span style={{ color: '#666' }}>Subtasks: </span>
          <strong>
            {task.subtasks.filter((s) => s.status === 'approved').length} / {task.subtasks.length}
          </strong>
        </div>
        <div>
          <span style={{ color: '#666' }}>Deadline: </span>
          <strong>{new Date(task.timeline.deadline).toLocaleDateString()}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e5e5' }}>
        {(['board', 'agents', 'messages'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === tab ? '2px solid #16161a' : 'none',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#16161a' : '#666',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {kanbanColumns.map((column) => (
            <div key={column.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{column.title}</h3>
                <span
                  style={{
                    padding: '2px 8px',
                    background: '#f3f3f8',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                >
                  {task.subtasks.filter((s) => s.status === column.status).length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {task.subtasks
                  .filter((s) => s.status === column.status)
                  .map((subtask) => (
                    <div
                      key={subtask.id}
                      style={{
                        padding: '16px',
                        background: '#fff',
                        borderRadius: '10px',
                        border: '1px solid #e5e5e5',
                      }}
                    >
                      <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 8px 0' }}>
                        {subtask.title}
                      </p>

                      {subtask.assignee && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: '#666',
                            marginBottom: '8px',
                          }}
                        >
                          <span>👤</span>
                          {task.agents.find((a) => a.agentId === subtask.assignee)?.agentName ||
                            'Unknown'}
                        </div>
                      )}

                      {subtask.evaluation && (
                        <div
                          style={{
                            padding: '4px 8px',
                            background:
                              subtask.evaluation.score >= 70 ? '#dcfce7' : '#fee2e2',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: subtask.evaluation.score >= 70 ? '#166534' : '#991b1b',
                          }}
                        >
                          Score: {subtask.evaluation.score}/100
                        </div>
                      )}

                      {subtask.deliverables.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          📎 {subtask.deliverables.length} deliverable(s)
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {task.agents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>No agents assigned yet</p>
              <button
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  background: '#16161a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Find Agents
              </button>
            </div>
          ) : (
            task.agents.map((agent) => (
              <div
                key={agent.agentId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e5e5e5',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#f3f3f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                  }}
                >
                  {agent.agentAvatar || '🤖'}
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0' }}>{agent.agentName}</h4>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Role: <strong>{agent.role}</strong> • {agent.assignedSubtasks.length} subtasks
                  </p>
                </div>

                <div
                  style={{
                    padding: '6px 12px',
                    background: '#f3f3f8',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                >
                  {agent.agentId.slice(0, 8)}...
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {task.messages.map((message) => (
            <div
              key={message.id}
              style={{
                padding: '16px',
                background: message.type === 'system' ? '#f9f9fb' : '#fff',
                borderRadius: '10px',
                border: message.type === 'system' ? 'none' : '1px solid #e5e5e5',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontWeight: 600 }}>{message.fromName}</span>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, color: message.type === 'system' ? '#666' : '#16161a' }}>
                {message.content}
              </p>
            </div>
          ))}

          {/* Message Input */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <input
              type="text"
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #e5e5e5',
                fontSize: '14px',
              }}
            />
            <button
              style={{
                padding: '12px 24px',
                background: '#16161a',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
