/**
 * NotificationList Component
 *
 * Displays a list/feed of notifications with filtering and grouping options.
 *
 * @module components/social/notifications/NotificationList
 */

import { useState, useCallback, useMemo } from 'react';
import type { Notification, NotificationType } from './types.ts';
import { NotificationItem } from './NotificationItem.tsx';

export interface NotificationListProps {
    /** Array of notifications to display */
    notifications: Notification[];
    /** Callback when a notification is clicked */
    onNotificationClick?: (notification: Notification) => void;
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
function groupNotificationsByDate(notifications: Notification[]): Map<string, Notification[]> {
    const groups = new Map<string, Notification[]>();
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
            <div className={`flex flex-col ${className}`}>
                <NotificationListHeader unreadCount={0} onMarkAllAsRead={onMarkAllAsRead} onClearAll={onClearAll} />
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col bg-gray-900 rounded-lg ${className}`}>
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
            <div className="flex-1 overflow-y-auto" style={{ maxHeight }}>
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-100">Notifications</h2>
                {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">{unreadCount} new</span>
                )}
            </div>
            <div className="flex items-center gap-2">
                {onMarkAllAsRead && unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={onMarkAllAsRead}
                        className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        Mark all read
                    </button>
                )}
                {onClearAll && (
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
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
    notifications: Notification[];
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
        <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-800 overflow-x-auto">
            {FILTER_OPTIONS.map((option) => {
                const count = counts[option.value] || 0;
                const isActive = activeFilter === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onFilterChange(option.value)}
                        className={`
                            flex items-center gap-1 px-3 py-1.5 text-xs rounded-full
                            transition-colors whitespace-nowrap
                            ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
                        `}
                    >
                        {option.label}
                        {count > 0 && (
                            <span className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
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
    groups: Map<string, Notification[]>;
    onNotificationClick?: (notification: Notification) => void;
    onMarkAsRead?: (id: string) => void;
    onArchive?: (id: string) => void;
    size: 'sm' | 'md' | 'lg';
}) {
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

    return (
        <div className="divide-y divide-gray-800">
            {groupOrder.map((groupKey) => {
                const groupNotifications = groups.get(groupKey);
                if (!groupNotifications || groupNotifications.length === 0) {
                    return null;
                }

                return (
                    <div key={groupKey}>
                        <div className="px-4 py-2 bg-gray-800/50">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                {groupKey}
                            </span>
                        </div>
                        <div className="divide-y divide-gray-800/50">
                            {groupNotifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onClick={onNotificationClick}
                                    onMarkAsRead={onMarkAsRead}
                                    onArchive={onArchive}
                                    size={size}
                                />
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
    notifications: Notification[];
    onNotificationClick?: (notification: Notification) => void;
    onMarkAsRead?: (id: string) => void;
    onArchive?: (id: string) => void;
    size: 'sm' | 'md' | 'lg';
}) {
    return (
        <div className="divide-y divide-gray-800/50">
            {notifications.map((notification) => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={onNotificationClick}
                    onMarkAsRead={onMarkAsRead}
                    onArchive={onArchive}
                    size={size}
                />
            ))}
        </div>
    );
}

/**
 * Empty state
 */
function EmptyNotifications({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
            <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
            </svg>
            <p className="text-gray-500 text-sm">{message}</p>
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
    notifications: Notification[];
    onNotificationClick?: (notification: Notification) => void;
    onMarkAsRead?: (id: string) => void;
    onMarkAllAsRead?: () => void;
    onArchive?: (id: string) => void;
    onViewAll?: () => void;
    className?: string;
}) {
    // Show only recent notifications in dropdown
    const recentNotifications = notifications.slice(0, 5);

    return (
        <div className={`w-80 bg-gray-900 rounded-lg shadow-xl border border-gray-800 ${className}`}>
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
                <div className="px-4 py-3 border-t border-gray-800">
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        View all {notifications.length} notifications
                    </button>
                </div>
            )}
        </div>
    );
}

export default NotificationList;
