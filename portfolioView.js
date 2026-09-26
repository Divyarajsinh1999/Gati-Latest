/**
 * PORTFOLIO VIEW MODEL.
 *
 * WHAT THIS OWNS
 *   Shaping valued positions for the screen.
 *
 * WHAT THIS MUST NEVER DO
 *   Mix the user's holdings into a strategy figure. They are two different
 *   numbers answering two different questions, and blending them destroys
 *   both — the record would stop being capital-independent, and the user's
 *   return would stop being theirs.
 *
 *   Everything here is computed by `engine/portfolioValuation`, which shipped
 *   in M3 and knows nothing about screens.
 */

import { valuePortfolio, annotateWithRanking, aggregateLots } from '../engine/portfolioValuation.js';
import { buildPortfolioHistory } from '../engine/portfolioHistory.js';
import { formatINR, formatPct } from '../utils/formatters.js';
import { TOP_N } from '../config/constants.js';

const TOP_STATUS = {
  'in-top-n': { label: 'In Top 5', tone: 'gain' },
  'dropped-out': { label: 'No longer in Top 5', tone: 'warn' },
  unknown: { label: null, tone: 'neutral' },
};

/**
 * @param {object} args
 * @param {Array} args.positions        raw stored positions
 * @param {Map} args.priceBySymbol      symbol -> { price, changePct }
 * @param {Array} [args.ranked]         current ranking, for Top-5 status
 * @param {boolean} [args.combineLots]  aggregate repeat purchases of one stock
 */
export function selectPortfolioView({ positions = [], priceBySymbol = new Map(), ranked = [], combineLots = true }) {
  if (positions.length === 0) {
    return { isEmpty: true, positions: [], excluded: [], totals: null, hasExclusions: false };
  }

  // Lots are stored separately — a second purchase must never mutate the
  // first — and combined only for display, at weighted-average cost.
  const rows = combineLots ? aggregateLots(positions) : positions;

  const valued = valuePortfolio({ positions: rows, priceBySymbol });
  const annotated = annotateWithRanking({ positions: valued.positions, ranked });

  return {
    isEmpty: false,
    positions: annotated.map((position) => ({
      ...position,
      valueLabel: formatINR(position.currentValue),
      investedLabel: formatINR(position.invested),
      pnlLabel: formatINR(position.pnl),
      pnlPctLabel: formatPct(position.pnlPct),
      direction: position.pnl >= 0 ? 'gain' : 'loss',
      weightLabel: position.weightPct == null ? null : `${position.weightPct.toFixed(1)}%`,
      dayChangeLabel: position.dayChangePct == null ? null : formatPct(position.dayChangePct),
      dayDirection: position.dayChangePct == null ? null : position.dayChangePct >= 0 ? 'gain' : 'loss',
      status: TOP_STATUS[position.topFiveStatus] ?? TOP_STATUS.unknown,
      lotLabel: position.lotCount > 1 ? `${position.lotCount} purchases` : null,
    })),

    // Unpriced holdings are EXCLUDED and reported, never valued at zero (which
    // fabricates a total loss) or at cost (which fabricates a break-even).
    excluded: valued.excluded.map((position) => ({
      ...position,
      investedLabel: formatINR(position.invested),
    })),
    hasExclusions: valued.hasExclusions,

    totals: {
      ...valued.totals,
      investedLabel: formatINR(valued.totals.invested),
      valueLabel: formatINR(valued.totals.currentValue),
      pnlLabel: formatINR(valued.totals.pnl),
      pnlPctLabel: formatPct(valued.totals.pnlPct),
      direction: valued.totals.pnl >= 0 ? 'gain' : 'loss',
      todaysChangeLabel: formatINR(valued.totals.todaysChange),
      todaysDirection: valued.totals.todaysChange >= 0 ? 'gain' : 'loss',
    },
  };
}

/**
 * The compact summary shown inside a universe.
 *
 * Returns null when the user holds nothing in this universe, so the block
 * renders NOTHING rather than an empty prompt. Someone who does not want
 * portfolio tracking should never be nagged into it (Phase 1 §8.1).
 */
