import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server': path.resolve(__dirname, './server'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['tests/ws/**', 'node'],
      ['tests/server/**', 'node'],
      ['tests/api/**', 'node'],
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // Enable JSX in tests using React plugin transform
    transformMode: { web: [/.tsx?$/], ssr: [/.tsx?$/] },
    css: false,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'coverage/**', 'tests/camera-mode.spec.ts', 'tests/e2e/**'],
  },
});


