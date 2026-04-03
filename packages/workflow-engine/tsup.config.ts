import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'schema/index': 'src/schema/index.ts',
    'engine/index': 'src/engine/index.ts',
    'utils/index': 'src/utils/index.ts',
    'handlers/index': 'src/handlers/index.ts',
    'sdk/index': 'src/sdk/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
});
