/**
 * PORTFOLIO HISTORY — the reader's own money, over time.
 *
 * The rule these mostly exist to protect: the series must never extend
 * before the first purchase. Computing what a holding "would have been
 * worth" in January for someone who bought in May is trivially easy — the
 * prices are in the same array — and draws a gain nobody made.
 */

import { describe, it, expect } from 'vitest';
import { buildPortfolioHistory } from '../portfolioHistory.js';

const bars = (entries) => entries.map(([date, close]) => ({ date, close }));

const CAL = bars([
  ['2026-05-01', 0], ['2026-05-02', 0], ['2026-05-03', 0],
  ['2026-05-04', 0], ['2026-05-05', 0], ['2026-05-06', 0],
]);

const SERIES = new Map([
  ['A.NS', bars([
    ['2026-05-01', 100], ['2026-05-02', 110], ['2026-05-03', 120],
    ['2026-05-04', 130], ['2026-05-05', 140], ['2026-05-06', 150],
  ])],
  ['B.NS', bars([
    ['2026-05-01', 200], ['2026-05-02', 200], ['2026-05-03', 200],
    ['2026-05-04', 200], ['2026-05-05', 200], ['2026-05-06', 200],
  ])],
]);

const lot = (over = {}) => ({ symbol: 'A.NS', quantity: 10, purchasePrice: 120, purchaseDate: '2026-05-03', ...over });

describe('the series never predates the purchase', () => {
  it('starts on the purchase date, not on the first available bar', () => {
    const history = buildPortfolioHistory({ positions: [lot()], priceSeriesMap: SERIES, calendarSeries: CAL });
    expect(history.startDate).toBe('2026-05-03');
    expect(history.points[0].date).toBe('2026-05-03');
    // Prices for 01 and 02 exist and are deliberately unused.
    expect(history.points.map((p) => p.date)).not.toContain('2026-05-01');
    expect(history.points.map((p) => p.date)).not.toContain('2026-05-02');
  });

  it('shows no gain on day one, because none has been made', () => {
    const history = buildPortfolioHistory({ positions: [lot()], priceSeriesMap: SERIES, calendarSeries: CAL });
    // Bought 10 @ 120 on a day that closed at 120.
    expect(history.points[0].invested).toBe(1200);
    expect(history.points[0].value).toBe(1200);
    expect(history.points[0].gain).toBe(0);
  });

  it('tracks value forward from there', () => {
    const history = buildPortfolioHistory({ positions: [lot()], priceSeriesMap: SERIES, calendarSeries: CAL });
    const last = history.points.at(-1);
    expect(last.date).toBe('2026-05-06');
    expect(last.value).toBe(1500); // 10 x 150
    expect(last.invested).toBe(1200);
    expect(last.gain).toBe(300);
  });
});

describe('a second purchase', () => {
  const lots = [
    lot({ quantity: 10, purchasePrice: 120, purchaseDate: '2026-05-03' }),
    lot({ quantity: 5, purchasePrice: 140, purchaseDate: '2026-05-05' }),
  ];

  it('raises BOTH lines on its own date', () => {
    // Adding shares without their cost would draw a jump in profit that was
    // actually a purchase.
    const history = buildPortfolioHistory({ positions: lots, priceSeriesMap: SERIES, calendarSeries: CAL });
    const before = history.points.find((p) => p.date === '2026-05-04');
    const on = history.points.find((p) => p.date === '2026-05-05');

    expect(before.invested).toBe(1200);
    expect(on.invested).toBe(1200 + 700);
    expect(before.value).toBe(1300); // 10 x 130
    expect(on.value).toBe(15 * 140); // 15 x 140
  });

  it('contributes no gain of its own on the day it is bought', () => {
    /**
     * Bought at that day's close, so the NEW shares are worth exactly what
     * they cost. Any change in total gain that day must come entirely from
     * the shares already held moving 130 -> 140.
     *
     * Asserting `gain` was simply unchanged would be wrong, and was: the
     * existing 10 shares appreciated ₹100 the same day, so the total moved
     * from 100 to 200 for a reason that has nothing to do with the purchase.
     */
    const history = buildPortfolioHistory({ positions: lots, priceSeriesMap: SERIES, calendarSeries: CAL });
    const before = history.points.find((p) => p.date === '2026-05-04');
    const on = history.points.find((p) => p.date === '2026-05-05');

    const appreciationOfExisting = 10 * (140 - 130);
    expect(on.gain - before.gain).toBe(appreciationOfExisting);
    // And the new lot's own contribution is zero: cost and value both 700.
    expect(on.value - before.value).toBe(appreciationOfExisting + 700);
    expect(on.invested - before.invested).toBe(700);
  });

  it('still starts at the EARLIEST purchase', () => {
    const reversed = [lots[1], lots[0]];
    expect(buildPortfolioHistory({ positions: reversed, priceSeriesMap: SERIES, calendarSeries: CAL }).startDate).toBe('2026-05-03');
  });
});

