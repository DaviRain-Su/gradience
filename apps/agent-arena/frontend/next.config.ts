import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        optimizePackageImports: ['@solana/kit'],
    },
};

export default nextConfig;
