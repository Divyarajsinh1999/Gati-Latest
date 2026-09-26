/**
 * RANKING VIEW MODEL.
 *
 * WHAT THIS OWNS
 *   Search, filter, sort and the split between rankable and unavailable rows.
 *
 * WHAT THIS MUST NEVER DO
 *   Recompute a rank. Ranking is the engine's output; this file reorders a
 *   list for display and preserves the true rank on every row, so a sorted
 *   view never obscures what the strategy actually decided.
 */

import { formatINR, formatPct, formatGap, formatCompactNumber, formatDate } from '../utils/formatters.js';
import { resolveTodayChange } from './todayChange.js';
import { MOMENTUM_DIRECTION } from '../engine/rsHistory.js';

/**
 * Filters. Deliberately five — enough to be useful, few enough to scan.
 * "My positions" arrives with the portfolio feature and is absent until then,
 * because a filter that always returns nothing is a broken control.
 */
export const RANKING_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'top', label: 'Top 5' },
  { key: 'positive', label: 'Positive RS' },
  { key: 'negative', label: 'Negative RS' },
];

/**
 * Sorts.
 *
 * `rank` is the default and the only order that reflects the strategy. The
 * others are for finding a specific stock, not for deciding what to buy — a
 * distinction the UI keeps by never allowing the Top-5 segment itself to be
 * reordered.
 */
export const RANKING_SORTS = [
  { key: 'rank', label: 'By rank' },
  { key: 'name', label: 'By name' },
  { key: 'dayChange', label: "By today's change" },
  { key: 'price', label: 'By price' },
];

/**
 * Points in a row sparkline.
 *
 * Thirty is about six weeks of sessions — enough to show a shape, few enough
 * that 250 rows cost 7,500 numbers rather than 100,000. The full series is
 * already in memory either way; this bounds what crosses into the view model.
 */
const SPARK_POINTS = 30;

/**
 * Sample the tail of a price series for a sparkline.
 *
 * Reads the adjusted close the data layer already holds — no calculation, no
 * second source of truth. Returns null rather than a flat placeholder when
 * there is too little history: an invented line would imply a shape the data
 * does not have.
 */
function sparkFrom(series) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const tail = series.slice(-SPARK_POINTS);
  const points = tail.map((bar) => bar.adjClose ?? bar.close).filter((v) => typeof v === 'number');
  return points.length >= 2 ? points : null;
}

