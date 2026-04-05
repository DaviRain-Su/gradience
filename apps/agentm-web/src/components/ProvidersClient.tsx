'use client';

import dynamic from 'next/dynamic';

// Dynamically import providers with SSR disabled
const Providers = dynamic(
    () => import('./Providers').then(mod => ({ default: mod.Providers })),
    { ssr: false }
);

export function ProvidersClient({ children }: { children: React.ReactNode }) {
    return <Providers>{children}</Providers>;
}
