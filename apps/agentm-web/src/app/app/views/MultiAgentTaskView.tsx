'use client';

import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../../lib/connection/ConnectionContext';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
};

type TaskStatus = 'drafting' | 'decomposing' | 'bidding' | 'executing' | 'aggregating' | 'completed' | 'failed';
type SubtaskStatus = 'pending' | 'bidding' | 'assigned' | 'executing' | 'delivered' | 'verified' | 'failed';

interface BidSummary {
    bidder: string;
    displayName: string;
    quoteAmount: string;
    etaSeconds: number;
    reputation: number;
    score: number;
}

interface SubtaskSpec {
    subtaskId: number;
    title: string;
    requirement: string;
    budget: string;
    priority: number;
    dependencies: number[];
    status: SubtaskStatus;
    assignedAgent?: string;
    bids: BidSummary[];
    delivery?: {
        deliveryHash: string;
        resultRef: string;
        deliveredAt: number;
        verificationStatus: 'pending' | 'approved' | 'rejected';
    };
}

interface CoordinatedTask {
    id: string;
    parentTaskId: string;
    title: string;
    description: string;
    subtasks: SubtaskSpec[];
    status: TaskStatus;
    budget: string;
    createdAt: number;
    completedAt?: number;
    aggregatedResult?: {
        finalOutput: string;
        totalCost: string;
        qualityScore: number;
    };
}

const statusColors: Record<TaskStatus | SubtaskStatus, string> = {
    drafting: colors.warning,
    decomposing: colors.warning,
    bidding: colors.lavender,
    executing: colors.lime,
    aggregating: colors.lavender,
    completed: colors.success,
    failed: colors.error,
    pending: '#9CA3AF',
    assigned: colors.lime,
    delivered: colors.lavender,
    verified: colors.success,
};

interface CreateTaskFormProps {
    onSubmit: (data: { title: string; description: string; budget: string; strategy: string }) => void;
    loading: boolean;
}

function CreateTaskForm({ onSubmit, loading }: CreateTaskFormProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [strategy, setStrategy] = useState<'auto' | 'manual' | 'llm'>('auto');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim() || !budget) return;
        onSubmit({ title, description, budget, strategy });
    };

    return (
        <form onSubmit={handleSubmit} style={{
            background: colors.surface,
            borderRadius: '24px',
            padding: '24px',
            border: `1.5px solid ${colors.ink}`,
        }}>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
                Create Multi-Agent Task
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Title</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Task title..."
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: `1.5px solid ${colors.ink}`,
                            fontSize: '14px',
                        }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the complex task. Use multiple sentences to help decomposition..."
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: `1.5px solid ${colors.ink}`,
                            fontSize: '14px',
                            resize: 'vertical',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Budget (SOL)</label>
                        <input
                            type="number"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            placeholder="0.1"
                            step="0.001"
                            min="0"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: `1.5px solid ${colors.ink}`,
                                fontSize: '14px',
                            }}
                        />
                    </div>

                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Decomposition Strategy</label>
                        <select
                            value={strategy}
                            onChange={(e) => setStrategy(e.target.value as 'auto' | 'manual' | 'llm')}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: `1.5px solid ${colors.ink}`,
                                fontSize: '14px',
                                background: colors.surface,
                            }}
                        >
                            <option value="auto">Auto (Rule-based)</option>
                            <option value="llm">LLM-Powered</option>
                            <option value="manual">Manual</option>
                        </select>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !title.trim() || !description.trim() || !budget}
                    style={{
                        padding: '14px 24px',
                        background: colors.ink,
                        color: colors.surface,
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                    }}
                >
                    {loading ? 'Creating...' : 'Create & Decompose Task'}
                </button>
            </div>
        </form>
    );
}

interface SubtaskCardProps {
    subtask: SubtaskSpec;
    onAssign: (subtaskId: number, bidder: string) => void;
    onVerify: (subtaskId: number, approved: boolean) => void;
}

