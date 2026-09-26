/**
 * STRATEGY RECORD VIEW MODEL.
 *
 * WHAT THIS OWNS
 *   Shaping the full metric set, the current holding and the monthly history.
 *
 * WHAT THIS MUST NEVER DO
 *   Produce a rupee figure. The record is capital-independent (decision D1);
 *   every value here is a percentage, a count or a ratio. A rupee amount would
 *   reintroduce the assumed account size that decision removed.
 */

import { formatPct, formatDate, formatGap } from '../utils/formatters.js';
import {
  calculateCAGR, calculateVolatility, calculateSharpe, calculateSortino, calculateWinLossMonths,
  calculateUnderwaterDuration,
} from '../engine/metrics.js';
import { applyTax, effectiveRatePct } from '../engine/tax.js';
import { buildIndexedBenchmarkCurve } from '../utils/chartData.js';
import { CAPITAL_GAINS_TAX } from '../config/constants.js';

/**
 * One sentence describing the tax assumption, for the Settings note.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * IT LIVES IN THE SELECTOR LAYER BECAUSE SCREENS MAY NOT IMPORT `engine/`.
 *
 * The lint rule enforcing that is right, and the reflex to add an exception
 * for "it is only a rate" would be wrong: the rate is a modelling assumption,
 * and once one screen reads it directly the next one computes with it. The
 * selector layer is the boundary, so the sentence is composed here where the
 * engine is legitimately in scope.
 *
 * Says ESTIMATE and NOT TAX ADVICE, and names the direction of the error.
 * All three are load-bearing (D22).
 * ═══════════════════════════════════════════════════════════════════════
 */
export const TAX_SUMMARY =
  `Short-term, Section 111A: ${CAPITAL_GAINS_TAX.shortTermPct}% plus `
  + `${CAPITAL_GAINS_TAX.cessPct}% cess — ${effectiveRatePct().toFixed(1)}% of net gains. `
  + 'Losses are set off within each financial year, and a losing year is not carried forward, '
  + 'so this errs high. An estimate, not tax advice: it excludes surcharge, prior-year losses '
  + 'and your own circumstances.';

