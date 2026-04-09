'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConnection } from '../../lib/connection/ConnectionContext';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

interface ChatAgent {
    id: string;
    name: string;
    role: string;
    online: boolean;
    avatar: string;
}

interface ChatMessage {
    id: string;
    agentId: string | 'user';
    text: string;
    timestamp: string;
    status: 'sending' | 'sent' | 'delivered' | 'failed';
    micropayment?: number;
}

function estimateMicropayment(text: string): number {
    const baseMicrolamports = 100;
    const perByteMicrolamports = 2;
    return baseMicrolamports + new TextEncoder().encode(text).length * perByteMicrolamports;
}

function formatTimestamp(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function ChatView() {
    const [agents, setAgents] = useState<ChatAgent[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({});
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [liveMode, setLiveMode] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastPollRef = useRef<number>(0);
    const { fetchApi, isConnected: daemonConnected, walletAddress } = useConnection();

    const selectedAgent = agents.find((a) => a.id === selectedAgentId);
    const messages = selectedAgentId ? (messagesByAgent[selectedAgentId] ?? []) : [];

    // Fetch real agents from network registry
    useEffect(() => {
        if (!daemonConnected) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Try network registry first
        fetchApi<{
            agents: Array<{ publicKey: string; displayName: string; online: boolean; capabilities: string[] }>;
        }>('/api/v1/network/agents?online=true')
            .then((result) => {
                if (result?.agents && result.agents.length > 0) {
                    const networkAgents: ChatAgent[] = result.agents
                        .filter((a) => a.publicKey !== walletAddress)
                        .map((a) => ({
                            id: a.publicKey,
                            name: a.displayName,
                            role: a.capabilities.slice(0, 2).join(', ') || 'Agent',
                            online: a.online,
                            avatar: a.displayName[0] || '?',
                        }));
                    setAgents(networkAgents);
                    if (networkAgents.length > 0 && !selectedAgentId) {
                        setSelectedAgentId(networkAgents[0].id);
                    }
                    setLoading(false);
                    return;
                }

                // Fallback: Try A2A discovery
                return fetchApi<{
                    agents: Array<{ address: string; displayName: string; capabilities: string[]; available: boolean }>;
                }>('/api/v1/a2a/agents?limit=20');
            })
            .then((a2aResult) => {
                if (a2aResult?.agents && a2aResult.agents.length > 0) {
                    const a2aAgents: ChatAgent[] = a2aResult.agents
                        .filter((a) => a.address !== walletAddress)
                        .map((a) => ({
                            id: a.address,
                            name: a.displayName,
                            role: a.capabilities.slice(0, 2).join(', ') || 'Agent',
                            online: a.available,
                            avatar: a.displayName[0] || '?',
                        }));
                    setAgents((prev) => {
                        const existingIds = new Set(prev.map((a) => a.id));
                        const newAgents = a2aAgents.filter((a) => !existingIds.has(a.id));
                        return newAgents.length > 0 ? [...prev, ...newAgents] : prev;
                    });
                    if (a2aAgents.length > 0 && !selectedAgentId) {
                        setSelectedAgentId(a2aAgents[0].id);
                    }
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [daemonConnected, fetchApi, walletAddress]);

    // Poll inbox for new messages (every 3s when live)
    useEffect(() => {
        if (!daemonConnected || !walletAddress) return;
        const poll = async () => {
            try {
                const since = lastPollRef.current;
                const result = await fetchApi<{
                    messages: Array<{
                        id: string;
                        from: string;
                        type: string;
                        payload: { text?: string };
                        createdAt: number;
                    }>;
                }>(`/api/v1/network/messages/inbox${since ? `?since=${since}` : ''}`);
                if (result?.messages && result.messages.length > 0) {
                    for (const msg of result.messages) {
                        if (msg.type !== 'chat') continue;
                        const fromId = msg.from;
                        const chatMsg: ChatMessage = {
                            id: msg.id,
                            agentId: fromId,
                            text: msg.payload.text || '',
                            timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            }),
                            status: 'delivered',
                        };
                        setMessagesByAgent((prev) => ({
                            ...prev,
                            [fromId]: [...(prev[fromId] ?? []), chatMsg],
                        }));
                        lastPollRef.current = Math.max(lastPollRef.current, msg.createdAt);
                    }
                }
            } catch {
                /* ignore */
            }
        };
        poll();
        const timer = setInterval(poll, 3000);
        return () => clearInterval(timer);
    }, [daemonConnected, walletAddress, fetchApi]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedAgentId]);

    async function sendMessage() {
        const text = input.trim();
        if (!text) return;

        const timestamp = formatTimestamp();
        const micropayment = estimateMicropayment(text);
        const msgId = crypto.randomUUID();

        const userMsg: ChatMessage = {
            id: msgId,
            agentId: 'user',
            text,
            timestamp,
            status: 'sending',
            micropayment,
        };

        setMessagesByAgent((prev) => ({
            ...prev,
            [selectedAgentId]: [...(prev[selectedAgentId] ?? []), userMsg],
        }));
        setInput('');

        // Try sending via network relay, then A2A
        let sent = false;
        if (daemonConnected && selectedAgentId) {
            try {
                const result = await fetchApi<{ messageId: string }>('/api/v1/network/messages', {
                    method: 'POST',
                    body: JSON.stringify({ to: selectedAgentId, type: 'chat', payload: { text } }),
                });
                sent = !!result?.messageId;
            } catch {}
            // Fallback: try A2A protocol (Nostr/XMTP)
            if (!sent) {
                try {
                    const a2aResult = await fetchApi<{ success: boolean }>('/api/v1/a2a/send', {
                        method: 'POST',
                        body: JSON.stringify({ to: selectedAgentId, type: 'direct_message', payload: { text } }),
                    });
                    sent = !!a2aResult?.success;
                } catch {}
            }
        }

        // Update status
        setMessagesByAgent((prev) => ({
            ...prev,
            [selectedAgentId]: (prev[selectedAgentId] ?? []).map((m) =>
                m.id === msgId ? { ...m, status: sent ? ('delivered' as const) : ('sent' as const) } : m,
            ),
        }));
    }

    const unreadCounts: Record<string, number> = {};
    for (const agent of agents) {
        const msgs = messagesByAgent[agent.id] ?? [];
        unreadCounts[agent.id] =
            agent.id === selectedAgentId
                ? 0
                : msgs.filter((m) => m.agentId !== 'user' && m.status !== 'delivered').length;
    }

    return (
        <div style={{ display: 'flex', height: '100%', background: colors.bg }}>
            {/* Agent sidebar */}
            <div
                style={{
                    width: '280px',
                    background: colors.surface,
                    borderRight: `1.5px solid ${colors.ink}`,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{ padding: '20px', borderBottom: `1.5px solid ${colors.ink}` }}>
                    <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, margin: 0 }}>
                        A2A Chat
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: daemonConnected ? '#10B981' : '#F59E0B',
                            }}
                        />
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>
                            {daemonConnected ? 'Daemon Live' : 'Offline'}
                        </span>
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {agents.map((agent) => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                borderRadius: '12px',
                                background: selectedAgentId === agent.id ? colors.lavender : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                border:
                                    selectedAgentId === agent.id
                                        ? `1.5px solid ${colors.ink}`
                                        : '1.5px solid transparent',
                            }}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '50%',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                    }}
                                >
                                    {agent.avatar}
                                </div>
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: agent.online ? '#10B981' : '#9CA3AF',
                                        border: `2px solid ${colors.surface}`,
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>
                                        {agent.name}
                                    </span>
                                </div>
                                <span
                                    style={{
                                        fontSize: '11px',
                                        opacity: 0.6,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'block',
                                    }}
                                >
                                    {agent.role}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderBottom: `1.5px solid ${colors.ink}`,
                        background: colors.surface,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: colors.lavender,
                                border: `1.5px solid ${colors.ink}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '14px',
                            }}
                        >
                            {selectedAgent?.avatar ?? '?'}
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>
                                {selectedAgent?.name ?? 'Unknown'}
                            </p>
                            <p style={{ fontSize: '11px', opacity: 0.6, margin: 0 }}>
                                {selectedAgent?.role ?? 'Agent'}
                            </p>
                        </div>
                    </div>
                    <span
                        style={{
                            fontSize: '10px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            background: selectedAgent?.online ? '#D1FAE5' : '#F3F3F8',
                            color: selectedAgent?.online ? '#059669' : '#6B7280',
                            border: `1px solid ${selectedAgent?.online ? '#10B981' : '#D1D5DB'}`,
                        }}
                    >
                        {selectedAgent?.online ? 'Online' : 'Offline'}
                    </span>
                    <span
                        style={{
                            fontSize: '10px',
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            background: agents.length > 0 ? '#D1FAE5' : '#F3F4F6',
                            color: agents.length > 0 ? '#059669' : '#6B7280',
                            border: `1px solid ${agents.length > 0 ? '#10B981' : '#D1D5DB'}`,
                        }}
                    >
                        {agents.length > 0 ? 'Live' : 'No Agents'}
                    </span>
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
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                            <p style={{ fontSize: '14px' }}>No messages yet. Say hello!</p>
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isUser = msg.agentId === 'user';
                        return (
                            <div
                                key={msg.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: '70%',
                                        padding: '12px 16px',
                                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        background: isUser ? colors.ink : colors.surface,
                                        color: isUser ? colors.surface : colors.ink,
                                        border: isUser ? 'none' : `1.5px solid ${colors.ink}`,
                                    }}
                                >
                                    <p style={{ fontSize: '14px', lineHeight: 1.5, margin: 0 }}>{msg.text}</p>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: '6px',
                                            gap: '12px',
                                        }}
                                    >
                                        <span style={{ fontSize: '10px', opacity: 0.5 }}>{msg.timestamp}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {msg.micropayment && msg.micropayment > 0 && (
                                                <span
                                                    style={{
                                                        fontSize: '9px',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: isUser ? 'rgba(255,255,255,0.15)' : '#F3F3F8',
                                                        opacity: 0.7,
                                                    }}
                                                >
                                                    {(msg.micropayment / 1e6).toFixed(4)} SOL
                                                </span>
                                            )}
                                            {isUser && (
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>
                                                    {msg.status === 'sending'
                                                        ? '...'
                                                        : msg.status === 'sent'
                                                          ? '\u2713'
                                                          : msg.status === 'delivered'
                                                            ? '\u2713\u2713'
                                                            : '\u2717'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: `1.5px solid ${colors.ink}`,
                        background: colors.surface,
                    }}
                >
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder={`Message ${selectedAgent?.name ?? 'Agent'}...`}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                background: colors.bg,
                                border: `1.5px solid ${colors.ink}`,
                                borderRadius: '16px',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            style={{
                                padding: '12px 24px',
                                background: colors.ink,
                                color: colors.surface,
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: input.trim() ? 'pointer' : 'not-allowed',
                                opacity: input.trim() ? 1 : 0.5,
                            }}
                        >
                            Send
                        </button>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '8px',
                        }}
                    >
                        <span style={{ fontSize: '10px', opacity: 0.4 }}>
                            {daemonConnected ? 'Daemon connected' : 'Connect daemon to start messaging'}
                        </span>
                        {input.trim() && (
                            <span style={{ fontSize: '10px', opacity: 0.4 }}>
                                Est. micropayment: {(estimateMicropayment(input) / 1e6).toFixed(4)} SOL
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
