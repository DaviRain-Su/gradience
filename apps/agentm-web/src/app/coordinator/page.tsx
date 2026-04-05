'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CoordinatorTask {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'pending_agents' | 'in_progress' | 'reviewing' | 'completed' | 'cancelled';
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
    status: string;
    assignee?: string;
  }>;
  agents: Array<{
    agentId: string;
    agentName: string;
    role: string;
  }>;
  metadata: {
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
  };
}

/**
 * Multi-Agent Task Coordinator - GRA-230
 * 
 * Main page for managing multi-agent tasks.
 */
export default function CoordinatorPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<CoordinatorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/v1/coordinator/tasks?limit=20');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'in_progress':
        return '#3b82f6';
      case 'reviewing':
        return '#f59e0b';
      case 'pending_agents':
        return '#6b7280';
      default:
        return '#9ca3af';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#ca8a04';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading coordinator tasks...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 8px 0' }}>
            🤖 Multi-Agent Task Coordinator
          </h1>
          <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
            Create and manage complex tasks with multiple AI agents
          </p>
        </div>
        <Link
          href="/app/coordinator/create"
          style={{
            padding: '12px 24px',
            background: '#16161a',
            color: '#fff',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          + New Task
        </Link>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <StatCard
          title="Active Tasks"
          value={tasks.filter((t) => t.status === 'in_progress').length}
          color="#3b82f6"
        />
        <StatCard
          title="Pending Agents"
          value={tasks.filter((t) => t.status === 'pending_agents').length}
          color="#6b7280"
        />
        <StatCard
          title="In Review"
          value={tasks.filter((t) => t.status === 'reviewing').length}
          color="#f59e0b"
        />
        <StatCard
          title="Completed"
          value={tasks.filter((t) => t.status === 'completed').length}
          color="#22c55e"
        />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'pending_agents', 'in_progress', 'reviewing', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                background: filter === f ? '#16161a' : '#f3f3f8',
                color: filter === f ? '#fff' : '#666',
                fontSize: '14px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredTasks.length === 0 ? (
          <div
            style={{
              padding: '60px 40px',
              textAlign: 'center',
              background: '#f9f9fb',
              borderRadius: '16px',
            }}
          >
            <p style={{ fontSize: '18px', color: '#666', margin: '0 0 16px 0' }}>
              No tasks found
            </p>
            <Link
              href="/app/coordinator/create"
              style={{
                color: '#3b82f6',
                textDecoration: 'underline',
              }}
            >
              Create your first multi-agent task
            </Link>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => router.push(`/app/coordinator/${task.id}`)}
              style={{
                padding: '24px',
                background: '#fff',
                borderRadius: '16px',
                border: '1.5px solid #e5e5e5',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>
                    {task.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {task.description}
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: getPriorityColor(task.metadata.priority) + '20',
                    color: getPriorityColor(task.metadata.priority),
                  }}
                >
                  {task.metadata.priority}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getStatusColor(task.status),
                    }}
                  />
                  {task.status.replace('_', ' ')}
                </span>
                <span>•</span>
                <span>{task.subtasks.length} subtasks</span>
                <span>•</span>
                <span>{task.agents.length} agents</span>
                <span>•</span>
                <span>
                  {parseInt(task.budget.total) / 1e6} {task.budget.token}
                </span>
              </div>

              {task.metadata.tags && task.metadata.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {task.metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '4px 10px',
                        background: '#f3f3f8',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#666',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '12px',
        border: '1.5px solid #e5e5e5',
      }}
    >
      <p style={{ fontSize: '14px', color: '#666', margin: '0 0 8px 0' }}>{title}</p>
      <p style={{ fontSize: '32px', fontWeight: 700, margin: 0, color }}>{value}</p>
    </div>
  );
}
