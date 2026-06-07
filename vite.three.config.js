import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'public/vendor/three-bundle',
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'src/three-bundle.js'),
            name: 'ThreeGlobal',
            formats: ['iife'],
            fileName: () => 'three.global.js'
        },
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true
            }
        }
    }
});
