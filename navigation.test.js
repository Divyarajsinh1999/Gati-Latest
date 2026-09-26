// @vitest-environment jsdom
/**
 * jsdom, because the preference store reads real localStorage. The route and
 * view-state suites are pure and would run anywhere; keeping them together
 * matters more than the few milliseconds jsdom costs, since they describe one
 * subsystem and are read as one file.
 *
 * M5 NAVIGATION TESTS — the URL model, preferences, and context preservation.
 *
 * The assertions that matter most here are the ones about NOT LOSING THINGS:
 * a shared link that silently shows a different window, a bookmark that lands
 * on a blank page, a scroll position thrown away on the way back from a stock.
 * Each is quiet, each is infuriating, and none of them shows up as an error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parsePath, resolveFallback, universePath, rankingPath, recordPath, stockPath,
  strategyKeyFor, parseStrategyKey, isValidUniverse, isValidWindow,
  windowToMonths, monthsToWindow, navDestinations,
  WINDOW_SLUGS, DEFAULT_WINDOW,
} from '../../config/routes.js';
import { getPref, setPref, clearPref, PREFERENCES } from '../../preferences/prefStore.js';
import {
  readViewState, writeViewState, clearViewState, clearUniverseViewState,
  viewStateSize, viewKey, restoreScroll,
} from '../viewState.js';
import { UNIVERSE_KEYS } from '../../config/universes.js';
import { STRATEGIES } from '../../config/strategies.js';

/* ------------------------------------------------------------------ */
/* URL MODEL                                                           */
/* ------------------------------------------------------------------ */

describe('building paths', () => {
  it('omits the default window so the common URL stays short', () => {
    expect(universePath('nifty50')).toBe('/nifty50');
    expect(universePath('nifty50', '1m')).toBe('/nifty50');
  });

  it('includes a non-default window so it is shareable', () => {
    expect(universePath('midcap150', '3m')).toBe('/midcap150/3m');
    expect(universePath('smallcap250', '12m')).toBe('/smallcap250/12m');
  });

  it('builds sub-view paths without repeating the window', () => {
    // /nifty50/3m/all would force a decision about what /nifty50/all means.
    expect(rankingPath('nifty50')).toBe('/nifty50/all');
    expect(recordPath('nifty50')).toBe('/nifty50/record');
    expect(stockPath('nifty50', 'TITAN.NS')).toBe('/nifty50/stock/TITAN.NS');
  });

  it('never builds a path for an invalid universe', () => {
    expect(universePath('nonsense')).toBe('/');
    expect(rankingPath('nonsense')).toBe('/');
    expect(stockPath('nifty50', '')).toBe('/');
  });
});

describe('parsing paths', () => {
  it('resolves a bare universe with no explicit window', () => {
    expect(parsePath('/nifty50')).toEqual({ kind: 'universe', universeKey: 'nifty50', window: null });
  });

  it('resolves an explicit window', () => {
    expect(parsePath('/midcap150/6m')).toEqual({ kind: 'universe', universeKey: 'midcap150', window: '6m' });
  });

  it('treats reserved segments as sub-views, never as windows', () => {
    expect(parsePath('/nifty50/all').kind).toBe('ranking');
    expect(parsePath('/nifty50/record').kind).toBe('record');
    expect(parsePath('/nifty50/stock/TITAN.NS')).toEqual({
      kind: 'stock', universeKey: 'nifty50', symbol: 'TITAN.NS',
    });
  });

  it('decodes an encoded symbol', () => {
    expect(parsePath('/nifty50/stock/M%26M.NS').symbol).toBe('M&M.NS');
  });

  it('resolves top-level destinations', () => {
    expect(parsePath('/reports').kind).toBe('reports');
    expect(parsePath('/settings').kind).toBe('settings');
    expect(parsePath('/methodology').kind).toBe('methodology');
  });

  it('reports WHY an unknown path failed rather than just failing', () => {
    const bad = parsePath('/nifty50/9m');
    expect(bad.kind).toBe('unknown');
    expect(bad.reason).toContain('not a measurement window');
    expect(bad.universeKey).toBe('nifty50');
  });

  it('handles trailing slashes and empty paths', () => {
    expect(parsePath('/').kind).toBe('root');
    expect(parsePath('').kind).toBe('root');
    expect(parsePath('/nifty50/').kind).toBe('universe');
  });
});

