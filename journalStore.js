/**
 * THE DECISION JOURNAL — what the reader said they would do, before knowing
 * how it turned out (D25).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT A SECOND BACKTEST.
 *
 * The strategy record already shows how every month's Top 5 performed. A
 * paper log that recomputed that would be a duplicate engine and a second
 * place for the numbers to disagree — and the second place would eventually
 * be the one that was wrong.
 *
 * Its whole value is a COMMITMENT RECORDED BEFORE THE OUTCOME IS KNOWN. That
 * is the one thing a backtest can never supply: hindsight is unavoidable when
 * reading history, and the only way to learn whether you can actually sit
 * through a bad month is to have written down what you would do before it
 * happened.
 *
 * SO IT STORES A CLAIM, NOT A CALCULATION. An entry never carries a return, a
 * value or a P&L. Those come from the record, computed once, in the engine.
 *
 * FREE-FORM NOTE AND EXPLICIT SYMBOLS, at the owner's choice: the interesting
 * months are the ones where he DISAGREES with the ranking, and a tick-box
 * saying "I'd take this month's Top 5" could never record a deviation.
 *
 * SEPARATE STORE FROM THE PORTFOLIO. A paper intention is not a holding. If
 * the two ever mixed, an intention could be valued as real money — which is
 * the exact confusion D1 exists to prevent.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { createIndexedDBBackend, createMemoryBackend, isIndexedDBAvailable, STORES } from '../cache/idbBackend.js';

/** Bumped only when a stored entry's shape changes. */
export const JOURNAL_SCHEMA_VERSION = 1;

const KEY_PREFIX = 'journal:';

/** Hard ceiling on a note, so one entry cannot fill the quota for the rest. */
export const MAX_NOTE_LENGTH = 2000;

/**
 * Validate and normalise an entry.
 *
 * Returns `{ ok: true, value }` or `{ ok: false, reason }`. Never throws:
 * a malformed entry is a message to the reader, not a crash.
 */
export function validateEntry(input) {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'No entry supplied.' };

  const monthKey = String(input.monthKey ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return { ok: false, reason: 'A journal entry needs a month, as YYYY-MM.' };
  }

  const universeKey = String(input.universeKey ?? '').trim();
  if (!universeKey) return { ok: false, reason: 'A journal entry needs a universe.' };

  const note = String(input.note ?? '').trim();
  if (note.length > MAX_NOTE_LENGTH) {
    return { ok: false, reason: `Notes are limited to ${MAX_NOTE_LENGTH} characters.` };
  }

  /*
    Symbols are stored as the reader typed them, uppercased and de-duplicated.
    NOT validated against the universe: the point of the journal is to capture
    a deviation, and refusing a symbol because it is not in this month's Top 5
    would reject precisely the entries worth keeping.
  */
  const symbols = [...new Set(
    (Array.isArray(input.symbols) ? input.symbols : [])
      .map((s) => String(s ?? '').trim().toUpperCase())
      .filter(Boolean),
  )];

  if (!note && symbols.length === 0) {
    return { ok: false, reason: 'Write a note or name at least one stock.' };
  }

  return {
    ok: true,
    value: {
      monthKey,
      universeKey,
      note,
      symbols,
      /*
        FOLLOWED THE RANKING, or deviated from it. Recorded as the reader's
        own assertion rather than derived by comparing symbols to the Top 5 —
        deriving it would make the journal depend on ranking data that may
        have changed by the time the entry is read back, and the point is what
        they believed at the time.
      */
      followedRanking: input.followedRanking === true,
      schemaVersion: JOURNAL_SCHEMA_VERSION,
    },
  };
}

/** Drop anything unreadable rather than letting it break the whole list. */
function migrate(record) {
  if (!record || typeof record !== 'object') return null;
  if (!/^\d{4}-\d{2}$/.test(String(record.monthKey ?? ''))) return null;
  if (!record.universeKey) return null;
  return {
    ...record,
    note: String(record.note ?? ''),
    symbols: Array.isArray(record.symbols) ? record.symbols : [],
    followedRanking: record.followedRanking === true,
  };
}

export function createJournalStore({ backend, now = () => Date.now() } = {}) {
  const usingIndexedDB = backend ? false : isIndexedDBAvailable();
  const store = backend ?? (usingIndexedDB ? createIndexedDBBackend(STORES.JOURNAL) : createMemoryBackend());

  const key = (id) => KEY_PREFIX + id;

  async function readAll() {
    try {
      const keys = (await store.keys()).filter((k) => String(k).startsWith(KEY_PREFIX));
      const out = [];
      for (const k of keys) {
        const migrated = migrate(await store.get(k));
        if (migrated) out.push(migrated);
      }
      /*
        Newest first. A journal is read to see what was last said, unlike the
        portfolio which is read as a running ledger.
      */
      return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    } catch {
      // Storage unreadable: the app works, the journal is empty for this
      // session, and nothing stored is destroyed.
      return [];
    }
  }

  return {
    /** True when running without durable storage — the UI says so. */
    isDegraded: () => !backend && !usingIndexedDB,

    list: readAll,

    /**
     * Record an intention.
     *
     * `createdAt` is set HERE and never accepted from the caller. The whole
     * value of the entry is that it predates the outcome, so a timestamp the
     * caller could choose would let hindsight be backdated into it.
     */
    async add(input) {
      const check = validateEntry(input);
      if (!check.ok) return { ok: false, reason: check.reason };

      const id = `${check.value.monthKey}-${check.value.universeKey}-${now()}`;
      const record = { ...check.value, id, createdAt: new Date(now()).toISOString() };

      try {
        await store.put(key(id), record);
        return { ok: true, value: record };
      } catch {
        return { ok: false, reason: 'Could not save — this device may be out of storage.' };
      }
    },

    /**
     * Edit the NOTE only.
     *
     * The month, the universe and the timestamp are fixed once written. An
     * entry whose symbols could be changed after the fact is no longer a
     * record of what was believed at the time, which is the only thing this
     * store is for.
     */
    async updateNote(id, note) {
      try {
        const existing = migrate(await store.get(key(id)).catch(() => null));
        if (!existing) return { ok: false, reason: 'That entry no longer exists.' };

        const trimmed = String(note ?? '').trim();
        if (trimmed.length > MAX_NOTE_LENGTH) {
          return { ok: false, reason: `Notes are limited to ${MAX_NOTE_LENGTH} characters.` };
        }

        const merged = { ...existing, note: trimmed, editedAt: new Date(now()).toISOString() };
        await store.put(key(id), merged);
        return { ok: true, value: merged };
      } catch {
        return { ok: false, reason: 'Could not save the edit.' };
      }
    },

    async remove(id) {
      try {
        await store.delete(key(id));
        return { ok: true };
      } catch {
        return { ok: false, reason: 'Could not delete that entry.' };
      }
    },
  };
}

export const journalStore = createJournalStore();
