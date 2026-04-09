'use client';

import Link from 'next/link';
import { DynamicLoginButton } from '../../components/dynamic/DynamicLoginButton';

/**
 * Login Screen Component
 *
 * Displays the login page with branding and Dynamic login button.
 */
export function LoginScreen() {
    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '32px',
                padding: '24px',
            }}
        >
            <div style={{ textAlign: 'center' }}>
                <div
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: '#C6BBFF',
                        border: '2px solid #16161A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '40px',
                        margin: '0 auto 24px',
                    }}
                >
                    🤖
                </div>
                <h1
                    style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '36px',
                        fontWeight: 700,
                        color: '#16161A',
                        textTransform: 'uppercase',
                        margin: '0 0 12px 0',
                    }}
                >
                    AgentM
                </h1>
                <p
                    style={{
                        fontSize: '16px',
                        color: '#16161A',
                        opacity: 0.6,
                        maxWidth: '400px',
                        margin: '0 auto 32px',
                    }}
                >
                    AI Agent Economy on Solana. Connect with Google, Twitter, or Discord to get started.
                </p>
            </div>

            <DynamicLoginButton />

            <Link
                href="/"
                style={{
                    fontSize: '14px',
                    color: '#16161A',
                    opacity: 0.5,
                    textDecoration: 'none',
                    marginTop: '16px',
                }}
            >
                ← Back to home
            </Link>
        </div>
    );
}
