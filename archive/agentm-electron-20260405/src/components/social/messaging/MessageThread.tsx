/**
 * MessageThread Component
 *
 * Displays a scrollable thread of messages between agents.
 * Shows message bubbles with timestamps, status indicators, and payment info.
 *
 * @module components/social/messaging/MessageThread
 */

import { useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../../renderer/hooks/useAppStore.ts';
import type { ChatMessage, MessageStatus } from '../../../shared/types.ts';

export interface MessageThreadProps {
    /** Peer address to show messages for */
    peerAddress: string;
    /** Optional callback when thread is scrolled to top */
    onScrollTop?: () => void;
    /** Optional custom empty state message */
    emptyMessage?: string;
}

/**
 * Formats timestamp to readable time
 */
function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Formats date for date separators
 */
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: MessageStatus }) {
    const statusConfig: Record<MessageStatus, { icon: string; color: string; label: string }> = {
        sending: { icon: '⏳', color: 'text-amber-400', label: 'Sending' },
        sent: { icon: '✓', color: 'text-gray-500', label: 'Sent' },
        delivered: { icon: '✓✓', color: 'text-blue-400', label: 'Delivered' },
        failed: { icon: '✗', color: 'text-red-400', label: 'Failed' },
    };

    const config = statusConfig[status];

    return (
        <span className={`text-xs ${config.color}`} title={config.label}>
            {config.icon}
        </span>
    );
}

/**
 * Single message bubble component
 */
function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
    const publicKey = useAppStore((s) => s.auth.publicKey);

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`} data-message-id={message.id}>
            <div
                className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                    isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                }`}
            >
                {/* Message content */}
                <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>

                {/* Footer with meta info */}
                <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
                        {formatTime(message.createdAt)}
                    </span>

                    {/* Status for own messages */}
                    {isOwn && <StatusIndicator status={message.status} />}

                    {/* Payment indicator */}
                    {message.paymentMicrolamports > 0 && (
                        <span
                            className={`text-xs flex items-center gap-1 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}
                            title={`Paid ${message.paymentMicrolamports} microlamports`}
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                            </svg>
                            {(message.paymentMicrolamports / 1e6).toFixed(3)} SOL
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Date separator component
 */
function DateSeparator({ date }: { date: string }) {
    return (
        <div className="flex items-center justify-center my-4">
            <div className="h-px bg-gray-700 flex-1" />
            <span className="px-3 text-xs text-gray-500">{date}</span>
            <div className="h-px bg-gray-700 flex-1" />
        </div>
    );
}

/**
 * MessageThread - Displays conversation messages with auto-scroll
 */
export function MessageThread({
    peerAddress,
    onScrollTop,
    emptyMessage = 'No messages yet. Start the conversation!',
}: MessageThreadProps) {
    const messages = useAppStore((s) => s.messages);
    const publicKey = useAppStore((s) => s.auth.publicKey);
    const peerName = useAppStore((s) => s.conversations.find((c) => c.peerAddress === peerAddress)?.peerName);
    const setActiveConversation = useAppStore((s) => s.setActiveConversation);
    const threadRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<number>(0);

    // Filter and sort messages for this peer
    const threadMessages = useMemo(() => {
        const peerMsgs = messages.get(peerAddress) ?? [];
        return [...peerMsgs].sort((a, b) => a.createdAt - b.createdAt);
    }, [messages, peerAddress]);

    // Group messages by date
    const groupedMessages = useMemo(() => {
        const groups: { date: string; messages: ChatMessage[] }[] = [];
        let currentGroup: { date: string; messages: ChatMessage[] } | null = null;

        threadMessages.forEach((message) => {
            const date = formatDate(message.createdAt);
            if (!currentGroup || currentGroup.date !== date) {
                currentGroup = { date, messages: [] };
                groups.push(currentGroup);
            }
            currentGroup.messages.push(message);
        });

        return groups;
    }, [threadMessages]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (threadRef.current) {
            const { scrollHeight, clientHeight } = threadRef.current;
            threadRef.current.scrollTop = scrollHeight - clientHeight;
        }
    }, [threadMessages.length]);

    // Mark conversation as read when viewing
    useEffect(() => {
        setActiveConversation(peerAddress);
    }, [peerAddress, setActiveConversation]);

    // Handle scroll events
    const handleScroll = () => {
        if (!threadRef.current) return;

        const { scrollTop } = threadRef.current;

        // Detect scroll to top for loading more messages
        if (scrollTop < 50 && scrollTop < scrollPositionRef.current) {
            onScrollTop?.();
        }

        scrollPositionRef.current = scrollTop;
    };

    const displayName = peerName ?? `${peerAddress.slice(0, 8)}...${peerAddress.slice(-4)}`;

    if (threadMessages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                    <span className="text-white text-2xl font-bold">{displayName.charAt(0).toUpperCase()}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-200 mb-1">{displayName}</h3>
                <p className="text-sm text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div ref={threadRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-2">
            {groupedMessages.map((group) => (
                <div key={group.date}>
                    <DateSeparator date={group.date} />
                    {group.messages.map((message) => (
                        <MessageBubble key={message.id} message={message} isOwn={message.direction === 'outgoing'} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export default MessageThread;
