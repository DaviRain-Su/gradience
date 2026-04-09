'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamically import DynamicProvider with SSR disabled to prevent window access during build
const DynamicProviderInner = dynamic(
    () => import('../lib/dynamic/DynamicProvider').then((mod) => ({ default: mod.DynamicProvider })),
    { ssr: false },
);

export function DynamicProviderClient({ children }: { children: ReactNode }) {
    return <DynamicProviderInner>{children}</DynamicProviderInner>;
}
