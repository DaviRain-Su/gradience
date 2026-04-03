import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    webpack: (config) => {
        // Force all @solana/kit imports to resolve to v5.5.1
        // Fixes: @solana-program/token@0.9.0 (via Privy) resolving to @solana/kit@2.3.0
        // which is missing 'sequentialInstructionPlan' export
        config.resolve.alias = {
            ...config.resolve.alias,
            '@solana/kit': resolve(
                __dirname,
                '../../node_modules/.pnpm/@solana+kit@5.5.1_bufferutil@4.1.0_fastestsmallesttextencoderdecoder@1.0.22_typescript@5.9.3_utf-8-validate@5.0.10/node_modules/@solana/kit'
            ),
        };
        return config;
    },
};

export default nextConfig;
