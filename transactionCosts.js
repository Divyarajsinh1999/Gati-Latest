import { TRANSACTION_COSTS } from '../config/constants.js';

/**
 * Applies the configured cost schedule to one side of a trade (buy or
 * sell), returning the cost breakdown in rupees. Returns all zeros when
 * `enabled` is false so a gross-performance backtest is a true no-op
 * (spec Section 16: "may be switched ON/OFF").
 *
 * NOTE: rates in config/constants.js are a reasonable approximation, not
 * verified against this month's exact STT/stamp-duty circulars — treat the
 * "net of costs" numbers as illustrative until those are double-checked.
 */
export function calculateTradeCost(tradeValue, side, costConfig = TRANSACTION_COSTS) {
  if (!costConfig.enabled || tradeValue <= 0) {
    return { brokerage: 0, stt: 0, exchangeTxn: 0, sebiFee: 0, stampDuty: 0, gst: 0, slippage: 0, total: 0 };
  }
  const pct = (rate) => (tradeValue * rate) / 100;

  const brokerage = pct(costConfig.brokeragePct);
  const stt = pct(costConfig.sttPct); // charged on both buy and sell for delivery
  const exchangeTxn = pct(costConfig.exchangeTxnPct);
  const sebiFee = pct(costConfig.sebiFeePct);
  const stampDuty = side === 'buy' ? pct(costConfig.stampDutyPct) : 0; // stamp duty is buy-side only
  const gstable = brokerage + exchangeTxn + sebiFee;
  const gst = (gstable * costConfig.gstPct) / 100;
  const slippage = pct(costConfig.slippagePct);

  const total = brokerage + stt + exchangeTxn + sebiFee + stampDuty + gst + slippage;
  return { brokerage, stt, exchangeTxn, sebiFee, stampDuty, gst, slippage, total };
}

/** Round-trip cost (buy now, sell at rebalance) for a single position. */
export function calculateRoundTripCost(buyValue, sellValue, costConfig = TRANSACTION_COSTS) {
  const buyCost = calculateTradeCost(buyValue, 'buy', costConfig);
  const sellCost = calculateTradeCost(sellValue, 'sell', costConfig);
  return buyCost.total + sellCost.total;
}
