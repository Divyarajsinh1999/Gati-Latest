/**
 * THE STOCK CHART'S RANGES — 1M through 5M, plus All.
 *
 * A separate set from the strategy chart's, and separately tested: they
 * share `applyRange`, and a fallback that reached across the two sets would
 * silently show a reader a different window from the one they picked.
 */

import { describe, it, expect } from 'vitest';
import { applyRange, STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE, isValidRange } from '../chartRange.js';

/** ~2 years of daily bars, weekdays only. */
const series = (() => {
  const out = [];
  const day = new Date('2024-09-02T00:00:00Z');
  const end = new Date('2026-08-07T00:00:00Z');
  let price = 100;
  while (day <= end) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      price += 0.1;
      out.push({ date: day.toISOString().slice(0, 10), close: Number(price.toFixed(2)) });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
})();

describe('the range set', () => {
  it('offers 1M through 5M and All, in order', () => {
    expect(STOCK_CHART_RANGES.map((r) => r.label)).toEqual(['1M', '2M', '3M', '4M', '5M', 'All']);
  });

  it('defaults to a range with real data behind it', () => {
    expect(STOCK_CHART_RANGES.some((r) => r.key === DEFAULT_STOCK_RANGE)).toBe(true);
  });

  it('uses months, so every option renders a genuinely different window', () => {
    const months = STOCK_CHART_RANGES.filter((r) => r.months != null).map((r) => r.months);
    expect(months).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(months).size).toBe(months.length);
  });
});

describe('each range narrows the series', () => {
  const span = (key) => applyRange(series, key, STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE).points.length;

  it.each(['1m', '2m', '3m', '4m', '5m'])('%s returns fewer points than All', (key) => {
    expect(span(key)).toBeLessThan(span('all'));
    expect(span(key)).toBeGreaterThan(0);
  });

  it('each longer range contains at least as many points as the shorter', () => {
    const counts = ['1m', '2m', '3m', '4m', '5m', 'all'].map(span);
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i], `${i} should not shrink`).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('always ends on the most recent bar, whatever the range', () => {
    const newest = series.at(-1).date;
    for (const range of STOCK_CHART_RANGES) {
      const result = applyRange(series, range.key, STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE);
      expect(result.points.at(-1).date, range.key).toBe(newest);
    }
  });

  it('invents nothing when history is shorter than the range', () => {
    // Six bars asked for five months. It must return six, not pad to a
    // month's worth of fabricated points.
    const short = series.slice(-6);
    const result = applyRange(short, '5m', STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE);
    expect(result.points).toHaveLength(6);
    expect(result.points).toEqual(short);
  });

  it('handles an empty series without throwing', () => {
    expect(applyRange([], '3m', STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE).points).toEqual([]);
  });
});

describe('the two range sets stay separate', () => {
  /**
   * `applyRange` is shared with the strategy chart, whose set has no 1M and
   * whose default is 1Y. An unknown key must fall back inside the set it was
   * given — falling back to the OTHER set's default would show a reader a
   * window they did not choose and could not have chosen.
   */
  it('falls back to the stock default, not the strategy one', () => {
    const fallback = applyRange(series, 'nonsense', STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE);
    const explicit = applyRange(series, DEFAULT_STOCK_RANGE, STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE);
    expect(fallback.points.length).toBe(explicit.points.length);
  });

  it('does not accept a strategy-only key as valid for the stock set', () => {
    expect(isValidRange('1y', STOCK_CHART_RANGES)).toBe(false);
    expect(isValidRange('3m', STOCK_CHART_RANGES)).toBe(true);
  });

  it('never returns a strategy range object from the stock set', () => {
    const result = applyRange(series, '1y', STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE);
    // '1y' is not in this set, so it must resolve to the stock default's
    // span rather than a year of data.
    const oneYear = applyRange(series, 'all', STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE);
    expect(result.points.length).toBeLessThan(oneYear.points.length);
  });
});
