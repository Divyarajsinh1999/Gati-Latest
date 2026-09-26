import { MIN_MONTHS_FOR_CAGR, MIN_MONTHS_FOR_RISK_ADJUSTED, ANNUAL_RISK_FREE_RATE } from '../config/constants.js';

/**
 * CAGR from a start/end value over a period. Only "meaningful" once the
 * backtest spans MIN_MONTHS_FOR_CAGR months (spec Section 18: "CAGR when
 * meaningful for the available period") — otherwise returns null with a
 * reason string instead of an inflated/misleading annualised number from a
 * couple of months of data.
 */
export function calculateCAGR(startValue, endValue, months) {
  if (months < MIN_MONTHS_FOR_CAGR) {
    return { value: null, reason: `Insufficient period (${months} of ${MIN_MONTHS_FOR_CAGR} months minimum)` };
  }
  if (!(startValue > 0)) return { value: null, reason: 'Invalid start value' };
  const years = months / 12;
  const cagr = Math.pow(endValue / startValue, 1 / years) - 1;
  return { value: cagr * 100, reason: null };
}

/**
 * Max drawdown (%) across an equity curve (array of numbers, chronological).
 * Standard peak-to-trough definition — tracks the running peak and the
 * worst (peak - value)/peak seen so far.
 */
export function calculateMaxDrawdown(equityCurve) {
  if (!equityCurve || equityCurve.length === 0) return { value: 0, peakIndex: null, troughIndex: null };
  let peak = equityCurve[0];
  let peakIdx = 0;
  let maxDD = 0;
  let ddPeakIdx = 0;
  let ddTroughIdx = 0;

  equityCurve.forEach((value, idx) => {
    if (value > peak) {
      peak = value;
      peakIdx = idx;
    }
    const dd = (peak - value) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      ddPeakIdx = peakIdx;
      ddTroughIdx = idx;
    }
  });

  return { value: maxDD * 100, peakIndex: ddPeakIdx, troughIndex: ddTroughIdx };
}

/**
 * How LONG the record spent below its previous peak, in periods (D24).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DEPTH IS WHAT GETS QUOTED. DURATION IS WHAT IS ENDURED.
 *
 * `calculateMaxDrawdown` answers "how far down did it go". This answers "how
 * long before it got back", and they are different questions with different
 * consequences. A sharp 20% fall that recovers in two months is survivable.
 * Eight months of grinding along 6% below the old high is what makes people
 * abandon a strategy — usually at the worst moment, and usually convinced it
 * has stopped working rather than that it is having an ordinary bad stretch.
 *
 * DEFINITIONS, stated because "underwater" gets used loosely:
 *   - Underwater at period i means value[i] is below the highest value seen
 *     at or before i. Equal to the peak counts as RECOVERED.
 *   - `longestPeriods` is the longest run of consecutive underwater periods,
 *     whether or not it ended in recovery.
 *   - `currentPeriods` is the run still open at the end of the series, and is
 *     0 when the record finishes at a new high.
 *   - `isUnderwaterNow` separates "recovered" from "still down", which the
 *     longest figure alone cannot express.
 *
 * THE UNIT IS PERIODS, NOT MONTHS. The caller knows its own spacing; this
 * function does not, and inventing a calendar here would create a second
 * place for the record's dating to be wrong.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * @param {number[]} equityCurve
 * @returns {{longestPeriods:number,currentPeriods:number,isUnderwaterNow:boolean,
 *            longestStartIndex:number|null,longestEndIndex:number|null}}
 */
export function calculateUnderwaterDuration(equityCurve) {
  const empty = {
    longestPeriods: 0, currentPeriods: 0, isUnderwaterNow: false,
    longestStartIndex: null, longestEndIndex: null,
  };
  if (!Array.isArray(equityCurve) || equityCurve.length === 0) return empty;

  let peak = null;
  let runLength = 0;
  let runStart = null;
  let longest = 0;
  let longestStart = null;
  let longestEnd = null;

  equityCurve.forEach((value, idx) => {
    // A gap in the curve is not a recovery. Skipping keeps the run open
    // rather than letting missing data silently end a drawdown.
    if (!Number.isFinite(value)) return;

    if (peak == null || value >= peak) {
      // Close any open run BEFORE resetting the peak, or the run that just
      // ended would be measured against the new high instead of the old one.
      if (runLength > longest) {
        longest = runLength;
        longestStart = runStart;
        longestEnd = idx - 1;
      }
      peak = value;
      runLength = 0;
      runStart = null;
      return;
    }

    if (runLength === 0) runStart = idx;
    runLength += 1;
  });

  /*
    A run still open at the end never recovered, so it is closed here rather
    than discarded. Without this, a record sitting in its worst-ever drawdown
    right now would report some earlier, smaller stretch as the longest — the
    reader's actual situation invisible.
  */
  if (runLength > longest) {
    longest = runLength;
    longestStart = runStart;
    longestEnd = equityCurve.length - 1;
  }

  return {
    longestPeriods: longest,
    currentPeriods: runLength,
    isUnderwaterNow: runLength > 0,
    longestStartIndex: longestStart,
    longestEndIndex: longestEnd,
  };
}

