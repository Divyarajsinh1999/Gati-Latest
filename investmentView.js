/**
 * INVESTMENT VIEW MODEL — one stock's holding, shaped for display.
 *
 * WHAT THIS OWNS
 *   Combining a reader's purchase lots into a single line and marking it to
 *   market. Selecting and labelling only.
 *
 * WHAT THIS MUST NEVER DO
 *   Invent a value. With no current price this reports the cost and says the
 *   value is unavailable — it never marks the holding at cost, which would
 *   fabricate a break-even, nor at zero, which would fabricate a wipeout.
 *   Both are numbers the data does not support, and both would be rendered
 *   with exactly the same confidence as a real one.
 *
 * WHY THE LOTS STAY SEPARATE UNDERNEATH
 *   `aggregateLots` combines at weighted-average cost for DISPLAY. The store
 *   keeps every purchase as its own record, because a second buy must never
 *   mutate the first — the reader has to be able to correct the price they
 *   entered for one lot without disturbing another.
 */

import { aggregateLots } from '../engine/portfolioValuation.js';
import { assessLiquidity } from '../engine/liquidity.js';

/**
 * @param {object} args
 * @param {Array} args.lots            purchase records for ONE symbol
 * @param {number|null} args.currentPrice
 * @returns {null|{
 *   quantity:number, averageCost:number, lotCount:number, firstPurchase:string,
 *   invested:number, currentValue:number|null, gain:number|null, gainPct:number|null,
 *   canValue:boolean
 * }}
 */
export function selectInvestment({ lots = [], currentPrice = null, volume = null } = {}) {
  if (lots.length === 0) return null;

  const [combined] = aggregateLots(lots);
  const invested = combined.quantity * combined.purchasePrice;
  const canValue = typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0;
  const currentValue = canValue ? combined.quantity * currentPrice : null;

  return {
    quantity: combined.quantity,
    averageCost: combined.purchasePrice,
    lotCount: combined.lotCount,
    firstPurchase: combined.purchaseDate,
    invested,
    canValue,
    currentValue,
    // Both null together, always. A gain figure with no current value would
    // have to invent one of its two operands.
    /*
      LIQUIDITY (D24), measured against what this position is actually worth.

      D26 originally placed this in the "Investment Simulator" — but v1.4.0
      removed the whole-portfolio simulator entirely, and investment became a
      property of a STOCK entered on its detail screen. So the placement moved
      to where an amount is really decided; the decision's intent is
      unchanged, only the screen it named still existed on paper.

      Judged on CURRENT VALUE rather than on what was paid, because that is
      the sum that would have to find a buyer today.
    */
    liquidity: assessLiquidity({
      orderValue: currentValue ?? invested,
      volume,
      price: currentPrice,
    }),

    gain: currentValue == null ? null : currentValue - invested,
    gainPct: currentValue == null || !(invested > 0) ? null : ((currentValue - invested) / invested) * 100,
  };
}
