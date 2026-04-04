'use client';

import { useState, useRef, useEffect } from 'react';

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
}

const DEMO_AGENTS: ChatAgent[] = [
    { id: 'alice', name: 'Alice_DeFi', role: 'DeFi Strategy Agent', online: true, avatar: 'A' },
    { id: 'bob', name: 'Bob_Auditor', role: 'Smart Contract Auditor', online: true, avatar: 'B' },
    { id: 'charlie', name: 'Charlie_Data', role: 'Data Analysis Agent', online: false, avatar: 'C' },
    { id: 'delta', name: 'Delta_Ops', role: 'DevOps Automation', online: false, avatar: 'D' },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
    alice: [
        { id: '1', agentId: 'alice', text: 'Hello! I\'m Alice_DeFi. I specialize in yield optimization strategies across Solana DeFi protocols.', timestamp: '09:41' },
        { id: '2', agentId: 'user', text: 'Hi Alice! I need help analyzing yield opportunities in the current market.', timestamp: '09:42' },
        { id: '3', agentId: 'alice', text: 'Sure. Based on current on-chain data, Raydium CLMM pools on SOL/USDC are showing ~18% APR with low IL risk.', timestamp: '09:42' },
    ],
    bob: [
        { id: '1', agentId: 'bob', text: 'Hey, I\'m Bob_Auditor. I can review smart contracts and check for vulnerabilities.', timestamp: '10:15' },
    ],
    charlie: [
        { id: '1', agentId: 'charlie', text: 'Hi, I\'m Charlie_Data. I process on-chain datasets and generate analytics reports.', timestamp: 'Yesterday' },
    ],
    delta: [
        { id: '1', agentId: 'delta', text: 'Delta_Ops here. I handle CI/CD pipelines and automated deployments.', timestamp: 'Monday' },
    ],
};

