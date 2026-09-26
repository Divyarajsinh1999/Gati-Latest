import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Real data freshness, for the header's "last updated" display.
 *
 * Replaces a previous `lastDataUpdate={new Date().toISOString()}` in
 * AppShell, which rendered the current clock time regardless of how old
 * the underlying data actually was — i.e. it always claimed to be live.
 * Spec Section 22 requires showing the latest available timestamp
 * "instead of pretending data is live"; Section 35 #12 requires
 * distinguishing historical, delayed and live data.
 *
 * Rather than thread props down from every page (and risk them
 * disagreeing), this reads React Query's own cache, which already tracks
 * `dataUpdatedAt` per query. Implemented with useSyncExternalStore since
 * that's precisely the "subscribe to an external mutable store" case —
 * a useState/useEffect version would either miss updates between first
 * render and effect mount, or need a setState in the effect body.
 *
 * Returns { fetchedAt, dataAsOf, providerId, isLoaded }.
 */
export function useDataFreshness() {
  const queryClient = useQueryClient();
  const snapshotRef = useRef(null);

  const subscribe = useCallback(
    (onStoreChange) => queryClient.getQueryCache().subscribe(onStoreChange),
    [queryClient],
  );

  // useSyncExternalStore requires a referentially STABLE snapshot when
  // nothing changed, or it re-renders forever. readFreshness() builds a
  // fresh object every call, so compare the fields that matter and reuse
  // the previous object whenever they're identical.
  const getSnapshot = useCallback(() => {
    const next = readFreshness(queryClient);
    const prev = snapshotRef.current;
    if (
      prev &&
      prev.fetchedAt === next.fetchedAt &&
      prev.dataAsOf === next.dataAsOf &&
      prev.providerId === next.providerId
    ) {
      return prev;
    }
    snapshotRef.current = next;
    return next;
  }, [queryClient]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function readFreshness(queryClient) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['universe-data'] });

  let fetchedAt = null;
  let dataAsOf = null;
  let providerId = null;

  for (const query of queries) {
    const { status, data, dataUpdatedAt } = query.state;
    if (status !== 'success' || !data) continue;
    if (dataUpdatedAt && (fetchedAt == null || dataUpdatedAt > fetchedAt)) fetchedAt = dataUpdatedAt;
    // ISO 'YYYY-MM-DD' strings compare correctly with >, no parsing needed.
    if (data.dataAsOf && (dataAsOf == null || data.dataAsOf > dataAsOf)) dataAsOf = data.dataAsOf;
    if (data.providerId) providerId = data.providerId;
  }

  return { fetchedAt, dataAsOf, providerId, isLoaded: fetchedAt != null };
}
