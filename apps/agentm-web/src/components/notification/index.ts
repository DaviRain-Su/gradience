/**
 * Notification System Components
 *
 * A complete notification system supporting follow, message, task update, and mention notifications.
 *
 * @module components/notification
 *
 * @example
 * ```tsx
 * import {
 *   NotificationBell,
 *   NotificationList,
 *   NotificationItem,
 *   NotificationSettings,
 *   DEFAULT_NOTIFICATION_SETTINGS,
 * } from '@/components/notification';
 *
 * // Basic usage
 * <NotificationBell
 *   notifications={notifications}
 *   onClick={() => setShowPanel(true)}
 * />
 *
 * // Full notification list
 * <NotificationList
 *   notifications={notifications}
 *   onNotificationClick={handleClick}
 *   onMarkAsRead={handleMarkAsRead}
 *   onMarkAllAsRead={handleMarkAllAsRead}
 * />
 *
 * // Settings panel
 * <NotificationSettings
 *   settings={settings}
 *   onSettingsChange={setSettings}
 * />
 * ```
 */

// Types
export type {
    NotificationType,
    NotificationPriority,
    NotificationStatus,
    AppNotification,
    NotificationMetadata,
    NotificationSettings as NotificationSettingsType,
    NotificationTypeSettings,
    DesktopNotificationSettings,
    EmailNotificationSettings,
    SoundSettings,
} from './types';

export { DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_ICONS, NOTIFICATION_COLORS } from './types';

// Components
export { NotificationBell, CompactNotificationBell, HeaderNotificationBell } from './NotificationBell';
export type { NotificationBellProps } from './NotificationBell';

export { NotificationItem, FollowNotificationItem } from './NotificationItem';
export type { NotificationItemProps } from './NotificationItem';

export { NotificationList, NotificationDropdown } from './NotificationList';
export type { NotificationListProps } from './NotificationList';

export { NotificationSettings, NotificationSettingsCompact } from './NotificationSettings';
export type { NotificationSettingsProps } from './NotificationSettings';
