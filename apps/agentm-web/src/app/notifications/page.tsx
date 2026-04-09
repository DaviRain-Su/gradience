'use client';

import { useState, useCallback } from 'react';
import {
    NotificationBell,
    NotificationList,
    NotificationDropdown,
    NotificationSettings,
    NotificationSettingsCompact,
    DEFAULT_NOTIFICATION_SETTINGS,
    type AppNotification,
    type NotificationSettings as NotificationSettingsType,
} from '@/components/notification';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationsDemoPage() {
    const {
        notifications,
        settings,
        unreadCount,
        browserPermission,
        addNotification,
        markAsRead,
        markAllAsRead,
        archiveNotification,
        updateSettings,
        requestPermission,
        isSupported,
    } = useNotifications();

    const [showDropdown, setShowDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');

    // Generate sample notifications
    const addSampleFollow = useCallback(() => {
        addNotification({
            type: 'follow',
            title: 'New follower',
            message: 'Someone started following you!',
            read: false,
            priority: 'medium',
            actorName: 'Alice Agent',
            actorAddress: '0x1234...5678',
        });
    }, [addNotification]);

    const addSampleMessage = useCallback(() => {
        addNotification({
            type: 'message',
            title: 'New message',
            message: 'You have a new direct message',
            read: false,
            priority: 'high',
            actorName: 'Bob Builder',
            actorAddress: '0xabcd...efgh',
            metadata: { messagePreview: 'Hey, I want to collaborate on a project...' },
        });
    }, [addNotification]);

    const addSampleTask = useCallback(() => {
        addNotification({
            type: 'task_update',
            title: 'Task completed',
            message: 'Your task has been completed successfully',
            read: false,
            priority: 'high',
            metadata: {
                taskTitle: 'Design System Update',
                taskState: 'completed',
                taskReward: 0.5,
            },
        });
    }, [addNotification]);

    const addSampleMention = useCallback(() => {
        addNotification({
            type: 'mention',
            title: 'You were mentioned',
            message: 'Someone mentioned you in a conversation',
            read: false,
            priority: 'high',
            actorName: 'Carol Creator',
            actorAddress: '0x9999...0000',
            metadata: {
                mentionContext: 'Great work on the proposal',
                sourceType: 'message',
            },
        });
    }, [addNotification]);

    const handleRequestPermission = useCallback(async () => {
        const permission = await requestPermission();
        alert(`Browser notification permission: ${permission}`);
    }, [requestPermission]);

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                padding: '24px',
            }}
        >
            <div
                style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                }}
            >
                <h1
                    style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '32px',
                        fontWeight: 700,
                        color: '#16161A',
                        marginBottom: '24px',
                    }}
                >
                    Notification System Demo
                </h1>

                {/* Browser Notification Status */}
                <div
                    style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1.5px solid #16161A',
                        padding: '16px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div>
                        <h3
                            style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#16161A',
                                margin: '0 0 4px 0',
                            }}
                        >
                            Browser Notifications
                        </h3>
                        <p
                            style={{
                                fontSize: '14px',
                                color: '#16161A',
                                opacity: 0.6,
                                margin: 0,
                            }}
                        >
                            Status: {isSupported ? browserPermission : 'Not supported'}
                        </p>
                    </div>
                    {isSupported && browserPermission !== 'granted' && (
                        <button
                            onClick={handleRequestPermission}
                            style={{
                                padding: '8px 16px',
                                background: '#C6BBFF',
                                border: '1.5px solid #16161A',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#16161A',
                                cursor: 'pointer',
                            }}
                        >
                            Enable Notifications
                        </button>
                    )}
                </div>

                {/* Controls */}
                <div
                    style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1.5px solid #16161A',
                        padding: '16px',
                        marginBottom: '24px',
                    }}
                >
                    <h3
                        style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#16161A',
                            margin: '0 0 16px 0',
                        }}
                    >
                        Add Sample Notifications
                    </h3>
                    <div
                        style={{
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <button
                            onClick={addSampleFollow}
                            style={{
                                padding: '8px 16px',
                                background: '#3B82F6',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            👤 Add Follow
                        </button>
                        <button
                            onClick={addSampleMessage}
                            style={{
                                padding: '8px 16px',
                                background: '#22C55E',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            💬 Add Message
                        </button>
                        <button
                            onClick={addSampleTask}
                            style={{
                                padding: '8px 16px',
                                background: '#A855F7',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            📋 Add Task
                        </button>
                        <button
                            onClick={addSampleMention}
                            style={{
                                padding: '8px 16px',
                                background: '#F97316',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                cursor: 'pointer',
                            }}
                        >
                            @ Add Mention
                        </button>
                    </div>
                </div>

                {/* Notification Bell Demo */}
                <div
                    style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1.5px solid #16161A',
                        padding: '16px',
                        marginBottom: '24px',
                    }}
                >
                    <h3
                        style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#16161A',
                            margin: '0 0 16px 0',
                        }}
                    >
                        Notification Bell Variants
                    </h3>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '24px',
                            background: '#111827',
                            padding: '16px',
                            borderRadius: '12px',
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <NotificationBell
                                notifications={notifications}
                                onClick={() => setShowDropdown(!showDropdown)}
                                size="sm"
                            />
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Small</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <NotificationBell
                                notifications={notifications}
                                onClick={() => setShowDropdown(!showDropdown)}
                                size="md"
                            />
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Medium</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <NotificationBell
                                notifications={notifications}
                                onClick={() => setShowDropdown(!showDropdown)}
                                size="lg"
                            />
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Large</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <NotificationBell
                                notifications={notifications}
                                onClick={() => setShowDropdown(!showDropdown)}
                                size="md"
                                dotOnly
                            />
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Dot Only</span>
                        </div>
                    </div>

                    {/* Dropdown Demo */}
                    {showDropdown && (
                        <div style={{ marginTop: '16px' }}>
                            <NotificationDropdown
                                notifications={notifications}
                                onNotificationClick={(n) => {
                                    console.log('Clicked:', n);
                                    markAsRead(n.id);
                                }}
                                onMarkAsRead={markAsRead}
                                onMarkAllAsRead={markAllAsRead}
                                onArchive={archiveNotification}
                                onViewAll={() => setShowDropdown(false)}
                            />
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '24px',
                    }}
                >
                    <button
                        onClick={() => setActiveTab('list')}
                        style={{
                            padding: '12px 24px',
                            background: activeTab === 'list' ? '#16161A' : '#FFFFFF',
                            color: activeTab === 'list' ? '#FFFFFF' : '#16161A',
                            border: '1.5px solid #16161A',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Notification List ({unreadCount} unread)
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        style={{
                            padding: '12px 24px',
                            background: activeTab === 'settings' ? '#16161A' : '#FFFFFF',
                            color: activeTab === 'settings' ? '#FFFFFF' : '#16161A',
                            border: '1.5px solid #16161A',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Settings
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'list' ? (
                    <NotificationList
                        notifications={notifications}
                        onNotificationClick={(n) => {
                            console.log('Clicked:', n);
                            markAsRead(n.id);
                        }}
                        onMarkAsRead={markAsRead}
                        onMarkAllAsRead={markAllAsRead}
                        onArchive={archiveNotification}
                        onClearAll={() => {
                            // Clear all by archiving
                            notifications.forEach((n) => archiveNotification(n.id));
                        }}
                        maxHeight="500px"
                    />
                ) : (
                    <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: '1fr 1fr' }}>
                        <NotificationSettings settings={settings} onSettingsChange={updateSettings} />
                        <NotificationSettingsCompact settings={settings} onSettingsChange={updateSettings} />
                    </div>
                )}
            </div>
        </div>
    );
}
