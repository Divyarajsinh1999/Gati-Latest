/**
 * UNIVERSE VIEW MODEL — derived data, shaped for one screen.
 *
 * WHAT THIS OWNS
 *   Turning the derived bundle into exactly what the universe screen renders,
 *   and nothing more.
 *
 * WHAT THIS MUST NEVER DO
 *   Calculate a financial value. Every number here already exists; this file
 *   selects, labels and orders. If a figure needs computing it belongs in an
 *   engine, where it can be tested without a DOM.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY A SELECTOR LAYER EXISTS AT ALL
 *
 * The architecture forbids financial calculation inside components, and the
 * boundary is lint-enforced — a screen cannot import an engine. Without
 * somewhere to put the shaping, that rule would just push the arithmetic into
 * a hook and call it clean.
 *
 * So: engines compute, selectors shape, screens render. Each layer is
 * testable on its own, and the screen ends up holding no logic worth testing.
 *
 * DECISION D12 — the four questions this screen must answer:
 *   1. What are the current Top 5?          -> topFive
 *   2. What changed since last rebalance?   -> changeSummary
 *   3. Why are these ranked here?           -> per-row ledger + rsTrend
 *   4. What action follows?                 -> per-row status (see below)
 * ═════════════════════════════════════════════════════════════════════════
 */

import { formatPct, formatINR, formatDate, formatGap } from '../utils/formatters.js';
import { resolveTodayChange } from './todayChange.js';
import { MOMENTUM_DIRECTION } from '../engine/rsHistory.js';
import { calculateExecutionQuality, minimumViableCapital } from '../engine/executionMetrics.js';
import { allocate, SIMULATOR_WEIGHTING } from '../engine/weighting.js';
import { buildIndexedBenchmarkCurve } from '../utils/chartData.js';

/**
 * Position status: what the STRATEGY did, never what the user should do.
 *
 * Gati describes the model's own behaviour, which is mechanical and checkable.
 * "Buy this" would be advice — unverifiable, unaccountable, and beyond what a
 * Relative Strength ranking can support. The investor still gets their answer:
 * two names new means two buys, two exits means two sells.
 */
export const POSITION_STATUS = {
  NEW: { key: 'new', label: 'New this month', tone: 'gold' },
  HELD: { key: 'held', label: 'Held', tone: 'neutral' },
  UNKNOWN: { key: 'unknown', label: null, tone: 'neutral' },
};

/**
 * Shape the universe screen's view model.
 *
 * @param {object} args
 * @param {object} args.data          derived bundle from useUniverseData
 * @param {object} args.universe      universe config
 * @param {string} args.windowSlug
 * @param {number|null} args.amount   the entered investment amount, if any
 */
