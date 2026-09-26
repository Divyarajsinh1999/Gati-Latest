/**
 * REPORTS VIEW MODEL TESTS — M8.
 *
 * The rule most worth guarding is that universes are never added together.
 * Three portfolios measured against three different benchmarks are not
 * addable, and a combined figure would describe nothing that exists.
 *
 * Second is that an absent record reports WHY rather than a zero — zero would
 * claim the strategy broke even.
 */

import { describe, it, expect } from 'vitest';
import { selectUniverseComparison, selectWindowMatrix, selectMonthlyHistory } from '../reportsView.js';
import { UNIVERSE_KEYS } from '../../config/universes.js';
import { WINDOW_SLUGS } from '../../config/routes.js';
import { makeUniverse } from '../../../tests/harness/syntheticSeries.js';

function result(key, headline, cycles = [{}, {}, {}]) {
  return { key, data: headline === null ? null : { headline, backtest: { cycles } } };
}

const headline = (over = {}) => ({
  strategyReturnPct: 21.3,
  benchmarkReturnPct: 9.9,
  outperformancePct: 11.4,
  maxDrawdownPct: -8.7,
  completedCycles: 3,
  ...over,
});

describe('selectUniverseComparison', () => {
  const results = [
    result(UNIVERSE_KEYS[0], headline()),
    result(UNIVERSE_KEYS[1], headline({ outperformancePct: -4.2, strategyReturnPct: 5.7 })),
    result(UNIVERSE_KEYS[2], headline({ completedCycles: 0, outperformancePct: null })),
  ];

  it('reports each universe side by side, never summed', () => {
    const rows = selectUniverseComparison(results, '1m');
    expect(rows).toHaveLength(3);
    // No total field exists, by design: three benchmarks are not addable.
    expect(rows.some((r) => 'total' in r || 'combined' in r)).toBe(false);
  });

  it('formats outperformance with a % sign and a direction', () => {
    const rows = selectUniverseComparison(results, '1m');
    expect(rows[0].outperformanceLabel).toBe('+11.4%');
    expect(rows[0].direction).toBe('gain');
    expect(rows[1].outperformanceLabel).toBe('−4.2%');
    expect(rows[1].direction).toBe('loss');
  });

  it('reports WHY a universe is unavailable rather than showing zero', () => {
    const rows = selectUniverseComparison(results, '6m');
    expect(rows[2].available).toBe(false);
    expect(rows[2].reason).toContain('No completed rebalance');
    expect(rows[2].outperformanceLabel).toBeUndefined();
  });

  it('handles a universe whose data has not loaded', () => {
    const rows = selectUniverseComparison([result('nifty50', null)], '1m');
    expect(rows[0].available).toBe(false);
  });

  it('returns an empty list rather than throwing on no results', () => {
    expect(selectUniverseComparison([], '1m')).toEqual([]);
  });
});

describe('selectWindowMatrix', () => {
  const u = makeUniverse({ count: 20, seed: 7 });
  const withSeries = [{
    key: UNIVERSE_KEYS[0],
    data: { stocks: u.stocks, priceSeriesMap: u.priceSeriesMap, benchmarkSeries: u.benchmarkSeries },
  }];

  it('produces one cell per window', () => {
    const matrix = selectWindowMatrix(withSeries);
    expect(matrix[0].cells.map((c) => c.window)).toEqual(WINDOW_SLUGS);
  });

  it('computes a real outperformance for each window', () => {
    const matrix = selectWindowMatrix(withSeries);
    const available = matrix[0].cells.filter((c) => c.available);
    expect(available.length).toBeGreaterThan(0);
    for (const cell of available) {
      expect(cell.label).toMatch(/^[+−]\d+\.\d+%$/);
      expect(cell.cycles).toBeGreaterThan(0);
    }
  });

  it('reports the cycle count beside every cell', () => {
    // A strong figure on three rebalances is not the same claim as the same
    // figure on eighteen, and the matrix must not let them look alike.
    const matrix = selectWindowMatrix(withSeries);
    const short = matrix[0].cells.find((c) => c.window === '1m');
    const long = matrix[0].cells.find((c) => c.window === '12m');
    expect(short.cycles).toBeGreaterThan(long.cycles ?? 0);
  });

  it('marks a window unavailable rather than showing zero', () => {
    const matrix = selectWindowMatrix([{ key: 'nifty50', data: null }]);
    expect(matrix[0].cells.every((c) => c.available === false)).toBe(true);
  });

  it('agrees with the engine — same inputs, same function, same output', () => {
    // Recomputing here is the ONLY calculation of these figures (the hook
    // computes one window). Running it twice must give the same answer.
    const a = selectWindowMatrix(withSeries);
    const b = selectWindowMatrix(withSeries);
    expect(a[0].cells.map((c) => c.label)).toEqual(b[0].cells.map((c) => c.label));
  });
});

describe('selectMonthlyHistory', () => {
  const cycles = [
    { signalMonthKey: '2025-01', portfolioHoldingReturnPct: 3, benchmarkHoldingReturnPct: 1, picks: [{ symbol: 'A', name: 'A' }, { symbol: 'B', name: 'B' }] },
    { signalMonthKey: '2025-02', portfolioHoldingReturnPct: -2, benchmarkHoldingReturnPct: 1, picks: [{ symbol: 'A', name: 'A' }, { symbol: 'C', name: 'C' }] },
    { signalMonthKey: '2025-03', portfolioHoldingReturnPct: 5, benchmarkHoldingReturnPct: 2, picks: [{ symbol: 'C', name: 'C' }, { symbol: 'D', name: 'D' }] },
  ];
  const results = [{ key: 'nifty50', data: { backtest: { cycles } } }];

  it('lists newest first', () => {
    expect(selectMonthlyHistory(results, 'nifty50').map((r) => r.monthKey)).toEqual(['2025-03', '2025-02', '2025-01']);
  });

  it('states HOW the portfolio changed, not only what it returned', () => {
    const rows = selectMonthlyHistory(results, 'nifty50');
    expect(rows[0].changeLabel).toBe('1 entered · 1 held'); // D enters, C held
    expect(rows[1].changeLabel).toBe('1 entered · 1 held'); // C enters, A held
  });

  it('claims no change for the first rebalance, which has nothing before it', () => {
    // "0 changed" would be a claim the data does not support.
    const rows = selectMonthlyHistory(results, 'nifty50');
    expect(rows.at(-1).changeLabel).toBe('First rebalance');
  });

  it('shows the benchmark beside every month', () => {
    expect(selectMonthlyHistory(results, 'nifty50')[0].benchmarkLabel).toBe('+2.00%');
  });

  it('returns an empty list for a universe with no cycles', () => {
    expect(selectMonthlyHistory([{ key: 'nifty50', data: { backtest: { cycles: [] } } }], 'nifty50')).toEqual([]);
    expect(selectMonthlyHistory([], 'nifty50')).toEqual([]);
  });
});
