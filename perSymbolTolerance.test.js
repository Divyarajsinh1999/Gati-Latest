// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeCurrentMomentum } from '../currentMomentum.js';
import { DATA_QUALITY_FLAGS } from '../../config/constants.js';

/**
 * Per-symbol failure tolerance (v0.14.5).
 *
 * Before this, ONE failing symbol rejected the whole universe fetch via
 * Promise.all, so a single renamed ticker (e.g. TATAMOTORS.NS, retired by
 * the 2025 demerger) blanked an entire dashboard. The user's requirement:
 * a dead ticker should mark itself as unavailable, and nothing else.
 *
 * The asymmetry that must hold:
 *   - one stock fails       -> that row is flagged, everything else works
 *   - the BENCHMARK fails   -> universe-wide error (RS is undefined without it)
 *   - EVERY stock fails     -> universe-wide error (that's an outage, not a rename)
 */

function bar(date, close) {
  return { date, open: close, high: close, low: close, close, adjClose: close, volume: 1000 };
}

/** Two months of bars so there's a prior month-end to rank against. */
function series(janClose, febClose) {
  return [bar('2025-01-30', janClose), bar('2025-01-31', janClose), bar('2025-02-27', febClose), bar('2025-02-28', febClose)];
}

const STOCKS = [
  { symbol: 'GOOD1.NS', name: 'Good One', sector: 'IT' },
  { symbol: 'DEAD.NS', name: 'Dead Ticker', sector: 'Auto' },
  { symbol: 'GOOD2.NS', name: 'Good Two', sector: 'Banks' },
];

describe('computeCurrentMomentum — one unavailable symbol', () => {
  const benchmarkSeries = series(100, 110); // +10% benchmark

  function build({ unavailableSymbols = [] } = {}) {
    // DEAD.NS is absent from the map entirely, exactly as dataService now
    // leaves it when its fetch fails.
    const priceSeriesMap = new Map([
      ['GOOD1.NS', series(100, 130)], // +30% -> RS +20
      ['GOOD2.NS', series(100, 105)], // +5%  -> RS -5
    ]);
    return computeCurrentMomentum({ stocks: STOCKS, priceSeriesMap, benchmarkSeries, topN: 5, unavailableSymbols });
  }

  it('still ranks the healthy stocks instead of failing the universe', () => {
    const result = build();
    const ranked = result.ranked.filter((r) => r.rank != null);
    expect(ranked.map((r) => r.symbol)).toEqual(['GOOD1.NS', 'GOOD2.NS']);
    expect(ranked[0].rs).toBeCloseTo(20, 6);
    expect(ranked[1].rs).toBeCloseTo(-5, 6);
  });

  it('keeps the dead ticker visible as a row rather than dropping it', () => {
    const result = build();
    // Silently removing it would be its own kind of lie — the stock IS in
    // the universe, we just can't price it.
    const dead = result.ranked.find((r) => r.symbol === 'DEAD.NS');
    expect(dead).toBeDefined();
    expect(dead.rank).toBeNull();
    expect(dead.rs).toBeNull();
  });

  it('flags a failed FETCH differently from merely-insufficient history', () => {
    const withReason = build({
      unavailableSymbols: [{ symbol: 'DEAD.NS', name: 'Dead Ticker', reason: 'Yahoo Finance returned 404 for DEAD.NS' }],
    });
    const dead = withReason.ranked.find((r) => r.symbol === 'DEAD.NS');
    expect(dead.isUnavailable).toBe(true);
    expect(dead.flags).toContain(DATA_QUALITY_FLAGS.SYMBOL_UNAVAILABLE);
    expect(dead.flags).not.toContain(DATA_QUALITY_FLAGS.MISSING_DATA);
    expect(dead.unavailableReason).toMatch(/404/);
  });

  it('carries a known rename suggestion through to the row, when one exists', () => {
    const withSuggestion = build({
      unavailableSymbols: [
        {
          symbol: 'DEAD.NS',
          name: 'Dead Ticker',
          reason: 'Yahoo Finance returned 404 for DEAD.NS',
          suggestion: { suggestedReplacement: null, note: 'Confirmed dead, no fix needed.' },
        },
      ],
    });
    const dead = withSuggestion.ranked.find((r) => r.symbol === 'DEAD.NS');
    expect(dead.unavailableSuggestion).toEqual({ suggestedReplacement: null, note: 'Confirmed dead, no fix needed.' });
  });

  it('leaves unavailableSuggestion null when no suggestion was supplied', () => {
    const withReason = build({
      unavailableSymbols: [{ symbol: 'DEAD.NS', name: 'Dead Ticker', reason: '404' }],
    });
    const dead = withReason.ranked.find((r) => r.symbol === 'DEAD.NS');
    expect(dead.unavailableSuggestion).toBeNull();
  });

  it('uses MISSING_DATA when the symbol simply has no usable bars (not a fetch failure)', () => {
    const result = build(); // no unavailableSymbols passed
    const dead = result.ranked.find((r) => r.symbol === 'DEAD.NS');
    expect(dead.isUnavailable).toBe(false);
    expect(dead.flags).toContain(DATA_QUALITY_FLAGS.MISSING_DATA);
  });

  it('lets a Top 5 still be selected from the survivors', () => {
    const result = build();
    expect(result.picks.map((p) => p.symbol)).toEqual(['GOOD1.NS', 'GOOD2.NS']);
    expect(result.picks.every((p) => p.rank != null)).toBe(true);
  });
});

