import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    title: 'AgentM Pro — Developer Console',
    description: 'Build, publish, and manage AI agents on Gradience Protocol.',
    openGraph: {
        title: 'AgentM Pro — Developer Console',
        description: 'Build, publish, and manage AI agents on Gradience Protocol.',
        siteName: 'AgentM Pro',
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-gray-950 text-white antialiased">{children}</body>
        </html>
    );
}
