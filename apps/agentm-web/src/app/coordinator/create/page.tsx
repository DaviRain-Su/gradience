'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SubtaskInput {
  title: string;
  description: string;
  budget: string;
}

/**
 * Create Task Page - GRA-230
 * 
 * Form for creating new multi-agent tasks.
 */
export default function CreateTaskPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [token, setToken] = useState('USDC');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [tags, setTags] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([
    { title: '', description: '', budget: '' },
  ]);

  const addSubtask = () => {
    setSubtasks([...subtasks, { title: '', description: '', budget: '' }]);
  };

  const updateSubtask = (index: number, field: keyof SubtaskInput, value: string) => {
    const updated = [...subtasks];
    updated[index][field] = value;
    setSubtasks(updated);
  };

  const removeSubtask = (index: number) => {
    if (subtasks.length > 1) {
      setSubtasks(subtasks.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/v1/coordinator/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          budget: {
            total: (parseFloat(budget) * 1e6).toString(),
            token,
          },
          deadline: new Date(deadline).getTime(),
          subtasks: subtasks
            .filter((s) => s.title.trim())
            .map((s) => ({
              title: s.title,
              description: s.description,
              budget: (parseFloat(s.budget || '0') * 1e6).toString(),
            })),
          metadata: {
            priority,
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
            visibility: 'public',
          },
        }),
      });

      if (response.ok) {
        const task = await response.json();
        router.push(`/app/coordinator/${task.id}`);
      } else {
        alert('Failed to create task');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const totalSubtaskBudget = subtasks.reduce(
    (sum, s) => sum + (parseFloat(s.budget) || 0),
    0
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
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
        <h1 style={{ fontSize: '32px', fontWeight: 700, margin: 0 }}>
          Create Multi-Agent Task
        </h1>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: '4px',
              background: s <= step ? '#16161a' : '#e5e5e5',
              borderRadius: '2px',
            }}
          />
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Build a DeFi Dashboard"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1.5px solid #e5e5e5',
                fontSize: '16px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to achieve..."
              rows={5}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1.5px solid #e5e5e5',
                fontSize: '16px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                Total Budget *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="1000"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1.5px solid #e5e5e5',
                    fontSize: '16px',
                  }}
                />
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1.5px solid #e5e5e5',
                    fontSize: '16px',
                  }}
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="gUSD">gUSD</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                Deadline *
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid #e5e5e5',
                  fontSize: '16px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid #e5e5e5',
                  fontSize: '16px',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="defi, frontend, rust"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid #e5e5e5',
                  fontSize: '16px',
                }}
              />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!title || !description || !budget || !deadline}
            style={{
              marginTop: '16px',
              padding: '14px 28px',
              background: title && description && budget && deadline ? '#16161a' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: title && description && budget && deadline ? 'pointer' : 'not-allowed',
            }}
          >
            Next: Define Subtasks
          </button>
        </div>
      )}

      {/* Step 2: Subtasks */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px 0' }}>
              Define Subtasks
            </h2>
            <p style={{ color: '#666', margin: 0 }}>
              Break down your task into smaller pieces for different agents
            </p>
          </div>

          {subtasks.map((subtask, index) => (
            <div
              key={index}
              style={{
                padding: '20px',
                background: '#f9f9fb',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                  Subtask {index + 1}
                </h3>
                {subtasks.length > 1 && (
                  <button
                    onClick={() => removeSubtask(index)}
                    style={{
                      padding: '6px 12px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  value={subtask.title}
                  onChange={(e) => updateSubtask(index, 'title', e.target.value)}
                  placeholder="Subtask title"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #e5e5e5',
                    fontSize: '14px',
                  }}
                />

                <textarea
                  value={subtask.description}
                  onChange={(e) => updateSubtask(index, 'description', e.target.value)}
                  placeholder="Description"
                  rows={2}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #e5e5e5',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />

                <input
                  type="number"
                  value={subtask.budget}
                  onChange={(e) => updateSubtask(index, 'budget', e.target.value)}
                  placeholder={`Budget (${token})`}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #e5e5e5',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
          ))}

          <button
            onClick={addSubtask}
            style={{
              padding: '12px 24px',
              background: '#f3f3f8',
              border: '1.5px dashed #ccc',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            + Add Another Subtask
          </button>

          <div
            style={{
              padding: '16px',
              background: totalSubtaskBudget > parseFloat(budget) ? '#fee2e2' : '#dcfce7',
              borderRadius: '10px',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px' }}>
              Budget: {totalSubtaskBudget.toFixed(2)} / {budget} {token}
              {totalSubtaskBudget > parseFloat(budget) && (
                <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                  (Over budget!)
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setStep(1)}
              style={{
                padding: '14px 28px',
                background: '#f3f3f8',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={totalSubtaskBudget > parseFloat(budget)}
              style={{
                flex: 1,
                padding: '14px 28px',
                background: totalSubtaskBudget <= parseFloat(budget) ? '#16161a' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: totalSubtaskBudget <= parseFloat(budget) ? 'pointer' : 'not-allowed',
              }}
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px 0' }}>
              Review & Create
            </h2>
            <p style={{ color: '#666', margin: 0 }}>
              Review your task before creating it
            </p>
          </div>

          <div
            style={{
              padding: '24px',
              background: '#f9f9fb',
              borderRadius: '12px',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>{title}</h3>
            <p style={{ color: '#666', margin: '0 0 16px 0' }}>{description}</p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '14px',
              }}
            >
              <div>
                <span style={{ color: '#666' }}>Budget: </span>
                <strong>
                  {budget} {token}
                </strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>Deadline: </span>
                <strong>{deadline ? new Date(deadline).toLocaleString() : '-'}</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>Priority: </span>
                <strong>{priority}</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>Subtasks: </span>
                <strong>{subtasks.filter((s) => s.title).length}</strong>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 12px 0' }}>Subtasks</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subtasks
                .filter((s) => s.title)
                .map((subtask, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 16px',
                      background: '#f9f9fb',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <strong>{subtask.title}</strong> - {subtask.budget} {token}
                  </div>
                ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              style={{
                padding: '14px 28px',
                background: '#f3f3f8',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px 28px',
                background: '#16161a',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
