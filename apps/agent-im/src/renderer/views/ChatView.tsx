import { useState, useRef, useEffect } from 'react';
import { useAppStore, store } from '../hooks/useAppStore.ts';
import {
    InMemoryMagicBlockHub,
    InMemoryMagicBlockTransport,
    MagicBlockA2AAgent,
} from '../lib/a2a-client.ts';
import type { ChatMessage } from '../../shared/types.ts';

// Singleton A2A agent (created on first use)
let a2aAgent: MagicBlockA2AAgent | null = null;
let a2aStarted = false;

function getA2AAgent(agentId: string): MagicBlockA2AAgent {
    if (!a2aAgent || a2aAgent === null) {
        const hub = new InMemoryMagicBlockHub({ latencyMs: 20 });
        const transport = new InMemoryMagicBlockTransport(hub);
        a2aAgent = new MagicBlockA2AAgent(agentId, transport);
    }
    if (!a2aStarted) {
        a2aAgent.onDelivery((delivery) => {
            if (delivery.direction === 'incoming') {
                const msg: ChatMessage = {
                    id: delivery.envelope.id,
                    peerAddress: delivery.envelope.from,
                    direction: 'incoming',
                    topic: delivery.envelope.topic,
                    message: delivery.envelope.message,
                    paymentMicrolamports: delivery.envelope.paymentMicrolamports,
                    status: 'delivered',
                    createdAt: delivery.envelope.createdAt,
                };
                store.getState().addMessage(msg);
            }
        });
        a2aAgent.start();
        a2aStarted = true;
    }
    return a2aAgent;
}

export function ChatView() {
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const activeConversation = useAppStore((s) => s.activeConversation);
    const allMessages = useAppStore((s) => s.messages);
    const addMessage = useAppStore((s) => s.addMessage);

    const messages = activeConversation ? (allMessages.get(activeConversation) ?? []) : [];

    const [inputText, setInputText] = useState('');
    const [topic, setTopic] = useState('general');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [messages.length]);

    const handleSend = () => {
        if (!inputText.trim() || !activeConversation || !publicKey) return;

        const agent = getA2AAgent(publicKey);
        const envelope = agent.sendInvite({
            to: activeConversation,
            topic,
            message: inputText.trim(),
        });

        const msg: ChatMessage = {
            id: envelope.id,
            peerAddress: activeConversation,
            direction: 'outgoing',
            topic: envelope.topic,
            message: envelope.message,
            paymentMicrolamports: envelope.paymentMicrolamports,
            status: 'sent',
            createdAt: envelope.createdAt,
        };
        addMessage(msg);
        setInputText('');
    };

    if (!activeConversation) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                    <p className="text-xl mb-2">No conversation selected</p>
                    <p className="text-sm">Select a conversation from the sidebar, or invite an Agent from Discover.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b border-gray-800 bg-gray-900">
                <p className="font-medium">{activeConversation}</p>
                <p className="text-xs text-gray-500">Topic: {topic}</p>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-md rounded-xl px-4 py-2 ${
                                msg.direction === 'outgoing'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-200'
                            }`}
                        >
                            <p className="text-sm">{msg.message}</p>
                            <div className="flex justify-between items-center mt-1 gap-4">
                                <span className="text-xs opacity-60">
                                    {msg.paymentMicrolamports} ul
                                </span>
                                <span className="text-xs opacity-60">
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
