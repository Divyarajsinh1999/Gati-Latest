// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Behaviour when live market data can't be reached.
 *
 * REVERSED 31 Jul 2026 on explicit user direction. The previous version of
 * this suite (see CHANGELOG) asserted the opposite: that a failed live
 * fetch should be caught and silently re-run against MockProvider so the
 * dashboard kept rendering numbers, flagged as synthetic via a banner. The
 * user was explicit that this is the wrong tradeoff for a financial tool —
 * an honest "couldn't load" beats a plausible-looking fake number, however
 * clearly labelled. Spec Section 35 (#11, "do not fabricate unavailable
 * market data") already argued this way; this suite now holds the code to
 * that argument's actual conclusion.
 *
 * So: no fallback. A live-provider failure must propagate as a real
 * rejection, so the UI can show an explicit error and nothing else.
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

async function loadServiceWithFailingLiveProvider() {
  vi.doMock('../../data/providers/YahooFinanceProvider.js', () => ({
    YahooFinanceProvider: class {
      get id() { return 'yahoo'; }
      async getHistoricalData() { throw new Error('Yahoo Finance fetch failed: 401'); }
      async getLatestQuotes() { throw new Error('Yahoo Finance fetch failed: 401'); }
    },
  }));
  vi.stubEnv('VITE_DATA_PROVIDER', 'yahoo');
  return import('../../data/dataService.js');
}

describe('fetchUniverseBundle — live provider unavailable', () => {
  it('rejects rather than silently substituting sample data', async () => {
    const { fetchUniverseBundle } = await loadServiceWithFailingLiveProvider();
    // This is the entire point of the change: no caught-and-retried mock
    // path. The caller (React Query, via useUniverseData) must see a real
    // rejection so isError fires and the UI shows an explicit notice.
    await expect(fetchUniverseBundle('nifty50')).rejects.toThrow(/401|failed/i);
  });

  it('does not return a partially-built bundle on failure', async () => {
    const { fetchUniverseBundle } = await loadServiceWithFailingLiveProvider();
    // Guards against a regression where some fields get populated before
    // the throw — there must be nothing a UI could accidentally render.
    await expect(fetchUniverseBundle('nifty50')).rejects.toBeInstanceOf(Error);
  });
});

describe('fetchUniverseBundle — normal operation', () => {
  it('returns real data and no error signal when the provider works', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', 'mock');
    const { fetchUniverseBundle } = await import('../../data/dataService.js');
    const bundle = await fetchUniverseBundle('nifty50');

    expect(bundle.providerId).toBe('mock');
    expect(bundle.stocks.length).toBe(50);
    expect(bundle.benchmarkSeries.length).toBeGreaterThan(0);
    // The bundle shape no longer carries a liveDataError field at all —
    // there is nothing left to fall back FROM, so nothing to flag.
    expect(bundle).not.toHaveProperty('liveDataError');
  });

  it('still reports a real dataAsOf date rather than inventing "now"', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', 'mock');
    const { fetchUniverseBundle } = await import('../../data/dataService.js');
    const bundle = await fetchUniverseBundle('nifty50');
    expect(bundle.dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('propagates a mock-provider failure too — there is no second fallback to hide behind', async () => {
    vi.doMock('../../data/providers/MockProvider.js', () => ({
      MockProvider: class {
        get id() { return 'mock'; }
        async getHistoricalData() { throw new Error('sample data generator broken'); }
        async getLatestQuotes() { throw new Error('sample data generator broken'); }
      },
      withSyntheticPadding: (s) => s,
    }));
    vi.stubEnv('VITE_DATA_PROVIDER', 'mock');
    const { fetchUniverseBundle } = await import('../../data/dataService.js');

    await expect(fetchUniverseBundle('nifty50')).rejects.toThrow(/sample data generator broken/);
  });
});
