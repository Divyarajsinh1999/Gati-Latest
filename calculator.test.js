import { describe, it, expect } from 'vitest';
import { computeCalculatorResult, holdingsFromCurrentPicks, holdingsFromStrategyPosition, holdingsFromChosenDate } from '../calculator.js';

const holding = (symbol, entryPrice, markPrice) => ({ symbol, name: `${symbol} Ltd`, entryPrice, markPrice });

describe('computeCalculatorResult — sizing and reconciliation', () => {
  const holdings = [
    holding('A', 1000, 1000),
    holding('B', 500, 500),
    holding('C', 250, 250),
    holding('D', 3000, 3000),
    holding('E', 120, 120),
  ];

  it('reconciles exactly: invested + remaining cash === capital', () => {
    const r = computeCalculatorResult({ holdings, capital: 50_000 });
    expect(r.totalInvested + r.remainingCash).toBeCloseTo(50_000, 6);
  });

  it('allocates ₹10,000 per stock across 5 holdings and floors to whole shares', () => {
    const r = computeCalculatorResult({ holdings, capital: 50_000 });
    expect(r.positions).toHaveLength(5);
    expect(r.positions.find((p) => p.symbol === 'A').shares).toBe(10); // 10000/1000
    expect(r.positions.find((p) => p.symbol === 'D').shares).toBe(3); // floor(10000/3000)
  });

  it('reports zero P&L when entry equals mark', () => {
    const r = computeCalculatorResult({ holdings, capital: 50_000 });
    expect(r.portfolioValue).toBeCloseTo(50_000, 6);
    expect(r.pnl).toBeCloseTo(0, 6);
    expect(r.returnPct).toBeCloseTo(0, 6);
  });

  it('produces hand-checkable P&L when marked above entry', () => {
    // entry 100 -> floor(10000/100) = 100 shares, invested 10,000, cash 0.
    // marked at 110 -> 11,000. P&L +1,000 = +10%.
    const r = computeCalculatorResult({ holdings: [holding('X', 100, 110)], capital: 10_000 });
    expect(r.positions[0].shares).toBe(100);
    expect(r.portfolioValue).toBeCloseTo(11_000, 6);
    expect(r.pnl).toBeCloseTo(1_000, 6);
    expect(r.returnPct).toBeCloseTo(10, 6);
  });

  it('reports a loss when marked below entry', () => {
    const r = computeCalculatorResult({ holdings: [holding('Y', 100, 90)], capital: 10_000 });
    expect(r.pnl).toBeCloseTo(-1_000, 6);
    expect(r.returnPct).toBeCloseTo(-10, 6);
  });

  it('counts leftover flooring cash in portfolio value so it is never silently lost', () => {
    // entry 300 -> floor(10000/300) = 33 shares, invested 9,900, cash 100.
    const r = computeCalculatorResult({ holdings: [holding('Z', 300, 300)], capital: 10_000 });
    expect(r.positions[0].shares).toBe(33);
    expect(r.remainingCash).toBeCloseTo(100, 6);
    expect(r.portfolioValue).toBeCloseTo(10_000, 6);
    expect(r.pnl).toBeCloseTo(0, 6);
  });
});

describe('computeCalculatorResult — missing/invalid data (spec Section 41)', () => {
  it('excludes holdings with a missing mark price rather than treating it as zero', () => {
    const r = computeCalculatorResult({ holdings: [holding('OK', 100, 110), holding('NOPRICE', 100, null)], capital: 10_000 });
    expect(r.pricedCount).toBe(1);
    expect(r.excludedCount).toBe(1);
    expect(r.positions.map((p) => p.symbol)).toEqual(['OK']);
  });

  it('excludes holdings priced at zero or negative rather than dividing by them', () => {
    const r = computeCalculatorResult({ holdings: [holding('BAD', 0, 0), holding('GOOD', 100, 100)], capital: 10_000 });
    expect(r.excludedCount).toBe(1);
    expect(r.positions.map((p) => p.symbol)).toEqual(['GOOD']);
  });

  it('returns a safe zero-state for empty holdings or non-positive capital instead of throwing', () => {
    expect(computeCalculatorResult({ holdings: [], capital: 50_000 }).portfolioValue).toBe(50_000);
    expect(computeCalculatorResult({ holdings: [holding('A', 100, 100)], capital: 0 }).positions).toEqual([]);
    expect(computeCalculatorResult({}).pnl).toBe(0);
  });
});

