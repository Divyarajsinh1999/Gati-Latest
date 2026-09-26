import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/*
  PREVIEW BUILD ONLY — not used by Netlify, not part of `npm run build`.

  Produces one self-contained HTML file so the UI can be opened directly
  with no server and no network. Differences from vite.config.js, all
  deliberate and all confined to this file:

    - no PWA plugin      a service worker can't register from file://
    - no manualChunks    a single bundle, so nothing has to be fetched
    - relative base      assets resolve without a web root
    - mock provider      forced via VITE_DATA_PROVIDER at build time

  The real config is untouched, so this can never affect a deployment.
*/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist-preview',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: 'preview.html',
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});
