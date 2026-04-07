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
    // Optimize package imports to reduce bundle size
    experimental: {
        optimizePackageImports: [
            '@dynamic-labs/sdk-react-core',
            '@dynamic-labs/solana',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-wallets',
            '@metaplex-foundation/umi',
            '@metaplex-foundation/umi-bundle-defaults',
            '@json-render/react',
            '@json-render/shadcn',
            'lucide-react',
        ],
    },
    webpack: (config, { isServer }) => {
        // Mock workspace packages that don't have a runtime implementation yet
        config.resolve.alias = {
            ...config.resolve.alias,
            '@gradiences/domain-resolver': '/src/lib/mocks/domain-resolver.ts',
            '@gradiences/soul-engine': '/src/lib/mocks/soul-engine.ts',
        };

        // Optimize chunk splitting
        if (!isServer) {
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        // Vendor chunk for node_modules
                        vendor: {
                            name: 'vendors',
                            test: /[\\/]node_modules[\\/]/,
                            priority: 10,
                            reuseExistingChunk: true,
                        },
                        // Dynamic labs specific chunk
                        dynamic: {
                            name: 'dynamic-labs',
                            test: /[\\/]node_modules[\\/]@dynamic-labs[\\/]/,
                            priority: 20,
                            reuseExistingChunk: true,
                        },
                        // Solana specific chunk
                        solana: {
                            name: 'solana',
                            test: /[\\/]node_modules[\\/]@solana[\\/]/,
                            priority: 20,
                            reuseExistingChunk: true,
                        },
                        // Common chunk for shared code
                        common: {
                            name: 'common',
                            minChunks: 2,
                            priority: 5,
                            reuseExistingChunk: true,
                        },
                    },
                },
            };
        }

        return config;
    },
};

// Bundle Analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);