describe('fallbacks — a bad URL never produces a blank page', () => {
  it('keeps the valid half of a path', () => {
    // Someone who typed a bad window on a real universe should still land on
    // that universe. Throwing away the half that worked helps nobody.
    const fallback = resolveFallback(parsePath('/nifty50/9m'));
    expect(fallback.path).toBe('/nifty50');
    expect(fallback.message).toContain('NIFTY 50');
  });

  it('falls back to the root when nothing in the path was valid', () => {
    const fallback = resolveFallback(parsePath('/not-a-universe'));
    expect(fallback.path).toBe('/');
    expect(fallback.message).toContain('not a universe');
  });

  it('always explains itself', () => {
    for (const path of ['/nope', '/nifty50/99m', '/nifty50/stock']) {
      const fallback = resolveFallback(parsePath(path));
      expect(fallback.message.length).toBeGreaterThan(10);
    }
  });

  it('returns null for a path that parsed fine', () => {
    expect(resolveFallback(parsePath('/nifty50'))).toBeNull();
  });
});

describe('strategy key translation', () => {
  it('round-trips every registered strategy', () => {
    // If this breaks, a legacy bookmark lands on the wrong window and nothing
    // says so — the quietest possible regression.
    for (const key of Object.keys(STRATEGIES)) {
      const parsed = parseStrategyKey(key);
      expect(parsed, `${key} did not parse`).toBeTruthy();
      expect(strategyKeyFor(parsed.universeKey, parsed.window)).toBe(key);
    }
  });

  it('keeps the bare universe key for the 1-month rule', () => {
    // Changing it would have been tidier and would have broken every CSV
    // filename and bookmark generated before the multi-window release.
    expect(strategyKeyFor('nifty50', '1m')).toBe('nifty50');
    expect(strategyKeyFor('midcap150', '3m')).toBe('midcap150-rs-3m');
  });

  it('returns null rather than a plausible-looking wrong key', () => {
    expect(strategyKeyFor('nonsense', '1m')).toBeNull();
    expect(strategyKeyFor('nifty50', '9m')).toBeNull();
    expect(parseStrategyKey('not-real')).toBeNull();
  });
});

describe('validation helpers', () => {
  it('accepts exactly the registered universes', () => {
    for (const key of UNIVERSE_KEYS) expect(isValidUniverse(key)).toBe(true);
    for (const bad of ['', 'NIFTY50', 'reports', 'all', null]) expect(isValidUniverse(bad)).toBe(false);
  });

  it('converts windows both ways', () => {
    for (const slug of WINDOW_SLUGS) {
      expect(monthsToWindow(windowToMonths(slug))).toBe(slug);
      expect(isValidWindow(slug)).toBe(true);
    }
    expect(windowToMonths('9m')).toBeNull();
    expect(monthsToWindow(9)).toBeNull();
  });
});

describe('navigation destinations', () => {
  it('renders from the registry, so adding a universe is a config entry', () => {
    const destinations = navDestinations();
    expect(destinations).toHaveLength(UNIVERSE_KEYS.length + 3);
    expect(destinations.slice(0, UNIVERSE_KEYS.length).map((d) => d.key)).toEqual(UNIVERSE_KEYS);
    // Order runs from what the model says, to what the reader owns, to the
    // record behind both.
    expect(destinations.at(-3).key).toBe('portfolio');
    expect(destinations.at(-2).key).toBe('reports');
    expect(destinations.at(-1).key).toBe('settings');
  });

  it('never contains a Dashboard or a Calculator', () => {
    // Phase 1 decisions 1 and 3: universe-first, and sizing lives inside a
    // universe rather than as a peer destination.
    const keys = navDestinations().map((d) => d.key);
    expect(keys).not.toContain('dashboard');
    expect(keys).not.toContain('calculator');
  });
});

/* ------------------------------------------------------------------ */
/* PREFERENCES                                                         */
/* ------------------------------------------------------------------ */

describe('preference store', () => {
  beforeEach(() => {
    for (const name of Object.keys(PREFERENCES)) clearPref(name);
  });

  it('round-trips a valid value', () => {
    expect(setPref('lastUniverse', 'midcap150')).toBe(true);
    expect(getPref('lastUniverse')).toBe('midcap150');
  });

  it('falls back to the default when nothing is stored', () => {
    expect(getPref('lastWindow')).toBe(DEFAULT_WINDOW);
    expect(getPref('investmentAmount')).toBeNull();
  });

  it('REJECTS an invalid value rather than storing it', () => {
    expect(setPref('lastWindow', '9m')).toBe(false);
    expect(setPref('investmentAmount', -5)).toBe(false);
    expect(setPref('investmentAmount', 0)).toBe(false);
    expect(getPref('lastWindow')).toBe(DEFAULT_WINDOW);
  });

  it('ignores a STALE stored value from an earlier release', () => {
    // A universe key that no longer exists must not propagate into a route
    // and produce a blank screen on someone's next visit.
    localStorage.setItem('gati.pref.lastWindow', JSON.stringify('99m'));
    expect(getPref('lastWindow')).toBe(DEFAULT_WINDOW);
  });

  it('survives unparseable storage', () => {
    localStorage.setItem('gati.pref.lastUniverse', '{not json');
    expect(getPref('lastUniverse')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('blocked'); },
    });
    expect(() => getPref('lastUniverse')).not.toThrow();
    expect(getPref('lastWindow')).toBe(DEFAULT_WINDOW);
    expect(setPref('lastUniverse', 'nifty50')).toBe(false);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  });

  it('refuses an unknown preference name loudly', () => {
    expect(() => getPref('nope')).toThrow(/unknown preference/);
  });
});

