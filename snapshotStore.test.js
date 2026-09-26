/**
 * SNAPSHOT STORE TESTS.
 *
 * The behaviour most worth guarding is write-after-compare. If the store ever
 * writes before the comparison runs, decision D7 becomes a no-op that still
 * looks implemented — the worst kind of regression, because the code is all
 * present and the feature silently does nothing.
 */

import { describe, it, expect } from 'vitest';
import { createSnapshotStore } from '../cache/snapshotStore.js';
import { buildSnapshot, compareSnapshot, snapshotKey, SNAPSHOT_VERSION } from '../../engine/snapshots.js';
import { createFakeStore } from '../../../tests/harness/fakeIndexedDB.js';

const ranking = {
  monthKey: '2026-03',
  date: '2026-03-31',
  rankings: [
    { symbol: 'A', name: 'A', rank: 1, rs: 8.5 },
    { symbol: 'B', name: 'B', rank: 2, rs: 6.25 },
  ],
};
const base = { universeKey: 'nifty50', lookbackMonths: 1, topN: 2 };
const snap = (r = ranking) => buildSnapshot({ ...base, rankingSnapshot: r });

describe('snapshotStore', () => {
  it('round-trips a snapshot', async () => {
    const store = createSnapshotStore({ backend: createFakeStore() });
    const s = snap();
    expect(await store.save([s])).toBe(1);

    const loaded = await store.loadFor([s]);
    expect(loaded.get(snapshotKey(s)).fingerprint).toBe(s.fingerprint);
  });

  it('supports the write-after-compare cycle that D7 depends on', async () => {
    const store = createSnapshotStore({ backend: createFakeStore() });
    await store.save([snap()]);

    const restated = {
      ...ranking,
      rankings: ranking.rankings.map((r) => (r.symbol === 'B' ? { ...r, rs: 7.1 } : r)),
    };
    const fresh = snap(restated);

    // Compare FIRST — this is the ordering the whole feature rests on.
    const stored = (await store.loadFor([fresh])).get(snapshotKey(fresh));
    const result = compareSnapshot(stored, fresh);
    expect(result.changed).toBe(true);
    expect(result.message).toContain('2026-03');

    // Only then record. The next run must see no change.
    await store.save([fresh]);
    const after = compareSnapshot((await store.loadFor([fresh])).get(snapshotKey(fresh)), fresh);
    expect(after.changed).toBe(false);
  });

  it('discards records from an older schema rather than comparing across shapes', async () => {
    const backend = createFakeStore();
    const store = createSnapshotStore({ backend });
    const s = snap();
    await backend.put('snap:' + snapshotKey(s), { ...s, version: SNAPSHOT_VERSION - 1 });

    const loaded = await store.loadFor([s]);
    expect(loaded.size).toBe(0);
    expect(store.stats().discarded).toBe(1);
  });

  it('reports a write failure rather than swallowing it', async () => {
    const store = createSnapshotStore({ backend: createFakeStore({ quotaBytes: 10 }) });
    expect(await store.save([snap()])).toBe(0);
    expect(store.stats().writeFailures).toBe(1);
  });

  it('degrades to no comparison rather than failing when storage is unavailable', async () => {
    const store = createSnapshotStore({ backend: createFakeStore({ unavailable: true }) });
    await expect(store.loadFor([snap()])).resolves.toEqual(new Map());
    await expect(store.save([snap()])).resolves.toBe(0);
  });

  it('counts and clears', async () => {
    const store = createSnapshotStore({ backend: createFakeStore() });
    await store.save([snap(), snap({ ...ranking, monthKey: '2026-04', date: '2026-04-30' })]);
    expect(await store.count()).toBe(2);
    expect(await store.clear()).toBe(2);
    expect(await store.count()).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* D10 — the revision audit trail                                      */
/* ------------------------------------------------------------------ */

import { buildRevision, sortRevisions } from '../../engine/snapshots.js';

describe('revision audit trail (D10)', () => {
  const restated = {
    ...ranking,
    rankings: ranking.rankings.map((r) => (r.symbol === 'B' ? { ...r, rs: 7.1 } : r)),
  };

  it('captures the FULL prior state, not just the deltas', async () => {
    const store = createSnapshotStore({ backend: createFakeStore() });
    const original = snap();
    await store.save([original]);

    const fresh = snap(restated);
    const stored = (await store.loadFor([fresh])).get(snapshotKey(fresh));
    const comparison = compareSnapshot(stored, fresh);
    const revision = buildRevision({ stored, fresh, comparison, observedAt: '2026-08-03T10:00:00Z' });

    await store.appendRevision(revision);
    await store.save([fresh]);

    const history = await store.loadRevisions(fresh);
    expect(history).toHaveLength(1);
    // The point of D10: what was previously DISPLAYED can be rebuilt, not
    // merely announced. Deltas alone would not allow that.
    expect(history[0].previousPicks).toEqual(original.picks);
    expect(history[0].currentPicks).toEqual(fresh.picks);
    expect(history[0].affectedSymbols).toEqual(['B']);
    expect(history[0].likelyCause).toBe('corporate-action');
  });

  it('is append-only — a second restatement keeps the first', async () => {
    const store = createSnapshotStore({ backend: createFakeStore() });
    const base1 = snap();
    const rev1 = buildRevision({
      stored: base1, fresh: snap(restated),
      comparison: compareSnapshot(base1, snap(restated)),
      observedAt: '2026-08-03T10:00:00Z',
    });
    const again = { ...ranking, rankings: ranking.rankings.map((r) => (r.symbol === 'A' ? { ...r, rs: 9.9 } : r)) };
    const rev2 = buildRevision({
      stored: snap(restated), fresh: snap(again),
      comparison: compareSnapshot(snap(restated), snap(again)),
      observedAt: '2026-09-01T10:00:00Z',
    });

    await store.appendRevision(rev1);
    await store.appendRevision(rev2);

    const history = sortRevisions(await store.loadRevisions(snap()));
    expect(history).toHaveLength(2);
    expect(history[0].observedAt).toBe('2026-08-03T10:00:00Z');
  });

  it('clearing snapshots does NOT clear the audit trail', async () => {
    // Snapshots are reproducible from bars; the record of what the app
    // previously displayed is not.
    const store = createSnapshotStore({ backend: createFakeStore() });
    const stored = snap();
    await store.save([stored]);
    await store.appendRevision(
      buildRevision({ stored, fresh: snap(restated), comparison: compareSnapshot(stored, snap(restated)), observedAt: '2026-08-03T10:00:00Z' }),
    );

    await store.clear();
    expect(await store.count()).toBe(0);
    expect(await store.loadRevisions(stored)).toHaveLength(1);
  });

  it('records nothing when nothing changed', () => {
    const stored = snap();
    expect(buildRevision({ stored, fresh: snap(), comparison: compareSnapshot(stored, snap()), observedAt: 'x' })).toBeNull();
  });

  it('states the cause as a likelihood, never as an observation', async () => {
    const store = createSnapshotStore({ backend: createFakeStore() });
    const stored = snap();
    const rev = buildRevision({ stored, fresh: snap(restated), comparison: compareSnapshot(stored, snap(restated)), observedAt: 'x' });
    await store.appendRevision(rev);
    // The provider never tells us a corporate action occurred; it is inferred
    // from the shape of the change and must be presented that way.
    expect(rev.message).toContain('most likely');
    expect((await store.loadAllRevisions())).toHaveLength(1);
  });
});
