/**
 * NotificationList Component
 *
 * Displays a list/feed of notifications with filtering and grouping options.
 *
 * @module components/notification/NotificationList
 */

import { useState, useCallback, useMemo } from 'react';
import type { AppNotification, NotificationType } from './types';
import { NotificationItem } from './NotificationItem';

export interface NotificationListProps {
    /** Array of notifications to display */
    notifications: AppNotification[];
    /** Callback when a notification is clicked */
    onNotificationClick?: (notification: AppNotification) => void;
    /** Callback to mark a notification as read */
    onMarkAsRead?: (id: string) => void;
    /** Callback to mark all notifications as read */
    onMarkAllAsRead?: () => void;
    /** Callback to archive a notification */
    onArchive?: (id: string) => void;
    /** Callback to clear all notifications */
    onClearAll?: () => void;
    /** Optional className for custom styling */
    className?: string;
    /** Maximum height before scrolling */
    maxHeight?: string;
    /** Show filter tabs */
    showFilters?: boolean;
    /** Show group headers (Today, Yesterday, etc.) */
    groupByDate?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Loading state */
    loading?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
}

/** Filter options */
type FilterOption = 'all' | NotificationType;

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'follow', label: 'Follows' },
    { value: 'message', label: 'Messages' },
    { value: 'task_update', label: 'Tasks' },
    { value: 'mention', label: 'Mentions' },
];

/**
 * Group notifications by date
 */
function groupNotificationsByDate(notifications: AppNotification[]): Map<string, AppNotification[]> {
    const groups = new Map<string, AppNotification[]>();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const lastWeek = today - 7 * 24 * 60 * 60 * 1000;

    for (const notification of notifications) {
        let groupKey: string;

        if (notification.createdAt >= today) {
            groupKey = 'Today';
        } else if (notification.createdAt >= yesterday) {
            groupKey = 'Yesterday';
        } else if (notification.createdAt >= lastWeek) {
            groupKey = 'This Week';
        } else {
            groupKey = 'Earlier';
        }

        const existing = groups.get(groupKey) || [];
        existing.push(notification);
        groups.set(groupKey, existing);
    }

    return groups;
}

/**
 * NotificationList - Feed of notifications
 */
