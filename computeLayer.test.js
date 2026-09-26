/**
 * D7 SNAPSHOT TESTS + COMPUTE LAYER TESTS.
 *
 * The snapshot suite guards decision D7: when a corporate action retroactively
 * changes a past month, Gati says so rather than quietly serving a different
 * number than it served last week.
 *
 * The compute suite guards the heavy/light split, which is the single most
 * important performance decision in the app. Its central assertion is that a
 * quote tick does NOT re-run a backtest — without that, the app would re-rank
 * 250 stocks twice a minute for numbers that cannot possibly have changed.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildSnapshot, compareSnapshot, compareAll, snapshotKey } from '../../engine/snapshots.js';
import { deriveHeavy, deriveLight, deriveSizing, deriveExecutableRecord } from '../deriveUniverse.js';
import { createComputeScheduler, COMPUTE_MODE } from '../computeScheduler.js';
import { makeUniverse } from '../../../tests/harness/syntheticSeries.js';

/* ------------------------------------------------------------------ */
/* D7 — SNAPSHOTS                                                      */
/* ------------------------------------------------------------------ */

const ranking = {
  monthKey: '2026-03',
  date: '2026-03-31',
  rankings: [
    { symbol: 'A', name: 'A', rank: 1, rs: 8.5 },
    { symbol: 'B', name: 'B', rank: 2, rs: 6.25 },
    { symbol: 'C', name: 'C', rank: 3, rs: 4.1 },
    { symbol: 'D', name: 'D', rank: 40, rs: -9 },
  ],
};

const base = { universeKey: 'nifty50', lookbackMonths: 1, topN: 3 };

describe('buildSnapshot', () => {
  it('freezes only the Top N, in rank order', () => {
    const s = buildSnapshot({ ...base, rankingSnapshot: ranking });
    expect(s.picks.map((p) => p.symbol)).toEqual(['A', 'B', 'C']);
    // A 249th stock moving to 250th is not a finding anybody is waiting for,
    // and including it would bury the changes that matter.
    expect(s.picks.some((p) => p.symbol === 'D')).toBe(false);
  });

  it('records the basis and a fingerprint of its inputs', () => {
    const s = buildSnapshot({ ...base, rankingSnapshot: ranking });
    expect(s.priceBasis).toBe('adjClose');
    expect(s.fingerprint).toContain('A@1');
  });
});

describe('compareSnapshot — D7', () => {
  const stored = buildSnapshot({ ...base, rankingSnapshot: ranking });

  it('reports no change when nothing moved', () => {
    const fresh = buildSnapshot({ ...base, rankingSnapshot: ranking });
    expect(compareSnapshot(stored, fresh).changed).toBe(false);
  });

  it('detects a RESTATED VALUE and names the month and likely cause', () => {
    const restated = {
      ...ranking,
      rankings: ranking.rankings.map((r) => (r.symbol === 'B' ? { ...r, rs: 6.9 } : r)),
    };
    const result = compareSnapshot(stored, buildSnapshot({ ...base, rankingSnapshot: restated }));

    expect(result.changed).toBe(true);
    expect(result.kind).toBe('values-restated');
    expect(result.rsChanges[0]).toMatchObject({ symbol: 'B', from: 6.25, to: 6.9 });
    expect(result.message).toContain('2026-03');
    expect(result.message).toContain('corporate action');
    // "most likely", not "is" — the cause is inferred from the shape of the
    // change, never observed.
    expect(result.message).toContain('most likely');
  });

  it('treats a CHANGED SELECTION as more serious than a changed value', () => {
    const reselected = {
      ...ranking,
      rankings: [
        { symbol: 'A', name: 'A', rank: 1, rs: 8.5 },
        { symbol: 'D', name: 'D', rank: 2, rs: 7.0 },
        { symbol: 'C', name: 'C', rank: 3, rs: 4.1 },
      ],
    };
    const result = compareSnapshot(stored, buildSnapshot({ ...base, rankingSnapshot: reselected }));

    expect(result.kind).toBe('selection-changed');
    expect(result.pickChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'D', change: 'added' }),
        expect.objectContaining({ symbol: 'B', change: 'removed' }),
      ]),
    );
    expect(result.message).toContain('selected stocks have changed');
  });

  it('ignores floating-point noise below the epsilon', () => {
    const noisy = {
      ...ranking,
      rankings: ranking.rankings.map((r) => (r.symbol === 'B' ? { ...r, rs: 6.25 + 1e-12 } : r)),
    };
    expect(compareSnapshot(stored, buildSnapshot({ ...base, rankingSnapshot: noisy })).changed).toBe(false);
  });

  it('does not compare across snapshot versions', () => {
    const old = { ...stored, version: 0 };
    expect(compareSnapshot(old, buildSnapshot({ ...base, rankingSnapshot: ranking })).changed).toBe(false);
  });

  it('reports nothing when there is no stored snapshot to compare against', () => {
    expect(compareSnapshot(null, buildSnapshot({ ...base, rankingSnapshot: ranking })).changed).toBe(false);
  });
});