export function ChatView() {
    const [selectedAgentId, setSelectedAgentId] = useState<string>('alice');
    const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedAgent = DEMO_AGENTS.find((a) => a.id === selectedAgentId)!;
    const messages = messagesByAgent[selectedAgentId] ?? [];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedAgentId]);

    function sendMessage() {
        const text = input.trim();
        if (!text) return;
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const userMsg: ChatMessage = { id: crypto.randomUUID(), agentId: 'user', text, timestamp };
        setMessagesByAgent((prev) => ({
            ...prev,
            [selectedAgentId]: [...(prev[selectedAgentId] ?? []), userMsg],
        }));
        setInput('');

        setTimeout(() => {
            const reply: ChatMessage = {
                id: crypto.randomUUID(),
                agentId: selectedAgentId,
                text: generateReply(selectedAgentId, text),
                timestamp,
            };
            setMessagesByAgent((prev) => ({
                ...prev,
                [selectedAgentId]: [...(prev[selectedAgentId] ?? []), reply],
            }));
        }, 800);
    }

    return (
        <div style={{
            display: 'flex',
            height: '100%',
            background: colors.bg,
        }}>
            {/* Agent sidebar */}
            <div style={{
                width: '280px',
                background: colors.surface,
                borderRight: `1.5px solid ${colors.ink}`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    padding: '20px',
                    borderBottom: `1.5px solid ${colors.ink}`,
                }}>
                    <h3 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '20px',
                        fontWeight: 700,
                        margin: 0,
                    }}>A2A Contacts</h3>
                    <p style={{
                        fontSize: '12px',
                        opacity: 0.6,
                        margin: '4px 0 0 0',
                    }}>Agent-to-Agent messaging</p>
                </div>
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                }}>
                    {DEMO_AGENTS.map((agent) => (
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
                                border: 'none',
                                background: selectedAgentId === agent.id ? colors.lavender : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                border: selectedAgentId === agent.id ? `1.5px solid ${colors.ink}` : '1.5px solid transparent',
                            }}
                        >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
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
                                }}>
                                    {agent.avatar}
                                </div>
                                <span style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    border: `2px solid ${colors.surface}`,
                                    background: agent.online ? colors.lime : '#9ca3af',
                                }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    color: colors.ink,
                                    margin: 0,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>{agent.name}</p>
                                <p style={{
                                    fontSize: '12px',
                                    color: colors.ink,
                                    opacity: 0.6,
                                    margin: '2px 0 0 0',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>{agent.role}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat window */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: colors.bg,
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px 24px',
                    background: colors.surface,
                    borderBottom: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
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
                        }}>
                            {selectedAgent.avatar}
                        </div>
                        <span style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            border: `2px solid ${colors.surface}`,
                            background: selectedAgent.online ? colors.lime : '#9ca3af',
                        }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: colors.ink,
                            margin: 0,
                        }}>{selectedAgent.name}</p>
                        <p style={{
                            fontSize: '13px',
                            color: colors.ink,
                            opacity: 0.6,
                            margin: '2px 0 0 0',
                        }}>
                            {selectedAgent.online ? '🟢 Online' : '⚫ Offline'} · {selectedAgent.role}
                        </p>
                    </div>
                    <div style={{
                        padding: '6px 12px',
                        background: colors.lime,
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: `1.5px solid ${colors.ink}`,
                    }}>
                        A2A Protocol
                    </div>
                </div>

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}>
                    {messages.map((msg) => {
                        const isUser = msg.agentId === 'user';
                        return (
                            <div key={msg.id} style={{
                                display: 'flex',
                                justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}>
                                {!isUser && (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        marginRight: '12px',
                                        flexShrink: 0,
                                        marginTop: '4px',
                                    }}>
                                        {selectedAgent.avatar}
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '70%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    alignItems: isUser ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        fontSize: '14px',
                                        lineHeight: 1.5,
                                        background: isUser ? colors.ink : colors.surface,
                                        color: isUser ? colors.surface : colors.ink,
                                        border: `1.5px solid ${colors.ink}`,
                                        borderBottomRightRadius: isUser ? '4px' : '16px',
                                        borderBottomLeftRadius: isUser ? '16px' : '4px',
                                    }}>
                                        {msg.text}
                                    </div>
                                    <span style={{
                                        fontSize: '11px',
                                        color: colors.ink,
                                        opacity: 0.5,
                                    }}>{msg.timestamp}</span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: '20px 24px',
                    background: colors.surface,
                    borderTop: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-end',
                    }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder={`Message ${selectedAgent.name}...`}
                            style={{
                                flex: 1,
                                padding: '14px 18px',
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
                                padding: '14px 24px',
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
                    <p style={{
                        fontSize: '11px',
                        color: colors.ink,
                        opacity: 0.5,
                        marginTop: '12px',
                    }}>
                        ⚠️ Demo Mode · Messages are simulated locally
                    </p>
                </div>
            </div>
        </div>
    );
}

function generateReply(agentId: string, userText: string): string {
    const lower = userText.toLowerCase();
    if (agentId === 'alice') {
        if (lower.includes('yield') || lower.includes('apr')) return 'Current best yield: SOL/mSOL on Orca at 14.3% APR. Want me to allocate?';
        if (lower.includes('monitor') || lower.includes('watch')) return 'Monitoring task registered. I\'ll alert you on significant changes.';
        return 'Acknowledged. Processing your request via A2A task delegation...';
    }
    if (agentId === 'bob') {
        if (lower.includes('audit') || lower.includes('contract')) return 'Send the program ID and I\'ll run a full vulnerability scan.';
        if (lower.includes('vulnerability') || lower.includes('bug')) return 'Found no critical issues in the latest scan. 2 low-severity warnings logged.';
        return 'Audit request queued. Estimated completion: 3-5 minutes.';
    }
    if (agentId === 'charlie') {
        if (lower.includes('data') || lower.includes('analytics')) return 'Pulling on-chain data now. I\'ll stream results as they arrive.';
        if (lower.includes('report')) return 'Report generation started. Format: JSON + CSV. ETA: 2 minutes.';
        return 'Data request received. Aggregating from on-chain sources...';
    }
    return 'Task received. I\'ll process this and respond via A2A when complete.';
}
