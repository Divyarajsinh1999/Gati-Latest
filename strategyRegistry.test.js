import { describe, it, expect } from 'vitest';
import { runBacktest } from '../backtestEngine.js';
import { STRATEGIES, STRATEGY_KEYS, getStrategy, findStrategy, strategyParams, strategiesForUniverse } from '../../config/strategies.js';
import { UNIVERSE_KEYS } from '../../config/universes.js';

/**
 * Phase 4 groundwork: the engine can now measure over a window longer than
 * one month, and strategies are registered as data rather than hardcoded.
 *
 * The most important test here is the FIRST one — that lookbackMonths=1
 * reproduces the shipped behaviour exactly. A parameterisation that quietly
 * shifts existing backtest results would be far worse than no
 * parameterisation at all (spec Section 38).
 */

function bar(date, price) {
  return { date, open: price, high: price, low: price, close: price, adjClose: price, volume: 1000 };
}

/**
 * Six month-ends with explicit price paths, chosen so the 1-month and
 * 3-month windows pick DIFFERENT winners. Written out rather than generated
 * from a formula because the first attempt used a formula whose late spurt
 * (+60% over three months) happened to win both windows — the fixture has to
 * be verified by hand, or the test proves nothing.
 *
 * Measured at the final signal (2025-06):
 *   STEADY  1-month +8.3%   3-month +30.0%   <- wins the long window
 *   LATE    1-month +18.0%  3-month  -1.7%   <- wins the short window
 *   FADE    1-month -3.8%   3-month -16.7%
 * The benchmark barely moves, so RS preserves that ordering.
 */
function fixture() {
  const monthEnds = ['2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-30', '2025-06-30'];
  const series = (prices) => monthEnds.map((d, i) => bar(d, prices[i]));

  return {
    stocks: [
      { symbol: 'STEADY.NS', name: 'Steady Climber' },
      { symbol: 'LATE.NS', name: 'Late Spurt' },
      { symbol: 'FADE.NS', name: 'Fader' },
    ],
    priceSeriesMap: new Map([
      ['STEADY.NS', series([90, 95, 100, 110, 120, 130])],
      ['LATE.NS', series([90, 100, 120, 100, 100, 118])],
      ['FADE.NS', series([90, 130, 150, 140, 130, 125])],
    ]),
    benchmarkSeries: series([100, 101, 102, 103, 104, 105]),
  };
}

describe('runBacktest — lookbackMonths', () => {
  it('defaults to 1 and reproduces the shipped result exactly', () => {
    const f = fixture();
    const withDefault = runBacktest({ ...f, topN: 2 });
    const withExplicitOne = runBacktest({ ...f, topN: 2, lookbackMonths: 1 });
    // Deep equality, not spot checks: the whole point is bit-identity.
    expect(withExplicitOne.cycles).toEqual(withDefault.cycles);
    expect(withExplicitOne.equityCurve).toEqual(withDefault.equityCurve);
    expect(withExplicitOne.rankingHistory).toEqual(withDefault.rankingHistory);
  });

  it('skips more early months as the window lengthens', () => {
    const f = fixture();
    const one = runBacktest({ ...f, topN: 2, lookbackMonths: 1 });
    const three = runBacktest({ ...f, topN: 2, lookbackMonths: 3 });
    // 6 month-ends: a 1-month window can rank from the 2nd onward (5 signals),
    // a 3-month window only from the 4th (3 signals).
    expect(one.rankingHistory).toHaveLength(5);
    expect(three.rankingHistory).toHaveLength(3);
    expect(three.rankingHistory[0].monthKey).toBe('2025-04');
  });

  it('actually measures over the longer window — different picks, not just fewer', () => {
    const f = fixture();
    const one = runBacktest({ ...f, topN: 1, lookbackMonths: 1 });
    const three = runBacktest({ ...f, topN: 1, lookbackMonths: 3 });
    const lastOf = (r) => r.rankingHistory[r.rankingHistory.length - 1];
    const topOne = lastOf(one).rankings.find((x) => x.rank === 1).symbol;
    const topThree = lastOf(three).rankings.find((x) => x.rank === 1).symbol;
    // Both windows end at the same 2025-06 signal, so any difference is the
    // window itself and nothing else.
    expect(topOne).toBe('LATE.NS');    // biggest one-month move
    expect(topThree).toBe('STEADY.NS'); // biggest three-month move
  });

  it('flags rather than fabricating when history is shorter than the window', () => {
    const f = fixture();
    const result = runBacktest({ ...f, topN: 2, lookbackMonths: 12 });
    expect(result.cycles).toHaveLength(0);
    expect(result.rankingHistory).toEqual([]);
    expect(result.flags.length).toBeGreaterThan(0);
  });
});

