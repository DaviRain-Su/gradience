/**
 * Social Probe Chat Component
 * 
 * Multi-turn conversation UI for compatibility probing
 */

import { useState, useEffect, useRef } from 'react';
import type { ProbeSession, ProbeMessage } from '@gradiences/soul-engine';

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
        switch (session.status) {
            case 'pending':
                return <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded text-sm">Pending</span>;
            case 'probing':
                return <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-sm">🔍 Probing</span>;
            case 'completed':
                return <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded text-sm">✓ Completed</span>;
            case 'failed':
                return <span className="px-3 py-1 bg-red-600/20 text-red-400 rounded text-sm">✗ Failed</span>;
            case 'cancelled':
                return <span className="px-3 py-1 bg-gray-600/20 text-gray-400 rounded text-sm">Cancelled</span>;
        }
    };
    
    const canSend = session.status === 'probing' && turnsRemaining > 0 && !sending;
    
    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        Social Probe
                        {getStatusBadge()}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Turn {currentTurn} / {session.config.maxTurns} 
                        <span className="mx-2">•</span>
                        {turnsRemaining} turns remaining
                    </p>
                </div>
                
                <div className="flex gap-2">
                    {session.status === 'probing' && (
                        <button
                            onClick={onEndProbe}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
                        >
                            End & Analyze
                        </button>
                    )}
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
                    >
                        {session.status === 'completed' ? 'Close' : 'Cancel'}
                    </button>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div className="h-1 bg-gray-700">
                <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {session.conversation.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-lg mb-2">🔍 Social Probe Session</p>
                        <p className="text-sm">
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
                <div className="p-4 border-t border-gray-700 bg-gray-800">
                    <div className="flex gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isProber ? "Ask a question..." : "Share your thoughts..."}
                            rows={2}
                            disabled={!canSend}
                            className="flex-1 px-4 py-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!canSend || !input.trim()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
                        >
                            Send
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Press Enter to send • Shift+Enter for new line
                    </p>
                </div>
            )}
            
            {/* Completed State */}
            {session.status === 'completed' && (
                <div className="p-6 border-t border-gray-700 bg-gray-800 text-center">
                    <p className="text-lg font-semibold text-green-400 mb-2">✓ Probe Completed</p>
                    <p className="text-sm text-gray-400">
                        Ready to analyze compatibility. Click "Analyze Match" to generate your report.
                    </p>
                </div>
            )}
            
            {/* Failed State */}
            {session.status === 'failed' && session.error && (
                <div className="p-6 border-t border-gray-700 bg-gray-800 text-center">
                    <p className="text-lg font-semibold text-red-400 mb-2">✗ Probe Failed</p>
                    <p className="text-sm text-gray-400">{session.error}</p>
                </div>
            )}
        </div>
    );
}

// Message Bubble Component
function MessageBubble({ message, isOwn }: { message: ProbeMessage; isOwn: boolean }) {
    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs text-gray-500">
                        {message.role === 'prober' ? '🔍 Prober' : '🎯 Target'}
                    </span>
                    <span className="text-xs text-gray-600">
                        Turn {message.turn + 1}
                    </span>
                </div>
                <div
                    className={`px-4 py-3 rounded-2xl ${
                        isOwn
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                    }`}
                >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <span className="text-xs text-gray-600 mt-1 px-1">
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
        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/50 shadow-lg">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-2xl">
                    🔍
                </div>
                <div className="flex-1">
                    <h4 className="text-lg font-semibold mb-1">Social Probe Invitation</h4>
                    <p className="text-gray-400 text-sm mb-3">
                        <span className="font-medium text-white">{senderName}</span> wants to start a social probe
                        to assess compatibility.
                    </p>
                    <div className="flex gap-4 text-sm text-gray-400 mb-4">
                        <div>
                            <span className="text-gray-500">Depth:</span>{' '}
                            <span className="capitalize font-medium">{depth}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Max Turns:</span>{' '}
                            <span className="font-medium">{maxTurns}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onAccept}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                        >
                            Accept
                        </button>
                        <button
                            onClick={onReject}
                            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition"
                        >
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
