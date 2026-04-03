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
};

export default nextConfig;
