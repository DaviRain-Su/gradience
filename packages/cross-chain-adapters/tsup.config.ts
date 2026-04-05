import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/layerzero-adapter.ts',
    'src/adapters/wormhole-adapter.ts',
    'src/adapters/debridge-adapter.ts',
    'src/adapters/cross-chain-adapter.ts',
  ],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
});
