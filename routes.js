/**
 * ROUTES — the URL model, expressed as data.
 *
 * WHAT THIS OWNS
 *   Which URLs exist, how to build them, and how to parse them back into a
 *   universe and a measurement window.
 *
 * WHAT THIS MUST NEVER DO
 *   Import a routing library, React, or anything below it. These are pure
 *   string functions over the universe and strategy registries, which is what
 *   lets them be tested exhaustively without mounting a router.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MODEL
 *
 *   /nifty50                     universe, window from preference
 *   /nifty50/3m                  universe at an explicit window
 *   /nifty50/all                 full ranking      (window inherited)
 *   /nifty50/record              strategy record   (window inherited)
 *   /nifty50/stock/TITAN.NS      universe with the stock sheet open
 *   /reports  /settings  /methodology
 *
 * WHY THE WINDOW IS IN THE PATH BUT NOT ON SUB-VIEWS
 *   `/nifty50/3m` has to be shareable — sending someone a 3-month ranking is
 *   a real thing people do. But repeating it on every sub-view would produce
 *   `/nifty50/3m/all` and force a decision about what `/nifty50/all` alone
 *   means. Sub-views inherit the window from the active preference instead,
 *   which keeps every URL unambiguous and every path short.
 *
 * WHY STATIC SEGMENTS OUTRANK THE WINDOW
 *   `all`, `record` and `stock` are reserved words. A universe route whose
 *   second segment is not a known window is not a window — it is one of
 *   these, or it is invalid. Validation is explicit rather than relying on
 *   the router's ranking rules, so the behaviour is testable in isolation.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { UNIVERSES, UNIVERSE_KEYS } from './universes.js';
import { STRATEGIES } from './strategies.js';

/** Window slugs, in display order. */
export const WINDOW_SLUGS = ['1m', '3m', '6m', '12m'];

/** The window a universe opens at when nothing else is remembered. */
export const DEFAULT_WINDOW = '1m';

/** Reserved second segments. A universe may never be named one of these. */
export const RESERVED_SEGMENTS = ['all', 'record', 'stock'];

/**
 * Top-level destinations that are not universes.
 *
 * M14 added `strategies`, and also added the four that were MISSING:
 * `portfolio`, `how-it-works` and `about` are real routes in App.jsx but were
 * absent here, so `parsePath('/portfolio')` answered "not a universe". Nothing
 * broke, because the only caller was the catch-all — which those paths never
 * reach. It became visible the moment something else needed to name the
 * current route. Listing every real top-level path is the fix; a parser that
 * is right only for the paths its one caller happens to pass is a parser that
 * will mislead the next caller.
 */
export const TOP_LEVEL = [
  'reports', 'settings', 'methodology', 'strategies', 'portfolio',
  'how-it-works', 'about', 'paper-log',
];

/** Slug → months. */
export function windowToMonths(slug) {
  const months = Number(String(slug).replace('m', ''));
  return WINDOW_SLUGS.includes(slug) ? months : null;
}

/** Months → slug. */
export function monthsToWindow(months) {
  const slug = `${months}m`;
  return WINDOW_SLUGS.includes(slug) ? slug : null;
}

export function isValidUniverse(key) {
  return UNIVERSE_KEYS.includes(key);
}

export function isValidWindow(slug) {
  return WINDOW_SLUGS.includes(slug);
}

/**
 * The strategy key for a universe and window.
 *
 * The 1-month rule keeps the bare universe key as its strategy id, so every
 * CSV filename, bookmark and export generated before the multi-window release
 * stays valid. Changing it would have been tidier and would have broken
 * things people already had.
 */
export function strategyKeyFor(universeKey, windowSlug = DEFAULT_WINDOW) {
  if (!isValidUniverse(universeKey)) return null;
  const key = windowSlug === '1m' ? universeKey : `${universeKey}-rs-${windowSlug}`;
  return STRATEGIES[key] ? key : null;
}

/** Reverse: a legacy strategy key back into a universe and window. */
export function parseStrategyKey(strategyKey) {
  const strategy = STRATEGIES[strategyKey];
  if (!strategy) return null;
  return {
    universeKey: strategy.universeKey,
    window: monthsToWindow(strategy.lookbackMonths) ?? DEFAULT_WINDOW,
  };
}

/* ------------------------------------------------------------------ */
/* BUILDING                                                            */
/* ------------------------------------------------------------------ */

