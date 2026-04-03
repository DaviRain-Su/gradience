import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        arena: 'src/arena.ts',
        'chain-hub': 'src/chain-hub.ts',
        wallet: 'src/wallet.ts',
        types: 'src/types.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    // Chain Hub SDK has no external deps — bundle it inline.
    // Arena SDK and Solana Kit are proper packages — keep external.
    external: [
        '@gradiences/arena-sdk',
        '@solana/kit',
        '@solana-program/address-lookup-table',
    ],
    treeshake: true,
    sourcemap: true,
});
