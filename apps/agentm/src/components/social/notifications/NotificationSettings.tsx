/**
 * NotificationSettings Component
 *
 * User preferences panel for configuring notification behavior.
 *
 * @module components/social/notifications/NotificationSettings
 */

import { useState, useCallback } from 'react';
import type {
    NotificationSettings as NotificationSettingsType,
    NotificationType,
    NotificationPriority,
} from './types.ts';
import { DEFAULT_NOTIFICATION_SETTINGS } from './types.ts';

export interface NotificationSettingsProps {
    /** Current notification settings */
    settings: NotificationSettingsType;
    /** Callback when settings change */
    onSettingsChange: (settings: NotificationSettingsType) => void;
    /** Optional className for custom styling */
    className?: string;
    /** Show advanced settings */
    showAdvanced?: boolean;
}

/**
 * Priority label mapping
 */
const PRIORITY_LABELS: Record<NotificationPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
};

/**
 * Notification type labels
 */
const TYPE_LABELS: Record<NotificationType, { label: string; description: string; icon: string }> = {
    follow: {
        label: 'New Followers',
        description: 'When someone starts following you',
        icon: '👤',
    },
    message: {
        label: 'Messages',
        description: 'New direct messages',
        icon: '💬',
    },
    task_update: {
        label: 'Task Updates',
        description: 'Status changes on your tasks',
        icon: '📋',
    },
    mention: {
        label: 'Mentions',
        description: 'When someone mentions you',
        icon: '@',
    },
};

/**
 * NotificationSettings - Preferences panel
 */