describe('strategy registry', () => {
  it('registers exactly 4 rules × 3 universes = 12 strategies', () => {
    // 1M (the shipped rule) + 3M/6M/12M, added 2 Aug 2026 by explicit user
    // decision — see the file header in config/strategies.js for why this
    // number changed from "1 per universe" to this.
    expect(STRATEGY_KEYS).toHaveLength(UNIVERSE_KEYS.length * 4);
  });

  it('keeps the universe key as the strategy key ONLY for the 1-month rule, so existing routes stay valid', () => {
    for (const key of UNIVERSE_KEYS) {
      expect(STRATEGIES[key]).toBeDefined();
      expect(STRATEGIES[key].universeKey).toBe(key);
      expect(STRATEGIES[key].lookbackMonths).toBe(1);
      expect(STRATEGIES[key].ruleKey).toBe('rs-1m');
    }
  });

  it('gives every longer-lookback strategy a universe-suffixed key, never colliding with the bare universe key', () => {
    for (const universeKey of UNIVERSE_KEYS) {
      for (const ruleKey of ['rs-3m', 'rs-6m', 'rs-12m']) {
        const key = `${universeKey}-${ruleKey}`;
        expect(STRATEGIES[key]).toBeDefined();
        expect(STRATEGIES[key].key).toBe(key);
        expect(STRATEGIES[key].universeKey).toBe(universeKey);
        expect(STRATEGIES[key].ruleKey).toBe(ruleKey);
      }
    }
  });

  it('assigns the correct lookbackMonths per rule, and TOP_N for every strategy regardless of window', () => {
    const expected = { 'rs-1m': 1, 'rs-3m': 3, 'rs-6m': 6, 'rs-12m': 12 };
    for (const key of STRATEGY_KEYS) {
      const s = STRATEGIES[key];
      expect(s.lookbackMonths).toBe(expected[s.ruleKey]);
      expect(s.topN).toBe(5);
    }
  });

  it('exposes engine-ready params and throws loudly on an unknown key', () => {
    expect(strategyParams(UNIVERSE_KEYS[0])).toEqual({ lookbackMonths: 1, topN: 5 });
    expect(strategyParams('nifty50-rs-6m')).toEqual({ lookbackMonths: 6, topN: 5 });
    expect(() => getStrategy('does-not-exist')).toThrow(/Unknown strategy/);
  });

  it('findStrategy returns undefined instead of throwing, for UI code that needs to redirect rather than crash', () => {
    expect(findStrategy('does-not-exist')).toBeUndefined();
    expect(findStrategy('nifty50-rs-3m')).toBeDefined();
  });

  it('gives each strategy a plain-language description naming its benchmark', () => {
    for (const key of STRATEGY_KEYS) {
      expect(STRATEGIES[key].description).toMatch(/rebalanced monthly/);
      expect(STRATEGIES[key].description.length).toBeGreaterThan(40);
    }
  });

  it('strategiesForUniverse returns all 4 windows for a universe, ordered shortest to longest', () => {
    const list = strategiesForUniverse('midcap150');
    expect(list.map((s) => s.lookbackMonths)).toEqual([1, 3, 6, 12]);
    expect(list.every((s) => s.universeKey === 'midcap150')).toBe(true);
  });

  it('strategiesForUniverse returns nothing for an unknown universe', () => {
    expect(strategiesForUniverse('does-not-exist')).toEqual([]);
  });
});
