/**
 * PREFERENCE STORE — small, durable, synchronously readable settings.
 *
 * WHAT THIS OWNS
 *   Last universe, last window, last investment amount, last chart range,
 *   theme, and the transaction-cost toggle.
 *
 * WHAT THIS MUST NEVER DO
 *   Throw. A storage failure degrades to defaults; it never fails a render.
 *   Private browsing, a full quota and a disabled-storage browser all have to
 *   produce a working app, and none of them is worth an error screen over a
 *   remembered chart range.
 *
 * WHY THIS LIVES OUTSIDE data/
 *   It was first placed in `data/cache/`, and the layer-boundary lint rejected
 *   a screen importing it — correctly. `data/` answers "where do market
 *   numbers come from"; a remembered chart range is not that. Preferences are
 *   app state that screens, navigation and the data layer all legitimately
 *   read, so they belong in a module none of them owns.
 *
 * WHY localStorage AND NOT IndexedDB
 *   These values are tiny, and two of them must be readable BEFORE FIRST PAINT
 *   — the theme (to avoid a white flash) and the last universe (to avoid
 *   routing twice). IndexedDB is asynchronous, so using it here would
 *   reintroduce exactly the flash the theme bootstrap exists to prevent.
 *   Price bars went to IndexedDB because they are megabytes; preferences stay
 *   here because they are bytes and because timing matters more than capacity.
 *
 * WHY EVERY READ IS VALIDATED
 *   A stored value can be stale after a release — a universe key that no
 *   longer exists, a window that was removed. An invalid value falls back to
 *   the default rather than propagating into a route and producing a blank
 *   screen on someone's next visit.
 */

const PREFIX = 'gati.pref.';

/**
 * Every preference, with its default and a validator.
 *
 * Validators are declared here rather than at each call site so a stale value
 * cannot enter the app through a path that forgot to check.
 */
export const PREFERENCES = {
  lastUniverse: { key: 'lastUniverse', fallback: null, validate: (v) => typeof v === 'string' && v.length > 0 },
  lastWindow: { key: 'lastWindow', fallback: '1m', validate: (v) => ['1m', '3m', '6m', '12m'].includes(v) },
  investmentAmount: {
    key: 'investmentAmount',
    fallback: null,
    // Bounded on both sides: zero is not an amount, and an absurd figure is
    // far more likely to be a typo than an intention.
    validate: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1_000_000_000,
  },
  // Carried across universe switches (decision D12): comparing large, mid and
  // small caps under different filters would silently change what is being
  // compared, and the user would not be told.
  rankingFilter: { key: 'rankingFilter', fallback: 'all', validate: (v) => ['all', 'top', 'positive', 'negative'].includes(v) },
  rankingSort: { key: 'rankingSort', fallback: 'rank', validate: (v) => ['rank', 'name', 'dayChange', 'price'].includes(v) },
  chartRange: { key: 'chartRange', fallback: '1y', validate: (v) => ['3m', '6m', '1y', '3y', '5y', 'all'].includes(v) },
  includeCosts: { key: 'includeCosts', fallback: false, validate: (v) => typeof v === 'boolean' },

  /*
    TAX DEFAULTS OFF, AND THE REASON IS COHERENCE RATHER THAN TIMIDITY (D26).

    `includeCosts` already defaults off. Defaulting tax ON alone would produce
    an incoherent figure — tax deducted while brokerage, STT and slippage are
    ignored — and would silently change every number the owner has been
    reading, so he would be comparing new figures against his memory of old
    ones.

    THE HONEST NUMBER IS NOT HIDDEN BY THIS. A net-of-everything line sits
    under the record headline whatever these toggles say; the toggles only
    decide which basis the WHOLE record is presented on. See D22 and
    StrategyRecordScreen.
  */
  includeTax: { key: 'includeTax', fallback: false, validate: (v) => typeof v === 'boolean' },
};

function available() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

/**
 * Read a preference, falling back to its default when absent, unparseable, or
 * no longer valid.
 */
export function getPref(name) {
  const spec = PREFERENCES[name];
  if (!spec) throw new Error(`getPref: unknown preference "${name}"`);
  if (!available()) return spec.fallback;

  try {
    const raw = localStorage.getItem(PREFIX + spec.key);
    if (raw === null) return spec.fallback;
    const value = JSON.parse(raw);
    return spec.validate(value) ? value : spec.fallback;
  } catch {
    return spec.fallback;
  }
}

/**
 * Write a preference. Returns false if it could not be stored or the value
 * failed validation — callers may ignore that, since losing a remembered
 * chart range is not worth interrupting anyone over.
 */
export function setPref(name, value) {
  const spec = PREFERENCES[name];
  if (!spec) throw new Error(`setPref: unknown preference "${name}"`);
  if (!spec.validate(value)) return false;
  if (!available()) return false;

  try {
    localStorage.setItem(PREFIX + spec.key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearPref(name) {
  const spec = PREFERENCES[name];
  if (!spec || !available()) return false;
  try {
    localStorage.removeItem(PREFIX + spec.key);
    return true;
  } catch {
    return false;
  }
}

/** Every preference at once, for a Settings screen or a diagnostic. */
export function allPrefs() {
  return Object.fromEntries(Object.keys(PREFERENCES).map((name) => [name, getPref(name)]));
}
