/**
 * CHART RANGE TESTS — decision D2.
 *
 * The rule is that the app never fabricates, extrapolates, compresses or
 * stretches history to fill a requested range. These assert the two halves of
 * that: the data is never padded, and the shortfall is always stated.
 *
 * The second half matters more than it looks. With data from 2025-01-01, the
 * 3Y, 5Y and All ranges render an identical chart — so without the notice, a
 * reader selecting 5Y would see nothing change and conclude the control is
 * broken.
 */

import { describe, it, expect } from 'vitest';
import { applyRange, monthsCovered, isValidRange, CHART_RANGES, DEFAULT_RANGE } from '../chartRange.js';

/** A monthly series ending on the given date. */
function series(months, end = '2026-07-31') {
  const out = [];
  const d = new Date(`${end}T00:00:00Z`);
  for (let i = months; i >= 0; i--) {
    const point = new Date(d);
    point.setUTCMonth(point.getUTCMonth() - i);
    out.push({ date: point.toISOString().slice(0, 10), value: 100 + (months - i) });
  }
  return out;
}

describe('range registry', () => {
  it('keeps 3Y and 5Y SELECTABLE, per D2', () => {
    // Disabling would imply the range is unavailable, when the range is
    // perfectly valid and the data is what falls short.
    expect(CHART_RANGES.map((r) => r.key)).toEqual(['3m', '6m', '1y', '3y', '5y', 'all']);
    expect(isValidRange('3y')).toBe(true);
    expect(isValidRange('5y')).toBe(true);
  });

  it('rejects an unknown range', () => {
    expect(isValidRange('7y')).toBe(false);
    expect(isValidRange(null)).toBe(false);
  });
});

describe('monthsCovered', () => {
  it('measures the span of the series itself', () => {
    expect(monthsCovered(series(19))).toBe(19);
  });

  it('returns zero for a series too short to span anything', () => {
    expect(monthsCovered([])).toBe(0);
    expect(monthsCovered([{ date: '2026-01-01' }])).toBe(0);
  });
});

describe('applyRange — sufficient history', () => {
  const long = series(60);

  it('narrows to the requested window', () => {
    const r = applyRange(long, '1y');
    expect(r.points.length).toBeLessThan(long.length);
    expect(r.isTruncated).toBe(true);
    expect(r.isShort).toBe(false);
    expect(r.notice).toBeNull();
  });

  it('a shorter range yields fewer points than a longer one', () => {
    expect(applyRange(long, '3m').points.length).toBeLessThan(applyRange(long, '1y').points.length);
    expect(applyRange(long, '1y').points.length).toBeLessThan(applyRange(long, '3y').points.length);
  });

  it('"All" returns everything and can never fall short', () => {
    const r = applyRange(long, 'all');
    expect(r.points).toEqual(long);
    expect(r.isShort).toBe(false);
    expect(r.notice).toBeNull();
  });

  it('always ends on the most recent point', () => {
    for (const key of ['3m', '6m', '1y']) {
      expect(applyRange(long, key).points.at(-1)).toEqual(long.at(-1));
    }
  });
});

describe('applyRange — D2: insufficient history', () => {
  // 19 months, mirroring the real dataset from 2025-01-01.
  const short = series(19);

  it('shows ALL available history rather than padding to the range', () => {
    const r = applyRange(short, '5y');
    expect(r.points).toEqual(short);
    expect(r.isShort).toBe(true);
  });

  it('never invents, extrapolates or repeats a point', () => {
    for (const key of ['3y', '5y']) {
      const r = applyRange(short, key);
      expect(r.points.length).toBe(short.length);
      expect(new Set(r.points.map((p) => p.date)).size).toBe(short.length);
    }
  });

  it('STATES the shortfall, because otherwise the control looks broken', () => {
    // 3Y, 5Y and All render an identical chart on this data. The notice is the
    // only thing distinguishing "same as All" from "this button does nothing".
    const r = applyRange(short, '5y');
    expect(r.notice).toContain('19 months');
    expect(r.notice).toContain('5Y would need data from');
    expect(r.notice).toMatch(/nothing here is stretched or estimated/);
  });

  it('names the date from which the missing data would be needed', () => {
    const r = applyRange(short, '3y');
    expect(r.neededFrom).toBe('2023-07-31');
  });

  it('reports isShort rather than isTruncated — nothing was dropped', () => {
    const r = applyRange(short, '3y');
    expect(r.isShort).toBe(true);
    expect(r.isTruncated).toBe(false);
  });

  it('3Y, 5Y and All produce the same points on short data, as they must', () => {
    const a = applyRange(short, '3y').points;
    const b = applyRange(short, '5y').points;
    const c = applyRange(short, 'all').points;
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    // ...but only the first two say why.
    expect(applyRange(short, '3y').notice).toBeTruthy();
    expect(applyRange(short, 'all').notice).toBeNull();
  });
});

describe('applyRange — edge cases', () => {
  it('handles an empty series without throwing', () => {
    const r = applyRange([], '1y');
    expect(r.points).toEqual([]);
    expect(r.notice).toBeNull();
  });

  it('falls back to the default for an unknown range', () => {
    const long = series(60);
    expect(applyRange(long, 'nonsense').rangeKey).toBe(DEFAULT_RANGE);
  });

  it('handles a single-point series', () => {
    const r = applyRange([{ date: '2026-07-31', value: 100 }], '1y');
    expect(r.points).toHaveLength(1);
    expect(r.availableMonths).toBe(0);
  });
});
