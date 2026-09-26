/**
 * BATCHED FETCH TESTS — the milestone's definition of done, executed.
 *
 * Two numbers matter here and both are asserted rather than described:
 *
 *   COLD  a 250-symbol universe must cost <= 10 provider requests (was 251)
 *   WARM  a second load of the same universe must cost ZERO
 *
 * "Zero" rather than "fewer" is deliberate. The cache this replaces silently
 * stopped working above roughly a hundred symbols, so a test asserting merely
 * "fewer requests" would have passed against the broken implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getHistoricalSeriesBatch } from '../dataService.js';
import { createBarStore } from '../cache/barStore.js';
import { createFakeStore } from '../../../tests/harness/fakeIndexedDB.js';
import { tradingDays, makeSeries } from '../../../tests/harness/syntheticSeries.js';

// A deliberately SHORT window. Every assertion in this file is about request
// COUNTS, which are independent of how many bars each series contains — so
// generating 390 days per symbol for 450 symbols would just make the suite
// slow without testing anything extra. The full-length series is exercised
// where it actually matters: the quota measurement in barStore.test.js.
const START = '2026-05-01';
const END = '2026-07-31';
const DATES = tradingDays(START, END);

function symbols(n) {
  return Array.from({ length: n }, (_, i) => `SYM${String(i).padStart(3, '0')}.NS`);
}

/** A provider that implements the batch contract and counts its calls. */
function batchProvider({ failing = new Set(), throwOnBatchIndex = null } = {}) {
  let calls = 0;
  const batchSizes = [];
  return {
    id: 'test',
    get callCount() {
      return calls;
    },
    get batchSizes() {
      return batchSizes;
    },
    async getHistoricalDataBatch(syms) {
      const index = calls;
      calls++;
      batchSizes.push(syms.length);
      if (throwOnBatchIndex === index) throw new Error('upstream exploded');
      const out = new Map();
      for (const s of syms) {
        if (failing.has(s)) out.set(s, { error: `404 for ${s}` });
        else out.set(s, { records: makeSeries({ symbol: s, dates: DATES, seed: 7 }) });
      }
      return out;
    },
  };
}

/** A provider written against the ORIGINAL single-symbol contract. */
function legacyProvider() {
  let calls = 0;
  return {
    id: 'legacy',
    get callCount() {
      return calls;
    },
    async getHistoricalData(symbol) {
      calls++;
      return makeSeries({ symbol, dates: DATES, seed: 7 });
    },
  };
}

let store;
beforeEach(() => {
  store = createBarStore({ backend: createFakeStore() });
});

describe('cold load — invocation count', () => {
  it('fetches 250 symbols in <= 10 requests (was 251)', async () => {
    const from = batchProvider();
    const { results, requests } = await getHistoricalSeriesBatch(symbols(250), {
      startDate: START,
      endDate: END,
      from,
      store,
    });

    expect(results.size).toBe(250);
    expect(from.callCount).toBeLessThanOrEqual(10);
    expect(requests).toBe(from.callCount);

    // 250 / 40 = 7 batches. Stated explicitly so a change to the batch size
    // is visible here rather than only in a passing inequality.
    expect(from.callCount).toBe(7);
  });

  it('never sends a batch larger than the server cap', async () => {
    const from = batchProvider();
    await getHistoricalSeriesBatch(symbols(453), { startDate: START, endDate: END, from, store });
    expect(Math.max(...from.batchSizes)).toBeLessThanOrEqual(40);
    // Nothing is dropped or duplicated by chunking.
    expect(from.batchSizes.reduce((a, b) => a + b, 0)).toBe(453);
  });

  it('a full three-universe cold start stays far below the old 453', async () => {
    const from = batchProvider();
    for (const n of [50, 150, 250]) {
      await getHistoricalSeriesBatch(symbols(n).map((s) => `U${n}${s}`), {
        startDate: START,
        endDate: END,
        from,
        store,
      });
    }
    // 2 + 4 + 7 = 13 requests for 450 symbols, versus 450 before.
    expect(from.callCount).toBe(13);
  });
});

describe('warm load — zero requests', () => {
  it('issues NO requests when everything is cached', async () => {
    const first = batchProvider();
    await getHistoricalSeriesBatch(symbols(250), { startDate: START, endDate: END, from: first, store });
    expect(first.callCount).toBe(7);

    const second = batchProvider();
    const { results, requests } = await getHistoricalSeriesBatch(symbols(250), {
      startDate: START,
      endDate: END,
      from: second,
      store,
    });

    expect(second.callCount).toBe(0);
    expect(requests).toBe(0);
    expect(results.size).toBe(250);
    expect(store.stats().hits).toBe(250);
  });

  it('fetches only the misses on a partially warm load', async () => {
    const first = batchProvider();
    await getHistoricalSeriesBatch(symbols(100), { startDate: START, endDate: END, from: first, store });

    // Ask for the same 100 plus 20 new ones.
    const second = batchProvider();
    const extra = Array.from({ length: 20 }, (_, i) => `NEW${i}.NS`);
    await getHistoricalSeriesBatch([...symbols(100), ...extra], {
      startDate: START,
      endDate: END,
      from: second,
      store,
    });

    // 20 misses → one batch, not four.
    expect(second.callCount).toBe(1);
    expect(second.batchSizes).toEqual([20]);
  });
});

