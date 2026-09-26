/**
 * M3 ENGINE TESTS — RS history, change detection, execution metrics,
 * portfolio valuation.
 *
 * The recurring theme across these suites is GAPS. Every one of these engines
 * has an easy, wrong implementation that fills a hole with a plausible number:
 * a missing month as 0.0pp RS, an unpriced holding as zero value, a stock that
 * vanished from the ranking as "slipped to last". Each of those reads as a
 * specific claim the data does not support. The tests below assert the holes
 * stay holes.
 */

import { describe, it, expect } from 'vitest';
import { buildRSHistory, attachRSHistory, buildSingleStockRSHistory } from '../rsHistory.js';
import { detectChanges, tradingDaysToRebalance } from '../changeDetection.js';
import { calculateExecutionQuality, compareIdealToExecutable, minimumViableCapital } from '../executionMetrics.js';
import { valuePortfolio, annotateWithRanking, aggregateLots } from '../portfolioValuation.js';

/* ------------------------------------------------------------------ */
/* RS HISTORY                                                          */
/* ------------------------------------------------------------------ */

const rankingHistory = [
  { monthKey: '2026-03', date: '2026-03-31', rankings: [
    { symbol: 'A', name: 'A', rank: 1, rs: 8 },
    { symbol: 'B', name: 'B', rank: 2, rs: 5 },
    { symbol: 'C', name: 'C', rank: 30, rs: -4 },
    { symbol: 'D', name: 'D', rank: null, rs: null },
  ]},
  { monthKey: '2026-04', date: '2026-04-30', rankings: [
    { symbol: 'A', name: 'A', rank: 3, rs: 4 },
    { symbol: 'B', name: 'B', rank: 1, rs: 9 },
    { symbol: 'C', name: 'C', rank: 25, rs: -2 },
    { symbol: 'D', name: 'D', rank: 10, rs: 1 },
  ]},
  { monthKey: '2026-05', date: '2026-05-29', rankings: [
    { symbol: 'A', name: 'A', rank: 12, rs: -1 },
    { symbol: 'B', name: 'B', rank: 2, rs: 7 },
    { symbol: 'C', name: 'C', rank: 4, rs: 6 },
    { symbol: 'D', name: 'D', rank: null, rs: null },
  ]},
];

