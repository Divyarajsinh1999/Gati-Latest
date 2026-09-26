/**
 * CACHE KEY TESTS.
 *
 * A cache key that drifts between runs produces a cache that never hits — a
 * failure that looks exactly like a slow network and is therefore almost
 * impossible to notice. Stability is the property under test.
 */

import { describe, it, expect } from 'vitest';
import { hashString, quoteCacheKey } from '../cache/cacheKeys.js';

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('RELIANCE.NS,TCS.NS')).toBe(hashString('RELIANCE.NS,TCS.NS'));
  });

  it('always returns 8 hex characters', () => {
    for (const input of ['', 'a', 'RELIANCE.NS', 'x'.repeat(10_000)]) {
      expect(hashString(input)).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('differs for inputs that differ by one character', () => {
    expect(hashString('SYM001.NS')).not.toBe(hashString('SYM002.NS'));
  });

  it('does not collide across a realistic universe of inputs', () => {
    const seen = new Set();
    for (let i = 0; i < 5000; i++) seen.add(hashString(`SYM${i}.NS,BENCH.NS,${i}`));
    // 32 bits over 5000 inputs: a handful of birthday collisions would be
    // unremarkable, but the count must stay near-perfect for this use.
    expect(seen.size).toBeGreaterThan(4990);
  });
});

describe('quoteCacheKey', () => {
  it('bounds the key length regardless of universe size', () => {
    const many = Array.from({ length: 453 }, (_, i) => `SYMBOL${i}.NS`);
    const key = quoteCacheKey('yahoo', many);

    // The defect: the previous key was the joined symbol list, ~4 kB for one
    // universe, rebuilt and compared on every lookup.
    expect(many.join(',').length).toBeGreaterThan(4000);
    expect(key.length).toBeLessThan(40);
  });

  it('treats a reordered symbol list as the same request', () => {
    const a = quoteCacheKey('yahoo', ['B.NS', 'A.NS', 'C.NS']);
    const b = quoteCacheKey('yahoo', ['C.NS', 'B.NS', 'A.NS']);
    expect(a).toBe(b);
  });

  it('distinguishes providers and different symbol sets', () => {
    expect(quoteCacheKey('yahoo', ['A.NS'])).not.toBe(quoteCacheKey('mock', ['A.NS']));
    expect(quoteCacheKey('yahoo', ['A.NS'])).not.toBe(quoteCacheKey('yahoo', ['B.NS']));
  });

  it('keeps the symbol count legible in the key', () => {
    // Costs nothing and makes a stored entry self-describing when debugging.
    expect(quoteCacheKey('yahoo', ['A.NS', 'B.NS'])).toMatch(/^quote:yahoo:2:[0-9a-f]{8}$/);
  });
});
