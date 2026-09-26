import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Icon-set guards.
 *
 * Icons are static assets, so nothing else in the build fails when one
 * goes missing or gets wired up wrongly — the app just ships with a
 * broken home-screen tile that nobody notices until it's installed on a
 * phone. These are the checks that would have caught the mistakes this
 * project has actually been at risk of making.
 */

const ICONS = resolve(process.cwd(), 'public/icons');
const icon = (name) => resolve(ICONS, name);

const REQUIRED = [
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'gati-mark.png',
];

describe('icon set', () => {
  it('every icon the manifest and index.html reference actually exists', () => {
    for (const name of REQUIRED) {
      expect(existsSync(icon(name)), `${name} is missing from public/icons`).toBe(true);
    }
  });

  it('no icon is a zero-byte or truncated file', () => {
    for (const name of REQUIRED) {
      expect(statSync(icon(name)).size, `${name} looks truncated`).toBeGreaterThan(500);
    }
  });

  it('every icon is a real PNG, not a renamed SVG or JPEG', () => {
    // PNG magic number. A renamed file passes a filename check but fails
    // to render, which is exactly the failure that's hard to spot.
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    for (const name of REQUIRED) {
      const head = readFileSync(icon(name)).subarray(0, 4);
      expect(head.equals(PNG_MAGIC), `${name} is not a PNG`).toBe(true);
    }
  });

  /**
   * THE ONE THAT MATTERS MOST.
   *
   * Android crops a `maskable` icon to a circle of 80% diameter. This
   * mark runs nearly edge to edge, so tagging the standard icon as
   * maskable amputates the arrowhead on every Android home screen — and
   * it looks completely fine in every desktop preview, which is why it's
   * such an easy mistake to ship. The maskable files must therefore be
   * DIFFERENT BYTES from their same-size standard counterparts.
   */
  it('maskable icons are distinct artwork, not the standard icon re-tagged', () => {
    for (const size of [192, 512]) {
      const standard = readFileSync(icon(`icon-${size}.png`));
      const maskable = readFileSync(icon(`icon-maskable-${size}.png`));
      expect(
        standard.equals(maskable),
        `icon-maskable-${size}.png is byte-identical to icon-${size}.png — ` +
          'Android will clip the mark. Regenerate with scripts/generate-icons.py.',
      ).toBe(false);
    }
  });

  /**
   * public/icons is swept by the PWA `includeAssets: ['icons/*.png']` glob
   * and every match is precached by the service worker — downloaded in full
   * by every user on install. A working file left here is therefore not
   * untidy, it is bandwidth. The icon generator's intermediate card (~1 MB)
   * landed here once and shipped before this check existed.
   */
  it('holds nothing but the shipped set — public/icons is precached wholesale', () => {
    const stray = readdirSync(ICONS).filter(
      (name) => name !== 'README.md' && !REQUIRED.includes(name),
    );
    expect(
      stray,
      `unexpected files in public/icons — they will be precached:\n${stray.join('\n')}`,
    ).toEqual([]);
  });
});

describe('manifest wiring', () => {
  const config = readFileSync(resolve(process.cwd(), 'vite.config.js'), 'utf8');

  it('declares both purposes, so Android and desktop each get the right artwork', () => {
    expect(config).toContain("purpose: 'any'");
    expect(config).toContain("purpose: 'maskable'");
  });

  it('points maskable entries at the maskable files specifically', () => {
    const maskableLines = config
      .split('\n')
      .filter((line) => line.includes("purpose: 'maskable'"));
    expect(maskableLines).toHaveLength(2);
    for (const line of maskableLines) {
      expect(line).toContain('icon-maskable-');
    }
  });
});

describe('index.html icon links', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('references only icons that exist', () => {
    const referenced = [...html.matchAll(/\/icons\/([\w.-]+)/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(existsSync(icon(name)), `index.html references missing /icons/${name}`).toBe(true);
    }
  });

  it('has an apple-touch-icon — iOS falls back to a page screenshot without one', () => {
    expect(html).toContain('rel="apple-touch-icon"');
  });
});

/**
 * THE ONE THAT WAS MISSING.
 *
 * Icon paths in components are plain strings, not ESM imports, so Vite
 * never resolves them and nothing fails at build time when one is wrong.
 * `Navigation.jsx` shipped pointing at `/gati-mark.png` for several
 * milestones; the file has only ever lived at `/icons/gati-mark.png`, so
 * the sidebar rendered a broken image. Every gate was green throughout.
 *
 * This walks the source for image `src` attributes and checks each one
 * against `public/`, which is the only thing that would have caught it.
 */
describe('icon paths referenced from source', () => {
  const SRC = resolve(process.cwd(), 'src');
  const PUBLIC = resolve(process.cwd(), 'public');

  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
      return /\.(jsx?|tsx?)$/.test(entry.name) ? [full] : [];
    });

  it('every absolute image path in src/ resolves to a file in public/', () => {
    const missing = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const [, path] of source.matchAll(/src="(\/[\w./-]+\.(?:png|svg|webp|jpg|jpeg))"/g)) {
        if (!existsSync(resolve(PUBLIC, path.slice(1)))) {
          missing.push(`${file.replace(`${SRC}/`, 'src/')} -> ${path}`);
        }
      }
    }
    expect(missing, `image paths that will 404:\n${missing.join('\n')}`).toEqual([]);
  });
});
