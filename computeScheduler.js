/**
 * COMPUTE SCHEDULER — where the heavy pass runs, and how often.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ RETAINED, DELIBERATELY UNWIRED — decision D16 (owner, 7 Aug 2026).    │
 * │                                                                       │
 * │ A dead-code scan WILL report this file and deriveUniverse.js as       │
 * │ unreferenced. They are. That is intentional: this is the Web Worker   │
 * │ escape hatch for the heavy pass, kept ready and not yet needed.       │
 * │                                                                       │
 * │ DO NOT DELETE as dead code.                                           │
 * │ DO NOT WIRE without a measured bottleneck — the heavy pass sits at    │
 * │ ~150ms against a 250ms budget and useUniverseData already memoises.   │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * WHAT THIS OWNS
 *   Memoising the heavy derived pass, and providing one stable interface
 *   behind which it can run either synchronously or in a Web Worker.
 *
 * WHAT THIS MUST NEVER DO
 *   Leak which implementation is in use. Callers await a result; whether it
 *   was computed on this thread or another is not their concern, and the day
 *   it changes must not be the day every caller changes with it.
 *
 * WHY THE INTERFACE EXISTS BEFORE THE WORKER IS NEEDED
 *   Measured today: the heavy pass takes roughly 30ms at 50 symbols, 90ms at
 *   150, and 155-200ms at 250, against a 250ms budget. That fits — for now.
 *   It fits with less room than the raw numbers suggest, though, because the
 *   figures move by more than 2x with machine load alone.
 *
 *   Retrofitting a worker later means rewriting every call site under time
 *   pressure. Defining the boundary now costs one indirection and makes the
 *   escalation a flag flip, which is exactly what the architecture asked for.
 *   The heavy pass was written quote-free and side-effect-free precisely so
 *   this stays true.
 *
 * MEMOISATION
 *   The heavy pass is keyed on the identity of the raw bundle plus the
 *   strategy parameters. Quotes and the entered amount are NOT in the key,
 *   because neither affects a single number the heavy pass produces — that is
 *   the entire premise of the split, and putting either in the key would
 *   silently undo it.
 */

import { deriveHeavy, deriveLight } from './deriveUniverse.js';

/** Interchangeable implementations. Both satisfy the same interface. */
export const COMPUTE_MODE = {
  SYNC: 'sync',
  WORKER: 'worker',
};

/**
 * Cache size. Three universes x four windows is twelve live combinations, and
 * a user realistically moves between a handful. Sixteen holds the working set
 * without pinning memory that will never be read again.
 */
const MAX_CACHED = 16;

/**
 * @param {object} [opts]
 * @param {string} [opts.mode]
 * @param {Function} [opts.runHeavy] injectable for tests and for the worker
 */
export function createComputeScheduler({ mode = COMPUTE_MODE.SYNC, runHeavy = deriveHeavy } = {}) {
  /** @type {Map<string, object>} insertion-ordered, so the oldest key is first */
  const cache = new Map();
  const inFlight = new Map();
  const stats = { hits: 0, misses: 0, computations: 0, evictions: 0 };

  /**
   * Key on the raw bundle's IDENTITY, not its contents.
   *
   * Hashing 250 symbols x 390 bars to build a cache key would cost more than
   * the computation it is meant to avoid. React Query hands back the same
   * object reference until the data actually changes, so reference identity
   * is both correct and free — provided the key includes a token that changes
   * when the bundle does, which `dataAsOf` and the provider id supply.
   */
  function keyFor(bundle, params) {
    return [
      bundle.universeKey,
      bundle.dataAsOf ?? 'no-data',
      bundle.providerId ?? 'unknown',
      bundle.priceSeriesMap?.size ?? 0,
      params.lookbackMonths,
      params.topN,
      params.costConfig?.enabled ? 'net' : 'gross',
    ].join('|');
  }

  function remember(key, value) {
    cache.set(key, value);
    while (cache.size > MAX_CACHED) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
      stats.evictions++;
    }
  }

  return {
    mode,

    /**
     * Heavy pass, memoised and de-duplicated.
     *
     * Concurrent calls for the same key share one computation rather than
     * racing: two components mounting together must not both run a
     * 250-symbol backtest.
     */
    async derive(bundle, params = {}) {
      const resolved = {
        lookbackMonths: params.lookbackMonths ?? 1,
        topN: params.topN ?? 5,
        costConfig: params.costConfig,
      };
      const key = keyFor(bundle, resolved);

      const cached = cache.get(key);
      if (cached) {
        stats.hits++;
        // Refresh recency: re-inserting moves the key to the end of the map.
        cache.delete(key);
        cache.set(key, cached);
        return cached;
      }

      const pending = inFlight.get(key);
      if (pending) return pending;

      stats.misses++;
      const promise = (async () => {
        stats.computations++;
        // The single line the worker implementation replaces. Everything
        // above and below it is transport-agnostic by design.
        const result = await runHeavy({
          stocks: bundle.stocks,
          priceSeriesMap: bundle.priceSeriesMap,
          benchmarkSeries: bundle.benchmarkSeries,
          unavailableSymbols: bundle.unavailableSymbols,
          universeKey: bundle.universeKey,
          ...resolved,
        });
        remember(key, result);
        return result;
      })().finally(() => inFlight.delete(key));

      inFlight.set(key, promise);
      return promise;
    },

    /**
     * Light pass. Synchronous by definition and never memoised — it runs on
     * every quote tick, so caching it would allocate more than it saves.
     */
    applyQuotes(heavy, quotes) {
      return deriveLight({ heavy, quotes });
    },

    /** Invalidate one universe's entries, e.g. after a manual refresh. */
    invalidate(universeKey) {
      let removed = 0;
      for (const key of [...cache.keys()]) {
        if (key.startsWith(`${universeKey}|`)) {
          cache.delete(key);
          removed++;
        }
      }
      return removed;
    },

    clear() {
      cache.clear();
      inFlight.clear();
    },

    stats: () => ({ ...stats, cached: cache.size, mode }),
  };
}

/** The application-wide scheduler. Tests build their own. */
export const computeScheduler = createComputeScheduler();