export function selectRankingView({ data, search = '', filter = 'all', sort = 'rank', session = null }) {
  if (!data) return null;

  const { currentMomentum, momentumAge, unavailableSymbols = [], stocks = [], priceSeriesMap } = data;
  const ranked = currentMomentum?.ranked ?? [];
  const topSymbols = new Set((currentMomentum?.picks ?? []).map((p) => p.symbol));

  const shaped = ranked
    // A row with no rank is not rankable and belongs in the excluded section,
    // not scattered through the order where it reads as a data error.
    .filter((row) => row.rank != null)
    .map((row) => {
      const age = momentumAge?.get(row.symbol) ?? null;
      return {
        symbol: row.symbol,
        name: row.name,
        sector: row.sector ?? null,
        rank: row.rank,
        isTopN: topSymbols.has(row.symbol),
        rs: row.rs,
        stockReturnPct: row.stockReturnPct,
        benchmarkReturnPct: row.benchmarkReturnPct,
        currentPrice: row.currentPrice,
        dailyChangePct: row.dailyChangePct,
        momentumAge: age?.consecutiveMonths ?? null,
        // Descriptive only (decision D14.3): it says what already happened to
        // relative strength, never what will happen next.
        direction: row.rsTrend ? MOMENTUM_DIRECTION[row.rsTrend] ?? null : null,
        spark: sparkFrom(priceSeriesMap?.get(row.symbol)),
        priceLabel: row.currentPrice == null ? null : formatINR(row.currentPrice),
        rsLabel: row.rs == null ? null : formatGap(row.rs, { digits: 1 }),
        rsDirection: row.rs == null ? null : row.rs >= 0 ? 'gain' : 'loss',
        dayChangeLabel: resolveTodayChange(row, session).label,
        dayDirection: resolveTodayChange(row, session).direction,

        /**
         * THE THREE COLUMNS THE TABLE ADDED (M13).
         *
         * All were already computed by `computeCurrentMomentum` for the
         * ranking itself — the view model simply never carried them. Nothing
         * new is calculated here and nothing extra is fetched.
         *
         * The previous month-end price matters because it is the DENOMINATOR
         * of the stock's monthly return. Showing the result without the base
         * it was measured from makes the figure unauditable, and this is a
         * screen someone checks a number on.
         */
        priorMonthEndPrice: row.priorMonthEndPrice ?? null,
        priorMonthEndLabel: row.priorMonthEndPrice == null ? null : formatINR(row.priorMonthEndPrice),
        priorMonthEndDate: row.priorMonthEndDate ?? null,
        /*
          THE DATE, SHOWN BESIDE THE FIGURE (owner, 27 Aug 2026).

          The denominator of the stock return two columns away, and until now
          the only unauditable number on the row: there was no way to tell
          whether it was holding still through the month or drifting with
          whatever bar the stock's data happened to end on. Short form,
          because it repeats identically down all 250 rows and a full date
          would be 250 copies of the same sentence.
        */
        priorMonthEndDateLabel: row.priorMonthEndDate ? formatDate(row.priorMonthEndDate) : null,

        stockReturnLabel: row.stockReturnPct == null ? null : formatPct(row.stockReturnPct),
        stockReturnDirection: row.stockReturnPct == null ? null : row.stockReturnPct >= 0 ? 'gain' : 'loss',
        benchmarkReturnLabel: row.benchmarkReturnPct == null ? null : formatPct(row.benchmarkReturnPct),
        benchmarkReturnDirection:
          row.benchmarkReturnPct == null ? null : row.benchmarkReturnPct >= 0 ? 'gain' : 'loss',

        /**
         * Volume is a RUNNING SESSION TOTAL, not a rate — the column header
         * says "Day volume" for that reason. See the dayVolume glossary entry.
         */
        volume: row.volume ?? null,
        volumeLabel: row.volume == null ? null : formatCompactNumber(row.volume),
      };
    });

  const counts = {
    all: shaped.length,
    top: shaped.filter((r) => r.isTopN).length,
    positive: shaped.filter((r) => r.rs != null && r.rs > 0).length,
    negative: shaped.filter((r) => r.rs != null && r.rs < 0).length,
  };

  const term = search.trim().toLowerCase();
  let rows = shaped;

  if (term) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(term) || r.symbol.toLowerCase().includes(term));
  }

  if (filter === 'top') rows = rows.filter((r) => r.isTopN);
  else if (filter === 'positive') rows = rows.filter((r) => r.rs != null && r.rs > 0);
  else if (filter === 'negative') rows = rows.filter((r) => r.rs != null && r.rs < 0);

  rows = sortRows(rows, sort);

  return {
    rows,
    counts,
    rankedCount: shaped.length,
    totalCount: stocks.length || shaped.length + unavailableSymbols.length,
    unavailable: collectExcluded(ranked, unavailableSymbols),
    activeFilter: filter,
    activeSort: sort,
    priceNote: describePriceSource(session, currentMomentum),
  };
}

/**
 * WHAT THE PRICE COLUMN IS SHOWING RIGHT NOW — one sentence, for the icon.
 *
 * The glossary explains what a price IS. It cannot answer the question the
 * reader actually has when they tap the icon beside one, which is whether
 * THIS number is live or Friday's — an answer that changes by the minute and
 * so cannot be written down in advance (see InfoTip's `note`).
 *
 * The session is the sole authority on whether trading is happening; this
 * never re-derives it from whether a quote object came back, which is the
 * mistake `todayChange.js` exists to document.
 */
