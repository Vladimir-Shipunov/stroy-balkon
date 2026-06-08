import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Vite config for the React configurator SPA.
 *
 * - Entry is the repo-root `index.html`, which mounts `#root` from `src/main.tsx`.
 * - Production build emits to `public/app/` and is served by the existing Express
 *   host under `/app/` (so `base` is `/app/` for builds).
 * - The dev server serves from the root (`base: '/'`) on port 5173 and proxies
 *   `/api` to the Express backend on port 3000.
 *
 * This config is independent of `vite.three.config.js` (the legacy esbuild IIFE
 * bundle for the vanilla configurator).
 */
export default defineConfig(({ command }) => ({
  root: resolve(__dirname),
  base: command === 'build' ? '/app/' : '/',
  // The SPA imports its own assets; do not copy the legacy `public/` tree into
  // the build output (outDir lives under public/, so publicDir must be off).
  publicDir: false,
  plugins: [react()],
  server: {
    // Bind on all interfaces so both IPv4 (127.0.0.1) and IPv6 loopback resolve
    // (Windows localhost defaults to IPv6, which some clients can't reach).
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'public/app'),
    emptyOutDir: true,
    sourcemap: true,
  },
}));
