/**
 * NotificationItem Component
 *
 * Displays individual notification with type-specific styling and actions.
 *
 * @module components/social/notifications/NotificationItem
 */

import { useCallback, useMemo } from 'react';
import type { Notification, NotificationType } from './types.ts';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS } from './types.ts';

export interface NotificationItemProps {
    /** Notification data */
    notification: Notification;
    /** Callback when notification is clicked */
    onClick?: (notification: Notification) => void;
    /** Callback to mark as read */
    onMarkAsRead?: (id: string) => void;
    /** Callback to archive/dismiss */
    onArchive?: (id: string) => void;
    /** Optional className for custom styling */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show timestamp */
    showTimestamp?: boolean;
    /** Compact mode - less padding, smaller text */
    compact?: boolean;
}

/**
 * Format relative time (e.g., "2m ago", "1h ago", "3d ago")
 */
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return new Date(timestamp).toLocaleDateString();
    }
    if (days > 0) {
        return `${days}d ago`;
    }
    if (hours > 0) {
        return `${hours}h ago`;
    }
    if (minutes > 0) {
        return `${minutes}m ago`;
    }
    return 'Just now';
}

/**
 * Get notification title based on type
 */
function getNotificationTitle(notification: Notification): string {
    if (notification.title) {
        return notification.title;
    }

    switch (notification.type) {
        case 'follow':
            return notification.actorName ? `${notification.actorName} started following you` : 'New follower';
        case 'message':
            return notification.actorName ? `New message from ${notification.actorName}` : 'New message';
        case 'task_update':
            return notification.metadata?.taskTitle
                ? `Task update: ${notification.metadata.taskTitle}`
                : 'Task status changed';
        case 'mention':
            return notification.actorName ? `${notification.actorName} mentioned you` : 'You were mentioned';
        default:
            return 'Notification';
    }
}

/**
 * Size configuration
 */
const sizeConfig = {
    sm: {
        padding: 'p-2',
        icon: 'w-6 h-6 text-sm',
        title: 'text-xs font-medium',
        message: 'text-xs',
        timestamp: 'text-[10px]',
    },
    md: {
        padding: 'p-3',
        icon: 'w-8 h-8 text-base',
        title: 'text-sm font-medium',
        message: 'text-sm',
        timestamp: 'text-xs',
    },
    lg: {
        padding: 'p-4',
        icon: 'w-10 h-10 text-lg',
        title: 'text-base font-medium',
        message: 'text-base',
        timestamp: 'text-sm',
    },
};

/**
 * NotificationItem - Single notification display
 */