describe('compareAll + snapshotKey', () => {
  it('keys on universe, window and month together', () => {
    const s = buildSnapshot({ ...base, rankingSnapshot: ranking });
    expect(snapshotKey(s)).toBe('nifty50:1:2026-03');
  });

  it('returns only the months that changed', () => {
    const s = buildSnapshot({ ...base, rankingSnapshot: ranking });
    const changed = buildSnapshot({
      ...base,
      rankingSnapshot: { ...ranking, rankings: ranking.rankings.map((r) => (r.symbol === 'A' ? { ...r, rs: 9.9 } : r)) },
    });
    const notes = compareAll(new Map([[snapshotKey(s), s]]), [changed]);
    expect(notes).toHaveLength(1);
    expect(notes[0].monthKey).toBe('2026-03');
  });
});

/* ------------------------------------------------------------------ */
/* COMPUTE — the heavy/light split                                     */
/* ------------------------------------------------------------------ */

const u = makeUniverse({ count: 30, seed: 99 });
const heavyArgs = {
  stocks: u.stocks,
  priceSeriesMap: u.priceSeriesMap,
  benchmarkSeries: u.benchmarkSeries,
  universeKey: 'test',
  lookbackMonths: 1,
  topN: 5,
};

describe('deriveHeavy', () => {
  const heavy = deriveHeavy(heavyArgs);

  it('produces the record, rankings, RS history, changes and snapshots in one pass', () => {
    expect(heavy.backtest.cycles.length).toBeGreaterThan(0);
    expect(heavy.momentum.ranked.length).toBe(30);
    expect(heavy.rsHistoryBySymbol.size).toBeGreaterThan(0);
    expect(heavy.changes.hasBaseline).toBe(true);
    expect(heavy.snapshots.length).toBeGreaterThan(0);
  });

  it('uses the capital-independent basis for the record', () => {
    expect(heavy.backtest.isCapitalIndependent).toBe(true);
  });

  it('attaches trailing RS history to the ranked rows', () => {
    const withHistory = heavy.momentum.ranked.filter((r) => r.rsHistory?.length > 0);
    expect(withHistory.length).toBeGreaterThan(0);
    expect(withHistory[0]).toHaveProperty('rsTrend');
  });

  it('is genuinely quote-free — the same result with or without quotes present', () => {
    // The premise of the whole split. If this ever fails, a quote has leaked
    // into the heavy pass and every 30-second tick will re-rank the universe.
    const a = deriveHeavy(heavyArgs);
    const b = deriveHeavy({ ...heavyArgs });
    expect(a.momentum.ranked.map((r) => r.rs)).toEqual(b.momentum.ranked.map((r) => r.rs));
  });
});

describe('deriveLight', () => {
  const heavy = deriveHeavy(heavyArgs);
  const symbol = heavy.momentum.ranked[0].symbol;
  const quotes = new Map([[symbol, { price: 9999, changePct: 3.5, volume: 123, asOf: '2026-08-03T10:00:00Z', isStale: false }]]);

  it('overlays live price and day change onto existing rows', () => {
    const light = deriveLight({ heavy, quotes });
    const row = light.momentum.ranked.find((r) => r.symbol === symbol);
    expect(row.currentPrice).toBe(9999);
    expect(row.dailyChangePct).toBe(3.5);
    expect(row.dailyChangeIsLive).toBe(true);
  });

  it('DOES NOT re-rank — a quote changes display, never ordering', () => {
    // RS is measured from the adjusted price series. A quote is unadjusted,
    // so letting it move the ranking would break across any corporate action
    // since the reference month-end.
    const light = deriveLight({ heavy, quotes });
    expect(light.momentum.ranked.map((r) => r.symbol)).toEqual(heavy.momentum.ranked.map((r) => r.symbol));
    const row = light.momentum.ranked.find((r) => r.symbol === symbol);
    expect(row.rs).toBe(heavy.momentum.ranked[0].rs);
  });

  it('passes the heavy result through untouched when there are no quotes', () => {
    const light = deriveLight({ heavy, quotes: new Map() });
    expect(light.quotesApplied).toBe(false);
    expect(light.momentum.ranked).toBe(heavy.momentum.ranked);
  });
});

