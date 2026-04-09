'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const sections = [
    {
        title: 'Getting Started',
        items: [
            { label: 'Introduction', href: '/' },
            { label: 'Quick Start', href: '/quickstart' },
            { label: 'Architecture', href: '/architecture' },
            { label: 'Best Practices', href: '/best-practices' },
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
            { label: 'SQL Queries', href: '/chain-hub/sql' },
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
            { label: 'Daemon API', href: '/api/daemon' },
            { label: 'Indexer REST API', href: '/api/indexer' },
            { label: 'Agent API (Machine)', href: '/api/agent' },
            { label: 'Playground', href: '/playground' },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden lg:block w-64 shrink-0 border-r border-gray-800/50 bg-[#0a0a0f] fixed left-0 top-16 bottom-0 overflow-y-auto">
            <SidebarContent pathname={pathname} />
        </aside>
    );
}

export function MobileMenuButton() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-white"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {open && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#0a0a0f] border-r border-gray-800/50 overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
                            <span className="font-semibold">Navigation</span>
                            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
                    </aside>
                </div>
            )}
        </>
    );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    return (
        <nav className="p-4 space-y-6">
            {sections.map((section) => (
                <div key={section.title}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                        {section.title}
                    </p>
                    <ul className="space-y-0.5">
                        {section.items.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <a
                                        href={item.href}
                                        onClick={onNavigate}
                                        className={`block text-sm px-2 py-1.5 rounded-md transition-all ${
                                            isActive
                                                ? 'text-indigo-400 bg-indigo-500/10 border-l-2 border-indigo-500'
                                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                        }`}
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}

            <div className="pt-4 border-t border-gray-800/50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Language</p>
                <div className="flex gap-2 text-sm px-2">
                    <a
                        href="/"
                        className={pathname.startsWith('/zh') ? 'text-gray-400 hover:text-white' : 'text-white'}
                    >
                        EN
                    </a>
                    <span className="text-gray-600">|</span>
                    <a
                        href="/zh"
                        className={pathname.startsWith('/zh') ? 'text-white' : 'text-gray-400 hover:text-white'}
                    >
                        u4e2du6587
                    </a>
                </div>
            </div>
        </nav>
    );
}
