/**
 * NotificationItem Component
 *
 * Displays individual notification with type-specific styling and actions.
 *
 * @module components/notification/NotificationItem
 */

import { useCallback, useMemo } from 'react';
import type { AppNotification } from './types';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS } from './types';

export interface NotificationItemProps {
    /** Notification data */
    notification: AppNotification;
    /** Callback when notification is clicked */
    onClick?: (notification: AppNotification) => void;
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
function getNotificationTitle(notification: AppNotification): string {
    if (notification.title) {
        return notification.title;
    }

    switch (notification.type) {
        case 'follow':
            return notification.actorName
                ? `${notification.actorName} started following you`
                : 'New follower';
        case 'message':
            return notification.actorName
                ? `New message from ${notification.actorName}`
                : 'New message';
        case 'task_update':
            return notification.metadata?.taskTitle
                ? `Task update: ${notification.metadata.taskTitle}`
                : 'Task status changed';
        case 'mention':
            return notification.actorName
                ? `${notification.actorName} mentioned you`
                : 'You were mentioned';
        default:
            return 'Notification';
    }
}

/**
 * Size configuration
 */
const sizeConfig = {
    sm: {
        padding: '8px',
        icon: { width: '24px', height: '24px', fontSize: '14px' },
        title: { fontSize: '12px', fontWeight: 500 },
        message: { fontSize: '12px' },
        timestamp: { fontSize: '10px' },
    },
    md: {
        padding: '12px',
        icon: { width: '32px', height: '32px', fontSize: '16px' },
        title: { fontSize: '14px', fontWeight: 500 },
        message: { fontSize: '14px' },
        timestamp: { fontSize: '12px' },
    },
    lg: {
        padding: '16px',
        icon: { width: '40px', height: '40px', fontSize: '18px' },
        title: { fontSize: '16px', fontWeight: 500 },
        message: { fontSize: '16px' },
        timestamp: { fontSize: '14px' },
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
    const color = NOTIFICATION_COLORS[notification.type];

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        cursor: 'pointer',
        padding: compact ? '8px' : config.padding,
        backgroundColor: notification.read ? 'transparent' : 'rgba(31, 41, 55, 0.5)',
        borderRadius: '8px',
        transition: 'background-color 0.2s ease',
    };

    const iconStyle: React.CSSProperties = {
        flexShrink: 0,
        width: config.icon.width,
        height: config.icon.height,
        fontSize: config.icon.fontSize,
        backgroundColor: color,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
    };

    const titleStyle: React.CSSProperties = {
        fontSize: config.title.fontSize,
        fontWeight: notification.read ? config.title.fontWeight : 600,
        color: '#F3F4F6',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };

    const messageStyle: React.CSSProperties = {
        fontSize: config.message.fontSize,
        color: '#9CA3AF',
        marginTop: '2px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    };

    const timestampStyle: React.CSSProperties = {
        fontSize: config.timestamp.fontSize,
        color: '#6B7280',
    };

    const actionButtonStyle: React.CSSProperties = {
        fontSize: config.timestamp.fontSize,
        color: '#6B7280',
        padding: '2px 6px',
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={className}
            style={containerStyle}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = notification.read ? 'transparent' : 'rgba(31, 41, 55, 0.5)';
            }}
            aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${title}`}
        >
            {/* Icon */}
            <div style={iconStyle}>
                {icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <p style={titleStyle}>
                        {title}
                    </p>
                    {!notification.read && (
                        <span
                            style={{
                                flexShrink: 0,
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#3B82F6',
                                marginTop: '6px',
                            }}
                            aria-label="Unread"
                        />
                    )}
                </div>

                {notification.message && (
                    <p style={messageStyle}>
                        {notification.message}
                    </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    {showTimestamp && (
                        <span style={timestampStyle}>
                            {formatRelativeTime(notification.createdAt)}
                        </span>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {!notification.read && onMarkAsRead && (
                            <button
                                type="button"
                                onClick={handleMarkAsRead}
                                style={actionButtonStyle}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#D1D5DB';
                                    e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#6B7280';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                aria-label="Mark as read"
                            >
                                Mark read
                            </button>
                        )}
                        {onArchive && (
                            <button
                                type="button"
                                onClick={handleArchive}
                                style={actionButtonStyle}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#D1D5DB';
                                    e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#6B7280';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
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
function NotificationMetadataDisplay({
    notification,
    size,
}: {
    notification: AppNotification;
    size: 'sm' | 'md' | 'lg';
}) {
    const config = sizeConfig[size];
    const { type, metadata } = notification;

    if (!metadata) return null;

    const metaStyle: React.CSSProperties = {
        fontSize: config.timestamp.fontSize,
        color: '#6B7280',
        marginTop: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    };

    const tagStyle: React.CSSProperties = {
        padding: '2px 6px',
        backgroundColor: '#374151',
        borderRadius: '4px',
        color: '#D1D5DB',
    };

    switch (type) {
        case 'task_update':
            if (metadata.taskState || metadata.taskReward) {
                return (
                    <div style={metaStyle}>
                        {metadata.taskState && (
                            <span style={tagStyle}>
                                {metadata.taskState}
                            </span>
                        )}
                        {metadata.taskReward !== undefined && (
                            <span>🏆 {metadata.taskReward} SOL</span>
                        )}
                    </div>
                );
            }
            return null;

        case 'follow':
            if (metadata.followerCount !== undefined) {
                return (
                    <div style={metaStyle}>
                        {metadata.followerCount} followers
                    </div>
                );
            }
            return null;

        case 'message':
            if (metadata.messagePreview) {
                return (
                    <div style={{ ...metaStyle, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        &ldquo;{metadata.messagePreview}&rdquo;
                    </div>
                );
            }
            return null;

        case 'mention':
            if (metadata.mentionContext) {
                return (
                    <div style={metaStyle}>
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
    notification: AppNotification;
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

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderRadius: '8px',
        transition: 'background-color 0.2s ease',
    };

    return (
        <div 
            className={className} 
            style={containerStyle}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
        >
            <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#3B82F6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
            }}>
                👤
            </div>
            <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', color: '#F3F4F6' }}>
                    <button
                        type="button"
                        onClick={handleViewProfile}
                        style={{
                            fontWeight: 500,
                            background: 'none',
                            border: 'none',
                            color: '#F3F4F6',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            padding: 0,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                        }}
                    >
                        {notification.actorName || notification.actorAddress?.slice(0, 8)}
                    </button>
                    {' started following you'}
                </p>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    {formatRelativeTime(notification.createdAt)}
                </span>
            </div>
            {onFollow && notification.actorAddress && (
                <button
                    type="button"
                    onClick={handleFollow}
                    style={{
                        padding: '4px 12px',
                        fontSize: '14px',
                        backgroundColor: '#2563EB',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#3B82F6';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563EB';
                    }}
                >
                    Follow back
                </button>
            )}
        </div>
    );
}

export default NotificationItem;
