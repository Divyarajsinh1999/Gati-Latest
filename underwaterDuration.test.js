/**
 * UNDERWATER DURATION (D24).
 *
 * Every expectation is worked out from the series by hand in a comment before
 * it is asserted. Recording whatever the function returned would check nothing
 * — and this is a metric where an off-by-one is both easy and invisible,
 * because nobody counts eight months along a chart to verify it.
 */

import { describe, it, expect } from 'vitest';
import { calculateUnderwaterDuration, calculateMaxDrawdown } from '../metrics.js';

describe('a record that only rises', () => {
  it('is never underwater', () => {
    // 100 101 102 103 — every value is a new peak.
    const r = calculateUnderwaterDuration([100, 101, 102, 103]);
    expect(r.longestPeriods).toBe(0);
    expect(r.isUnderwaterNow).toBe(false);
  });
});

describe('a dip that recovers', () => {
  it('counts only the periods below the old peak', () => {
    /*
        idx    0    1    2    3
        val  100   90   95  105
        peak 100  100  100  105
        under  -    y    y    -    → run of 2, then a new high
    */
    const r = calculateUnderwaterDuration([100, 90, 95, 105]);
    expect(r.longestPeriods).toBe(2);
    expect(r.currentPeriods).toBe(0);
    expect(r.isUnderwaterNow).toBe(false);
    expect(r.longestStartIndex).toBe(1);
    expect(r.longestEndIndex).toBe(2);
  });

  it('treats a return to exactly the old peak as recovered', () => {
    // 100 90 100 — index 2 equals the peak, so it is NOT underwater.
    const r = calculateUnderwaterDuration([100, 90, 100]);
    expect(r.longestPeriods).toBe(1);
    expect(r.isUnderwaterNow).toBe(false);
  });
});

describe('a record still underwater at the end', () => {
  it('reports the open run rather than discarding it', () => {
    /*
        idx    0    1    2    3    4
        val  100  120  110  105  108
        peak 100  120  120  120  120
        under  -    -    y    y    y   → run of 3, never closed

      An implementation that only records a run when it RECOVERS reports 0
      here: the worst case, silently invisible.
    */
    const r = calculateUnderwaterDuration([100, 120, 110, 105, 108]);
    expect(r.longestPeriods).toBe(3);
    expect(r.currentPeriods).toBe(3);
    expect(r.isUnderwaterNow).toBe(true);
  });

  it('prefers the open run when it exceeds an earlier closed one', () => {
    /*
      100 95 100 130 120 118 115 112
        first run:  idx 1           → 1 period, recovered at idx 2
        second run: idx 4,5,6,7     → 4 periods, still open

      Reporting 1 here would be the specific bug: a trivial early dip
      shadowing the drawdown the reader is actually sitting in.
    */
    const r = calculateUnderwaterDuration([100, 95, 100, 130, 120, 118, 115, 112]);
    expect(r.longestPeriods).toBe(4);
    expect(r.longestPeriods).not.toBe(1);
    expect(r.currentPeriods).toBe(4);
  });
});

describe('duration and depth are different questions', () => {
  it('distinguishes a shallow long drawdown from a deep short one', () => {
    /*
      SHALLOW + LONG: 100 99 99 99 99 99 100 → 5 periods under, depth 1%
      DEEP + SHORT:   100 70 105             → 1 period under,  depth 30%

      Max drawdown alone ranks the second as far worse. Duration says the
      first is the one that takes six months of nerve.
    */
    const shallow = [100, 99, 99, 99, 99, 99, 100];
    const deep = [100, 70, 105];

    expect(calculateUnderwaterDuration(shallow).longestPeriods).toBe(5);
    expect(calculateUnderwaterDuration(deep).longestPeriods).toBe(1);

    expect(calculateMaxDrawdown(shallow).value).toBeCloseTo(1, 6);
    expect(calculateMaxDrawdown(deep).value).toBeCloseTo(30, 6);
  });
});

describe('degenerate input', () => {
  it('returns zeros rather than throwing', () => {
    for (const bad of [[], null, undefined, 'nonsense']) {
      const r = calculateUnderwaterDuration(bad);
      expect(r.longestPeriods).toBe(0);
      expect(r.isUnderwaterNow).toBe(false);
    }
  });

  it('does not read a gap in the curve as a recovery', () => {
    // 100 90 NaN 95 105 — the NaN is skipped, so the run stays open across
    // it and measures 2, not two separate runs of 1.
    const r = calculateUnderwaterDuration([100, 90, NaN, 95, 105]);
    expect(r.longestPeriods).toBe(2);
  });
});
