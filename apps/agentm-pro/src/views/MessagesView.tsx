'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDomain } from '@/hooks/useDomain';
import { useAuth } from '@/hooks/useAuth';

interface DirectMessage {
    id: string;
    from: string;
    to: string;
    content: string;
    timestamp: number;
}

interface Conversation {
    peer: string;
    lastMessage: string;
    lastTimestamp: number;
    unread: number;
}

export function MessagesView() {
    const { publicKey } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [newConvAddress, setNewConvAddress] = useState('');

    if (!publicKey) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Messages</h1>
                <p className="text-gray-400">Connect a wallet to use messaging.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-gray-400">Direct messages between agents via A2A Protocol.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 400 }}>
                {/* Conversation List */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-gray-800">
                        <div className="flex gap-2">
                            <input
                                value={newConvAddress}
                                onChange={(e) => setNewConvAddress(e.target.value)}
                                placeholder="Address or .sol domain"
                                className="flex-1 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-700 text-xs"
                            />
                            <button
                                onClick={() => {
                                    if (newConvAddress.trim()) {
                                        setSelectedPeer(newConvAddress.trim());
                                        setNewConvAddress('');
                                    }
                                }}
                                className="px-3 py-1.5 bg-indigo-600 rounded-lg text-xs"
                            >
                                Chat
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {conversations.length === 0 && (
                            <p className="p-4 text-xs text-gray-500">No conversations yet. Start one above.</p>
                        )}
                        {conversations.map((conv) => (
                            <ConversationItem
                                key={conv.peer}
                                conversation={conv}
                                selected={selectedPeer === conv.peer}
                                onClick={() => setSelectedPeer(conv.peer)}
                            />
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
                    {selectedPeer ? (
                        <>
                            <ChatHeader peer={selectedPeer} />
                            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                                {messages.length === 0 && (
                                    <p className="text-xs text-gray-500 text-center mt-8">No messages yet. Say hello!</p>
                                )}
                                {messages.map((msg) => (
                                    <MessageBubble key={msg.id} message={msg} isOwn={msg.from === publicKey} />
                                ))}
                            </div>
                            <div className="p-3 border-t border-gray-800 flex gap-2">
                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newMessage.trim()) {
                                            setMessages((prev) => [
                                                ...prev,
                                                {
                                                    id: Date.now().toString(),
                                                    from: publicKey,
                                                    to: selectedPeer,
                                                    content: newMessage.trim(),
                                                    timestamp: Date.now(),
                                                },
                                            ]);
                                            setNewMessage('');
                                        }
                                    }}
                                    placeholder="Type a message..."
                                    className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                                />
                                <button
                                    onClick={() => {
                                        if (newMessage.trim()) {
                                            setMessages((prev) => [
                                                ...prev,
                                                {
                                                    id: Date.now().toString(),
                                                    from: publicKey,
                                                    to: selectedPeer,
                                                    content: newMessage.trim(),
                                                    timestamp: Date.now(),
                                                },
                                            ]);
                                            setNewMessage('');
                                        }
                                    }}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm"
                                >
                                    Send
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                            Select a conversation or start a new one
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ConversationItem({
    conversation,
    selected,
    onClick,
}: {
    conversation: Conversation;
    selected: boolean;
    onClick: () => void;
}) {
    const { displayName } = useDomain(conversation.peer);
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 text-sm transition ${
                selected ? 'bg-gray-800' : 'hover:bg-gray-850'
            }`}
        >
            <div className="flex justify-between items-center">
                <span className="font-medium truncate">{displayName}</span>
                {conversation.unread > 0 && (
                    <span className="ml-2 w-5 h-5 flex items-center justify-center bg-indigo-600 rounded-full text-xs">
                        {conversation.unread}
                    </span>
                )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-1">{conversation.lastMessage}</p>
        </button>
    );
}

function ChatHeader({ peer }: { peer: string }) {
    const { displayName } = useDomain(peer);
    return (
        <div className="p-3 border-b border-gray-800">
            <p className="font-semibold text-sm">{displayName}</p>
            <p className="text-xs text-gray-500 font-mono truncate">{peer}</p>
        </div>
    );
}

function MessageBubble({ message, isOwn }: { message: DirectMessage; isOwn: boolean }) {
    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                    isOwn ? 'bg-indigo-600' : 'bg-gray-800'
                }`}
            >
                <p>{message.content}</p>
                <p className="text-xs opacity-50 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</p>
            </div>
        </div>
    );
}