/**
 * Path for a universe.
 *
 * The window is omitted for the default so the common URL stays short —
 * `/nifty50` rather than `/nifty50/1m`. Both resolve identically.
 */
export function universePath(universeKey, windowSlug = DEFAULT_WINDOW) {
  if (!isValidUniverse(universeKey)) return '/';
  if (!isValidWindow(windowSlug) || windowSlug === DEFAULT_WINDOW) return `/${universeKey}`;
  return `/${universeKey}/${windowSlug}`;
}

export function rankingPath(universeKey) {
  return isValidUniverse(universeKey) ? `/${universeKey}/all` : '/';
}

export function recordPath(universeKey) {
  return isValidUniverse(universeKey) ? `/${universeKey}/record` : '/';
}

export function stockPath(universeKey, symbol) {
  if (!isValidUniverse(universeKey) || !symbol) return '/';
  return `/${universeKey}/stock/${encodeURIComponent(symbol)}`;
}

/* ------------------------------------------------------------------ */
/* PARSING                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a pathname into a typed destination.
 *
 * NEVER RETURNS A BLANK. An unrecognised path resolves to `{ kind: 'unknown' }`
 * carrying a reason, so the shell can redirect to a valid parent and say why
 * rather than rendering an empty page — which is indistinguishable from a
 * crash to the person looking at it.
 *
 * @returns {{kind:string, universeKey?:string, window?:string, symbol?:string, reason?:string}}
 */
export function parsePath(pathname) {
  const parts = String(pathname).split('/').filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0) return { kind: 'root' };

  const [first, second, third] = parts;

  if (TOP_LEVEL.includes(first)) {
    return { kind: first, section: second ?? null };
  }

  if (!isValidUniverse(first)) {
    return { kind: 'unknown', reason: `"${first}" is not a universe`, attempted: first };
  }

  if (second === undefined) {
    return { kind: 'universe', universeKey: first, window: null };
  }

  if (second === 'all') return { kind: 'ranking', universeKey: first };
  if (second === 'record') return { kind: 'record', universeKey: first };

  if (second === 'stock') {
    if (!third) return { kind: 'unknown', reason: 'No stock specified', universeKey: first };
    return { kind: 'stock', universeKey: first, symbol: third };
  }

  if (isValidWindow(second)) {
    return { kind: 'universe', universeKey: first, window: second };
  }

  return {
    kind: 'unknown',
    reason: `"${second}" is not a measurement window`,
    universeKey: first,
    attempted: second,
  };
}

/**
 * Where an unrecognised path should land, and what to tell the user.
 *
 * Always resolves to a real destination. Falling back to the root would be
 * simpler and would throw away the part of the URL that WAS valid — someone
 * who typed a bad window on a real universe should still land on that
 * universe.
 */
export function resolveFallback(parsed) {
  if (parsed.kind !== 'unknown') return null;
  if (parsed.universeKey && isValidUniverse(parsed.universeKey)) {
    return {
      path: universePath(parsed.universeKey),
      message: `${parsed.reason}. Showing ${UNIVERSES[parsed.universeKey].label} instead.`,
    };
  }
  return { path: '/', message: `${parsed.reason}. Showing your last universe instead.` };
}

/** Navigation destinations, in bottom-bar order. Rendered from this registry
 *  so adding a universe is a config entry and nothing else. */
export function navDestinations(activeWindow = DEFAULT_WINDOW) {
  // The window CARRIES ACROSS universe switches (decision D12). Comparing
  // large, mid and small caps at the same window is the whole point of having
  // three; resetting to a default on every switch would silently change what
  // is being compared, and the user would not be told.
  const slug = isValidWindow(activeWindow) ? activeWindow : DEFAULT_WINDOW;
  return [
    ...UNIVERSE_KEYS.map((key) => ({
      kind: 'universe',
      key,
      label: UNIVERSES[key].shortLabel,
      path: universePath(key, slug),
    })),
    /*
      PORTFOLIO SITS IN THE PRIMARY NAVIGATION, immediately after the three
      universes. It was reachable only by URL before v1.4.0 — the one screen
      about the reader's own money had no door.

      Placed before Reports deliberately: the order runs from what the model
      says, to what the reader owns, to the record behind both. "Mine" is a
      shorter label than "Portfolio" and fits a 320px bar without shrinking
      the type; the accessible name carries the full word.
    */
    { kind: 'portfolio', key: 'portfolio', label: 'Mine', title: 'My portfolio', path: '/portfolio' },
    { kind: 'reports', key: 'reports', label: 'Reports', path: '/reports' },
    { kind: 'settings', key: 'settings', label: 'Settings', path: '/settings' },
  ];
}