describe('holdingsFromCurrentPicks', () => {
  it('sets entry equal to mark, so a not-yet-made purchase shows no P&L', () => {
    const holdings = holdingsFromCurrentPicks([{ symbol: 'A.NS', name: 'A', currentPrice: 250 }]);
    expect(holdings[0].entryPrice).toBe(250);
    expect(holdings[0].markPrice).toBe(250);
    expect(computeCalculatorResult({ holdings, capital: 10_000 }).pnl).toBeCloseTo(0, 6);
  });
});

describe('holdingsFromStrategyPosition — look-ahead bias regression guard', () => {
  const positions = [
    { symbol: 'A.NS', name: 'A Ltd', entryPrice: 100 },
    { symbol: 'B.NS', name: 'B Ltd', entryPrice: 200 },
  ];

  it('uses the strategy\'s ACTUAL entry price, not a back-dated month-end price', () => {
    // This is the regression guard for a real bug. A previous version offered
    // a "held since last month-end" basis that priced TODAY's Top 5 at the
    // previous month-end close. But today's Top 5 are today's Top 5 *because*
    // they rose this month, so back-dating their entry manufactures a gain
    // that was never capturable — look-ahead bias, forbidden by Section 40.
    //
    // The correct entry is the price at which the strategy actually bought,
    // chosen from the PRIOR month-end ranking. That price must come from the
    // position itself and from nowhere else.
    const marks = new Map([['A.NS', 110], ['B.NS', 190]]);
    const holdings = holdingsFromStrategyPosition(positions, marks);

    expect(holdings.map((h) => h.entryPrice)).toEqual([100, 200]);
    expect(holdings.map((h) => h.markPrice)).toEqual([110, 190]);
    // Crucially: no field named after a month-end price is consulted at all.
    expect(Object.keys(holdings[0])).not.toContain('previousMonthEndPrice');
  });

  it('marks to the supplied current prices and produces a real, achievable figure', () => {
    // A: entry 100, mark 110 -> 50 shares on ₹5,000 -> 5,500
    // B: entry 200, mark 190 -> 25 shares on ₹5,000 -> 4,750
    // total 10,250 on 10,000 = +2.5%
    const marks = new Map([['A.NS', 110], ['B.NS', 190]]);
    const r = computeCalculatorResult({ holdings: holdingsFromStrategyPosition(positions, marks), capital: 10_000 });
    expect(r.portfolioValue).toBeCloseTo(10_250, 6);
    expect(r.returnPct).toBeCloseTo(2.5, 6);
  });

  it('yields a null mark for a symbol with no current price, which the core then excludes', () => {
    const holdings = holdingsFromStrategyPosition(positions, new Map([['A.NS', 110]]));
    expect(holdings.find((h) => h.symbol === 'B.NS').markPrice).toBeNull();
    const r = computeCalculatorResult({ holdings, capital: 10_000 });
    expect(r.excludedCount).toBe(1);
    expect(r.pricedCount).toBe(1);
  });

  it('returns an empty list when the strategy holds nothing yet', () => {
    expect(holdingsFromStrategyPosition([], new Map())).toEqual([]);
    expect(holdingsFromStrategyPosition(undefined, undefined)).toEqual([]);
  });
});

