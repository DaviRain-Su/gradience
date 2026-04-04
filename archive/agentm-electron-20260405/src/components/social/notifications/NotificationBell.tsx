/**
 * NotificationBell Component
 *
 * Displays notification indicator with unread count badge.
 * Supports various sizes and can trigger notification panel.
 *
 * @module components/social/notifications/NotificationBell
 */

import { useState, useCallback } from 'react';
import type { Notification, NotificationType } from './types.ts';

export interface NotificationBellProps {
    /** List of notifications to count */
    notifications: Notification[];
    /** Callback when bell is clicked */
    onClick?: () => void;
    /** Badge size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Maximum number to display (e.g., 99+) */
    maxCount?: number;
    /** Optional className for custom styling */
    className?: string;
    /** Show dot instead of count */
    dotOnly?: boolean;
    /** Filter by notification types for count */
    filterTypes?: NotificationType[];
    /** Whether the notification panel is open */
    isOpen?: boolean;
    /** Show animation when new notification arrives */
    animate?: boolean;
}

/**
 * Size configuration for bell variants
 */
const sizeConfig = {
    sm: {
        bell: 'w-5 h-5',
        badge: 'min-w-[0.875rem] h-3.5 text-[9px] -top-1 -right-1',
        dot: 'w-2 h-2 -top-0.5 -right-0.5',
    },
    md: {
        bell: 'w-6 h-6',
        badge: 'min-w-[1rem] h-4 text-[10px] -top-1 -right-1',
        dot: 'w-2.5 h-2.5 -top-0.5 -right-0.5',
    },
    lg: {
        bell: 'w-8 h-8',
        badge: 'min-w-[1.25rem] h-5 text-xs -top-1.5 -right-1.5',
        dot: 'w-3 h-3 -top-1 -right-1',
    },
};

/**
 * NotificationBell - Bell icon with unread notification badge
 */
export function NotificationBell({
    notifications,
    onClick,
    size = 'md',
    maxCount = 99,
    className = '',
    dotOnly = false,
    filterTypes,
    isOpen = false,
    animate = true,
}: NotificationBellProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Calculate unread count
    const unreadCount = notifications.filter((n) => {
        if (!n.read) {
            if (filterTypes && filterTypes.length > 0) {
                return filterTypes.includes(n.type);
            }
            return true;
        }
        return false;
    }).length;

    const handleClick = useCallback(() => {
        onClick?.();
    }, [onClick]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
            }
        },
        [onClick],
    );

    // Format count display
    const displayCount = unreadCount > maxCount ? `${maxCount}+` : String(unreadCount);

    const hasUnread = unreadCount > 0;
    const config = sizeConfig[size];

    return (
        <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                relative inline-flex items-center justify-center
                p-2 rounded-lg transition-colors
                hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isOpen ? 'bg-gray-700/50' : ''}
                ${className}
            `}
            aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ''}`}
            aria-haspopup="true"
            aria-expanded={isOpen}
        >
            {/* Bell Icon */}
            <svg
                className={`
                    ${config.bell} text-gray-300
                    ${isHovered ? 'text-white' : ''}
                    ${hasUnread && animate ? 'animate-pulse' : ''}
                    transition-colors
                `}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
            </svg>

            {/* Badge */}
            {hasUnread && (
                dotOnly ? (
                    <span
                        className={`
                            absolute rounded-full bg-red-500
                            ${config.dot}
                            ${animate ? 'animate-pulse' : ''}
                        `}
                        aria-hidden="true"
                    />
                ) : (
                    <span
                        className={`
                            absolute inline-flex items-center justify-center
                            rounded-full bg-red-500 text-white font-medium
                            px-1 ${config.badge}
                            ${animate ? 'animate-pulse' : ''}
                        `}
                        aria-hidden="true"
                    >
                        {displayCount}
                    </span>
                )
            )}
        </button>
    );
}

/**
 * CompactNotificationBell - Smaller bell for tight spaces
 */
export function CompactNotificationBell({
    notifications,
    onClick,
    className = '',
}: {
    notifications: Notification[];
    onClick?: () => void;
    className?: string;
}) {
    return (
        <NotificationBell
            notifications={notifications}
            onClick={onClick}
            size="sm"
            dotOnly
            className={className}
        />
    );
}

/**
 * HeaderNotificationBell - Bell styled for header/navbar
 */
export function HeaderNotificationBell({
    notifications,
    onClick,
    isOpen = false,
    className = '',
}: {
    notifications: Notification[];
    onClick?: () => void;
    isOpen?: boolean;
    className?: string;
}) {
    return (
        <NotificationBell
            notifications={notifications}
            onClick={onClick}
            size="md"
            isOpen={isOpen}
            className={className}
        />
    );
}

export default NotificationBell;
