/**
 * Theme resolution — the single source of truth.
 *
 * Three states, not a binary switch. "system" is a real preference, not a
 * default that gets silently converted to light or dark on first load:
 * a user who picks it expects the app to FOLLOW the OS as it changes
 * (macOS/Windows/Android switch on a schedule), so it stays "system" in
 * storage and is resolved fresh each time it's read.
 *
 * DUPLICATION WARNING — the storage key and the two theme colours are
 * repeated verbatim by an inline <script> in index.html. That duplication
 * is deliberate: the script must run synchronously before first paint to
 * avoid a white flash on a dark-mode load, and an inline script cannot
 * import a module without becoming async, which defeats the point.
 * `themeBootstrapContract()` below exists so a test can assert the two
 * copies stay in sync rather than discovering the drift as a visual bug.
 */

export const THEME_STORAGE_KEY = 'gati.theme-preference';

/** Valid stored preferences. Anything else is treated as DEFAULT_PREFERENCE. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'];

/*
  D19 — DARK IS THE DEFAULT, and 'system' is still offered.

  This was 'system', which sounds more accommodating than it is: an Android
  user whose phone is in light mode would open a light Gati, and "dark
  default" would be true on no device in particular. The terminal palette is
  the design; light is the alternative, not the coin-flip.

  'system' remains a SELECTABLE preference — a reader who wants Gati to
  follow the OS still can. What changed is only what happens when nobody has
  chosen, which is the case this constant names.
*/
export const DEFAULT_PREFERENCE = 'dark';

/**
 * <meta name="theme-color"> values — the browser/OS chrome colour on
 * mobile (Android address bar, iOS PWA status bar). These must match
 * --color-canvas in src/index.css for each theme, or the OS chrome shows
 * a visible seam against the top of the page.
 */
export const THEME_COLOR = { light: '#eef2f1', dark: '#090d10' };

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Normalises anything (null, junk, an old value) to a valid preference. */
export function normalizePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : DEFAULT_PREFERENCE;
}

/**
 * Turns a preference into the theme actually applied right now.
 * @param {string} preference 'light' | 'dark' | 'system'
 * @param {boolean} systemPrefersDark what the OS currently reports
 * @returns {'light'|'dark'}
 */
export function resolveTheme(preference, systemPrefersDark) {
  const pref = normalizePreference(preference);
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** Reads the stored preference, tolerating a disabled/throwing localStorage. */
export function readStoredPreference(storage = safeStorage()) {
  try {
    return normalizePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** Persists a preference. Never throws — Safari private mode rejects writes. */
export function writeStoredPreference(preference, storage = safeStorage()) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, normalizePreference(preference));
  } catch {
    // A theme preference is not worth breaking the app over.
  }
}

function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Applies a resolved theme to the document: sets the attribute
 * src/index.css keys its dark block on, and keeps the OS chrome colour in
 * step. Safe to call in a non-DOM environment (tests, SSR).
 */
export function applyTheme(theme, doc = typeof document === 'undefined' ? null : document) {
  if (!doc?.documentElement) return;
  const resolved = theme === 'dark' ? 'dark' : 'light';
  doc.documentElement.setAttribute('data-theme', resolved);
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
}

/**
 * The exact values the inline bootstrap script in index.html must use.
 * A test compares this against the real index.html so the two copies
 * can't silently diverge (see utils/__tests__/theme.test.js).
 */
export function themeBootstrapContract() {
  return {
    storageKey: THEME_STORAGE_KEY,
    mediaQuery: DARK_MEDIA_QUERY,
    lightColor: THEME_COLOR.light,
    darkColor: THEME_COLOR.dark,
  };
}
