/**
 * GATI DOMAIN TYPES — the single source of truth for every data shape that
 * crosses a layer boundary.
 *
 * WHAT THIS FILE OWNS
 *   The six data-model types from the approved architecture, plus the error
 *   contract. Every layer speaks these shapes and no layer redeclares them.
 *
 * WHAT THIS FILE MUST NEVER DO
 *   Contain logic, defaults, or runtime values. It is types only, so it is
 *   erased at build time and can be imported from anywhere — including a Web
 *   Worker — without pulling in a dependency.
 *
 * THE ONE RULE THAT MATTERS HERE
 *   A financial value that can be absent is typed `number | null`, never
 *   `number | undefined` and never optional. Optional-and-assumed is precisely
 *   how a missing price becomes a NaN, and a NaN in a ranking is silent: it
 *   sorts somewhere plausible and nobody notices. `null` forces the caller to
 *   decide, which is the whole point.
 *
 * Legacy .js modules can consume these through JSDoc:
 *     @typedef {import('../types/domain').PriceBar} PriceBar
 */

/* ------------------------------------------------------------------ */
/* 1 · PriceBar — the atomic unit of truth                            */
/* ------------------------------------------------------------------ */

/**
 * One trading day for one symbol. Everything in Gati is ultimately derived
 * from an array of these.
 *
 * Missing fields are `null`, NEVER `0`. A zero price is a real price and a
 * catastrophic one: it produces a division by zero or an infinite return.
 */
export interface PriceBar {
  /** ISO calendar date, `YYYY-MM-DD`. Compared as a string — faster than Date
   *  parsing and immune to timezone drift, which matters because month-end
   *  detection is driven entirely by these values. */
  readonly date: string;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly close: number | null;
  /** Split- and dividend-adjusted close. The basis for ALL return maths.
   *  Rewritten retroactively by the provider on every corporate action, which
   *  is why snapshots are compared rather than trusted (decision D7). */
  readonly adjClose: number | null;
  readonly volume: number | null;
}

/** Which price field a value came from. A ratio may only be formed from two
 *  prices carrying the SAME basis — mixing them across a 1:5 split reports a
 *  5% gain as a 79% crash, and that stock is then ranked last forever. */
export type PriceBasis = 'adjClose' | 'close';

/* ------------------------------------------------------------------ */
/* 2 · PriceSeries — bars plus provenance                             */
/* ------------------------------------------------------------------ */

/**
 * An ascending, gap-preserving series for one symbol.
 *
 * GAPS ARE PRESERVED, NEVER INTERPOLATED. A missing week is a missing week;
 * inventing bars to smooth a chart would put fabricated prices into a ranking.
 */
export interface PriceSeries {
  readonly symbol: string;
  /** Ascending by date, deduplicated. Asserted at the data boundary so engines
   *  never re-check it per call. */
  readonly bars: readonly PriceBar[];
  readonly provenance: SeriesProvenance;
}

export interface SeriesProvenance {
  /** Provider id, e.g. `'yahoo'` | `'mock'`. Surfaced in data-quality notes. */
  readonly source: string;
  /** Epoch ms of the fetch that produced this series. */
  readonly fetchedAt: number;
  /** Range actually covered, which may be narrower than the range requested —
   *  the difference is a data-quality finding, not something to paper over. */
  readonly coverageStart: string | null;
  readonly coverageEnd: string | null;
  readonly rowCount: number;
}

/* ------------------------------------------------------------------ */
/* 3 · MonthEndIndex — derived once, shared everywhere                */
/* ------------------------------------------------------------------ */

/**
 * The last bar ACTUALLY PRESENT in each calendar month, keyed `YYYY-MM`.
 *
 * Never assume a calendar date is a trading day. Weekends and holidays are
 * simply absent from the series, so deriving month-ends from data presence
 * handles them correctly with zero holiday-list maintenance.
 *
 * Built ONCE per series per compute pass and threaded through. Rebuilding it
 * inside a ranking loop is an O(n²) trap.
 */
export interface MonthEndEntry {
  /** `YYYY-MM`. */
  readonly monthKey: string;
  /** The actual trading date used — e.g. `2025-03-28` for a March whose 31st
   *  fell on a holiday. This is the "previous month's official close" date and
   *  it is never estimated. */
  readonly date: string;
  readonly bar: PriceBar;
}

export type MonthEndIndex = readonly MonthEndEntry[];

/* ------------------------------------------------------------------ */
/* 4 · Quote — live, display-only                                     */
/* ------------------------------------------------------------------ */

