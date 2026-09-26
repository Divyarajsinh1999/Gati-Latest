/**
 * THE TAX ENGINE (D22).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EVERY EXPECTED VALUE BELOW IS WORKED OUT BY HAND IN A COMMENT BEFORE IT IS
 * ASSERTED, and several are also asserted NOT to equal the plausible wrong
 * answer.
 *
 * That second part is the one that matters. A tax figure has no obvious
 * smell: 5,663 and 3,031 both look like tax on the same trades, and only one
 * of them is right. Recording whatever the implementation returned would
 * produce a suite that passes forever while the app quietly overstates a cost
 * the owner is making decisions on.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  fiscalYearOf, fiscalYearLabel, realisedGainOf, taxOnNetGain,
  effectiveRatePct, taxByFiscalYear, applyTax,
} from '../tax.js';
import { CAPITAL_GAINS_TAX } from '../../config/constants.js';

/** A completed rebalance: opened at `start`, closed at `exit` on `date`. */
const cycle = (date, start, exit) => ({
  exitDate: date, capitalAtStart: start, totalInvested: start, exitValue: exit,
});

describe('the rate', () => {
  it('is 20% plus 4% cess, not the pre-July-2024 15%', () => {
    /*
      Section 111A was 15% for years and the Finance (No. 2) Act 2024 raised
      it to 20%. Roughly half the sources online still print the old figure,
      so this pins the current one explicitly — a silent revert to 15% would
      understate every net number in the app by a quarter.
    */
    expect(CAPITAL_GAINS_TAX.shortTermPct).toBe(20);
    expect(CAPITAL_GAINS_TAX.shortTermPct).not.toBe(15);
    expect(CAPITAL_GAINS_TAX.cessPct).toBe(4);
  });

  it('compounds cess onto the tax, not onto the gain', () => {
    // 20 x 1.04 = 20.8, NOT 20 + 4 = 24 and NOT 20 x 1.4.
    expect(effectiveRatePct()).toBeCloseTo(20.8, 10);
    expect(effectiveRatePct()).not.toBe(24);
  });

  it('taxes a gain at exactly that rate', () => {
    // 28,000 x 20% = 5,600. Cess: 5,600 x 4% = 224. Total 5,824.
    expect(taxOnNetGain(28000)).toBeCloseTo(5824, 6);
  });

  it('never returns negative tax on a loss', () => {
    // A loss produces no refund — it reduces other gains, handled per year.
    expect(taxOnNetGain(-5000)).toBe(0);
    expect(taxOnNetGain(0)).toBe(0);
  });
});

describe('the financial year boundary', () => {
  it('runs April to March', () => {
    // 31 March 2026 is the LAST day of FY 2025-26; 1 April starts the next.
    expect(fiscalYearOf('2026-03-31')).toBe(2025);
    expect(fiscalYearOf('2026-04-01')).toBe(2026);
    expect(fiscalYearLabel(2025)).toBe('FY 2025-26');
  });

  it('labels a century rollover without producing FY 2099-100', () => {
    expect(fiscalYearLabel(2099)).toBe('FY 2099-00');
  });

  it('returns null for an unusable date rather than guessing a year', () => {
    for (const bad of [null, undefined, '', 'later', 12345]) {
      expect(fiscalYearOf(bad)).toBeNull();
    }
  });
});

describe('the realised gain on one rebalance', () => {
  it('measures the whole portfolio, including uninvested cash', () => {
    /*
      Whole-share sizing leaves residual cash. Comparing exitValue against
      totalInvested alone would count that cash as profit — a gain the
      investor never made, taxed at 20.8%.
    */
    const c = { exitDate: '2026-01-30', capitalAtStart: 50000, totalInvested: 48200, exitValue: 52000 };
    expect(realisedGainOf(c)).toBe(2000);
    expect(realisedGainOf(c)).not.toBe(3800);
  });

  it('returns null for an incomplete cycle rather than zero', () => {
    // Zero means "broke exactly even", which is a real outcome. A missing
    // exit must not be able to masquerade as one.
    expect(realisedGainOf({ exitDate: '2026-01-30', capitalAtStart: 50000 })).toBeNull();
    expect(realisedGainOf(null)).toBeNull();
  });
});

