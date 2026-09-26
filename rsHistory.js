/**
 * RS HISTORY — a compact trailing Relative Strength series for every stock.
 *
 * WHAT THIS OWNS
 *   For a stock, a universe and a window: its RS at each of the last N
 *   completed month-ends, with the rank it held and whether it made the Top N.
 *
 * WHAT THIS MUST NEVER DO
 *   Fill a gap. A month with no data for a stock produces NO ENTRY — not a
 *   zero, not a carried-forward value, not an interpolation. A fabricated
 *   0.0pp reads as "kept pace with the benchmark", which is a specific and
 *   wrong claim. An absent month reads as "we don't know", which is true.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERFORMANCE — why this costs almost nothing
 *
 * The backtest already ranks the ENTIRE universe at EVERY month-end; that is
 * what `rankingHistory` is. Recomputing RS per stock afterwards would redo
 * work that has already been done, at O(stocks x months) for a second time.
 *
 * So the bulk path is a PROJECTION of the backtest's existing output: one
 * pass over `rankingHistory`, pivoting month-major data into symbol-major
 * data. That is O(months x stocks) once, with no price lookups, no month-end
 * re-indexing, and no RS arithmetic at all. On a 250-stock universe with 19
 * month-ends it is ~4,750 map writes — immaterial next to the backtest that
 * produced the input.
 *
 * The single-stock path exists for one specific screen (Stock Detail, which
 * shows all four windows at once for one stock) and is deliberately NOT used
 * for lists. Calling it in a loop over a universe would reintroduce exactly
 * the O(n x m) cost the bulk path avoids.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { getMonthEndRecords } from './tradingCalendar.js';
import { computeStockRS } from './momentum.js';
import { rankByRS, selectTopN } from './ranking.js';
import { TOP_N } from '../config/constants.js';

/** Months of trailing history kept per stock. Three is the approved default. */
export const RS_HISTORY_MONTHS = 3;

/**
 * BULK — build trailing RS history for every stock from an existing backtest.
 *
 * @param {object} args
 * @param {Array} args.rankingHistory  from runBacktest; one entry per signal date
 * @param {number} [args.months]       how many trailing month-ends to keep
 * @param {number} [args.topN]
 * @returns {Map<string, Array<RSHistoryPoint>>} ascending by month, gaps omitted
 */
export function buildRSHistory({ rankingHistory = [], months = RS_HISTORY_MONTHS, topN = TOP_N } = {}) {
  const bySymbol = new Map();
  if (rankingHistory.length === 0) return bySymbol;

  // Only the most recent `months` signals are needed. Slicing first means the
  // pivot below touches 3 months of data rather than all 19.
  const recent = rankingHistory.slice(-months);

  for (const snapshot of recent) {
    for (const row of snapshot.rankings) {
      // A row with no RS is a gap: the stock had no usable data that month.
      // Skipping it is what produces a gap rather than a fabricated value.
      if (row.rs == null || row.rank == null) continue;

      let series = bySymbol.get(row.symbol);
      if (!series) {
        series = [];
        bySymbol.set(row.symbol, series);
      }
      series.push({
        monthKey: snapshot.monthKey,
        signalDate: snapshot.date,
        rs: row.rs,
        rank: row.rank,
        wasInTopN: row.rank <= topN,
      });
    }
  }

  // rankingHistory is already ascending, so each series is too — no sort.
  return bySymbol;
}

/**
 * Attach trailing RS history to ranked rows in place of a second lookup pass.
 *
 * Rows keep their existing shape and gain `rsHistory` plus two derived
 * conveniences the UI would otherwise recompute per render:
 *   rsTrend        'improving' | 'deteriorating' | 'steady' | null
 *   rankChange     rank movement since the previous completed month-end
 *
 * `rsTrend` compares only the first and last points of the series. A stock
 * that fell then recovered reads as 'steady', which is honest: three points
 * is not enough to claim a shape, and pretending otherwise would dress up
 * noise as a signal.
 */
export function attachRSHistory(rows, historyBySymbol) {
  return rows.map((row) => {
    const history = historyBySymbol.get(row.symbol) ?? [];
    return {
      ...row,
      rsHistory: history,
      rsTrend: deriveTrend(history),
      rankChange: deriveRankChange(history),
    };
  });
}

