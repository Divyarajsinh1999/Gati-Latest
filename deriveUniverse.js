/**
 * DERIVE UNIVERSE — the single derived-data pipeline.
 *
 * RETAINED, DELIBERATELY UNWIRED — decision D16. See computeScheduler.js for
 * the full rationale. Do not delete as dead code; do not wire without a
 * measured bottleneck.
 *
 * WHAT THIS OWNS
 *   Turning a raw bundle plus strategy parameters into everything the screens
 *   need, exactly once, in one place.
 *
 * WHAT THIS MUST NEVER DO
 *   Fetch, or persist its output. Derived data is cheap to rebuild and
 *   expensive to invalidate correctly; a stale derived value is a wrong number
 *   shown with confidence.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE SPLIT, AND WHY IT IS THE MOST IMPORTANT DECISION IN THIS FILE
 *
 *   HEAVY  depends only on BARS      → backtest, rankings, RS history,
 *                                       change detection, snapshots
 *   LIGHT  depends on QUOTES + AMOUNT → live prices, day change, sizing
 *
 * Quotes refresh every 30 seconds while the market is open. Without this
 * split, each of those ticks would re-run a full 250-symbol backtest on the
 * render thread — measured at 120-200ms — and the app would stutter twice a
 * minute for no reason at all, because not one number in the backtest depends
 * on a live quote.
 *
 * With the split, a quote tick costs a linear pass over the ranked rows.
 * Typing in the Investment Simulator costs the same. The heavy pass runs only
 * when the bars change or a strategy parameter changes, which is rare.
 *
 * This is also why the heavy pass can move to a Web Worker as a configuration
 * change rather than a refactor: it takes plain data in and returns plain data
 * out, with no reference to quotes, the DOM, or anything that cannot cross a
 * structured-clone boundary.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { runBacktest } from '../engine/backtestEngine.js';
import { computeCurrentMomentum } from '../engine/currentMomentum.js';
import { buildRSHistory, attachRSHistory, RS_HISTORY_MONTHS } from '../engine/rsHistory.js';
import { detectChanges, tradingDaysToRebalance } from '../engine/changeDetection.js';
import { assessHistorySufficiency } from '../engine/historySufficiency.js';
import { buildSnapshot } from '../engine/snapshots.js';
import { allocate, SIMULATOR_WEIGHTING, RECORD_WEIGHTING } from '../engine/weighting.js';
import { calculateExecutionQuality, compareIdealToExecutable, minimumViableCapital } from '../engine/executionMetrics.js';
import { TOP_N } from '../config/constants.js';

/**
 * HEAVY PASS — everything derived from bars alone.
 *
 * Pure and synchronous. Takes no quotes, reads no clock, touches no storage.
 *
 * @param {object} args
 * @param {Array} args.stocks
 * @param {Map} args.priceSeriesMap
 * @param {Array} args.benchmarkSeries
 * @param {Array} [args.unavailableSymbols]
 * @param {string} args.universeKey
 * @param {number} [args.lookbackMonths]
 * @param {number} [args.topN]
 * @param {object} [args.costConfig]
 */
export function deriveHeavy({
  stocks = [],
  priceSeriesMap,
  benchmarkSeries = [],
  unavailableSymbols = [],
  universeKey,
  lookbackMonths = 1,
  topN = TOP_N,
  costConfig,
} = {}) {
  // The published record. Always fractional — decision D1.
  const backtest = runBacktest({
    stocks,
    priceSeriesMap,
    benchmarkSeries,
    topN,
    costConfig,
    lookbackMonths,
    weighting: RECORD_WEIGHTING,
  });

  // A by-product of the pass above, not a second pass over the data.
  const rsHistoryBySymbol = buildRSHistory({
    rankingHistory: backtest.rankingHistory,
    months: RS_HISTORY_MONTHS,
    topN,
  });

  const changes = detectChanges({ rankingHistory: backtest.rankingHistory, topN });
  const daysToRebalance = tradingDaysToRebalance(benchmarkSeries);

  const historySufficiency = assessHistorySufficiency({
    cyclesCount: backtest.cycles.length,
    lookbackMonths,
  });

  // Snapshots for the completed months only. The current, still-forming month
  // has no signal yet and must never be frozen as though it did.
  const snapshots = backtest.rankingHistory.map((rankingSnapshot) =>
    buildSnapshot({ universeKey, lookbackMonths, rankingSnapshot, topN }),
  );

  // Ranking without quotes, so the heavy pass is genuinely quote-free. The
  // light pass overlays live prices onto these rows.
  const momentum = computeCurrentMomentum({
    stocks,
    priceSeriesMap,
    benchmarkSeries,
    quotes: null,
    topN,
    unavailableSymbols,
    lookbackMonths,
  });

  const rankedWithHistory = attachRSHistory(momentum.ranked, rsHistoryBySymbol);

  return {
    universeKey,
    lookbackMonths,
    topN,
    backtest,
    momentum: { ...momentum, ranked: rankedWithHistory },
    rsHistoryBySymbol,
    changes,
    daysToRebalance,
    historySufficiency,
    snapshots,
    flags: [...backtest.flags, ...momentum.flags],
  };
}

