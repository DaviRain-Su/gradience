/**
 * Notification System Components
 *
 * A complete notification system supporting follow, message, task update, and mention notifications.
 *
 * @module components/social/notifications
 *
 * @example
 * ```tsx
 * import {
 *   NotificationBell,
 *   NotificationList,
 *   NotificationItem,
 *   NotificationSettings,
 *   DEFAULT_NOTIFICATION_SETTINGS,
 * } from './components/social/notifications';
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
    Notification,
    NotificationMetadata,
    NotificationSettings as NotificationSettingsType,
    NotificationTypeSettings,
    DesktopNotificationSettings,
    EmailNotificationSettings,
    SoundSettings,
} from './types.ts';

export { DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_ICONS, NOTIFICATION_COLORS } from './types.ts';

// Components
export { NotificationBell, CompactNotificationBell, HeaderNotificationBell } from './NotificationBell.tsx';
export type { NotificationBellProps } from './NotificationBell.tsx';

export { NotificationItem, FollowNotificationItem } from './NotificationItem.tsx';
export type { NotificationItemProps } from './NotificationItem.tsx';

export { NotificationList, NotificationDropdown } from './NotificationList.tsx';
export type { NotificationListProps } from './NotificationList.tsx';

export { NotificationSettings, NotificationSettingsCompact } from './NotificationSettings.tsx';
export type { NotificationSettingsProps } from './NotificationSettings.tsx';