export function NotificationItem({
    notification,
    onClick,
    onMarkAsRead,
    onArchive,
    className = '',
    size = 'md',
    showTimestamp = true,
    compact = false,
}: NotificationItemProps) {
    const config = sizeConfig[size];

    const handleClick = useCallback(() => {
        if (!notification.read && onMarkAsRead) {
            onMarkAsRead(notification.id);
        }
        onClick?.(notification);
    }, [notification, onClick, onMarkAsRead]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        },
        [handleClick],
    );

    const handleArchive = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onArchive?.(notification.id);
        },
        [notification.id, onArchive],
    );

    const handleMarkAsRead = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onMarkAsRead?.(notification.id);
        },
        [notification.id, onMarkAsRead],
    );

    const title = useMemo(() => getNotificationTitle(notification), [notification]);
    const icon = NOTIFICATION_ICONS[notification.type];
    const colorClass = NOTIFICATION_COLORS[notification.type];

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`
                flex items-start gap-3 cursor-pointer
                ${compact ? 'p-2' : config.padding}
                ${notification.read ? 'bg-transparent' : 'bg-gray-800/50'}
                hover:bg-gray-700/50 transition-colors rounded-lg
                ${className}
            `}
            aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${title}`}
        >
            {/* Icon */}
            <div
                className={`
                    flex-shrink-0 ${config.icon}
                    ${colorClass} rounded-full
                    flex items-center justify-center text-white
                `}
            >
                {icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p
                        className={`
                            ${config.title} text-gray-100
                            ${!notification.read ? 'font-semibold' : ''}
                            truncate
                        `}
                    >
                        {title}
                    </p>
                    {!notification.read && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" aria-label="Unread" />
                    )}
                </div>

                {notification.message && (
                    <p
                        className={`
                            ${config.message} text-gray-400 mt-0.5
                            line-clamp-2
                        `}
                    >
                        {notification.message}
                    </p>
                )}

                <div className="flex items-center justify-between mt-1.5">
                    {showTimestamp && (
                        <span className={`${config.timestamp} text-gray-500`}>
                            {formatRelativeTime(notification.createdAt)}
                        </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                        {!notification.read && onMarkAsRead && (
                            <button
                                type="button"
                                onClick={handleMarkAsRead}
                                className={`
                                    ${config.timestamp} text-gray-500 hover:text-gray-300
                                    px-1.5 py-0.5 rounded hover:bg-gray-700/50
                                    transition-colors
                                `}
                                aria-label="Mark as read"
                            >
                                Mark read
                            </button>
                        )}
                        {onArchive && (
                            <button
                                type="button"
                                onClick={handleArchive}
                                className={`
                                    ${config.timestamp} text-gray-500 hover:text-gray-300
                                    px-1.5 py-0.5 rounded hover:bg-gray-700/50
                                    transition-colors
                                `}
                                aria-label="Archive"
                            >
                                Archive
                            </button>
                        )}
                    </div>
                </div>

                {/* Type-specific metadata */}
                <NotificationMetadataDisplay notification={notification} size={size} />
            </div>
        </div>
    );
}

/**
 * Type-specific metadata display
 */
function NotificationMetadataDisplay({ notification, size }: { notification: Notification; size: 'sm' | 'md' | 'lg' }) {
    const config = sizeConfig[size];
    const { type, metadata } = notification;

    if (!metadata) return null;

    switch (type) {
        case 'task_update':
            if (metadata.taskState || metadata.taskReward) {
                return (
                    <div className={`${config.timestamp} text-gray-500 mt-1 flex items-center gap-2`}>
                        {metadata.taskState && (
                            <span className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">
                                {metadata.taskState}
                            </span>
                        )}
                        {metadata.taskReward !== undefined && <span>🏆 {metadata.taskReward} SOL</span>}
                    </div>
                );
            }
            return null;

        case 'follow':
            if (metadata.followerCount !== undefined) {
                return (
                    <div className={`${config.timestamp} text-gray-500 mt-1`}>{metadata.followerCount} followers</div>
                );
            }
            return null;

        case 'message':
            if (metadata.messagePreview) {
                return (
                    <div className={`${config.timestamp} text-gray-500 mt-1 italic truncate`}>
                        "{metadata.messagePreview}"
                    </div>
                );
            }
            return null;

        case 'mention':
            if (metadata.mentionContext) {
                return (
                    <div className={`${config.timestamp} text-gray-500 mt-1`}>
                        in {metadata.sourceType}: {metadata.mentionContext}
                    </div>
                );
            }
            return null;

        default:
            return null;
    }
}

/**
 * FollowNotificationItem - Specialized for follow notifications
 */
export function FollowNotificationItem({
    notification,
    onFollow,
    onViewProfile,
    className = '',
}: {
    notification: Notification;
    onFollow?: (agentAddress: string) => void;
    onViewProfile?: (agentAddress: string) => void;
    className?: string;
}) {
    const handleFollow = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (notification.actorAddress) {
                onFollow?.(notification.actorAddress);
            }
        },
        [notification.actorAddress, onFollow],
    );

    const handleViewProfile = useCallback(() => {
        if (notification.actorAddress) {
            onViewProfile?.(notification.actorAddress);
        }
    }, [notification.actorAddress, onViewProfile]);

    return (
        <div className={`flex items-center gap-3 p-3 hover:bg-gray-700/50 rounded-lg ${className}`}>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">👤</div>
            <div className="flex-1">
                <p className="text-sm text-gray-100">
                    <button type="button" onClick={handleViewProfile} className="font-medium hover:underline">
                        {notification.actorName || notification.actorAddress?.slice(0, 8)}
                    </button>
                    {' started following you'}
                </p>
                <span className="text-xs text-gray-500">{formatRelativeTime(notification.createdAt)}</span>
            </div>
            {onFollow && notification.actorAddress && (
                <button
                    type="button"
                    onClick={handleFollow}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                    Follow back
                </button>
            )}
        </div>
    );
}

export default NotificationItem;
