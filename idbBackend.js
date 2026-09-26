/**
 * INDEXEDDB BACKEND — a minimal promise wrapper over one object store.
 *
 * WHAT THIS OWNS
 *   Getting bytes in and out of IndexedDB. Nothing else.
 *
 * WHAT THIS MUST NEVER DO
 *   Know what a price bar is, or decide whether a cached record is fresh.
 *   Freshness, coverage and eviction are the bar store's job; keeping that
 *   split is what lets the bar store be tested exhaustively against an
 *   in-memory double while this adapter stays thin enough to be obviously
 *   correct.
 *
 * WHY INDEXEDDB AND NOT LOCALSTORAGE
 *   Measured: one daily bar is ~115-130 bytes of JSON, and there are ~390
 *   trading days since the data start date. That is ~48 kB per symbol and
 *   ~21 MB for all 453 configured symbols, against a ~5 MB localStorage
 *   origin quota. The previous cache wrote there and SWALLOWED the resulting
 *   QuotaExceededError, so caching succeeded for roughly the first hundred
 *   symbols and then silently stopped — every load refetching most of a
 *   universe, with nothing anywhere saying so.
 *
 * WHY NO LIBRARY
 *   The surface actually needed is get/put/delete/keys/clear on one store.
 *   A dependency for that is a dependency to audit, update and ship.
 */

const DB_NAME = 'gati';

/**
 * Bumped to 2 in M11 to add the `portfolio` store.
 *
 * The upgrade is NON-DESTRUCTIVE: it creates missing stores and touches
 * nothing existing. That matters more here than it did for bars — cached
 * prices are re-fetchable, and a user's own positions are not. A version bump
 * that dropped data would be unrecoverable.
 */
/*
  Bumped to 3 in M15 to add the `journal` store.

  THE UPGRADE PATH IS ALREADY CORRECT FOR THIS: `onupgradeneeded` creates any
  missing store and touches nothing existing, so a reader on version 2 gains
  the journal and keeps every position. That was designed in M11 precisely so
  a later addition would not risk the one store that cannot be re-fetched.
*/
const DB_VERSION = 3;

export const STORES = {
  /** Cached price series. Re-fetchable, so safe to clear on a schema change. */
  BARS: 'bars',
  /** The user's own positions. NOT re-fetchable — migrate, never clear. */
  PORTFOLIO: 'portfolio',
  /*
    The decision journal (D25). NOT re-fetchable either — it records what the
    reader said they would do BEFORE the outcome was known, which is the one
    thing no recomputation can reproduce.

    SEPARATE FROM `portfolio` ON PURPOSE. A paper intention is not a holding,
    and the two must never mix: the portfolio values real money and the
    journal records a claim about the future. D25 and D1 both depend on that
    line staying clean.
  */
  JOURNAL: 'journal',
};

const STORE = STORES.BARS;

/** True when IndexedDB is usable. False in Node, in some private modes, and
 *  when a browser has storage blocked — all of which must degrade, not throw. */
export function isIndexedDBAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      // Additive only. Every store is created if absent and left alone if
      // present, so upgrading can never lose a position someone entered.
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    // A blocked open means another tab holds an older version. Rejecting lets
    // the bar store fall back to memory rather than hanging the whole load.
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
  });
}

function runTransaction(mode, fn, storeName = STORE) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = () => {
          db.close();
          resolve(result?.result !== undefined ? result.result : result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction aborted'));
        };
      }),
  );
}

/**
 * Backend with the same surface as the in-memory test double, so the bar
 * store cannot tell them apart.
 */
export function createIndexedDBBackend(storeName = STORE) {
  return {
    async get(key) {
      return runTransaction('readonly', (store) => store.get(key), storeName);
    },
    async put(key, value) {
      await runTransaction('readwrite', (store) => store.put(value, key), storeName);
    },
    async delete(key) {
      await runTransaction('readwrite', (store) => store.delete(key), storeName);
      return true;
    },
    async keys() {
      const keys = await runTransaction('readonly', (store) => store.getAllKeys(), storeName);
      return Array.from(keys ?? []);
    },
    async clear() {
      await runTransaction('readwrite', (store) => store.clear(), storeName);
    },
  };
}

/**
 * In-memory backend. Used when IndexedDB is unavailable, and in tests.
 *
 * This is a DEGRADED mode, not a silent equivalent: the cache lives only for
 * the session. The bar store reports it so the UI can say so rather than
 * leaving the user wondering why every load is slow.
 */
export function createMemoryBackend() {
  const map = new Map();
  return {
    async get(key) {
      return map.get(key) ?? undefined;
    },
    async put(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      return map.delete(key);
    },
    async keys() {
      return [...map.keys()];
    },
    async clear() {
      map.clear();
    },
  };
}
