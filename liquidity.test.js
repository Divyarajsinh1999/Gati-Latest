/**
 * LIQUIDITY (D24).
 *
 * The failure mode is a green light on an order that cannot fill. So the
 * cases below are the ones where a careless implementation says "fine".
 */

import { describe, it, expect } from 'vitest';
import { assessLiquidity, assessPortfolioLiquidity, LIQUIDITY_THRESHOLDS } from '../liquidity.js';

describe('the measure is traded VALUE, not share count', () => {
  it('treats an equal share count very differently at different prices', () => {
    /*
      10,000 shares of a Rs 400 stock = Rs 40 lakh of turnover.
      10,000 shares of a Rs 4,000 stock = Rs 4 crore.

      A Rs 1 lakh order is 2.5% of the first and 0.25% of the second. An
      implementation comparing SHARE counts would call them identical, which
      is the whole reason value is used.
    */
    const cheap = assessLiquidity({ orderValue: 100000, volume: 10000, price: 400 });
    const dear = assessLiquidity({ orderValue: 100000, volume: 10000, price: 4000 });
    expect(cheap.sharePct).toBeCloseTo(2.5, 6);
    expect(dear.sharePct).toBeCloseTo(0.25, 6);
  });
});

describe('the thresholds', () => {
  it('stays quiet on an order that is noise in the day\'s flow', () => {
    // Rs 10,000 against Rs 400 crore of turnover — 0.00025%.
    const r = assessLiquidity({ orderValue: 10000, volume: 1000000, price: 4000 });
    expect(r.severity).toBe('ok');
  });

  it('notices at 1% and warns at 5%', () => {
    const daily = { volume: 10000, price: 400 }; // Rs 40 lakh
    // Exactly 1% = Rs 40,000; exactly 5% = Rs 2,00,000.
    expect(assessLiquidity({ orderValue: 40000, ...daily }).severity).toBe('notice');
    expect(assessLiquidity({ orderValue: 200000, ...daily }).severity).toBe('warn');
    // Just under each boundary stays in the lower band.
    expect(assessLiquidity({ orderValue: 39999, ...daily }).severity).toBe('ok');
    expect(assessLiquidity({ orderValue: 199999, ...daily }).severity).toBe('notice');
  });

  it('exports the thresholds rather than burying them', () => {
    // They are judgement, not fact, so they are inspectable.
    expect(LIQUIDITY_THRESHOLDS.noticePct).toBe(1);
    expect(LIQUIDITY_THRESHOLDS.warnPct).toBe(5);
  });
});

describe('missing data is never a pass', () => {
  it('returns null when volume is unknown', () => {
    /*
      A stock whose volume did not come back is one this cannot speak about.
      Returning 'ok' would be the app calculating around a gap — the exact
      thing the standing rules forbid.
    */
    for (const volume of [null, undefined, 0, NaN, -5]) {
      expect(assessLiquidity({ orderValue: 100000, volume, price: 400 })).toBeNull();
    }
  });

  it('returns null when there is no order to place', () => {
    expect(assessLiquidity({ orderValue: 0, volume: 10000, price: 400 })).toBeNull();
    expect(assessLiquidity({ orderValue: null, volume: 10000, price: 400 })).toBeNull();
  });

  it('labels its basis as a single session, not an average', () => {
    // One day is not an average: quiet days understate, news days overstate.
    // The UI must be able to qualify the claim.
    expect(assessLiquidity({ orderValue: 100000, volume: 10000, price: 400 }).basis)
      .toBe('latest');
  });
});

describe('across a whole set of positions', () => {
  const positions = [
    { symbol: 'THIN', orderValue: 500000, volume: 10000, price: 400 },   // 12.5% → warn
    { symbol: 'MID', orderValue: 60000, volume: 10000, price: 400 },     // 1.5%  → notice
    { symbol: 'DEEP', orderValue: 10000, volume: 1000000, price: 4000 }, // tiny  → ok
  ];

  it('surfaces the worst case and every flagged name', () => {
    const r = assessPortfolioLiquidity(positions);
    expect(r.worst.symbol).toBe('THIN');
    expect(r.flagged.map((f) => f.symbol)).toEqual(['THIN', 'MID']);
    expect(r.hasConcern).toBe(true);
  });

  it('does not report a concern when every order is small', () => {
    const r = assessPortfolioLiquidity([positions[2]]);
    expect(r.hasConcern).toBe(false);
    expect(r.flagged).toHaveLength(0);
  });

  it('counts unmeasurable positions separately rather than as liquid', () => {
    /*
      Three names with no volume must not read as "all clear" — the same
      reasoning as an unclassified sector not counting as diversification.
    */
    const r = assessPortfolioLiquidity([
      positions[2],
      { symbol: 'X', orderValue: 10000, volume: null, price: 100 },
      { symbol: 'Y', orderValue: 10000, volume: null, price: 100 },
    ]);
    expect(r.unknownCount).toBe(2);
    expect(r.hasConcern).toBe(false);
  });

  it('survives an empty or malformed set', () => {
    for (const bad of [[], null, undefined]) {
      const r = assessPortfolioLiquidity(bad);
      expect(r.hasConcern).toBe(false);
      expect(r.worst).toBeNull();
    }
  });
});
