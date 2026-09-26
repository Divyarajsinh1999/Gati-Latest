/**
 * UNIVERSE VIEW MODEL TESTS — M6.
 *
 * The selector is where the screen's meaning actually lives, so this is where
 * the guarantees are asserted. The screen itself holds composition and almost
 * nothing worth testing, which is the point of having a selector layer at all.
 *
 * Decision D12 requires four questions to be answerable. Each has a suite
 * below, plus the one that matters most: the D1 separation between the
 * capital-independent record and the Investment Simulator.
 */

import { describe, it, expect } from 'vitest';
import { selectUniverseView, POSITION_STATUS } from '../universeView.js';

const universe = {
  key: 'nifty50',
  label: 'NIFTY 50',
  benchmark: { symbol: 'NIFTYBEES.NS', shortLabel: 'NIFTYBEES' },
};

function pick(symbol, over = {}) {
  return {
    symbol,
    name: symbol.replace('.NS', ''),
    currentPrice: 1000,
    dailyChangePct: 1.2,
    stockReturnPct: 8,
    benchmarkReturnPct: 2,
    rs: 6,
    rsHistory: [],
    ...over,
  };
}

function makeData(over = {}) {
  return {
    backtest: {
      equityCurve: [
        { date: '2025-01-31', monthKey: '2025-01', indexValue: 100 },
        { date: '2025-02-28', monthKey: '2025-02', indexValue: 110 },
        { date: '2025-03-31', monthKey: '2025-03', indexValue: 121.3 },
      ],
      cycles: [{}, {}, {}],
      rankingHistory: [{ date: '2025-03-31', monthKey: '2025-03', rankings: [] }],
      benchmarkReturnPct: 9.9,
      outperformancePct: 11.4,
      maxDrawdownPct: -8.7,
      ...over.backtest,
    },
    currentMomentum: {
      picks: [pick('A.NS'), pick('B.NS'), pick('C.NS'), pick('D.NS'), pick('E.NS')],
      ranked: new Array(50).fill(null).map((_, i) => pick(`S${i}.NS`)),
      ...over.currentMomentum,
    },
    changes: {
      hasBaseline: true,
      changeCount: 2,
      currentDate: '2025-03-31',
      previousMonthKey: '2025-02',
      entered: [{ symbol: 'A.NS', name: 'A', rank: 1 }, { symbol: 'B.NS', name: 'B', rank: 2 }],
      exited: [{ symbol: 'X.NS', name: 'X', previousRank: 3 }],
      biggestMoves: [{ symbol: 'A.NS', name: 'A', from: 25, to: 1, change: 24 }],
      ...over.changes,
    },
    daysToRebalance: 18,
    historySufficiency: { isSufficient: true },
    ...over.rest,
  };
}

const view = (over = {}, amount = null) =>
  selectUniverseView({ data: makeData(over), universe, windowSlug: '1m', amount });

/* ------------------------------------------------------------------ */
/* Q1 · WHAT ARE THE TOP 5?                                            */
/* ------------------------------------------------------------------ */