/**
 * THE REBALANCE ACTION LIST — the difference between what is held and what
 * the rule currently picks (D23).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SUBTRACTION, NOT ADVICE.
 *
 * The owner had to ask, in conversation, "when do I buy, and what?" — and the
 * app held both halves of the answer and joined them nowhere: his positions
 * on one screen, the Top 5 on another.
 *
 * This states three groups and nothing else:
 *     held and still ranked      — no action implied
 *     held and no longer ranked
 *     ranked and not held
 *
 * NO QUANTITIES, NO ORDER VALUES, NO "BUY NOW". The Investment Simulator
 * sizes positions; this compares two lists. The moment it produces amounts it
 * stops being an observation and becomes a recommendation.
 *
 * NOT THE REBALANCE COUNTDOWN REJECTED UNDER D15/C6. No clock, no deadline.
 * The caller passes `isMonthComplete` and this reports it, because a
 * mid-month Top 5 is PROVISIONAL — and this list looks identical on the 3rd
 * and the 30th, which would quietly invite acting on a ranking the strategy
 * has not acted on.
 *
 * SCOPED TO ONE UNIVERSE, and that is a correctness constraint rather than a
 * layout choice. Rank is not unique across universes: each has its own rank 1,
 * so a `rank <= 5` test over rows from all three describes FIFTEEN stocks. A
 * caller passing a flat list would get an action list that looked entirely
 * plausible and told the reader to buy ten stocks that were never picked.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * @param {object}   args
 * @param {object[]} args.positions        lot-shaped, unfiltered
 * @param {string}   args.universeKey
 * @param {object[]} args.ranked           ranking for THIS universe only
 * @param {Map}      args.priceBySymbol
 * @param {boolean}  args.isMonthComplete  is the signal final or provisional
 * @param {number}   args.topN
 */
export function selectRebalanceActions({
  positions = [],
  universeKey,
  ranked = [],
  priceBySymbol = new Map(),
  isMonthComplete = false,
  topN = TOP_N,
} = {}) {
  const topFive = (Array.isArray(ranked) ? ranked : [])
    .filter((r) => r?.rank != null && r.rank <= topN);

  /*
    No ranking means there is nothing to compare against — a failed fetch must
    never render as "sell everything, buy nothing". Distinct from holding
    nothing, which is a real state with a real answer.
  */
  if (topFive.length === 0) return null;

  const mine = positions.filter((p) => p.universeKey === universeKey);
  const view = selectPortfolioView({ positions: mine, priceBySymbol, ranked });
  const held = view.isEmpty ? [] : view.positions;
  const heldSymbols = new Set(held.map((p) => p.symbol));

  const stillRanked = held.filter((p) => p.topFiveStatus === 'in-top-n');
  const noLongerRanked = held.filter((p) => p.topFiveStatus === 'dropped-out');

  /*
    Unknown status is NOT folded into "no longer ranked". It means the stock is
    absent from the ranking entirely — delisted, renamed, or a data gap — and
    implying a sell on the strength of a missing row would be acting on absent
    data, which the standing rules forbid outright.
  */
  const unranked = held.filter((p) => p.topFiveStatus === 'unknown');

  const notHeld = topFive
    .filter((r) => !heldSymbols.has(r.symbol))
    .map((r) => ({ symbol: r.symbol, name: r.name ?? r.symbol, rank: r.rank, sector: r.sector ?? null }));

  const hasDifference = noLongerRanked.length > 0 || notHeld.length > 0;

  return {
    universeKey,
    isMonthComplete,
    stillRanked,
    noLongerRanked,
    notHeld,
    unranked,
    hasDifference,
    holdsNothing: held.length === 0,
    /*
      One sentence naming what the reader is looking at. Composed here so every
      surface says it identically, and worded as a STATE rather than an
      instruction — "2 no longer ranked", never "sell 2 holdings".
    */
    summary: held.length === 0
      ? `You hold none of the current Top ${topN} in this universe.`
      : hasDifference
        ? `${stillRanked.length} of your ${held.length} still ranked · `
          + `${noLongerRanked.length} no longer ranked · ${notHeld.length} ranked but not held`
        : `Your holdings match the current Top ${topN}.`,
  };
}

export function selectUniversePositions({ positions = [], universeKey, priceBySymbol = new Map(), ranked = [] }) {
  const mine = positions.filter((p) => p.universeKey === universeKey);
  if (mine.length === 0) return null;

  const view = selectPortfolioView({ positions: mine, priceBySymbol, ranked });
  if (view.isEmpty) return null;

  return {
    count: view.positions.length,
    valueLabel: view.totals.valueLabel,
    pnlLabel: view.totals.pnlLabel,
    pnlPctLabel: view.totals.pnlPctLabel,
    direction: view.totals.direction,
    droppedOut: view.positions.filter((p) => p.topFiveStatus === 'dropped-out').length,
  };
}


/**
 * The portfolio's value history, shaped for the chart.
 *
 * A thin pass-through, and it exists for a reason the lint rule states
 * plainly: screens must not calculate. The screen was importing the engine
 * directly, which is how one component ends up with arithmetic another
 * component would have to duplicate.
 *
 * Takes RAW LOTS, never the aggregated rows — a second purchase has to
 * enter the series on its own date rather than on the first one's.
 */
export function selectPortfolioHistory({ positions = [], seriesBySymbol, calendarSeries } = {}) {
  return buildPortfolioHistory({ positions, priceSeriesMap: seriesBySymbol, calendarSeries });
}
