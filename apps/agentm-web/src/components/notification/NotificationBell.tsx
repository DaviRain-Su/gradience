/**
 * NotificationBell Component
 *
 * Displays notification indicator with unread count badge.
 * Supports various sizes and can trigger notification panel.
 *
 * @module components/notification/NotificationBell
 */

import { useState, useCallback } from 'react';
import type { AppNotification, NotificationType } from './types';

export interface NotificationBellProps {
    /** List of notifications to count */
    notifications: AppNotification[];
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
        bell: { width: '20px', height: '20px' },
        badge: { minWidth: '14px', height: '14px', fontSize: '9px', top: '-4px', right: '-4px' },
        dot: { width: '8px', height: '8px', top: '-2px', right: '-2px' },
    },
    md: {
        bell: { width: '24px', height: '24px' },
        badge: { minWidth: '16px', height: '16px', fontSize: '10px', top: '-4px', right: '-4px' },
        dot: { width: '10px', height: '10px', top: '-2px', right: '-2px' },
    },
    lg: {
        bell: { width: '32px', height: '32px' },
        badge: { minWidth: '20px', height: '20px', fontSize: '12px', top: '-6px', right: '-6px' },
        dot: { width: '12px', height: '12px', top: '-4px', right: '-4px' },
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

    const buttonStyle: React.CSSProperties = {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: isOpen ? 'rgba(55, 65, 81, 0.5)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    };

    const bellStyle: React.CSSProperties = {
        width: config.bell.width,
        height: config.bell.height,
        color: isHovered ? '#FFFFFF' : '#D1D5DB',
        transition: 'color 0.2s ease',
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={className}
            style={buttonStyle}
            onMouseOver={(e) => {
                if (!isOpen) e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = isOpen ? 'rgba(55, 65, 81, 0.5)' : 'transparent';
            }}
            aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ''}`}
            aria-haspopup="true"
            aria-expanded={isOpen}
        >
            {/* Bell Icon */}
            <svg
                style={bellStyle}
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
                        style={{
                            position: 'absolute',
                            borderRadius: '50%',
                            backgroundColor: '#EF4444',
                            width: config.dot.width,
                            height: config.dot.height,
                            top: config.dot.top,
                            right: config.dot.right,
                            animation: animate ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
                        }}
                        aria-hidden="true"
                    />
                ) : (
                    <span
                        style={{
                            position: 'absolute',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '9999px',
                            backgroundColor: '#EF4444',
                            color: '#FFFFFF',
                            fontWeight: 500,
                            padding: '0 4px',
                            minWidth: config.badge.minWidth,
                            height: config.badge.height,
                            fontSize: config.badge.fontSize,
                            top: config.badge.top,
                            right: config.badge.right,
                            animation: animate ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
                        }}
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
    notifications: AppNotification[];
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
    notifications: AppNotification[];
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
