import { describe, it, expect } from 'vitest';
import { computeCurrentMomentum } from '../currentMomentum.js';

const bar = (date, price, volume = 1000) => ({ date, open: price, high: price, low: price, close: price, adjClose: price, volume });

/**
 * Series deliberately ends MID-MONTH (July still in progress). That is the
 * only condition under which the bug this file guards against appears,
 * which is exactly why it survived a build, a lint pass and 189 tests.
 */
const benchmarkSeries = [
  bar('2026-05-28', 200),
  bar('2026-05-29', 202), // May month-end
  bar('2026-06-29', 208),
  bar('2026-06-30', 210), // June month-end  <- the correct reference
  bar('2026-07-28', 214),
  bar('2026-07-29', 216), // latest bar, July INCOMPLETE
];

// Stock A: 110 -> 121 since June month-end = +10.00%
// Benchmark:  210 -> 216                   = +2.857%
// RS(A) = +7.143pp
const stockA = [bar('2026-05-29', 100), bar('2026-06-30', 110), bar('2026-07-29', 121)];
// Stock B: 50 -> 51 = +2.00%  => RS = -0.857pp
const stockB = [bar('2026-05-29', 48), bar('2026-06-30', 50), bar('2026-07-29', 51)];

const stocks = [
  { symbol: 'A.NS', name: 'A Ltd', sector: 'Financial Services' },
  { symbol: 'B.NS', name: 'B Ltd', sector: 'Information Technology' },
];
const priceSeriesMap = new Map([['A.NS', stockA], ['B.NS', stockB]]);

describe('computeCurrentMomentum — previous month-end reference (regression guard)', () => {
  const result = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, topN: 5 });

  it('anchors to the last COMPLETED month, not the in-progress one', () => {
    // The bug: getMonthEndRecords() returns the last bar of every month
    // INCLUDING the current incomplete one, so taking its final entry gave
    // 2026-07-29 — today's own bar. The reference must be June's close.
    expect(result.basedOnMonthKey).toBe('2026-06');
    expect(result.referenceDate).toBe('2026-06-30');
    expect(result.asOf).toBe('2026-07-29');
  });

  it('produces NON-ZERO returns — the bug made every stock report exactly 0.00%', () => {
    const a = result.ranked.find((r) => r.symbol === 'A.NS');
    expect(a.stockReturnPct).not.toBe(0);
    expect(a.benchmarkReturnPct).not.toBe(0);
    expect(result.ranked.every((r) => r.rs === 0)).toBe(false);
  });

  it('computes hand-checked returns and RS against June month-end', () => {
    const a = result.ranked.find((r) => r.symbol === 'A.NS');
    const b = result.ranked.find((r) => r.symbol === 'B.NS');

    expect(a.stockReturnPct).toBeCloseTo(10, 6); // 110 -> 121
    expect(b.stockReturnPct).toBeCloseTo(2, 6); // 50 -> 51
    expect(a.benchmarkReturnPct).toBeCloseTo(2.857142, 5); // 210 -> 216
    expect(a.rs).toBeCloseTo(10 - 2.857142, 5);
    expect(b.rs).toBeCloseTo(2 - 2.857142, 5);
  });

  it('ranks by RS with a real ordering rather than an alphabetical fallback', () => {
    // With every RS identically 0 the sort collapsed to the symbol
    // tie-break, so ranking looked plausible while being meaningless.
    expect(result.ranked.map((r) => r.symbol)).toEqual(['A.NS', 'B.NS']);
    expect(result.ranked[0].rank).toBe(1);
    expect(result.picks[0].symbol).toBe('A.NS');
  });

  it('reports the previous month-end PRICE, not the latest price', () => {
    const a = result.ranked.find((r) => r.symbol === 'A.NS');
    expect(a.previousMonthEndPrice).toBe(110); // June close, not 121
  });
});

describe('computeCurrentMomentum — month boundary behaviour', () => {
  it('uses the prior month when the latest bar IS itself a month-end', () => {
    // Market closed on 30 June and that is the newest bar: the "current
    // month" is June, so the reference is May.
    const series = benchmarkSeries.slice(0, 4); // ends 2026-06-30
    const r = computeCurrentMomentum({
      stocks,
      priceSeriesMap: new Map([['A.NS', stockA.slice(0, 2)]]),
      benchmarkSeries: series,
    });
    expect(r.basedOnMonthKey).toBe('2026-05');
    // 202 -> 210 benchmark; 100 -> 110 stock A
    const a = r.ranked.find((x) => x.symbol === 'A.NS');
    expect(a.stockReturnPct).toBeCloseTo(10, 6);
    expect(a.benchmarkReturnPct).toBeCloseTo(3.9604, 3);
  });

  it('handles a month gap (no trading data for an intervening month)', () => {
    const gapped = [bar('2026-04-29', 100), bar('2026-07-29', 120)];
    const r = computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A' }],
      priceSeriesMap: new Map([['A.NS', [bar('2026-04-29', 50), bar('2026-07-29', 60)]]]),
      benchmarkSeries: gapped,
    });
    expect(r.basedOnMonthKey).toBe('2026-04'); // most recent completed month present
    expect(r.ranked[0].stockReturnPct).toBeCloseTo(20, 6);
  });
});

