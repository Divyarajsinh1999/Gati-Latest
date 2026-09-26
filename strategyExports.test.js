import { describe, it, expect } from 'vitest';
import {
  buildCurrentRankingsRows,
  buildTop5Rows,
  buildCurrentPortfolioRows,
  buildMonthlyHistoryRows,
  buildMonthlyRankingsRows,
  buildTradesRows,
  buildBacktestResultsRows,
  buildBenchmarkComparisonRows,
} from '../strategyExports.js';
import { formatPct } from '../formatters.js';

const rankedRow = {
  symbol: 'RELIANCE.NS',
  name: 'Reliance Industries',
  sector: 'Oil, Gas & Consumable Fuels',
  rank: 1,
  currentPrice: 1234.5,
  dailyChangePct: 1.2549,
  previousMonthEndPrice: 1100,
  stockReturnPct: 12.2272,
  benchmarkReturnPct: 3.1,
  rs: 9.1272,
  volume: 1234567,
  flags: [],
};

const cycle = {
  rankedAtMonthKey: '2025-02',
  entryDate: '2025-03-03',
  exitDate: '2025-04-01',
  portfolioHoldingReturnPct: 6.4188,
  benchmarkHoldingReturnPct: 1.9324,
  differencePct: 4.4864,
  transactionCosts: 123.456,
  exitValue: 106419.12,
  picks: [
    { symbol: 'A.NS', entryPrice: 109, shares: 917, invested: 99953, exitPrice: 116, exitValue: 106372, holdingReturnPct: 6.4204 },
  ],
};

describe('export builders — Section 28: exported values must match displayed values', () => {
  it('rounds percentages to 2dp, matching what formatPct renders on screen', () => {
    const [row] = buildCurrentRankingsRows([rankedRow]);
    // The table shows +12.23% via formatPct; the export must agree on the
    // number, differing only in the sign/percent decoration.
    expect(row['Month Return %']).toBe('12.23');
    expect(formatPct(rankedRow.stockReturnPct)).toBe('+12.23%');
    expect(row['RS (%)']).toBe('9.13');
    expect(row['Daily Change %']).toBe('1.25');
  });

  it('includes every Section 21 field in the rankings export', () => {
    const [row] = buildCurrentRankingsRows([rankedRow]);
    expect(Object.keys(row)).toEqual(
      expect.arrayContaining([
        'Rank', 'Symbol', 'Name', 'Sector', 'Current Price', 'Daily Change %',
        'Previous Month-End Price', 'Month Return %', 'Benchmark Return %', 'RS (%)', 'Volume',
      ]),
    );
  });

  it('emits empty strings for missing numbers, never "null" or "NaN"', () => {
    const [row] = buildCurrentRankingsRows([
      { symbol: 'NEW.NS', name: 'Newly Listed', rank: null, rs: null, flags: ['Missing Data'] },
    ]);
    for (const value of Object.values(row)) {
      expect(String(value)).not.toMatch(/null|NaN|undefined/);
    }
    expect(row['Month Return %']).toBe('');
    expect(row.Rank).toBe('');
  });

  it('joins data-quality flags into a single readable field', () => {
    const [row] = buildCurrentRankingsRows([{ ...rankedRow, flags: ['Missing Data', 'Stale Price'] }]);
    expect(row['Data Flags']).toBe('Missing Data; Stale Price');
  });

  it('builds Top 5 rows with rank preserved', () => {
    const rows = buildTop5Rows([{ ...rankedRow, rank: 1 }, { ...rankedRow, symbol: 'B.NS', rank: 2 }]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.Rank)).toEqual([1, 2]);
  });

  it('builds portfolio rows preserving whole-share counts as integers', () => {
    const [row] = buildCurrentPortfolioRows([
      { symbol: 'A.NS', entryPrice: 109, targetAllocation: 10000, shares: 91, invested: 9919, remaining: 81 },
    ]);
    expect(row.Shares).toBe(91); // integer, not '91.00'
    expect(row['Entry Price']).toBe('109.00');
    expect(row['Remaining Cash']).toBe('81.00');
  });

  it('builds monthly history rows including transaction costs and the pick list', () => {
    const [row] = buildMonthlyHistoryRows([cycle]);
    expect(row['Held From']).toBe('2025-03-03');
    expect(row['Held To']).toBe('2025-04-01');
    expect(row['Top 5']).toBe('A.NS');
    expect(row['Portfolio Return %']).toBe('6.42');
    expect(row['Difference (%)']).toBe('4.49');
    expect(row['Transaction Costs']).toBe('123.46');
  });

  it('flattens monthly rankings to one row per stock per month', () => {
    const rows = buildMonthlyRankingsRows([
      { monthKey: '2025-02', date: '2025-02-28', rankings: [{ symbol: 'A', name: 'A', rank: 1, rs: 5 }, { symbol: 'B', name: 'B', rank: 2, rs: -1 }] },
      { monthKey: '2025-03', date: '2025-03-31', rankings: [{ symbol: 'A', name: 'A', rank: 2, rs: 1 }] },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ Month: '2025-02', Symbol: 'A', Rank: 1, 'RS (%)': '5.00' });
    expect(rows[2]).toMatchObject({ Month: '2025-03', Symbol: 'A', Rank: 2 });
  });

  it('flattens trades to one row per position per cycle, with entry and exit on the same row', () => {
    const [row] = buildTradesRows([cycle]);
    expect(row).toMatchObject({
      Symbol: 'A.NS',
      'Entry Date': '2025-03-03',
      'Exit Date': '2025-04-01',
      Shares: 917,
      'Return %': '6.42',
    });
  });

  it('turns the summary object into metric/value pairs', () => {
    const rows = buildBacktestResultsRows({ 'Total Return %': '6.42', 'Winning Months': 2 });
    expect(rows).toEqual([
      { Metric: 'Total Return %', Value: '6.42' },
      { Metric: 'Winning Months', Value: 2 },
    ]);
  });

  it('names the benchmark column after the actual benchmark symbol, so the wrong one cannot be implied', () => {
    const [row] = buildBenchmarkComparisonRows([cycle], 'NIFTYMIDCAP150.NS');
    expect(Object.keys(row)).toContain('Benchmark (NIFTYMIDCAP150.NS) Return %');
    expect(row['Benchmark (NIFTYMIDCAP150.NS) Return %']).toBe('1.93');
  });

  it('every builder returns [] for empty input rather than throwing', () => {
    expect(buildCurrentRankingsRows([])).toEqual([]);
    expect(buildTop5Rows([])).toEqual([]);
    expect(buildCurrentPortfolioRows([])).toEqual([]);
    expect(buildMonthlyHistoryRows([])).toEqual([]);
    expect(buildMonthlyRankingsRows([])).toEqual([]);
    expect(buildTradesRows([])).toEqual([]);
    expect(buildBacktestResultsRows({})).toEqual([]);
    expect(buildBenchmarkComparisonRows([], 'X')).toEqual([]);
  });

  it('tolerates null/undefined collections without throwing', () => {
    expect(buildMonthlyRankingsRows(null)).toEqual([]);
    expect(buildTradesRows(undefined)).toEqual([]);
    expect(buildBacktestResultsRows(null)).toEqual([]);
    expect(buildBenchmarkComparisonRows(null, 'X')).toEqual([]);
  });
});