/**
 * LIGHT PASS — overlay live quotes onto an already-derived heavy result.
 *
 * Runs on every 30-second tick. One linear pass, no re-ranking, no re-sorting.
 *
 * WHY THE RANKING IS NOT RECOMPUTED HERE
 *   RS is measured from the price SERIES, not from live quotes — a quote is
 *   unadjusted, and dividing it by an adjusted month-end close breaks across
 *   any corporate action since. The current day's own bar already tracks the
 *   live price on the correct basis. So a quote changes what is DISPLAYED in
 *   the price and day-change columns, and nothing about the ordering.
 */
export function deriveLight({ heavy, quotes = null } = {}) {
  if (!heavy) return null;
  if (!quotes || quotes.size === 0) {
    return { ...heavy, quotesApplied: false };
  }

  const applyQuote = (row) => {
    const quote = quotes.get(row.symbol);
    if (!quote || quote.price == null) return row;
    return {
      ...row,
      currentPrice: quote.price,
      dailyChangePct: quote.changePct ?? row.dailyChangePct,
      dailyChangeIsLive: quote.changePct != null,
      volume: quote.volume ?? row.volume,
      quoteAsOf: quote.asOf ?? null,
      quoteIsStale: quote.isStale ?? null,
    };
  };

  const ranked = heavy.momentum.ranked.map(applyQuote);
  // Picks are the first N of the same ordering, so they are re-projected from
  // the updated rows rather than mapped a second time.
  const pickSymbols = new Set(heavy.momentum.picks.map((p) => p.symbol));

  return {
    ...heavy,
    momentum: {
      ...heavy.momentum,
      ranked,
      picks: ranked.filter((r) => pickSymbols.has(r.symbol)),
    },
    quotesApplied: true,
  };
}

/**
 * SIZING — the Investment Simulator (decision D1).
 *
 * Whole-share execution at the user's own amount, with the cost of lot sizes
 * made explicit. Runs on every keystroke, so it must stay allocation-light:
 * one pass over at most N picks, no re-ranking, no network, no re-derivation.
 *
 * Returns null when no amount has been entered. The recommendation never
 * depends on the amount, so the absence of one removes the sizing and nothing
 * else.
 */
export function deriveSizing({ derived, capital, idealReturnPct = null } = {}) {
  if (!derived || !(capital > 0)) return null;

  const picks = derived.momentum.picks
    .filter((p) => p.currentPrice > 0)
    .map((p) => ({ symbol: p.symbol, name: p.name, entryPrice: p.currentPrice }));

  if (picks.length === 0) return null;

  const allocation = allocate(picks, capital, SIMULATOR_WEIGHTING);
  const quality = calculateExecutionQuality({
    capital,
    totalInvested: allocation.totalInvested,
    positions: allocation.positions,
  });

  return {
    capital,
    basis: SIMULATOR_WEIGHTING,
    positions: allocation.positions,
    totalInvested: allocation.totalInvested,
    idleCash: allocation.remainingCash,
    execution: quality,
    minimumViableCapital: minimumViableCapital(picks, picks.length),
    // Populated when an executable return has been computed for this amount.
    // Left explicit rather than silently absent so the UI can distinguish
    // "not requested" from "could not be computed".
    idealVsExecutable: idealReturnPct != null ? compareIdealToExecutable({ idealReturnPct, executableReturnPct: null }) : null,
  };
}

/**
 * The executable-return comparison: the same signals re-run under whole-share
 * flooring at the user's amount.
 *
 * DELIBERATELY SEPARATE from deriveSizing, and deliberately not called on
 * every keystroke. It re-runs a full backtest, so it belongs behind an
 * explicit request — a "show me what my amount would actually have returned"
 * action — rather than in the typing path.
 */
export function deriveExecutableRecord({
  stocks,
  priceSeriesMap,
  benchmarkSeries,
  capital,
  lookbackMonths = 1,
  topN = TOP_N,
  costConfig,
  idealReturnPct,
}) {
  const executable = runBacktest({
    stocks,
    priceSeriesMap,
    benchmarkSeries,
    initialCapital: capital,
    topN,
    costConfig,
    lookbackMonths,
    weighting: SIMULATOR_WEIGHTING,
  });

  const last = executable.equityCurve[executable.equityCurve.length - 1];
  const executableReturnPct = last ? last.indexValue - 100 : null;

  const avgIdlePct = executable.cycles.length
    ? (executable.cycles.reduce((sum, c) => sum + c.cashCarriedIn / c.capitalAtStart, 0) / executable.cycles.length) * 100
    : null;

  return {
    capital,
    executable,
    executableReturnPct,
    avgIdleCashPct: avgIdlePct,
    comparison: compareIdealToExecutable({ idealReturnPct, executableReturnPct }),
  };
}
