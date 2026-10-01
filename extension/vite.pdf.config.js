import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync, mkdirSync } from 'node:fs';
const dir = import.meta.dirname;
export default defineConfig({
  build: { outDir: dir, emptyOutDir: false, lib: {
    entry: resolve(dir, 'pdf-renderer.js'), formats: ['es'], fileName: () => 'pdf.bundle.js',
  } },
  plugins: [{ name: 'local-pdf-worker', closeBundle() {
    const pkg = resolve(dir, '../node_modules/pdfjs-dist');
    cpSync(resolve(pkg, 'build/pdf.worker.mjs'), resolve(dir, 'pdf.worker.mjs'));
    for (const [source, target] of [['cmaps','pdf-cmaps'], ['standard_fonts','pdf-fonts'], ['wasm','pdf-wasm']]) {
      mkdirSync(resolve(dir, target), { recursive: true });
      cpSync(resolve(pkg, source), resolve(dir, target), { recursive: true });
    }
  } }],
});