describe('Q1 — the current Top 5', () => {
  it('returns exactly the picks, ranked from 1', () => {
    const rows = view().topFive;
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('formats RS with a % sign, per the owner display decision', () => {
    // The most common way to misread the product's central number.
    expect(view().topFive[0].rsLabel).toBe('+6.0%');
  });

  it('shows an em-dash rather than a fabricated price when one is missing', () => {
    const rows = view({ currentMomentum: { picks: [pick('A.NS', { currentPrice: null })] } }).topFive;
    expect(rows[0].priceLabel).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Q2 · WHAT CHANGED?                                                  */
/* ------------------------------------------------------------------ */

describe('Q2 — what changed since the last rebalance', () => {
  it('summarises entries and exits', () => {
    const summary = view().changeSummary;
    expect(summary.available).toBe(true);
    expect(summary.headline).toBe('2 changes at the last rebalance');
    expect(summary.entered.map((e) => e.symbol)).toEqual(['A.NS', 'B.NS']);
  });

  it('refuses to claim "no changes" with nothing to compare against', () => {
    // One snapshot is not a comparison.
    const summary = view({ changes: { hasBaseline: false } }).changeSummary;
    expect(summary.available).toBe(false);
    expect(summary.headline).toContain('No previous rebalance');
  });

  it('says "no changes" only when there genuinely were none', () => {
    const summary = view({ changes: { changeCount: 0, entered: [], exited: [] } }).changeSummary;
    expect(summary.headline).toBe('No changes at the last rebalance');
  });
});

/* ------------------------------------------------------------------ */
/* Q3 · WHY ARE THESE RANKED HERE?                                     */
/* ------------------------------------------------------------------ */

describe('Q3 — why these stocks are ranked here', () => {
  it('carries both ledger operands on every row', () => {
    // The RS value is checkable rather than trusted only if both numbers
    // that produced it travel with it.
    for (const row of view().topFive) {
      expect(row.stockReturnPct).toBeTypeOf('number');
      expect(row.benchmarkReturnPct).toBeTypeOf('number');
    }
  });

  it('preserves the trailing RS history attached upstream', () => {
    const rows = view({
      currentMomentum: { picks: [pick('A.NS', { rsHistory: [{ monthKey: '2025-02', rs: 4 }], rsTrend: 'improving' })] },
    }).topFive;
    expect(rows[0].rsHistory).toHaveLength(1);
    expect(rows[0].rsTrend).toBe('improving');
  });
});

/* ------------------------------------------------------------------ */
/* Q4 · WHAT ACTION FOLLOWS?                                           */
/* ------------------------------------------------------------------ */

describe('Q4 — position status describes the STRATEGY, not advice', () => {
  it('marks entries as new and everything else as held', () => {
    const rows = view().topFive;
    expect(rows.find((r) => r.symbol === 'A.NS').status).toBe(POSITION_STATUS.NEW);
    expect(rows.find((r) => r.symbol === 'C.NS').status).toBe(POSITION_STATUS.HELD);
  });

  it('never labels a status as buy, sell or hold advice', () => {
    // Gati states what the strategy did; it does not tell anyone what to do.
    // "Buy this" would be unverifiable and beyond what an RS ranking supports.
    const labels = Object.values(POSITION_STATUS).map((s) => (s.label ?? '').toLowerCase());
    for (const label of labels) {
      expect(label).not.toMatch(/\bbuy\b|\bsell\b|recommend|should/);
    }
  });

  it('claims no status at all without a baseline to compare against', () => {
    const rows = view({ changes: { hasBaseline: false } }).topFive;
    expect(rows[0].status).toBe(POSITION_STATUS.UNKNOWN);
    expect(rows[0].status.label).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* THE D1 SEPARATION                                                   */
/* ------------------------------------------------------------------ */

describe('strategy record stays capital-independent; sizing does not', () => {
  it('produces the SAME verdict at every amount', () => {
    // The record must never move because someone typed a number into the
    // Investment Simulator.
    const none = view({}, null).verdict;
    const small = view({}, 25_000).verdict;
    const large = view({}, 5_000_000).verdict;

    expect(small.outperformanceLabel).toBe(none.outperformanceLabel);
    expect(large.strategyPct).toBe(none.strategyPct);
  });

  it('produces no sizing at all without an amount', () => {
    // The recommendation never depends on the amount.
    expect(view({}, null).sizing).toBeNull();
    expect(view({}, 0).sizing).toBeNull();
    expect(view({}, null).topFive[0].sharesLabel).toBeNull();
  });

  it('sizes on WHOLE shares and reports the leftover', () => {
    const v = view({}, 50_000);
    // ₹10,000 per slot at ₹1,000 a share = 10 shares exactly.
    expect(v.topFive[0].shares).toBe(10);
    expect(v.sizing.invested).toBe(50_000);
    expect(v.sizing.idleCash).toBe(0);
  });

  it('reports real cash drag when lot sizes do not divide evenly', () => {
    const v = view({ currentMomentum: { picks: [pick('A.NS', { currentPrice: 3500 })] } }, 10_000);
    expect(v.topFive[0].shares).toBe(2); // floor(10000 / 3500)
    expect(v.sizing.idleCash).toBe(3000);
    expect(v.sizing.cashDragPct).toBeCloseTo(30, 6);
    expect(v.sizing.executionEfficiencyPct).toBeCloseTo(70, 6);
  });

  it('flags a pick that cannot be bought at all rather than showing zero shares', () => {
    const v = view({ currentMomentum: { picks: [pick('A.NS', { currentPrice: 20_000 })] } }, 10_000);
    expect(v.topFive[0].isUnaffordable).toBe(true);
    expect(v.sizing.unaffordableCount).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* VERDICT AND TIMING                                                  */
/* ------------------------------------------------------------------ */

describe('the verdict', () => {
  it('reads from the base-100 index, so it carries no account size', () => {
    const v = view().verdict;
    expect(v.strategyPct).toBeCloseTo(21.3, 6);
    expect(v.outperformanceLabel).toBe('+11.4%');
    expect(v.direction).toBe('gain');
  });

  it('refuses to report 0% when no rebalance has completed', () => {
    // Zero would claim the strategy broke even, which the data cannot support.
    const v = view({ backtest: { equityCurve: [{ date: '2025-01-31', indexValue: 100 }], cycles: [] } }).verdict;
    expect(v.available).toBe(false);
    expect(v.reason).toContain('No completed rebalance');
  });

  it('surfaces a thin sample beside the figure rather than burying it', () => {
    const v = view({ rest: { historySufficiency: { isSufficient: false } } }).verdict;
    expect(v.isThinSample).toBe(true);
  });
});

describe('rebalance timing — context, never a countdown', () => {
  it('reports the last rebalance and the next review', () => {
    const t = view().rebalanceTiming;
    expect(t.lastRebalanceDate).toBe('2025-03-31');
    expect(t.nextReviewLabel).toBe('next review in 18 trading days');
  });

  it('says "at month-end" rather than guessing when the count is unknown', () => {
    // null is genuinely unknown — the series does not extend far enough — and
    // must not be rendered as "today".
    const t = view({ rest: { daysToRebalance: null } }).rebalanceTiming;
    expect(t.nextReviewLabel).toBe('next review at month-end');
  });

  it('uses the singular for a single remaining day', () => {
    expect(view({ rest: { daysToRebalance: 1 } }).rebalanceTiming.nextReviewLabel).toBe('next review tomorrow');
  });
});

/* ------------------------------------------------------------------ */
/* PERFORMANCE                                                         */
/* ------------------------------------------------------------------ */

describe('performance block', () => {
  it('shows exactly three metrics, not twelve', () => {
    // Twelve equally-weighted tiles was the density failure the restructure
    // exists to fix. The other nine live in the strategy record.
    expect(view().performance.metrics).toHaveLength(3);
  });

  it('gives every metric a glossary key, per D9', () => {
    for (const metric of view().performance.metrics) {
      expect(metric.glossaryKey, `${metric.key} has no contextual help`).toBeTruthy();
    }
  });

  it('builds an indexed series carrying no rupee amount', () => {
    const series = view().performance.series;
    expect(series[0].strategy).toBe(100);
    expect(series.at(-1).strategy).toBeCloseTo(121.3, 6);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE EQUITY CURVE ON THE DASHBOARD (owner's instruction, 27 Aug 2026).
   *
   * The chart is drawn by the same component the strategy record uses, and
   * fed by the same builder, so the two screens cannot disagree about what
   * the benchmark did. What is worth pinning here is that both legs arrive,
   * that they are INDEXED rather than denominated in rupees, and that a
   * short record produces no curve at all rather than a single dot.
   * ═══════════════════════════════════════════════════════════════════════
   */
  it('carries both legs of the curve, not just the strategy', () => {
    const p = view().performance;
    expect(p.equityCurve).toHaveLength(3);
    expect(p.benchmarkCurve.length).toBeGreaterThan(0);
  });

  it('indexes both legs to 100, so neither implies an account size', () => {
    const p = view().performance;
    expect(p.equityCurve[0].value).toBe(100);
    expect(p.benchmarkCurve[0].value).toBe(100);
  });

  it('compounds the benchmark from its holding-period returns', () => {
    // 100 → +10% → +5% = 115.5, chained across the cycles rather than read
    // off an index level, so both lines describe the same holding periods.
    const p = view({
      backtest: {
        cycles: [
          { benchmarkHoldingReturnPct: 10 },
          { benchmarkHoldingReturnPct: 5 },
        ],
      },
    }).performance;
    expect(p.benchmarkCurve.at(-1).value).toBeCloseTo(115.5, 6);
  });

  it('pairs the two legs on the same dates', () => {
    const p = view().performance;
    for (const [i, point] of p.benchmarkCurve.entries()) {
      expect(point.date).toBe(p.equityCurve[i].date);
    }
  });

  it('reports no curve when there are fewer than two points to join', () => {
    const p = view({
      backtest: {
        equityCurve: [{ date: '2025-01-31', monthKey: '2025-01', indexValue: 100 }],
        cycles: [],
      },
    }).performance;
    expect(p.hasCurve).toBe(false);
  });
});

describe('empty and missing inputs', () => {
  it('returns null rather than throwing when there is no data', () => {
    expect(selectUniverseView({ data: null, universe, windowSlug: '1m' })).toBeNull();
  });

  it('survives an empty universe', () => {
    const v = selectUniverseView({
      data: makeData({ currentMomentum: { picks: [], ranked: [] } }),
      universe,
      windowSlug: '1m',
      amount: 50_000,
    });
    expect(v.topFive).toEqual([]);
    expect(v.sizing).toBeNull();
    expect(v.rankedCount).toBe(0);
  });
});
