import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { PrivyProvider } from '../providers/PrivyProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Gradience OWS + Privy Demo',
    description: 'Open Wallet Standard adapter with Privy authentication',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <PrivyProvider>{children}</PrivyProvider>
            </body>
        </html>
    );
}
