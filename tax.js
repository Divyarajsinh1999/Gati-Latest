/**
 * SHORT-TERM CAPITAL GAINS TAX ON A COMPLETED RECORD (D22).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THIS MODULE IS POST-PROCESSING AND MUST STAY THAT WAY.
 *
 * It reads a finished backtest and reports what tax would have taken. It does
 * not participate in ranking, selection, weighting or execution, and nothing
 * in `ranking.js`, `momentum.js` or the selection half of `backtestEngine.js`
 * imports it. That boundary is D21's hard rule: if applying tax ever seems to
 * require touching those, the design is wrong.
 *
 * WHY IT WORKS WITHOUT AN ACCOUNT SIZE
 *
 * D1 keeps the strategy record capital-independent — it is published as a
 * base-100 index. Tax is a PERCENTAGE OF GAINS, so the drag it produces is
 * identical at ₹50,000 and at ₹50 lakh. The rupee figures below are internal
 * to the calculation; what reaches the UI is a percentage. No account size is
 * assumed and D1 is untouched.
 *
 * WHY LOSSES ARE NETTED
 *
 * Short-term capital losses set off against short-term gains within the same
 * financial year. A model that taxed every winning rebalance and ignored
 * every losing one would report a bill the investor would never pay — on the
 * measured record, 87% higher than the real one. That is a different kind of
 * dishonesty from ignoring tax altogether, but it is still dishonesty, and
 * the whole point of showing tax is to be accurate about a cost.
 *
 * WHERE IT ERRS, AND IN WHICH DIRECTION
 *
 * A fiscal year ending in a net loss owes nothing here, and that loss is not
 * carried into the next year — the law allows eight years of carry-forward if
 * the return is filed on time. So this OVERSTATES tax for anyone with a losing
 * year followed by a winning one. Deliberate: carry-forward depends on the
 * reader's own filing, which the app cannot know, and for a number someone
 * might act on, "worse than reality" is the safer error. Reported through
 * `carriesLossesForward` so the UI can state it rather than leave it inferred.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { CAPITAL_GAINS_TAX } from '../config/constants.js';

/**
 * The Indian financial year containing a date, identified by its start year.
 *
 * April to March, so 2026-03-31 belongs to FY 2025-26 and 2026-04-01 starts
 * FY 2026-27. Getting this boundary wrong would silently move a March loss
 * into the wrong year and change the set-off — which is exactly the kind of
 * error that produces a plausible number nobody can trace.
 */
export function fiscalYearOf(isoDate, startMonth = CAPITAL_GAINS_TAX.fiscalYearStartMonth) {
  if (typeof isoDate !== 'string' || isoDate.length < 7) return null;
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return month >= startMonth ? year : year - 1;
}

/** "FY 2025-26" from a start year of 2025. */
export function fiscalYearLabel(fyStart) {
  if (!Number.isFinite(fyStart)) return null;
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

/**
 * The realised gain or loss on one completed rebalance.
 *
 * `exitValue` is already NET OF TRANSACTION COSTS when costs are enabled, so
 * the gain taxed here is the gain actually received. That ordering matters:
 * taxing a gross gain and then subtracting costs would tax money the investor
 * never had.
 *
 * Returns null — not zero — when the cycle is incomplete. Zero is a real
 * value meaning "broke exactly even", and conflating the two would let a
 * missing exit quietly count as a break-even trade.
 */
export function realisedGainOf(cycle) {
  const invested = cycle?.totalInvested;
  const exit = cycle?.exitValue;
  if (!Number.isFinite(invested) || !Number.isFinite(exit)) return null;

  // `exitValue` is the whole portfolio's exit including uninvested cash;
  // `capitalAtStart` is its matching opening figure. Using totalInvested
  // against exitValue would count residual cash as a gain.
  const start = Number.isFinite(cycle.capitalAtStart) ? cycle.capitalAtStart : invested;
  return exit - start;
}

/** Tax on a net gain, cess included. Never negative. */
export function taxOnNetGain(netGain, config = CAPITAL_GAINS_TAX) {
  if (!Number.isFinite(netGain) || netGain <= 0) return 0;
  const base = netGain * (config.shortTermPct / 100);
  return base * (1 + config.cessPct / 100);
}

/** 20.8% for 20% + 4% cess. Kept as one function so no caller re-derives it. */
export function effectiveRatePct(config = CAPITAL_GAINS_TAX) {
  return config.shortTermPct * (1 + config.cessPct / 100);
}

/**
 * Group realised gains by financial year and tax each year's NET.
 *
 * @returns {{label:string,fyStart:number,gains:number,losses:number,
 *            netGain:number,tax:number,cycleCount:number}[]}
 */
export function taxByFiscalYear(cycles = [], config = CAPITAL_GAINS_TAX) {
  const byYear = new Map();

  for (const cycle of Array.isArray(cycles) ? cycles : []) {
    const gain = realisedGainOf(cycle);
    if (gain == null) continue;

    // Taxed in the year the position was SOLD, which is the exit date.
    const fyStart = fiscalYearOf(cycle.exitDate, config.fiscalYearStartMonth);
    if (fyStart == null) continue;

    if (!byYear.has(fyStart)) {
      byYear.set(fyStart, { fyStart, gains: 0, losses: 0, cycleCount: 0 });
    }
    const year = byYear.get(fyStart);
    if (gain >= 0) year.gains += gain;
    else year.losses += Math.abs(gain);
    year.cycleCount += 1;
  }

  return [...byYear.values()]
    .sort((a, b) => a.fyStart - b.fyStart)
    .map((year) => {
      const netGain = config.setOffLossesWithinYear
        ? year.gains - year.losses
        : year.gains;
      return {
        ...year,
        label: fiscalYearLabel(year.fyStart),
        netGain,
        tax: taxOnNetGain(netGain, config),
      };
    });
}

/**
 * Apply tax to a completed record.
 *
 * @param {object}   args
 * @param {object[]} args.cycles          completed rebalances
 * @param {number}   args.initialCapital  the curve's opening value
 * @param {number}   args.finalValue      the curve's closing value
 * @returns {{totalTax:number,totalGains:number,totalLosses:number,
 *            grossReturnPct:number|null,netReturnPct:number|null,
 *            dragPct:number|null,effectiveRatePct:number,
 *            years:object[],carriesLossesForward:boolean,isEstimate:true}}
 */
export function applyTax({
  cycles = [],
  initialCapital,
  finalValue,
  config = CAPITAL_GAINS_TAX,
} = {}) {
  const years = taxByFiscalYear(cycles, config);

  const totalTax = years.reduce((sum, y) => sum + y.tax, 0);
  const totalGains = years.reduce((sum, y) => sum + y.gains, 0);
  const totalLosses = years.reduce((sum, y) => sum + y.losses, 0);

  const hasCurve = Number.isFinite(initialCapital) && Number.isFinite(finalValue) && initialCapital > 0;

  const grossReturnPct = hasCurve ? ((finalValue / initialCapital) - 1) * 100 : null;
  const netReturnPct = hasCurve
    ? (((finalValue - totalTax) / initialCapital) - 1) * 100
    : null;

  return {
    totalTax,
    totalGains,
    totalLosses,
    grossReturnPct,
    netReturnPct,
    // Points of return lost to tax. Positive means tax cost the reader that
    // much; it is presented as a negative in the UI so the sign matches the
    // direction of the effect.
    dragPct: hasCurve ? grossReturnPct - netReturnPct : null,
    effectiveRatePct: effectiveRatePct(config),
    years,
    carriesLossesForward: config.carryLossesForward,
    isEstimate: true,
  };
}