function describePriceSource(session, currentMomentum) {
  const asOf = currentMomentum?.asOf ?? null;
  const dated = asOf ? formatDate(asOf) : null;

  if (session?.status === 'OPEN') {
    return `Live — refreshed every ${session.cadenceLabel ?? '30 sec'} while the session runs.`;
  }
  if (session?.status === 'PRE_OPEN') {
    return dated
      ? `Pre-open auction. Showing the close of ${dated} until continuous trading starts.`
      : 'Pre-open auction. Showing the last close until continuous trading starts.';
  }

  // WEEKEND, HOLIDAY, CLOSED, or no session yet — all the same answer, and
  // the date is the part that matters. Naming the reason as well would be
  // three sentences where the reader asked one question.
  return dated ? `Not live. This is the close of ${dated}.` : 'Not live. Showing the last available close.';
}

/**
 * EVERY STOCK THE ORDERED LIST DOES NOT CONTAIN, WITH THE REASON ATTACHED.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THIS USED TO READ ONLY `unavailableSymbols`, AND THAT WAS A HOLE.
 *
 * `unavailableSymbols` is the data layer's list: the symbols whose FETCH
 * failed. It says nothing about a symbol that fetched perfectly and was then
 * declined by the ENGINE — too little history, or (since v1.6.1) a series
 * that has stopped running. Those rows were filtered out of `shaped` for
 * having no rank and appeared nowhere else, so the screen showed 49 rows of
 * a 50-stock universe and a footer claiming nothing had been excluded.
 *
 * Silent subtraction is the one failure mode this app is least allowed to
 * have. A stock visibly excluded with a reason is a data-quality notice the
 * reader can act on; a stock that is merely absent is indistinguishable from
 * a bug, and they cannot even tell there is something to ask about.
 *
 * The two sources overlap by design — a failed fetch ALSO produces an
 * unranked row — so the fetch list wins on reason (it knows about renames)
 * and the symbol is emitted once.
 * ═════════════════════════════════════════════════════════════════════════
 */
function collectExcluded(ranked, unavailableSymbols) {
  const bySymbol = new Map();

  // Engine exclusions first, so a fetch failure can overwrite the reason
  // with the more specific one it holds.
  for (const row of ranked) {
    if (row.rank != null) continue;
    bySymbol.set(row.symbol, {
      symbol: row.symbol,
      name: row.name ?? row.symbol,
      // The engine's own words where it has them — "No price data since
      // 2026-07-27" tells the reader what to check; "Price data unavailable"
      // tells them nothing they could not see for themselves.
      reason: row.unavailableReason ?? row.flags?.[0] ?? 'Could not be ranked',
      suggestion: row.unavailableSuggestion ?? null,
      lastBarDate: row.lastBarDate ?? null,
    });
  }

  for (const u of unavailableSymbols) {
    bySymbol.set(u.symbol, {
      symbol: u.symbol,
      name: u.name ?? bySymbol.get(u.symbol)?.name ?? u.symbol,
      reason: u.reason ?? 'Price data unavailable',
      suggestion: u.suggestion ?? null,
      lastBarDate: bySymbol.get(u.symbol)?.lastBarDate ?? null,
    });
  }

  return [...bySymbol.values()];
}

function sortRows(rows, sort) {
  const copy = [...rows];
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'dayChange':
      return copy.sort(descendingNullsLast('dailyChangePct'));
    case 'price':
      return copy.sort(descendingNullsLast('currentPrice'));
    case 'rank':
    default:
      return copy.sort((a, b) => a.rank - b.rank);
  }
}

/**
 * Descending, with nulls always last.
 *
 * The null check has to happen on a and b directly rather than inside a
 * shared comparator called with swapped arguments — swapping for descending
 * order also swaps which side the nulls fall on, which put unpriced stocks at
 * the top of a "biggest movers" list. A stock with no quote has not "risen
 * the most"; sorting it to either extreme says something untrue about it.
 */
function descendingNullsLast(key) {
  return (a, b) => {
    const left = a[key];
    const right = b[key];
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
  };
}
