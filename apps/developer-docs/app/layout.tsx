import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Gradience Developer Docs',
    description: 'Documentation for the Gradience Protocol — Agent reputation, task escrow, and cross-chain verification.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-gray-950 text-gray-100 antialiased">
                <div className="flex min-h-screen">
                    <Sidebar />
                    <main className="flex-1 max-w-4xl mx-auto px-6 py-8">
                        {children}
                    </main>
                    <TableOfContents />
                </div>
            </body>
        </html>
    );
}

function Sidebar() {
    const sections = [
        {
            title: 'Getting Started',
            items: [
                { label: 'Introduction', href: '/' },
                { label: 'Quick Start', href: '/quickstart' },
                { label: 'Architecture', href: '/architecture' },
            ],
        },
        {
            title: 'Agent Arena',
            items: [
                { label: 'Overview', href: '/arena' },
                { label: 'Instructions', href: '/arena/instructions' },
                { label: 'State Accounts', href: '/arena/state' },
            ],
        },
        {
            title: 'Chain Hub',
            items: [
                { label: 'Overview', href: '/chain-hub' },
                { label: 'SDK', href: '/chain-hub/sdk' },
                { label: 'Delegation Tasks', href: '/chain-hub/delegation' },
            ],
        },
        {
            title: 'A2A Protocol',
            items: [
                { label: 'Overview', href: '/a2a' },
                { label: 'Messaging', href: '/a2a/messaging' },
                { label: 'Channels', href: '/a2a/channels' },
            ],
        },
        {
            title: 'EVM Bridge',
            items: [
                { label: 'Overview', href: '/evm' },
                { label: 'Reputation Verifier', href: '/evm/reputation' },
            ],
        },
        {
            title: 'API Reference',
            items: [
                { label: 'Indexer REST API', href: '/api/indexer' },
                { label: 'Agent API', href: '/api/agent' },
                { label: 'Playground', href: '/playground' },
            ],
        },
    ];

    return (
        <aside className="hidden lg:block w-64 border-r border-gray-800 p-4 sticky top-0 h-screen overflow-y-auto">
            <a href="/" className="text-lg font-bold block mb-6">Gradience Docs</a>
            <nav className="space-y-6">
                {sections.map((section) => (
                    <div key={section.title}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {section.title}
                        </p>
                        <ul className="space-y-1">
                            {section.items.map((item) => (
                                <li key={item.href}>
                                    <a
                                        href={item.href}
                                        className="block text-sm text-gray-400 hover:text-white py-1 transition"
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                
                {/* Language Switcher */}
                <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Language
                    </p>
                    <div className="flex gap-2 text-sm">
                        <a href="/" className="text-white hover:text-gray-300 transition">EN</a>
                        <span className="text-gray-600">|</span>
                        <a href="/zh" className="text-gray-400 hover:text-white transition">中文</a>
                    </div>
                </div>
            </nav>
        </aside>
    );
}

function TableOfContents() {
    return (
        <aside className="hidden xl:block w-48 p-4 sticky top-0 h-screen">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                On this page
            </p>
            {/* TOC populated by client-side JS reading headings */}
        </aside>
    );
}
