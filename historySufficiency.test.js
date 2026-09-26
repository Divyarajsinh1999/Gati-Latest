import { describe, it, expect } from 'vitest';
import { assessHistorySufficiency, MIN_REBALANCES_FOR_CONFIDENCE } from '../historySufficiency.js';

describe('assessHistorySufficiency', () => {
  it('reports insufficient when there are zero completed cycles', () => {
    const r = assessHistorySufficiency({ cyclesCount: 0, lookbackMonths: 12 });
    expect(r.level).toBe('insufficient');
    expect(r.rebalances).toBe(0);
    expect(r.message).toMatch(/no completed rebalance/i);
    expect(r.message).toMatch(/12-month/);
  });

  it('defaults cyclesCount to 0 when omitted, rather than throwing', () => {
    const r = assessHistorySufficiency();
    expect(r.level).toBe('insufficient');
  });

  it('reports thin for anything under the confidence threshold', () => {
    const r = assessHistorySufficiency({ cyclesCount: MIN_REBALANCES_FOR_CONFIDENCE - 1, lookbackMonths: 12 });
    expect(r.level).toBe('thin');
    expect(r.rebalances).toBe(MIN_REBALANCES_FOR_CONFIDENCE - 1);
    expect(r.message).toMatch(/treat these results as an early read/i);
  });

  it('pluralises the rebalance count correctly at the boundary of 1', () => {
    const one = assessHistorySufficiency({ cyclesCount: 1, lookbackMonths: 12 });
    expect(one.message).toMatch(/1 completed rebalance /); // no trailing 's'
    const two = assessHistorySufficiency({ cyclesCount: 2, lookbackMonths: 12 });
    expect(two.message).toMatch(/2 completed rebalances/);
  });

  it('reports ok at exactly the threshold and above', () => {
    const atThreshold = assessHistorySufficiency({ cyclesCount: MIN_REBALANCES_FOR_CONFIDENCE, lookbackMonths: 1 });
    expect(atThreshold.level).toBe('ok');
    expect(atThreshold.message).toBeNull();

    const wellAbove = assessHistorySufficiency({ cyclesCount: 40, lookbackMonths: 1 });
    expect(wellAbove.level).toBe('ok');
  });

  it('the 1-month strategy with a full history is never flagged — this must stay true or every existing page gets a spurious warning', () => {
    const r = assessHistorySufficiency({ cyclesCount: 18, lookbackMonths: 1 });
    expect(r.level).toBe('ok');
  });
});