/* ------------------------------------------------------------------ */
/* VIEW STATE                                                          */
/* ------------------------------------------------------------------ */

describe('view state — not losing the user’s place', () => {
  beforeEach(() => clearViewState());

  it('remembers and restores per route', () => {
    writeViewState('/nifty50/all', { scrollTop: 4200, search: 'TITAN', filter: 'positive' });
    const state = readViewState('/nifty50/all');
    expect(state).toEqual({ scrollTop: 4200, search: 'TITAN', filter: 'positive' });
  });

  it('merges rather than replacing, so one component cannot clobber another', () => {
    writeViewState('/nifty50/all', { scrollTop: 100 });
    writeViewState('/nifty50/all', { search: 'HDFC' });
    expect(readViewState('/nifty50/all')).toEqual({ scrollTop: 100, search: 'HDFC' });
  });

  it('keeps routes independent', () => {
    writeViewState('/nifty50/all', { scrollTop: 100 });
    writeViewState('/midcap150/all', { scrollTop: 900 });
    expect(readViewState('/nifty50/all').scrollTop).toBe(100);
  });

  it('ignores a trailing slash, because it is the same place to a person', () => {
    writeViewState('/nifty50/all', { scrollTop: 50 });
    expect(readViewState('/nifty50/all/').scrollTop).toBe(50);
    expect(viewKey('/nifty50/all/')).toBe('/nifty50/all');
  });

  it('returns an empty object for an unvisited route, never null', () => {
    expect(readViewState('/never-visited')).toEqual({});
  });

  it('is bounded, so browsing 250 stocks does not leak state', () => {
    for (let i = 0; i < 60; i++) writeViewState(`/nifty50/stock/SYM${i}`, { scrollTop: i });
    expect(viewStateSize()).toBeLessThanOrEqual(30);
    // The most recent survive; the oldest are dropped.
    expect(readViewState('/nifty50/stock/SYM59').scrollTop).toBe(59);
    expect(readViewState('/nifty50/stock/SYM0')).toEqual({});
  });

  it('re-writing refreshes recency rather than aging out', () => {
    writeViewState('/keep-me', { scrollTop: 1 });
    for (let i = 0; i < 29; i++) {
      writeViewState(`/filler${i}`, { scrollTop: i });
      writeViewState('/keep-me', { scrollTop: 1 });
    }
    expect(readViewState('/keep-me').scrollTop).toBe(1);
  });

  it('clears a whole universe when its data changes underneath', () => {
    // A rebalance reorders the ranking, so row 180 is no longer the row the
    // user was reading. A remembered position would be misleading.
    writeViewState('/nifty50', { scrollTop: 1 });
    writeViewState('/nifty50/all', { scrollTop: 2 });
    writeViewState('/midcap150/all', { scrollTop: 3 });

    expect(clearUniverseViewState('nifty50')).toBe(2);
    expect(readViewState('/midcap150/all').scrollTop).toBe(3);
  });
});

describe('restoreScroll', () => {
  const doubleRaf = (fn) => fn();

  it('does nothing for a zero or missing position', () => {
    const scrollTo = vi.fn();
    expect(restoreScroll(0, { scroller: { scrollTo }, raf: doubleRaf })).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('restores when the page is tall enough', () => {
    const scrollTo = vi.fn();
    restoreScroll(4200, {
      scroller: { scrollTo, innerHeight: 800, document: { documentElement: { scrollHeight: 9000 } } },
      raf: doubleRaf,
    });
    expect(scrollTo).toHaveBeenCalledWith({ top: 4200, behavior: 'instant' });
  });

  it('GIVES UP rather than landing somewhere the user never was', () => {
    // Scrolling to an approximate position is worse than an obvious reset.
    const scrollTo = vi.fn();
    restoreScroll(4200, {
      scroller: { scrollTo, innerHeight: 800, document: { documentElement: { scrollHeight: 1200 } } },
      raf: doubleRaf,
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
