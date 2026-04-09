'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useSocial';
import { useDomain } from '@/hooks/useDomain';
import type { SocialNotification } from '@/lib/social/api';

export function NotificationBell({ address }: { address: string | null }) {
    const { notifications, unreadCount, markRead } = useNotifications(address);
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => {
                    setOpen(!open);
                    if (!open && unreadCount > 0) markRead();
                }}
                className="relative p-2 rounded-lg hover:bg-gray-800 transition"
                aria-label="Notifications"
            >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-800">
                        <p className="text-sm font-semibold">Notifications</p>
                    </div>
                    {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-gray-500">No notifications yet.</p>
                    ) : (
                        <div className="divide-y divide-gray-800">
                            {notifications.map((notif) => (
                                <NotificationItem key={notif.id} notification={notif} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function NotificationItem({ notification }: { notification: SocialNotification }) {
    const { displayName } = useDomain(notification.actor);

    const icon = {
        follow: '+',
        like: '*',
        mention: '@',
        message: '>',
        reputation_change: '^',
    }[notification.type];

    return (
        <div className={`p-3 text-sm ${notification.read ? '' : 'bg-gray-850'}`}>
            <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">
                    {icon}
                </span>
                <div>
                    <p>
                        <span className="font-medium">{notification.actorDomain ?? displayName}</span>{' '}
                        {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}
