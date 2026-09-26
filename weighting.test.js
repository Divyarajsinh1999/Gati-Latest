/**
 * D1 ACCEPTANCE TESTS — weighting basis.
 *
 * The first test in this file is the acceptance criterion for decision D1 and
 * belongs to the permanent regression set. If it ever fails, the historical
 * record has silently become capital-dependent again.
 *
 * WHAT THE DECISION WAS, AND WHY
 *   Under whole-share flooring, the same signals produced these returns purely
 *   as a function of the assumed account size:
 *
 *     ₹25,000 → 5.7321%   ₹1,00,000 → 7.5896%   ₹50,00,000 → 7.8759%
 *     ₹50,000 → 6.9958%   ₹5,00,000 → 7.7549%   ₹50 crore  → 7.8875%
 *
 *   A 2.15pp spread from lot sizes alone. The ₹25,000 figure reports the
 *   strategy underperforming by more than two points when it did nothing of
 *   the sort. So the published record uses exact fractional weights, and
 *   flooring survives only in the Investment Simulator, where the user has
 *   supplied a real amount and the idle cash is a genuine cost they should see.
 */

import { describe, it, expect } from 'vitest';
import { runBacktest } from '../backtestEngine.js';
import { allocate, WEIGHTING, RECORD_WEIGHTING, isCapitalIndependent } from '../weighting.js';
import { makeUniverse } from '../../../tests/harness/syntheticSeries.js';

const u = makeUniverse({ count: 40, seed: 2026 });

function runAt(capital, weighting = RECORD_WEIGHTING) {
  return runBacktest({
    stocks: u.stocks,
    priceSeriesMap: u.priceSeriesMap,
    benchmarkSeries: u.benchmarkSeries,
    initialCapital: capital,
    lookbackMonths: 1,
    weighting,
  });
}

function finalReturnPct(result) {
  const last = result.equityCurve[result.equityCurve.length - 1];
  return last.indexValue - 100;
}

describe('D1 acceptance — the record is capital-independent', () => {
  const capitals = [1, 25_000, 50_000, 100_000, 500_000, 5_000_000, 500_000_000];

  it('reports an IDENTICAL percentage return at every notional', () => {
    const returns = capitals.map((c) => finalReturnPct(runAt(c)));
    const first = returns[0];
    for (const r of returns) {
      // Exact to 10 decimals, not "close enough". Any drift here means an
      // integer boundary has crept back into the record.
      expect(r).toBeCloseTo(first, 10);
    }
  });

  it('reports identical per-cycle returns at every notional', () => {
    const a = runAt(25_000).cycles.map((c) => c.portfolioHoldingReturnPct);
    const b = runAt(500_000_000).cycles.map((c) => c.portfolioHoldingReturnPct);
    expect(a.length).toBeGreaterThan(4);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
  });

  it('never leaves idle cash in the record', () => {
    for (const cycle of runAt(50_000).cycles) {
      expect(cycle.cashCarriedIn).toBe(0);
      expect(cycle.totalInvested).toBeCloseTo(cycle.capitalAtStart, 6);
    }
  });

  it('declares its basis in the result rather than leaving it to be inferred', () => {
    const r = runAt(50_000);
    expect(r.weighting).toBe(WEIGHTING.FRACTIONAL);
    expect(r.isCapitalIndependent).toBe(true);
  });

  it('defaults to the fractional basis without being asked', () => {
    const explicit = runAt(50_000, WEIGHTING.FRACTIONAL);
    const defaulted = runBacktest({
      stocks: u.stocks,
      priceSeriesMap: u.priceSeriesMap,
      benchmarkSeries: u.benchmarkSeries,
      initialCapital: 50_000,
      lookbackMonths: 1,
    });
    expect(defaulted.weighting).toBe(WEIGHTING.FRACTIONAL);
    expect(finalReturnPct(defaulted)).toBeCloseTo(finalReturnPct(explicit), 10);
  });
});

describe('the whole-share path still exists and is still capital-DEPENDENT', () => {
  // Retained deliberately. Flooring is not wrong — it is what actually happens
  // when someone places the trades. It simply belongs to execution simulation
  // rather than to strategy evaluation, and it must stay correct there.

  it('produces a spread from account size alone, where fractional produces none', () => {
    const smallWhole = finalReturnPct(runAt(25_000, WEIGHTING.WHOLE_SHARE));
    const largeWhole = finalReturnPct(runAt(500_000_000, WEIGHTING.WHOLE_SHARE));
    const smallFrac = finalReturnPct(runAt(25_000, WEIGHTING.FRACTIONAL));
    const largeFrac = finalReturnPct(runAt(500_000_000, WEIGHTING.FRACTIONAL));

    // The contrast IS the decision. Fractional: exactly zero spread.
    expect(largeFrac - smallFrac).toBeCloseTo(0, 10);

    // Whole-share: a real, material spread from lot sizes alone. The
    // magnitude depends on the fixture's price levels relative to the slot
    // size — the ₹25,000 case measured 2.15pp on the 50-stock universe used
    // for the decision, and less here on a 40-stock one. What must never
    // change is that it is non-zero and that larger accounts drag less.
    expect(Math.abs(largeWhole - smallWhole)).toBeGreaterThan(0.1);
    expect(largeWhole).toBeGreaterThan(smallWhole);
  });

  it('converges on the fractional answer as flooring error vanishes', () => {
    const huge = finalReturnPct(runAt(500_000_000, WEIGHTING.WHOLE_SHARE));
    const fractional = finalReturnPct(runAt(50_000, WEIGHTING.FRACTIONAL));
    // Confirms the two paths are the same strategy, differing only in drag.
    expect(huge).toBeCloseTo(fractional, 1);
  });

  it('leaves real idle cash at a realistic account size', () => {
    const cycles = runAt(50_000, WEIGHTING.WHOLE_SHARE).cycles;
    const idle = cycles.map((c) => c.cashCarriedIn);
    expect(Math.max(...idle)).toBeGreaterThan(0);
  });
});

describe('allocate — the two bases', () => {
  const picks = [
    { symbol: 'A.NS', name: 'A', entryPrice: 2397.76 },
    { symbol: 'B.NS', name: 'B', entryPrice: 744.38 },
  ];

  it('fractional invests the full amount with zero remainder', () => {
    const r = allocate(picks, 10_000, WEIGHTING.FRACTIONAL);
    expect(r.remainingCash).toBe(0);
    expect(r.totalInvested).toBeCloseTo(10_000, 10);
    expect(r.positions[0].shares).toBeCloseTo(5000 / 2397.76, 10);
    expect(r.positions.every((p) => p.remaining === 0)).toBe(true);
  });

  it('whole-share floors and leaves a real remainder', () => {
    const r = allocate(picks, 10_000, WEIGHTING.WHOLE_SHARE);
    expect(r.positions[0].shares).toBe(Math.floor(5000 / 2397.76));
    expect(r.remainingCash).toBeGreaterThan(0);
    expect(Number.isInteger(r.positions[0].shares)).toBe(true);
  });

  it('refuses an unknown basis instead of silently picking one', () => {
    // Falling back would quietly decide every historical number in the app.
    expect(() => allocate(picks, 10_000, 'approximately')).toThrow(/unknown weighting basis/);
  });

  it('reports which bases are capital-independent', () => {
    expect(isCapitalIndependent(WEIGHTING.FRACTIONAL)).toBe(true);
    expect(isCapitalIndependent(WEIGHTING.WHOLE_SHARE)).toBe(false);
  });
});
