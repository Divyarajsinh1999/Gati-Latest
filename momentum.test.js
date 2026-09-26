import { describe, it, expect } from 'vitest';
import { calculateReturn, calculateRS, resolveReturnPrice, computeStockRS } from '../momentum.js';

describe('calculateReturn', () => {
  it('computes basic percentage return', () => {
    expect(calculateReturn(108, 100)).toBeCloseTo(8, 10);
    expect(calculateReturn(92, 100)).toBeCloseTo(-8, 10);
    expect(calculateReturn(100, 100)).toBeCloseTo(0, 10);
  });

  it('throws on non-positive or non-finite prices instead of returning NaN/Infinity', () => {
    expect(() => calculateReturn(100, 0)).toThrow();
    expect(() => calculateReturn(100, -5)).toThrow();
    expect(() => calculateReturn(NaN, 100)).toThrow();
    expect(() => calculateReturn(100, undefined)).toThrow();
  });
});

describe('calculateRS — spec worked example (Section 9)', () => {
  it('matches the spec exactly: +8% stock, +3% benchmark => RS = +5', () => {
    expect(calculateRS(8, 3)).toBeCloseTo(5, 10);
  });

  it('is a pure subtraction (order and sign matter)', () => {
    expect(calculateRS(-2, 3)).toBeCloseTo(-5, 10);
    expect(calculateRS(10, -10)).toBeCloseTo(20, 10);
  });
});

describe('resolveReturnPrice — Section 6 price convention', () => {
  it('prefers adjClose when present', () => {
    const { price, flags } = resolveReturnPrice({ close: 100, adjClose: 98.5 });
    expect(price).toBe(98.5);
    expect(flags).toHaveLength(0);
  });

  it('falls back to close and raises a flag when adjClose is missing', () => {
    const { price, flags } = resolveReturnPrice({ close: 100 });
    expect(price).toBe(100);
    expect(flags.length).toBeGreaterThan(0);
  });

  it('flags MISSING_DATA when neither field is usable', () => {
    const { price, flags } = resolveReturnPrice({});
    expect(price).toBeNull();
    expect(flags.length).toBeGreaterThan(0);
  });
});

describe('computeStockRS — end-to-end for one stock/one period', () => {
  it('reproduces the spec example using real record shapes', () => {
    const result = computeStockRS({
      previousRecord: { date: '2025-01-31', adjClose: 100 },
      currentRecord: { date: '2025-02-28', adjClose: 108 },
      previousBenchmark: { date: '2025-01-31', adjClose: 200 },
      currentBenchmark: { date: '2025-02-28', adjClose: 206 },
    });
    expect(result.stockReturnPct).toBeCloseTo(8, 10);
    expect(result.benchmarkReturnPct).toBeCloseTo(3, 10);
    expect(result.rs).toBeCloseTo(5, 10);
    expect(result.flags).toHaveLength(0);
  });

  it('returns null RS (not a crash) when a price is missing, and flags it', () => {
    const result = computeStockRS({
      previousRecord: { date: '2025-01-31', adjClose: 100 },
      currentRecord: { date: '2025-02-28' }, // no price at all
      previousBenchmark: { date: '2025-01-31', adjClose: 200 },
      currentBenchmark: { date: '2025-02-28', adjClose: 206 },
    });
    expect(result.rs).toBeNull();
    expect(result.flags.length).toBeGreaterThan(0);
  });
});

describe('computeStockRS — mixed price convention guard (spec Section 6)', () => {
  const b1 = { date: '2025-06-30', adjClose: 200 };
  const b2 = { date: '2025-07-31', adjClose: 202 };

  it('REFUSES to compute when the older bar is unadjusted and the newer is adjusted', () => {
    // Real disaster case: a 1:5 split between the two dates. Comparing a raw
    // 5000 against an adjusted 1050 reports -79% for a stock that rose 5%.
    // That stock would rank dead last and never be selectable.
    const result = computeStockRS({
      previousRecord: { date: '2025-06-30', close: 5000 }, // no adjClose
      currentRecord: { date: '2025-07-31', close: 1050, adjClose: 1050 },
      previousBenchmark: b1,
      currentBenchmark: b2,
    });
    expect(result.stockReturnPct).toBeNull();
    expect(result.rs).toBeNull();
    expect(result.flags.some((f) => /cannot compare/i.test(f))).toBe(true);
  });

  it('REFUSES in the opposite direction too, which would otherwise fake a huge gain', () => {
    // Adjusted 1000 -> raw 5250 reads as +425% and would dominate the Top 5.
    const result = computeStockRS({
      previousRecord: { date: '2025-06-30', close: 5000, adjClose: 1000 },
      currentRecord: { date: '2025-07-31', close: 5250 }, // no adjClose
      previousBenchmark: b1,
      currentBenchmark: b2,
    });
    expect(result.stockReturnPct).toBeNull();
    expect(result.flags.some((f) => /cannot compare/i.test(f))).toBe(true);
  });

  it('guards the BENCHMARK ratio as well, not just the stock', () => {
    const result = computeStockRS({
      previousRecord: { date: '2025-06-30', adjClose: 100 },
      currentRecord: { date: '2025-07-31', adjClose: 110 },
      previousBenchmark: { date: '2025-06-30', close: 5000 }, // no adjClose
      currentBenchmark: { date: '2025-07-31', close: 202, adjClose: 202 },
    });
    expect(result.rs).toBeNull();
    expect(result.flags.some((f) => /Benchmark: cannot compare/i.test(f))).toBe(true);
  });

  it('still computes normally when BOTH bars fall back to close consistently', () => {
    // Consistent basis is fine — no adjusted data anywhere, but the ratio is
    // still meaningful. It carries a flag, but a usable number.
    const result = computeStockRS({
      previousRecord: { date: '2025-06-30', close: 100 },
      currentRecord: { date: '2025-07-31', close: 110 },
      previousBenchmark: { date: '2025-06-30', close: 200 },
      currentBenchmark: { date: '2025-07-31', close: 202 },
    });
    expect(result.stockReturnPct).toBeCloseTo(10, 6);
    expect(result.rs).toBeCloseTo(9, 6);
    expect(result.flags.some((f) => /Adjusted Close unavailable/i.test(f))).toBe(true);
  });

  it('reports which field was used, so callers can check the basis', () => {
    expect(resolveReturnPrice({ close: 100, adjClose: 98 }).field).toBe('adjClose');
    expect(resolveReturnPrice({ close: 100 }).field).toBe('close');
    expect(resolveReturnPrice({}).field).toBeNull();
  });
});