describe('getUniverseHistoricalData — failure asymmetry', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  async function loadWith(getHistoricalData) {
    vi.doMock('../../data/providers/MockProvider.js', () => ({
      MockProvider: class {
        get id() { return 'mock'; }
        getHistoricalData = getHistoricalData;
        async getLatestQuotes() { return new Map(); }
      },
      withSyntheticPadding: (s) => s,
    }));
    vi.stubEnv('VITE_DATA_PROVIDER', 'mock');
    return import('../../data/dataService.js');
  }

  it('survives one failing stock and reports it in unavailableSymbols', async () => {
    let firstStock = null;
    const { getUniverseHistoricalData } = await loadWith(async function (symbol) {
      if (symbol.startsWith('NIFTYBEES')) return series(100, 110);
      // Kill exactly one real constituent, whichever comes first.
      if (firstStock === null) firstStock = symbol;
      if (symbol === firstStock) throw new Error(`Yahoo Finance returned 404 for ${symbol}`);
      return series(100, 120);
    });

    const result = await getUniverseHistoricalData('nifty50');
    expect(result.unavailableSymbols).toHaveLength(1);
    expect(result.unavailableSymbols[0].reason).toMatch(/404/);
    // The other 49 are intact — that's the whole point.
    expect(result.priceSeriesMap.size).toBe(result.stocks.length - 1);
    expect(result.benchmarkSeries.length).toBeGreaterThan(0);
  });

  it('leaves suggestion null for an unrecognised failing symbol (the common case)', async () => {
    let firstStock = null;
    const { getUniverseHistoricalData } = await loadWith(async function (symbol) {
      if (symbol.startsWith('NIFTYBEES')) return series(100, 110);
      if (firstStock === null) firstStock = symbol;
      if (symbol === firstStock) throw new Error(`Yahoo Finance returned 404 for ${symbol}`);
      return series(100, 120);
    });

    const result = await getUniverseHistoricalData('nifty50');
    expect(result.unavailableSymbols).toHaveLength(1);
    // Almost every real failure will be unrecognised — this is the honest
    // default, not an edge case.
    expect(result.unavailableSymbols[0].suggestion).toBeNull();
  });

  it('still fails the whole universe when the BENCHMARK is unavailable', async () => {
    const { getUniverseHistoricalData } = await loadWith(async function (symbol) {
      if (symbol.startsWith('NIFTYBEES')) throw new Error('benchmark fetch failed');
      return series(100, 120);
    });
    // No benchmark means no RS for anyone (spec Section 9), so degrading
    // gracefully here would produce a table of nulls dressed up as a result.
    await expect(getUniverseHistoricalData('nifty50')).rejects.toThrow(/benchmark fetch failed/);
  });

  it('still fails the whole universe when EVERY stock is unavailable', async () => {
    const { getUniverseHistoricalData } = await loadWith(async function (symbol) {
      if (symbol.startsWith('NIFTYBEES')) return series(100, 110);
      throw new Error('everything is down');
    });
    // 50/50 failing is an outage, not 50 independent renames.
    await expect(getUniverseHistoricalData('nifty50')).rejects.toThrow(/No historical data could be fetched/);
  });
});
