/**
 * REPORTS VIEW MODEL.
 *
 * WHAT THIS OWNS
 *   Shaping three universes' derived data into comparisons.
 *
 * WHAT THIS MUST NEVER DO
 *   Add across universes. Three portfolios measured against three different
 *   benchmarks are not addable, and a combined figure would describe nothing
 *   that exists. Every comparison here is side by side, never summed.
 */

import { UNIVERSES } from '../config/universes.js';
import { WINDOW_SLUGS } from '../config/routes.js';
import { runBacktest } from '../engine/backtestEngine.js';
import { formatPct, formatGap } from '../utils/formatters.js';

/* ------------------------------------------------------------------ */
/* UNIVERSE COMPARISON                                                 */
/* ------------------------------------------------------------------ */

/**
 * The three universes at the active window, side by side.
 *
 * A universe with no completed rebalance reports WHY rather than a zero. Zero
 * would claim the strategy broke even, which the data does not support.
 */
export function selectUniverseComparison(results = [], windowSlug = '1m') {
  return results.map(({ key, data }) => {
    const universe = UNIVERSES[key];
    const headline = data?.headline;

    if (!headline || headline.completedCycles === 0 || headline.outperformancePct == null) {
      return {
        key,
        label: universe?.label ?? key,
        available: false,
        reason: `No completed rebalance yet at the ${windowSlug} window`,
      };
    }

    return {
      key,
      label: universe?.label ?? key,
      available: true,
      strategyPct: headline.strategyReturnPct,
      benchmarkPct: headline.benchmarkReturnPct,
      outperformancePct: headline.outperformancePct,
      strategyLabel: formatPct(headline.strategyReturnPct),
      benchmarkLabel: formatPct(headline.benchmarkReturnPct),
      outperformanceLabel: signedPp(headline.outperformancePct),
      direction: headline.outperformancePct >= 0 ? 'gain' : 'loss',
      cycles: headline.completedCycles,
    };
  });
}

/* ------------------------------------------------------------------ */
/* WINDOW MATRIX                                                       */
/* ------------------------------------------------------------------ */

/**
 * Three universes x four windows.
 *
 * WHY THIS RE-RUNS THE BACKTEST RATHER THAN READING A CACHED RESULT
 *   The hook computes ONE window per universe — the active one. The other
 *   three are genuinely not computed anywhere, so there is nothing to read.
 *   Re-running them here is not duplication of an existing calculation; it is
 *   the only calculation of those figures.
 *
 *   It uses the same engine and the same already-fetched price series, so it
 *   cannot disagree with the universe screen: identical inputs, identical
 *   function, identical output.
 *
 * COST: twelve backtests, roughly 650ms measured. Which is why the section
 * that calls this is collapsed by default and computes on first open.
 */
export function selectWindowMatrix(results = []) {
  return results.map(({ key, data }) => {
    const universe = UNIVERSES[key];

    const cells = WINDOW_SLUGS.map((slug) => {
      if (!data?.stocks || !data?.benchmarkSeries) {
        return { window: slug, available: false };
      }

      const backtest = runBacktest({
        stocks: data.stocks,
        priceSeriesMap: data.priceSeriesMap,
        benchmarkSeries: data.benchmarkSeries,
        lookbackMonths: Number(slug.replace('m', '')),
      });

      if (backtest.cycles.length === 0 || backtest.equityCurve.length < 2) {
        return { window: slug, available: false, cycles: 0 };
      }

      const strategyPct = backtest.equityCurve[backtest.equityCurve.length - 1].indexValue - 100;
      const benchmarkPct =
        (backtest.cycles.reduce((acc, c) => acc * (1 + (c.benchmarkHoldingReturnPct ?? 0) / 100), 1) - 1) * 100;
      const outperformancePct = strategyPct - benchmarkPct;

      return {
        window: slug,
        available: true,
        outperformancePct,
        label: signedPp(outperformancePct),
        direction: outperformancePct >= 0 ? 'gain' : 'loss',
        // Shown beside every cell: a strong figure on three rebalances is not
        // the same claim as the same figure on eighteen.
        cycles: backtest.cycles.length,
      };
    });

    return { key, label: universe?.shortLabel ?? key, cells };
  });
}

/* ------------------------------------------------------------------ */
/* MONTHLY HISTORY                                                     */
/* ------------------------------------------------------------------ */

/**
 * Every completed rebalance for one universe, newest first.
 *
 * Carries what CHANGED at each rebalance alongside what it returned (decision
 * D14.1) — a return figure alone hides whether the strategy traded everything
 * or held steady, which is most of what a reader wants to know about a month.
 */
export function selectMonthlyHistory(results = [], universeKey) {
  const result = results.find((r) => r.key === universeKey);
  const cycles = result?.data?.backtest?.cycles ?? [];
  if (cycles.length === 0) return [];

  return [...cycles].reverse().map((cycle, i, reversed) => {
    const previous = reversed[i + 1];
    const currentSymbols = new Set((cycle.picks ?? []).map((p) => p.symbol));
    const previousSymbols = new Set((previous?.picks ?? []).map((p) => p.symbol));

    const entered = previous ? [...currentSymbols].filter((s) => !previousSymbols.has(s)).length : null;
    const held = previous ? [...currentSymbols].filter((s) => previousSymbols.has(s)).length : null;

    return {
      monthKey: cycle.signalMonthKey ?? cycle.rankedAtMonthKey ?? cycle.monthKey ?? '—',
      returnLabel: formatPct(cycle.portfolioHoldingReturnPct),
      direction: (cycle.portfolioHoldingReturnPct ?? 0) >= 0 ? 'gain' : 'loss',
      benchmarkLabel: formatPct(cycle.benchmarkHoldingReturnPct),
      picksLabel: (cycle.picks ?? []).map((p) => p.name ?? p.symbol).join(', ') || '—',
      // The first cycle has nothing before it, so no change can be stated.
      // Saying "0 changed" would be a claim the data does not support.
      changeLabel: entered == null ? 'First rebalance' : `${entered} entered · ${held} held`,
    };
  });
}

/**
 * A difference between two percentages, shown with a `%` sign.
 * See formatGap in utils/formatters.js for why the unit reads this way.
 */
function signedPp(value) {
  return formatGap(value, { digits: 1 });
}
