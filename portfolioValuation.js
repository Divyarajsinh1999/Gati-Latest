/**
 * PORTFOLIO VALUATION — the user's own holdings, marked to market.
 *
 * WHAT THIS OWNS
 *   Turning manually-entered positions plus current prices into value, P&L,
 *   weight and today's move.
 *
 * WHAT THIS MUST NEVER DO
 *   Touch a strategy figure. The model's record and the user's record are two
 *   different numbers answering two different questions, and blending them
 *   destroys both. Nothing here is ever fed into a backtest, a ranking, or an
 *   equity curve.
 *
 * WHY IT SHIPS NOW, AHEAD OF ITS SCREEN
 *   The maths is pure and independently testable, and it belongs with the
 *   other engines while the conventions are fresh. The Portfolio screen
 *   arrives later; when it does, it is composition rather than new logic.
 *
 * THE RULE THAT MATTERS MOST HERE
 *   An unpriced position is EXCLUDED from the totals and reported as excluded.
 *   It is never valued at zero (which would fabricate a total loss) and never
 *   valued at cost (which would fabricate a break-even). Either would be a
 *   number the data does not support, presented with the same confidence as
 *   one that is.
 */

/**
 * @param {object} args
 * @param {Array} args.positions  { id, symbol, name, quantity, purchasePrice, purchaseDate, universeKey }
 * @param {Map<string, {price:number|null, changePct:number|null}>} args.priceBySymbol
 * @returns {{
 *   positions:Array, totals:object, excluded:Array, hasExclusions:boolean
 * }}
 */
export function valuePortfolio({ positions = [], priceBySymbol = new Map() } = {}) {
  const priced = [];
  const excluded = [];

  for (const position of positions) {
    const quote = priceBySymbol.get(position.symbol);
    const price = quote?.price ?? null;
    const invested = position.quantity * position.purchasePrice;

    if (price == null || !(price > 0)) {
      excluded.push({
        ...position,
        invested,
        reason: 'No current price available',
      });
      continue;
    }

    const currentValue = position.quantity * price;
    const pnl = currentValue - invested;
    const dayChangePct = quote?.changePct ?? null;

    // Today's rupee move, derived from the percentage rather than from a
    // previous close we may not hold. Guarded against the -100% edge, where
    // the denominator would be zero.
    const todaysChange =
      dayChangePct != null && 100 + dayChangePct !== 0
        ? currentValue - currentValue / (1 + dayChangePct / 100)
        : null;

    priced.push({
      ...position,
      currentPrice: price,
      invested,
      currentValue,
      pnl,
      pnlPct: invested > 0 ? (pnl / invested) * 100 : null,
      dayChangePct,
      todaysChange,
      weightPct: null, // filled below, once the denominator is known
    });
  }

  const totalInvested = priced.reduce((sum, p) => sum + p.invested, 0);
  const totalValue = priced.reduce((sum, p) => sum + p.currentValue, 0);
  const totalTodaysChange = priced.reduce((sum, p) => sum + (p.todaysChange ?? 0), 0);

  // Weight is share of CURRENT value, not of cost. A holding that has doubled
  // occupies twice the risk it did at purchase, and that is what a weight is
  // supposed to tell you.
  for (const p of priced) {
    p.weightPct = totalValue > 0 ? (p.currentValue / totalValue) * 100 : null;
  }

  priced.sort((a, b) => b.currentValue - a.currentValue);

  return {
    positions: priced,
    excluded,
    hasExclusions: excluded.length > 0,
    totals: {
      positionCount: priced.length,
      excludedCount: excluded.length,
      invested: totalInvested,
      currentValue: totalValue,
      pnl: totalValue - totalInvested,
      pnlPct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null,
      todaysChange: totalTodaysChange,
      todaysChangePct:
        totalValue - totalTodaysChange > 0 ? (totalTodaysChange / (totalValue - totalTodaysChange)) * 100 : null,
    },
  };
}

/**
 * Annotate positions with their standing in the current model ranking.
 *
 * This is the feature's real value: it connects what the user OWNS to what
 * the model currently SAYS. It reports status only — it never merges the two
 * sets of numbers.
 */
export function annotateWithRanking({ positions = [], ranked = [], topN = 5 } = {}) {
  const bySymbol = new Map(ranked.map((r) => [r.symbol, r]));
  return positions.map((position) => {
    const row = bySymbol.get(position.symbol);
    let topFiveStatus;
    if (!row || row.rank == null) topFiveStatus = 'unknown';
    else if (row.rank <= topN) topFiveStatus = 'in-top-n';
    else topFiveStatus = 'dropped-out';

    return {
      ...position,
      currentRank: row?.rank ?? null,
      currentRS: row?.rs ?? null,
      topFiveStatus,
    };
  });
}

/**
 * Aggregate several lots of the same symbol into one line at weighted-average
 * cost. The store keeps lots separate (a second purchase must never mutate the
 * first), so combining them is a presentation concern and lives here.
 */
export function aggregateLots(positions = []) {
  const bySymbol = new Map();
  for (const p of positions) {
    const existing = bySymbol.get(p.symbol);
    if (!existing) {
      bySymbol.set(p.symbol, { ...p, lotCount: 1 });
      continue;
    }
    const totalQty = existing.quantity + p.quantity;
    const totalCost = existing.quantity * existing.purchasePrice + p.quantity * p.purchasePrice;
    bySymbol.set(p.symbol, {
      ...existing,
      quantity: totalQty,
      purchasePrice: totalCost / totalQty,
      purchaseDate: existing.purchaseDate < p.purchaseDate ? existing.purchaseDate : p.purchaseDate,
      lotCount: existing.lotCount + 1,
    });
  }
  return [...bySymbol.values()];
}
