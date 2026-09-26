import { describe, it, expect } from 'vitest';
import {
  buildEquityComparisonSeries,
  buildDrawdownSeries,
  buildMonthlyReturnsSeries,
  buildRankingHistorySeries,
  buildAttributionSeries,
} from '../chartData.js';

describe('buildEquityComparisonSeries', () => {
  it('zips the two curves by index into Portfolio/Benchmark rows', () => {
    const rows = buildEquityComparisonSeries(
      [{ date: '2025-03-03', value: 50_000 }, { date: '2025-04-01', value: 53_210 }],
      [{ date: '2025-03-03', value: 50_000 }, { date: '2025-04-01', value: 50_966 }],
    );
    expect(rows).toEqual([
      { date: '2025-03-03', Portfolio: 50_000, Benchmark: 50_000 },
      { date: '2025-04-01', Portfolio: 53_210, Benchmark: 50_966 },
    ]);
  });

  it('yields null (a visible gap) rather than dropping a row when the benchmark is short', () => {
    const rows = buildEquityComparisonSeries(
      [{ date: 'a', value: 1 }, { date: 'b', value: 2 }],
      [{ date: 'a', value: 1 }],
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].Benchmark).toBeNull();
  });

  it('handles empty inputs', () => {
    expect(buildEquityComparisonSeries([], [])).toEqual([]);
    expect(buildEquityComparisonSeries()).toEqual([]);
  });
});

describe('buildDrawdownSeries', () => {
  it('computes percentage below the running peak at each point', () => {
    // peak progression: 100, 120, 120, 120
    // drawdowns:        0,   0,   -25, -8.333
    const rows = buildDrawdownSeries([
      { date: 'a', value: 100 },
      { date: 'b', value: 120 },
      { date: 'c', value: 90 },
      { date: 'd', value: 110 },
    ]);
    expect(rows.map((r) => r.Drawdown)).toEqual([
      0,
      0,
      expect.closeTo(-25, 6),
      expect.closeTo(-8.3333, 3),
    ]);
  });

  it('never reports a positive drawdown, since the peak is monotonic', () => {
    const rows = buildDrawdownSeries([
      { date: 'a', value: 100 },
      { date: 'b', value: 200 },
      { date: 'c', value: 400 },
    ]);
    expect(rows.every((r) => r.Drawdown <= 0)).toBe(true);
    expect(rows.map((r) => r.Drawdown)).toEqual([0, 0, 0]);
  });

  it('recovers to 0 when a new high is reached after a trough', () => {
    const rows = buildDrawdownSeries([
      { date: 'a', value: 100 },
      { date: 'b', value: 50 },
      { date: 'c', value: 150 },
    ]);
    expect(rows[1].Drawdown).toBeCloseTo(-50, 6);
    expect(rows[2].Drawdown).toBe(0);
  });

  it('preserves dates and length, one row in one row out', () => {
    const curve = [{ date: 'x', value: 10 }, { date: 'y', value: 5 }];
    const rows = buildDrawdownSeries(curve);
    expect(rows.map((r) => r.date)).toEqual(['x', 'y']);
  });

  it('handles an empty curve', () => {
    expect(buildDrawdownSeries([])).toEqual([]);
    expect(buildDrawdownSeries()).toEqual([]);
  });
});

describe('buildMonthlyReturnsSeries', () => {
  it('maps each cycle to its exit date with both returns', () => {
    const rows = buildMonthlyReturnsSeries([
      { exitDate: '2025-04-01', portfolioHoldingReturnPct: 6.42, benchmarkHoldingReturnPct: 1.93 },
      { exitDate: '2025-05-02', portfolioHoldingReturnPct: -8.1, benchmarkHoldingReturnPct: 0.46 },
    ]);
    expect(rows).toEqual([
      { date: '2025-04-01', Portfolio: 6.42, Benchmark: 1.93 },
      { date: '2025-05-02', Portfolio: -8.1, Benchmark: 0.46 },
    ]);
  });

  it('passes nulls through rather than coercing them to 0', () => {
    const rows = buildMonthlyReturnsSeries([{ exitDate: 'a', portfolioHoldingReturnPct: null, benchmarkHoldingReturnPct: null }]);
    expect(rows[0].Portfolio).toBeNull();
    expect(rows[0].Benchmark).toBeNull();
  });
});

