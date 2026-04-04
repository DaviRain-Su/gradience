import type { Metadata } from 'next';
import './globals.css';
import { Search, Menu, X, Github, Twitter, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Gradience Developer Docs',
    description: 'Documentation for the Gradience Protocol — Agent reputation, task escrow, and cross-chain verification.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-[#0a0a0f] text-gray-100 antialiased">
                {/* Top Navigation */}
                <TopNav />
                
                <div className="flex min-h-screen pt-16">
                    <Sidebar />
                    <main className="flex-1 min-w-0">
                        <div className="max-w-4xl mx-auto px-6 py-8">
                            {children}
                        </div>
                    </main>
                    <TableOfContents />
                </div>
            </body>
        </html>
    );
}

function TopNav() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-gray-800/50 bg-[#0a0a0f]/80 backdrop-blur-xl">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <a href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">G</span>
                        </div>
                        <span className="font-semibold text-lg hidden sm:block">Gradience</span>
                    </a>
                    <span className="text-gray-600 hidden sm:block">|</span>
                    <span className="text-gray-400 text-sm hidden sm:block">Documentation</span>
                </div>

                {/* Search */}
                <div className="flex-1 max-w-md mx-4 hidden md:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search documentation..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                        />
                        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 hidden lg:block">⌘K</kbd>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    <a
                        href="https://github.com/DaviRain-Su/gradience"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <Github className="w-5 h-5" />
                    </a>
                    <a
                        href="https://twitter.com/gradience"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <Twitter className="w-5 h-5" />
                    </a>
                    <a
                        href="/"
                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Get Started
                    </a>
                </div>
            </div>
        </header>
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
        <aside className="hidden lg:block w-64 border-r border-gray-800/50 bg-[#0a0a0f] fixed left-0 top-16 bottom-0 overflow-y-auto">
            <nav className="p-4 space-y-6">
                {sections.map((section) => (
                    <div key={section.title}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                            {section.title}
                        </p>
                        <ul className="space-y-0.5">
                            {section.items.map((item) => (
                                <li key={item.href}>
                                    <a
                                        href={item.href}
                                        className="block text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 px-2 py-1.5 rounded-md transition-all"
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                
                {/* Language Switcher */}
                <div className="pt-4 border-t border-gray-800/50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                        Language
                    </p>
                    <div className="flex gap-2 text-sm px-2">
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
        <aside className="hidden xl:block w-64 fixed right-0 top-16 bottom-0 overflow-y-auto p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                On this page
            </p>
            <div className="text-sm text-gray-400">
                {/* TOC will be populated by client-side script */}
                <p className="text-gray-600 text-xs">Loading...</p>
            </div>
        </aside>
    );
}