/** Counts winning vs losing months and finds the best/worst single month. */
export function calculateWinLossMonths(monthlyReturns) {
  const winning = monthlyReturns.filter((r) => r.returnPct > 0);
  const losing = monthlyReturns.filter((r) => r.returnPct < 0);
  const flat = monthlyReturns.filter((r) => r.returnPct === 0);

  const best = monthlyReturns.reduce((a, b) => (b.returnPct > (a?.returnPct ?? -Infinity) ? b : a), null);
  const worst = monthlyReturns.reduce((a, b) => (b.returnPct < (a?.returnPct ?? Infinity) ? b : a), null);

  return {
    winningMonths: winning.length,
    losingMonths: losing.length,
    flatMonths: flat.length,
    totalMonths: monthlyReturns.length,
    bestMonth: best,
    worstMonth: worst,
  };
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
function stdDev(values, avg = mean(values)) {
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

/**
 * Annualised volatility (%) from monthly returns (%).
 *
 * Spec Section 18 lists volatility as an optional metric to include "when
 * statistically meaningful", so it's gated behind the same sample-size
 * floor as Sharpe/Sortino: reporting an annualised figure from three
 * months of data implies a precision that isn't there.
 *
 * Uses the population standard deviation of monthly returns scaled by
 * sqrt(12), matching the annualisation convention already used for Sharpe
 * and Sortino below — mixing sample and population estimators between
 * these three would make them quietly incomparable.
 */
export function calculateVolatility(monthlyReturnPcts) {
  if (monthlyReturnPcts.length < MIN_MONTHS_FOR_RISK_ADJUSTED) {
    return { value: null, reason: `Insufficient sample (${monthlyReturnPcts.length} of ${MIN_MONTHS_FOR_RISK_ADJUSTED} months minimum)` };
  }
  const sd = stdDev(monthlyReturnPcts);
  return { value: sd * Math.sqrt(12), reason: null };
}

/**
 * Annualised Sharpe ratio from monthly returns (%). Gated behind
 * MIN_MONTHS_FOR_RISK_ADJUSTED observations — with very few data points a
 * Sharpe/Sortino number is more misleading than informative (spec Section
 * 18 allows these "when statistically meaningful").
 */
export function calculateSharpe(monthlyReturnPcts, annualRiskFreeRate = ANNUAL_RISK_FREE_RATE) {
  if (monthlyReturnPcts.length < MIN_MONTHS_FOR_RISK_ADJUSTED) {
    return { value: null, reason: `Insufficient sample (${monthlyReturnPcts.length} of ${MIN_MONTHS_FOR_RISK_ADJUSTED} months minimum)` };
  }
  const monthlyRf = (Math.pow(1 + annualRiskFreeRate, 1 / 12) - 1) * 100;
  const excess = monthlyReturnPcts.map((r) => r - monthlyRf);
  const avgExcess = mean(excess);
  const sd = stdDev(excess);
  if (sd === 0) return { value: null, reason: 'Zero volatility in sample' };
  const sharpe = (avgExcess / sd) * Math.sqrt(12);
  return { value: sharpe, reason: null };
}

/** Sortino ratio: like Sharpe, but the denominator only penalises downside deviation. */
export function calculateSortino(monthlyReturnPcts, annualRiskFreeRate = ANNUAL_RISK_FREE_RATE) {
  if (monthlyReturnPcts.length < MIN_MONTHS_FOR_RISK_ADJUSTED) {
    return { value: null, reason: `Insufficient sample (${monthlyReturnPcts.length} of ${MIN_MONTHS_FOR_RISK_ADJUSTED} months minimum)` };
  }
  const monthlyRf = (Math.pow(1 + annualRiskFreeRate, 1 / 12) - 1) * 100;
  const excess = monthlyReturnPcts.map((r) => r - monthlyRf);
  const avgExcess = mean(excess);
  const downside = excess.filter((e) => e < 0);
  if (downside.length === 0) return { value: null, reason: 'No downside months in sample' };
  const downsideDev = Math.sqrt(mean(downside.map((d) => d ** 2)));
  if (downsideDev === 0) return { value: null, reason: 'Zero downside deviation' };
  const sortino = (avgExcess / downsideDev) * Math.sqrt(12);
  return { value: sortino, reason: null };
}
