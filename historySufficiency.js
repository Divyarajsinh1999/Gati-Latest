/**
 * Sample-size honesty check for a backtest (spec Sections 39/41).
 *
 * Financial accuracy isn't only about the arithmetic being right — a
 * technically-correct CAGR computed from 2 completed rebalances is still
 * misleading if it's shown with the same visual confidence as one computed
 * from 40. Longer `lookbackMonths` windows are the concrete case this
 * exists for: a k-month window needs k+1 month-ends before it can rank
 * anything at all (see backtestEngine.js), so with data starting at
 * DATA_START_DATE (2025-01-01) and ~19 month-ends available as of this
 * writing, the 12-month rule produces only ~7 completed cycles. That's an
 * early read, not a track record — this function names that plainly so the
 * UI can flag it instead of presenting a thin sample as settled.
 *
 * Thresholds are deliberately simple and documented rather than tuned:
 *   0 completed cycles     -> 'insufficient' — nothing to show at all
 *   1-11 completed cycles  -> 'thin'         — under a year of monthly rebalances
 *   12+ completed cycles   -> 'ok'
 */
export const MIN_REBALANCES_FOR_CONFIDENCE = 12;

/**
 * @param {Object} args
 * @param {number} args.cyclesCount    completed rebalances (backtest.cycles.length)
 * @param {number} [args.lookbackMonths]
 * @returns {{level: 'insufficient'|'thin'|'ok', rebalances: number, message: string|null}}
 */
export function assessHistorySufficiency({ cyclesCount = 0, lookbackMonths = 1 } = {}) {
  if (!(cyclesCount > 0)) {
    return {
      level: 'insufficient',
      rebalances: 0,
      message:
        `No completed rebalance yet for this ${lookbackMonths}-month window — there isn't enough ` +
        `history since the data start date to produce even one signal.`,
    };
  }

  if (cyclesCount < MIN_REBALANCES_FOR_CONFIDENCE) {
    return {
      level: 'thin',
      rebalances: cyclesCount,
      message:
        `Only ${cyclesCount} completed rebalance${cyclesCount === 1 ? '' : 's'} exist for this ` +
        `${lookbackMonths}-month window so far — treat these results as an early read, not a track record.`,
    };
  }

  return { level: 'ok', rebalances: cyclesCount, message: null };
}
