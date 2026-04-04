export function Header({
    address,
    email,
    demoMode,
    mobileOpen,
    onToggleSidebar,
    onLogin,
    onLogout,
}: {
    address: string | null;
    email: string | null;
    demoMode: boolean;
    mobileOpen: boolean;
    onToggleSidebar: () => void;
    onLogin: () => void;
    onLogout: () => void;
}) {
    return (
        <header className="h-16 border-b border-gray-800 px-4 md:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    onClick={onToggleSidebar}
                    data-testid="mobile-menu-button"
                    className="md:hidden w-9 h-9 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300"
                    aria-label="Open navigation"
                    aria-expanded={mobileOpen}
                >
                    ☰
                </button>
                <p className="text-sm text-gray-400">Developer Workspace</p>
                <p className="hidden sm:block text-xs text-gray-500 font-mono truncate max-w-52">
                    {address ?? 'No wallet linked'}
                </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <p className="hidden sm:block text-sm text-gray-400">
                    {email ?? (demoMode ? 'Demo Session' : 'Authenticated')}
                </p>
                {demoMode ? (
                    <button
                        onClick={onLogin}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
                    >
                        Sign In
                    </button>
                ) : (
                    <button
                        onClick={onLogout}
                        className="px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm transition"
                    >
                        Logout
                    </button>
                )}
            </div>
        </header>
    );
}