/* ------------------------------------------------------------------ */
/* THE TERMINAL SHELL'S DESTINATIONS — M14 (D18)                       */
/* ------------------------------------------------------------------ */

/**
 * The sidebar's two sections.
 *
 * WHY THIS EXISTS ALONGSIDE `navDestinations` RATHER THAN REPLACING IT
 *   `navDestinations` answers "which universe, at which window" and is what
 *   the universe tab strip renders. The sidebar answers "which VIEW of the
 *   active universe" — rank it, compare strategies, hold it, report on it.
 *   They are different questions, and the reference build separates them the
 *   same way: universes are tabs, views are nav items.
 *
 * WHY THE UNIVERSE IS A PARAMETER
 *   Three of these five destinations are per-universe routes. Passing the
 *   active universe in keeps the sidebar pointing at the universe the reader
 *   is actually looking at, so "Live Rankings" never silently switches them
 *   to large cap. The reference build has this bug — its nav is universe-
 *   agnostic and its tab strip is the only thing that moves.
 *
 * WHAT IS DELIBERATELY ABSENT
 *   "Divu's Opinion" (D20). WORKSPACE carries five, not six.
 */
export function terminalDestinations(universeKey, activeWindow = DEFAULT_WINDOW) {
  const key = isValidUniverse(universeKey) ? universeKey : UNIVERSE_KEYS[0];
  const slug = isValidWindow(activeWindow) ? activeWindow : DEFAULT_WINDOW;

  return [
    {
      section: 'WORKSPACE',
      items: [
        { key: 'command', label: 'Dashboard', path: universePath(key, slug), end: true },
        { key: 'ranking', label: 'Live Rankings', path: rankingPath(key) },
        { key: 'strategies', label: 'Strategies', path: '/strategies' },
        /*
          "My Portfolio", NOT the reference build's "Portfolio Lab".

          They are not the same screen. The reference's Portfolio Lab is a
          CAPITAL DEPLOYMENT PLANNER — enter an amount, see the whole-share
          split across the current Top 5. In Gati that is the Investment
          Simulator, and it lives inside the universe screen where the Top 5
          it plans against actually is (M6, S11).

          This route is the reader's REAL HOLDINGS, which the reference build
          has no equivalent of at all. Borrowing its label would put a
          planner's name on a records screen and quietly undo D1's separation
          of the two.
        */
        { key: 'portfolio', label: 'My Portfolio', path: '/portfolio' },
        { key: 'reports', label: 'Reports', path: '/reports' },
      ],
    },
    {
      section: 'SYSTEM',
      items: [
        // SYSTEM, not WORKSPACE (D26): a journal is consulted, not worked in.
        { key: 'paper', label: 'Paper log', path: '/paper-log' },
        { key: 'how', label: 'How it works', path: '/how-it-works' },
        { key: 'settings', label: 'Settings', path: '/settings' },
      ],
    },
  ];
}

/**
 * Breadcrumb trail for the topbar: always two levels, "Gati / <where>".
 *
 * Derived from the parsed path rather than from the nav registry, because a
 * route reachable only by deep link — a stock sheet, the record — still needs
 * a name up there. Returning a literal for those rather than falling through
 * to a blank is the difference between a breadcrumb and a decoration.
 */
export function breadcrumbFor(pathname) {
  const parsed = parsePath(pathname);
  switch (parsed.kind) {
    case 'root':
    case 'universe':   return 'Dashboard';
    case 'ranking':    return 'Live Rankings';
    case 'record':     return 'Strategy Record';
    case 'stock':      return parsed.symbol ?? 'Stock';
    case 'strategies': return 'Strategies';
    case 'paper-log':  return 'Paper log';
    case 'how-it-works': return 'How it works';
    case 'about':      return 'About Gati';
    case 'portfolio':  return 'My Portfolio';
    case 'reports':    return 'Reports';
    case 'settings':   return 'Settings';
    case 'methodology':return 'Methodology';
    default:           return 'Gati';
  }
}