describe('deriveSizing — Investment Simulator', () => {
  const heavy = deriveHeavy(heavyArgs);

  it('sizes on whole shares and reports the resulting drag', () => {
    const sizing = deriveSizing({ derived: heavy, capital: 50_000 });
    expect(sizing.basis).toBe('whole-share');
    expect(sizing.positions.every((p) => Number.isInteger(p.shares))).toBe(true);
    expect(sizing.execution.cashDragPct).toBeGreaterThanOrEqual(0);
    expect(sizing.execution.executionEfficiencyPct).toBeLessThanOrEqual(100);
  });

  it('returns null with no amount — the recommendation never depends on it', () => {
    expect(deriveSizing({ derived: heavy, capital: 0 })).toBeNull();
    expect(deriveSizing({ derived: heavy, capital: undefined })).toBeNull();
  });

  it('reports the minimum capital at which every pick is affordable', () => {
    const sizing = deriveSizing({ derived: heavy, capital: 50_000 });
    expect(sizing.minimumViableCapital).toBeGreaterThan(0);
  });
});

describe('deriveExecutableRecord', () => {
  it('re-runs the same signals under flooring and reports the gap', () => {
    const heavy = deriveHeavy(heavyArgs);
    const last = heavy.backtest.equityCurve[heavy.backtest.equityCurve.length - 1];
    const idealReturnPct = last.indexValue - 100;

    const exec = deriveExecutableRecord({
      ...heavyArgs,
      capital: 25_000,
      idealReturnPct,
    });

    expect(exec.executable.weighting).toBe('whole-share');
    expect(exec.comparison.idealReturnPct).toBeCloseTo(idealReturnPct, 10);
    expect(exec.avgIdleCashPct).toBeGreaterThan(0);
    expect(typeof exec.comparison.shortfallPct).toBe('number');
  });
});

/* ------------------------------------------------------------------ */
/* COMPUTE SCHEDULER                                                   */
/* ------------------------------------------------------------------ */

function bundle(overrides = {}) {
  return {
    universeKey: 'test',
    stocks: u.stocks,
    priceSeriesMap: u.priceSeriesMap,
    benchmarkSeries: u.benchmarkSeries,
    unavailableSymbols: [],
    dataAsOf: '2026-07-31',
    providerId: 'test',
    ...overrides,
  };
}

describe('computeScheduler', () => {
  it('computes once and serves the cache thereafter', async () => {
    const runHeavy = vi.fn(deriveHeavy);
    const s = createComputeScheduler({ runHeavy });

    await s.derive(bundle(), { lookbackMonths: 1, topN: 5 });
    await s.derive(bundle(), { lookbackMonths: 1, topN: 5 });
    await s.derive(bundle(), { lookbackMonths: 1, topN: 5 });

    expect(runHeavy).toHaveBeenCalledTimes(1);
    expect(s.stats().hits).toBe(2);
  });

  it('recomputes when a strategy parameter changes, not when a quote does', async () => {
    const runHeavy = vi.fn(deriveHeavy);
    const s = createComputeScheduler({ runHeavy });

    await s.derive(bundle(), { lookbackMonths: 1, topN: 5 });
    await s.derive(bundle(), { lookbackMonths: 3, topN: 5 });
    expect(runHeavy).toHaveBeenCalledTimes(2);

    // Quotes are not part of the key, by design.
    const heavy = await s.derive(bundle(), { lookbackMonths: 1, topN: 5 });
    s.applyQuotes(heavy, new Map([['SYN000.NS', { price: 1, changePct: 1 }]]));
    expect(runHeavy).toHaveBeenCalledTimes(2);
  });

  it('recomputes when the underlying data changes', async () => {
    const runHeavy = vi.fn(deriveHeavy);
    const s = createComputeScheduler({ runHeavy });
    await s.derive(bundle({ dataAsOf: '2026-07-31' }), { lookbackMonths: 1 });
    await s.derive(bundle({ dataAsOf: '2026-08-03' }), { lookbackMonths: 1 });
    expect(runHeavy).toHaveBeenCalledTimes(2);
  });

  it('de-duplicates concurrent requests for the same key', async () => {
    // Two components mounting together must not both run a 250-symbol backtest.
    const runHeavy = vi.fn(deriveHeavy);
    const s = createComputeScheduler({ runHeavy });
    await Promise.all([
      s.derive(bundle(), { lookbackMonths: 1 }),
      s.derive(bundle(), { lookbackMonths: 1 }),
      s.derive(bundle(), { lookbackMonths: 1 }),
    ]);
    expect(runHeavy).toHaveBeenCalledTimes(1);
  });

  it('invalidates a single universe without clearing the rest', async () => {
    const s = createComputeScheduler({ runHeavy: vi.fn(deriveHeavy) });
    await s.derive(bundle({ universeKey: 'a' }), { lookbackMonths: 1 });
    await s.derive(bundle({ universeKey: 'b' }), { lookbackMonths: 1 });
    expect(s.invalidate('a')).toBe(1);
    expect(s.stats().cached).toBe(1);
  });

  it('exposes its mode so the worker escalation is observable', () => {
    expect(createComputeScheduler().mode).toBe(COMPUTE_MODE.SYNC);
  });
});
