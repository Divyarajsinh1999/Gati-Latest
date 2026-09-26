/**
 * BAR STORE TESTS.
 *
 * The most important test in this file is `quota`. The cache this store
 * replaces failed silently: it wrote ~21 MB of bars into a ~5 MB localStorage
 * quota and swallowed the resulting error, so caching worked for roughly the
 * first hundred symbols and then stopped, invisibly, for months. Nothing
 * caught it because no test ever filled the quota.
 *
 * So this file fills the quota on purpose.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createBarStore, BAR_SCHEMA_VERSION, normaliseBars } from '../cache/barStore.js';
import { createFakeStore, LOCAL_STORAGE_QUOTA_BYTES } from '../../../tests/harness/fakeIndexedDB.js';
import { tradingDays, makeSeries } from '../../../tests/harness/syntheticSeries.js';

const START = '2025-01-01';
const END = '2026-07-31';

function bars(from = START, to = END, seed = 1) {
  return makeSeries({ symbol: 'X.NS', dates: tradingDays(from, to), seed });
}

let clock;
const now = () => clock;

beforeEach(() => {
  clock = Date.UTC(2026, 7, 3, 6, 0, 0);
});

describe('barStore — hit and miss', () => {
  it('misses on an empty store, hits after a write', async () => {
    const store = createBarStore({ backend: createFakeStore(), now });

    expect(await store.get('RELIANCE.NS', { startDate: START, endDate: END })).toBeNull();

    await store.put('RELIANCE.NS', bars(), { startDate: START, endDate: END, source: 'test' });

    const hit = await store.get('RELIANCE.NS', { startDate: START, endDate: END });
    expect(hit).not.toBeNull();
    expect(hit.length).toBeGreaterThan(300);
    expect(store.stats().hits).toBe(1);
  });

  it('slices to the requested window rather than returning everything held', async () => {
    const store = createBarStore({ backend: createFakeStore(), now });
    await store.put('X.NS', bars(), { startDate: START, endDate: END });

    const narrow = await store.get('X.NS', { startDate: '2026-01-01', endDate: '2026-03-31' });
    expect(narrow.every((b) => b.date >= '2026-01-01' && b.date <= '2026-03-31')).toBe(true);
    expect(narrow.length).toBeLessThan(80);
  });
});

describe('barStore — freshness', () => {
  it('treats a record older than the TTL as a miss', async () => {
    const store = createBarStore({ backend: createFakeStore(), now, ttlMs: 6 * 60 * 60 * 1000 });
    await store.put('X.NS', bars(), { startDate: START, endDate: END });

    clock += 5 * 60 * 60 * 1000; // 5h — still fresh
    expect(await store.get('X.NS', { startDate: START, endDate: END })).not.toBeNull();

    clock += 2 * 60 * 60 * 1000; // 7h total — stale
    expect(await store.get('X.NS', { startDate: START, endDate: END })).toBeNull();
    expect(store.stats().stale).toBe(1);
  });
});

describe('barStore — coverage', () => {
  it('misses when asked for a range wider than was ever requested', async () => {
    const store = createBarStore({ backend: createFakeStore(), now });
    await store.put('X.NS', bars('2026-01-01', END), { startDate: '2026-01-01', endDate: END });

    // Earlier start than we ever asked for → we genuinely don't have it.
    expect(await store.get('X.NS', { startDate: START, endDate: END })).toBeNull();
  });

  it('THE WEEKEND TRAP: hits when the requested end is a non-trading day', async () => {
    // The newest bar is Friday's. The app asks for data "through today", and
    // today is Saturday. Comparing against actual bar dates would miss here
    // every weekend and every market holiday — permanently, because a
    // Saturday bar will never exist.
    const store = createBarStore({ backend: createFakeStore(), now });
    const friday = '2026-07-31';
    const saturday = '2026-08-01';

    await store.put('X.NS', bars(START, friday), { startDate: START, endDate: saturday });

    const hit = await store.get('X.NS', { startDate: START, endDate: saturday });
    expect(hit).not.toBeNull();
    expect(hit[hit.length - 1].date).toBe(friday);
  });

  it('extends coverage instead of duplicating on a wider re-fetch', async () => {
    const store = createBarStore({ backend: createFakeStore(), now });
    await store.put('X.NS', bars('2026-01-01', END), { startDate: '2026-01-01', endDate: END });
    await store.put('X.NS', bars(START, END), { startDate: START, endDate: END });

    const usage = await store.usage();
    expect(usage.symbolCount).toBe(1); // one record, not two overlapping ones

    const hit = await store.get('X.NS', { startDate: START, endDate: END });
    const dates = hit.map((b) => b.date);
    expect(new Set(dates).size).toBe(dates.length); // no duplicated days
    expect(dates).toEqual([...dates].sort()); // still ascending
  });
});

describe('barStore — corruption and schema', () => {
  it('treats an unparseable record as a miss and deletes it', async () => {
    const backend = createFakeStore();
    const store = createBarStore({ backend, now });
    await store.put('X.NS', bars(), { startDate: START, endDate: END });

    backend._corrupt('bars:X.NS');

    expect(await store.get('X.NS', { startDate: START, endDate: END })).toBeNull();
    expect(await backend.keys()).not.toContain('bars:X.NS');
  });

  it('rejects a record written under a different schema version', async () => {
    const backend = createFakeStore();
    const store = createBarStore({ backend, now });
    await backend.put('bars:X.NS', {
      schemaVersion: BAR_SCHEMA_VERSION + 1,
      bars: bars(),
      requestedStart: START,
      requestedEnd: END,
      fetchedAt: clock,
    });

    expect(await store.get('X.NS', { startDate: START, endDate: END })).toBeNull();
    expect(store.stats().corrupt).toBe(1);
  });
});

describe('barStore — quota (the defect this store exists to fix)', () => {
  it('a full universe of bars does NOT fit in a localStorage-sized quota', async () => {
    // This is the measurement, executed rather than asserted in prose.
    const backend = createFakeStore({ quotaBytes: LOCAL_STORAGE_QUOTA_BYTES });
    const store = createBarStore({ backend, now });

    const dates = tradingDays(START, END);
    let written = 0;
    for (let i = 0; i < 453; i++) {
      const ok = await store.put(`SYM${i}.NS`, makeSeries({ symbol: `SYM${i}.NS`, dates, seed: i }), {
        startDate: START,
        endDate: END,
      });
      if (ok) written++;
      else break;
    }

    // The old cache would have stopped here too — it just never said so.
    expect(written).toBeLessThan(453);
    expect(store.stats().writeFailures).toBeGreaterThan(0);
  });

  it('the same universe fits comfortably in the bar store soft cap', async () => {
    const store = createBarStore({ backend: createFakeStore(), now });
    const dates = tradingDays(START, END);

    for (let i = 0; i < 453; i++) {
      const ok = await store.put(`SYM${i}.NS`, makeSeries({ symbol: `SYM${i}.NS`, dates, seed: i }), {
        startDate: START,
        endDate: END,
      });
      expect(ok).toBe(true);
    }

    const usage = await store.usage();
    expect(usage.symbolCount).toBe(453);
    // Records the real number so a future change that inflates the payload is
    // visible in the diff rather than discovered in production.
    expect(usage.approxBytes).toBeGreaterThan(LOCAL_STORAGE_QUOTA_BYTES);
    expect(store.stats().writeFailures).toBe(0);
  });

  it('reports a write failure rather than swallowing it', async () => {
    const store = createBarStore({ backend: createFakeStore({ quotaBytes: 500 }), now });
    const ok = await store.put('X.NS', bars(), { startDate: START, endDate: END });

    expect(ok).toBe(false);
    expect(store.stats().writeFailures).toBe(1);
  });
});

describe('barStore — eviction', () => {
  it('evicts least-recently-used whole symbols to get under the cap', async () => {
    const dates = tradingDays('2026-01-01', END);
    const oneSeries = makeSeries({ symbol: 'A.NS', dates, seed: 1 });
    const approxOne = JSON.stringify(oneSeries).length;

    const store = createBarStore({
      backend: createFakeStore(),
      now,
      softCapBytes: approxOne * 3,
    });

    for (const sym of ['A.NS', 'B.NS', 'C.NS', 'D.NS', 'E.NS']) {
      clock += 1000; // each written later than the last
      await store.put(sym, makeSeries({ symbol: sym, dates, seed: 2 }), {
        startDate: '2026-01-01',
        endDate: END,
      });
    }

    const evicted = await store.evictIfNeeded();
    expect(evicted).toBeGreaterThan(0);

    // The oldest went first; the newest survived.
    expect(await store.get('E.NS', { startDate: '2026-01-01', endDate: END })).not.toBeNull();
    expect(await store.get('A.NS', { startDate: '2026-01-01', endDate: END })).toBeNull();
  });
});

describe('barStore — degradation', () => {
  it('degrades to a miss rather than throwing when storage is unavailable', async () => {
    const backend = createFakeStore({ unavailable: true });
    const store = createBarStore({ backend, now });

    await expect(store.get('X.NS', { startDate: START, endDate: END })).resolves.toBeNull();
    await expect(store.put('X.NS', bars(), { startDate: START, endDate: END })).resolves.toBe(false);
    await expect(store.usage()).resolves.toEqual({ symbolCount: 0, approxBytes: 0 });
  });

  it('an empty or missing series is never written', async () => {
    const store = createBarStore({ backend: createFakeStore(), now });
    expect(await store.put('X.NS', [], { startDate: START, endDate: END })).toBe(false);
    expect(await store.put('X.NS', null, { startDate: START, endDate: END })).toBe(false);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * NORMALISATION ON INGEST (v1.6.4 cross-check audit).
 *
 * The union in `put` sorted and de-duplicated, but ONLY when a record
 * already existed. A first write stored the provider's array verbatim, so
 * the same response produced two different stored shapes depending on
 * whether the cache happened to be warm — and both `coverageStart/End` here
 * and `series[series.length - 1]` in the engine read POSITION, not date.
 *
 * A ranking that changes with cache state is close to impossible to
 * reproduce, so this is pinned at the boundary rather than left to the
 * engine to survive.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('normaliseBars', () => {
  const bar = (date, close) => ({ date, close, adjClose: close, volume: 1 });

  it('sorts ascending regardless of the order given', () => {
    const { bars } = normaliseBars([bar('2026-08-27', 3), bar('2026-06-30', 1), bar('2026-07-31', 2)]);
    expect(bars.map((b) => b.date)).toEqual(['2026-06-30', '2026-07-31', '2026-08-27']);
  });

  it('collapses an identical repeat without complaint', () => {
    // The same bar twice is a harmless transport artefact, not a fault.
    const { bars, conflicts } = normaliseBars([bar('2026-07-31', 212), bar('2026-07-31', 212)]);
    expect(bars).toHaveLength(1);
    expect(conflicts).toEqual([]);
  });

  it('reports two DIFFERENT closes for one session as a conflict', () => {
    // Not resolvable: which price is real is not a question a cache can
    // answer. The audit measured a fabricated 999 against a true 212
    // producing a ranked −76.98% return.
    const { conflicts } = normaliseBars([bar('2026-07-31', 212), bar('2026-07-31', 999)]);
    expect(conflicts).toEqual(['2026-07-31']);
  });

  it('compares on the adjusted close, which is what returns use', () => {
    const a = { date: '2026-07-31', close: 100, adjClose: 90, volume: 1 };
    const b = { date: '2026-07-31', close: 100, adjClose: 95, volume: 1 };
    expect(normaliseBars([a, b]).conflicts).toEqual(['2026-07-31']);
  });

  it('survives empty, absent and malformed input rather than throwing', () => {
    expect(normaliseBars([]).bars).toEqual([]);
    expect(normaliseBars(null).bars).toEqual([]);
    expect(normaliseBars([{ close: 1 }, bar('2026-07-31', 2)]).bars).toHaveLength(1);
  });

  it('is idempotent — normalising twice changes nothing', () => {
    const once = normaliseBars([bar('2026-08-27', 3), bar('2026-06-30', 1)]).bars;
    expect(normaliseBars(once).bars).toEqual(once);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * A DATE THAT DOES NOT EXIST IS NOT A DATE (v1.6.5 pre-release audit).
 *
 * `monthKey` parses with `new Date(...)`, which SILENTLY ROLLS OVER: given
 * "2026-02-30" it returns 2 March and files the bar under MARCH. So a
 * malformed date does not merely sit inert in the series — it becomes a
 * month-end for a month it does not belong to.
 *
 * Demonstrated on the real engine: a stock with no genuine March bar but one
 * row dated 2026-02-30 had that row adopted as its March month-end, and was
 * RANKED on a −76.98% return computed from it.
 *
 * Rejected at the ingestion boundary rather than taught about in `monthKey`,
 * per D33: one place decides what a well-formed series is, and no engine
 * downstream should have to defend itself against dates that cannot exist.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('normaliseBars rejects dates that cannot exist', () => {
  const bar = (date, close) => ({ date, close, adjClose: close, volume: 1 });

  it('drops 30 February rather than filing it under March', () => {
    const { bars } = normaliseBars([bar('2026-02-30', 999), bar('2026-07-31', 212)]);
    expect(bars.map((b) => b.date)).toEqual(['2026-07-31']);
  });

  it.each([
    ['2026-02-30', 'February has 28 days in 2026'],
    ['2025-02-29', '2025 is not a leap year'],
    ['2026-04-31', 'April has 30 days'],
    ['2026-13-01', 'there is no month 13'],
    ['2026-00-10', 'there is no month zero'],
    ['2026-06-32', 'no month has 32 days'],
    ['2026-6-30', 'unpadded — not the ISO shape the app stores'],
    ['26-06-30', 'two-digit year'],
    ['not-a-date', 'not a date at all'],
    ['', 'empty'],
  ])('rejects %s (%s)', (date) => {
    const { bars } = normaliseBars([bar(date, 100), bar('2026-07-31', 212)]);
    expect(bars.map((b) => b.date)).toEqual(['2026-07-31']);
  });

  it('keeps 29 February in a real leap year', () => {
    // The guard must reject impossible dates, not merely unusual ones.
    const { bars } = normaliseBars([bar('2024-02-29', 100)]);
    expect(bars.map((b) => b.date)).toEqual(['2024-02-29']);
  });

  it.each(['2026-01-31', '2026-03-31', '2026-04-30', '2026-12-31', '2026-06-30'])(
    'keeps the real month-end %s',
    (date) => {
      expect(normaliseBars([bar(date, 100)]).bars).toHaveLength(1);
    },
  );

  it('does not report a dropped malformed row as a price conflict', () => {
    // It is not two opinions about one session; it is not a session.
    const { conflicts } = normaliseBars([bar('2026-02-30', 999), bar('2026-02-27', 200)]);
    expect(conflicts).toEqual([]);
  });
});
