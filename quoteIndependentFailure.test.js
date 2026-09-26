// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 2.1b — a live-quote failure must not discard historical data that
 * already loaded successfully.
 *
 * Quotes and history hit different Yahoo endpoints under different auth
 * tiers (v7/quote needs the crumb handshake, v8/chart doesn't — see
 * HANDOFF.md's Phase 1 correction), so they fail INDEPENDENTLY in
 * practice. Before this, `fetchUniverseBundle` awaited both calls in
 * sequence with no isolation, so a quote-only failure (e.g. the crumb
 * handshake breaking) rejected the whole bundle exactly like a historical
 * failure — even though the backtest and rankings never read a live quote
 * at all. This must now resolve, not reject, with the quote failure
 * recorded separately.
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

function bar(date, close) {
  return { date, open: close, high: close, low: close, close, adjClose: close, volume: 1000 };
}

async function loadWithQuoteFailure() {
  vi.doMock('../../data/providers/MockProvider.js', () => ({
    MockProvider: class {
      get id() { return 'mock'; }
      async getHistoricalData() {
        return [bar('2025-01-30', 100), bar('2025-01-31', 100), bar('2025-02-27', 110), bar('2025-02-28', 110)];
      }
      async getLatestQuotes() { throw new Error('Yahoo Finance quote fetch failed: crumb handshake rejected'); }
    },
    withSyntheticPadding: (s) => s,
  }));
  vi.stubEnv('VITE_DATA_PROVIDER', 'mock');
  return import('../../data/dataService.js');
}

describe('fetchUniverseBundle — quote-only failure', () => {
  it('resolves instead of rejecting when only getLatestQuotes fails', async () => {
    const { fetchUniverseBundle } = await loadWithQuoteFailure();
    await expect(fetchUniverseBundle('nifty50')).resolves.toBeDefined();
  });

  it('carries the reason in quotesError, with quotes as an empty Map', async () => {
    const { fetchUniverseBundle } = await loadWithQuoteFailure();
    const bundle = await fetchUniverseBundle('nifty50');
    expect(bundle.quotesError).toMatch(/crumb handshake/);
    expect(bundle.quotes).toBeInstanceOf(Map);
    expect(bundle.quotes.size).toBe(0);
  });

  it('still returns full historical data — the whole point of isolating the two failures', async () => {
    const { fetchUniverseBundle } = await loadWithQuoteFailure();
    const bundle = await fetchUniverseBundle('nifty50');
    expect(bundle.stocks.length).toBe(50);
    expect(bundle.benchmarkSeries.length).toBeGreaterThan(0);
    expect(bundle.priceSeriesMap.size).toBe(50);
    expect(bundle.dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('leaves quotesError null on normal operation (no regression)', async () => {
    vi.doMock('../../data/providers/MockProvider.js', () => ({
      MockProvider: class {
        get id() { return 'mock'; }
        async getHistoricalData() {
          return [bar('2025-01-30', 100), bar('2025-01-31', 100), bar('2025-02-27', 110), bar('2025-02-28', 110)];
        }
        async getLatestQuotes(symbols) {
          return new Map(symbols.map((s) => [s, { price: 110, changePct: 1.2 }]));
        }
      },
      withSyntheticPadding: (s) => s,
    }));
    vi.stubEnv('VITE_DATA_PROVIDER', 'mock');
    const { fetchUniverseBundle } = await import('../../data/dataService.js');
    const bundle = await fetchUniverseBundle('nifty50');
    expect(bundle.quotesError).toBeNull();
    expect(bundle.quotes.size).toBeGreaterThan(0);
  });
});
