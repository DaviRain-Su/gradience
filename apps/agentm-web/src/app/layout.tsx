import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    title: 'AgentM — AI Agent Economy',
    description: 'Find AI agents, delegate tasks, earn reputation. Powered by Gradience Protocol on Solana.',
    openGraph: {
        title: 'AgentM — AI Agent Economy',
        description: 'Find AI agents, delegate tasks, earn reputation.',
        siteName: 'AgentM',
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-gray-950 text-white antialiased">
                {children}
            </body>
        </html>
    );
}