describe('missing prices', () => {
  it('carries the last actual close forward rather than interpolating', () => {
    const gappy = new Map([['A.NS', bars([['2026-05-03', 120], ['2026-05-06', 150]])]]);
    const history = buildPortfolioHistory({ positions: [lot()], priceSeriesMap: gappy, calendarSeries: CAL });
    const middle = history.points.find((p) => p.date === '2026-05-04');
    // Held at 120, the last price that actually printed — not 130, which
    // would be a price that never existed.
    expect(middle.value).toBe(1200);
  });

  it('omits a day where something owned cannot be priced at all', () => {
    // Plotting a partial total draws a cliff on the value line that looks
    // like a crash and is actually a missing bar.
    const partial = new Map([
      ['A.NS', bars([['2026-05-03', 120], ['2026-05-04', 130], ['2026-05-05', 140], ['2026-05-06', 150]])],
      ['B.NS', bars([['2026-05-05', 200], ['2026-05-06', 200]])],
    ]);
    const history = buildPortfolioHistory({
      positions: [lot(), lot({ symbol: 'B.NS', quantity: 1, purchasePrice: 200, purchaseDate: '2026-05-03' })],
      priceSeriesMap: partial,
      calendarSeries: CAL,
    });
    expect(history.points.map((p) => p.date)).not.toContain('2026-05-03');
    expect(history.points.map((p) => p.date)).not.toContain('2026-05-04');
    expect(history.points[0].date).toBe('2026-05-05');
  });

  it('names a holding it has no prices for at all', () => {
    const history = buildPortfolioHistory({
      positions: [lot({ symbol: 'GONE.NS' })],
      priceSeriesMap: SERIES,
      calendarSeries: CAL,
    });
    expect(history.unpriceable).toEqual(['GONE.NS']);
    expect(history.hasHistory).toBe(false);
  });
});

describe('degenerate input', () => {
  it.each([
    ['no positions', []],
    ['zero quantity', [lot({ quantity: 0 })]],
    ['no purchase date', [lot({ purchaseDate: undefined })]],
    ['non-numeric price', [lot({ purchasePrice: 'x' })]],
  ])('returns an empty history for %s rather than throwing', (_label, positions) => {
    const history = buildPortfolioHistory({ positions, priceSeriesMap: SERIES, calendarSeries: CAL });
    expect(history.points).toEqual([]);
    expect(history.hasHistory).toBe(false);
  });

  it('refuses to call two points a history', () => {
    const short = bars([['2026-05-05', 140], ['2026-05-06', 150]]);
    const history = buildPortfolioHistory({
      positions: [lot({ purchaseDate: '2026-05-05' })],
      priceSeriesMap: new Map([['A.NS', short]]),
      calendarSeries: CAL,
    });
    expect(history.points).toHaveLength(2);
    expect(history.hasHistory).toBe(false);
  });
});
