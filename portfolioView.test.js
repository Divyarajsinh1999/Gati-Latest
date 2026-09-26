/**
 * PORTFOLIO VIEW MODEL TESTS.
 *
 * The guarantee that matters most is SEPARATION: nothing the user owns may
 * leak into a strategy figure, and nothing from the record may inflate a
 * personal one. They are two different numbers answering two different
 * questions, and blending them destroys both.
 */

import { describe, it, expect } from 'vitest';
import { selectPortfolioView, selectUniversePositions } from '../portfolioView.js';

const position = (over = {}) => ({
  id: over.id ?? 'p1',
  symbol: 'A.NS',
  name: 'A Ltd',
  universeKey: 'nifty50',
  quantity: 10,
  purchasePrice: 100,
  ...over,
});

const prices = new Map([
  ['A.NS', { price: 120, changePct: 2 }],
  ['B.NS', { price: 90, changePct: -1 }],
]);

const ranked = [
  { symbol: 'A.NS', rank: 2, rs: 6 },
  { symbol: 'B.NS', rank: 40, rs: -3 },
];

describe('selectPortfolioView', () => {
  it('reports an empty portfolio as empty, with no fabricated totals', () => {
    const view = selectPortfolioView({ positions: [], priceBySymbol: prices });
    expect(view.isEmpty).toBe(true);
    expect(view.totals).toBeNull();
  });

  it('values holdings and computes profit and loss', () => {
    const view = selectPortfolioView({ positions: [position()], priceBySymbol: prices });
    expect(view.totals.invested).toBe(1000);
    expect(view.totals.currentValue).toBe(1200);
    expect(view.totals.pnl).toBe(200);
    expect(view.totals.pnlPct).toBeCloseTo(20, 6);
  });

  it('EXCLUDES an unpriced holding instead of valuing it at zero or at cost', () => {
    // Zero fabricates a total loss; cost fabricates a break-even. Both
    // misstate the total with equal confidence.
    const view = selectPortfolioView({
      positions: [position(), position({ id: 'p2', symbol: 'ZZZ.NS', name: 'Z Ltd' })],
      priceBySymbol: prices,
    });
    expect(view.hasExclusions).toBe(true);
    expect(view.excluded).toHaveLength(1);
    expect(view.totals.currentValue).toBe(1200);
    expect(view.totals.positionCount).toBe(1);
  });

  it('reports Top-5 status per holding — a STATUS, never advice', () => {
    const view = selectPortfolioView({
      positions: [position(), position({ id: 'p2', symbol: 'B.NS', name: 'B Ltd' })],
      priceBySymbol: prices,
      ranked,
    });
    const a = view.positions.find((p) => p.symbol === 'A.NS');
    const b = view.positions.find((p) => p.symbol === 'B.NS');
    expect(a.status.label).toBe('In Top 5');
    expect(b.status.label).toBe('No longer in Top 5');

    for (const p of view.positions) {
      expect(String(p.status.label).toLowerCase()).not.toMatch(/\bbuy\b|\bsell\b|should|recommend/);
    }
  });

  it('marks a stock outside every universe as unknown, not as dropped out', () => {
    const view = selectPortfolioView({ positions: [position({ symbol: 'B.NS' })], priceBySymbol: prices, ranked: [] });
    expect(view.positions[0].status.label).toBeNull();
  });

  it('combines lots at weighted-average cost for display only', () => {
    const view = selectPortfolioView({
      positions: [position(), position({ id: 'p2', quantity: 30, purchasePrice: 200 })],
      priceBySymbol: prices,
    });
    expect(view.positions).toHaveLength(1);
    expect(view.positions[0].quantity).toBe(40);
    expect(view.positions[0].purchasePrice).toBeCloseTo((10 * 100 + 30 * 200) / 40, 6);
    expect(view.positions[0].lotLabel).toBe('2 purchases');
  });

  it('can show lots separately when asked', () => {
    const view = selectPortfolioView({
      positions: [position(), position({ id: 'p2', quantity: 30, purchasePrice: 200 })],
      priceBySymbol: prices,
      combineLots: false,
    });
    expect(view.positions).toHaveLength(2);
  });

  it('weights by CURRENT value, so weights sum to 100%', () => {
    const view = selectPortfolioView({
      positions: [position(), position({ id: 'p2', symbol: 'B.NS', name: 'B Ltd', quantity: 5, purchasePrice: 50 })],
      priceBySymbol: prices,
    });
    const total = view.positions.reduce((sum, p) => sum + p.weightPct, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('carries NO strategy figure — the two records never mix', () => {
    const view = selectPortfolioView({ positions: [position()], priceBySymbol: prices, ranked });
    for (const key of ['outperformancePct', 'strategyReturnPct', 'benchmarkReturnPct', 'maxDrawdownPct', 'cagr']) {
      expect(view.totals[key], `${key} leaked into the personal totals`).toBeUndefined();
    }
  });
});

describe('selectUniversePositions', () => {
  it('returns NULL when the user holds nothing in this universe', () => {
    // The block renders nothing at all — not an empty card, not a prompt.
    // Someone who does not want portfolio tracking is never nagged into it.
    expect(selectUniversePositions({ positions: [], universeKey: 'nifty50', priceBySymbol: prices })).toBeNull();
    expect(
      selectUniversePositions({
        positions: [position({ universeKey: 'midcap150' })],
        universeKey: 'nifty50',
        priceBySymbol: prices,
      }),
    ).toBeNull();
  });

  it('summarises only the holdings belonging to this universe', () => {
    const summary = selectUniversePositions({
      positions: [position(), position({ id: 'p2', symbol: 'B.NS', universeKey: 'midcap150' })],
      universeKey: 'nifty50',
      priceBySymbol: prices,
      ranked,
    });
    expect(summary.count).toBe(1);
    expect(summary.direction).toBe('gain');
  });

  it('flags holdings that have dropped out of the Top 5', () => {
    const summary = selectUniversePositions({
      positions: [position({ symbol: 'B.NS', name: 'B Ltd' })],
      universeKey: 'nifty50',
      priceBySymbol: prices,
      ranked,
    });
    expect(summary.droppedOut).toBe(1);
  });
});
