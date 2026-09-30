/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4501' } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'extension/**/*.test.js', 'server/**/*.test.mjs'] },
});
