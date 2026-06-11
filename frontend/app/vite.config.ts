import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Service UIs live OUTSIDE the workspace (services/<name>/ui) and are pulled in by the
// build-time registry glob. Aliases let those out-of-tree files resolve @holistic/ui and a
// single React instance. Order matters: the tokens.css subpath must precede the bare alias.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@holistic/ui/tokens.css', replacement: r('../packages/ui/src/tokens.css') },
      { find: '@holistic/ui', replacement: r('../packages/ui/src/index.ts') },
      { find: /^react$/, replacement: r('./node_modules/react') },
      { find: /^react\/(.*)$/, replacement: r('./node_modules/react/$1') },
      { find: /^react-dom$/, replacement: r('./node_modules/react-dom') },
      { find: /^react-dom\/(.*)$/, replacement: r('./node_modules/react-dom/$1') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8770', changeOrigin: false },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