export function selectUniverseView({ data, universe, windowSlug, amount = null, session = null }) {
  if (!data) return null;

  const { backtest, currentMomentum, changes, daysToRebalance, historySufficiency, momentumAge, rebalanceSummary } = data;

  return {
    verdict: selectVerdict({ backtest, universe, windowSlug, historySufficiency }),
    rebalanceTiming: selectRebalanceTiming({ backtest, changes, daysToRebalance }),
    changeSummary: selectChangeSummary(changes, rebalanceSummary, currentMomentum, momentumAge),
    rebalanceSummary: rebalanceSummary ?? null,
    topFive: selectTopFive({ currentMomentum, changes, amount, momentumAge, priceSeriesMap: data.priceSeriesMap, session }),
    // Derived from the SAME picks the card renders, so the line can never
    // describe a different five from the one immediately above it.
    sectorConcentration: selectSectorConcentration(currentMomentum?.picks ?? []),
    sizing: selectSizing({ currentMomentum, amount }),
    performance: selectPerformance(backtest),
    rankedCount: currentMomentum?.ranked?.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* 1 · VERDICT                                                         */
/* ------------------------------------------------------------------ */

function selectVerdict({ backtest, universe, windowSlug, historySufficiency }) {
  const curve = backtest?.equityCurve ?? [];
  const last = curve[curve.length - 1];

  // No completed rebalance is not a zero. Returning 0% would claim the
  // strategy broke even, which the data does not support.
  if (!last || curve.length < 2) {
    return {
      available: false,
      reason: 'No completed rebalance yet for this window.',
      benchmarkLabel: universe.benchmark.shortLabel ?? universe.benchmark.symbol,
      windowSlug,
    };
  }

  const strategyPct = last.indexValue - 100;
  const benchmarkPct = backtest.benchmarkReturnPct ?? null;
  const outperformancePct = benchmarkPct == null ? null : strategyPct - benchmarkPct;

  return {
    available: true,
    strategyPct,
    benchmarkPct,
    outperformancePct,
    // Percentage POINTS: a difference between two percentages, not a percent.
    outperformanceLabel: outperformancePct == null ? null : formatGap(outperformancePct, { digits: 1 }),
    direction: outperformancePct == null ? null : outperformancePct >= 0 ? 'gain' : 'loss',
    isAhead: outperformancePct != null && outperformancePct >= 0,
    benchmarkLabel: universe.benchmark.shortLabel ?? universe.benchmark.symbol,
    windowSlug,
    strategyLabel: formatPct(strategyPct),
    benchmarkValueLabel: benchmarkPct == null ? null : formatPct(benchmarkPct),
    // Surfaced beside the figure rather than buried, so a thin sample is
    // qualified at the point of reading.
    isThinSample: Boolean(historySufficiency && !historySufficiency.isSufficient),
    completedCycles: backtest.cycles?.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* 2 · REBALANCE TIMING                                                */
/* ------------------------------------------------------------------ */

/**
 * Quiet context, never a countdown.
 *
 * A monthly strategy has nothing to do between rebalances. An interface that
 * implies otherwise is manufacturing activity it cannot justify, and urgency
 * is the easiest way to make someone trade when they should not.
 */
function selectRebalanceTiming({ backtest, changes, daysToRebalance }) {
  const lastSignal = changes?.currentDate ?? backtest?.rankingHistory?.at?.(-1)?.date ?? null;

  return {
    lastRebalanceDate: lastSignal,
    lastRebalanceLabel: lastSignal ? formatDate(lastSignal) : null,
    // null means genuinely unknown — the series does not extend far enough —
    // which is different from zero and must not be shown as "today".
    tradingDaysRemaining: daysToRebalance,
    nextReviewLabel:
      daysToRebalance == null
        ? 'next review at month-end'
        : daysToRebalance === 1
          ? 'next review tomorrow'
          : `next review in ${daysToRebalance} trading days`,
  };
}

/* ------------------------------------------------------------------ */
/* 3 · WHAT CHANGED                                                    */
/* ------------------------------------------------------------------ */

/**
 * What changed, expanded.
 *
 * Entrants carry WHY they are here — their Relative Strength, the rank they
 * came from, and how their momentum has been moving. A bare list of names
 * answers "what changed" and leaves "why" to guesswork, which is the half a
 * reader actually needs before acting.
 *
 * Every field is read from rows the ranking already produced. Nothing here is
 * computed.
 */
function selectChangeSummary(changes, rebalanceSummary, currentMomentum, momentumAge) {
  if (!changes?.hasBaseline) {
    // One snapshot is not a comparison. "No changes" would be a claim we
    // cannot support.
    return { available: false, headline: 'No previous rebalance to compare against yet' };
  }

  const { entered, exited, biggestMoves, changeCount, previousMonthKey } = changes;

  return {
    available: true,
    changeCount,
    // Decision D13: three numbers, one line — the difference between a quiet
    // month and a wholesale turnover, which affects both conviction and cost.
    counts: rebalanceSummary?.available
      ? {
          entered: rebalanceSummary.entered,
          continuing: rebalanceSummary.continuing,
          exited: rebalanceSummary.exited,
          label: `${rebalanceSummary.entered} entered · ${rebalanceSummary.continuing} continuing · ${rebalanceSummary.exited} left`,
        }
      : null,
    headline:
      changeCount === 0
        ? 'No changes at the last rebalance'
        : `${changeCount} change${changeCount === 1 ? '' : 's'} at the last rebalance`,
    entered: (entered ?? []).map((row) => {
      const live = (currentMomentum?.ranked ?? []).find((r) => r.symbol === row.symbol);
      const age = momentumAge?.get(row.symbol) ?? null;
      return {
        ...row,
        rsLabel: row.rs == null ? null : formatGap(row.rs, { digits: 1 }),
        // Where it came from. "Entered from 47th" is a different story from
        // "entered from 6th", and the number is the story.
        fromLabel: row.previousRank == null ? 'entered the ranking' : `up from #${row.previousRank}`,
        direction: live?.rsTrend ? MOMENTUM_DIRECTION[live.rsTrend] ?? null : null,
        momentumAge: age?.consecutiveMonths ?? null,
      };
    }),
    exited: (exited ?? []).map((row) => ({
      ...row,
      // null rank means it left the ranking entirely — delisted, renamed, or
      // its data went missing. Materially different from slipping to 40th.
      toLabel: row.rank == null ? 'no longer ranked' : `now #${row.rank}`,
    })),
    biggestMoves,
    previousMonthKey,
  };
}

/* ------------------------------------------------------------------ */
/* 4 · TOP 5, WITH STATUS AND SIZING                                   */
/* ------------------------------------------------------------------ */

/** See rankingView: samples the tail of a series already in memory. */
function sparkFrom(series, count = 30) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const points = series.slice(-count).map((bar) => bar.adjClose ?? bar.close).filter((v) => typeof v === 'number');
  return points.length >= 2 ? points : null;
}

/**
 * Sector concentration across a set of picks (D24).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * FIVE STOCKS IS CONCENTRATED BY CONSTRUCTION. THE QUESTION IS WHETHER IT IS
 * ALSO CONCENTRATED BY ACCIDENT.
 *
 * Momentum does not diversify. When one part of the market runs, the ranking
 * fills with it — and three of five in one sector is a sector bet wearing a
 * momentum label. That may be exactly what the reader wants, provided they
 * know they are holding it. The app already showed each stock's sector; only
 * the sum was missing, and the sum is the part nobody does at a glance.
 *
 * NOT A SCORE. D15/C5 stands: this returns the largest sector, how many picks
 * are in it, and the share — plain figures that keep their meaning. A blended
 * "diversification score" would hide precisely the input that matters.
 *
 * THE THRESHOLD IS AN OPINION, SO IT IS STATED RATHER THAN HIDDEN: three of
 * five. Below that, five stocks across three or more sectors is about as
 * spread as this strategy gets and flagging it would be noise. The flag is
 * advisory — the sector and count are reported either way.
 *
 * MISSING SECTORS ARE NAMED, NEVER ABSORBED. An unknown sector is counted
 * separately rather than bucketed as "Other": pretending a gap is a category
 * would let three unknowns masquerade as diversification, or hide a real
 * concentration inside them. Same standing rule as the data layer — flag the
 * gap, never calculate around it.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * @param {{sector?:string|null}[]} picks
 * @returns {null | {topSector:string|null,count:number,total:number,
 *   sharePct:number|null,isConcentrated:boolean,unknownCount:number,
 *   label:string,sectors:{sector:string,count:number}[]}}
 */
export function selectSectorConcentration(picks = []) {
  const rows = Array.isArray(picks) ? picks : [];
  if (rows.length === 0) return null;

  const counts = new Map();
  let unknownCount = 0;

  for (const row of rows) {
    const sector = row?.sector;
    if (!sector) { unknownCount += 1; continue; }
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }

  const sectors = [...counts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    // Ties broken alphabetically so the label is stable between renders
    // rather than following Map insertion order.
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));

  if (sectors.length === 0) {
    return {
      topSector: null, count: 0, total: rows.length, sharePct: null,
      isConcentrated: false, unknownCount, sectors: [],
      label: 'Sector data unavailable',
    };
  }

  const top = sectors[0];
  const isConcentrated = top.count >= 3;
  const known = rows.length - unknownCount;
  const missing = unknownCount > 0 ? ` \u00b7 ${unknownCount} unclassified` : '';

  return {
    topSector: top.sector,
    count: top.count,
    total: rows.length,
    sharePct: (top.count / rows.length) * 100,
    isConcentrated,
    unknownCount,
    sectors,
    /*
      Written here so every surface says it identically. "3 of 5 in
      Financials" is a fact and is left to read as one — no verb, no advice.
    */
    label: isConcentrated
      ? `${top.count} of ${rows.length} in ${top.sector}${missing}`
      : unknownCount > 0
        ? `Spread across ${sectors.length} of ${known} known${missing}`
        : `Spread across ${sectors.length} sector${sectors.length === 1 ? '' : 's'}`,
  };
}

function selectTopFive({ currentMomentum, changes, amount, momentumAge, priceSeriesMap, session }) {
  const picks = currentMomentum?.picks ?? [];
  const enteredSymbols = new Set((changes?.entered ?? []).map((e) => e.symbol));
  const hasBaseline = Boolean(changes?.hasBaseline);

  const perStockAmount = amount && picks.length ? amount / picks.length : null;

  return picks.map((row, index) => {
    const status = !hasBaseline
      ? POSITION_STATUS.UNKNOWN
      : enteredSymbols.has(row.symbol)
        ? POSITION_STATUS.NEW
        : POSITION_STATUS.HELD;

    // Whole-share sizing, and ONLY here. The strategy record above is
    // capital-independent by decision D1; this is the Investment Simulator.
    const shares = perStockAmount && row.currentPrice > 0 ? Math.floor(perStockAmount / row.currentPrice) : null;
    const invested = shares != null && row.currentPrice > 0 ? shares * row.currentPrice : null;

    // Momentum Age comes straight from the engine projection. An absent entry
    // means the stock is not in the last completed ranking at all, which is
    // different from an age of zero and must not be shown as one.
    const age = momentumAge?.get(row.symbol) ?? null;
    const today = resolveTodayChange(row, session);

    return {
      ...row,
      rank: index + 1,
      status,
      momentumAge: age?.consecutiveMonths ?? null,
      direction: row.rsTrend ? MOMENTUM_DIRECTION[row.rsTrend] ?? null : null,
      spark: sparkFrom(priceSeriesMap?.get(row.symbol)),
      momentumSince: age?.sinceMonthKey ?? null,
      momentumAgeLabel:
        age == null
          ? null
          : age.consecutiveMonths === 1
            ? 'New entrant'
            : `${age.consecutiveMonths} months in Top 5`,
      shares,
      invested,
      sharesLabel: shares == null ? null : `${shares} share${shares === 1 ? '' : 's'} · ${formatINR(invested)}`,
      // Flagged rather than silently shown as zero shares: at this amount the
      // position cannot be taken at all, which is a different problem.
      isUnaffordable: shares === 0,
      priceLabel: row.currentPrice == null ? null : formatINR(row.currentPrice),
      // ONE rule for every surface — see selectors/todayChange.js.
      dayChangeLabel: today.label,
      dayChangeDirection: today.direction,
      rsLabel: row.rs == null ? null : formatGap(row.rs, { digits: 1 }),
      rsDirection: row.rs == null ? null : row.rs >= 0 ? 'gain' : 'loss',
    };
  });
}

/**
 * Investment Simulator sizing.
 *
 * DELEGATES to the engine rather than recomputing. Until M12 this function
 * carried its own `Math.floor` loop and its own cash-drag arithmetic while
 * `engine/executionMetrics.js` sat unused — two implementations of one
 * calculation, which is precisely how two numbers come to disagree. The engine
 * version is the tested one, so the selector now shapes its output and
 * computes nothing.
 */
function selectSizing({ currentMomentum, amount }) {
  if (!amount || amount <= 0) return null;

  const picks = currentMomentum?.picks ?? [];
  const priced = picks
    .filter((p) => p.currentPrice > 0)
    .map((p) => ({ symbol: p.symbol, name: p.name, entryPrice: p.currentPrice }));

  if (priced.length === 0) return null;

  // Whole-share allocation, and ONLY here. The record above is
  // capital-independent by decision D1.
  const allocation = allocate(priced, amount, SIMULATOR_WEIGHTING);
  const quality = calculateExecutionQuality({
    capital: amount,
    totalInvested: allocation.totalInvested,
    positions: allocation.positions,
  });

  return {
    amount,
    invested: quality.invested,
    idleCash: quality.idleCash,
    investedLabel: formatINR(quality.invested),
    idleCashLabel: formatINR(quality.idleCash),
    cashDragPct: quality.cashDragPct,
    executionEfficiencyPct: quality.executionEfficiencyPct,
    unaffordableCount: quality.perPosition.filter((p) => p.isUnaffordable).length,
    minimumViableCapital: minimumViableCapital(priced, priced.length),
    // Priced stocks only. An unpriced pick cannot be sized, and pretending
    // otherwise would misstate the total.
    pricedCount: priced.length,
    totalPicks: picks.length,

  };
}

/* ------------------------------------------------------------------ */
/* 5 · PERFORMANCE                                                     */
/* ------------------------------------------------------------------ */

/**
 * Exactly three metrics.
 *
 * Twelve equally-weighted tiles was the density failure the restructure
 * exists to fix. The other nine live one tap away in the strategy record.
 */
function selectPerformance(backtest) {
  const curve = backtest?.equityCurve ?? [];
  const last = curve[curve.length - 1];
  const cycles = backtest?.cycles ?? [];

  /**
   * MONTH-BY-MONTH RETURNS, straight from the completed rebalance cycles.
   *
   * Nothing is computed here that the backtest did not already produce —
   * `portfolioHoldingReturnPct` and `benchmarkHoldingReturnPct` are what
   * the engine recorded for each holding period. This selector reshapes
   * them and does not recalculate them, so the chart cannot disagree with
   * the record it is drawn from.
   *
   * A cycle whose return is null stays null. It is dropped from the chart
   * rather than plotted as zero, because a missing month and a flat month
   * are different facts and a zero bar asserts the second.
   */
  const monthly = cycles
    .filter((cycle) => cycle.portfolioHoldingReturnPct != null)
    .map((cycle) => ({
      monthKey: cycle.exitDate?.slice(0, 7) ?? null,
      date: cycle.exitDate,
      strategyPct: cycle.portfolioHoldingReturnPct,
      benchmarkPct: cycle.benchmarkHoldingReturnPct ?? null,
    }));

  return {
    monthly,
    // Two bars is not a chart, it is two bars. Below this the numbers are
    // shown as a list instead and the reader is told the sample is thin.
    hasMonthly: monthly.length >= 3,
    monthlyCount: monthly.length,
    hasCurve: curve.length >= 2,
    // Indexed to 100, so the chart carries no assumed account size.
    series: curve.map((point) => ({
      date: point.date,
      monthKey: point.monthKey,
      strategy: point.indexValue,
    })),

    /**
     * THE EQUITY CURVE, ON THE DASHBOARD (owner's instruction, 27 Aug 2026).
     *
     * Both legs, shaped exactly as the strategy record shapes them, and
     * built by the SAME `buildIndexedBenchmarkCurve` the record uses — moved
     * into utils/chartData.js for this. Two copies of a compounding loop is
     * two chances for the Dashboard and the record to disagree about what
     * the benchmark did, and that divergence would surface as one screen
     * quietly contradicting another rather than as a failing test.
     *
     * Indexed to 100 rather than shown in rupees. D1 is not suspended
     * because the chart moved screens: the reference build this borrows its
     * look from prints "₹62K" on the same curve, which is a rupee figure
     * describing an account nobody opened.
     */
    equityCurve: curve.map((point) => ({
      date: point.date,
      monthKey: point.monthKey,
      value: point.indexValue,
    })),
    benchmarkCurve: buildIndexedBenchmarkCurve(curve, cycles),
    metrics: [
      {
        key: 'totalReturn',
        label: 'Total return',
        value: last ? formatPct(last.indexValue - 100) : null,
        direction: last ? (last.indexValue >= 100 ? 'gain' : 'loss') : null,
        glossaryKey: 'totalReturn',
      },
      {
        key: 'outperformance',
        label: 'Outperformance',
        value: backtest?.outperformancePct == null ? null : formatGap(backtest.outperformancePct, { digits: 1 }),
        direction: backtest?.outperformancePct == null ? null : backtest.outperformancePct >= 0 ? 'gain' : 'loss',
        glossaryKey: 'outperformance',
      },
      {
        key: 'maxDrawdown',
        label: 'Max drawdown',
        value: backtest?.maxDrawdownPct == null ? null : formatPct(backtest.maxDrawdownPct),
        direction: backtest?.maxDrawdownPct == null ? null : 'loss',
        glossaryKey: 'maxDrawdown',
      },
    ],
  };
}
