/**
 * NotificationSettings Component
 *
 * User preferences panel for configuring notification behavior.
 *
 * @module components/notification/NotificationSettings
 */

import { useState, useCallback } from 'react';
import type {
    NotificationSettings as NotificationSettingsType,
    NotificationType,
    NotificationPriority,
} from './types';
import { DEFAULT_NOTIFICATION_SETTINGS } from './types';

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

    const containerStyle: React.CSSProperties = {
        backgroundColor: '#111827',
        borderRadius: '8px',
    };

    return (
        <div className={className} style={containerStyle}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #1F2937',
            }}>
                <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#F3F4F6',
                    margin: 0,
                }}>Notification Settings</h2>
                <p style={{
                    fontSize: '14px',
                    color: '#9CA3AF',
                    margin: '4px 0 0 0',
                }}>
                    Customize how and when you receive notifications
                </p>
            </div>

            {/* Global toggle */}
            <div style={{ padding: '16px', borderBottom: '1px solid #1F2937' }}>
                <ToggleRow
                    label="Enable Notifications"
                    description="Turn all notifications on or off"
                    enabled={settings.enabled}
                    onChange={handleGlobalToggle}
                />
            </div>

            {/* Settings sections */}
            <div style={settings.enabled ? {} : { opacity: 0.5, pointerEvents: 'none' }}>
                {/* Notification Types */}
                <SettingsSection
                    title="Notification Types"
                    description="Choose which notifications you want to receive"
                    expanded={expandedSection === 'types'}
                    onToggle={() => toggleSection('types')}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <ToggleRow
                                label="Enable sounds"
                                description="Play a sound for notifications"
                                enabled={settings.sound.enabled}
                                onChange={handleSoundToggle}
                            />
                            {settings.sound.enabled && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={{ fontSize: '14px', color: '#9CA3AF', width: '60px' }}>Volume</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={settings.sound.volume}
                                        onChange={(e) =>
                                            handleSoundVolume(parseInt(e.target.value, 10))
                                        }
                                        style={{
                                            flex: 1,
                                            height: '8px',
                                            backgroundColor: '#374151',
                                            borderRadius: '8px',
                                            appearance: 'none',
                                            cursor: 'pointer',
                                        }}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9CA3AF', width: '40px' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>Email digest frequency:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(['never', 'instant', 'daily', 'weekly'] as const).map(
                                    (option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => handleEmailDigest(option)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '14px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                backgroundColor: settings.email.digest === option ? '#2563EB' : '#1F2937',
                                                color: settings.email.digest === option ? '#FFFFFF' : '#9CA3AF',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (settings.email.digest !== option) {
                                                    e.currentTarget.style.backgroundColor = '#374151';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (settings.email.digest !== option) {
                                                    e.currentTarget.style.backgroundColor = '#1F2937';
                                                }
                                            }}
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
            <div style={{ padding: '16px', borderTop: '1px solid #1F2937' }}>
                <button
                    type="button"
                    onClick={handleResetToDefaults}
                    style={{
                        fontSize: '14px',
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
        <div style={{ borderBottom: '1px solid #1F2937' }}>
            <button
                type="button"
                onClick={onToggle}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <div style={{ textAlign: 'left' }}>
                    <h3 style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#E5E7EB',
                        margin: 0,
                    }}>{title}</h3>
                    <p style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: '2px 0 0 0',
                    }}>{description}</p>
                </div>
                <svg
                    style={{
                        width: '20px',
                        height: '20px',
                        color: '#6B7280',
                        transition: 'transform 0.2s ease',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
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
            {expanded && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
                <span style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#E5E7EB',
                }}>{label}</span>
                <p style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    margin: '2px 0 0 0',
                }}>{description}</p>
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
            style={{
                position: 'relative',
                width: '44px',
                height: '24px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                backgroundColor: enabled ? '#2563EB' : '#374151',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: 'transform 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    transform: enabled ? 'translateX(20px)' : 'translateX(0)',
                }}
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
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'rgba(31, 41, 55, 0.3)',
            borderRadius: '8px',
        }}>
            <div style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#374151',
                borderRadius: '50%',
                fontSize: '18px',
            }}>
                {typeConfig.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#E5E7EB',
                    }}>{typeConfig.label}</span>
                    <Toggle enabled={settings.enabled} onChange={onToggle} />
                </div>
                <p style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    margin: '2px 0 0 0',
                }}>{typeConfig.description}</p>
                {settings.enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>Priority:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {(['low', 'medium', 'high'] as NotificationPriority[]).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => onPriorityChange(p)}
                                    style={{
                                        padding: '2px 8px',
                                        fontSize: '12px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        backgroundColor: settings.priority === p ? '#2563EB' : '#374151',
                                        color: settings.priority === p ? '#FFFFFF' : '#9CA3AF',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (settings.priority !== p) {
                                            e.currentTarget.style.backgroundColor = '#4B5563';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (settings.priority !== p) {
                                            e.currentTarget.style.backgroundColor = '#374151';
                                        }
                                    }}
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

    const handleDesktopToggle = useCallback(
        (enabled: boolean) => {
            onSettingsChange({
                ...settings,
                desktop: { ...settings.desktop, enabled },
            });
        },
        [settings, onSettingsChange],
    );

    return (
        <div className={className} style={{
            backgroundColor: '#111827',
            borderRadius: '8px',
            padding: '16px',
        }}>
            <h3 style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#E5E7EB',
                margin: '0 0 12px 0',
            }}>
                Quick Settings
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ToggleRow
                    label="Enable Notifications"
                    description="Turn all notifications on or off"
                    enabled={settings.enabled}
                    onChange={handleGlobalToggle}
                />
                <ToggleRow
                    label="Desktop Notifications"
                    description="Show browser notifications"
                    enabled={settings.desktop.enabled}
                    onChange={handleDesktopToggle}
                />
            </div>
        </div>
    );
}

export default NotificationSettings;
