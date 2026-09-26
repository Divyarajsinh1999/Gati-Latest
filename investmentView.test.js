/**
 * INVESTMENT VIEW — a reader's own money, not the strategy's.
 *
 * WHAT THESE GUARD
 *   That a holding is never valued on an invented price, that several
 *   purchases of one stock combine at the right average, and that gain and
 *   gain-percentage are consistent with each other and with the cost.
 *
 * The whole-share reconciliation these partly replace used to live in the
 * end-to-end suite, driving a global "Your amount" box that no longer
 * exists. The invariant moved here with the feature.
 */

import { describe, it, expect } from 'vitest';
import { selectInvestment } from '../investmentView.js';

const lot = (overrides = {}) => ({
  id: 'a',
  symbol: 'RELIANCE.NS',
  quantity: 25,
  purchasePrice: 1245.5,
  purchaseDate: '2026-08-05',
  ...overrides,
});

describe('a single holding', () => {
  it('reports nothing at all when there are no purchases', () => {
    expect(selectInvestment({ lots: [], currentPrice: 1300 })).toBeNull();
  });

  it('computes invested, current value, gain and return', () => {
    const result = selectInvestment({ lots: [lot()], currentPrice: 1298 });
    expect(result.invested).toBeCloseTo(31_137.5, 6);
    expect(result.currentValue).toBeCloseTo(32_450, 6);
    expect(result.gain).toBeCloseTo(1312.5, 6);
    expect(result.gainPct).toBeCloseTo((1312.5 / 31_137.5) * 100, 10);
  });

  it('keeps gain and gain-percentage consistent with each other', () => {
    for (const price of [400, 900.25, 1245.5, 1600, 9999.99]) {
      const result = selectInvestment({ lots: [lot()], currentPrice: price });
      expect(result.gainPct).toBeCloseTo((result.gain / result.invested) * 100, 9);
    }
  });

  it('reports a loss as a loss, with both figures negative', () => {
    const result = selectInvestment({ lots: [lot()], currentPrice: 1000 });
    expect(result.gain).toBeLessThan(0);
    expect(result.gainPct).toBeLessThan(0);
  });
});

/**
 * THE RULE THAT MATTERS MOST.
 *
 * With no usable current price, a holding must report its cost and decline
 * to state a value. Marking it at cost fabricates a break-even; marking it
 * at zero fabricates a wipeout. Both would render with exactly the same
 * confidence as a real figure.
 */
describe('an unpriced holding', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -12],
    ['NaN', Number.NaN],
    ['a string', '1300'],
  ])('declines to value it when the price is %s', (_label, price) => {
    const result = selectInvestment({ lots: [lot()], currentPrice: price });
    expect(result.canValue).toBe(false);
    expect(result.currentValue).toBeNull();
    expect(result.gain).toBeNull();
    expect(result.gainPct).toBeNull();
    // Cost is known regardless — it came from the reader, not the market.
    expect(result.invested).toBeCloseTo(31_137.5, 6);
  });

  it('never returns a gain without a current value, or the reverse', () => {
    for (const price of [null, 0, 1300]) {
      const result = selectInvestment({ lots: [lot()], currentPrice: price });
      expect(result.currentValue == null).toBe(result.gain == null);
    }
  });
});

describe('multiple purchase lots', () => {
  const lots = [
    lot({ id: '1', quantity: 10, purchasePrice: 1000, purchaseDate: '2026-05-04' }),
    lot({ id: '2', quantity: 15, purchasePrice: 1100, purchaseDate: '2026-06-10' }),
    lot({ id: '3', quantity: 20, purchasePrice: 1050, purchaseDate: '2026-07-02' }),
  ];

  it('sums the quantity across every lot', () => {
    expect(selectInvestment({ lots, currentPrice: 1200 }).quantity).toBe(45);
  });

  it('averages cost by WEIGHT, not by lot', () => {
    // (10·1000 + 15·1100 + 20·1050) / 45 = 47,500 / 45
    const result = selectInvestment({ lots, currentPrice: 1200 });
    expect(result.averageCost).toBeCloseTo(47_500 / 45, 9);
    // A plain mean of 1000, 1100, 1050 would be 1050 — visibly different, and
    // wrong by ₹1,150 on this holding.
    expect(result.averageCost).not.toBeCloseTo(1050, 2);
  });

  it('invested equals the sum of what was actually paid', () => {
    const result = selectInvestment({ lots, currentPrice: 1200 });
    const paid = lots.reduce((total, l) => total + l.quantity * l.purchasePrice, 0);
    expect(result.invested).toBeCloseTo(paid, 6);
  });

  it('dates the holding from the EARLIEST purchase', () => {
    // The holding began when the first lot was bought, whatever order the
    // records happen to be stored in.
    expect(selectInvestment({ lots, currentPrice: 1200 }).firstPurchase).toBe('2026-05-04');
    const shuffled = [lots[2], lots[0], lots[1]];
    expect(selectInvestment({ lots: shuffled, currentPrice: 1200 }).firstPurchase).toBe('2026-05-04');
  });

  it('counts the lots, so the interface can say the average is an average', () => {
    expect(selectInvestment({ lots, currentPrice: 1200 }).lotCount).toBe(3);
    expect(selectInvestment({ lots: [lot()], currentPrice: 1200 }).lotCount).toBe(1);
  });

  it('gives the same total as valuing each lot separately and adding up', () => {
    // The aggregation is a presentation convenience; it must not change the
    // money. If these ever disagree, the weighted average is wrong.
    const price = 1234.56;
    const combined = selectInvestment({ lots, currentPrice: price });
    const separately = lots.reduce(
      (totals, l) => {
        const one = selectInvestment({ lots: [l], currentPrice: price });
        return { invested: totals.invested + one.invested, value: totals.value + one.currentValue };
      },
      { invested: 0, value: 0 },
    );
    expect(combined.invested).toBeCloseTo(separately.invested, 6);
    expect(combined.currentValue).toBeCloseTo(separately.value, 6);
  });
});

describe('whole shares', () => {
  it('leaves no fractional rupee unaccounted for', () => {
    // The invariant the removed "Your amount" box used to guard: a whole
    // number of shares at a real price, and the cost is exactly that product
    // — nothing rounded away, nothing invented.
    const result = selectInvestment({ lots: [lot({ quantity: 37, purchasePrice: 2711.35 })], currentPrice: 2800 });
    expect(result.invested).toBeCloseTo(37 * 2711.35, 9);
    expect(Number.isInteger(result.quantity)).toBe(true);
  });
});