export function selectRecordView({ data, windowSlug }) {
  if (!data) return null;

  const { backtest, headline, historySufficiency, currentMomentum } = data;
  const cycles = backtest?.cycles ?? [];
  const curve = backtest?.equityCurve ?? [];
  const lookbackMonths = Number(String(windowSlug).replace('m', ''));

  if (cycles.length === 0 || curve.length < 2) {
    return {
      hasRecord: false,
      completedCycles: cycles.length,
      // A k-month window needs k+1 month-ends before it can rank at all, so
      // the shortfall is stated in the units the reader can act on.
      monthsNeeded: lookbackMonths + 1,
    };
  }

  const monthlyReturns = cycles.map((c) => c.portfolioHoldingReturnPct).filter((v) => v != null);
  const winLoss = calculateWinLossMonths(
    cycles.map((c) => ({ monthKey: c.exitDate, returnPct: c.portfolioHoldingReturnPct })),
  );

  // CAGR from the base-100 index, so it carries no notional.
  const finalIndex = curve[curve.length - 1].indexValue;
  const cagr = calculateCAGR(100, finalIndex, cycles.length);

  const volatility = calculateVolatility(monthlyReturns);
  const sharpe = calculateSharpe(monthlyReturns);
  const sortino = calculateSortino(monthlyReturns);

  // calculateWinLossMonths returns winningMonths / losingMonths / bestMonth /
  // worstMonth, where the last two are the whole month objects.
  const winningMonths = winLoss.winningMonths ?? 0;
  const losingMonths = winLoss.losingMonths ?? 0;
  const bestPct = winLoss.bestMonth?.returnPct ?? null;
  const worstPct = winLoss.worstMonth?.returnPct ?? null;
  const winRatePct = cycles.length ? (winningMonths / cycles.length) * 100 : null;
  const totalCostsPct = cycles.reduce((sum, c) => sum + (c.transactionCostsPct ?? 0), 0);

  /*
    ═══════════════════════════════════════════════════════════════════════
    THE AFTER-TAX FIGURE IS COMPUTED WHETHER OR NOT THE TOGGLE IS ON.

    This is the point of D22. The toggles decide which basis the RECORD is
    presented on; they do not decide whether the reader is allowed to see what
    tax costs him. A toggle he has to find is a cost he can forget exists, and
    for a monthly-rebalance strategy this is the largest single drag there is.

    So `afterTax` is always populated and the screen always shows one line from
    it. Turning the toggle on changes the headline basis; leaving it off still
    leaves the honest number one line below.

    Tax is applied to the backtest AS RUN, which already reflects the cost
    setting — so "after tax" means after costs and tax when costs are on, and
    after tax alone when they are not. The label says which rather than
    leaving the reader to work it out.
    ═══════════════════════════════════════════════════════════════════════
  */
  /*
    Measured on the SAME base-100 index the drawdown depth uses, so the two
    describe one curve rather than two. The engine returns PERIODS; this
    selector knows the record rebalances monthly, so the conversion to months
    happens here and nowhere else.
  */
  const underwater = calculateUnderwaterDuration(curve.map((p) => p.indexValue));
  const months = (n) => `${n} ${n === 1 ? 'month' : 'months'}`;

  const tax = applyTax({
    cycles,
    initialCapital: curve[0]?.value,
    finalValue: curve[curve.length - 1]?.value,
    config: CAPITAL_GAINS_TAX,
  });

  const grossReturnPct = headline?.strategyReturnPct ?? null;
  const benchmarkPct = headline?.benchmarkReturnPct ?? null;
  // The record is published as a base-100 index (D1), so the drag arrives as
  // points of return rather than as rupees.
  const netOfTaxPct = grossReturnPct != null && tax.dragPct != null
    ? grossReturnPct - tax.dragPct
    : null;

  return {
    hasRecord: true,
    completedCycles: cycles.length,
    isThinSample: Boolean(historySufficiency && !historySufficiency.isSufficient),

    headline: {
      startLabel: curve[0]?.date ? formatDate(curve[0].date) : '—',
      strategyLabel: formatPct(headline?.strategyReturnPct),
      benchmarkLabel: formatPct(headline?.benchmarkReturnPct),
      outperformanceLabel: signedPp(headline?.outperformancePct),
      /*
        ═══════════════════════════════════════════════════════════════════
        COLOURED BY THE RETURN ITSELF, NOT BY OUTPERFORMANCE (owner, 16 Aug).

        This read `outperformancePct`, so a record that made +16.69% while its
        benchmark made more was printed in the LOSS colour. A positive number
        in red is read as a loss before the digits are read at all, and
        Section 30 is explicit: green is gain, red is loss.

        The verdict is not lost. The outperformance chip directly below still
        carries it, still red when the strategy is behind — so the screen says
        both things instead of contradicting the number it is colouring.
        ═══════════════════════════════════════════════════════════════════
      */
      direction: (headline?.strategyReturnPct ?? 0) >= 0 ? 'gain' : 'loss',

      /*
        A SEPARATE DIRECTION FOR THE OUTPERFORMANCE CHIP, and it exists
        because fixing the headline broke the chip.

        Both used to read one `direction` field, which was fine while that
        field meant "outperformance". The moment the headline started
        colouring by its own return, the chip inherited it — and a screenshot
        showed "Outperformance −7.0%" rendered in GREEN. One misreading traded
        for another, which is precisely what the guard test warned about and
        did not catch: it asserted the chip's LABEL, not its tone.

        Two figures, two meanings, two fields. They are only ever equal by
        coincidence.
      */
      outperformanceDirection: (headline?.outperformancePct ?? 0) >= 0 ? 'gain' : 'loss',
    },

    /*
      Everything the screen needs to state the after-tax position, including
      the two facts that keep it honest: that it is an estimate, and that a
      losing year is not carried forward so the figure errs high.
    */
    afterTax: {
      effectiveRatePct: tax.effectiveRatePct,
      dragPct: tax.dragPct,
      netReturnPct: netOfTaxPct,
      netLabel: netOfTaxPct == null ? null : formatPct(netOfTaxPct),
      dragLabel: tax.dragPct == null ? null : formatPct(-tax.dragPct),
      direction: netOfTaxPct == null ? null : netOfTaxPct >= 0 ? 'gain' : 'loss',
      /*
        Does the strategy still beat its benchmark once tax is paid? This is
        the single question the feature exists to answer, so it is computed
        here rather than left to the screen to derive and possibly get wrong.
      */
      beatsBenchmark: netOfTaxPct != null && benchmarkPct != null ? netOfTaxPct > benchmarkPct : null,
      flipsVerdict:
        netOfTaxPct != null && benchmarkPct != null && grossReturnPct != null
          ? grossReturnPct > benchmarkPct && netOfTaxPct <= benchmarkPct
          : false,
      includesCosts: cycles.some((c) => (c.transactionCosts ?? 0) > 0),
      carriesLossesForward: tax.carriesLossesForward,
      years: tax.years.map((y) => ({ label: y.label, netGain: y.netGain, tax: y.tax })),
      isEstimate: tax.isEstimate,
    },

    // Both curves indexed to 100 and sharing the SAME dates, so the chart
    // carries no assumed account size (decision D1) and the two series are
    // directly comparable rather than merely adjacent.
    equityCurve: curve.map((p) => ({ date: p.date, monthKey: p.monthKey, value: p.indexValue })),
    benchmarkCurve: buildIndexedBenchmarkCurve(curve, cycles),

    performance: [
      metric('totalReturn', 'Total return', formatPct(headline?.strategyReturnPct), dirOf(headline?.strategyReturnPct), 'totalReturn'),
      metric('benchmarkReturn', 'Benchmark', formatPct(headline?.benchmarkReturnPct), dirOf(headline?.benchmarkReturnPct), 'benchmarkReturn'),
      metric('outperformance', 'Outperformance', signedPp(headline?.outperformancePct), dirOf(headline?.outperformancePct), 'outperformance'),
      metric('cagr', 'CAGR', formatPct(cagr), dirOf(cagr), 'cagr'),
    ],

    risk: [
      metric('maxDrawdown', 'Max drawdown', formatPct(headline?.maxDrawdownPct), 'loss', 'maxDrawdown'),
      /*
        Directly beside max drawdown, because it is that figure's other half:
        depth, then time. The sublabel says whether the record has recovered —
        "7 months" alone leaves the reader unable to tell history from now.
      */
      metric(
        'underwaterDuration',
        'Longest underwater',
        underwater.longestPeriods === 0 ? 'Never' : months(underwater.longestPeriods),
        underwater.longestPeriods > 0 ? 'loss' : null,
        'underwaterDuration',
        underwater.isUnderwaterNow
          ? `Still down — ${months(underwater.currentPeriods)} so far`
          : 'Recovered',
      ),
      metric('volatility', 'Volatility', formatPct(volatility), null, 'volatility'),
      metric('sharpe', 'Sharpe', ratio(sharpe), null, 'sharpe'),
      metric('sortino', 'Sortino', ratio(sortino), null, 'sortino'),
    ],
    riskHeadline: formatPct(headline?.maxDrawdownPct),

    consistency: [
      metric('winRate', 'Win rate', winRatePct == null ? null : `${winRatePct.toFixed(0)}%`, null, 'winRate'),
      metric('monthsWon', 'Months won', String(winningMonths), 'gain', 'monthsWon'),
      metric('monthsLost', 'Months lost', String(losingMonths), 'loss', 'monthsLost'),
      metric('bestMonth', 'Best month', formatPct(bestPct), 'gain', 'bestMonth'),
      metric('worstMonth', 'Worst month', formatPct(worstPct), 'loss', 'worstMonth'),
    ],
    consistencyHeadline: winRatePct == null ? null : `${winRatePct.toFixed(0)}% win rate`,

    // Names and weights only. The old page showed this as a scaled ₹50,000
    // position, implying an investment nobody had made.
    currentHolding: (currentMomentum?.picks ?? []).map((pick) => ({
      symbol: pick.symbol,
      name: pick.name,
      weightLabel: `${(100 / (currentMomentum.picks.length || 1)).toFixed(0)}%`,
    })),

    // Newest first: a reader scanning history wants the recent months, and
    // scrolling to the bottom for "what just happened" is backwards.
    //
    // Each row also carries HOW the portfolio changed (decision D14.1). A
    // return figure alone hides whether the strategy traded everything or
    // held steady, which is most of what a reader wants to know about a month.
    monthlyHistory: [...cycles].reverse().map((cycle, i, reversed) => {
      const previous = reversed[i + 1];
      const current = new Set((cycle.picks ?? []).map((p) => p.symbol));
      const before = new Set((previous?.picks ?? []).map((p) => p.symbol));
      const entered = previous ? [...current].filter((sym) => !before.has(sym)) : null;
      const held = previous ? [...current].filter((sym) => before.has(sym)) : null;

      return {
        monthKey: cycle.signalMonthKey ?? cycle.rankedAtMonthKey ?? cycle.monthKey ?? '—',
        picksLabel: (cycle.picks ?? []).map((p) => p.name ?? p.symbol).join(', ') || '—',
        returnLabel: formatPct(cycle.portfolioHoldingReturnPct),
        direction: (cycle.portfolioHoldingReturnPct ?? 0) >= 0 ? 'gain' : 'loss',
        // The first cycle has nothing before it, so no change can be stated.
        // "0 changed" would be a claim the data does not support.
        changeLabel: entered == null
          ? 'First rebalance'
          : `${entered.length} entered · ${held.length} held`,
      };
    }),

    totalCostsPct: totalCostsPct > 0 ? totalCostsPct : null,

    // The export summary is built from the SAME values rendered above, not
    // recomputed. An export that quietly differs from the screen is worse
    // than no export: the discrepancy surfaces in a spreadsheet days later
    // with no way to tell which number was right.
    exportSummary: {
      'Window': windowSlug,
      'Completed Rebalances': String(cycles.length),
      'Total Return %': fixed(headline?.strategyReturnPct),
      'Benchmark Return %': fixed(headline?.benchmarkReturnPct),
      'Outperformance (%)': fixed(headline?.outperformancePct),
      'CAGR %': fixed(cagr),
      'Max Drawdown %': fixed(headline?.maxDrawdownPct),
      'Volatility %': fixed(volatility),
      'Sharpe': fixed(sharpe),
      'Sortino': fixed(sortino),
      'Months Won': String(winningMonths),
      'Months Lost': String(losingMonths),
      'Best Month %': fixed(bestPct),
      'Worst Month %': fixed(worstPct),
      'Capital Independent': 'yes (exact equal weights)',
    },
  };
}

