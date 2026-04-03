import { useEffect } from 'react';
import type { ActiveView } from '@/types';

const NAV_ITEMS: { key: ActiveView; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'profiles', label: 'Profiles' },
    { key: 'discover', label: 'Discover' },
    { key: 'feed', label: 'Feed' },
    { key: 'messages', label: 'Messages' },
    { key: 'stats', label: 'Stats' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'settings', label: 'Settings' },
];

export function Sidebar({
    activeView,
    onViewChange,
    mobileOpen,
    onCloseMobile,
}: {
    activeView: ActiveView;
    onViewChange: (view: ActiveView) => void;
    mobileOpen: boolean;
    onCloseMobile: () => void;
}) {
    useEffect(() => {
        if (!mobileOpen) return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onCloseMobile();
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [mobileOpen, onCloseMobile]);

    return (
        <>
            <aside className="hidden md:flex md:w-56 bg-gray-900 border-r border-gray-800 flex-col">
                <SidebarContent activeView={activeView} onViewChange={onViewChange} />
            </aside>

            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-40">
                    <button data-testid="mobile-overlay-close" className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
                    <aside
                        data-testid="mobile-sidebar"
                        role="dialog"
                        aria-modal="true"
                        className="relative z-50 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col"
                    >
                        <button
                            data-testid="mobile-sidebar-close"
                            onClick={onCloseMobile}
                            className="absolute top-3 right-3 w-8 h-8 rounded-lg border border-gray-700 text-gray-300"
                            aria-label="Close navigation"
                        >
                            ×
                        </button>
                        <SidebarContent
                            activeView={activeView}
                            onViewChange={(view) => {
                                onViewChange(view);
                                onCloseMobile();
                            }}
                        />
                    </aside>
                </div>
            )}
        </>
    );
}

function SidebarContent({
    activeView,
    onViewChange,
}: {
    activeView: ActiveView;
    onViewChange: (view: ActiveView) => void;
}) {
    return (
        <>
            <div className="p-4 border-b border-gray-800">
                <p className="text-lg font-bold">AgentM Pro</p>
                <p className="text-xs text-gray-500 mt-1">Developer Console</p>
            </div>
            <nav className="p-2 space-y-1">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        data-testid={`nav-${item.key}`}
                        onClick={() => onViewChange(item.key)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                            activeView === item.key
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
        </>
    );
}
