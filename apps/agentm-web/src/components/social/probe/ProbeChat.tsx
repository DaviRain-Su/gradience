'use client';
/**
 * Social Probe Chat Component
 *
 * Multi-turn conversation UI for compatibility probing
 */

import { useState, useEffect, useRef } from 'react';
import type { ProbeSession, ProbeMessage } from '@/types/soul';

interface ProbeChatProps {
    session: ProbeSession;
    onSendMessage: (content: string) => Promise<void>;
    onEndProbe: () => void;
    onCancel: () => void;
    isProber: boolean; // true if current user is the prober
}

export function ProbeChat({ session, onSendMessage, onEndProbe, onCancel, isProber }: ProbeChatProps) {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentTurn = Math.floor(session.conversation.length / 2);
    const turnsRemaining = session.config.maxTurns - currentTurn;
    const progress = (currentTurn / session.config.maxTurns) * 100;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [session.conversation]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;

        setSending(true);
        try {
            await onSendMessage(input.trim());
            setInput('');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const getStatusBadge = () => {
        const baseStyle: React.CSSProperties = {
            padding: '4px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            border: '1.5px solid #16161A',
        };

        switch (session.status) {
            case 'pending':
                return <span style={{ ...baseStyle, background: '#FEF3C7', color: '#92400E' }}>Pending</span>;
            case 'probing':
                return <span style={{ ...baseStyle, background: '#DBEAFE', color: '#1E40AF' }}>🔍 Probing</span>;
            case 'completed':
                return <span style={{ ...baseStyle, background: '#D1FAE5', color: '#065F46' }}>✓ Completed</span>;
            case 'failed':
                return <span style={{ ...baseStyle, background: '#FEE2E2', color: '#991B1B' }}>✗ Failed</span>;
            case 'cancelled':
                return <span style={{ ...baseStyle, background: '#F3F4F6', color: '#4B5563' }}>Cancelled</span>;
        }
    };

    const canSend = session.status === 'probing' && turnsRemaining > 0 && !sending;

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1.5px solid #16161A',
        background: '#FFFFFF',
    };

    const buttonStyle: React.CSSProperties = {
        padding: '10px 20px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '1.5px solid #16161A',
    };

    const primaryButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: '#16161A',
        color: '#FFFFFF',
    };

    const secondaryButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: '#F3F3F8',
        color: '#16161A',
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: '#FFFFFF',
            }}
        >
            {/* Header */}
            <div style={headerStyle}>
                <div>
                    <h3
                        style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            margin: 0,
                            fontFamily: 'Oswald, sans-serif',
                            color: '#16161A',
                        }}
                    >
                        Social Probe
                        {getStatusBadge()}
                    </h3>
                    <p
                        style={{
                            fontSize: '14px',
                            color: '#16161A',
                            opacity: 0.6,
                            margin: '8px 0 0 0',
                        }}
                    >
                        Turn {currentTurn} / {session.config.maxTurns}
                        <span style={{ margin: '0 8px' }}>•</span>
                        {turnsRemaining} turns remaining
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {session.status === 'probing' && (
                        <button
                            onClick={onEndProbe}
                            style={primaryButtonStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#000000';
                                e.currentTarget.style.transform = 'scale(0.98)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#16161A';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            End & Analyze
                        </button>
                    )}
                    <button
                        onClick={onCancel}
                        style={secondaryButtonStyle}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#E8E8ED';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#F3F3F8';
                        }}
                    >
                        {session.status === 'completed' ? 'Close' : 'Cancel'}
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '4px', background: '#F3F3F8' }}>
                <div
                    style={{
                        height: '100%',
                        background: '#CDFF4D',
                        transition: 'width 0.3s ease',
                        width: `${progress}%`,
                    }}
                />
            </div>

            {/* Messages */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                {session.conversation.length === 0 && (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '48px 0',
                            color: '#16161A',
                            opacity: 0.5,
                        }}
                    >
                        <p style={{ fontSize: '24px', marginBottom: '8px' }}>🔍 Social Probe Session</p>
                        <p style={{ fontSize: '14px' }}>
                            {isProber
                                ? 'Start by asking a question to get to know each other'
                                : 'Waiting for the first question...'}
                        </p>
                    </div>
                )}

                {session.conversation.map((message, i) => (
                    <MessageBubble
                        key={i}
                        message={message}
                        isOwn={isProber ? message.role === 'prober' : message.role === 'target'}
                    />
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {session.status === 'probing' && (
                <div
                    style={{
                        padding: '24px',
                        borderTop: '1.5px solid #16161A',
                        background: '#FFFFFF',
                    }}
                >
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isProber ? 'Ask a question...' : 'Share your thoughts...'}
                            rows={2}
                            disabled={!canSend}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                background: '#F3F3F8',
                                borderRadius: '12px',
                                border: '1.5px solid #16161A',
                                fontSize: '14px',
                                resize: 'none',
                                outline: 'none',
                                opacity: canSend ? 1 : 0.5,
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!canSend || !input.trim()}
                            style={{
                                ...primaryButtonStyle,
                                opacity: !canSend || !input.trim() ? 0.5 : 1,
                                cursor: !canSend || !input.trim() ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                                if (canSend && input.trim()) {
                                    e.currentTarget.style.background = '#000000';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#16161A';
                            }}
                        >
                            Send
                        </button>
                    </div>
                    <p
                        style={{
                            fontSize: '12px',
                            color: '#16161A',
                            opacity: 0.4,
                            margin: '8px 0 0 0',
                        }}
                    >
                        Press Enter to send • Shift+Enter for new line
                    </p>
                </div>
            )}

            {/* Completed State */}
            {session.status === 'completed' && (
                <div
                    style={{
                        padding: '24px',
                        borderTop: '1.5px solid #16161A',
                        background: '#D1FAE5',
                        textAlign: 'center',
                    }}
                >
                    <p
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#065F46',
                            margin: '0 0 8px 0',
                        }}
                    >
                        ✓ Probe Completed
                    </p>
                    <p
                        style={{
                            fontSize: '14px',
                            color: '#065F46',
                            opacity: 0.8,
                            margin: 0,
                        }}
                    >
                        Ready to analyze compatibility. Click "Analyze Match" to generate your report.
                    </p>
                </div>
            )}

            {/* Failed State */}
            {session.status === 'failed' && session.error && (
                <div
                    style={{
                        padding: '24px',
                        borderTop: '1.5px solid #16161A',
                        background: '#FEE2E2',
                        textAlign: 'center',
                    }}
                >
                    <p
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#991B1B',
                            margin: '0 0 8px 0',
                        }}
                    >
                        ✗ Probe Failed
                    </p>
                    <p
                        style={{
                            fontSize: '14px',
                            color: '#991B1B',
                            opacity: 0.8,
                            margin: 0,
                        }}
                    >
                        {session.error}
                    </p>
                </div>
            )}
        </div>
    );
}

