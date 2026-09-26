/**
 * PORTFOLIO — the user's own holdings, for the UI.
 *
 * WHAT THIS OWNS
 *   Loading positions, mutating them, and reporting whether storage is durable.
 *
 * WHAT THIS MUST NEVER DO
 *   Value a holding. Valuation is a pure engine function; this hook fetches
 *   and mutates. Keeping them apart is why `valuePortfolio` could be written
 *   and tested exhaustively in M3, milestones before any screen existed.
 *
 * WHY A HOOK AND NOT A DIRECT IMPORT
 *   The layer boundary forbids a screen importing the data layer, and lint
 *   enforces it. Hooks are the sanctioned crossing point. This is the same
 *   shape as `useCacheControls`, for the same reason.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { portfolioStore } from '../data/persistence/portfolioStore.js';

/** Shown once, BEFORE the first save — never after twenty positions. */
export const STORAGE_DISCLOSURE =
  'Your positions are saved in this browser on this device only. Gati has no account and no cloud sync, ' +
  'so they will not appear on your phone if you enter them on a laptop, and they are lost if you clear ' +
  'site data. Export a backup any time from this screen.';

const ACKNOWLEDGED_KEY = 'gati.pref.portfolioDisclosureSeen';

function hasAcknowledged() {
  try {
    return localStorage.getItem(ACKNOWLEDGED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function usePortfolio(store = portfolioStore) {
  const [positions, setPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsDisclosure, setNeedsDisclosure] = useState(() => !hasAcknowledged());

  const reload = useCallback(async () => {
    setPositions(await store.list());
    setIsLoading(false);
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    store.list().then((rows) => {
      if (cancelled) return;
      setPositions(rows);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const acknowledgeDisclosure = useCallback(() => {
    try {
      localStorage.setItem(ACKNOWLEDGED_KEY, 'true');
    } catch {
      // Losing the acknowledgement means showing it again, which is harmless.
    }
    setNeedsDisclosure(false);
  }, []);

  const add = useCallback(
    async (input) => {
      const result = await store.add(input);
      if (result.ok) await reload();
      return result;
    },
    [store, reload],
  );

  const update = useCallback(
    async (id, changes) => {
      const result = await store.update(id, changes);
      if (result.ok) await reload();
      return result;
    },
    [store, reload],
  );

  const remove = useCallback(
    async (id) => {
      const result = await store.remove(id);
      if (result.ok) await reload();
      return result;
    },
    [store, reload],
  );

  /**
   * Download a backup.
   *
   * The only backup mechanism that exists, because there is no account and no
   * sync — which is why it is a first-class action rather than buried.
   */
  const exportBackup = useCallback(async () => {
    const payload = await store.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gati-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return payload;
  }, [store]);

  const importBackup = useCallback(
    async (file) => {
      try {
        const payload = JSON.parse(await file.text());
        const result = await store.importAll(payload);
        if (result.ok) await reload();
        return result;
      } catch {
        return { ok: false, problems: ['That file could not be read as a Gati portfolio export'] };
      }
    },
    [store, reload],
  );

  return useMemo(
    () => ({
      positions,
      isLoading,
      isEmpty: !isLoading && positions.length === 0,
      isDegraded: store.isDegraded(),
      needsDisclosure,
      acknowledgeDisclosure,
      add,
      update,
      remove,
      exportBackup,
      importBackup,
      reload,
    }),
    [positions, isLoading, store, needsDisclosure, acknowledgeDisclosure, add, update, remove, exportBackup, importBackup, reload],
  );
}
