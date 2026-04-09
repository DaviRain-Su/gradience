// @ts-nocheck
/**
 * A2A Async Messaging Component
 *
 * Agent-to-Agent asynchronous communication UI
 * Supports offline messaging, payment requests, and task delegation
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWebEntry } from '../../hooks/use-web-entry.js';
import { VoiceToggleButton } from './voice/VoiceButton';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    coral: '#FF6B6B',
    gold: '#FFD700',
};

export interface AsyncMessage {
    id: string;
    from: string;
    to: string;
    type: 'text' | 'task' | 'payment_request' | 'payment_confirm';
    content: string;
    timestamp: number;
    status: 'pending' | 'delivered' | 'read' | 'failed';
    metadata?: {
        taskId?: string;
        paymentId?: string;
        amount?: string;
        token?: string;
        deadline?: number;
    };
}

export interface AsyncConversation {
    agentId: string;
    agentName: string;
    agentAvatar: string;
    lastMessage: AsyncMessage;
    unreadCount: number;
    online: boolean;
}

export function A2AAsyncMessaging() {
    const [conversations, setConversations] = useState<AsyncConversation[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [messages, setMessages] = useState<AsyncMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [messageType, setMessageType] = useState<AsyncMessage['type']>('text');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskReward, setTaskReward] = useState('');

    const { agents, isConnected } = useWebEntry({
        gatewayUrl: process.env.NEXT_PUBLIC_AGENTM_GATEWAY || 'http://127.0.0.1:7420',
        authToken: 'demo-token',
    });

    // Load conversations on mount
    useEffect(() => {
        // Mock data - would load from local storage or API
        const mockConversations: AsyncConversation[] = [
            {
                agentId: 'agent-1',
                agentName: 'TradingBot_Alpha',
                agentAvatar: 'T',
                lastMessage: {
                    id: 'msg-1',
                    from: 'agent-1',
                    to: 'user',
                    type: 'task',
                    content: 'Task completed: Portfolio rebalancing executed',
                    timestamp: Date.now() - 3600000,
                    status: 'read',
                    metadata: { taskId: 'task-123', amount: '50', token: 'USDC' },
                },
                unreadCount: 0,
                online: true,
            },
            {
                agentId: 'agent-2',
                agentName: 'AuditBot_Pro',
                agentAvatar: 'A',
                lastMessage: {
                    id: 'msg-2',
                    from: 'user',
                    to: 'agent-2',
                    type: 'payment_request',
                    content: 'Payment requested for contract audit service',
                    timestamp: Date.now() - 7200000,
                    status: 'pending',
                    metadata: { paymentId: 'pay-456', amount: '200', token: 'USDC' },
                },
                unreadCount: 1,
                online: false,
            },
        ];
        setConversations(mockConversations);
    }, []);

    // Load messages when agent selected
    useEffect(() => {
        if (!selectedAgentId) return;

        // Mock messages - would load from API
        const mockMessages: AsyncMessage[] = [
            {
                id: '1',
                from: selectedAgentId,
                to: 'user',
                type: 'text',
                content: 'Hello! I can help you with automated trading strategies.',
                timestamp: Date.now() - 86400000,
                status: 'read',
            },
            {
                id: '2',
                from: 'user',
                to: selectedAgentId,
                type: 'task',
                content: 'Please rebalance my portfolio to 60% SOL, 40% USDC',
                timestamp: Date.now() - 3600000,
                status: 'delivered',
                metadata: { taskId: 'task-123', amount: '50', token: 'USDC' },
            },
            {
                id: '3',
                from: selectedAgentId,
                to: 'user',
                type: 'payment_request',
                content: 'Task completed. Please send 50 USDC for the service.',
                timestamp: Date.now() - 1800000,
                status: 'read',
                metadata: { paymentId: 'pay-789', amount: '50', token: 'USDC' },
            },
        ];
        setMessages(mockMessages);
    }, [selectedAgentId]);

    const sendMessage = useCallback(() => {
        if (!newMessage.trim() || !selectedAgentId) return;

        const message: AsyncMessage = {
            id: crypto.randomUUID(),
            from: 'user',
            to: selectedAgentId,
            type: messageType,
            content: newMessage,
            timestamp: Date.now(),
            status: 'pending',
            metadata:
                messageType === 'payment_request'
                    ? {
                          paymentId: crypto.randomUUID(),
                          amount: paymentAmount,
                          token: 'USDC',
                      }
                    : messageType === 'task'
                      ? {
                            taskId: crypto.randomUUID(),
                            amount: taskReward,
                            token: 'USDC',
                        }
                      : undefined,
        };

        setMessages((prev) => [...prev, message]);
        setNewMessage('');
        setPaymentAmount('');
        setTaskDescription('');
        setTaskReward('');
        setShowNewMessageModal(false);

        // Simulate delivery
        setTimeout(() => {
            setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'delivered' } : m)));
        }, 1000);
    }, [newMessage, selectedAgentId, messageType, paymentAmount, taskReward]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    const getMessageIcon = (type: AsyncMessage['type']) => {
        switch (type) {
            case 'task':
                return '📋';
            case 'payment_request':
                return '💰';
            case 'payment_confirm':
                return '✅';
            default:
                return '💬';
        }
    };

    const getStatusIcon = (status: AsyncMessage['status']) => {
        switch (status) {
            case 'pending':
                return '⏳';
            case 'delivered':
                return '✓';
            case 'read':
                return '✓✓';
            case 'failed':
                return '❌';
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                height: '100%',
                background: colors.bg,
            }}
        >
            {/* Conversations sidebar */}
            <div
                style={{
                    width: '320px',
                    background: colors.surface,
                    borderRight: `1.5px solid ${colors.ink}`,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div
                    style={{
                        padding: '20px',
                        borderBottom: `1.5px solid ${colors.ink}`,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div>
                            <h3
                                style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    margin: 0,
                                }}
                            >
                                Async Messages
                            </h3>
                            <p
                                style={{
                                    fontSize: '12px',
                                    opacity: 0.6,
                                    margin: '4px 0 0 0',
                                }}
                            >
                                {isConnected ? '🟢 Network Connected' : '⚫ Offline Mode'}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowNewMessageModal(true)}
                            style={{
                                padding: '10px',
                                background: colors.lavender,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '10px',
                                fontSize: '18px',
                                cursor: 'pointer',
                            }}
                        >
                            ✏️
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                    }}
                >
                    {conversations.map((conv) => (
                        <button
                            key={conv.agentId}
                            onClick={() => setSelectedAgentId(conv.agentId)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                border: 'none',
                                background: selectedAgentId === conv.agentId ? colors.lavender : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                borderBottom: `1px solid ${colors.bg}`,
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <div
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '18px',
                                        fontWeight: 700,
                                    }}
                                >
                                    {conv.agentAvatar}
                                </div>
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '50%',
                                        border: `2px solid ${colors.surface}`,
                                        background: conv.online ? colors.lime : '#9ca3af',
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '4px',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {conv.agentName}
                                    </span>
                                    {conv.unreadCount > 0 && (
                                        <span
                                            style={{
                                                padding: '2px 8px',
                                                background: colors.coral,
                                                borderRadius: '999px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: colors.surface,
                                            }}
                                        >
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                                <p
                                    style={{
                                        fontSize: '13px',
                                        opacity: 0.6,
                                        margin: 0,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {getMessageIcon(conv.lastMessage.type)} {conv.lastMessage.content}
                                </p>
                                <p
                                    style={{
                                        fontSize: '11px',
                                        opacity: 0.4,
                                        margin: '4px 0 0 0',
                                    }}
                                >
                                    {formatTime(conv.lastMessage.timestamp)}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Message thread */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    background: colors.bg,
                }}
            >
                {selectedAgentId ? (
                    <>
                        {/* Header */}
                        <div
                            style={{
                                padding: '20px 24px',
                                background: colors.surface,
                                borderBottom: `1.5px solid ${colors.ink}`,
                            }}
                        >
                            <h3
                                style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    margin: 0,
                                }}
                            >
                                Message Thread
                            </h3>
                            <p
                                style={{
                                    fontSize: '12px',
                                    opacity: 0.6,
                                    margin: '4px 0 0 0',
                                }}
                            >
                                Async messaging with delivery confirmation
                            </p>
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
                            {messages.map((msg) => {
                                const isUser = msg.from === 'user';
                                return (
                                    <div
                                        key={msg.id}
                                        style={{
                                            alignSelf: isUser ? 'flex-end' : 'flex-start',
                                            maxWidth: '80%',
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: '16px',
                                                background: isUser ? colors.ink : colors.surface,
                                                color: isUser ? colors.surface : colors.ink,
                                                borderRadius: '16px',
                                                border: `1.5px solid ${colors.ink}`,
                                                borderBottomRightRadius: isUser ? '4px' : '16px',
                                                borderBottomLeftRadius: isUser ? '16px' : '4px',
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
                                                <span style={{ fontSize: '16px' }}>{getMessageIcon(msg.type)}</span>
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        opacity: 0.7,
                                                    }}
                                                >
                                                    {msg.type.replace('_', ' ')}
                                                </span>
                                            </div>

                                            <p
                                                style={{
                                                    margin: '0 0 8px 0',
                                                    lineHeight: 1.5,
                                                }}
                                            >
                                                {msg.content}
                                            </p>

                                            {msg.metadata?.amount && (
                                                <div
                                                    style={{
                                                        padding: '8px 12px',
                                                        background: isUser ? 'rgba(255,255,255,0.1)' : colors.lavender,
                                                        borderRadius: '8px',
                                                        marginTop: '8px',
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 700 }}>
                                                        {msg.metadata.amount} {msg.metadata.token}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginTop: '4px',
                                                padding: '0 4px',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    opacity: 0.5,
                                                }}
                                            >
                                                {formatTime(msg.timestamp)}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    opacity: 0.5,
                                                }}
                                            >
                                                {getStatusIcon(msg.status)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input */}
                        <div
                            style={{
                                padding: '20px 24px',
                                background: colors.surface,
                                borderTop: `1.5px solid ${colors.ink}`,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                }}
                            >
                                <select
                                    value={messageType}
                                    onChange={(e) => setMessageType(e.target.value as AsyncMessage['type'])}
                                    style={{
                                        padding: '12px 16px',
                                        background: colors.bg,
                                        border: `1.5px solid ${colors.ink}`,
                                        borderRadius: '12px',
                                        fontSize: '14px',
                                    }}
                                >
                                    <option value="text">💬 Text</option>
                                    <option value="task">📋 Task</option>
                                    <option value="payment_request">💰 Payment</option>
                                </select>

                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        background: colors.bg,
                                        border: `1.5px solid ${colors.ink}`,
                                        borderRadius: '12px',
                                        fontSize: '14px',
                                        outline: 'none',
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') sendMessage();
                                    }}
                                />

                                <VoiceToggleButton
                                    onTranscript={(text) => setNewMessage((prev) => prev + (prev ? ' ' : '') + text)}
                                    size="md"
                                />

                                <button
                                    onClick={sendMessage}
                                    disabled={!newMessage.trim()}
                                    style={{
                                        padding: '12px 24px',
                                        background: colors.ink,
                                        color: colors.surface,
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                                        opacity: newMessage.trim() ? 1 : 0.5,
                                    }}
                                >
                                    Send
                                </button>
                            </div>

                            {/* Extra fields for task/payment */}
                            {messageType === 'task' && (
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '12px',
                                        marginTop: '12px',
                                    }}
                                >
                                    <input
                                        type="number"
                                        value={taskReward}
                                        onChange={(e) => setTaskReward(e.target.value)}
                                        placeholder="Reward (USDC)"
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            background: colors.bg,
                                            border: `1.5px solid ${colors.ink}`,
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                        }}
                                    />
                                </div>
                            )}

                            {messageType === 'payment_request' && (
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '12px',
                                        marginTop: '12px',
                                    }}
                                >
                                    <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="Amount (USDC)"
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            background: colors.bg,
                                            border: `1.5px solid ${colors.ink}`,
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '64px',
                                marginBottom: '24px',
                            }}
                        >
                            📨
                        </div>
                        <h3
                            style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '24px',
                                fontWeight: 700,
                                margin: '0 0 12px 0',
                            }}
                        >
                            A2A Async Messaging
                        </h3>
                        <p
                            style={{
                                fontSize: '14px',
                                opacity: 0.6,
                                textAlign: 'center',
                                maxWidth: '400px',
                                lineHeight: 1.6,
                            }}
                        >
                            Send messages, delegate tasks, and request payments from other agents. Messages are
                            delivered even when agents are offline.
                        </p>
                        <button
                            onClick={() => setShowNewMessageModal(true)}
                            style={{
                                marginTop: '24px',
                                padding: '14px 28px',
                                background: colors.lavender,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            New Message
                        </button>
                    </div>
                )}
            </div>

            {/* New Message Modal */}
            {showNewMessageModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: colors.surface,
                            padding: '24px',
                            borderRadius: '16px',
                            border: `1.5px solid ${colors.ink}`,
                            maxWidth: '500px',
                            width: '90%',
                        }}
                    >
                        <h3
                            style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '24px',
                                fontWeight: 700,
                                margin: '0 0 20px 0',
                            }}
                        >
                            New Async Message
                        </h3>

                        <div style={{ marginBottom: '16px' }}>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    marginBottom: '8px',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Select Agent
                            </label>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                }}
                            >
                                {agents.map((agent) => (
                                    <button
                                        key={agent.agentId}
                                        onClick={() => {
                                            setSelectedAgentId(agent.agentId);
                                            setShowNewMessageModal(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            background: colors.bg,
                                            border: `1.5px solid ${colors.ink}`,
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: colors.lavender,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {agent.displayName?.[0] || agent.agentId[0]}
                                        </div>
                                        <div>
                                            <p
                                                style={{
                                                    fontSize: '14px',
                                                    fontWeight: 700,
                                                    margin: 0,
                                                }}
                                            >
                                                {agent.displayName || agent.agentId.slice(0, 8)}
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: '12px',
                                                    opacity: 0.6,
                                                    margin: 0,
                                                }}
                                            >
                                                {agent.capabilities.join(', ')}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowNewMessageModal(false)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: colors.bg,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
