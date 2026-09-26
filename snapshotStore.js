/**
 * SNAPSHOT STORE — persistence for frozen month-end rankings (decision D7).
 *
 * WHAT THIS OWNS
 *   Keeping what a completed month-end actually showed, so a later run can be
 *   compared against it.
 *
 * WHAT THIS MUST NEVER DO
 *   Overwrite without the comparison having happened first. The store is
 *   write-after-compare: the caller compares, surfaces any note, and only then
 *   records the new value. Writing first would destroy the evidence the
 *   comparison exists to find.
 *
 * WHY THIS IS CLEARED ON A VERSION BUMP RATHER THAN MIGRATED
 *   Snapshots are REPRODUCIBLE — they can be rebuilt from bars at any time.
 *   Manual portfolio positions are not, which is why those are migrated and
 *   never cleared. Migrating reproducible data buys nothing and risks
 *   corrupting a financial record through a migration bug; the worst case
 *   here is one comparison being skipped for one month.
 *
 * SIZE
 *   One snapshot is five picks plus metadata: roughly 300 bytes. Three
 *   universes x four windows x ~19 months is about 230 records, ~70 kB. It
 *   shares the IndexedDB database with the bar store and is immaterial beside
 *   it.
 */

import { createIndexedDBBackend, createMemoryBackend, isIndexedDBAvailable } from './idbBackend.js';
import { SNAPSHOT_VERSION, snapshotKey } from '../../config/schema/snapshotSchema.js';

const KEY_PREFIX = 'snap:';
const REVISION_PREFIX = 'snaprev:';

export function createSnapshotStore({ backend } = {}) {
  const usingIndexedDB = backend ? false : isIndexedDBAvailable();
  const store = backend ?? (usingIndexedDB ? createIndexedDBBackend() : createMemoryBackend());
  const stats = { reads: 0, writes: 0, writeFailures: 0, discarded: 0, revisions: 0 };

  function key(snapshot) {
    return KEY_PREFIX + (typeof snapshot === 'string' ? snapshot : snapshotKey(snapshot));
  }

  return {
    isDegraded: () => !backend && !usingIndexedDB,

    /**
     * Load stored snapshots for a set of fresh ones, keyed for comparison.
     *
     * Records from an older schema are discarded rather than compared: a
     * comparison across shapes would produce differences that mean nothing
     * and would flood the user with false findings.
     */
    async loadFor(freshSnapshots) {
      const out = new Map();
      for (const fresh of freshSnapshots) {
        try {
          stats.reads++;
          const stored = await store.get(key(fresh));
          if (!stored) continue;
          if (stored.version !== SNAPSHOT_VERSION) {
            stats.discarded++;
            await store.delete(key(fresh)).catch(() => {});
            continue;
          }
          out.set(snapshotKey(fresh), stored);
        } catch {
          // A cache that cannot be read means one comparison is skipped, not
          // that the app is broken.
        }
      }
      return out;
    },

    /**
     * Record snapshots. Call AFTER comparing, never before.
     *
     * Never throws: failing to persist costs a future comparison, and that
     * must not fail a load whose data is already correct.
     */
    async save(snapshots) {
      let written = 0;
      for (const snapshot of snapshots) {
        try {
          await store.put(key(snapshot), snapshot);
          stats.writes++;
          written++;
        } catch (err) {
          stats.writeFailures++;
          if (typeof console !== 'undefined') {
            console.warn(`[snapshotStore] write failed for ${snapshotKey(snapshot)}: ${err?.message ?? err}`);
          }
        }
      }
      return written;
    },

    /**
     * Append a revision to a month's audit trail (decision D10).
     *
     * APPEND-ONLY. Existing revisions are never modified or removed — that is
     * what makes this an audit trail rather than a status field. A month
     * restated twice keeps both records, in order.
     *
     * Called AFTER comparison and BEFORE the fresh snapshot is saved, so the
     * prior state is captured while it still exists.
     */
    async appendRevision(revision) {
      if (!revision) return false;
      const k = REVISION_PREFIX + snapshotKey(revision);
      try {
        const existing = (await store.get(k)) ?? [];
        const list = Array.isArray(existing) ? existing : [];
        await store.put(k, [...list, revision]);
        stats.revisions++;
        return true;
      } catch (err) {
        stats.writeFailures++;
        if (typeof console !== 'undefined') {
          console.warn(`[snapshotStore] revision write failed for ${snapshotKey(revision)}: ${err?.message ?? err}`);
        }
        return false;
      }
    },

    /** Full revision history for one month, oldest first. */
    async loadRevisions(snapshot) {
      try {
        const list = await store.get(REVISION_PREFIX + snapshotKey(snapshot));
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },

    /** Every revision across every month, for an audit view. */
    async loadAllRevisions() {
      try {
        const keys = (await store.keys()).filter((k) => String(k).startsWith(REVISION_PREFIX));
        const out = [];
        for (const k of keys) {
          const list = await store.get(k);
          if (Array.isArray(list)) out.push(...list);
        }
        return out.sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)));
      } catch {
        return [];
      }
    },

    async clear() {
      try {
        // Deliberately does NOT clear revisions. Snapshots are reproducible
        // from bars; the audit trail is not. Wiping the record of what the
        // app previously displayed would defeat decision D10 entirely.
        const keys = (await store.keys()).filter(
          (k) => String(k).startsWith(KEY_PREFIX) && !String(k).startsWith(REVISION_PREFIX),
        );
        for (const k of keys) await store.delete(k);
        return keys.length;
      } catch {
        return 0;
      }
    },

    async count() {
      try {
        return (await store.keys()).filter((k) => String(k).startsWith(KEY_PREFIX)).length;
      } catch {
        return 0;
      }
    },

    stats: () => ({ ...stats }),
  };
}

export const snapshotStore = createSnapshotStore();
