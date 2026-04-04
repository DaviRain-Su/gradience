/**
 * Notification Types
 *
 * Type definitions for the notification system.
 *
 * @module components/notification/types
 */

/** Supported notification types */
export type NotificationType = 'follow' | 'message' | 'task_update' | 'mention';

/** Notification priority levels */
export type NotificationPriority = 'low' | 'medium' | 'high';

/** Notification status */
export type NotificationStatus = 'unread' | 'read' | 'archived';

/**
 * Base notification structure
 */
export interface AppNotification {
    /** Unique notification ID */
    id: string;
    /** Type of notification */
    type: NotificationType;
    /** Notification title */
    title: string;
    /** Notification message/body */
    message: string;
    /** Timestamp when notification was created */
    createdAt: number;
    /** Whether notification has been read */
    read: boolean;
    /** Notification status */
    status: NotificationStatus;
    /** Priority level */
    priority: NotificationPriority;
    /** Optional link/action URL */
    actionUrl?: string;
    /** Agent address related to this notification (sender/actor) */
    actorAddress?: string;
    /** Actor display name */
    actorName?: string;
    /** Additional metadata based on notification type */
    metadata?: NotificationMetadata;
}

/**
 * Notification metadata for type-specific data
 */
export interface NotificationMetadata {
    /** For follow notifications */
    followedAt?: number;
    followerCount?: number;

    /** For message notifications */
    conversationId?: string;
    messagePreview?: string;
    messageId?: string;

    /** For task update notifications */
    taskId?: number;
    taskState?: string;
    taskReward?: number;
    taskTitle?: string;

    /** For mention notifications */
    mentionContext?: string;
    sourceType?: 'message' | 'task' | 'profile';
    sourceId?: string;
}

/**
 * User notification preferences
 */
export interface NotificationSettings {
    /** Enable/disable all notifications */
    enabled: boolean;
    /** Per-type notification preferences */
    types: NotificationTypeSettings;
    /** Desktop notification settings */
    desktop: DesktopNotificationSettings;
    /** Email notification settings */
    email: EmailNotificationSettings;
    /** Sound settings */
    sound: SoundSettings;
}

/**
 * Per-type notification settings
 */
export interface NotificationTypeSettings {
    follow: {
        enabled: boolean;
        priority: NotificationPriority;
    };
    message: {
        enabled: boolean;
        priority: NotificationPriority;
        showPreview: boolean;
    };
    task_update: {
        enabled: boolean;
        priority: NotificationPriority;
        states: string[]; // which task states to notify on
    };
    mention: {
        enabled: boolean;
        priority: NotificationPriority;
    };
}

/**
 * Desktop notification settings
 */
export interface DesktopNotificationSettings {
    enabled: boolean;
    showWhenFocused: boolean;
}

/**
 * Email notification settings
 */
export interface EmailNotificationSettings {
    enabled: boolean;
    digest: 'instant' | 'daily' | 'weekly' | 'never';
}

/**
 * Sound notification settings
 */
export interface SoundSettings {
    enabled: boolean;
    volume: number; // 0-100
}

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    types: {
        follow: {
            enabled: true,
            priority: 'medium',
        },
        message: {
            enabled: true,
            priority: 'high',
            showPreview: true,
        },
        task_update: {
            enabled: true,
            priority: 'high',
            states: ['completed', 'refunded', 'judged'],
        },
        mention: {
            enabled: true,
            priority: 'high',
        },
    },
    desktop: {
        enabled: true,
        showWhenFocused: false,
    },
    email: {
        enabled: false,
        digest: 'never',
    },
    sound: {
        enabled: true,
        volume: 50,
    },
};

/**
 * Notification icon mapping
 */
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
    follow: '👤',
    message: '💬',
    task_update: '📋',
    mention: '@',
};

/**
 * Notification color mapping (hex colors for inline styles)
 */
export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
    follow: '#3B82F6', // blue-500
    message: '#22C55E', // green-500
    task_update: '#A855F7', // purple-500
    mention: '#F97316', // orange-500
};
