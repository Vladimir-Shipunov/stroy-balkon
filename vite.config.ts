import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { extname, resolve } from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Dev-only static server for the configurator's 2D scene images under `public/vam/`.
 *
 * The SPA build disables Vite's `publicDir` (outDir lives under `public/`), so
 * the dev server would otherwise answer these requests with the SPA's
 * `index.html`. In production they are served by Express (which statically
 * serves all of `public/`); this fills the gap for `dev:app`.
 */
function servePublicImages(): Plugin {
  const prefixes = ['/vam/'];
  return {
    name: 'serve-public-images-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const prefix = prefixes.find((p) => url.startsWith(p));
        if (!prefix) {
          return next();
        }
        const rel = decodeURIComponent(url.split('?')[0] ?? '');
        const root = resolve(__dirname, `public${prefix}`);
        const filePath = resolve(__dirname, `public${rel}`);
        const type = IMAGE_TYPES[extname(filePath).toLowerCase()];
        if (!type || !filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          return next();
        }
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(filePath).pipe(res);
        return undefined;
      });
    },
  };
}

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
  plugins: [react(), servePublicImages()],
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
