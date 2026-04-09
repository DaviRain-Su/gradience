'use client';

import { useState } from 'react';
import { useERC8004, type ERC8004Feedback } from '@/hooks/useERC8004';

interface ERC8004FeedbackFormProps {
    agentId: string;
    taskId?: string;
    onSubmitted?: (txHash: string) => void;
    onCancel?: () => void;
}

/**
 * ERC8004FeedbackForm - GRA-227c
 *
 * Form for submitting reputation feedback to ERC-8004.
 * Used after task completion to rate agent performance.
 */
export function ERC8004FeedbackForm({ agentId, taskId, onSubmitted, onCancel }: ERC8004FeedbackFormProps) {
    const { giveFeedback, loading, error } = useERC8004();
    const [score, setScore] = useState<number>(50);
    const [comment, setComment] = useState('');
    const [tag1, setTag1] = useState('');
    const [tag2, setTag2] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [txHash, setTxHash] = useState('');

    const handleSubmit = async () => {
        try {
            // Convert 0-100 score to ERC-8004 format (can be negative for bad ratings)
            const value = score - 50; // -50 to +50 range

            const feedback: ERC8004Feedback = {
                agentId,
                value,
                valueDecimals: 2,
                tags: [tag1 || 'general', tag2 || 'task-completion'],
                endpoint: typeof window !== 'undefined' ? window.location.origin : '',
                feedbackURI: `data:application/json;base64,${btoa(
                    JSON.stringify({
                        comment,
                        taskId,
                        timestamp: Date.now(),
                    }),
                )}`,
                feedbackHash: '0x' + '0'.repeat(64), // In real implementation, hash the content
            };

            const hash = await giveFeedback(feedback);
            setTxHash(hash);
            setSubmitted(true);
            onSubmitted?.(hash);
        } catch (err) {
            console.error('Feedback submission failed:', err);
        }
    };

    const getScoreLabel = (s: number) => {
        if (s >= 80) return { label: 'Excellent', color: '#22c55e' };
        if (s >= 60) return { label: 'Good', color: '#3b82f6' };
        if (s >= 40) return { label: 'Average', color: '#f59e0b' };
        if (s >= 20) return { label: 'Poor', color: '#f97316' };
        return { label: 'Very Poor', color: '#dc2626' };
    };

    const scoreInfo = getScoreLabel(score);

    if (submitted) {
        return (
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            fontSize: '30px',
                        }}
                    >
                        ✓
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161a', margin: '0 0 8px 0' }}>
                        Feedback Submitted!
                    </h3>
                    <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px 0' }}>
                        Your reputation feedback has been recorded on-chain via ERC-8004.
                    </p>
                    <a
                        href={`https://etherscan.io/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            fontSize: '13px',
                            color: '#3b82f6',
                            textDecoration: 'underline',
                        }}
                    >
                        View on Etherscan →
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div style={cardStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161a', margin: '0 0 16px 0' }}>
                Submit Reputation Feedback
            </h3>

            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                Rate this agent's performance. Your feedback will be recorded on the ERC-8004 Reputation Registry and
                contribute to their cross-chain reputation score.
            </p>

            {/* Score Slider */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Rating</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: scoreInfo.color }}>
                        {scoreInfo.label} ({score}/100)
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '4px',
                        background: `linear-gradient(to right, #dc2626 0%, #f59e0b 25%, #3b82f6 50%, #22c55e 100%)`,
                        appearance: 'none' as any,
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#666' }}>Poor</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>Excellent</span>
                </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>
                    Tags (optional)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={tag1}
                        onChange={(e) => setTag1(e.target.value)}
                        placeholder="e.g., timely"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #e5e5e5',
                            fontSize: '13px',
                        }}
                    />
                    <input
                        type="text"
                        value={tag2}
                        onChange={(e) => setTag2(e.target.value)}
                        placeholder="e.g., quality"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #e5e5e5',
                            fontSize: '13px',
                        }}
                    />
                </div>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>
                    Comment (optional)
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe your experience with this agent..."
                    rows={3}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #e5e5e5',
                        fontSize: '13px',
                        resize: 'vertical',
                    }}
                />
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        background: '#fef2f2',
                        border: '1px solid #dc2626',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '16px',
                    }}
                >
                    <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#f3f3f8',
                            color: '#16161a',
                            border: '1.5px solid #16161a',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: loading ? '#f3f3f8' : '#16161a',
                        color: loading ? '#666' : '#fff',
                        border: '1.5px solid #16161a',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                >
                    {loading ? 'Submitting...' : 'Submit Feedback'}
                </button>
            </div>
        </div>
    );
}

const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    border: '1.5px solid #16161a',
};
