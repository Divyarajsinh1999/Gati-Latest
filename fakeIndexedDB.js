/**
 * FAKE INDEXEDDB — an in-memory key/value double for storage tests.
 *
 * WHAT THIS OWNS
 *   A minimal, promise-based store with the behaviours the bar store and the
 *   portfolio store actually depend on, plus the FAILURE MODES that matter.
 *
 * WHAT THIS MUST NEVER DO
 *   Grow into a full IndexedDB implementation. It exists to test OUR code, not
 *   the browser's. If a test needs cursors, indexes or versionchange events,
 *   that test belongs in a real browser environment.
 *
 * WHY THE FAILURE MODES ARE THE POINT
 *   The defect this harness was written for is a silent one: the current
 *   historical cache writes to localStorage, whose ~5 MB origin quota cannot
 *   hold the ~21 MB that 453 symbols of daily bars require, and the
 *   QuotaExceededError is swallowed. Caching therefore succeeds for roughly
 *   the first hundred symbols and then quietly stops. No test caught it,
 *   because no test ever filled the quota. So this double can be told to
 *   enforce a byte budget, to go unavailable entirely, and to corrupt a
 *   record — the three storage realities that must be handled rather than
 *   assumed away.
 */

export class QuotaExceededError extends Error {
  constructor(message = 'Quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class StorageUnavailableError extends Error {
  constructor(message = 'Storage unavailable') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

/**
 * @param {object} [opts]
 * @param {number} [opts.quotaBytes] byte budget; omit for unlimited
 * @param {boolean} [opts.unavailable] simulate private mode / blocked storage
 */
export function createFakeStore({ quotaBytes = Infinity, unavailable = false } = {}) {
  /** @type {Map<string, string>} */
  const data = new Map();
  const stats = { reads: 0, writes: 0, deletes: 0, quotaFailures: 0 };

  function assertAvailable() {
    if (unavailable) throw new StorageUnavailableError();
  }

  function usedBytes() {
    let total = 0;
    for (const [k, v] of data) total += k.length + v.length;
    return total;
  }

  return {
    async get(key) {
      assertAvailable();
      stats.reads++;
      const raw = data.get(key);
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw);
      } catch {
        // A corrupt record is a MISS, never a repair. Repairing would mean
        // guessing at financial inputs.
        data.delete(key);
        return null;
      }
    },

    async put(key, value) {
      assertAvailable();
      const raw = JSON.stringify(value);
      const projected = usedBytes() - (data.get(key)?.length ?? 0) + key.length + raw.length;
      if (projected > quotaBytes) {
        stats.quotaFailures++;
        throw new QuotaExceededError(
          `Writing "${key}" would use ${projected} bytes of a ${quotaBytes}-byte budget`,
        );
      }
      data.set(key, raw);
      stats.writes++;
    },

    async delete(key) {
      assertAvailable();
      stats.deletes++;
      return data.delete(key);
    },

    async keys() {
      assertAvailable();
      return [...data.keys()];
    },

    async clear() {
      assertAvailable();
      data.clear();
    },

    /* ---- test-only affordances ---- */

    /** Bytes currently held — the assertion the quota defect needed. */
    _usedBytes: usedBytes,
    /** Call counts, for asserting "a warm load issues zero fetches". */
    _stats: () => ({ ...stats }),
    /** Write an unparseable value to exercise corruption handling. */
    _corrupt: (key) => data.set(key, '{not json'),
    /** Flip availability mid-test to exercise graceful degradation. */
    _setUnavailable: (v) => {
      unavailable = v;
    },
  };
}

/** Chrome/Firefox/Safari all cap localStorage at roughly 5 MB per origin. */
export const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
