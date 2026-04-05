import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/lib/utils.ts',
    'src/components/button.tsx',
    'src/components/card.tsx',
    'src/components/input.tsx',
    'src/components/textarea.tsx',
    'src/components/label.tsx',
    'src/components/select.tsx',
    'src/components/switch.tsx',
    'src/components/slider.tsx',
    'src/components/tabs.tsx',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['react', 'react-dom', 'tailwindcss'],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
