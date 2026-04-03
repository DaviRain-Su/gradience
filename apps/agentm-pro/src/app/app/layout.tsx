import type { ReactNode } from 'react';
import AppLayoutClient from './AppLayoutClient';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: ReactNode }) {
    return <AppLayoutClient>{children}</AppLayoutClient>;
}