describe('buildRankingHistorySeries', () => {
  const snapshot = (monthKey, rankings) => ({ monthKey, date: `${monthKey}-28`, rankings });

  it('only charts stocks that reached the Top N at least once', () => {
    const { symbols } = buildRankingHistorySeries(
      [snapshot('2025-02', [
        { symbol: 'IN.NS', name: 'In', rank: 1, rs: 5 },
        { symbol: 'OUT.NS', name: 'Out', rank: 40, rs: -5 },
      ])],
      5,
    );
    expect(symbols).toEqual(['IN.NS']);
  });

  it('prefers stocks with the most Top-N appearances when capped by maxLines', () => {
    const history = [
      snapshot('2025-02', [{ symbol: 'STEADY.NS', name: 'S', rank: 1, rs: 5 }, { symbol: 'FLICKER.NS', name: 'F', rank: 2, rs: 4 }]),
      snapshot('2025-03', [{ symbol: 'STEADY.NS', name: 'S', rank: 1, rs: 5 }, { symbol: 'FLICKER.NS', name: 'F', rank: 30, rs: -4 }]),
      snapshot('2025-04', [{ symbol: 'STEADY.NS', name: 'S', rank: 2, rs: 3 }, { symbol: 'FLICKER.NS', name: 'F', rank: 25, rs: -3 }]),
    ];
    const { symbols } = buildRankingHistorySeries(history, 5, 1);
    expect(symbols).toEqual(['STEADY.NS']); // 3 appearances vs 1
  });

  it('breaks appearance-count ties alphabetically, so output is deterministic', () => {
    const history = [snapshot('2025-02', [
      { symbol: 'ZED.NS', name: 'Z', rank: 1, rs: 5 },
      { symbol: 'ALPHA.NS', name: 'A', rank: 2, rs: 4 },
    ])];
    const first = buildRankingHistorySeries(history, 5, 2).symbols;
    const second = buildRankingHistorySeries(history, 5, 2).symbols;
    expect(first).toEqual(['ALPHA.NS', 'ZED.NS']);
    expect(second).toEqual(first);
  });

  it('gives a qualifying stock null (not a fabricated rank) for months it was absent', () => {
    const history = [
      snapshot('2025-02', [{ symbol: 'A.NS', name: 'A', rank: 1, rs: 5 }]),
      snapshot('2025-03', [{ symbol: 'B.NS', name: 'B', rank: 1, rs: 5 }]),
    ];
    const { data, symbols } = buildRankingHistorySeries(history, 5, 5);
    expect(symbols.sort()).toEqual(['A.NS', 'B.NS']);
    expect(data[0]['A.NS']).toBe(1);
    expect(data[0]['B.NS']).toBeNull(); // absent in Feb
    expect(data[1]['A.NS']).toBeNull(); // absent in Mar
  });

  it('emits one data row per snapshot, carrying date and monthKey', () => {
    const history = [
      snapshot('2025-02', [{ symbol: 'A.NS', name: 'A', rank: 1, rs: 5 }]),
      snapshot('2025-03', [{ symbol: 'A.NS', name: 'A', rank: 3, rs: 1 }]),
    ];
    const { data } = buildRankingHistorySeries(history, 5, 5);
    expect(data).toHaveLength(2);
    expect(data.map((r) => r.monthKey)).toEqual(['2025-02', '2025-03']);
    expect(data.map((r) => r['A.NS'])).toEqual([1, 3]);
  });

  it('ignores unranked rows (rank null) when deciding qualifiers', () => {
    const { symbols } = buildRankingHistorySeries(
      [snapshot('2025-02', [{ symbol: 'NODATA.NS', name: 'N', rank: null, rs: null }])],
      5,
    );
    expect(symbols).toEqual([]);
  });

  it('returns empty structures for empty input', () => {
    expect(buildRankingHistorySeries([])).toEqual({ data: [], symbols: [] });
    expect(buildRankingHistorySeries()).toEqual({ data: [], symbols: [] });
  });
});

