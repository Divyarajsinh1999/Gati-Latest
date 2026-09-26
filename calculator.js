import { buildPositions } from './portfolio.js';
import { EXECUTION_PRICE_FIELD } from '../config/constants.js';

/**
 * Capital-calculator math (spec Section 26).
 *
 * Lives here rather than inside CapitalCalculatorPanel because spec
 * Section 34 lists "UI components performing financial calculations" as
 * something to avoid, and because P&L arithmetic should be unit-tested
 * rather than verified by squinting at a rendered page.
 *
 * Deliberately basis-AGNOSTIC: it takes holdings that already carry an
 * `entryPrice` and a `markPrice` and does nothing but size the positions
 * and mark them. Choosing what those prices *mean* is the caller's job,
 * because that choice is where look-ahead bias creeps in and it deserves
 * to be explicit at the call site rather than buried behind a flag here.
 * See CapitalCalculatorPanel for the two bases it offers and why.
 *
 * Holdings missing a usable price are excluded rather than defaulted to
 * zero (spec Section 41: flag, don't silently substitute), and the excluded
 * count is returned so the UI can say so.
 *
 * @param {Array<{symbol:string,name?:string,entryPrice:number,markPrice:number}>} holdings
 * @param {number} capital
 */
export function computeCalculatorResult({ holdings = [], capital = 0 } = {}) {
  const usable = [];
  let excluded = 0;

  for (const holding of holdings) {
    const { entryPrice, markPrice } = holding;
    if (!(entryPrice > 0) || !(markPrice > 0)) {
      excluded += 1;
      continue;
    }
    usable.push(holding);
  }

  if (usable.length === 0 || !(capital > 0)) {
    return {
      positions: [],
      totalInvested: 0,
      remainingCash: capital,
      portfolioValue: capital,
      pnl: 0,
      returnPct: 0,
      pricedCount: 0,
      excludedCount: excluded,
    };
  }

  const { positions, totalInvested, remainingCash } = buildPositions(usable, capital);

  const markBySymbol = new Map(usable.map((h) => [h.symbol, h.markPrice]));
  const holdingsValue = positions.reduce(
    (sum, pos) => sum + pos.shares * (markBySymbol.get(pos.symbol) ?? pos.entryPrice),
    0,
  );
  const portfolioValue = holdingsValue + remainingCash;

  return {
    positions,
    totalInvested,
    remainingCash,
    portfolioValue,
    pnl: portfolioValue - capital,
    returnPct: ((portfolioValue - capital) / capital) * 100,
    pricedCount: usable.length,
    excludedCount: excluded,
  };
}

/**
 * Holdings for the "buy today's Top 5" basis: entry and mark are both the
 * current price, so P&L is zero. That is the honest answer for a purchase
 * you haven't made yet, not a placeholder.
 */
export function holdingsFromCurrentPicks(picks = []) {
  return picks.map((p) => ({
    symbol: p.symbol,
    name: p.name,
    entryPrice: p.currentPrice,
    markPrice: p.currentPrice,
  }));
}

/**
 * Holdings for the "strategy's open position" basis, scaled to the user's
 * own capital.
 *
 * WHY THIS REPLACED AN EARLIER "held since last month-end" MODE:
 * that mode took *today's* Top 5 and priced them at the previous month-end
 * close. It looked useful and was quietly wrong — today's Top 5 are the top
 * 5 precisely *because* they rose this month, so back-dating their entry
 * manufactures a gain nobody could have captured. Classic look-ahead bias,
 * which spec Section 40 forbids outright, and it would have flattered the
 * strategy every single month.
 *
 * This uses the position the backtest *actually* holds: selected from the
 * PRIOR month-end ranking and entered at the following trading day's price,
 * per the Section 15 execution convention. Marking that to the current
 * price gives a real, achievable month-to-date figure.
 *
 * @param {Array} positions  backtest.currentHolding.positions (carry entryPrice)
 * @param {Map<string, number>} currentPriceBySymbol
 */
