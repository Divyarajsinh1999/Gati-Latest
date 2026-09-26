/**
 * CHANGE DETECTION — what moved since the last completed rebalance.
 *
 * WHAT THIS OWNS
 *   Diffing two consecutive month-end rankings into entries, exits and rank
 *   movements, plus how far the current month is from the next rebalance.
 *
 * WHAT THIS MUST NEVER DO
 *   Track individual users. The baseline is the LAST COMPLETED REBALANCE
 *   (decision A9), which is deterministic, identical for everyone, and
 *   requires no visit history. "Since your last visit" would need per-user
 *   state that this product deliberately does not keep.
 *
 * WHY THIS EXISTS
 *   Of the five questions the product is built to answer, "what changed?" had
 *   no supporting feature at all. Everything needed was already in the
 *   ranking data — it had simply never been diffed.
 *
 * PERFORMANCE
 *   Two snapshots, two map builds, one linear pass. O(universe), no price
 *   lookups, no RS arithmetic. It runs on data the backtest already produced.
 */

import { TOP_N } from '../config/constants.js';

/**
 * @param {object} args
 * @param {Array} args.rankingHistory  from runBacktest, ascending
 * @param {number} [args.topN]
 * @param {number} [args.significantRankMove] minimum places to be worth reporting
 * @returns {{
 *   hasBaseline:boolean, currentMonthKey:string|null, previousMonthKey:string|null,
 *   entered:Array, exited:Array, biggestMoves:Array, changeCount:number
 * }}
 */
export function detectChanges({ rankingHistory = [], topN = TOP_N, significantRankMove = 5 } = {}) {
  const empty = {
    hasBaseline: false,
    currentMonthKey: null,
    previousMonthKey: null,
    currentDate: null,
    entered: [],
    exited: [],
    biggestMoves: [],
    changeCount: 0,
  };

  // One snapshot is not a comparison. Saying "no changes" here would be a
  // claim we cannot support — there is nothing to compare against yet.
  if (rankingHistory.length < 2) return empty;

  const current = rankingHistory[rankingHistory.length - 1];
  const previous = rankingHistory[rankingHistory.length - 2];

  const prevByCurrentSymbol = new Map(previous.rankings.map((r) => [r.symbol, r]));
  const currentBySymbol = new Map(current.rankings.map((r) => [r.symbol, r]));

  const inTop = (row) => row?.rank != null && row.rank <= topN;

  const entered = [];
  const exited = [];
  const moves = [];

  for (const row of current.rankings) {
    const before = prevByCurrentSymbol.get(row.symbol);

    if (inTop(row) && !inTop(before)) {
      entered.push({
        symbol: row.symbol,
        name: row.name,
        rank: row.rank,
        rs: row.rs,
        previousRank: before?.rank ?? null,
      });
    }

    if (before?.rank != null && row.rank != null) {
      // Positive means improved: rank 1 is best, so a falling number is a
      // rise. The raw difference would read backwards to everyone.
      const change = before.rank - row.rank;
      if (Math.abs(change) >= significantRankMove) {
        moves.push({
          symbol: row.symbol,
          name: row.name,
          from: before.rank,
          to: row.rank,
          change,
          rs: row.rs,
        });
      }
    }
  }

  for (const row of previous.rankings) {
    if (!inTop(row)) continue;
    const after = currentBySymbol.get(row.symbol);
    if (!inTop(after)) {
      exited.push({
        symbol: row.symbol,
        name: row.name,
        previousRank: row.rank,
        // null means the stock left the ranking entirely — delisted, renamed,
        // or its data went missing. Materially different from "slipped to 40th".
        rank: after?.rank ?? null,
        rs: after?.rs ?? null,
      });
    }
  }

  moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return {
    hasBaseline: true,
    currentMonthKey: current.monthKey,
    previousMonthKey: previous.monthKey,
    currentDate: current.date,
    entered,
    exited,
    biggestMoves: moves.slice(0, 5),
    // Entries and exits pair up at a rebalance, so counting both would double
    // every change. The headline is how many holdings turned over.
    changeCount: Math.max(entered.length, exited.length),
  };
}

/**
 * Trading days remaining until the next month-end signal.
 *
 * Counted from the actual series rather than the calendar, so it is correct
 * across weekends and market holidays without consulting a holiday list. A
 * null result means the answer is genuinely unknown — the data does not
 * extend far enough — which is different from zero.
 */
export function tradingDaysToRebalance(benchmarkSeries = [], asOfDate = null) {
  if (benchmarkSeries.length === 0) return null;
  const last = benchmarkSeries[benchmarkSeries.length - 1];
  const asOf = asOfDate ?? last.date;
  const currentMonth = asOf.slice(0, 7);

  const remaining = benchmarkSeries.filter((b) => b.date > asOf && b.date.slice(0, 7) === currentMonth);

  // The series ends today, so future sessions in this month are not yet
  // present. Report unknown rather than implying the month ends today.
  if (remaining.length === 0 && last.date === asOf) return null;
  return remaining.length;
}
