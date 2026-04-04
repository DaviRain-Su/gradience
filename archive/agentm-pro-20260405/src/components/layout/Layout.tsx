 'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { ActiveView } from '@/types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout({
    children,
    activeView,
    onViewChange,
    address,
    email,
    demoMode,
    onLogin,
    onLogout,
}: {
    children: ReactNode;
    activeView: ActiveView;
    onViewChange: (view: ActiveView) => void;
    address: string | null;
    email: string | null;
    demoMode: boolean;
    onLogin: () => void;
    onLogout: () => void;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMobileOpen(false);
    }, [activeView]);

    useEffect(() => {
        if (!mobileOpen) {
            document.body.style.overflow = '';
            return;
        }
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [mobileOpen]);

    return (
        <div className="h-screen md:flex">
            <Sidebar
                activeView={activeView}
                onViewChange={onViewChange}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
            />
            <div className="flex-1 flex flex-col">
                <Header
                    address={address}
                    email={email}
                    demoMode={demoMode}
                    mobileOpen={mobileOpen}
                    onToggleSidebar={() => setMobileOpen((prev) => !prev)}
                    onLogin={onLogin}
                    onLogout={onLogout}
                />
                <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
            </div>
        </div>
    );
}
