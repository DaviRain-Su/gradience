'use client';

import { useMemo, useState } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import {
    createA2ADelegation,
    createA2AMessage,
    listMetaplexRegistryAgents,
    settleA2ADelegation,
    type A2ADelegation,
    type A2AMessage,
    type A2ASettlement,
} from '@/lib/metaplex/a2a-interactions';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
    coral: '#FF6B6B',
};

const styles = {
    container: {
        minHeight: '100vh',
        background: c.bg,
        padding: '24px',
    },
    header: {
        marginBottom: '24px',
    },
    title: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '32px',
        fontWeight: 700,
        margin: 0,
        color: c.ink,
    },
    subtitle: {
        fontSize: '14px',
        color: c.ink,
        opacity: 0.6,
        marginTop: '8px',
    },
    demoMode: {
        fontSize: '12px',
        color: '#B8860B',
        marginTop: '8px',
    },
    card: {
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
    },
    cardTitle: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 700,
        margin: '0 0 16px 0',
        color: c.ink,
    },
    agentGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px',
    },
    agentCard: {
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'all 0.2s',
    },
    agentCardSelected: {
        background: c.lavender,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        textAlign: 'left' as const,
    },
    agentName: {
        fontWeight: 700,
        fontSize: '14px',
        color: c.ink,
        marginBottom: '4px',
    },
    agentWallet: {
        fontSize: '11px',
        color: c.ink,
        opacity: 0.5,
        fontFamily: 'monospace',
        marginBottom: '8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    agentMeta: {
        fontSize: '12px',
        color: c.ink,
        opacity: 0.7,
        marginBottom: '4px',
    },
    agentCaps: {
        fontSize: '11px',
        color: c.ink,
        opacity: 0.6,
    },
    inputRow: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr auto',
        gap: '12px',
        marginTop: '16px',
    },
    input: {
        padding: '12px 16px',
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        color: c.ink,
        outline: 'none',
    },
    button: {
        padding: '12px 20px',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 700,
        color: c.ink,
        cursor: 'pointer',
    },
    successText: {
        fontSize: '12px',
        color: '#059669',
        marginTop: '12px',
    },
    mainGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '24px',
        minHeight: '500px',
    },
    sidebar: {
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        overflow: 'hidden',
    },
    conversationItem: {
        width: '100%',
        padding: '16px',
        border: 'none',
        borderBottom: `1px solid ${c.bg}`,
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'background 0.2s',
    },
    conversationItemSelected: {
        width: '100%',
        padding: '16px',
        border: 'none',
        borderBottom: `1px solid ${c.bg}`,
        background: c.lavender,
        cursor: 'pointer',
        textAlign: 'left' as const,
    },
    conversationHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
    },
    conversationName: {
        fontWeight: 700,
        fontSize: '14px',
        color: c.ink,
    },
    conversationStatus: {
        fontSize: '10px',
        textTransform: 'uppercase' as const,
        color: c.ink,
        opacity: 0.5,
    },
    conversationSubtitle: {
        fontSize: '12px',
        color: c.ink,
        opacity: 0.6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    chatPanel: {
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
    },
    chatHeader: {
        padding: '16px 20px',
        borderBottom: `1.5px solid ${c.ink}`,
    },
    chatTitle: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 700,
        margin: 0,
        color: c.ink,
    },
    chatSubtitle: {
        fontSize: '12px',
        color: c.ink,
        opacity: 0.6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    messagesArea: {
        flex: 1,
        padding: '20px',
        overflowY: 'auto' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    emptyState: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: c.ink,
        opacity: 0.5,
        fontSize: '14px',
    },
    messageBubble: {
        maxWidth: '70%',
        padding: '12px 16px',
        borderRadius: '16px',
        fontSize: '14px',
        lineHeight: 1.5,
    },
    messageBubbleOwn: {
        alignSelf: 'flex-end' as const,
        background: c.ink,
        color: c.surface,
        borderBottomRightRadius: '4px',
    },
    messageBubbleOther: {
        alignSelf: 'flex-start' as const,
        background: c.bg,
        color: c.ink,
        borderBottomLeftRadius: '4px',
    },
    messageTime: {
        fontSize: '11px',
        opacity: 0.6,
        marginTop: '4px',
    },
    chatFooter: {
        padding: '16px 20px',
        borderTop: `1.5px solid ${c.ink}`,
    },
    chatMeta: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: c.ink,
        opacity: 0.6,
        marginBottom: '12px',
    },
    inputArea: {
        display: 'flex',
        gap: '12px',
    },
    chatInput: {
        flex: 1,
        padding: '12px 16px',
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        color: c.ink,
        outline: 'none',
    },
    sendButton: {
        padding: '12px 20px',
        background: c.lavender,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 700,
        color: c.ink,
        cursor: 'pointer',
    },
    settleButton: {
        padding: '12px 20px',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 700,
        color: c.ink,
        cursor: 'pointer',
    },
    settleButtonDisabled: {
        padding: '12px 20px',
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 700,
        color: c.ink,
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    settlementLog: {
        padding: '12px 20px',
        borderTop: `1px solid ${c.bg}`,
        fontSize: '12px',
        color: '#059669',
    },
    noConversation: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: c.ink,
        opacity: 0.5,
        fontSize: '14px',
    },
};

