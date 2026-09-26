/**
 * SHARED YAHOO HELPER TESTS.
 *
 * The build environment has no network route to Yahoo, so the fetching path
 * cannot be exercised here. These tests cover the parts that CAN be, and that
 * is deliberately where the risk concentrates:
 *
 *   - validation, because without it the proxy fetches arbitrary strings on a
 *     caller's behalf, which is an open relay
 *   - chunking, because an off-by-one at a boundary silently drops symbols
 *     and the result looks like a data-quality problem, not a bug
 *   - normalisation, because a null close becoming a zero price produces an
 *     infinite return or a division by zero downstream
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSymbol,
  isValidDate,
  parseSymbolsParam,
  chunk,
  normalizeChartResult,
  toUnixSeconds,
  MAX_SYMBOLS_PER_REQUEST,
} from '../_shared/yahoo.mjs';

describe('symbol validation', () => {
  it('accepts real NSE tickers, including the awkward ones', () => {
    for (const s of ['RELIANCE.NS', 'TCS.NS', 'M&M.NS', 'BAJAJ-AUTO.NS', 'NIFTYBEES.NS', '360ONE.NS']) {
      expect(isValidSymbol(s)).toBe(true);
    }
  });

  it('rejects anything that could escape into an upstream URL', () => {
    const attacks = [
      '../../etc/passwd',
      'A.NS?crumb=x',
      'A.NS&symbols=B',
      'http://evil.test',
      'A NS',
      'A/B',
      '<script>',
      '',
      'x'.repeat(21),
      null,
      undefined,
      123,
    ];
    for (const s of attacks) expect(isValidSymbol(s)).toBe(false);
  });
});

describe('date validation', () => {
  it('accepts real ISO dates', () => {
    expect(isValidDate('2025-01-01')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed and impossible dates', () => {
    for (const d of ['2025-1-1', '01-01-2025', '2025-13-01', '2025-02-30', 'today', '', null]) {
      expect(isValidDate(d)).toBe(false);
    }
  });
});

describe('parseSymbolsParam', () => {
  it('trims, drops blanks and de-duplicates', () => {
    const r = parseSymbolsParam(' A.NS , B.NS ,, A.NS ');
    expect(r.ok).toBe(true);
    expect(r.symbols).toEqual(['A.NS', 'B.NS']);
  });

  it('rejects a missing or empty param', () => {
    expect(parseSymbolsParam(null).ok).toBe(false);
    expect(parseSymbolsParam(' , , ').ok).toBe(false);
  });

  it('enforces the batch cap', () => {
    const tooMany = Array.from({ length: MAX_SYMBOLS_PER_REQUEST + 1 }, (_, i) => `S${i}.NS`);
    const r = parseSymbolsParam(tooMany.join(','));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too many symbols/);
  });

  it('accepts exactly the cap', () => {
    const atCap = Array.from({ length: MAX_SYMBOLS_PER_REQUEST }, (_, i) => `S${i}.NS`);
    expect(parseSymbolsParam(atCap.join(',')).ok).toBe(true);
  });

  it('rejects the whole request if any symbol is malformed', () => {
    const r = parseSymbolsParam('A.NS,../../secret,B.NS');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid symbol format/);
  });
});

describe('chunk', () => {
  it('never drops or duplicates an item', () => {
    for (const n of [0, 1, 39, 40, 41, 250, 453]) {
      const items = Array.from({ length: n }, (_, i) => i);
      const flat = chunk(items, 40).flat();
      expect(flat).toEqual(items);
    }
  });

  it('respects the chunk size at every boundary', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i), 40).map((c) => c.length))
      .toEqual([40, 40, 40, 40, 40, 40, 10]);
  });

  it('refuses a nonsensical size rather than looping forever', () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow();
  });
});

describe('normalizeChartResult', () => {
  const payload = {
    timestamp: [1735689600, 1735776000, 1735862400], // 1, 2, 3 Jan 2025 UTC
    indicators: {
      quote: [{ open: [100, null, 102], high: [101, null, 103], low: [99, null, 101], close: [100.5, null, 102.5], volume: [1000, null, 1200] }],
      adjclose: [{ adjclose: [100.5, null, 101.9] }],
    },
  };

  it('drops rows whose close is null rather than zero-filling them', () => {
    const rows = normalizeChartResult(payload);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.date)).toEqual(['2025-01-01', '2025-01-03']);
    // A zero price would become a division by zero or an infinite return.
    expect(rows.some((r) => r.close === 0)).toBe(false);
  });

  it('preserves the gap rather than interpolating across it', () => {
    const rows = normalizeChartResult(payload);
    expect(rows[1].date).toBe('2025-01-03'); // the 2nd is simply absent
  });

  it('falls back to raw close when adjusted close is missing', () => {
    const noAdj = { timestamp: [1735689600], indicators: { quote: [{ close: [100.5], open: [100], high: [101], low: [99], volume: [10] }] } };
    expect(normalizeChartResult(noAdj)[0].adjClose).toBe(100.5);
  });

  it('returns an empty array for a malformed payload instead of throwing', () => {
    for (const bad of [null, undefined, {}, { timestamp: [] }]) {
      expect(normalizeChartResult(bad)).toEqual([]);
    }
  });
});

describe('toUnixSeconds', () => {
  it('converts an ISO date to a UTC epoch second', () => {
    expect(toUnixSeconds('2025-01-01')).toBe(1735689600);
  });
});
