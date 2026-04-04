/**
 * useNotifications Hook
 *
 * Manages notification state and browser notification API integration.
 * Provides functionality for adding, removing, marking as read, and
 * requesting browser notification permissions.
 *
 * @module hooks/useNotifications
 *
 * @example
 * ```tsx
 * const {
 *   notifications,
 *   settings,
 *   unreadCount,
 *   addNotification,
 *   markAsRead,
 *   markAllAsRead,
 *   archiveNotification,
 *   requestPermission,
 *   showBrowserNotification,
 * } = useNotifications();
 * ```
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
    AppNotification,
    NotificationType,
    NotificationPriority,
    NotificationSettings,
} from '@/components/notification/types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/components/notification/types';

// Generate unique ID
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface UseNotificationsReturn {
    /** List of all notifications */
    notifications: AppNotification[];
    /** Current notification settings */
    settings: NotificationSettings;
    /** Number of unread notifications */
    unreadCount: number;
    /** Browser notification permission status */
    browserPermission: NotificationPermission;
    /** Add a new notification */
    addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'status'>) => AppNotification;
    /** Mark a notification as read */
    markAsRead: (id: string) => void;
    /** Mark all notifications as read */
    markAllAsRead: () => void;
    /** Archive/dismiss a notification */
    archiveNotification: (id: string) => void;
    /** Clear all archived notifications */
    clearArchived: () => void;
    /** Update notification settings */
    updateSettings: (settings: NotificationSettings) => void;
    /** Request browser notification permission */
    requestPermission: () => Promise<NotificationPermission>;
    /** Show a browser notification */
    showBrowserNotification: (title: string, options?: NotificationOptions) => void;
    /** Check if notifications are supported */
    isSupported: boolean;
}

/**
 * Hook for managing notifications
 */
export function useNotifications(): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(false);

    // Check browser support and permission on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setIsSupported(true);
            setBrowserPermission(Notification.permission);
        }
    }, []);

    // Calculate unread count
    const unreadCount = useMemo(() => {
        return notifications.filter((n) => !n.read && n.status !== 'archived').length;
    }, [notifications]);

    /**
     * Add a new notification
     */
    const addNotification = useCallback((
        notification: Omit<AppNotification, 'id' | 'createdAt' | 'status'>
    ): AppNotification => {
        // Check if this notification type is enabled
        if (!settings.enabled) {
            console.log('[useNotifications] Notifications disabled globally');
            return { ...notification, id: '', createdAt: Date.now(), status: 'unread' } as AppNotification;
        }

        const typeSettings = settings.types[notification.type];
        if (!typeSettings?.enabled) {
            console.log(`[useNotifications] ${notification.type} notifications disabled`);
            return { ...notification, id: '', createdAt: Date.now(), status: 'unread' } as AppNotification;
        }

        const newNotification: AppNotification = {
            ...notification,
            id: generateId(),
            createdAt: Date.now(),
            status: 'unread',
        };

        setNotifications((prev) => [newNotification, ...prev]);

        // Show browser notification if enabled and permission granted
        if (settings.desktop.enabled && browserPermission === 'granted') {
            showBrowserNotification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: newNotification.id,
            });
        }

        return newNotification;
    }, [settings, browserPermission]);

    /**
     * Mark a notification as read
     */
    const markAsRead = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === id ? { ...n, read: true, status: 'read' as const } : n
            )
        );
    }, []);

    /**
     * Mark all notifications as read
     */
    const markAllAsRead = useCallback(() => {
        setNotifications((prev) =>
            prev.map((n) =>
                !n.read ? { ...n, read: true, status: 'read' as const } : n
            )
        );
    }, []);

    /**
     * Archive/dismiss a notification
     */
    const archiveNotification = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === id ? { ...n, status: 'archived' as const } : n
            )
        );
    }, []);

    /**
     * Clear all archived notifications
     */
    const clearArchived = useCallback(() => {
        setNotifications((prev) => prev.filter((n) => n.status !== 'archived'));
    }, []);

    /**
     * Update notification settings
     */
    const updateSettings = useCallback((newSettings: NotificationSettings) => {
        setSettings(newSettings);
    }, []);

    /**
     * Request browser notification permission
     */
    const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!isSupported) {
            console.warn('[useNotifications] Browser notifications not supported');
            return 'denied';
        }

        try {
            const permission = await Notification.requestPermission();
            setBrowserPermission(permission);
            return permission;
        } catch (error) {
            console.error('[useNotifications] Error requesting permission:', error);
            return 'denied';
        }
    }, [isSupported]);

    /**
     * Show a browser notification
     */
    const showBrowserNotification = useCallback((title: string, options?: NotificationOptions) => {
        if (!isSupported) {
            console.warn('[useNotifications] Browser notifications not supported');
            return;
        }

        if (browserPermission !== 'granted') {
            console.warn('[useNotifications] Notification permission not granted');
            return;
        }

        // Check if we should show when focused
        if (!settings.desktop.showWhenFocused && document.visibilityState === 'visible') {
            return;
        }

        try {
            new Notification(title, {
                icon: '/favicon.ico',
                ...options,
            });
        } catch (error) {
            console.error('[useNotifications] Error showing notification:', error);
        }
    }, [isSupported, browserPermission, settings.desktop.showWhenFocused]);

    return {
        notifications,
        settings,
        unreadCount,
        browserPermission,
        addNotification,
        markAsRead,
        markAllAsRead,
        archiveNotification,
        clearArchived,
        updateSettings,
        requestPermission,
        showBrowserNotification,
        isSupported,
    };
}

/**
 * Hook for creating notification with type-specific helpers
 */
export function useNotificationHelpers() {
    const { addNotification } = useNotifications();

    const notifyFollow = useCallback((actorName: string, actorAddress?: string) => {
        return addNotification({
            type: 'follow',
            title: `${actorName} started following you`,
            message: 'You have a new follower!',
            read: false,
            priority: 'medium',
            actorName,
            actorAddress,
        });
    }, [addNotification]);

    const notifyMessage = useCallback((actorName: string, messagePreview: string, actorAddress?: string) => {
        return addNotification({
            type: 'message',
            title: `New message from ${actorName}`,
            message: 'You have a new message',
            read: false,
            priority: 'high',
            actorName,
            actorAddress,
            metadata: { messagePreview },
        });
    }, [addNotification]);

    const notifyTaskUpdate = useCallback((taskTitle: string, taskState: string, taskReward?: number) => {
        return addNotification({
            type: 'task_update',
            title: `Task update: ${taskTitle}`,
            message: `Task status changed to ${taskState}`,
            read: false,
            priority: 'high',
            metadata: { taskTitle, taskState, taskReward },
        });
    }, [addNotification]);

    const notifyMention = useCallback((actorName: string, mentionContext: string, sourceType: 'message' | 'task' | 'profile', actorAddress?: string) => {
        return addNotification({
            type: 'mention',
            title: `${actorName} mentioned you`,
            message: `You were mentioned in ${sourceType}`,
            read: false,
            priority: 'high',
            actorName,
            actorAddress,
            metadata: { mentionContext, sourceType },
        });
    }, [addNotification]);

    return {
        notifyFollow,
        notifyMessage,
        notifyTaskUpdate,
        notifyMention,
    };
}

export default useNotifications;