/**
 * The benchmark's own curve on the exact same rebalance dates, compounding
 * each cycle's holding return from the same base of 100.
 *
 * Rebuilt rather than read off the backtest because the benchmark has no
 * equity curve of its own — it has per-cycle returns. Compounding them on the
 * strategy's dates is what makes the comparison like for like.
 */
function fixed(value) {
  return value == null || !Number.isFinite(value) ? '' : value.toFixed(2);
}

/**
 * `sublabel` is optional and carries a short qualifier under the figure.
 *
 * NAMED FOR THE PROP MetricTile ALREADY ACCEPTS, not for what this selector
 * would prefer to call it. Inventing a parallel `note` would create a second
 * concept that renders nowhere until someone also edits the tile — the exact
 * shape of unwired failure this project keeps finding.
 */
function metric(key, label, value, direction, glossaryKey, sublabel = null) {
  return { key, label, value, direction, glossaryKey, sublabel };
}

function dirOf(value) {
  if (value == null) return null;
  return value >= 0 ? 'gain' : 'loss';
}

/**
 * A difference between two percentages, shown with a `%` sign.
 * See formatGap in utils/formatters.js for why the unit reads this way.
 */
function signedPp(value) {
  return formatGap(value, { digits: 1 });
}

/** Ratios are unitless; two decimals is as much precision as the sample supports. */
function ratio(value) {
  return value == null || !Number.isFinite(value) ? null : value.toFixed(2);
}