function SubtaskCard({ subtask, onAssign, onVerify }: SubtaskCardProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{
            background: colors.surface,
            borderRadius: '16px',
            padding: '16px',
            border: `1.5px solid ${colors.ink}`,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: colors.lavender,
                            border: `1.5px solid ${colors.ink}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                        }}>
                            {subtask.subtaskId}
                        </span>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{subtask.title}</h4>
                    </div>
                    <p style={{ fontSize: '12px', opacity: 0.6, margin: '6px 0 0 32px' }}>
                        {subtask.requirement.slice(0, 100)}...
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: statusColors[subtask.status] + '20',
                        color: statusColors[subtask.status],
                        border: `1px solid ${statusColors[subtask.status]}`,
                        fontWeight: 600,
                    }}>
                        {subtask.status}
                    </span>
                    <span style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: colors.bg,
                        border: `1px solid ${colors.ink}`,
                    }}>
                        {(Number(subtask.budget) / 1e9).toFixed(4)} SOL
                    </span>
                </div>
            </div>

            {subtask.dependencies.length > 0 && (
                <div style={{ marginTop: '8px', marginLeft: '32px' }}>
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>
                        Depends on: {subtask.dependencies.map(d => `#${d}`).join(', ')}
                    </span>
                </div>
            )}

            {subtask.bids.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.ink,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                    >
                        {expanded ? '▼' : '▶'} {subtask.bids.length} Bids
                    </button>

                    {expanded && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {subtask.bids.map((bid, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    background: colors.bg,
                                    borderRadius: '10px',
                                    border: `1px solid ${colors.ink}`,
                                }}>
                                    <div>
                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{bid.displayName}</span>
                                        <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '8px' }}>
                                            Rep: {bid.reputation} | Score: {bid.score.toFixed(0)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '12px' }}>
                                            {(Number(bid.quoteAmount) / 1e9).toFixed(4)} SOL
                                        </span>
                                        <span style={{ fontSize: '11px', opacity: 0.6 }}>
                                            ~{Math.round(bid.etaSeconds / 60)}min
                                        </span>
                                        {subtask.status === 'bidding' && (
                                            <button
                                                onClick={() => onAssign(subtask.subtaskId, bid.bidder)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: colors.lime,
                                                    border: `1px solid ${colors.ink}`,
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Assign
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {subtask.delivery && subtask.delivery.verificationStatus === 'pending' && (
                <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: colors.lavender + '30',
                    borderRadius: '10px',
                    border: `1px solid ${colors.lavender}`,
                }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Delivery Pending Verification</p>
                    <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '8px' }}>
                        Result: {subtask.delivery.resultRef}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => onVerify(subtask.subtaskId, true)}
                            style={{
                                padding: '6px 16px',
                                background: colors.success,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Approve
                        </button>
                        <button
                            onClick={() => onVerify(subtask.subtaskId, false)}
                            style={{
                                padding: '6px 16px',
                                background: colors.error,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Reject
                        </button>
                    </div>
                </div>
            )}

            {subtask.assignedAgent && (
                <div style={{ marginTop: '8px', marginLeft: '32px' }}>
                    <span style={{ fontSize: '11px', color: colors.success }}>
                        Assigned to: {subtask.assignedAgent.slice(0, 8)}...
                    </span>
                </div>
            )}
        </div>
    );
}

interface TaskDetailProps {
    task: CoordinatedTask;
    onAssign: (taskId: string, subtaskId: number, bidder: string) => void;
    onVerify: (taskId: string, subtaskId: number, approved: boolean) => void;
    onBroadcast: (taskId: string) => void;
    onAggregate: (taskId: string) => void;
}

function TaskDetail({ task, onAssign, onVerify, onBroadcast, onAggregate }: TaskDetailProps) {
    const completedCount = task.subtasks.filter(s => s.status === 'verified').length;
    const progress = task.subtasks.length > 0 ? (completedCount / task.subtasks.length) * 100 : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
                background: colors.lavender,
                borderRadius: '24px',
                padding: '24px',
                border: `1.5px solid ${colors.ink}`,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <span style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: statusColors[task.status] + '20',
                            color: statusColors[task.status],
                            border: `1px solid ${statusColors[task.status]}`,
                            fontWeight: 600,
                        }}>
                            {task.status.toUpperCase()}
                        </span>
                        <h2 style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '24px',
                            fontWeight: 700,
                            margin: '12px 0 8px 0',
                        }}>
                            {task.title}
                        </h2>
                        <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>
                            {task.description.slice(0, 200)}...
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>Total Budget</p>
                        <p style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '24px',
                            fontWeight: 700,
                            margin: '4px 0',
                        }}>
                            {(Number(task.budget) / 1e9).toFixed(4)} SOL
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Progress</span>
                        <span style={{ fontSize: '11px' }}>{completedCount}/{task.subtasks.length} subtasks</span>
                    </div>
                    <div style={{
                        height: '8px',
                        background: colors.surface,
                        borderRadius: '4px',
                        border: `1px solid ${colors.ink}`,
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: colors.success,
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    {task.status === 'bidding' && (
                        <button
                            onClick={() => onBroadcast(task.id)}
                            style={{
                                padding: '10px 20px',
                                background: colors.ink,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Broadcast to Network
                        </button>
                    )}
                    {task.status === 'aggregating' && (
                        <button
                            onClick={() => onAggregate(task.id)}
                            style={{
                                padding: '10px 20px',
                                background: colors.success,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Aggregate Results
                        </button>
                    )}
                </div>
            </div>

            <div style={{
                background: colors.surface,
                borderRadius: '24px',
                padding: '20px',
                border: `1.5px solid ${colors.ink}`,
            }}>
                <h3 style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    marginBottom: '16px',
                    borderBottom: `1.5px solid ${colors.ink}`,
                    paddingBottom: '8px',
                }}>
                    Subtasks ({task.subtasks.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {task.subtasks.map((subtask) => (
                        <SubtaskCard
                            key={subtask.subtaskId}
                            subtask={subtask}
                            onAssign={(sid, bidder) => onAssign(task.id, sid, bidder)}
                            onVerify={(sid, approved) => onVerify(task.id, sid, approved)}
                        />
                    ))}
                </div>
            </div>

            {task.aggregatedResult && (
                <div style={{
                    background: colors.success + '15',
                    borderRadius: '24px',
                    padding: '24px',
                    border: `1.5px solid ${colors.success}`,
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: colors.success }}>
                        Aggregated Result
                    </h3>
                    <div style={{
                        background: colors.surface,
                        borderRadius: '12px',
                        padding: '16px',
                        border: `1px solid ${colors.ink}`,
                    }}>
                        <pre style={{
                            fontSize: '13px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            margin: 0,
                        }}>
                            {task.aggregatedResult.finalOutput}
                        </pre>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '24px' }}>
                        <span style={{ fontSize: '12px' }}>
                            Total Cost: <strong>{(Number(task.aggregatedResult.totalCost) / 1e9).toFixed(4)} SOL</strong>
                        </span>
                        <span style={{ fontSize: '12px' }}>
                            Quality Score: <strong>{task.aggregatedResult.qualityScore.toFixed(1)}</strong>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function MultiAgentTaskView({ address }: { address: string | null }) {
    const [tasks, setTasks] = useState<CoordinatedTask[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const { fetchApi, isConnected } = useConnection();

    const selectedTask = tasks.find(t => t.id === selectedTaskId);

    const loadTasks = useCallback(async () => {
        if (!isConnected || !address) return;
        setLoading(true);
        try {
            const result = await fetchApi<{ tasks: CoordinatedTask[] }>(
                `/api/v1/coordinator/tasks?requester=${address}`
            );
            if (result?.tasks) {
                setTasks(result.tasks);
            }
        } catch (err) {
            console.warn('Failed to load tasks:', err);
        } finally {
            setLoading(false);
        }
    }, [isConnected, address, fetchApi]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const handleCreateTask = async (data: { title: string; description: string; budget: string; strategy: string }) => {
        if (!address) return;
        setCreating(true);
        try {
            const result = await fetchApi<{ task: CoordinatedTask }>('/api/v1/coordinator/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    requester: address,
                    title: data.title,
                    description: data.description,
                    budget: (parseFloat(data.budget) * 1e9).toString(),
                    decompositionStrategy: data.strategy,
                }),
            });
            if (result?.task) {
                setTasks(prev => [result.task, ...prev]);
                setSelectedTaskId(result.task.id);
            }
        } catch (err) {
            console.error('Failed to create task:', err);
        } finally {
            setCreating(false);
        }
    };

    const handleBroadcast = async (taskId: string) => {
        try {
            await fetchApi(`/api/v1/coordinator/tasks/${taskId}/broadcast`, { method: 'POST' });
            loadTasks();
        } catch (err) {
            console.error('Failed to broadcast:', err);
        }
    };

    const handleAssign = async (taskId: string, subtaskId: number, bidder: string) => {
        try {
            await fetchApi(`/api/v1/coordinator/tasks/${taskId}/subtasks/${subtaskId}/assign`, {
                method: 'POST',
                body: JSON.stringify({ bidder }),
            });
            loadTasks();
        } catch (err) {
            console.error('Failed to assign:', err);
        }
    };

    const handleVerify = async (taskId: string, subtaskId: number, approved: boolean) => {
        try {
            await fetchApi(`/api/v1/coordinator/tasks/${taskId}/subtasks/${subtaskId}/verify`, {
                method: 'POST',
                body: JSON.stringify({ approved }),
            });
            loadTasks();
        } catch (err) {
            console.error('Failed to verify:', err);
        }
    };

    const handleAggregate = async (taskId: string) => {
        try {
            await fetchApi(`/api/v1/coordinator/tasks/${taskId}/aggregate`, {
                method: 'POST',
                body: JSON.stringify({ strategy: 'merge' }),
            });
            loadTasks();
        } catch (err) {
            console.error('Failed to aggregate:', err);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100%', background: colors.bg, padding: '24px', gap: '24px' }}>
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                    background: colors.lime,
                    borderRadius: '24px',
                    padding: '24px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase' }}>
                        Multi-Agent Coordination
                    </span>
                    <h2 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '28px',
                        fontWeight: 700,
                        margin: '8px 0 0 0',
                    }}>
                        Tasks
                    </h2>
                    <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '8px' }}>
                        Create complex tasks, decompose into subtasks, and coordinate multiple agents.
                    </p>
                </div>

                <div style={{
                    background: colors.surface,
                    borderRadius: '24px',
                    padding: '16px',
                    border: `1.5px solid ${colors.ink}`,
                    flex: 1,
                    overflowY: 'auto',
                }}>
                    <h3 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: `1.5px solid ${colors.ink}`,
                    }}>
                        Your Tasks ({tasks.length})
                    </h3>

                    {loading && <p style={{ fontSize: '13px', opacity: 0.5 }}>Loading...</p>}

                    {!loading && tasks.length === 0 && (
                        <p style={{ fontSize: '13px', opacity: 0.5 }}>No tasks yet. Create one!</p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tasks.map((task) => (
                            <button
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: selectedTaskId === task.id ? colors.lavender : colors.bg,
                                    border: selectedTaskId === task.id
                                        ? `1.5px solid ${colors.ink}`
                                        : '1.5px solid transparent',
                                    borderRadius: '12px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{task.title}</span>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        background: statusColors[task.status] + '20',
                                        color: statusColors[task.status],
                                    }}>
                                        {task.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
                                    {task.subtasks.length} subtasks
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {!selectedTask ? (
                    <CreateTaskForm onSubmit={handleCreateTask} loading={creating} />
                ) : (
                    <TaskDetail
                        task={selectedTask}
                        onAssign={handleAssign}
                        onVerify={handleVerify}
                        onBroadcast={handleBroadcast}
                        onAggregate={handleAggregate}
                    />
                )}
            </div>
        </div>
    );
}
