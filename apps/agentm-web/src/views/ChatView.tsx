import { useEffect, useRef, useState } from 'react';
import { store } from '../lib/store';
import type { ChatMessage } from '../types';

export function ChatView() {
    const auth = store.getState().auth;
    const activeConversation = store.getState().activeConversation;
    const messages = activeConversation ? (store.getState().messages.get(activeConversation) ?? []) : [];
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [messages.length]);

    const handleSend = () => {
        if (!inputText.trim() || !activeConversation || !auth.publicKey) return;

        const msg: ChatMessage = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            peerAddress: activeConversation,
            direction: 'outgoing',
            topic: 'general',
            message: inputText.trim(),
            paymentMicrolamports: 100 + new TextEncoder().encode(inputText).length * 2,
            status: 'sent',
            createdAt: Date.now(),
        };
        store.getState().addMessage(msg);
        setInputText('');
    };

    if (!activeConversation) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center space-y-2">
                    <p className="text-lg">No conversation selected</p>
                    <p className="text-sm">Go to Discover to find an Agent and start chatting</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 bg-gray-900">
                <p className="font-medium">{activeConversation}</p>
                <p className="text-xs text-gray-500">A2A Messaging</p>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                    <p className="text-gray-600 text-center mt-12">
                        Start the conversation. Messages are sent via A2A Protocol.
                    </p>
                )}
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
                                <span className="text-xs opacity-60">{msg.paymentMicrolamports} ul</span>
                                <span className="text-xs opacity-60">{new Date(msg.createdAt).toLocaleTimeString()}</span>
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
