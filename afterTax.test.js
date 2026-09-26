/**
 * THE AFTER-TAX BLOCK ON THE RECORD (D22).
 *
 * Pins the two things that make this feature worth having rather than merely
 * present: that the figure is computed even when the toggle is off, and that
 * a verdict flip is detected rather than left for the reader to spot.
 */

import { describe, it, expect } from 'vitest';
import { selectRecordView, TAX_SUMMARY } from '../recordView.js';

/**
 * A minimal record. `capitalAtStart` and `exitValue` drive the tax engine;
 * the curve drives the headline.
 */
function recordWith({ strategyReturnPct, benchmarkReturnPct, costs = 0 }) {
  const end = 100 * (1 + strategyReturnPct / 100);
  return selectRecordView({
    windowSlug: '1m',
    data: {
      headline: {
        strategyReturnPct,
        benchmarkReturnPct,
        outperformancePct: strategyReturnPct - benchmarkReturnPct,
        maxDrawdownPct: -5,
      },
      backtest: {
        cycles: [{
          entryDate: '2025-05-30', exitDate: '2025-06-30',
          portfolioHoldingReturnPct: strategyReturnPct,
          benchmarkHoldingReturnPct: benchmarkReturnPct,
          capitalAtStart: 100, totalInvested: 100, exitValue: end,
          transactionCosts: costs,
        }],
        equityCurve: [
          { date: '2025-05-30', monthKey: '2025-05', indexValue: 100, value: 100 },
          { date: '2025-06-30', monthKey: '2025-06', indexValue: end, value: end },
        ],
      },
    },
  });
}

describe('the after-tax block', () => {
  it('is populated regardless of any toggle', () => {
    // D22: the toggles choose the record's BASIS, not whether the reader is
    // allowed to see what tax costs. Nothing here reads a preference.
    const view = recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 10 });
    expect(view.afterTax).toBeTruthy();
    expect(view.afterTax.netLabel).toBeTruthy();
  });

  it('reduces the return by the tax on the gain', () => {
    /*
      +28% on a base of 100 -> gain of 28. Tax 28 x 20.8% = 5.824.
      Net = (128 - 5.824) / 100 - 1 = +22.176%, a drag of 5.824 points.
    */
    const view = recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 10 });
    expect(view.afterTax.netReturnPct).toBeCloseTo(22.176, 4);
    expect(view.afterTax.dragPct).toBeCloseTo(5.824, 4);
  });

  it('shows the drag as a negative so the sign matches the effect', () => {
    /*
      The drag is stored positive by the engine ("tax cost 5.824 points") and
      negated for display, so the sign matches the direction of the effect.

      ASSERTED ON THE VALUE, NOT THE GLYPH. My first draft expected U+2212
      here and failed: `formatGap` uses a true minus sign deliberately, but
      `formatPct` emits an ASCII hyphen, so the record shows "−7.0%" on the
      outperformance chip and "-5.82%" two lines below it. That inconsistency
      is real and pre-existing; it is reported rather than silently unified
      inside a tax change, because `formatPct` has 36 call sites and 24 tests
      pinning its current output.
    */
    const view = recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 10 });
    expect(view.afterTax.dragPct).toBeGreaterThan(0);
    expect(view.afterTax.dragLabel).toMatch(/^[-\u2212]/);
  });
});

describe('the verdict flip', () => {
  it('is detected when tax turns a win into a loss', () => {
    /*
      THE CASE THE WHOLE FEATURE EXISTS FOR.
      Gross +28% beats a benchmark of +24%. Net +22.176% does not.
    */
    const view = recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 24 });
    expect(view.afterTax.flipsVerdict).toBe(true);
    expect(view.afterTax.beatsBenchmark).toBe(false);
  });

  it('is not claimed when the strategy was already behind', () => {
    // Losing before tax and after it is not a flip — saying so would blame
    // tax for a shortfall it did not cause.
    const view = recordWith({ strategyReturnPct: 10, benchmarkReturnPct: 24 });
    expect(view.afterTax.flipsVerdict).toBe(false);
  });

  it('is not claimed when the lead survives tax', () => {
    const view = recordWith({ strategyReturnPct: 60, benchmarkReturnPct: 10 });
    expect(view.afterTax.flipsVerdict).toBe(false);
    expect(view.afterTax.beatsBenchmark).toBe(true);
  });
});

describe('honesty flags', () => {
  it('declares itself an estimate that does not carry losses forward', () => {
    const view = recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 10 });
    expect(view.afterTax.isEstimate).toBe(true);
    expect(view.afterTax.carriesLossesForward).toBe(false);
  });

  it('says whether costs are included, so the label cannot mislead', () => {
    // "After costs and tax" versus "After tax" has to track what was actually
    // deducted, or the sentence claims a deduction that did not happen.
    expect(recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 10, costs: 0 })
      .afterTax.includesCosts).toBe(false);
    expect(recordWith({ strategyReturnPct: 28, benchmarkReturnPct: 10, costs: 12 })
      .afterTax.includesCosts).toBe(true);
  });

  it('the Settings sentence says estimate, not advice, and names the rate', () => {
    expect(TAX_SUMMARY).toContain('20.8%');
    expect(TAX_SUMMARY).toContain('not tax advice');
    expect(TAX_SUMMARY).toContain('errs high');
  });
});
