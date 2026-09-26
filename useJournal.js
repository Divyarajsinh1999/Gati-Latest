/**
 * THE DECISION JOURNAL — for the UI (D25).
 *
 * WHAT THIS OWNS
 *   Loading entries, adding them, editing a note, deleting, and reporting
 *   whether storage is durable.
 *
 * WHAT THIS MUST NEVER DO
 *   Compute how an entry turned out. The strategy record already holds every
 *   month's performance, computed once in the engine — a second calculation
 *   here would be a second place for the numbers to disagree, and the second
 *   place is always the one that ends up wrong.
 *
 * WHY A HOOK AND NOT A DIRECT IMPORT
 *   Lint forbids a screen importing the data layer. Hooks are the sanctioned
 *   crossing point, same shape as `usePortfolio` for the same reason.
 */

import { useState, useEffect, useCallback } from 'react';
import { journalStore, MAX_NOTE_LENGTH } from '../data/persistence/journalStore.js';

/*
  Re-exported so a screen can set a field's `maxLength` without importing the
  data layer, which lint forbids and rightly so. The alternative was a literal
  in the screen — a second copy of a limit the store also enforces, free to
  drift out of step and only noticed when a save silently failed.
*/
export { MAX_NOTE_LENGTH };

export function useJournal(store = journalStore) {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setEntries(await store.list());
    setIsLoading(false);
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    store.list().then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const add = useCallback(
    async (input) => {
      const result = await store.add(input);
      if (result.ok) await reload();
      return result;
    },
    [store, reload],
  );

  const updateNote = useCallback(
    async (id, note) => {
      const result = await store.updateNote(id, note);
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

  return {
    entries,
    isLoading,
    isEmpty: !isLoading && entries.length === 0,
    isDegraded: store.isDegraded(),
    add,
    updateNote,
    remove,
    reload,
  };
}
