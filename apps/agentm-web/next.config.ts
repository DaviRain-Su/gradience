import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'export',
    distDir: 'dist',
    reactStrictMode: true,
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        unoptimized: true,
    },
    turbopack: {},
    webpack: (config) => {
        // Mock workspace packages
        config.resolve.alias = {
            ...config.resolve.alias,
            '@gradiences/domain-resolver': '/src/lib/mocks/domain-resolver.ts',
            '@gradiences/sdk': '/src/lib/mocks/sdk.ts',
            '@gradiences/soul-engine': '/src/lib/mocks/soul-engine.ts',
        };
        return config;
    },
};

export default nextConfig;