/**
 * MOMENTUM DIRECTION — improving | stable | weakening   (decision D14.3)
 *
 * DESCRIPTIVE, NEVER PREDICTIVE. The label says what already happened to
 * relative strength across the observed months. Gati has no view on what
 * happens next and must never imply one — a directional word beside a price is
 * read as advice unless the language refuses it.
 *
 * `stable` is the honest reading of a small move on three data points, not a
 * hedge. Below the band the change is not distinguishable from month-to-month
 * wobble, and calling it a trend would dress noise up as a signal.
 *
 * Compares only first and last: a stock that fell then recovered reads as
 * stable, which is correct. Three points is not enough to claim a shape.
 */
function deriveTrend(history) {
  if (history.length < 2) return null;
  const delta = history[history.length - 1].rs - history[0].rs;
  if (Math.abs(delta) < TREND_BAND_PP) return 'stable';
  return delta > 0 ? 'improving' : 'weakening';
}

/** Percentage points of RS movement below which nothing is claimed. */
export const TREND_BAND_PP = 0.5;

/** Display vocabulary, in one place so no screen invents its own wording. */
export const MOMENTUM_DIRECTION = {
  improving: { key: 'improving', label: 'Improving', tone: 'gain' },
  stable: { key: 'stable', label: 'Stable', tone: 'neutral' },
  weakening: { key: 'weakening', label: 'Weakening', tone: 'loss' },
};

function deriveRankChange(history) {
  if (history.length < 2) return null;
  const previous = history[history.length - 2].rank;
  const latest = history[history.length - 1].rank;
  // Positive means IMPROVED, because rank 1 is best and a smaller number is
  // better. Returning the raw difference would invert the sign against every
  // reader's intuition.
  return previous - latest;
}

/**
 * SINGLE STOCK — trailing RS across an explicit set of windows.
 *
 * For the Stock Detail screen, which answers "why is this one here?" by
 * showing 1M / 3M / 6M / 12M side by side for one stock. Reuses the same
 * month-end index and the same benchmark resolution as the ranking, so a
 * value shown here is bit-identical to the same value in the table.
 *
 * NOT FOR LISTS. Use buildRSHistory for anything covering a universe.
 *
 * @returns {Map<number, Array>} lookbackMonths -> ascending history
 */
export function buildSingleStockRSHistory({
  series = [],
  benchmarkSeries = [],
  windows = [1, 3, 6, 12],
  months = RS_HISTORY_MONTHS,
} = {}) {
  const out = new Map();
  if (series.length === 0 || benchmarkSeries.length === 0) {
    for (const w of windows) out.set(w, []);
    return out;
  }

  // Indexed once and shared across every window — the whole reason this is
  // one function rather than four calls.
  const stockMonthEnds = getMonthEndRecords(series);
  const benchMonthEnds = getMonthEndRecords(benchmarkSeries);
  const stockByMonth = new Map(stockMonthEnds.map((m) => [m.monthKey, m]));

  for (const lookbackMonths of windows) {
    const points = [];
    // Walk backwards from the newest completed month-end, taking at most
    // `months` points and stopping as soon as the window runs out of history.
    for (let i = benchMonthEnds.length - 1; i >= lookbackMonths && points.length < months; i--) {
      const signal = benchMonthEnds[i];
      const reference = benchMonthEnds[i - lookbackMonths];
      const current = stockByMonth.get(signal.monthKey);
      const previous = stockByMonth.get(reference.monthKey);
      if (!current || !previous) continue; // gap, deliberately left as one

      const result = computeStockRS({
        currentRecord: current,
        previousRecord: previous,
        currentBenchmark: signal,
        previousBenchmark: reference,
      });
      if (result.rs == null) continue;

      points.push({
        monthKey: signal.monthKey,
        signalDate: signal.date,
        stockReturnPct: result.stockReturnPct,
        benchmarkReturnPct: result.benchmarkReturnPct,
        rs: result.rs,
        rank: null, // rank is a universe-relative fact; not knowable here
        wasInTopN: false,
        flags: result.flags,
      });
    }
    out.set(lookbackMonths, points.reverse()); // ascending
  }

  return out;
}

/**
 * Rank a single month-end from raw inputs. Used by the snapshot builder so
 * that a stored snapshot and a live ranking cannot diverge in their method.
 */