describe('losses set off within a financial year', () => {
  const cycles = [
    cycle('2025-06-30', 100000, 130000), // +30,000
    cycle('2025-09-30', 130000, 118000), // -12,000
    cycle('2025-12-31', 118000, 128000), // +10,000
  ];

  it('taxes the net, not the sum of the winners', () => {
    /*
      Gains 30,000 + 10,000 = 40,000. Loss 12,000. Net 28,000.
      Tax = 28,000 x 20.8% = 5,824.

      The naive model taxes 40,000 -> 8,320. Both look like plausible tax
      bills; only one is what would actually be paid.
    */
    const [year] = taxByFiscalYear(cycles);
    expect(year.label).toBe('FY 2025-26');
    expect(year.gains).toBeCloseTo(40000, 6);
    expect(year.losses).toBeCloseTo(12000, 6);
    expect(year.netGain).toBeCloseTo(28000, 6);
    expect(year.tax).toBeCloseTo(5824, 6);
    expect(year.tax).not.toBeCloseTo(8320, 0);
  });

  it('does not net a loss against a DIFFERENT year', () => {
    /*
      A big gain in FY 2025-26 and a big loss in FY 2026-27 must not cancel.
        FY 2025-26: +30,000 -> tax 6,240
        FY 2026-27: -25,000 -> tax 0, and the loss is not carried back
      Netting across years would give 5,000 net and 1,040 tax — far too low.
    */
    const years = taxByFiscalYear([
      cycle('2025-06-30', 100000, 130000),
      cycle('2026-06-30', 130000, 105000),
    ]);
    expect(years).toHaveLength(2);
    expect(years[0].tax).toBeCloseTo(6240, 6);
    expect(years[1].tax).toBe(0);
    expect(years[0].tax + years[1].tax).not.toBeCloseTo(1040, 0);
  });

  it('owes nothing in a year that ends at a net loss', () => {
    const [year] = taxByFiscalYear([
      cycle('2025-06-30', 100000, 92000),
      cycle('2025-09-30', 92000, 88000),
    ]);
    expect(year.netGain).toBeCloseTo(-12000, 6);
    expect(year.tax).toBe(0);
  });
});

describe('applyTax over a whole record', () => {
  const cycles = [
    cycle('2025-06-30', 100000, 130000), // +30,000
    cycle('2025-09-30', 130000, 118000), // -12,000
    cycle('2025-12-31', 118000, 128000), // +10,000
  ];
  const result = applyTax({ cycles, initialCapital: 100000, finalValue: 128000 });

  it('reports gross, net and the drag between them', () => {
    /*
      Gross: 128,000 / 100,000 - 1 = +28.00%
      Tax:   5,824 (worked above)
      Net:   (128,000 - 5,824) / 100,000 - 1 = +22.176%
      Drag:  28.00 - 22.176 = 5.824 points
    */
    expect(result.grossReturnPct).toBeCloseTo(28, 6);
    expect(result.netReturnPct).toBeCloseTo(22.176, 6);
    expect(result.dragPct).toBeCloseTo(5.824, 6);
  });

  it('is scale-invariant, so D1 survives', () => {
    /*
      The record is published as a base-100 index with no assumed account
      size. Tax is a percentage OF GAINS, so the same trades at ten times the
      capital must produce the same DRAG. If this ever fails, the engine has
      started depending on an account size and D1 is broken.
    */
    const bigger = applyTax({
      cycles: cycles.map((c) => ({
        ...c,
        capitalAtStart: c.capitalAtStart * 10,
        totalInvested: c.totalInvested * 10,
        exitValue: c.exitValue * 10,
      })),
      initialCapital: 1000000,
      finalValue: 1280000,
    });
    expect(bigger.dragPct).toBeCloseTo(result.dragPct, 9);
    expect(bigger.netReturnPct).toBeCloseTo(result.netReturnPct, 9);
  });

  it('declares itself an estimate that does not carry losses forward', () => {
    // Both flags exist so the UI can state the limitation rather than leave
    // the reader to infer it.
    expect(result.isEstimate).toBe(true);
    expect(result.carriesLossesForward).toBe(false);
  });

  it('returns nulls rather than NaN when there is no curve', () => {
    const empty = applyTax({ cycles: [] });
    expect(empty.grossReturnPct).toBeNull();
    expect(empty.netReturnPct).toBeNull();
    expect(empty.dragPct).toBeNull();
    expect(empty.totalTax).toBe(0);
  });

  it('survives malformed cycles without throwing', () => {
    const messy = applyTax({
      cycles: [null, {}, { exitDate: 'nonsense', capitalAtStart: 1, exitValue: 2 }, cycle('2025-06-30', 100, 110)],
      initialCapital: 100,
      finalValue: 110,
    });
    // Only the one valid cycle counts: +10 gain, tax 10 x 20.8% = 2.08.
    expect(messy.totalTax).toBeCloseTo(2.08, 6);
  });
});
