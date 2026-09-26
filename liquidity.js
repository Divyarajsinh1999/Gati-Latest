/**
 * CAN THIS ORDER ACTUALLY BE FILLED? (D24)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE SIMULATOR SIZES WHOLE SHARES WITHOUT ASKING WHETHER ANYONE IS SELLING.
 *
 * At ₹50,000 spread over five stocks this never matters. At ₹5,00,000 in a
 * smallcap that trades ₹40 lakh a day it does: an order worth a meaningful
 * slice of a day's turnover moves the price against the buyer before it
 * fills, and the fill price is not the price the ranking was computed from.
 *
 * MEASURED AGAINST TRADED VALUE, NOT SHARE COUNT. Volume in shares is
 * meaningless across stocks — 10 lakh shares of a ₹40 stock and 10 lakh of a
 * ₹4,000 stock are two completely different markets. Value (volume x price)
 * is the only comparable figure, and it is what the order competes for.
 *
 * THE THRESHOLDS ARE JUDGEMENT, SO THEY ARE NAMED AND EXPORTED RATHER THAN
 * BURIED. Institutional desks commonly treat a few percent of average daily
 * value as the point where an order needs working rather than simply placed.
 * For a retail reader Gati flags at 1% and warns harder at 5% — deliberately
 * conservative, because the cost of an unnecessary caution is a moment's
 * thought and the cost of a missing one is a bad fill on every rebalance.
 *
 * A SINGLE DAY'S VOLUME IS NOT AN AVERAGE, and Gati says so rather than
 * pretending. The current momentum row carries the latest bar's volume, which
 * on a quiet day understates liquidity and on a news day overstates it. The
 * result is labelled `basis: 'latest'` so the UI can qualify the claim
 * instead of presenting one session as typical.
 *
 * WHAT THIS IS NOT: a tradeability score. D15/C5 stands. It reports a
 * percentage of a day's turnover and leaves the reader to judge it.
 * ═══════════════════════════════════════════════════════════════════════
 */

/** Order value as a share of average daily traded value, in percent. */
export const LIQUIDITY_THRESHOLDS = {
  /** Below this, an order is noise in the day's flow. Nothing is shown. */
  noticePct: 1,
  /** Above this, the order is a material part of the day's turnover. */
  warnPct: 5,
};

/**
 * Assess one order against a stock's traded value.
 *
 * @param {object} args
 * @param {number} args.orderValue   rupees being placed in this stock
 * @param {number} args.volume       shares traded in the reference session
 * @param {number} args.price        price used to value that volume
 * @returns {null | {sharePct:number,dailyValue:number,severity:'ok'|'notice'|'warn',
 *                   basis:'latest'}}
 */
export function assessLiquidity({ orderValue, volume, price } = {}) {
  /*
    Missing volume returns null, never zero and never "fine". A stock whose
    volume did not come back is one this cannot speak about, and a silent
    pass would be the app calculating around a gap.
  */
  if (!Number.isFinite(orderValue) || orderValue <= 0) return null;
  if (!Number.isFinite(volume) || volume <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  const dailyValue = volume * price;
  const sharePct = (orderValue / dailyValue) * 100;

  const severity = sharePct >= LIQUIDITY_THRESHOLDS.warnPct
    ? 'warn'
    : sharePct >= LIQUIDITY_THRESHOLDS.noticePct
      ? 'notice'
      : 'ok';

  return { sharePct, dailyValue, severity, basis: 'latest' };
}

/**
 * Assess a whole set of sized positions.
 *
 * Returns the worst case and how many positions are affected, because the
 * reader acts on the portfolio rather than on one line — and one illiquid
 * name out of five is the thing worth surfacing.
 *
 * @param {{symbol:string,name?:string,orderValue:number,volume:number,price:number}[]} positions
 */
export function assessPortfolioLiquidity(positions = []) {
  const rows = (Array.isArray(positions) ? positions : [])
    .map((p) => ({ ...p, liquidity: assessLiquidity(p) }))
    .filter((p) => p.liquidity != null);

  /*
    Positions whose volume is unknown are counted separately rather than
    treated as liquid. Three unmeasurable names must not read as "all clear",
    for the same reason an unclassified sector is not "diversified".
  */
  const unknownCount = (Array.isArray(positions) ? positions.length : 0) - rows.length;

  if (rows.length === 0) {
    return { flagged: [], worst: null, unknownCount, hasConcern: false };
  }

  const flagged = rows
    .filter((r) => r.liquidity.severity !== 'ok')
    .sort((a, b) => b.liquidity.sharePct - a.liquidity.sharePct);

  const worst = rows.reduce((a, b) => (b.liquidity.sharePct > a.liquidity.sharePct ? b : a));

  return {
    flagged,
    worst,
    unknownCount,
    hasConcern: flagged.length > 0,
  };
}
