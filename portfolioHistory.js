/**
 * PORTFOLIO HISTORY — what the reader's holdings have been worth, day by day.
 *
 * WHAT THIS OWNS
 *   Turning lots plus daily bars into two series: what the holdings are
 *   worth, and what they cost.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE RULE THAT SHAPES EVERYTHING HERE
 *
 * The series BEGINS AT THE FIRST PURCHASE and never a day earlier. It is
 * trivially easy to compute what a holding "would have been worth" in
 * January for someone who bought it in May — the prices are right there in
 * the same array — and it produces a chart that shows a gain the reader
 * never made. That is the single most misleading thing this file could do,
 * so the window is bounded by the reader's own dates rather than by the
 * data's.
 *
 * A LOT ENTERS THE SERIES ON ITS OWN PURCHASE DATE. Buying more on the 10th
 * must raise BOTH lines from the 10th — the value because the shares are
 * now owned, and the cost because the money is now spent. Adding the shares
 * without the cost would draw a jump in profit that was actually a purchase.
 *
 * MISSING BARS ARE CARRIED FORWARD, NOT INTERPOLATED. A stock that did not
 * trade on a given day is held at its last actual close, which is what the
 * position was genuinely worth. Interpolating between two closes would
 * invent a price that never printed. A holding with NO bar at or before a
 * date is excluded from that day's total and reported, rather than valued
 * at zero or at cost.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * @param {object} args
 * @param {Array} args.positions       lots: {symbol, quantity, purchasePrice, purchaseDate}
 * @param {Map<string, Array>} args.priceSeriesMap  symbol -> ascending daily bars
 * @param {Array} [args.calendarSeries] bars defining which dates are trading
 *   days — normally the benchmark's. Falls back to the union of held symbols.
 * @returns {{
 *   points: Array<{date: string, value: number, invested: number, gain: number}>,
 *   startDate: string|null,
 *   unpriceable: string[],
 *   hasHistory: boolean,
 * }}
 */
export function buildPortfolioHistory({ positions = [], priceSeriesMap = new Map(), calendarSeries = null } = {}) {
  const lots = positions.filter(
    (lot) =>
      lot?.symbol &&
      Number.isFinite(lot.quantity) &&
      lot.quantity > 0 &&
      Number.isFinite(lot.purchasePrice) &&
      typeof lot.purchaseDate === 'string',
  );

  if (lots.length === 0) {
    return { points: [], startDate: null, unpriceable: [], hasHistory: false };
  }

  // ISO dates compare correctly as strings, so no parsing is needed anywhere.
  const startDate = lots.reduce((earliest, lot) => (lot.purchaseDate < earliest ? lot.purchaseDate : earliest), lots[0].purchaseDate);

  const symbols = [...new Set(lots.map((lot) => lot.symbol))];
  const unpriceable = symbols.filter((symbol) => !(priceSeriesMap.get(symbol)?.length > 0));

  /** Closing price lookups, keyed by date, per symbol. */
  const closesBySymbol = new Map();
  for (const symbol of symbols) {
    const bars = priceSeriesMap.get(symbol) ?? [];
    const byDate = new Map();
    for (const bar of bars) {
      const close = bar.adjClose ?? bar.close ?? null;
      if (Number.isFinite(close)) byDate.set(bar.date, close);
    }
    closesBySymbol.set(symbol, byDate);
  }

  // Which dates to plot. The benchmark defines the trading calendar when it
  // is available; otherwise every date any held stock traded on.
  const calendar =
    calendarSeries?.length > 0
      ? calendarSeries.map((bar) => bar.date)
      : [...new Set(symbols.flatMap((symbol) => (priceSeriesMap.get(symbol) ?? []).map((bar) => bar.date)))].sort();

  const dates = calendar.filter((date) => date >= startDate);

  /** Last actual close at or before a date. Carried forward, never guessed. */
  const lastClose = new Map();
  const points = [];

  for (const date of dates) {
    let value = 0;
    let invested = 0;
    let valuedEverything = true;

    for (const lot of lots) {
      // Not owned yet on this date — contributes nothing to either line.
      if (lot.purchaseDate > date) continue;

      invested += lot.quantity * lot.purchasePrice;

      const onThisDate = closesBySymbol.get(lot.symbol)?.get(date);
      if (Number.isFinite(onThisDate)) lastClose.set(lot.symbol, onThisDate);

      const price = lastClose.get(lot.symbol);
      if (Number.isFinite(price)) value += lot.quantity * price;
      else valuedEverything = false;
    }

    // A day where something owned could not be priced is omitted entirely.
    // Plotting a partial total would draw a cliff on the value line that
    // looks like a crash and is actually a missing bar.
    if (invested > 0 && valuedEverything) {
      points.push({ date, value, invested, gain: value - invested });
    }
  }

  return {
    points,
    startDate,
    unpriceable,
    // Two points is a line between two dots, not a history.
    hasHistory: points.length >= 3,
  };
}
