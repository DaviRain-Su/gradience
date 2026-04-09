/**
 * UnreadBadge Component
 *
 * Displays unread message count with visual indicators.
 * Supports various sizes and styles for different contexts.
 *
 * @module components/social/messaging/UnreadBadge
 */

import { useAppStore } from '../../../renderer/hooks/useAppStore.ts';

export interface UnreadBadgeProps {
    /** Optional specific peer address to show count for */
    peerAddress?: string;
    /** Badge size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Visual style variant */
    variant?: 'default' | 'dot' | 'pill';
    /** Maximum number to display (e.g., 99+) */
    maxCount?: number;
    /** Optional className for custom styling */
    className?: string;
    /** Show zero count when no unread */
    showZero?: boolean;
}

/**
 * Size configuration for badge variants
 */
const sizeConfig = {
    sm: {
        default: 'min-w-[1rem] h-4 text-[10px] px-1',
        dot: 'w-2 h-2',
        pill: 'min-w-[1.25rem] h-5 text-[10px] px-1.5',
    },
    md: {
        default: 'min-w-[1.25rem] h-5 text-xs px-1.5',
        dot: 'w-2.5 h-2.5',
        pill: 'min-w-[1.5rem] h-6 text-xs px-2',
    },
    lg: {
        default: 'min-w-[1.5rem] h-6 text-sm px-2',
        dot: 'w-3 h-3',
        pill: 'min-w-[2rem] h-7 text-sm px-2.5',
    },
};

/**
 * UnreadBadge - Displays unread message count
 */
export function UnreadBadge({
    peerAddress,
    size = 'md',
    variant = 'default',
    maxCount = 99,
    className = '',
    showZero = false,
}: UnreadBadgeProps) {
    const conversations = useAppStore((s) => s.conversations);

    // Calculate unread count
    const unreadCount = peerAddress
        ? (conversations.find((c) => c.peerAddress === peerAddress)?.unreadCount ?? 0)
        : conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    // Don't render if no unread and not showing zero
    if (unreadCount === 0 && !showZero) {
        return null;
    }

    // Format count display
    const displayCount = unreadCount > maxCount ? `${maxCount}+` : String(unreadCount);

    // Dot variant (just a red dot, no number)
    if (variant === 'dot') {
        return (
            <span
                className={`inline-block rounded-full bg-red-500 ${sizeConfig[size].dot} ${className}`}
                aria-label={`${unreadCount} unread messages`}
            />
        );
    }

    // Default/pill variant with number
    return (
        <span
            className={`inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-medium ${sizeConfig[size][variant]} ${className}`}
            aria-label={`${unreadCount} unread messages`}
        >
            {displayCount}
        </span>
    );
}

/**
 * ConversationUnreadBadge - Badge specifically for a conversation item
 */
export function ConversationUnreadBadge({ peerAddress, className = '' }: { peerAddress: string; className?: string }) {
    return <UnreadBadge peerAddress={peerAddress} size="sm" variant="default" className={className} />;
}

/**
 * GlobalUnreadBadge - Badge for total unread across all conversations
 */
export function GlobalUnreadBadge({ className = '' }: { className?: string }) {
    return <UnreadBadge size="md" variant="pill" className={className} />;
}

/**
 * UnreadIndicator - Simple dot indicator for any unread status
 */
export function UnreadIndicator({ className = '' }: { className?: string }) {
    const conversations = useAppStore((s) => s.conversations);
    const hasUnread = conversations.some((c) => c.unreadCount > 0);

    if (!hasUnread) return null;

    return (
        <span
            className={`inline-block w-2 h-2 rounded-full bg-red-500 ${className}`}
            aria-label="Unread messages available"
        />
    );
}

export default UnreadBadge;
