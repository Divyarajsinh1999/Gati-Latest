/**
 * SELF-HOSTED TYPEFACES — pinned, because every part of this is silently
 * reversible.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT THIS PROTECTS
 *
 * Three separate things have to stay true for the app to render in its own
 * typefaces on a cold offline start, and none of them announces itself when
 * broken — the app just quietly renders in a fallback face, which most
 * people would read as "looks a bit different today" rather than as a fault.
 *
 *   1. No third-party font request. A single `@import` or <link> to
 *      fonts.googleapis.com puts a render-blocking dependency back on the
 *      critical path and breaks offline entirely.
 *   2. latin-ext is declared. THE RUPEE SIGN (U+20B9) LIVES IN latin-ext,
 *      not latin. Dropping it as "an optimisation" would leave every price
 *      in the app taking its most important glyph from a fallback face.
 *   3. The font files are precached by the service worker. Without that,
 *      self-hosting buys nothing offline — the request just fails against a
 *      different origin.
 *
 * Verified in a real browser as well: after the SW takes control, going
 * offline and reloading still reports both faces loaded. That check lives in
 * scripts/browser-qa.mjs' sibling run rather than here, because jsdom has no
 * font loading and no service worker.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const css = read('src/index.css');
const html = read('index.html');
const viteConfig = read('vite.config.js');

/*
  Comments are stripped before checking for third-party hosts.

  The first draft failed on the @font-face block's own comment, which
  EXPLAINS that the fonts used to come from fonts.googleapis.com. That is
  documentation of a decision, not a request — and a test that cannot tell
  the difference would push the next person to delete the explanation in
  order to get the suite green, which is the opposite of what it is for.
*/
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

const cssCode = stripComments(css);
const htmlCode = stripComments(html);

/** U+20B9, the Indian rupee sign — on nearly every figure in the app. */
const RUPEE = 0x20b9;

/** Parse a CSS `unicode-range` value into [start, end] pairs. */
function parseRanges(value) {
  return value.split(',').map((part) => {
    const [from, to] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(from, 16), parseInt(to ?? from, 16)];
  });
}

describe('no third-party font hosting', () => {
  it('never references a Google font host', () => {
    for (const source of [htmlCode, cssCode]) {
      expect(source).not.toContain('fonts.googleapis.com');
      expect(source).not.toContain('fonts.gstatic.com');
    }
  });

  it('serves every face from this origin', () => {
    const sources = [...cssCode.matchAll(/src:\s*url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src.startsWith('/fonts/')).toBe(true);
  });
});

describe('the font files', () => {
  const files = readdirSync(resolve(process.cwd(), 'public/fonts'));

  it('exist for every declared source', () => {
    const declared = [...cssCode.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
    expect(declared.length).toBe(6);
    for (const name of declared) expect(files).toContain(name);
  });

  it('keeps DM Mono 400 and 500 as separate files', () => {
    // Manrope is variable, so one file serves 400-800. DM Mono is not, and
    // naming its files without the weight silently overwrote one with the
    // other while still leaving a plausible-looking set on disk.
    expect(files).toContain('DMMono400-latin.woff2');
    expect(files).toContain('DMMono500-latin.woff2');
  });
});

describe('the rupee sign survives', () => {
  it('is inside a declared unicode-range', () => {
    const ranges = [...cssCode.matchAll(/unicode-range:\s*([^;]+);/g)]
      .flatMap((m) => parseRanges(m[1]));
    const covered = ranges.some(([lo, hi]) => RUPEE >= lo && RUPEE <= hi);
    expect(covered).toBe(true);
  });

  it('has a latin-ext face declared for both families', () => {
    // The specific way this breaks is someone dropping latin-ext to save
    // 25 kB, which looks harmless until a price renders.
    expect(cssCode).toContain('/fonts/Manrope-latin-ext.woff2');
    expect(cssCode).toContain('/fonts/DMMono500-latin-ext.woff2');
  });
});

describe('offline', () => {
  it('precaches the fonts', () => {
    expect(viteConfig).toMatch(/includeAssets:[^\]]*fonts\/\*\.woff2/);
  });

  it('preloads with crossorigin, or the file is fetched twice', () => {
    // FONT preloads only — index.html also preloads the splash image, which
    // is a different `as` and correctly has no crossorigin. The first draft
    // of this test asserted over every preload and failed on that image,
    // which would have been a wrong test rather than a wrong app.
    const fontPreloads = [...htmlCode.matchAll(/<link rel="preload"[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => tag.includes('.woff2'));

    expect(fontPreloads.length).toBeGreaterThan(0);
    for (const tag of fontPreloads) {
      expect(tag).toContain('as="font"');
      // Fonts are fetched in CORS mode even same-origin. Without this the
      // preload is unused, the file downloads twice, and the browser warns.
      expect(tag).toContain('crossorigin');
    }
  });
});

describe('fallbacks stay in the stacks', () => {
  it('keeps a real fallback after each family', () => {
    /*
      NOT COSMETIC. Neither family ships the arrows the UI uses (U+25B2,
      U+25BC, U+2192), and DM Mono has no rupee sign in any subset — so
      prices in the mono face already take ₹ from the fallback. That was
      true of the hosted version too; it is preserved, not introduced.
    */
    const display = cssCode.match(/--font-display:\s*([^;]+);/)[1];
    const mono = cssCode.match(/--font-mono:\s*([^;]+);/)[1];
    expect(display.split(',').length).toBeGreaterThan(2);
    expect(mono.split(',').length).toBeGreaterThan(2);
    expect(mono).toMatch(/monospace\s*$/);
  });
});
