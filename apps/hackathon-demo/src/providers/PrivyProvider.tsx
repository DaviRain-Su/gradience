'use client';

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { ReactNode } from 'react';

// 注意：这里需要替换为实际的 Privy App ID
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'your-app-id';

interface Props {
    children: ReactNode;
}

export function PrivyProvider({ children }: Props) {
    return (
        <PrivyProviderBase
            appId={PRIVY_APP_ID}
            config={{
                // 支持的登录方式
                loginMethods: ['email', 'google', 'twitter', 'discord', 'wallet'],

                // 外观配置
                appearance: {
                    theme: 'dark',
                    accentColor: '#8B5CF6', // Purple
                    logo: '/logo.png',
                    showWalletLoginFirst: false, // 社交登录优先
                },

                // 嵌入式钱包配置
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets', // 自动为无钱包用户创建
                    showWalletUIs: true,
                },

                // 支持的链
                defaultChain: {
                    id: 1,
                    name: 'Ethereum',
                    nativeCurrency: {
                        name: 'Ether',
                        symbol: 'ETH',
                        decimals: 18,
                    },
                    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/demo'],
                },
                supportedChains: [
                    {
                        id: 1,
                        name: 'Ethereum',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/demo'],
                    },
                    {
                        id: 137,
                        name: 'Polygon',
                        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                        rpcUrls: ['https://polygon-rpc.com'],
                    },
                    {
                        id: 8453,
                        name: 'Base',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.base.org'],
                    },
                ],
            }}
        >
            {children}
        </PrivyProviderBase>
    );
}
