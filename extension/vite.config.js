import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname, '..'),
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: resolve(import.meta.dirname),
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'sidepanel-motion.jsx'),
      formats: ['iife'],
      name: 'TribalSaarthiPanel',
      fileName: () => 'motion.bundle.js',
    },
  },
});
