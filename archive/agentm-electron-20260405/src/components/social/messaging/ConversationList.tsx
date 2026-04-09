/**
 * ConversationList Component
 *
 * Displays a scrollable list of conversations with agents.
 * Shows peer info, last message preview, and unread counts.
 *
 * @module components/social/messaging/ConversationList
 */

import { useAppStore } from '../../../renderer/hooks/useAppStore.ts';
import type { Conversation } from '../../../shared/types.ts';

export interface ConversationListProps {
    /** Optional filter by peer address or name */
    filter?: string;
    /** Optional callback when conversation is selected */
    onSelect?: (peerAddress: string) => void;
    /** Optional custom empty state message */
    emptyMessage?: string;
}

/**
 * Formats a timestamp into relative time string
 */
function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Truncates text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Single conversation item component
 */
function ConversationItem({
    conversation,
    isActive,
    onClick,
}: {
    conversation: Conversation;
    isActive: boolean;
    onClick: () => void;
}) {
    const displayName = conversation.peerName ?? truncate(conversation.peerAddress, 16);

    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-3 transition flex items-start gap-3 ${
                isActive
                    ? 'bg-blue-600/20 border-l-2 border-blue-500'
                    : 'hover:bg-gray-800/50 border-l-2 border-transparent'
            }`}
            aria-selected={isActive}
            role="option"
        >
            {/* Avatar placeholder */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">{displayName.charAt(0).toUpperCase()}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2">
                    <span className="font-medium text-sm truncate text-gray-200">{displayName}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatTimeAgo(conversation.lastMessageAt)}
                    </span>
                </div>

                <div className="flex justify-between items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400 truncate flex-1">{truncate(conversation.lastMessage, 40)}</p>

                    {conversation.unreadCount > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-medium rounded-full px-2 py-0.5 min-w-[1.25rem] text-center flex-shrink-0">
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

/**
 * ConversationList - Displays all conversations sorted by recency
 */
export function ConversationList({
    filter,
    onSelect,
    emptyMessage = 'No conversations yet. Start chatting with agents!',
}: ConversationListProps) {
    const conversations = useAppStore((s) => s.conversations);
    const activeConversation = useAppStore((s) => s.activeConversation);
    const setActiveConversation = useAppStore((s) => s.setActiveConversation);

    // Filter conversations
    const filteredConversations = filter
        ? conversations.filter(
              (c) =>
                  c.peerAddress.toLowerCase().includes(filter.toLowerCase()) ||
                  (c.peerName?.toLowerCase() ?? '').includes(filter.toLowerCase()),
          )
        : conversations;

    // Sort by most recent
    const sortedConversations = [...filteredConversations].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    const handleSelect = (peerAddress: string) => {
        setActiveConversation(peerAddress);
        onSelect?.(peerAddress);
    };

    if (sortedConversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>
                <p className="text-sm text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                <h2 className="font-semibold text-gray-200">Messages</h2>
                {totalUnread > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-medium rounded-full px-2 py-0.5">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
                {sortedConversations.map((conversation) => (
                    <ConversationItem
                        key={conversation.peerAddress}
                        conversation={conversation}
                        isActive={activeConversation === conversation.peerAddress}
                        onClick={() => handleSelect(conversation.peerAddress)}
                    />
                ))}
            </div>
        </div>
    );
}

export default ConversationList;
