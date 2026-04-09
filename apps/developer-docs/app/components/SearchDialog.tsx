'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
    title: string;
    href: string;
    section: string;
}

const ALL_PAGES: SearchResult[] = [
    { title: 'Introduction', href: '/', section: 'Getting Started' },
    { title: 'Quick Start', href: '/quickstart', section: 'Getting Started' },
    { title: 'Architecture', href: '/architecture', section: 'Getting Started' },
    { title: 'Best Practices', href: '/best-practices', section: 'Getting Started' },
    { title: 'Agent Arena Overview', href: '/arena', section: 'Agent Arena' },
    { title: 'Arena Instructions', href: '/arena/instructions', section: 'Agent Arena' },
    { title: 'Arena State Accounts', href: '/arena/state', section: 'Agent Arena' },
    { title: 'Chain Hub Overview', href: '/chain-hub', section: 'Chain Hub' },
    { title: 'Chain Hub SDK', href: '/chain-hub/sdk', section: 'Chain Hub' },
    { title: 'Delegation Tasks', href: '/chain-hub/delegation', section: 'Chain Hub' },
    { title: 'SQL Queries', href: '/chain-hub/sql', section: 'Chain Hub' },
    { title: 'A2A Protocol Overview', href: '/a2a', section: 'A2A Protocol' },
    { title: 'A2A Messaging', href: '/a2a/messaging', section: 'A2A Protocol' },
    { title: 'A2A Channels', href: '/a2a/channels', section: 'A2A Protocol' },
    { title: 'EVM Bridge Overview', href: '/evm', section: 'EVM Bridge' },
    { title: 'Reputation Verifier', href: '/evm/reputation', section: 'EVM Bridge' },
    { title: 'Indexer REST API', href: '/api/indexer', section: 'API Reference' },
    { title: 'Agent API', href: '/api/agent', section: 'API Reference' },
    { title: 'API Playground', href: '/playground', section: 'API Reference' },
];

export function SearchDialog() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const router = useRouter();

    const results = query.trim()
        ? ALL_PAGES.filter(
              (p) =>
                  p.title.toLowerCase().includes(query.toLowerCase()) ||
                  p.section.toLowerCase().includes(query.toLowerCase()),
          )
        : ALL_PAGES;

    const handleSelect = useCallback(
        (href: string) => {
            setOpen(false);
            setQuery('');
            router.push(href);
        },
        [router],
    );

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <>
            {/* Trigger */}
            <button
                onClick={() => setOpen(true)}
                className="flex-1 max-w-md mx-4 hidden md:flex items-center gap-2 px-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-500 hover:border-gray-700 transition-colors"
            >
                <Search className="w-4 h-4" />
                <span className="flex-1 text-left">Search documentation...</span>
                <kbd className="text-xs text-gray-600">\u2318K</kbd>
            </button>

            {/* Mobile trigger */}
            <button
                onClick={() => setOpen(true)}
                className="md:hidden p-2 text-gray-400 hover:text-white"
                aria-label="Search"
            >
                <Search className="w-5 h-5" />
            </button>

            {/* Dialog */}
            {open && (
                <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative w-full max-w-lg mx-4 bg-[#111118] border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 border-b border-gray-800">
                            <Search className="w-4 h-4 text-gray-500 shrink-0" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search docs..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex-1 py-3 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                            />
                            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Results */}
                        <ul className="max-h-80 overflow-y-auto py-2">
                            {results.length === 0 ? (
                                <li className="px-4 py-8 text-center text-sm text-gray-500">No results found</li>
                            ) : (
                                results.map((r) => (
                                    <li key={r.href}>
                                        <button
                                            onClick={() => handleSelect(r.href)}
                                            className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-800/50 transition-colors text-left"
                                        >
                                            <span className="text-gray-200">{r.title}</span>
                                            <span className="text-xs text-gray-600">{r.section}</span>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>

                        {/* Footer */}
                        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-800 text-xs text-gray-600">
                            <span>\u2191\u2193 Navigate</span>
                            <span>\u21B5 Select</span>
                            <span>Esc Close</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
