import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../../data/dataService.js';

/**
 * mapWithConcurrency bounds the fan-out when fetching ~250 symbols. It is
 * tested here specifically because a subtle bug in it would be *silent and
 * financially wrong*: callers zip its results back against the stock list
 * by index, so if completion order ever leaked into result order, the
 * wrong price series would be attached to the wrong ticker and every
 * downstream return, RS and ranking would be quietly corrupted.
 */
describe('mapWithConcurrency', () => {
  it('returns results in INPUT order even when later items finish first', async () => {
    const items = [50, 5, 30, 1, 20]; // ms delays — deliberately out of order
    const out = await mapWithConcurrency(items, 3, async (delay) => {
      await new Promise((r) => setTimeout(r, delay));
      return delay;
    });
    expect(out).toEqual([50, 5, 30, 1, 20]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 25 }, (_, i) => i);

    await mapWithConcurrency(items, 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1); // sanity: it really is running in parallel, not serially
  });

  it('visits every item exactly once', async () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const seen = [];
    const out = await mapWithConcurrency(items, 7, async (n) => {
      seen.push(n);
      return n * 2;
    });
    expect(seen.slice().sort((a, b) => a - b)).toEqual(items);
    expect(out).toEqual(items.map((n) => n * 2));
  });

  it('handles an empty list and a limit larger than the list without hanging', async () => {
    expect(await mapWithConcurrency([], 5, async (x) => x)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 99, async (x) => x * 10)).toEqual([10, 20]);
  });
});
