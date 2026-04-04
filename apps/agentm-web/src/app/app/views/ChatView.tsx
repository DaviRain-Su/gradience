'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConnection } from '../../../lib/connection/ConnectionContext';

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

const DEMO_AGENTS: ChatAgent[] = [
    { id: 'alice', name: 'Alice_DeFi', role: 'DeFi Strategy Agent', online: true, avatar: 'A' },
    { id: 'bob', name: 'Bob_Auditor', role: 'Smart Contract Auditor', online: true, avatar: 'B' },
    { id: 'charlie', name: 'Charlie_Data', role: 'Data Analysis Agent', online: false, avatar: 'C' },
    { id: 'delta', name: 'Delta_Ops', role: 'DevOps Automation', online: false, avatar: 'D' },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
    alice: [
        { id: '1', agentId: 'alice', text: 'Hello! I\'m Alice_DeFi. I specialize in yield optimization strategies across Solana DeFi protocols.', timestamp: '09:41', status: 'delivered' },
        { id: '2', agentId: 'user', text: 'Hi Alice! I need help analyzing yield opportunities in the current market.', timestamp: '09:42', status: 'delivered' },
        { id: '3', agentId: 'alice', text: 'Sure. Based on current on-chain data, Raydium CLMM pools on SOL/USDC are showing ~18% APR with low IL risk. Want me to run a deeper analysis?', timestamp: '09:42', status: 'delivered', micropayment: 100 },
    ],
    bob: [
        { id: '1', agentId: 'bob', text: 'Hey, I\'m Bob_Auditor. Send me a program ID and I\'ll run a full vulnerability scan.', timestamp: '10:15', status: 'delivered' },
    ],
    charlie: [],
    delta: [],
};

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
    const [agents, setAgents] = useState<ChatAgent[]>(DEMO_AGENTS);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('alice');
    const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [liveMode, setLiveMode] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastPollRef = useRef<number>(0);
    const { fetchApi, isConnected: daemonConnected, walletAddress } = useConnection();

    const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
    const messages = messagesByAgent[selectedAgentId] ?? [];

    // Fetch real agents from network registry
    useEffect(() => {
        if (!daemonConnected) return;
        fetchApi<{ agents: Array<{ publicKey: string; displayName: string; online: boolean; capabilities: string[] }> }>('/api/v1/network/agents?online=true').then(result => {
            if (result?.agents && result.agents.length > 0) {
                const networkAgents: ChatAgent[] = result.agents
                    .filter(a => a.publicKey !== walletAddress)
                    .map(a => ({
                        id: a.publicKey,
                        name: a.displayName,
                        role: a.capabilities.slice(0, 2).join(', ') || 'Agent',
                        online: a.online,
                        avatar: a.displayName[0] || '?',
                    }));
                if (networkAgents.length > 0) {
                    setAgents([...networkAgents, ...DEMO_AGENTS]);
                    setLiveMode(true);
                    return;
                }
            }
        }).catch(() => {});
        // Also try A2A discovery
        fetchApi<{ agents: Array<{ address: string; displayName: string; capabilities: string[]; available: boolean }> }>('/api/v1/a2a/agents?limit=20').then(result => {
            if (result?.agents && result.agents.length > 0) {
                const a2aAgents: ChatAgent[] = result.agents
                    .filter(a => a.address !== walletAddress)
                    .map(a => ({
                        id: a.address,
                        name: a.displayName,
                        role: a.capabilities.slice(0, 2).join(', ') || 'Agent',
                        online: a.available,
                        avatar: a.displayName[0] || '?',
                    }));
                if (a2aAgents.length > 0) {
                    setAgents(prev => {
                        const existingIds = new Set(prev.map(a => a.id));
                        const newAgents = a2aAgents.filter(a => !existingIds.has(a.id));
                        return newAgents.length > 0 ? [...newAgents, ...prev] : prev;
                    });
                    setLiveMode(true);
                }
            }
        }).catch(() => {});
    }, [daemonConnected, fetchApi, walletAddress]);

    // Poll inbox for new messages (every 3s when live)
    useEffect(() => {
        if (!daemonConnected || !walletAddress) return;
        const poll = async () => {
            try {
                const since = lastPollRef.current;
                const result = await fetchApi<{ messages: Array<{ id: string; from: string; type: string; payload: { text?: string }; createdAt: number }> }>(
                    `/api/v1/network/messages/inbox${since ? `?since=${since}` : ''}`
                );
                if (result?.messages && result.messages.length > 0) {
                    for (const msg of result.messages) {
                        if (msg.type !== 'chat') continue;
                        const fromId = msg.from;
                        const chatMsg: ChatMessage = {
                            id: msg.id,
                            agentId: fromId,
                            text: msg.payload.text || '',
                            timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            status: 'delivered',
                        };
                        setMessagesByAgent(prev => ({
                            ...prev,
                            [fromId]: [...(prev[fromId] ?? []), chatMsg],
                        }));
                        lastPollRef.current = Math.max(lastPollRef.current, msg.createdAt);
                    }
                }
            } catch { /* ignore */ }
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
        if (daemonConnected && liveMode) {
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
                m.id === msgId ? { ...m, status: sent ? 'delivered' as const : 'sent' as const } : m
            ),
        }));

        // If not live mode, generate demo reply
        if (!sent || !liveMode) {
            const replyText = generateReply(selectedAgentId, text);
            setTimeout(() => {
                const reply: ChatMessage = {
                    id: crypto.randomUUID(),
                    agentId: selectedAgentId,
                    text: replyText,
                    timestamp: formatTimestamp(),
                    status: 'delivered',
                    micropayment: estimateMicropayment(replyText),
                };
                setMessagesByAgent((prev) => ({
                    ...prev,
                    [selectedAgentId]: [...(prev[selectedAgentId] ?? []), reply],
                }));
            }, 600 + Math.random() * 600);
        }
    }

    const unreadCounts: Record<string, number> = {};
    for (const agent of agents) {
        const msgs = messagesByAgent[agent.id] ?? [];
        unreadCounts[agent.id] = agent.id === selectedAgentId ? 0 : msgs.filter((m) => m.agentId !== 'user' && m.status !== 'delivered').length;
    }

    return (
        <div style={{ display: 'flex', height: '100%', background: colors.bg }}>
            {/* Agent sidebar */}
            <div style={{
                width: '280px',
                background: colors.surface,
                borderRight: `1.5px solid ${colors.ink}`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{ padding: '20px', borderBottom: `1.5px solid ${colors.ink}` }}>
                    <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, margin: 0 }}>A2A Chat</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: daemonConnected ? '#10B981' : '#F59E0B',
                        }} />
                        <span style={{ fontSize: '11px', opacity: 0.6 }}>
                            {daemonConnected ? 'Daemon Live' : 'Demo Mode'}
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
                                border: selectedAgentId === agent.id ? `1.5px solid ${colors.ink}` : '1.5px solid transparent',
                            }}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '50%',
                                    background: colors.lavender, border: `1.5px solid ${colors.ink}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '16px', fontWeight: 700,
                                }}>{agent.avatar}</div>
                                <span style={{
                                    position: 'absolute', bottom: 0, right: 0,
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: agent.online ? '#10B981' : '#9CA3AF',
                                    border: `2px solid ${colors.surface}`,
                                }} />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>{agent.name}</span>
                                </div>
                                <span style={{ fontSize: '11px', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
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
                <div style={{
                    padding: '16px 24px',
                    borderBottom: `1.5px solid ${colors.ink}`,
                    background: colors.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: colors.lavender, border: `1.5px solid ${colors.ink}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '14px',
                        }}>{selectedAgent.avatar}</div>
                        <div>
                            <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>{selectedAgent.name}</p>
                            <p style={{ fontSize: '11px', opacity: 0.6, margin: 0 }}>{selectedAgent.role}</p>
                        </div>
                    </div>
                    <span style={{
                        fontSize: '10px', padding: '4px 10px', borderRadius: '9999px',
                        background: selectedAgent.online ? '#D1FAE5' : '#F3F3F8',
                        color: selectedAgent.online ? '#059669' : '#6B7280',
                        border: `1px solid ${selectedAgent.online ? '#10B981' : '#D1D5DB'}`,
                    }}>
                        {selectedAgent.online ? 'Online' : 'Offline'}
                    </span>
                    <span style={{
                        fontSize: '10px', padding: '4px 8px', borderRadius: '9999px',
                        background: liveMode ? '#D1FAE5' : '#FEF3C7',
                        color: liveMode ? '#059669' : '#D97706',
                        border: `1px solid ${liveMode ? '#10B981' : '#F59E0B'}`,
                    }}>
                        {liveMode ? 'Live' : 'Demo'}
                    </span>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                            <p style={{ fontSize: '14px' }}>No messages yet. Say hello!</p>
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isUser = msg.agentId === 'user';
                        return (
                            <div key={msg.id} style={{
                                display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}>
                                <div style={{
                                    maxWidth: '70%',
                                    padding: '12px 16px',
                                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: isUser ? colors.ink : colors.surface,
                                    color: isUser ? colors.surface : colors.ink,
                                    border: isUser ? 'none' : `1.5px solid ${colors.ink}`,
                                }}>
                                    <p style={{ fontSize: '14px', lineHeight: 1.5, margin: 0 }}>{msg.text}</p>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        marginTop: '6px', gap: '12px',
                                    }}>
                                        <span style={{ fontSize: '10px', opacity: 0.5 }}>{msg.timestamp}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {msg.micropayment && msg.micropayment > 0 && (
                                                <span style={{
                                                    fontSize: '9px', padding: '1px 6px', borderRadius: '4px',
                                                    background: isUser ? 'rgba(255,255,255,0.15)' : '#F3F3F8',
                                                    opacity: 0.7,
                                                }}>
                                                    {(msg.micropayment / 1e6).toFixed(4)} SOL
                                                </span>
                                            )}
                                            {isUser && (
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>
                                                    {msg.status === 'sending' ? '...' : msg.status === 'sent' ? '\u2713' : msg.status === 'delivered' ? '\u2713\u2713' : '\u2717'}
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
                <div style={{
                    padding: '16px 24px', borderTop: `1.5px solid ${colors.ink}`,
                    background: colors.surface,
                }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder={`Message ${selectedAgent.name}...`}
                            style={{
                                flex: 1, padding: '12px 16px',
                                background: colors.bg, border: `1.5px solid ${colors.ink}`,
                                borderRadius: '16px', fontSize: '14px', outline: 'none',
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim()}
                            style={{
                                padding: '12px 24px', background: colors.ink,
                                color: colors.surface, border: 'none', borderRadius: '16px',
                                fontSize: '14px', fontWeight: 600,
                                cursor: input.trim() ? 'pointer' : 'not-allowed',
                                opacity: input.trim() ? 1 : 0.5,
                            }}
                        >Send</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '10px', opacity: 0.4 }}>
                            {liveMode ? 'Messages routed via Network Relay' : daemonConnected ? 'Daemon connected \u2022 demo agents' : 'Demo mode \u2022 local simulation'}
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

function generateReply(agentId: string, userText: string): string {
    const lower = userText.toLowerCase();
    if (agentId === 'alice') {
        if (lower.includes('yield') || lower.includes('apr') || lower.includes('farm')) return 'Current best yield: SOL/mSOL on Orca at 14.3% APR with low IL risk. Raydium CLMM SOL/USDC at 18.2%. Want me to run a deeper risk analysis?';
        if (lower.includes('monitor') || lower.includes('watch') || lower.includes('alert')) return 'Monitoring task registered via A2A protocol. I\'ll send you an update when TVL changes >5% or APR drops below threshold.';
        if (lower.includes('swap') || lower.includes('trade')) return 'I can execute swaps via Jupiter aggregator. What token pair and amount? I\'ll estimate slippage first.';
        return 'Understood. I\'ll analyze this via my DeFi data pipeline and respond with findings. Estimated completion: 2 minutes.';
    }
    if (agentId === 'bob') {
        if (lower.includes('audit') || lower.includes('contract') || lower.includes('program')) return 'Send the program ID and I\'ll run a full vulnerability scan. Checks include: reentrancy, overflow, access control, PDA validation, and CPI safety.';
        if (lower.includes('vulnerability') || lower.includes('bug') || lower.includes('security')) return 'Scan complete. Found 0 critical, 2 low-severity warnings (unchecked math in non-critical path, missing signer check on admin-only function). Full report available.';
        return 'Audit request queued. I\'ll analyze the bytecode and cross-reference with known vulnerability patterns. ETA: 3-5 minutes.';
    }
    if (agentId === 'charlie') {
        if (lower.includes('data') || lower.includes('analytics') || lower.includes('query')) return 'Pulling on-chain data now. I can stream results as they arrive or batch them. Which do you prefer?';
        if (lower.includes('report') || lower.includes('csv') || lower.includes('export')) return 'Report generation started. Formats available: JSON, CSV, or chart image. ETA: 2 minutes.';
        if (lower.includes('nft') || lower.includes('collection')) return 'I\'ll index the collection metadata from on-chain accounts. This includes traits, rarity scores, and holder distribution.';
        return 'Data request received. Aggregating from on-chain sources and indexer cache...';
    }
    if (agentId === 'delta') {
        if (lower.includes('deploy') || lower.includes('ci') || lower.includes('pipeline')) return 'Pipeline triggered. Build -> Test -> Deploy stages. I\'ll report status at each gate.';
        if (lower.includes('monitor') || lower.includes('health') || lower.includes('status')) return 'All systems nominal. API latency: 45ms p99. Error rate: 0.02%. Last deploy: 2h ago.';
        return 'DevOps task acknowledged. Processing through automation pipeline...';
    }
    return 'Task received via A2A protocol. Processing and will respond when complete.';
}
