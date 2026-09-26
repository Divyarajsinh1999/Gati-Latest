// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDataFreshness } from '../useDataFreshness.js';

afterEach(cleanup);

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

const universeData = (dataAsOf, providerId = 'yahoo') => ({
  dataAsOf,
  providerId,
  universe: {},
  stocks: [],
  priceSeriesMap: new Map(),
  benchmarkSeries: [],
  quotes: new Map(),
});

describe('useDataFreshness', () => {
  it('reports not-loaded when nothing has been fetched — never invents a timestamp', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useDataFreshness(), { wrapper });
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.fetchedAt).toBeNull();
    expect(result.current.dataAsOf).toBeNull();
  });

  it('reads real freshness from the query cache once data lands', () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDataFreshness(), { wrapper });

    act(() => {
      queryClient.setQueryData(['universe-data', 'nifty50'], universeData('2026-07-29'));
    });

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.dataAsOf).toBe('2026-07-29');
    expect(result.current.providerId).toBe('yahoo');
    expect(typeof result.current.fetchedAt).toBe('number');
  });

  it('reports the NEWEST dataAsOf across universes, not whichever landed last', () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDataFreshness(), { wrapper });

    act(() => {
      queryClient.setQueryData(['universe-data', 'nifty50'], universeData('2026-07-30'));
      // A staler universe arriving afterwards must not drag the reported
      // freshness backwards.
      queryClient.setQueryData(['universe-data', 'smallcap250'], universeData('2026-07-24'));
    });

    expect(result.current.dataAsOf).toBe('2026-07-30');
  });

  it('surfaces the mock provider so synthetic data can be badged', () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDataFreshness(), { wrapper });
    act(() => {
      queryClient.setQueryData(['universe-data', 'nifty50'], universeData('2026-07-30', 'mock'));
    });
    expect(result.current.providerId).toBe('mock');
  });

  it('ignores unrelated queries in the same cache', () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDataFreshness(), { wrapper });
    act(() => {
      queryClient.setQueryData(['something-else'], { dataAsOf: '2099-01-01', providerId: 'bogus' });
    });
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.dataAsOf).toBeNull();
  });

  it('returns a REFERENTIALLY STABLE snapshot when nothing changed', () => {
    // This is the property that keeps useSyncExternalStore from looping
    // forever: readFreshness() builds a fresh object each call, so the hook
    // must reuse the previous one when the meaningful fields are unchanged.
    // A regression here would manifest as an infinite render, which is a
    // nasty way to find out in production.
    const { queryClient, wrapper } = setup();
    const { result, rerender } = renderHook(() => useDataFreshness(), { wrapper });

    act(() => {
      queryClient.setQueryData(['universe-data', 'nifty50'], universeData('2026-07-30'));
    });

    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first); // identity, not just deep equality
  });

  it('produces a NEW snapshot when the data actually changes', () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDataFreshness(), { wrapper });

    act(() => {
      queryClient.setQueryData(['universe-data', 'nifty50'], universeData('2026-07-29'));
    });
    const first = result.current;

    act(() => {
      queryClient.setQueryData(['universe-data', 'nifty50'], universeData('2026-07-30'));
    });

    expect(result.current).not.toBe(first);
    expect(result.current.dataAsOf).toBe('2026-07-30');
  });
});