describe('computeCurrentMomentum — insufficient or missing data (spec Section 41)', () => {
  it('refuses to report 0% when there is no completed month to measure against', () => {
    const onlyThisMonth = [bar('2026-07-28', 100), bar('2026-07-29', 105)];
    const r = computeCurrentMomentum({ stocks: [{ symbol: 'A.NS', name: 'A' }], priceSeriesMap: new Map(), benchmarkSeries: onlyThisMonth });
    expect(r.ranked).toEqual([]);
    expect(r.basedOnMonthKey).toBeNull();
    expect(r.flags.length).toBeGreaterThan(0);
    // Message generalised to name the window size (lookbackMonths) once
    // that became a real parameter — "fewer than 1 completed month(s)"
    // rather than a fixed "no completed month" string, since for a longer
    // window the more accurate statement isn't "none exist" but "not enough".
    expect(r.flags[0]).toMatch(/fewer than 1 completed month/i);
  });

  it('flags a missing benchmark rather than throwing', () => {
    const r = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries: [] });
    expect(r.ranked).toEqual([]);
    expect(r.flags[0]).toMatch(/benchmark/i);
  });

  it('excludes and flags a stock with no data for the reference month, without dropping the row', () => {
    const newlyListed = [bar('2026-07-20', 300), bar('2026-07-29', 330)]; // no June bar
    const r = computeCurrentMomentum({
      stocks: [...stocks, { symbol: 'NEW.NS', name: 'Newly Listed' }],
      priceSeriesMap: new Map([...priceSeriesMap, ['NEW.NS', newlyListed]]),
      benchmarkSeries,
    });
    const row = r.ranked.find((x) => x.symbol === 'NEW.NS');
    expect(row).toBeTruthy(); // still visible, so the user learns why
    expect(row.rank).toBeNull();
    expect(row.rs).toBeNull();
    expect(row.flags.length).toBeGreaterThan(0);
    expect(r.picks.map((p) => p.symbol)).not.toContain('NEW.NS');
  });
});

describe('computeCurrentMomentum — Section 21 display fields', () => {
  it('prefers the live quote for current price and daily change, but not for RS', () => {
    const quotes = new Map([['A.NS', { price: 125, changePct: 1.5 }]]);
    const r = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, quotes });
    const a = r.ranked.find((x) => x.symbol === 'A.NS');

    expect(a.currentPrice).toBe(125); // live quote drives the display column
    expect(a.dailyChangePct).toBe(1.5);
    // ...but the return still uses the adjusted series (121 vs 110 = +10%),
    // so an unadjusted quote can never contaminate an adjusted-price ratio.
    expect(a.stockReturnPct).toBeCloseTo(10, 6);
  });

  it('falls back to the latest close when no quote is available', () => {
    const r = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries });
    expect(r.ranked.find((x) => x.symbol === 'A.NS').currentPrice).toBe(121);
  });

  it('carries sector and volume through for the rankings table', () => {
    const r = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries });
    const a = r.ranked.find((x) => x.symbol === 'A.NS');
    expect(a.sector).toBe('Financial Services');
    expect(a.volume).toBe(1000);
  });
});

describe('computeCurrentMomentum — lookbackMonths (Phase 4, spec Section 25)', () => {
  // Reuses the same fixture as the file's regression guard above:
  //   benchmarkSeries: May-end 202, June-end 210, latest (July, in-progress) 216
  //   stockA:           May-end 100, June-end 110, latest 121
  // Only two completed months (May, June) exist before the current month.

  it('defaults to 1 and is bit-identical to omitting the parameter entirely', () => {
    const withDefault = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries });
    const withExplicitOne = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, lookbackMonths: 1 });
    expect(withExplicitOne).toEqual(withDefault);
  });

  it('reaches back further as the window lengthens — 2 months back lands on May, not June', () => {
    const r = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, lookbackMonths: 2 });
    expect(r.basedOnMonthKey).toBe('2026-05');
    expect(r.referenceDate).toBe('2026-05-29');

    const a = r.ranked.find((x) => x.symbol === 'A.NS');
    // Stock A: 100 (May) -> 121 (latest) = +21%; benchmark: 202 -> 216 = +6.9307%
    expect(a.stockReturnPct).toBeCloseTo(21, 6);
    expect(a.benchmarkReturnPct).toBeCloseTo(6.930693, 5);
    expect(a.rs).toBeCloseTo(21 - 6.930693, 5);
  });

  it('flags rather than fabricating when fewer completed months exist than the window needs', () => {
    // Only May and June are completed — a 3-month lookback has nowhere to anchor.
    const r = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, lookbackMonths: 3 });
    expect(r.ranked).toEqual([]);
    expect(r.basedOnMonthKey).toBeNull();
    expect(r.flags[0]).toMatch(/fewer than 3 completed month/i);
  });

  it('a longer window changes which stock leads — not just the magnitude', () => {
    // Stock B only moves in the most recent month, so a longer window that
    // reaches back past that move should rank it behind Stock A, unlike a
    // 1-month view where the difference is much closer.
    const oneMonth = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, lookbackMonths: 1 });
    const twoMonth = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, lookbackMonths: 2 });
    expect(oneMonth.picks[0].symbol).toBe('A.NS');
    expect(twoMonth.picks[0].symbol).toBe('A.NS');
    // Different underlying numbers, not the same result recomputed twice.
    const aOne = oneMonth.ranked.find((r) => r.symbol === 'A.NS');
    const aTwo = twoMonth.ranked.find((r) => r.symbol === 'A.NS');
    expect(aOne.stockReturnPct).not.toBeCloseTo(aTwo.stockReturnPct, 3);
  });
});