export function holdingsFromStrategyPosition(positions = [], currentPriceBySymbol = new Map()) {
  return positions.map((p) => ({
    symbol: p.symbol,
    name: p.name,
    entryPrice: p.entryPrice,
    markPrice: currentPriceBySymbol.get(p.symbol) ?? null,
  }));
}

/**
 * Holdings for the "as if I had bought on a date I choose" basis
 * (spec Section 26; ROADMAP Phase 3.2).
 *
 * THE WHOLE DIFFICULTY IS *WHICH* FIVE STOCKS, NOT WHICH PRICES.
 * The obvious implementation — take today's Top 5 and price them at the
 * chosen past date — is precisely the look-ahead bug that got the earlier
 * "held since last month-end" mode deleted (see the note above). Today's
 * Top 5 are today's Top 5 *because* they rose since that date; back-dating
 * their entry manufactures a gain nobody could have captured, and it would
 * flatter every date the user picks.
 *
 * So the picks come from the last month-end ranking STRICTLY BEFORE the
 * chosen date — the most recent selection that was actually knowable on
 * that morning — and are entered at the first trading bar on or after it,
 * using the same `open` execution-price convention as the backtest
 * (spec Section 15). Mark is the current price.
 *
 * Returns `{ holdings, signalMonthKey, entryDate, reason }`. On failure
 * `holdings` is empty and `reason` explains which condition failed, so the
 * UI can say why rather than rendering a silently empty table
 * (spec Section 41).
 *
 * @param {Object} args
 * @param {Array} args.rankingHistory   backtest.rankingHistory — one snapshot per signal date
 * @param {Map<string, Array>} args.priceSeriesMap  symbol -> ascending daily records
 * @param {Map<string, number>} args.currentPriceBySymbol
 * @param {string} args.date            chosen entry date, ISO 'YYYY-MM-DD'
 * @param {number} args.topN
 */
export function holdingsFromChosenDate({
  rankingHistory = [],
  priceSeriesMap = new Map(),
  currentPriceBySymbol = new Map(),
  date,
  topN = 5,
} = {}) {
  const empty = (reason) => ({ holdings: [], signalMonthKey: null, entryDate: null, reason });

  if (!date) return empty('Choose a date to see what buying on that day would have looked like.');

  // Strictly before: a ranking computed AT the chosen date's close was not
  // knowable when the market opened that day.
  const priorSnapshots = rankingHistory.filter((s) => s.date < date);
  if (priorSnapshots.length === 0) {
    return empty(
      `No completed month-end ranking exists before ${date}, so there is no selection that would have been knowable on that day.`,
    );
  }
  const signal = priorSnapshots[priorSnapshots.length - 1];

  const picks = (signal.rankings ?? []).filter((r) => r.rank != null && r.rank <= topN);
  if (picks.length === 0) return empty(`The ${signal.monthKey} ranking produced no eligible picks.`);

  const holdings = [];
  for (const pick of picks) {
    const series = priceSeriesMap.get(pick.symbol) ?? [];
    // First bar ON OR AFTER the chosen date — if the user picks a weekend
    // or holiday, entry is the next day the market actually opened, which
    // is what would really have happened.
    const bar = series.find((r) => r.date >= date);
    const entryPrice = typeof bar?.[EXECUTION_PRICE_FIELD] === 'number' && bar[EXECUTION_PRICE_FIELD] > 0
      ? bar[EXECUTION_PRICE_FIELD]
      : null;
    holdings.push({
      symbol: pick.symbol,
      name: pick.name,
      entryPrice,
      markPrice: currentPriceBySymbol.get(pick.symbol) ?? null,
      entryDate: bar?.date ?? null,
    });
  }

  // computeCalculatorResult already drops unpriced holdings and reports the
  // count, so no filtering here — that keeps "flag, don't silently
  // substitute" in exactly one place.
  const entryDate = holdings.find((h) => h.entryDate)?.entryDate ?? null;
  return { holdings, signalMonthKey: signal.monthKey, entryDate, reason: null };
}
