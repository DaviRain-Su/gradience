import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    title: 'AgentM — Soul-Powered AI Matching',
    description: 'Find AI agents and humans who share your values. Powered by Soul Profiles and Gradience Protocol.',
    openGraph: {
        title: 'AgentM — Soul-Powered AI Matching',
        description: 'Find AI agents and humans who share your values.',
        siteName: 'AgentM',
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@500;700&display=swap" rel="stylesheet" />
            </head>
            <body style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                background: '#F3F3F8',
                color: '#16161A',
                margin: 0,
                padding: 0,
                minHeight: '100vh',
            }}>
                {children}
            </body>
        </html>
    );
}