describe('holdingsFromChosenDate — the third entry basis (Phase 3.2)', () => {
  /**
   * The property that matters most here is NEGATIVE: the picks must come
   * from a ranking that predates the chosen date. Getting this wrong
   * reintroduces exactly the look-ahead bias that got the earlier
   * "held since last month-end" mode deleted in v0.8.0.
   */
  const rankingHistory = [
    {
      monthKey: '2025-01',
      date: '2025-01-31',
      rankings: [
        { symbol: 'OLD1.NS', name: 'Old One', rank: 1, rs: 12 },
        { symbol: 'OLD2.NS', name: 'Old Two', rank: 2, rs: 8 },
        { symbol: 'LATER.NS', name: 'Later Winner', rank: 40, rs: -9 },
      ],
    },
    {
      monthKey: '2025-02',
      date: '2025-02-28',
      rankings: [
        { symbol: 'LATER.NS', name: 'Later Winner', rank: 1, rs: 30 },
        { symbol: 'OLD1.NS', name: 'Old One', rank: 2, rs: 5 },
      ],
    },
  ];

  const priceSeriesMap = new Map([
    ['OLD1.NS', [{ date: '2025-02-03', open: 100, close: 101 }, { date: '2025-03-03', open: 130, close: 131 }]],
    ['OLD2.NS', [{ date: '2025-02-03', open: 50, close: 51 }, { date: '2025-03-03', open: 55, close: 56 }]],
    ['LATER.NS', [{ date: '2025-02-03', open: 20, close: 21 }, { date: '2025-03-03', open: 90, close: 91 }]],
  ]);

  const currentPriceBySymbol = new Map([['OLD1.NS', 150], ['OLD2.NS', 60], ['LATER.NS', 200]]);

  it('uses the last ranking BEFORE the chosen date, not the one after it', () => {
    // Chosen date sits between the Jan and Feb signals. LATER.NS ranked 1st
    // in February — but that was not knowable on 3 Feb, so it must NOT be
    // picked. This is the whole look-ahead guard in one assertion.
    const built = holdingsFromChosenDate({
      rankingHistory, priceSeriesMap, currentPriceBySymbol, date: '2025-02-03', topN: 2,
    });
    expect(built.signalMonthKey).toBe('2025-01');
    expect(built.holdings.map((h) => h.symbol)).toEqual(['OLD1.NS', 'OLD2.NS']);
    expect(built.holdings.some((h) => h.symbol === 'LATER.NS')).toBe(false);
  });

  it('enters at the open on or after the chosen date, per the Section 15 convention', () => {
    const built = holdingsFromChosenDate({
      rankingHistory, priceSeriesMap, currentPriceBySymbol, date: '2025-02-03', topN: 2,
    });
    expect(built.entryDate).toBe('2025-02-03');
    expect(built.holdings[0].entryPrice).toBe(100); // open, not close
    expect(built.holdings[0].markPrice).toBe(150);
  });

  it('rolls a non-trading chosen date forward to the next available bar', () => {
    // 2025-02-01 was a Saturday; the first real bar is the 3rd.
    const built = holdingsFromChosenDate({
      rankingHistory, priceSeriesMap, currentPriceBySymbol, date: '2025-02-01', topN: 2,
    });
    expect(built.entryDate).toBe('2025-02-03');
  });

  it('refuses, with a reason, when no ranking predates the chosen date', () => {
    const built = holdingsFromChosenDate({
      rankingHistory, priceSeriesMap, currentPriceBySymbol, date: '2025-01-05', topN: 2,
    });
    expect(built.holdings).toHaveLength(0);
    expect(built.reason).toMatch(/no completed month-end ranking/i);
  });

  it('refuses, with a reason, when no date is chosen yet', () => {
    const built = holdingsFromChosenDate({ rankingHistory, priceSeriesMap, currentPriceBySymbol, date: '' });
    expect(built.holdings).toHaveLength(0);
    expect(built.reason).toMatch(/choose a date/i);
  });

  it('feeds computeCalculatorResult to produce a real, achievable P&L', () => {
    const built = holdingsFromChosenDate({
      rankingHistory, priceSeriesMap, currentPriceBySymbol, date: '2025-02-03', topN: 2,
    });
    const result = computeCalculatorResult({ holdings: built.holdings, capital: 10_000 });
    expect(result.positions.length).toBe(2);
    // Both picks rose (100->150, 50->60), so P&L must be positive but finite.
    expect(result.pnl).toBeGreaterThan(0);
    expect(result.returnPct).toBeLessThan(100);
  });
});
