/**
 * INDEX QUOTES — one batched request for the whole home strip.
 *
 * WHAT THIS OWNS
 *   Fetching the four home indices and nothing else.
 *
 * WHAT THIS MUST NEVER DO
 *   Poll on its own schedule, or fetch per index. Four indices are ONE
 *   request through the same `/api/quote` batching every other quote uses,
 *   on the same `REFRESH_CADENCE_MS`, gated on the same session — so the
 *   strip cannot be refreshing while the header says polling is paused.
 *
 * WHY A SEPARATE QUERY AND NOT PART OF THE UNIVERSE BUNDLE
 *   The universe bundle is keyed per universe and refetches when the reader
 *   switches between large/mid/small cap. The strip is global and identical
 *   on every screen. Folding index symbols into each bundle would fetch the
 *   same four quotes three times over and re-fetch them on a tab change.
 *   One global query is strictly fewer requests, not more.
 *
 *   This is the "different data, one query" case — not the duplicate polling
 *   the brief rules out, which is several components each fetching the SAME
 *   data on timers of their own.
 */

import { useQuery } from '@tanstack/react-query';
import { getLatestQuotes } from '../data/dataService.js';
import { HOME_INDICES, HOME_INDEX_SYMBOLS } from '../config/indices.js';
import { REFRESH_CADENCE_MS } from '../config/constants.js';
import { useMarketSessionStatus } from './useMarketSession.js';

/**
 * @returns {{
 *   indices: Array<{symbol,name,short,value,changePct,asOf,isMissing}>,
 *   isLoading: boolean,
 *   isError: boolean,
 *   error: Error|null,
 *   fetchedAt: number|null,
 * }}
 */
export function useIndexQuotes() {
  const session = useMarketSessionStatus();
  const isOpen = session.status === 'OPEN';

  const query = useQuery({
    queryKey: ['index-quotes'],
    queryFn: () => getLatestQuotes(HOME_INDEX_SYMBOLS),
    staleTime: REFRESH_CADENCE_MS,
    // Polls only while the exchange is actually trading. A closed market
    // cannot produce a new index level, so refetching then would spend
    // requests against a free endpoint to receive the same number back.
    refetchInterval: isOpen ? REFRESH_CADENCE_MS : false,
    // The last level stays on screen through a failed refresh. Blanking a
    // strip because one poll failed is worse than showing the last real
    // value with its own timestamp beside it.
    placeholderData: (previous) => previous,
    retry: 1,
  });

  const quotes = query.data;

  const indices = HOME_INDICES.map((index) => {
    const quote = quotes?.get?.(index.symbol) ?? null;
    const value = Number.isFinite(quote?.price) ? quote.price : null;
    const changePct = Number.isFinite(quote?.changePct) ? quote.changePct : null;
    return {
      ...index,
      value,
      changePct,
      asOf: quote?.asOf ?? null,
      // An index that did not come back is shown as unavailable, never as a
      // dash that could be mistaken for zero movement.
      isMissing: value == null,
    };
  });

  return {
    indices,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    fetchedAt: query.dataUpdatedAt || null,
  };
}
