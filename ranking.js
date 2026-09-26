import { TOP_N } from '../config/constants.js';

/**
 * Ranks stocks by RS, highest first (spec Section 10: "Highest RS: Rank 1").
 * Items with rs === null (data quality issue) are sorted to the bottom and
 * excluded from ranks — they're kept in the output array (with rank: null)
 * so the UI can still show *why* a stock is missing, rather than silently
 * disappearing (spec Section 41).
 *
 * Tie-break (documented assumption, spec Section 39 requires determinism):
 * equal RS -> higher raw stock return wins -> otherwise alphabetical symbol.
 */
export function rankByRS(items) {
  const eligible = items.filter((i) => i.rs != null);
  const ineligible = items.filter((i) => i.rs == null);

  eligible.sort((a, b) => {
    if (b.rs !== a.rs) return b.rs - a.rs;
    if (b.stockReturnPct !== a.stockReturnPct) return b.stockReturnPct - a.stockReturnPct;
    return a.symbol.localeCompare(b.symbol);
  });

  const ranked = eligible.map((item, idx) => ({ ...item, rank: idx + 1 }));
  const unranked = ineligible.map((item) => ({ ...item, rank: null }));
  return [...ranked, ...unranked];
}

/**
 * Top-N selection (spec Section 11). If fewer than N stocks are eligible
 * (e.g. due to data-quality exclusions), returns whatever is available and
 * flags the shortfall rather than pretending N were selected.
 */
export function selectTopN(rankedItems, n = TOP_N) {
  const eligible = rankedItems.filter((i) => i.rank != null);
  const top = eligible.slice(0, n);
  return {
    picks: top,
    isShort: top.length < n,
    shortfall: Math.max(0, n - top.length),
  };
}