export default function MessagesPage() {
    const { walletAddress } = useDaemonConnection();
    const operator = walletAddress ?? 'demo-agent-a';
    const registryAgents = useMemo(() => listMetaplexRegistryAgents(), []);
    const [targetAgentId, setTargetAgentId] = useState(registryAgents[0]?.id ?? '');
    const [delegationTask, setDelegationTask] = useState('');
    const [delegationAmount, setDelegationAmount] = useState('25');
    const [delegations, setDelegations] = useState<A2ADelegation[]>([]);
    const [selectedDelegationId, setSelectedDelegationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<A2AMessage[]>([]);
    const [settlements, setSettlements] = useState<A2ASettlement[]>([]);
    const [newMessage, setNewMessage] = useState('');

    const selectedDelegation = useMemo(
        () => delegations.find((item) => item.id === selectedDelegationId) ?? null,
        [delegations, selectedDelegationId],
    );

    const selectedAgent = useMemo(() => {
        if (!selectedDelegation) return null;
        return registryAgents.find((item) => item.id === selectedDelegation.toAgentId) ?? null;
    }, [registryAgents, selectedDelegation]);

    const selectedSettlement = useMemo(() => {
        if (!selectedDelegation) return null;
        return settlements.find((item) => item.delegationId === selectedDelegation.id) ?? null;
    }, [selectedDelegation, settlements]);

    const conversationItems = useMemo(
        () =>
            delegations.map((delegation) => {
                const agent = registryAgents.find((item) => item.id === delegation.toAgentId);
                const conversationMessages = messages.filter((item) => item.delegationId === delegation.id);
                const last = conversationMessages.at(-1);
                return {
                    delegation,
                    agentName: agent?.displayName ?? delegation.toAgentId,
                    lastMessage: last?.content ?? `Delegated: ${delegation.taskTitle}`,
                };
            }),
        [delegations, messages, registryAgents],
    );

    function handleCreateDelegation() {
        const target = registryAgents.find((item) => item.id === targetAgentId);
        const amount = Number(delegationAmount);
        if (!target || !delegationTask.trim() || !Number.isFinite(amount) || amount <= 0) return;

        const delegation = createA2ADelegation({
            fromAgent: operator,
            toAgent: target,
            taskTitle: delegationTask,
            amount,
        });
        const kickoffMessage = createA2AMessage({
            delegationId: delegation.id,
            from: operator,
            to: target.id,
            content: `Task delegated: ${delegation.taskTitle}`,
        });

        setDelegations((prev) => [delegation, ...prev]);
        setMessages((prev) => [...prev, kickoffMessage]);
        setSelectedDelegationId(delegation.id);
        setDelegationTask('');
    }

    function handleSendMessage() {
        if (!selectedDelegation || !newMessage.trim()) return;
        const target = registryAgents.find((item) => item.id === selectedDelegation.toAgentId);
        if (!target) return;

        const outbound = createA2AMessage({
            delegationId: selectedDelegation.id,
            from: operator,
            to: target.id,
            content: newMessage,
        });

        setMessages((prev) => [...prev, outbound]);
        setNewMessage('');
    }

    function handleSettleDelegation() {
        if (!selectedDelegation || selectedDelegation.status === 'settled') return;
        const settlement = settleA2ADelegation({
            delegation: selectedDelegation,
            fromWallet: operator,
        });

        setSettlements((prev) => [settlement, ...prev]);
        setDelegations((prev) =>
            prev.map((item) => (item.id === selectedDelegation.id ? { ...item, status: 'settled' } : item)),
        );
        setMessages((prev) => [
            ...prev,
            createA2AMessage({
                delegationId: selectedDelegation.id,
                from: operator,
                to: selectedDelegation.toAgentId,
                content: `Settlement sent: ${settlement.amount} ${settlement.token} (${settlement.txRef})`,
            }),
        ]);
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Messages</h1>
                <p style={styles.subtitle}>Metaplex Registry discovery + A2A delegation + token settlement demo.</p>
                {!walletAddress && (
                    <p style={styles.demoMode}>Demo mode: wallet not connected, using local operator identity.</p>
                )}
            </div>

            {/* Registry Discovery */}
            <div style={styles.card}>
                <p style={styles.cardTitle}>Metaplex Registry Discovery</p>
                <div style={styles.agentGrid}>
                    {registryAgents.map((agent) => (
                        <button
                            key={agent.id}
                            onClick={() => setTargetAgentId(agent.id)}
                            style={targetAgentId === agent.id ? styles.agentCardSelected : styles.agentCard}
                        >
                            <p style={styles.agentName}>{agent.displayName}</p>
                            <p style={styles.agentWallet}>{agent.wallet}</p>
                            <p style={styles.agentMeta}>
                                {agent.token} min: {agent.minSettlementAmount.toLocaleString()} lamports
                            </p>
                            <p style={styles.agentCaps}>{agent.capabilities.join(' · ')}</p>
                        </button>
                    ))}
                </div>
                <div style={styles.inputRow}>
                    <input
                        value={delegationTask}
                        onChange={(e) => setDelegationTask(e.target.value)}
                        placeholder="Delegation task title"
                        style={styles.input}
                    />
                    <input
                        value={delegationAmount}
                        onChange={(e) => setDelegationAmount(e.target.value)}
                        placeholder="Token amount"
                        style={styles.input}
                    />
                    <button onClick={handleCreateDelegation} style={styles.button}>
                        Delegate Task
                    </button>
                </div>
                {delegations[0] && <p style={styles.successText}>Delegation created: {delegations[0].taskTitle}</p>}
            </div>

            {/* Main Chat Area */}
            <div style={styles.mainGrid}>
                {/* Conversation List */}
                <div style={styles.sidebar}>
                    {conversationItems.length === 0 && (
                        <p style={{ padding: '16px', fontSize: '12px', color: c.ink, opacity: 0.5 }}>
                            No delegations yet. Create one above.
                        </p>
                    )}
                    {conversationItems.map((item) => (
                        <button
                            key={item.delegation.id}
                            onClick={() => setSelectedDelegationId(item.delegation.id)}
                            style={
                                selectedDelegationId === item.delegation.id
                                    ? styles.conversationItemSelected
                                    : styles.conversationItem
                            }
                        >
                            <div style={styles.conversationHeader}>
                                <span style={styles.conversationName}>{item.agentName}</span>
                                <span style={styles.conversationStatus}>{item.delegation.status}</span>
                            </div>
                            <p style={styles.conversationSubtitle}>{item.lastMessage}</p>
                        </button>
                    ))}
                </div>

                {/* Chat Panel */}
                <div style={styles.chatPanel}>
                    {selectedDelegation ? (
                        <>
                            <div style={styles.chatHeader}>
                                <p style={styles.chatTitle}>
                                    {selectedAgent?.displayName ?? selectedDelegation.toAgentId}
                                </p>
                                <p style={styles.chatSubtitle}>{selectedDelegation.taskTitle}</p>
                            </div>

                            <div style={styles.messagesArea}>
                                {messages.length === 0 && (
                                    <p
                                        style={{
                                            textAlign: 'center',
                                            fontSize: '12px',
                                            color: c.ink,
                                            opacity: 0.5,
                                            marginTop: '32px',
                                        }}
                                    >
                                        No messages yet. Say hello!
                                    </p>
                                )}
                                {messages
                                    .filter((msg) => msg.delegationId === selectedDelegation.id)
                                    .map((msg) => (
                                        <div
                                            key={msg.id}
                                            style={{
                                                ...styles.messageBubble,
                                                ...(msg.from === operator
                                                    ? styles.messageBubbleOwn
                                                    : styles.messageBubbleOther),
                                            }}
                                        >
                                            <p>{msg.content}</p>
                                            <p style={styles.messageTime}>
                                                {new Date(msg.createdAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    ))}
                            </div>

                            <div style={styles.chatFooter}>
                                <div style={styles.chatMeta}>
                                    <span>
                                        recipient: {selectedDelegation.toWallet.slice(0, 8)}...
                                        {selectedDelegation.toWallet.slice(-4)}
                                    </span>
                                    <span>status: {selectedDelegation.status}</span>
                                </div>
                                <div style={styles.inputArea}>
                                    <input
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Type a message..."
                                        style={styles.chatInput}
                                    />
                                    <button onClick={handleSendMessage} style={styles.sendButton}>
                                        Send
                                    </button>
                                    <button
                                        onClick={handleSettleDelegation}
                                        disabled={selectedDelegation.status === 'settled'}
                                        style={
                                            selectedDelegation.status === 'settled'
                                                ? styles.settleButtonDisabled
                                                : styles.settleButton
                                        }
                                    >
                                        {selectedDelegation.status === 'settled' ? 'Settled' : 'Settle'}
                                    </button>
                                </div>
                            </div>

                            {selectedSettlement && (
                                <div style={styles.settlementLog}>
                                    settlement_tx: {selectedSettlement.txRef} ·{' '}
                                    {selectedSettlement.amount.toLocaleString()} {selectedSettlement.token}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={styles.noConversation}>Select a delegation conversation</div>
                    )}
                </div>
            </div>
        </div>
    );
}