/**
 * A live snapshot.
 *
 * NEVER ENTERS A RETURN CALCULATION. A quote is an unadjusted raw price;
 * dividing it by an adjusted month-end close breaks across any corporate
 * action since that month-end. The current day's own bar already tracks the
 * live price and is on the correct basis.
 */
export interface Quote {
  readonly symbol: string;
  readonly price: number | null;
  /** Day change, percent. Display column only. */
  readonly changePct: number | null;
  /** ISO timestamp from the provider, or null if it didn't supply one. */
  readonly asOf: string | null;
  readonly volume: number | null;
  /** True when the provider reports a non-regular session. Null when unknown —
   *  which is different from "fresh", and the UI distinguishes them. */
  readonly isStale: boolean | null;
  readonly name: string | null;
  readonly error?: string;
}

/* ------------------------------------------------------------------ */
/* 5 · RawUniverseBundle — everything fetched, nothing computed       */
/* ------------------------------------------------------------------ */

export interface UnavailableSymbol {
  readonly symbol: string;
  readonly reason: string;
  /** A possible replacement ticker. NEVER auto-adopted — adopting a guess
   *  pulls a different company's prices into the rankings with full
   *  confidence, which is the worst failure this product can produce. */
  readonly suggestion: string | null;
}

export interface RawUniverseBundle {
  readonly universeKey: string;
  readonly stocks: readonly UniverseStock[];
  readonly priceSeriesMap: ReadonlyMap<string, PriceSeries>;
  readonly benchmarkSymbol: string;
  readonly benchmarkSeries: PriceSeries | null;
  readonly quotes: ReadonlyMap<string, Quote> | null;
  /** Quote failure is INDEPENDENT of history failure: the record and rankings
   *  still render from last close. Collapsing these two into one error state
   *  would blank a working screen because a display column failed. */
  readonly quotesError: GatiError | null;
  readonly unavailableSymbols: readonly UnavailableSymbol[];
  /** Newest bar date across the bundle — the "data as of" the UI shows. */
  readonly dataAsOf: string | null;
  readonly providerId: string;
}

export interface UniverseStock {
  readonly symbol: string;
  readonly name: string;
  readonly sector: string | null;
}

/* ------------------------------------------------------------------ */
/* 6 · DerivedUniverseBundle — computed, never persisted              */
/* ------------------------------------------------------------------ */

/**
 * Output of the derived pipeline for one (universe × window).
 *
 * NEVER PERSISTED and never placed in a query key. It is cheap to rebuild and
 * expensive to invalidate correctly; a stale derived value is a wrong number
 * displayed with confidence.
 */
export interface DerivedUniverseBundle {
  readonly universeKey: string;
  readonly lookbackMonths: number;
  readonly backtest: unknown;
  readonly currentMomentum: unknown;
  readonly rsHistory: ReadonlyMap<string, readonly RSHistoryPoint[]>;
  readonly changes: unknown;
  readonly historySufficiency: unknown;
  readonly flags: readonly string[];
}

/**
 * One completed month-end in a stock's trailing RS series.
 * A month with no data for that stock produces a GAP — the entry is absent.
 * It is never a zero and never a carried-forward value.
 */
export interface RSHistoryPoint {
  readonly monthKey: string;
  readonly signalDate: string;
  readonly stockReturnPct: number | null;
  readonly benchmarkReturnPct: number | null;
  /** Percentage POINTS, not percent. Formatted `pp` everywhere. */
  readonly rs: number | null;
  readonly rank: number | null;
  readonly wasInTopN: boolean;
  readonly flags: readonly string[];
}

/* ------------------------------------------------------------------ */
/* 7 · Error contract                                                 */
/* ------------------------------------------------------------------ */

export type ErrorKind =
  | 'network' | 'upstream' | 'auth' | 'not-found'
  | 'validation' | 'quota' | 'storage';

/**
 * SCOPE DETERMINES UI TREATMENT, and this mapping is fixed:
 *   symbol   → one flagged, unranked row; everything else renders
 *   quotes   → degraded status line; the record stays intact
 *   universe → blocking error state; no numbers at all
 *   app      → offline / cold state
 * The asymmetry is the reliability design. Collapsing it into one generic
 * handler is how a single dead ticker blanks an entire screen.
 */
export type ErrorScope = 'symbol' | 'quotes' | 'universe' | 'app';

export interface GatiError {
  readonly kind: ErrorKind;
  readonly scope: ErrorScope;
  readonly message: string;
  readonly symbol?: string;
  readonly retryable: boolean;
}
