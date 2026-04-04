'use client';

import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';

export function DynamicLoginButton() {
    const { user, sdkHasLoaded } = useDynamicContext();
    const isAuthenticated = !!user;

    if (!sdkHasLoaded) {
        return (
            <div style={{
                padding: '12px 24px',
                background: '#F3F3F8',
                borderRadius: '24px',
                border: '1.5px solid #16161A',
                textAlign: 'center',
            }}>
                <span style={{ fontSize: '14px', color: '#16161A' }}>Loading...</span>
            </div>
        );
    }

    if (isAuthenticated && user) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                background: '#C6BBFF',
                borderRadius: '24px',
                border: '1.5px solid #16161A',
            }}>
                <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#16161A',
                }}>
                    {user.email || user.username || 'Connected'}
                </span>
                <DynamicWidget />
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
        }}>
            <p style={{
                fontSize: '13px',
                color: '#16161A',
                opacity: 0.7,
                textAlign: 'center',
            }}>
                Connect with Google, Twitter, or Discord
            </p>
            <DynamicWidget />
        </div>
    );
}
