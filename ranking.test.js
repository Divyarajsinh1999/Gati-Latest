import { describe, it, expect } from 'vitest';
import { rankByRS, selectTopN } from '../ranking.js';

const item = (symbol, rs, stockReturnPct = rs) => ({ symbol, name: symbol, rs, stockReturnPct, benchmarkReturnPct: 0, flags: [] });

describe('rankByRS', () => {
  it('sorts highest RS first and assigns rank 1..N (spec Section 10)', () => {
    const ranked = rankByRS([item('B', -2), item('C', 10), item('A', 0), item('D', 5)]);
    expect(ranked.map((r) => r.symbol)).toEqual(['C', 'D', 'A', 'B']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('breaks exact RS ties by higher raw stock return, then alphabetically by symbol', () => {
    const ranked = rankByRS([
      item('ZEE', 5, 5.5),
      item('ABC', 5, 5.5), // same RS, same stockReturn as ZEE -> alphabetical decides
      item('MID', 5, 6.0), // same RS but higher raw return -> should come first
    ]);
    expect(ranked.map((r) => r.symbol)).toEqual(['MID', 'ABC', 'ZEE']);
  });

  it('sorts items with null RS to the bottom with rank: null, without dropping them', () => {
    const ranked = rankByRS([item('GOOD', 3), { symbol: 'BAD', name: 'BAD', rs: null, stockReturnPct: null, flags: ['Missing Data'] }]);
    expect(ranked).toHaveLength(2);
    expect(ranked.find((r) => r.symbol === 'GOOD').rank).toBe(1);
    expect(ranked.find((r) => r.symbol === 'BAD').rank).toBeNull();
  });
});

describe('selectTopN', () => {
  it('selects the top 5 by rank (spec Section 11)', () => {
    const ranked = rankByRS(['A', 'B', 'C', 'D', 'E', 'F'].map((s, i) => item(s, 10 - i)));
    const { picks, isShort, shortfall } = selectTopN(ranked, 5);
    expect(picks.map((p) => p.symbol)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(isShort).toBe(false);
    expect(shortfall).toBe(0);
  });

  it('flags a shortfall instead of silently pretending N were selected', () => {
    const ranked = rankByRS([item('A', 1), item('B', 2)]);
    const { picks, isShort, shortfall } = selectTopN(ranked, 5);
    expect(picks).toHaveLength(2);
    expect(isShort).toBe(true);
    expect(shortfall).toBe(3);
  });
});
