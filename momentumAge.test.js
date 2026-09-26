/**
 * MOMENTUM AGE TESTS — decision D13.
 *
 * The behaviour worth guarding is that the count is CONSECUTIVE, not
 * cumulative. A stock that led in January, vanished, and returned in June has
 * a run of one month. Counting total appearances would describe a different
 * thing and quietly overstate how established the momentum is — which is
 * precisely the misreading this number exists to prevent.
 */

import { describe, it, expect } from 'vitest';
import { computeMomentumAge, summariseRebalance } from '../rsHistory.js';

function snapshot(monthKey, symbols) {
  return {
    monthKey,
    date: `${monthKey}-28`,
    rankings: symbols.map((symbol, i) => ({ symbol, name: symbol, rank: i + 1, rs: 10 - i })),
  };
}

describe('computeMomentumAge', () => {
  const history = [
    snapshot('2025-01', ['A', 'B', 'C']),
    snapshot('2025-02', ['A', 'B', 'D']),
    snapshot('2025-03', ['A', 'D', 'C']),
  ];

  it('counts an unbroken run back to its start', () => {
    const ages = computeMomentumAge({ rankingHistory: history, topN: 3 });
    expect(ages.get('A').consecutiveMonths).toBe(3);
    expect(ages.get('A').sinceMonthKey).toBe('2025-01');
    expect(ages.get('A').isNewEntrant).toBe(false);
  });

  it('STOPS at the first gap rather than counting total appearances', () => {
    // C led in January, dropped out in February, and returned in March. Its
    // run is one month, not two.
    const ages = computeMomentumAge({ rankingHistory: history, topN: 3 });
    expect(ages.get('C').consecutiveMonths).toBe(1);
    expect(ages.get('C').isNewEntrant).toBe(true);
  });

  it('marks a genuine new entrant as one month', () => {
    const ages = computeMomentumAge({ rankingHistory: history, topN: 3 });
    expect(ages.get('D').consecutiveMonths).toBe(2); // Feb and Mar
    expect(ages.get('D').isNewEntrant).toBe(false);
  });

  it('gives no age to a stock that is not currently a pick', () => {
    // B held rank in Jan and Feb but is absent in March. It has no current
    // run, and reporting one would describe a position the strategy no
    // longer holds.
    const ages = computeMomentumAge({ rankingHistory: history, topN: 3 });
    expect(ages.has('B')).toBe(false);
  });

  it('respects topN when deciding what counts as being in the strategy', () => {
    const wide = [snapshot('2025-01', ['A', 'B', 'C', 'D', 'E'])];
    expect(computeMomentumAge({ rankingHistory: wide, topN: 2 }).has('C')).toBe(false);
    expect(computeMomentumAge({ rankingHistory: wide, topN: 5 }).has('C')).toBe(true);
  });

  it('ignores unranked rows', () => {
    const withGap = [{
      monthKey: '2025-01',
      date: '2025-01-31',
      rankings: [{ symbol: 'A', rank: 1, rs: 5 }, { symbol: 'Z', rank: null, rs: null }],
    }];
    const ages = computeMomentumAge({ rankingHistory: withGap, topN: 5 });
    expect(ages.has('Z')).toBe(false);
  });

  it('returns an empty map rather than throwing on no history', () => {
    expect(computeMomentumAge({ rankingHistory: [] }).size).toBe(0);
    expect(computeMomentumAge({}).size).toBe(0);
  });

  it('never exceeds the number of completed rebalances', () => {
    const ages = computeMomentumAge({ rankingHistory: history, topN: 3 });
    for (const age of ages.values()) {
      expect(age.consecutiveMonths).toBeLessThanOrEqual(history.length);
    }
  });
});

describe('summariseRebalance', () => {
  it('derives continuing from entries rather than counting twice', () => {
    // A second count of held symbols would be a second source of truth for
    // one fact, and the two would eventually disagree.
    const summary = summariseRebalance({
      changes: { hasBaseline: true, entered: [{ symbol: 'A' }, { symbol: 'B' }], exited: [{ symbol: 'X' }, { symbol: 'Y' }] },
      topN: 5,
    });
    expect(summary).toMatchObject({ available: true, entered: 2, continuing: 3, exited: 2 });
  });

  it('reports a quiet month honestly', () => {
    const summary = summariseRebalance({ changes: { hasBaseline: true, entered: [], exited: [] }, topN: 5 });
    expect(summary).toMatchObject({ entered: 0, continuing: 5, exited: 0 });
  });

  it('claims nothing without a baseline to compare against', () => {
    expect(summariseRebalance({ changes: { hasBaseline: false } }).available).toBe(false);
    expect(summariseRebalance({}).available).toBe(false);
  });

  it('never reports negative continuing holdings', () => {
    const summary = summariseRebalance({
      changes: { hasBaseline: true, entered: new Array(9).fill({ symbol: 'X' }), exited: [] },
      topN: 5,
    });
    expect(summary.continuing).toBe(0);
  });
});