export function rankAtMonthEnd({ stocks, stockMonthEndsBySymbol, signal, reference, topN = TOP_N }) {
  const rows = stocks.map(({ symbol, name }) => {
    const monthEnds = stockMonthEndsBySymbol.get(symbol);
    const current = monthEnds?.get(signal.monthKey);
    const previous = monthEnds?.get(reference.monthKey);
    if (!current || !previous) {
      return { symbol, name, rs: null, stockReturnPct: null, benchmarkReturnPct: null };
    }
    const result = computeStockRS({
      currentRecord: current,
      previousRecord: previous,
      currentBenchmark: signal,
      previousBenchmark: reference,
    });
    return { symbol, name, ...result };
  });

  const ranked = rankByRS(rows);
  return { ranked, ...selectTopN(ranked, topN) };
}

/**
 * MOMENTUM AGE — consecutive months a stock has held its Top-N place.
 *
 * WHAT THIS OWNS
 *   How long each current pick has been a pick, and when its current run began.
 *
 * WHAT THIS MUST NEVER DO
 *   Recompute a ranking. This is a PROJECTION of `rankingHistory`, which the
 *   backtest already produced by ranking the whole universe at every month-end.
 *   One reverse pass, no price lookups, no RS arithmetic — the same discipline
 *   as buildRSHistory, and for the same reason: a duplicated calculation is how
 *   two screens end up disagreeing about a number.
 *
 * WHY IT IS COUNTED BACKWARDS AND STOPS AT THE FIRST GAP
 *   The question is "how long has this run lasted", not "how many months in
 *   total". A stock that led in January, vanished, and returned in June has a
 *   run of one month, not two. Counting total appearances would describe a
 *   different thing and quietly overstate how established the momentum is.
 *
 * COST: O(months x topN). On 19 month-ends that is a few hundred set lookups.
 *
 * @param {object} args
 * @param {Array} args.rankingHistory  from runBacktest, ascending
 * @param {number} [args.topN]
 * @returns {Map<string, {consecutiveMonths:number, sinceMonthKey:string|null, isNewEntrant:boolean}>}
 */
export function computeMomentumAge({ rankingHistory = [], topN = TOP_N } = {}) {
  const ages = new Map();
  if (rankingHistory.length === 0) return ages;

  // Symbols still on an unbroken run as we walk backwards. A symbol leaves
  // this set the first month it is absent, and never re-enters — that is what
  // makes the count consecutive rather than cumulative.
  let alive = null;

  for (let i = rankingHistory.length - 1; i >= 0; i--) {
    const snapshot = rankingHistory[i];
    const inTop = new Set(
      snapshot.rankings.filter((r) => r.rank != null && r.rank <= topN).map((r) => r.symbol),
    );

    if (alive === null) {
      // The most recent rebalance seeds the set: only current picks have an age.
      alive = new Set(inTop);
      for (const symbol of alive) {
        ages.set(symbol, { consecutiveMonths: 1, sinceMonthKey: snapshot.monthKey, isNewEntrant: true });
      }
      continue;
    }

    for (const symbol of [...alive]) {
      if (!inTop.has(symbol)) {
        alive.delete(symbol);
        continue;
      }
      const age = ages.get(symbol);
      ages.set(symbol, {
        consecutiveMonths: age.consecutiveMonths + 1,
        sinceMonthKey: snapshot.monthKey,
        isNewEntrant: false,
      });
    }

    if (alive.size === 0) break; // nothing left to extend
  }

  return ages;
}

/**
 * The latest rebalance in three numbers: entered, continuing, exited.
 *
 * Derived from the change diff the engine already produced, so it introduces
 * no second count that could drift from the first.
 */
export function summariseRebalance({ changes, topN = TOP_N } = {}) {
  if (!changes?.hasBaseline) {
    return { available: false, entered: 0, continuing: 0, exited: 0 };
  }
  const entered = changes.entered?.length ?? 0;
  return {
    available: true,
    entered,
    // Whatever was not an entry was already there. Counting held symbols
    // separately would be a second source of truth for one fact.
    continuing: Math.max(0, topN - entered),
    exited: changes.exited?.length ?? 0,
    monthKey: changes.currentMonthKey ?? null,
  };
}
