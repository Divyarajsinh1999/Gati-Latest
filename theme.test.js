import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  THEME_STORAGE_KEY,
  THEME_COLOR,
  THEME_PREFERENCES,
  DEFAULT_PREFERENCE,
  DARK_MEDIA_QUERY,
  normalizePreference,
  resolveTheme,
  readStoredPreference,
  writeStoredPreference,
  themeBootstrapContract,
} from '../theme.js';

/** Minimal in-memory localStorage stand-in. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

describe('theme preference normalisation', () => {
  it('accepts the three valid preferences unchanged', () => {
    expect(normalizePreference('light')).toBe('light');
    expect(normalizePreference('dark')).toBe('dark');
    expect(normalizePreference('system')).toBe('system');
  });

  /*
    RETARGETED IN M14 (D19). The fallback was 'system'; dark is now the
    default, and this test's subject is the fallback itself, so it moves
    with the decision rather than being deleted.

    What it still guards is unchanged and is the reason it exists: junk,
    a stale value from an older release, and a case-wrong string must all
    land somewhere valid instead of reaching the DOM as a theme attribute
    nobody styled. Asserted against the exported constant so this can never
    disagree with the implementation — a literal here would just be a second
    place for the default to live.
  */
  it('falls back to the default for anything invalid, including a stale old value', () => {
    expect(DEFAULT_PREFERENCE).toBe('dark');
    for (const bad of [null, undefined, '', 'auto', 'DARK', 42, {}]) {
      expect(normalizePreference(bad)).toBe(DEFAULT_PREFERENCE);
    }
  });

  it('keeps system selectable — the default changed, the option did not', () => {
    expect(THEME_PREFERENCES).toContain('system');
    expect(normalizePreference('system')).toBe('system');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('resolveTheme', () => {
  it('honours an explicit choice regardless of what the OS says', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the OS when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('treats an unknown preference as the default rather than throwing', () => {
    // Both OS answers, so this passes for the right reason rather than
    // because the default and the OS happen to agree.
    expect(resolveTheme('nonsense', true)).toBe('dark');
    expect(resolveTheme('nonsense', false)).toBe('dark');
  });
});

describe('preference storage', () => {
  it('round-trips a preference', () => {
    const storage = fakeStorage();
    writeStoredPreference('dark', storage);
    expect(readStoredPreference(storage)).toBe('dark');
  });

  it('returns the default when nothing is stored', () => {
    expect(readStoredPreference(fakeStorage())).toBe(DEFAULT_PREFERENCE);
  });

  it('never throws when storage is unavailable — Safari private mode rejects writes', () => {
    const hostile = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(() => writeStoredPreference('dark', hostile)).not.toThrow();
    expect(readStoredPreference(hostile)).toBe(DEFAULT_PREFERENCE);
  });
});

/**
 * THE IMPORTANT ONE.
 *
 * index.html carries an inline copy of the theme-resolution constants,
 * because a pre-paint script cannot import a module without becoming
 * async (which would reintroduce the white flash this whole mechanism
 * exists to prevent). Duplicated constants drift. When they drift here,
 * the symptom is subtle and hard to attribute: a flash of the wrong
 * theme, or an OS chrome bar that doesn't match the page. This test turns
 * that into a build failure instead.
 */
describe('inline bootstrap in index.html stays in sync with theme.js', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const contract = themeBootstrapContract();

  it('uses the same storage key', () => {
    expect(html).toContain(`'${contract.storageKey}'`);
    expect(contract.storageKey).toBe(THEME_STORAGE_KEY);
  });

  it('uses the same media query', () => {
    expect(html).toContain(contract.mediaQuery);
    expect(contract.mediaQuery).toBe(DARK_MEDIA_QUERY);
  });

  it('uses the same two theme colours', () => {
    expect(html).toContain(contract.darkColor);
    expect(html).toContain(contract.lightColor);
    expect(contract.lightColor).toBe(THEME_COLOR.light);
    expect(contract.darkColor).toBe(THEME_COLOR.dark);
  });

  it('checks all three preference values, so a stored "system" is not discarded', () => {
    expect(html).toContain("'light'");
    expect(html).toContain("'dark'");
    expect(html).toContain("'system'");
  });

  it('runs before the app bundle, or it cannot beat first paint', () => {
    expect(html.indexOf('gati.theme-preference')).toBeLessThan(html.indexOf('/src/main.jsx'));
  });
});

/**
 * The theme-color meta values are what the OS paints around the page on
 * mobile. If they drift from --color-canvas there's a visible seam at the
 * top of the screen, which looks like a rendering bug rather than a
 * config mismatch.
 */
describe('theme-color matches the canvas token in src/index.css', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('light canvas matches the light theme-color', () => {
    expect(css).toContain(`--color-canvas: ${THEME_COLOR.light}`);
  });

  it('dark canvas matches the dark theme-color', () => {
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(darkBlock).toContain(`--color-canvas: ${THEME_COLOR.dark}`);
  });
});