describe('failure semantics survive batching', () => {
  it('one failing symbol does not affect the other 249', async () => {
    const from = batchProvider({ failing: new Set(['SYM042.NS']) });
    const { results } = await getHistoricalSeriesBatch(symbols(250), {
      startDate: START,
      endDate: END,
      from,
      store,
    });

    expect(results.get('SYM042.NS').error).toMatch(/404/);
    expect(results.get('SYM041.NS').records.length).toBeGreaterThan(0);
    expect([...results.values()].filter((r) => r.records).length).toBe(249);
  });

  it('a whole batch failing is recorded PER SYMBOL, not as one error', async () => {
    // A batch is a transport detail. It must never become a unit of financial
    // meaning — otherwise a transport hiccup would look like 40 stocks having
    // simultaneously delisted.
    const from = batchProvider({ throwOnBatchIndex: 1 });
    const { results } = await getHistoricalSeriesBatch(symbols(120), {
      startDate: START,
      endDate: END,
      from,
      store,
    });

    expect(results.size).toBe(120);
    const failed = [...results.values()].filter((r) => r.error);
    expect(failed.length).toBe(40);
    expect(failed[0].error).toMatch(/upstream exploded/);
    // The other batches are unaffected.
    expect([...results.values()].filter((r) => r.records).length).toBe(80);
  });

  it('a failed symbol is not written to the cache', async () => {
    const from = batchProvider({ failing: new Set(['SYM000.NS']) });
    await getHistoricalSeriesBatch(symbols(5), { startDate: START, endDate: END, from, store });

    expect(await store.get('SYM000.NS', { startDate: START, endDate: END })).toBeNull();
    expect(await store.get('SYM001.NS', { startDate: START, endDate: END })).not.toBeNull();
  });
});

describe('legacy provider compatibility', () => {
  it('falls back to per-symbol fetching for a provider without the batch method', async () => {
    // The four test doubles guarding the failure-asymmetry behaviour were
    // written against the original single-symbol contract. Requiring them all
    // to be rewritten would mean editing regression tests to accommodate an
    // implementation change, which is exactly backwards.
    const from = legacyProvider();
    const { results, requests } = await getHistoricalSeriesBatch(symbols(5), {
      startDate: START,
      endDate: END,
      from,
      store,
    });

    expect(results.size).toBe(5);
    expect(from.callCount).toBe(5);
    expect(requests).toBe(5);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * THE SAME DATA MUST PRODUCE THE SAME SERIES, COLD OR WARM (v1.6.4 audit).
 *
 * `results` — not the write-back — is what the engine consumes. A cache HIT
 * returned bars the store had sorted and de-duplicated; a cache MISS returned
 * the provider's array untouched. So a provider that answered out of order,
 * or repeated a row, produced one series on first load and a different one on
 * second, from identical inputs.
 *
 * That is the worst shape a bug can take here: it appears and disappears with
 * cache state, so it cannot be reproduced on demand and looks like the market
 * moved rather than like a defect.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('cold and warm loads agree', () => {
  let store;
  beforeEach(() => { store = createBarStore({ backend: createFakeStore() }); });

  /** A provider that answers with deliberately messy ordering. */
  const messyProvider = () => ({
    id: 'messy',
    async getHistoricalDataBatch(syms) {
      const out = new Map();
      for (const s of syms) {
        const clean = makeSeries({ symbol: s, dates: DATES, seed: 11 });
        // Newest first, plus an exact repeat of one row.
        out.set(s, { records: [...clean].reverse().concat([clean[3]]) });
      }
      return out;
    },
  });

  it('returns the same bars on the miss path as on the hit path', async () => {
    const from = messyProvider();
    const cold = await getHistoricalSeriesBatch(['A.NS'], { startDate: START, endDate: END, from, store });
    const warm = await getHistoricalSeriesBatch(['A.NS'], { startDate: START, endDate: END, from, store });
    expect(warm.requests).toBe(0);
    expect(cold.results.get('A.NS').records).toEqual(warm.results.get('A.NS').records);
  });

  it('sorts the miss path ascending rather than trusting the provider', async () => {
    const from = messyProvider();
    const { results } = await getHistoricalSeriesBatch(['A.NS'], { startDate: START, endDate: END, from, store });
    const dates = results.get('A.NS').records.map((b) => b.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('drops the repeated row rather than storing it twice', async () => {
    const from = messyProvider();
    const { results } = await getHistoricalSeriesBatch(['A.NS'], { startDate: START, endDate: END, from, store });
    const dates = results.get('A.NS').records.map((b) => b.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toHaveLength(DATES.length);
  });

  it('excludes a symbol whose history contradicts itself, with a reason', async () => {
    // Two different closes for one session. Not resolvable, so the symbol is
    // failed onto the same channel as a dead ticker rather than ranked on a
    // coin toss.
    const from = {
      id: 'conflicting',
      async getHistoricalDataBatch(syms) {
        const out = new Map();
        for (const s of syms) {
          const clean = makeSeries({ symbol: s, dates: DATES, seed: 11 });
          out.set(s, { records: [...clean, { ...clean[5], close: 9999, adjClose: 9999 }] });
        }
        return out;
      },
    };
    const { results } = await getHistoricalSeriesBatch(['BAD.NS'], { startDate: START, endDate: END, from, store });
    const entry = results.get('BAD.NS');
    expect(entry.records).toBeUndefined();
    expect(entry.error).toMatch(/disagrees with itself/);
  });
});