// Message Bubble Component
function MessageBubble({ message, isOwn }: { message: ProbeMessage; isOwn: boolean }) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
            }}
        >
            <div
                style={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isOwn ? 'flex-end' : 'flex-start',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                        padding: '0 4px',
                    }}
                >
                    <span
                        style={{
                            fontSize: '12px',
                            color: '#16161A',
                            opacity: 0.5,
                        }}
                    >
                        {message.role === 'prober' ? '🔍 Prober' : '🎯 Target'}
                    </span>
                    <span
                        style={{
                            fontSize: '12px',
                            color: '#16161A',
                            opacity: 0.3,
                        }}
                    >
                        Turn {message.turn + 1}
                    </span>
                </div>
                <div
                    style={{
                        padding: '12px 16px',
                        borderRadius: '16px',
                        background: isOwn ? '#16161A' : '#F3F3F8',
                        color: isOwn ? '#FFFFFF' : '#16161A',
                        border: isOwn ? 'none' : '1.5px solid #16161A',
                        borderBottomRightRadius: isOwn ? '4px' : '16px',
                        borderBottomLeftRadius: isOwn ? '16px' : '4px',
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            fontSize: '14px',
                            lineHeight: 1.5,
                        }}
                    >
                        {message.content}
                    </p>
                </div>
                <span
                    style={{
                        fontSize: '12px',
                        color: '#16161A',
                        opacity: 0.3,
                        marginTop: '4px',
                        padding: '0 4px',
                    }}
                >
                    {new Date(message.timestamp).toLocaleTimeString()}
                </span>
            </div>
        </div>
    );
}

// Probe Invitation Card
export function ProbeInvitation({
    senderName,
    depth,
    maxTurns,
    onAccept,
    onReject,
}: {
    senderName: string;
    depth: 'light' | 'deep';
    maxTurns: number;
    onAccept: () => void;
    onReject: () => void;
}) {
    return (
        <div
            style={{
                background: '#FFFFFF',
                borderRadius: '24px',
                padding: '24px',
                border: '1.5px solid #16161A',
                boxShadow: '4px 4px 0 #16161A',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#C6BBFF',
                        border: '1.5px solid #16161A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                    }}
                >
                    🔍
                </div>
                <div style={{ flex: 1 }}>
                    <h4
                        style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            margin: '0 0 4px 0',
                            color: '#16161A',
                            fontFamily: 'Oswald, sans-serif',
                        }}
                    >
                        Social Probe Invitation
                    </h4>
                    <p
                        style={{
                            fontSize: '14px',
                            color: '#16161A',
                            opacity: 0.7,
                            margin: '0 0 16px 0',
                        }}
                    >
                        <span style={{ fontWeight: 600, color: '#16161A' }}>{senderName}</span> wants to start a social
                        probe to assess compatibility.
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            gap: '24px',
                            fontSize: '14px',
                            color: '#16161A',
                            opacity: 0.6,
                            marginBottom: '16px',
                        }}
                    >
                        <div>
                            <span style={{ opacity: 0.5 }}>Depth:</span>{' '}
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{depth}</span>
                        </div>
                        <div>
                            <span style={{ opacity: 0.5 }}>Max Turns:</span>{' '}
                            <span style={{ fontWeight: 600 }}>{maxTurns}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={onAccept}
                            style={{
                                padding: '10px 24px',
                                background: '#16161A',
                                color: '#FFFFFF',
                                border: '1.5px solid #16161A',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#000000';
                                e.currentTarget.style.transform = 'scale(0.98)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#16161A';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            Accept
                        </button>
                        <button
                            onClick={onReject}
                            style={{
                                padding: '10px 24px',
                                background: '#F3F3F8',
                                color: '#16161A',
                                border: '1.5px solid #16161A',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#E8E8ED';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#F3F3F8';
                            }}
                        >
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
