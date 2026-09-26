/**
 * MONTHLY PERFORMANCE — the series behind the chart.
 *
 * WHAT THESE GUARD
 *   That the chart never invents a month, never draws a missing month as
 *   zero, and never disagrees with the record it is drawn from.
 *
 * The zero case is the one that matters. A bar at 0% asserts the strategy
 * broke even that month; a month whose return could not be computed asserts
 * nothing. Drawing the second as the first is the single easiest way for a
 * chart to lie while looking complete.
 */

import { describe, it, expect } from 'vitest';
import { selectUniverseView } from '../universeView.js';

const universe = {
  key: 'nifty50',
  label: 'NIFTY 50',
  benchmark: { symbol: 'NIFTYBEES.NS', shortLabel: 'NIFTYBEES' },
};

const cycle = (exitDate, strategy, benchmark = 1) => ({
  exitDate,
  portfolioHoldingReturnPct: strategy,
  benchmarkHoldingReturnPct: benchmark,
});

/** Minimal bundle — only the fields selectPerformance reads. */
const bundleWith = (cycles) => ({
  backtest: {
    cycles,
    equityCurve: [
      { date: '2026-01-30', monthKey: '2026-01', indexValue: 100 },
      { date: '2026-02-27', monthKey: '2026-02', indexValue: 104 },
    ],
    outperformancePct: 2,
    maxDrawdownPct: -3,
  },
  currentMomentum: { ranked: [] },
  changes: null,
  priceSeriesMap: new Map(),
});

const perf = (cycles) =>
  selectUniverseView({ data: bundleWith(cycles), universe, windowSlug: '1m' })?.performance;

describe('the monthly series', () => {
  it('produces one entry per completed cycle, in order', () => {
    const result = perf([cycle('2026-01-30', 3), cycle('2026-02-27', -1), cycle('2026-03-31', 2)]);
    expect(result.monthly.map((m) => m.monthKey)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('carries the engine\'s own figures through unchanged', () => {
    // The chart reshapes; it must never recalculate. If it did, it could
    // disagree with the totals printed directly above it.
    const result = perf([cycle('2026-01-30', 3.456, 1.234)]);
    expect(result.monthly[0].strategyPct).toBe(3.456);
    expect(result.monthly[0].benchmarkPct).toBe(1.234);
  });

  it('keeps losing months, with their sign intact', () => {
    const result = perf([cycle('2026-01-30', -4.2), cycle('2026-02-27', -0.1), cycle('2026-03-31', 6)]);
    expect(result.monthly.map((m) => m.strategyPct)).toEqual([-4.2, -0.1, 6]);
  });
});

describe('missing data is never drawn as zero', () => {
  it('drops a month whose strategy return could not be computed', () => {
    const result = perf([cycle('2026-01-30', 3), cycle('2026-02-27', null), cycle('2026-03-31', 2)]);
    expect(result.monthly).toHaveLength(2);
    expect(result.monthly.map((m) => m.strategyPct)).not.toContain(0);
    expect(result.monthly.map((m) => m.monthKey)).toEqual(['2026-01', '2026-03']);
  });

  it('keeps the month but nulls the benchmark when only the benchmark is missing', () => {
    // The strategy's own month is a real fact and should still be drawn.
    const result = perf([cycle('2026-01-30', 3, null)]);
    expect(result.monthly).toHaveLength(1);
    expect(result.monthly[0].strategyPct).toBe(3);
    expect(result.monthly[0].benchmarkPct).toBeNull();
  });
});

describe('too little history', () => {
  it.each([0, 1, 2])('refuses to chart %i completed month(s)', (count) => {
    const cycles = Array.from({ length: count }, (_, i) => cycle(`2026-0${i + 1}-28`, 1));
    const result = perf(cycles);
    expect(result.hasMonthly).toBe(false);
    expect(result.monthlyCount).toBe(count);
  });

  it('charts from three months onward', () => {
    const result = perf([cycle('2026-01-30', 1), cycle('2026-02-27', 2), cycle('2026-03-31', 3)]);
    expect(result.hasMonthly).toBe(true);
    expect(result.monthlyCount).toBe(3);
  });

  it('counts only the months it would actually draw', () => {
    // Four cycles, one uncomputable — three drawable, so the chart appears
    // and the count matches what is on screen.
    const result = perf([
      cycle('2026-01-30', 1),
      cycle('2026-02-27', null),
      cycle('2026-03-31', 3),
      cycle('2026-04-30', 4),
    ]);
    expect(result.monthlyCount).toBe(3);
    expect(result.hasMonthly).toBe(true);
  });
});

describe('no backtest at all', () => {
  it('reports an empty series rather than throwing', () => {
    const result = selectUniverseView({
      data: { backtest: null, currentMomentum: { ranked: [] }, changes: null, priceSeriesMap: new Map() },
      universe,
      windowSlug: '1m',
    })?.performance;
    expect(result.monthly).toEqual([]);
    expect(result.hasMonthly).toBe(false);
  });
});
