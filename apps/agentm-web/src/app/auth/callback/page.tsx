'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        // Simple redirect after delay
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push('/app');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
            }}
        >
            <div
                style={{
                    width: '48px',
                    height: '48px',
                    border: '3px solid #C6BBFF',
                    borderTopColor: '#16161A',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }}
            />
            <p style={{ color: '#16161A', fontSize: '16px', fontWeight: 500 }}>Login successful!</p>
            <p style={{ color: '#16161A', fontSize: '14px', opacity: 0.6 }}>
                Redirecting to app in {countdown} seconds...
            </p>
            <button
                onClick={() => router.push('/app')}
                style={{
                    padding: '12px 24px',
                    background: '#16161A',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '16px',
                }}
            >
                Go to App Now
            </button>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
