import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/types.ts',
        'src/parser.ts',
        'src/storage.ts',
        'src/probe.ts',
        'src/matching/index.ts',
        'src/llm-config.ts',
    ],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
});
