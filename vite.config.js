import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const PKG = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'));
const BUILD_TIME = new Date().toISOString();

/**
 * THE BUILD STAMP.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 *
 * A release went out where every change was verifiably present in the
 * bundle and none of it was visible in the deployed app. There was no way
 * to tell, from the app itself, WHICH BUILD was being served — so the
 * question "did the deploy take, or is a stale service worker serving the
 * old shell?" could not be answered, only guessed at.
 *
 * `/version.json` is written on every build and deliberately excluded from
 * the precache, so fetching it always reaches the network. Opening it in a
 * browser settles the question in one second.
 *
 * The same values are compiled into the app and shown in Settings, so the
 * running code can be compared against what the server is serving.
 * ═══════════════════════════════════════════════════════════════════════
 */
function buildStamp() {
  return {
    name: 'gati-build-stamp',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: PKG.version, builtAt: BUILD_TIME }, null, 2),
      });
    },
  };
}

// Indian Market Momentum Dashboard — build config.
// Netlify Functions live in netlify/functions and are proxied to /api/* in dev
// so the same fetch paths work locally and once deployed (see netlify.toml).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(PKG.version),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    tailwindcss(),
    buildStamp(),
    VitePWA({
      registerType: 'autoUpdate',
      // The splash logo is precached too: it is the first thing drawn on a
      // launch, so fetching it from the network on a cold offline start
      // would show an empty dark frame until it timed out.
      /*
        FONTS ARE PRECACHED, and this is the whole point of self-hosting
        them. A cold offline start now paints in the real typefaces rather
        than in a fallback stack, which is the difference between "the app,
        offline" and "a different-looking app". 87 kB across six files.
      */
      includeAssets: ['icons/*.png', 'brand/gati-splash.webp', 'fonts/*.woff2'],
      workbox: {
        /*
          version.json MUST NEVER BE PRECACHED.

          It exists to answer one question — "which build is actually being
          served right now" — and a precached copy would answer it with the
          build that installed the service worker, which is exactly the
          answer that is useless when a deploy appears not to have taken.

          It is also how the app detects that a newer build exists while the
          current one is open.
        */
        globIgnores: ['**/version.json'],
        /*
          A deep route (/nifty50/all, /how-it-works) must resolve to the app
          shell when the service worker answers the navigation, not 404. This
          was absent, so a hard refresh on any route other than "/" was
          served by the SW with nothing to fall back to.
        */
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Gati — Relative Strength Momentum',
        short_name: 'Gati',
        description: 'Relative-strength momentum ranking and backtesting for NIFTY 50, Midcap 150 and Smallcap 250.',
        theme_color: '#0E1B2C',
        /*
          What Android paints for its OWN native splash, before a single line
          of this app has run. Left at the light canvas colour it produced a
          white flash and THEN the dark launch splash, on every cold start.
          Must stay equal to SPLASH_BACKGROUND in src/config/splash.js; a test
          asserts it.
        */
        background_color: '#0b0f14',
        display: 'standalone',
        start_url: '/',
        icons: [
          // Owner-supplied artwork (v2, Aug 2026). `maskable` entries are
          // separate files, not the same image re-tagged: Android crops a
          // maskable icon to a circle of 80% diameter, and this artwork has a
          // gold rule tracing the card's outline, so those variants scale the
          // WHOLE CARD to 0.63 to clear that radius. Tagging the standard icon
          // as maskable ships a gold ring with a bite out of it.
          // Derivation and measurements: scripts/generate-icons.py.
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // In local dev, Netlify Functions aren't running under Vite's server by
      // default. `netlify dev` (Netlify CLI) handles this automatically; this
      // proxy entry is a harmless no-op fallback documented in README.md.
      '/api': {
        target: 'http://localhost:8888/.netlify/functions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Charts (recharts + its internals) are the single biggest dependency
        // and aren't needed to paint the shell/nav — splitting them out lets
        // the browser cache them separately and lets the rest of the app
        // become interactive first.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
