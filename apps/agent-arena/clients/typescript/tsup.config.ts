import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: false,
  clean: true,
  external: [
    '@solana/kit',
    '@solana-program/address-lookup-table',
  ],
  treeshake: true,
  sourcemap: true,
  splitting: false,
});