describe('buildRSHistory', () => {
  it('pivots month-major rankings into per-stock ascending series', () => {
    const h = buildRSHistory({ rankingHistory, months: 3, topN: 5 });
    expect(h.get('A').map((p) => p.monthKey)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(h.get('A').map((p) => p.rs)).toEqual([8, 4, -1]);
  });

  it('LEAVES A GAP for a month with no usable data — never a zero', () => {
    const h = buildRSHistory({ rankingHistory, months: 3 });
    // D has data only in April. A fabricated 0.0pp would read as "kept pace
    // with the benchmark", which is a claim the data does not support.
    expect(h.get('D')).toHaveLength(1);
    expect(h.get('D')[0].monthKey).toBe('2026-04');
    expect(h.get('D').some((p) => p.rs === 0)).toBe(false);
  });

  it('records Top-N membership per month', () => {
    const h = buildRSHistory({ rankingHistory, months: 3, topN: 5 });
    expect(h.get('C').map((p) => p.wasInTopN)).toEqual([false, false, true]);
  });

  it('keeps only the most recent N months', () => {
    const h = buildRSHistory({ rankingHistory, months: 2 });
    expect(h.get('A').map((p) => p.monthKey)).toEqual(['2026-04', '2026-05']);
  });

  it('returns an empty map rather than throwing on no history', () => {
    expect(buildRSHistory({ rankingHistory: [] }).size).toBe(0);
  });
});

describe('attachRSHistory', () => {
  const h = buildRSHistory({ rankingHistory, months: 3, topN: 5 });
  const rows = [{ symbol: 'A', name: 'A' }, { symbol: 'B', name: 'B' }, { symbol: 'Z', name: 'Z' }];
  const attached = attachRSHistory(rows, h);

  it('derives a direction from first to last point, descriptively', () => {
    expect(attached[0].rsTrend).toBe('weakening'); // A: 8 -> -1
  });

  it('reports rank change with IMPROVEMENT as positive', () => {
    // A went from rank 3 to rank 12: worse, so negative.
    expect(attached[0].rankChange).toBe(-9);
  });

  it('gives a stock with no history a null trend rather than a neutral one', () => {
    expect(attached[2].rsHistory).toEqual([]);
    expect(attached[2].rsTrend).toBeNull();
    expect(attached[2].rankChange).toBeNull();
  });

  it('calls a small move stable rather than dressing noise up as a signal', () => {
    const flat = buildRSHistory({
      rankingHistory: [
        { monthKey: '2026-04', date: '2026-04-30', rankings: [{ symbol: 'X', name: 'X', rank: 5, rs: 2.0 }] },
        { monthKey: '2026-05', date: '2026-05-29', rankings: [{ symbol: 'X', name: 'X', rank: 5, rs: 2.3 }] },
      ],
    });
    expect(attachRSHistory([{ symbol: 'X' }], flat)[0].rsTrend).toBe('stable');
  });
});

describe('buildSingleStockRSHistory', () => {
  const dates = ['2026-01-30', '2026-02-27', '2026-03-31', '2026-04-30', '2026-05-29'];
  const mk = (prices) => dates.map((date, i) => ({ date, close: prices[i], adjClose: prices[i], open: prices[i], high: prices[i], low: prices[i], volume: 1 }));

  it('produces a series per requested window', () => {
    const out = buildSingleStockRSHistory({
      series: mk([100, 110, 120, 130, 140]),
      benchmarkSeries: mk([100, 102, 104, 106, 108]),
      windows: [1, 3],
      months: 3,
    });
    expect(out.get(1).length).toBeGreaterThan(0);
    expect(out.get(3).length).toBeGreaterThan(0);
    // A 3-month window needs more history, so it yields fewer points.
    expect(out.get(3).length).toBeLessThanOrEqual(out.get(1).length);
  });

  it('returns ascending months', () => {
    const out = buildSingleStockRSHistory({
      series: mk([100, 110, 120, 130, 140]),
      benchmarkSeries: mk([100, 102, 104, 106, 108]),
      windows: [1],
    });
    const keys = out.get(1).map((p) => p.monthKey);
    expect(keys).toEqual([...keys].sort());
  });

  it('returns empty series rather than throwing when data is missing', () => {
    const out = buildSingleStockRSHistory({ series: [], benchmarkSeries: [], windows: [1, 3] });
    expect(out.get(1)).toEqual([]);
    expect(out.get(3)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* CHANGE DETECTION                                                    */
/* ------------------------------------------------------------------ */

describe('detectChanges', () => {
  const changes = detectChanges({ rankingHistory, topN: 5, significantRankMove: 5 });

  it('identifies entries into the Top N', () => {
    expect(changes.entered.map((e) => e.symbol)).toContain('C'); // 25 -> 4
  });

  it('identifies exits from the Top N', () => {
    expect(changes.exited.map((e) => e.symbol)).toContain('A'); // 3 -> 12
  });

  it('reports rank moves with improvement positive', () => {
    const c = changes.biggestMoves.find((m) => m.symbol === 'C');
    expect(c.change).toBe(21); // 25 -> 4 is an improvement of 21 places
  });

  it('counts turnover once, not entries plus exits', () => {
    expect(changes.changeCount).toBe(Math.max(changes.entered.length, changes.exited.length));
  });

  it('refuses to claim "no changes" when there is nothing to compare against', () => {
    const one = detectChanges({ rankingHistory: [rankingHistory[0]] });
    expect(one.hasBaseline).toBe(false);
    expect(one.changeCount).toBe(0);
  });

  it('distinguishes a stock that left the ranking from one that merely slipped', () => {
    const hist = [
      { monthKey: '2026-04', date: '2026-04-30', rankings: [{ symbol: 'X', name: 'X', rank: 1, rs: 5 }] },
      { monthKey: '2026-05', date: '2026-05-29', rankings: [{ symbol: 'X', name: 'X', rank: null, rs: null }] },
    ];
    const c = detectChanges({ rankingHistory: hist, topN: 5 });
    expect(c.exited[0].rank).toBeNull(); // gone entirely, not "slipped"
  });
});

describe('tradingDaysToRebalance', () => {
  const series = ['2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29'].map((date) => ({ date }));

  it('counts remaining sessions in the month from the actual series', () => {
    expect(tradingDaysToRebalance(series, '2026-05-27')).toBe(2);
  });

  it('reports unknown rather than zero when the series ends today', () => {
    // "0 days left" would imply the month ends today. It may not.
    expect(tradingDaysToRebalance(series, '2026-05-29')).toBeNull();
  });

  it('returns null on an empty series', () => {
    expect(tradingDaysToRebalance([], '2026-05-29')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* EXECUTION METRICS (Investment Simulator)                            */
/* ------------------------------------------------------------------ */

describe('calculateExecutionQuality', () => {
  const positions = [
    { symbol: 'A', name: 'A', entryPrice: 2397.76, targetAllocation: 5000, shares: 2, invested: 4795.52, remaining: 204.48 },
    { symbol: 'B', name: 'B', entryPrice: 744.38, targetAllocation: 5000, shares: 6, invested: 4466.28, remaining: 533.72 },
  ];

  it('reports drag and efficiency as complements', () => {
    const q = calculateExecutionQuality({ capital: 10_000, totalInvested: 9261.8, positions });
    expect(q.idleCash).toBeCloseTo(738.2, 2);
    expect(q.cashDragPct).toBeCloseTo(7.382, 3);
    expect(q.executionEfficiencyPct).toBeCloseTo(92.618, 3);
    expect(q.cashDragPct + q.executionEfficiencyPct).toBeCloseTo(100, 6);
  });

  it('identifies which position causes the most drag', () => {
    const q = calculateExecutionQuality({ capital: 10_000, totalInvested: 9261.8, positions });
    expect(q.perPosition[0].symbol).toBe('B');
  });

  it('flags a slot that cannot buy even one share as unaffordable, not as drag', () => {
    const q = calculateExecutionQuality({
      capital: 2000,
      totalInvested: 0,
      positions: [{ symbol: 'X', name: 'X', entryPrice: 5000, targetAllocation: 1000, shares: 0, invested: 0, remaining: 1000 }],
    });
    expect(q.perPosition[0].isUnaffordable).toBe(true);
    expect(q.positionsAtRisk).toHaveLength(1);
  });

  it('refuses a zero or negative capital rather than dividing by it', () => {
    expect(() => calculateExecutionQuality({ capital: 0, totalInvested: 0 })).toThrow(/capital must be > 0/);
  });
});

describe('compareIdealToExecutable', () => {
  it('reports the shortfall attributable to lot sizes', () => {
    const c = compareIdealToExecutable({ idealReturnPct: 7.8875, executableReturnPct: 5.7321 });
    expect(c.shortfallPct).toBeCloseTo(2.1554, 4);
    expect(c.captureRatioPct).toBeCloseTo(72.67, 1);
    expect(c.verdict).toBe('material');
  });

  it('calls a negligible difference negligible', () => {
    expect(compareIdealToExecutable({ idealReturnPct: 7.9, executableReturnPct: 7.88 }).verdict).toBe('negligible');
  });

  it('handles flooring happening to help', () => {
    expect(compareIdealToExecutable({ idealReturnPct: 5, executableReturnPct: 5.4 }).verdict).toBe('favourable');
  });

  it('declines a capture ratio against a non-positive ideal', () => {
    // "captured 140% of a -3% return" is arithmetically true and useless.
    const c = compareIdealToExecutable({ idealReturnPct: -3, executableReturnPct: -4.2 });
    expect(c.captureRatioPct).toBeNull();
  });

  it('reports unavailable rather than guessing when an input is missing', () => {
    expect(compareIdealToExecutable({ idealReturnPct: null, executableReturnPct: 5 }).verdict).toBe('unavailable');
  });
});

describe('minimumViableCapital', () => {
  it('is set by the most expensive share across all slots', () => {
    const picks = [{ entryPrice: 100 }, { entryPrice: 3500 }, { entryPrice: 800 }];
    expect(minimumViableCapital(picks, 3)).toBe(10_500);
  });

  it('returns null when there are no usable prices', () => {
    expect(minimumViableCapital([], 5)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* PORTFOLIO VALUATION                                                 */
/* ------------------------------------------------------------------ */

describe('valuePortfolio', () => {
  const positions = [
    { id: '1', symbol: 'A', name: 'A', quantity: 10, purchasePrice: 100, universeKey: 'nifty50' },
    { id: '2', symbol: 'B', name: 'B', quantity: 5, purchasePrice: 200, universeKey: 'nifty50' },
  ];
  const prices = new Map([
    ['A', { price: 120, changePct: 2 }],
    ['B', { price: 180, changePct: -1 }],
  ]);

  it('computes value, P&L and weight', () => {
    const r = valuePortfolio({ positions, priceBySymbol: prices });
    expect(r.totals.invested).toBe(2000);
    expect(r.totals.currentValue).toBe(2100);
    expect(r.totals.pnl).toBe(100);
    expect(r.totals.pnlPct).toBeCloseTo(5, 6);
    const a = r.positions.find((p) => p.symbol === 'A');
    expect(a.weightPct).toBeCloseTo((1200 / 2100) * 100, 6);
  });

  it('weights by CURRENT value, not by cost', () => {
    // A holding that doubled occupies twice the risk it did at purchase.
    const r = valuePortfolio({ positions, priceBySymbol: prices });
    const total = r.positions.reduce((s, p) => s + p.weightPct, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('EXCLUDES an unpriced position — never values it at zero or at cost', () => {
    const r = valuePortfolio({
      positions,
      priceBySymbol: new Map([['A', { price: 120, changePct: 2 }]]),
    });
    expect(r.hasExclusions).toBe(true);
    expect(r.excluded[0].symbol).toBe('B');
    // Zero would fabricate a total loss; cost would fabricate a break-even.
    expect(r.totals.currentValue).toBe(1200);
    expect(r.totals.invested).toBe(1000);
    expect(r.totals.positionCount).toBe(1);
  });

  it("derives today's rupee move from the percentage", () => {
    const r = valuePortfolio({ positions, priceBySymbol: prices });
    const a = r.positions.find((p) => p.symbol === 'A');
    expect(a.todaysChange).toBeCloseTo(1200 - 1200 / 1.02, 6);
  });

  it('returns empty totals rather than NaN for no positions', () => {
    const r = valuePortfolio({ positions: [], priceBySymbol: prices });
    expect(r.totals.currentValue).toBe(0);
    expect(r.totals.pnlPct).toBeNull();
  });
});

describe('annotateWithRanking', () => {
  const ranked = [
    { symbol: 'A', rank: 2, rs: 6 },
    { symbol: 'B', rank: 40, rs: -3 },
  ];

  it('reports Top-N status without merging strategy figures into the holding', () => {
    const out = annotateWithRanking({
      positions: [{ symbol: 'A' }, { symbol: 'B' }, { symbol: 'Z' }],
      ranked,
      topN: 5,
    });
    expect(out[0].topFiveStatus).toBe('in-top-n');
    expect(out[1].topFiveStatus).toBe('dropped-out');
    expect(out[2].topFiveStatus).toBe('unknown');
  });
});

describe('aggregateLots', () => {
  it('combines lots at weighted-average cost', () => {
    const out = aggregateLots([
      { symbol: 'A', quantity: 10, purchasePrice: 100, purchaseDate: '2026-01-05' },
      { symbol: 'A', quantity: 30, purchasePrice: 200, purchaseDate: '2026-03-05' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(40);
    expect(out[0].purchasePrice).toBeCloseTo((10 * 100 + 30 * 200) / 40, 6);
    expect(out[0].lotCount).toBe(2);
    expect(out[0].purchaseDate).toBe('2026-01-05'); // earliest
  });
});
