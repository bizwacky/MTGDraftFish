import { defineConfig } from 'vite';

// BASE_PATH lets the GitHub Pages workflow serve the site from /<repo>/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2022', sourcemap: false },
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'] }
} as any);
