'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
    createA2ADelegation,
    createA2AMessage,
    listMetaplexRegistryAgents,
    settleA2ADelegation,
    type A2ADelegation,
    type A2AMessage,
    type A2ASettlement,
} from '@/lib/metaplex/a2a-interactions';

export function MessagesView() {
    const { publicKey } = useAuth();
    const operator = publicKey ?? 'demo-agent-a';
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
        [delegations, selectedDelegationId]
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
        [delegations, messages, registryAgents]
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
            prev.map((item) =>
                item.id === selectedDelegation.id ? { ...item, status: 'settled' } : item
            )
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
        <div className="space-y-6" data-testid="messages-view">
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-gray-400">
                Metaplex Registry discovery + A2A delegation + token settlement demo.
            </p>
            {!publicKey && (
                <p className="text-xs text-yellow-400">
                    Demo mode: wallet not connected, using local operator identity.
                </p>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <p className="font-semibold">Metaplex Registry Discovery</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {registryAgents.map((agent) => (
                        <button
                            key={agent.id}
                            data-testid={`metaplex-registry-${agent.id}`}
                            onClick={() => setTargetAgentId(agent.id)}
                            className={`text-left rounded-lg border p-3 ${
                                targetAgentId === agent.id
                                    ? 'border-indigo-500 bg-indigo-950/30'
                                    : 'border-gray-800 bg-gray-950'
                            }`}
                        >
                            <p className="font-medium">{agent.displayName}</p>
                            <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                                {agent.wallet}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {agent.token} min: {agent.minSettlementAmount}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {agent.capabilities.join(' · ')}
                            </p>
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input
                        data-testid="a2a-delegation-task"
                        value={delegationTask}
                        onChange={(event) => setDelegationTask(event.target.value)}
                        placeholder="Delegation task title"
                        className="md:col-span-2 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <input
                        data-testid="a2a-delegation-amount"
                        value={delegationAmount}
                        onChange={(event) => setDelegationAmount(event.target.value)}
                        placeholder="Token amount"
                        className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                    />
                    <button
                        data-testid="a2a-delegation-submit"
                        onClick={handleCreateDelegation}
                        className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-sm"
                    >
                        Delegate Task
                    </button>
                </div>
                {delegations[0] && (
                    <p data-testid="a2a-delegation-created" className="text-xs text-emerald-400">
                        Delegation created: {delegations[0].taskTitle}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 400 }}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="divide-y divide-gray-800">
                        {conversationItems.length === 0 && (
                            <p className="p-4 text-xs text-gray-500">
                                No delegations yet. Create one above.
                            </p>
                        )}
                        {conversationItems.map((item) => (
                            <ConversationItem
                                key={item.delegation.id}
                                name={item.agentName}
                                subtitle={item.lastMessage}
                                selected={selectedDelegationId === item.delegation.id}
                                onClick={() => setSelectedDelegationId(item.delegation.id)}
                                status={item.delegation.status}
                            />
                        ))}
                    </div>
                </div>

                <div
                    data-testid="a2a-chat-panel"
                    className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl flex flex-col"
                >
                    {selectedDelegation ? (
                        <>
                            <ChatHeader
                                title={selectedAgent?.displayName ?? selectedDelegation.toAgentId}
                                subtitle={selectedDelegation.taskTitle}
                            />
                            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                                {messages.length === 0 && (
                                    <p className="text-xs text-gray-500 text-center mt-8">No messages yet. Say hello!</p>
                                )}
                                {messages
                                    .filter((msg) => msg.delegationId === selectedDelegation.id)
                                    .map((msg) => (
                                        <MessageBubble key={msg.id} message={msg} isOwn={msg.from === operator} />
                                    ))}
                            </div>
                            <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-400 flex items-center justify-between">
                                <span data-testid="a2a-settlement-wallet">
                                    recipient_wallet: {selectedDelegation.toWallet}
                                </span>
                                <span data-testid="a2a-settlement-status">
                                    status: {selectedDelegation.status}
                                </span>
                            </div>
                            <div className="p-3 border-t border-gray-800 flex gap-2">
                                <input
                                    data-testid="a2a-chat-input"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Type a message..."
                                    className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                                />
                                <button
                                    data-testid="a2a-chat-send"
                                    onClick={handleSendMessage}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm"
                                >
                                    Send
                                </button>
                                <button
                                    data-testid="a2a-settle-button"
                                    onClick={handleSettleDelegation}
                                    disabled={selectedDelegation.status === 'settled'}
                                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-900 rounded-lg text-sm"
                                >
                                    Settle
                                </button>
                            </div>
                            {selectedSettlement && (
                                <div
                                    data-testid="a2a-settlement-log"
                                    className="px-3 py-2 border-t border-gray-800 text-xs text-emerald-300"
                                >
                                    settlement_tx: {selectedSettlement.txRef} · {selectedSettlement.amount}{' '}
                                    {selectedSettlement.token}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                            Select a delegation conversation
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ConversationItem({
    name,
    subtitle,
    selected,
    status,
    onClick,
}: {
    name: string;
    subtitle: string;
    selected: boolean;
    status: 'pending' | 'in_progress' | 'settled';
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 text-sm transition ${
                selected ? 'bg-gray-800' : 'hover:bg-gray-850'
            }`}
        >
            <div className="flex justify-between items-center">
                <span className="font-medium truncate">{name}</span>
                <span className="text-[10px] uppercase text-gray-500">{status}</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-1">{subtitle}</p>
        </button>
    );
}

function ChatHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="p-3 border-b border-gray-800">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        </div>
    );
}

function MessageBubble({ message, isOwn }: { message: A2AMessage; isOwn: boolean }) {
    return (
        <div data-testid="a2a-chat-message" className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                    isOwn ? 'bg-indigo-600' : 'bg-gray-800'
                }`}
            >
                <p data-testid="a2a-chat-message-content">{message.content}</p>
                <p className="text-xs opacity-50 mt-1">
                    {new Date(message.createdAt).toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}