export function NotificationList({
    notifications,
    onNotificationClick,
    onMarkAsRead,
    onMarkAllAsRead,
    onArchive,
    onClearAll,
    className = '',
    maxHeight = '400px',
    showFilters = true,
    groupByDate = true,
    emptyMessage = 'No notifications',
    loading = false,
    size = 'md',
}: NotificationListProps) {
    const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

    // Filter notifications
    const filteredNotifications = useMemo(() => {
        if (activeFilter === 'all') {
            return notifications;
        }
        return notifications.filter((n) => n.type === activeFilter);
    }, [notifications, activeFilter]);

    // Sort by date (newest first)
    const sortedNotifications = useMemo(() => {
        return [...filteredNotifications].sort((a, b) => b.createdAt - a.createdAt);
    }, [filteredNotifications]);

    // Group by date if enabled
    const groupedNotifications = useMemo(() => {
        if (!groupByDate) {
            return null;
        }
        return groupNotificationsByDate(sortedNotifications);
    }, [sortedNotifications, groupByDate]);

    // Count unread
    const unreadCount = useMemo(() => {
        return notifications.filter((n) => !n.read).length;
    }, [notifications]);

    const handleFilterChange = useCallback((filter: FilterOption) => {
        setActiveFilter(filter);
    }, []);

    if (loading) {
        return (
            <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
                <NotificationListHeader unreadCount={0} onMarkAllAsRead={onMarkAllAsRead} onClearAll={onClearAll} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                    <div
                        style={{
                            width: '24px',
                            height: '24px',
                            border: '2px solid #3B82F6',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className={className}
            style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#111827',
                borderRadius: '8px',
            }}
        >
            {/* Header */}
            <NotificationListHeader
                unreadCount={unreadCount}
                onMarkAllAsRead={onMarkAllAsRead}
                onClearAll={onClearAll}
            />

            {/* Filters */}
            {showFilters && (
                <NotificationFilters
                    activeFilter={activeFilter}
                    onFilterChange={handleFilterChange}
                    notifications={notifications}
                />
            )}

            {/* Notification List */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight }}>
                {sortedNotifications.length === 0 ? (
                    <EmptyNotifications message={emptyMessage} />
                ) : groupByDate && groupedNotifications ? (
                    <GroupedNotificationList
                        groups={groupedNotifications}
                        onNotificationClick={onNotificationClick}
                        onMarkAsRead={onMarkAsRead}
                        onArchive={onArchive}
                        size={size}
                    />
                ) : (
                    <FlatNotificationList
                        notifications={sortedNotifications}
                        onNotificationClick={onNotificationClick}
                        onMarkAsRead={onMarkAsRead}
                        onArchive={onArchive}
                        size={size}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Header with title and actions
 */
function NotificationListHeader({
    unreadCount,
    onMarkAllAsRead,
    onClearAll,
}: {
    unreadCount: number;
    onMarkAllAsRead?: () => void;
    onClearAll?: () => void;
}) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid #1F2937',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                    style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#F3F4F6',
                        margin: 0,
                    }}
                >
                    Notifications
                </h2>
                {unreadCount > 0 && (
                    <span
                        style={{
                            padding: '2px 8px',
                            fontSize: '12px',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            borderRadius: '9999px',
                        }}
                    >
                        {unreadCount} new
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onMarkAllAsRead && unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={onMarkAllAsRead}
                        style={{
                            fontSize: '12px',
                            color: '#9CA3AF',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#E5E7EB';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#9CA3AF';
                        }}
                    >
                        Mark all read
                    </button>
                )}
                {onClearAll && (
                    <button
                        type="button"
                        onClick={onClearAll}
                        style={{
                            fontSize: '12px',
                            color: '#9CA3AF',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#E5E7EB';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#9CA3AF';
                        }}
                    >
                        Clear all
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Filter tabs
 */
function NotificationFilters({
    activeFilter,
    onFilterChange,
    notifications,
}: {
    activeFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
    notifications: AppNotification[];
}) {
    // Count per type
    const counts = useMemo(() => {
        const result: Record<string, number> = { all: notifications.length };
        for (const n of notifications) {
            result[n.type] = (result[n.type] || 0) + 1;
        }
        return result;
    }, [notifications]);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px',
                borderBottom: '1px solid #1F2937',
                overflowX: 'auto',
            }}
        >
            {FILTER_OPTIONS.map((option) => {
                const count = counts[option.value] || 0;
                const isActive = activeFilter === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onFilterChange(option.value)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            borderRadius: '9999px',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            backgroundColor: isActive ? '#2563EB' : '#1F2937',
                            color: isActive ? '#FFFFFF' : '#9CA3AF',
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.backgroundColor = '#374151';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.backgroundColor = '#1F2937';
                            }
                        }}
                    >
                        {option.label}
                        {count > 0 && (
                            <span
                                style={{
                                    fontSize: '10px',
                                    color: isActive ? '#BFDBFE' : '#6B7280',
                                }}
                            >
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Grouped notification list with date headers
 */
function GroupedNotificationList({
    groups,
    onNotificationClick,
    onMarkAsRead,
    onArchive,
    size,
}: {
    groups: Map<string, AppNotification[]>;
    onNotificationClick?: (notification: AppNotification) => void;
    onMarkAsRead?: (id: string) => void;
    onArchive?: (id: string) => void;
    size: 'sm' | 'md' | 'lg';
}) {
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groupOrder.map((groupKey) => {
                const groupNotifications = groups.get(groupKey);
                if (!groupNotifications || groupNotifications.length === 0) {
                    return null;
                }

                return (
                    <div key={groupKey}>
                        <div
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: '#9CA3AF',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {groupKey}
                            </span>
                        </div>
                        <div>
                            {groupNotifications.map((notification) => (
                                <div key={notification.id} style={{ borderBottom: '1px solid rgba(31, 41, 55, 0.5)' }}>
                                    <NotificationItem
                                        notification={notification}
                                        onClick={onNotificationClick}
                                        onMarkAsRead={onMarkAsRead}
                                        onArchive={onArchive}
                                        size={size}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Flat notification list without grouping
 */
function FlatNotificationList({
    notifications,
    onNotificationClick,
    onMarkAsRead,
    onArchive,
    size,
}: {
    notifications: AppNotification[];
    onNotificationClick?: (notification: AppNotification) => void;
    onMarkAsRead?: (id: string) => void;
    onArchive?: (id: string) => void;
    size: 'sm' | 'md' | 'lg';
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((notification) => (
                <div key={notification.id} style={{ borderBottom: '1px solid rgba(31, 41, 55, 0.5)' }}>
                    <NotificationItem
                        notification={notification}
                        onClick={onNotificationClick}
                        onMarkAsRead={onMarkAsRead}
                        onArchive={onArchive}
                        size={size}
                    />
                </div>
            ))}
        </div>
    );
}

/**
 * Empty state
 */
function EmptyNotifications({ message }: { message: string }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 16px',
            }}
        >
            <svg
                style={{ width: '48px', height: '48px', color: '#4B5563', marginBottom: '12px' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
            </svg>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>{message}</p>
        </div>
    );
}

/**
 * NotificationDropdown - Popover/dropdown version of notification list
 */
export function NotificationDropdown({
    notifications,
    onNotificationClick,
    onMarkAsRead,
    onMarkAllAsRead,
    onArchive,
    onViewAll,
    className = '',
}: {
    notifications: AppNotification[];
    onNotificationClick?: (notification: AppNotification) => void;
    onMarkAsRead?: (id: string) => void;
    onMarkAllAsRead?: () => void;
    onArchive?: (id: string) => void;
    onViewAll?: () => void;
    className?: string;
}) {
    // Show only recent notifications in dropdown
    const recentNotifications = notifications.slice(0, 5);

    return (
        <div
            className={className}
            style={{
                width: '320px',
                backgroundColor: '#111827',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '1px solid #1F2937',
            }}
        >
            <NotificationList
                notifications={recentNotifications}
                onNotificationClick={onNotificationClick}
                onMarkAsRead={onMarkAsRead}
                onMarkAllAsRead={onMarkAllAsRead}
                onArchive={onArchive}
                showFilters={false}
                groupByDate={false}
                maxHeight="300px"
                size="sm"
            />
            {onViewAll && notifications.length > 5 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #1F2937' }}>
                    <button
                        type="button"
                        onClick={onViewAll}
                        style={{
                            width: '100%',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#60A5FA',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#93C5FD';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#60A5FA';
                        }}
                    >
                        View all {notifications.length} notifications
                    </button>
                </div>
            )}
        </div>
    );
}

export default NotificationList;