export function NotificationSettings({
    settings,
    onSettingsChange,
    className = '',
    showAdvanced = true,
}: NotificationSettingsProps) {
    const [expandedSection, setExpandedSection] = useState<string | null>('types');

    const handleGlobalToggle = useCallback(
        (enabled: boolean) => {
            onSettingsChange({ ...settings, enabled });
        },
        [settings, onSettingsChange],
    );

    const handleTypeToggle = useCallback(
        (type: NotificationType, enabled: boolean) => {
            onSettingsChange({
                ...settings,
                types: {
                    ...settings.types,
                    [type]: {
                        ...settings.types[type],
                        enabled,
                    },
                },
            });
        },
        [settings, onSettingsChange],
    );

    const handleTypePriority = useCallback(
        (type: NotificationType, priority: NotificationPriority) => {
            onSettingsChange({
                ...settings,
                types: {
                    ...settings.types,
                    [type]: {
                        ...settings.types[type],
                        priority,
                    },
                },
            });
        },
        [settings, onSettingsChange],
    );

    const handleDesktopToggle = useCallback(
        (enabled: boolean) => {
            onSettingsChange({
                ...settings,
                desktop: { ...settings.desktop, enabled },
            });
        },
        [settings, onSettingsChange],
    );

    const handleDesktopFocusedToggle = useCallback(
        (showWhenFocused: boolean) => {
            onSettingsChange({
                ...settings,
                desktop: { ...settings.desktop, showWhenFocused },
            });
        },
        [settings, onSettingsChange],
    );

    const handleSoundToggle = useCallback(
        (enabled: boolean) => {
            onSettingsChange({
                ...settings,
                sound: { ...settings.sound, enabled },
            });
        },
        [settings, onSettingsChange],
    );

    const handleSoundVolume = useCallback(
        (volume: number) => {
            onSettingsChange({
                ...settings,
                sound: { ...settings.sound, volume },
            });
        },
        [settings, onSettingsChange],
    );

    const handleEmailDigest = useCallback(
        (digest: 'instant' | 'daily' | 'weekly' | 'never') => {
            onSettingsChange({
                ...settings,
                email: {
                    ...settings.email,
                    enabled: digest !== 'never',
                    digest,
                },
            });
        },
        [settings, onSettingsChange],
    );

    const toggleSection = useCallback((section: string) => {
        setExpandedSection((prev) => (prev === section ? null : section));
    }, []);

    const handleResetToDefaults = useCallback(() => {
        onSettingsChange(DEFAULT_NOTIFICATION_SETTINGS);
    }, [onSettingsChange]);

    return (
        <div className={`bg-gray-900 rounded-lg ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-gray-100">Notification Settings</h2>
                <p className="text-sm text-gray-400 mt-1">
                    Customize how and when you receive notifications
                </p>
            </div>

            {/* Global toggle */}
            <div className="px-4 py-4 border-b border-gray-800">
                <ToggleRow
                    label="Enable Notifications"
                    description="Turn all notifications on or off"
                    enabled={settings.enabled}
                    onChange={handleGlobalToggle}
                />
            </div>

            {/* Settings sections */}
            <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
                {/* Notification Types */}
                <SettingsSection
                    title="Notification Types"
                    description="Choose which notifications you want to receive"
                    expanded={expandedSection === 'types'}
                    onToggle={() => toggleSection('types')}
                >
                    <div className="space-y-4">
                        {(Object.keys(TYPE_LABELS) as NotificationType[]).map((type) => (
                            <TypeSettingRow
                                key={type}
                                type={type}
                                typeConfig={TYPE_LABELS[type]}
                                settings={settings.types[type]}
                                onToggle={(enabled) => handleTypeToggle(type, enabled)}
                                onPriorityChange={(priority) => handleTypePriority(type, priority)}
                            />
                        ))}
                    </div>
                </SettingsSection>

                {/* Desktop Notifications */}
                {showAdvanced && (
                    <SettingsSection
                        title="Desktop Notifications"
                        description="Browser and system notifications"
                        expanded={expandedSection === 'desktop'}
                        onToggle={() => toggleSection('desktop')}
                    >
                        <div className="space-y-4">
                            <ToggleRow
                                label="Desktop notifications"
                                description="Show system notifications"
                                enabled={settings.desktop.enabled}
                                onChange={handleDesktopToggle}
                            />
                            {settings.desktop.enabled && (
                                <ToggleRow
                                    label="Show when focused"
                                    description="Show notifications even when app is focused"
                                    enabled={settings.desktop.showWhenFocused}
                                    onChange={handleDesktopFocusedToggle}
                                />
                            )}
                        </div>
                    </SettingsSection>
                )}

                {/* Sound */}
                {showAdvanced && (
                    <SettingsSection
                        title="Sound"
                        description="Notification sounds"
                        expanded={expandedSection === 'sound'}
                        onToggle={() => toggleSection('sound')}
                    >
                        <div className="space-y-4">
                            <ToggleRow
                                label="Enable sounds"
                                description="Play a sound for notifications"
                                enabled={settings.sound.enabled}
                                onChange={handleSoundToggle}
                            />
                            {settings.sound.enabled && (
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-400 w-24">Volume</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={settings.sound.volume}
                                        onChange={(e) =>
                                            handleSoundVolume(parseInt(e.target.value, 10))
                                        }
                                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-400 w-10">
                                        {settings.sound.volume}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </SettingsSection>
                )}

                {/* Email */}
                {showAdvanced && (
                    <SettingsSection
                        title="Email Notifications"
                        description="Receive notifications via email"
                        expanded={expandedSection === 'email'}
                        onToggle={() => toggleSection('email')}
                    >
                        <div className="space-y-3">
                            <p className="text-sm text-gray-400">Email digest frequency:</p>
                            <div className="flex flex-wrap gap-2">
                                {(['never', 'instant', 'daily', 'weekly'] as const).map(
                                    (option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => handleEmailDigest(option)}
                                            className={`
                                                px-3 py-1.5 text-sm rounded-lg transition-colors
                                                ${
                                                    settings.email.digest === option
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                }
                                            `}
                                        >
                                            {option.charAt(0).toUpperCase() + option.slice(1)}
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>
                    </SettingsSection>
                )}
            </div>

            {/* Reset button */}
            <div className="px-4 py-4 border-t border-gray-800">
                <button
                    type="button"
                    onClick={handleResetToDefaults}
                    className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                    Reset to defaults
                </button>
            </div>
        </div>
    );
}

/**
 * Collapsible settings section
 */
function SettingsSection({
    title,
    description,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    description: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="border-b border-gray-800">
            <button
                type="button"
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
                <div className="text-left">
                    <h3 className="text-sm font-medium text-gray-200">{title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                        expanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>
            {expanded && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
}

/**
 * Toggle row component
 */
function ToggleRow({
    label,
    description,
    enabled,
    onChange,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <span className="text-sm font-medium text-gray-200">{label}</span>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
            <Toggle enabled={enabled} onChange={onChange} />
        </div>
    );
}

/**
 * Toggle switch component
 */
function Toggle({
    enabled,
    onChange,
}: {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onChange(!enabled)}
            className={`
                relative w-11 h-6 rounded-full transition-colors
                ${enabled ? 'bg-blue-600' : 'bg-gray-700'}
            `}
        >
            <span
                className={`
                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full
                    transition-transform shadow-sm
                    ${enabled ? 'translate-x-5' : 'translate-x-0'}
                `}
            />
        </button>
    );
}

/**
 * Type-specific setting row
 */
function TypeSettingRow({
    type,
    typeConfig,
    settings,
    onToggle,
    onPriorityChange,
}: {
    type: NotificationType;
    typeConfig: { label: string; description: string; icon: string };
    settings: { enabled: boolean; priority: NotificationPriority };
    onToggle: (enabled: boolean) => void;
    onPriorityChange: (priority: NotificationPriority) => void;
}) {
    return (
        <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
            <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-lg">
                {typeConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200">{typeConfig.label}</span>
                    <Toggle enabled={settings.enabled} onChange={onToggle} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{typeConfig.description}</p>
                {settings.enabled && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Priority:</span>
                        <div className="flex gap-1">
                            {(['low', 'medium', 'high'] as NotificationPriority[]).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => onPriorityChange(p)}
                                    className={`
                                        px-2 py-0.5 text-xs rounded transition-colors
                                        ${
                                            settings.priority === p
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }
                                    `}
                                >
                                    {PRIORITY_LABELS[p]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Compact settings panel for quick access
 */
export function NotificationSettingsCompact({
    settings,
    onSettingsChange,
    className = '',
}: {
    settings: NotificationSettingsType;
    onSettingsChange: (settings: NotificationSettingsType) => void;
    className?: string;
}) {
    const handleGlobalToggle = useCallback(
        (enabled: boolean) => {
            onSettingsChange({ ...settings, enabled });
        },
        [settings, onSettingsChange],
    );

    const handleSoundToggle = useCallback(
        (enabled: boolean) => {
            onSettingsChange({
                ...settings,
                sound: { ...settings.sound, enabled },
            });
        },
        [settings, onSettingsChange],
    );

    return (
        <div className={`p-4 bg-gray-900 rounded-lg space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Notifications</span>
                <Toggle enabled={settings.enabled} onChange={handleGlobalToggle} />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Sound</span>
                <Toggle enabled={settings.sound.enabled} onChange={handleSoundToggle} />
            </div>
        </div>
    );
}

export default NotificationSettings;
