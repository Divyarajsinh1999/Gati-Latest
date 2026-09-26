/**
 * SNAPSHOT AUDIT — surfacing retroactive changes to completed months.
 *
 * WHAT THIS OWNS
 *   Comparing freshly-computed month-end rankings against what was stored, and
 *   recording a revision when they differ.
 *
 * WHY THIS HOOK EXISTS AT ALL
 *   Decisions D7 and D10 were implemented in M3 and M4 — `buildSnapshot`,
 *   `compareSnapshot`, `buildRevision` and `snapshotStore` are all complete and
 *   fully tested. **Nothing ever called them.** The feature was reported as
 *   shipped and never once ran, exactly as the keyboard shortcuts and the
 *   offline state had not. Engines and stores do not invoke themselves.
 *
 * THE ORDERING IS LOAD-BEARING
 *   Compare, surface, THEN write. Writing first destroys the very evidence the
 *   comparison exists to find, and the mistake would be invisible: the app
 *   would look like it was auditing while auditing nothing.
 *
 * WHY FAILURES ARE SWALLOWED
 *   This is a secondary observation about data, not the data itself. A storage
 *   error here must never take down a screen full of correct numbers; the cost
 *   of failing is one missed note.
 */

import { useState, useEffect } from 'react';
import { buildSnapshot, compareSnapshot, buildRevision, snapshotKey } from '../engine/snapshots.js';
import { snapshotStore } from '../data/cache/snapshotStore.js';

export function useSnapshotAudit({ backtest, universeKey, lookbackMonths, topN = 5, store = snapshotStore }) {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    const rankingHistory = backtest?.rankingHistory;
    if (!universeKey || !rankingHistory?.length) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const fresh = rankingHistory.map((rankingSnapshot) =>
          buildSnapshot({ universeKey, lookbackMonths, rankingSnapshot, topN }),
        );

        // 1. Read what was stored.
        const stored = await store.loadFor(fresh);

        // 2. Compare, and build a revision for anything that moved.
        const found = [];
        const revisions = [];
        for (const snapshot of fresh) {
          const previous = stored.get(snapshotKey(snapshot));
          if (!previous) continue;
          const comparison = compareSnapshot(previous, snapshot);
          if (!comparison.changed) continue;
          found.push(comparison);
          revisions.push(
            buildRevision({
              stored: previous,
              fresh: snapshot,
              comparison,
              observedAt: new Date().toISOString(),
            }),
          );
        }

        // 3. Append the audit trail, then record the new state. In this order:
        //    the prior state must be captured while it still exists.
        for (const revision of revisions) await store.appendRevision(revision);
        await store.save(fresh);

        if (!cancelled) setNotes(found);
      } catch {
        // One missed note, never a broken screen.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backtest, universeKey, lookbackMonths, topN, store]);

  return notes;
}
