import { describe, it, expect } from 'vitest';
import { calculateCAGR, calculateMaxDrawdown, calculateWinLossMonths, calculateSharpe, calculateSortino, calculateVolatility } from '../metrics.js';

describe('calculateCAGR', () => {
  it('computes 50% CAGR for 100k -> 150k over exactly 12 months', () => {
    const { value, reason } = calculateCAGR(100_000, 150_000, 12);
    expect(reason).toBeNull();
    expect(value).toBeCloseTo(50, 6);
  });

  it('refuses to report CAGR for too short a period rather than showing a misleading annualised figure', () => {
    const { value, reason } = calculateCAGR(100_000, 110_000, 2);
    expect(value).toBeNull();
    expect(reason).toMatch(/insufficient/i);
  });
});

describe('calculateMaxDrawdown', () => {
  it('finds the correct peak-to-trough drawdown on a known curve', () => {
    // peak 120 (idx1) -> trough 80 (idx4) -> (120-80)/120 = 33.33%
    const curve = [100, 120, 90, 110, 80, 130];
    const { value, peakIndex, troughIndex } = calculateMaxDrawdown(curve);
    expect(value).toBeCloseTo(33.333333, 4);
    expect(peakIndex).toBe(1);
    expect(troughIndex).toBe(4);
  });

  it('returns 0 for a monotonically increasing curve', () => {
    expect(calculateMaxDrawdown([100, 110, 120, 130]).value).toBe(0);
  });
});

describe('calculateWinLossMonths', () => {
  const rows = [
    { monthKey: '2025-02', returnPct: 3.5 },
    { monthKey: '2025-03', returnPct: -1.2 },
    { monthKey: '2025-04', returnPct: 8.1 },
    { monthKey: '2025-05', returnPct: -4.0 },
    { monthKey: '2025-06', returnPct: 0 },
  ];
  const result = calculateWinLossMonths(rows);

  it('counts winning/losing/flat months correctly', () => {
    expect(result.winningMonths).toBe(2);
    expect(result.losingMonths).toBe(2);
    expect(result.flatMonths).toBe(1);
    expect(result.totalMonths).toBe(5);
  });

  it('identifies the best and worst month', () => {
    expect(result.bestMonth.monthKey).toBe('2025-04');
    expect(result.worstMonth.monthKey).toBe('2025-05');
  });
});

describe('calculateSharpe / calculateSortino — sample-size gating', () => {
  it('refuses to compute with fewer than the minimum months', () => {
    const shortSample = Array.from({ length: 5 }, () => 1);
    expect(calculateSharpe(shortSample).value).toBeNull();
    expect(calculateSortino(shortSample).value).toBeNull();
  });

  it('computes a finite Sharpe ratio once enough monthly observations exist', () => {
    const sample = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 3 : -1));
    const { value, reason } = calculateSharpe(sample);
    expect(reason).toBeNull();
    expect(Number.isFinite(value)).toBe(true);
  });

  it('Sortino only penalises downside deviation, so it should differ from Sharpe on an asymmetric sample', () => {
    const sample = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, -20]; // one big down month
    const sharpe = calculateSharpe(sample).value;
    const sortino = calculateSortino(sample).value;
    expect(sortino).not.toBeCloseTo(sharpe, 2);
  });
});

describe('calculateVolatility', () => {
  it('refuses to report an annualised figure from too small a sample', () => {
    const { value, reason } = calculateVolatility([1, 2, 3]);
    expect(value).toBeNull();
    expect(reason).toMatch(/insufficient/i);
  });

  it('returns exactly 0 for a constant return series', () => {
    expect(calculateVolatility(Array.from({ length: 12 }, () => 2)).value).toBe(0);
  });

  it('annualises monthly dispersion by sqrt(12), matching Sharpe/Sortino convention', () => {
    // Alternating +8 / -4 has a monthly population sd of 6, so annualised
    // volatility is 6 * sqrt(12) ~= 20.78%.
    const sample = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 8 : -4));
    expect(calculateVolatility(sample).value).toBeCloseTo(6 * Math.sqrt(12), 6);
  });

  it('is unaffected by the sign of the mean — dispersion, not direction', () => {
    const up = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 8 : -4));
    const shiftedDown = up.map((r) => r - 20);
    expect(calculateVolatility(shiftedDown).value).toBeCloseTo(calculateVolatility(up).value, 6);
  });
});