describe('buildAttributionSeries', () => {
  /**
   * Contribution is now measured in PERCENTAGE POINTS of portfolio return
   * (decisions D1/A2), not rupees — a rupee figure would depend on the
   * notional the backtest happened to run with, which is exactly the account-
   * size assumption the capital-independent record removed.
   *
   * So a cycle needs its totalInvested: a position's contribution is its own
   * return scaled by the weight it carried that month.
   */
  const cycle = (picks) => ({
    picks,
    totalInvested: picks.reduce((sum, p) => sum + (p.invested ?? 0), 0),
  });

  it("sums a stock's contribution across every cycle it was held, rather than listing it repeatedly", () => {
    const rows = buildAttributionSeries([
      cycle([{ symbol: 'A.NS', name: 'A', invested: 10_000, exitValue: 11_000 }]),
      cycle([{ symbol: 'A.NS', name: 'A', invested: 11_000, exitValue: 11_500 }]),
    ]);
    expect(rows).toHaveLength(1);
    // Sole holding, so weight is 1 in both cycles: +10.00% then +4.545%.
    expect(rows[0].contribution).toBeCloseTo(10 + (500 / 11_000) * 100, 6);
    expect(rows[0].timesHeld).toBe(2);
    expect(rows[0].label).toBe('A (×2)');
  });

  it('is INVARIANT to the notional the backtest ran with', () => {
    // The whole reason contribution is measured in percentage points: a rupee
    // figure would encode whatever capital the backtest happened to use, which
    // is the account-size assumption decision D1 removed.
    const small = buildAttributionSeries([
      cycle([
        { symbol: 'A.NS', name: 'A', invested: 5_000, exitValue: 5_500 },
        { symbol: 'B.NS', name: 'B', invested: 5_000, exitValue: 4_500 },
      ]),
    ]);
    const large = buildAttributionSeries([
      cycle([
        { symbol: 'A.NS', name: 'A', invested: 5_000_000, exitValue: 5_500_000 },
        { symbol: 'B.NS', name: 'B', invested: 5_000_000, exitValue: 4_500_000 },
      ]),
    ]);
    expect(small.map((r) => r.contribution)).toEqual(large.map((r) => r.contribution));
  });

  it('SKIPS picks with a missing exit value instead of scoring them as break-even', () => {
    // Counting a missing exit as zero P&L would quietly understate or flatter
    // the attribution; the pick is excluded and its hold is not counted.
    const rows = buildAttributionSeries([
      cycle([
        { symbol: 'GOOD.NS', name: 'G', invested: 10_000, exitValue: 12_000 },
        { symbol: 'NOEXIT.NS', name: 'N', invested: 10_000, exitValue: null },
      ]),
    ]);
    expect(rows.map((r) => r.symbol)).toEqual(['GOOD.NS']);
  });

  it('keeps large negative contributors, selecting by absolute impact', () => {
    // A big detractor must not be hidden behind a small winner when capped.
    const rows = buildAttributionSeries([
      cycle([
        { symbol: 'SMALLWIN.NS', name: 'S', invested: 10_000, exitValue: 10_100 }, // +100
        { symbol: 'BIGLOSS.NS', name: 'B', invested: 10_000, exitValue: 7_000 }, // -3000
      ]),
    ], 1);
    expect(rows.map((r) => r.symbol)).toEqual(['BIGLOSS.NS']);
  });

  it('sorts the surviving rows by signed contribution, winners first', () => {
    const rows = buildAttributionSeries([
      cycle([
        { symbol: 'LOSS.NS', name: 'L', invested: 10_000, exitValue: 9_000 },
        { symbol: 'WIN.NS', name: 'W', invested: 10_000, exitValue: 12_000 },
        { symbol: 'MID.NS', name: 'M', invested: 10_000, exitValue: 10_500 },
      ]),
    ]);
    expect(rows.map((r) => r.symbol)).toEqual(['WIN.NS', 'MID.NS', 'LOSS.NS']);
  });

  it('respects the maxBars cap', () => {
    const picks = Array.from({ length: 12 }, (_, i) => ({ symbol: `S${i}.NS`, name: `S${i}`, invested: 10_000, exitValue: 10_000 + i * 100 }));
    expect(buildAttributionSeries([cycle(picks)], 5)).toHaveLength(5);
  });

  it('strips the .NS suffix in the display label', () => {
    const rows = buildAttributionSeries([cycle([{ symbol: 'RELIANCE.NS', name: 'Reliance', invested: 100, exitValue: 200 }])]);
    expect(rows[0].label).toBe('RELIANCE (×1)');
  });

  it('returns [] for empty cycles or cycles with no picks', () => {
    expect(buildAttributionSeries([])).toEqual([]);
    expect(buildAttributionSeries()).toEqual([]);
    expect(buildAttributionSeries([cycle([])])).toEqual([]);
    expect(buildAttributionSeries([{}])).toEqual([]);
  });
});
