import { describe, it, expect } from 'vitest';
import { UNIVERSES, UNIVERSE_KEYS, getUniverse } from '../../config/universes.js';

/**
 * Integrity guards on the constituent config.
 *
 * The lists are machine-generated (scripts/import-constituents.mjs) and get
 * regenerated after every NSE semi-annual reconstitution, so these assert
 * the properties that must survive any regeneration. A stale, truncated or
 * mis-derived import will trip one of these rather than quietly producing a
 * plausible-looking but wrong universe — which is exactly the failure mode
 * spec Section 40 warns about (benchmark mismatches, silent substitution).
 */

const TICKER = /^[A-Z0-9&-]+\.NS$/;

describe('universe config — structural integrity', () => {
  /**
   * DashboardHero in pages/Dashboard.jsx calls useUniverseData exactly
   * three times at fixed positions, because React hooks cannot be called
   * in a loop. A fourth universe would therefore be silently missing from
   * its "beating their benchmark" count — a wrong number presented with
   * full confidence, which is the worst failure this project can produce.
   * This fails the build instead, pointing at the code that needs updating.
   */
  it('has exactly three universes — DashboardHero hardcodes three hook calls', () => {
    expect(UNIVERSE_KEYS).toHaveLength(3);
  });

  it.each(UNIVERSE_KEYS)('%s holds exactly its expected number of constituents', (key) => {
    const u = getUniverse(key);
    if (u.meta.constituentStatus === 'complete') {
      expect(u.stocks.length).toBe(u.meta.expectedCount);
    } else {
      // A partial list must not claim more than it has.
      expect(u.stocks.length).toBeLessThanOrEqual(u.meta.expectedCount);
      expect(u.stocks.length).toBe(u.meta.verifiedCount);
    }
  });

  it.each(UNIVERSE_KEYS)('%s contains no duplicate symbols', (key) => {
    const symbols = getUniverse(key).stocks.map((s) => s.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it.each(UNIVERSE_KEYS)('%s uses well-formed NSE tickers', (key) => {
    const bad = getUniverse(key).stocks.filter((s) => !TICKER.test(s.symbol));
    expect(bad.map((s) => s.symbol)).toEqual([]);
  });

  it.each(UNIVERSE_KEYS)('%s gives every stock a name and a sector', (key) => {
    const incomplete = getUniverse(key).stocks.filter((s) => !s.name?.trim() || !s.sector?.trim());
    expect(incomplete.map((s) => s.symbol)).toEqual([]);
  });

  it('keeps the three universes mutually exclusive (spec Section 3)', () => {
    // "Stocks from different universes must never be mixed." A stock in two
    // universes would be ranked against two different benchmarks at once.
    const sets = Object.fromEntries(UNIVERSE_KEYS.map((k) => [k, new Set(getUniverse(k).stocks.map((s) => s.symbol))]));
    const pairs = [['nifty50', 'midcap150'], ['nifty50', 'smallcap250'], ['midcap150', 'smallcap250']];
    for (const [a, b] of pairs) {
      const overlap = [...sets[a]].filter((s) => sets[b].has(s));
      expect({ pair: `${a}|${b}`, overlap }).toEqual({ pair: `${a}|${b}`, overlap: [] });
    }
  });

  it('gives each universe its own distinct benchmark (spec Section 17)', () => {
    const benchmarks = UNIVERSE_KEYS.map((k) => getUniverse(k).benchmark.symbol);
    expect(new Set(benchmarks).size).toBe(benchmarks.length);
    // A benchmark must never also be a constituent of the universe it measures.
    for (const key of UNIVERSE_KEYS) {
      const u = getUniverse(key);
      expect(u.stocks.some((s) => s.symbol === u.benchmark.symbol)).toBe(false);
    }
  });

  it('declares provenance for any list not taken from the official CSV', () => {
    for (const key of UNIVERSE_KEYS) {
      const { meta } = getUniverse(key);
      if (meta.provenance && meta.provenance !== 'official') {
        // Non-official data must carry its sources so the UI can disclose them.
        expect(Array.isArray(meta.sources)).toBe(true);
        expect(meta.sources.length).toBeGreaterThan(0);
        expect(meta.asOf).toBeTruthy();
      }
    }
  });

  it('exposes the expected three universes and no orphan keys', () => {
    expect(UNIVERSE_KEYS).toEqual(['nifty50', 'midcap150', 'smallcap250']);
    expect(Object.keys(UNIVERSES).sort()).toEqual([...UNIVERSE_KEYS].sort());
  });

  it('throws a clear error for an unknown universe key rather than returning undefined', () => {
    expect(() => getUniverse('nonexistent')).toThrow(/unknown universe/i);
  });
});

describe('universe config — spot checks against independently verified names', () => {
  // These specific placements were confirmed from official niftyindices.com
  // factsheet PDFs during this project, independently of the generated
  // lists. They are pinned here so a future regeneration that moves them
  // has to be a deliberate decision rather than an unnoticed drift.
  const expectations = [
    ['RELIANCE.NS', 'nifty50'],
    ['HDFCBANK.NS', 'nifty50'],
    ['MCX.NS', 'midcap150'],
    ['LAURUSLABS.NS', 'midcap150'],
    ['FEDERALBNK.NS', 'midcap150'],
    ['SUZLON.NS', 'midcap150'],
    ['DELHIVERY.NS', 'smallcap250'],
    ['HFCL.NS', 'smallcap250'],
    ['CDSL.NS', 'smallcap250'],
  ];

  it.each(expectations)('%s belongs to %s', (symbol, expectedKey) => {
    const found = UNIVERSE_KEYS.filter((k) => getUniverse(k).stocks.some((s) => s.symbol === symbol));
    expect(found).toEqual([expectedKey]);
  });
});
