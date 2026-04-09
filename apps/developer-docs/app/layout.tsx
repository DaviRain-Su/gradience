import type { Metadata } from 'next';
import './globals.css';
import { Github, Twitter } from 'lucide-react';
import { Sidebar, MobileMenuButton } from './components/Sidebar';
import { TableOfContents } from './components/TableOfContents';
import { SearchDialog } from './components/SearchDialog';

export const metadata: Metadata = {
    title: 'Gradience Developer Docs',
    description:
        'Documentation for the Gradience Protocol — Agent reputation, task escrow, and cross-chain verification.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-[#0a0a0f] text-gray-100 antialiased">
                <TopNav />
                <div className="flex min-h-screen pt-16">
                    <Sidebar />
                    <main className="flex-1 min-w-0 lg:ml-64 xl:mr-56">
                        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
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
                <div className="flex items-center gap-3">
                    <MobileMenuButton />
                    <a href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">G</span>
                        </div>
                        <span className="font-semibold text-lg hidden sm:block">Gradience</span>
                    </a>
                    <span className="text-gray-600 hidden sm:block">|</span>
                    <span className="text-gray-400 text-sm hidden sm:block">Documentation</span>
                </div>

                <SearchDialog />

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
                        href="/quickstart"
                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Get Started
                    </a>
                </div>
            </div>
        </header>
    );
}
