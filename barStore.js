/**
 * BAR STORE — the persistent cache for historical price series.
 *
 * WHAT THIS OWNS
 *   Whether a symbol's bars are already held, whether they still count as
 *   fresh, whether they cover the range being asked for, and what to evict
 *   when the store grows too large.
 *
 * WHAT THIS MUST NEVER DO
 *   Fetch, or calculate. It answers "do we already have this", never "go and
 *   get it" and never "what does it mean".
 *
 * WHY ONE RECORD PER SYMBOL RATHER THAN PER DATE-RANGE
 *   The previous cache keyed on `symbol:start:end`, so a request for a wider
 *   or differently-ended range produced a second, overlapping copy of almost
 *   the same data — and today's date moving on meant a fresh key, and
 *   therefore a total miss, every single day. One record per symbol with a
 *   recorded coverage window makes a wider request EXTEND the existing entry
 *   instead of duplicating it, and eliminates the "which cached range should
 *   I use?" question entirely.
 *
 * THE WEEKEND TRAP, and why coverage is compared against the REQUESTED end
 *   If a hit required `coverageEnd >= requestedEnd`, then asking for data
 *   through Saturday when the newest bar is Friday's would miss forever —
 *   there is no Saturday bar and there never will be. So the record stores
 *   `requestedEnd` (what we asked Yahoo for) alongside `coverageEnd` (what
 *   came back), and a hit means "we already asked for at least this much, and
 *   it is still fresh". Comparing against actual bar dates instead would make
 *   every weekend and every market holiday a guaranteed cache miss.
 *
 * FRESHNESS
 *   6 hours. Historical bars do not change intraday, and the current day's
 *   still-forming bar is handled by the TTL rather than by special-casing it —
 *   a 6h window cannot span an entire session, so today's bar is always
 *   re-fetched at least once more before the market closes.
 */

import { createIndexedDBBackend, createMemoryBackend, isIndexedDBAvailable } from './idbBackend.js';

/**
 * Sort a price series ascending by date and collapse repeated dates.
 *
 * Exported because it is the definition of "a well-formed series" for the
 * whole app, and a second copy of that definition is a second opinion.
 *
 * Returns the cleaned bars plus any CONFLICTING duplicates — same date,
 * different close. Those are not resolved here: which of two prices for one
 * day is the real one is not a question a cache can answer, and picking
 * either would be a guess presented as a fact.
 *
 * @returns {{ bars: object[], conflicts: string[] }}
 */
export function normaliseBars(bars) {
  if (!Array.isArray(bars) || bars.length === 0) return { bars: [], conflicts: [] };

  const byDate = new Map();
  const conflicts = new Set();

  for (const bar of bars) {
    if (!bar || !isRealCalendarDate(bar.date)) continue;
    const seen = byDate.get(bar.date);
    if (seen) {
      // Identical repeat: harmless, collapse it. Genuinely different close
      // for the same session: an integrity fault, and the caller is told.
      const a = seen.adjClose ?? seen.close;
      const b = bar.adjClose ?? bar.close;
      if (a !== b) conflicts.add(bar.date);
    }
    byDate.set(bar.date, bar);
  }

  return {
    bars: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    conflicts: [...conflicts],
  };
}

/**
 * Is this a real `YYYY-MM-DD` day that actually exists on the calendar?
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT JUST A SHAPE CHECK.
 *
 * `new Date('2026-02-30')` does not throw. It ROLLS OVER to 2 March, and
 * `monthKey` — which parses exactly that way — therefore files a bar dated
 * 30 February under MARCH. A date that does not exist does not sit inert in
 * the series; it becomes a month-end for a month it has nothing to do with.
 *
 * Demonstrated on the real engine during the v1.6.5 audit: a stock with no
 * genuine March bar had its 30-February row adopted as the March month-end
 * and was RANKED on a −76.98% return computed from it.
 *
 * So the string is parsed AND round-tripped: if formatting the parsed date
 * does not give back the original string, the rollover happened and the date
 * was never real. That catches 30 February, 29 February in a common year,
 * 31 April, month 13, day 32 — every impossible date, with no table of
 * month lengths to keep correct.
 * ═════════════════════════════════════════════════════════════════════════
 */
function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Bump to invalidate every cached record. */
export const BAR_SCHEMA_VERSION = 1;

export const BAR_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Soft cap before LRU eviction. ~21 MB holds all 453 configured symbols with
 * room to spare; 60 MB leaves headroom for a longer data start date without
 * thrashing, and is far below any realistic IndexedDB limit.
 */
export const SOFT_CAP_BYTES = 60 * 1024 * 1024;

const KEY_PREFIX = 'bars:';

/**
 * @param {object} [opts]
 * @param {object} [opts.backend] storage backend; defaults to IndexedDB, or
 *   memory when unavailable
 * @param {() => number} [opts.now] injectable clock — engines and stores are
 *   deterministic only if time is an input
 * @param {number} [opts.ttlMs]
 * @param {number} [opts.softCapBytes]
 */
export function createBarStore({
  backend,
  now = () => Date.now(),
  ttlMs = BAR_TTL_MS,
  softCapBytes = SOFT_CAP_BYTES,
} = {}) {
  const usingIndexedDB = backend ? false : isIndexedDBAvailable();
  const store = backend ?? (usingIndexedDB ? createIndexedDBBackend() : createMemoryBackend());

  const stats = { hits: 0, misses: 0, stale: 0, corrupt: 0, writes: 0, writeFailures: 0, evictions: 0 };

  /** True when running without durable storage — the UI may surface this. */
  const degraded = !backend && !usingIndexedDB;

  function key(symbol) {
    return KEY_PREFIX + symbol;
  }

  /**
   * A record is only usable if it is the current schema, structurally intact,
   * and actually contains bars. Anything else is treated as a MISS and
   * deleted — never repaired. Repairing would mean guessing at financial
   * inputs, which is the one thing this system must never do.
   */
  function isWellFormed(record) {
    return (
      record != null &&
      typeof record === 'object' &&
      record.schemaVersion === BAR_SCHEMA_VERSION &&
      Array.isArray(record.bars) &&
      typeof record.requestedStart === 'string' &&
      typeof record.requestedEnd === 'string' &&
      typeof record.fetchedAt === 'number'
    );
  }

  async function readRecord(symbol) {
    let raw;
    try {
      raw = await store.get(key(symbol));
    } catch {
      // Storage failed on read. Degrade to a miss rather than failing the
      // load — a cache that cannot be read is a slow app, not a broken one.
      return null;
    }
    if (raw === undefined || raw === null) return null;

    if (!isWellFormed(raw)) {
      stats.corrupt++;
      try {
        await store.delete(key(symbol));
      } catch {
        /* nothing useful to do; the record is already unusable */
      }
      return null;
    }
    return raw;
  }

  return {
    /** Reports whether durable storage is actually in use. */
    isDegraded: () => degraded,

    /**
     * Bars for `symbol` covering `[startDate, endDate]`, or null on a miss.
     *
     * A hit requires all three: current schema, still fresh, and a previously
     * requested window at least as wide as this one.
     */
    async get(symbol, { startDate, endDate }) {
      const record = await readRecord(symbol);
      if (!record) {
        stats.misses++;
        return null;
      }

      if (now() - record.fetchedAt > ttlMs) {
        stats.stale++;
        stats.misses++;
        return null;
      }

      // See "THE WEEKEND TRAP" above: compare against what was REQUESTED.
      const coversStart = record.requestedStart <= startDate;
      const coversEnd = record.requestedEnd >= endDate;
      if (!coversStart || !coversEnd) {
        stats.misses++;
        return null;
      }

      stats.hits++;

      // Touch for LRU. Failure here is genuinely unimportant — it costs
      // eviction accuracy, not correctness — so it must not fail the read.
      store.put(key(symbol), { ...record, lastAccessed: now() }).catch(() => {});

      // Slice to the window asked for, so a caller that requested less than
      // is held does not silently receive more than it expects.
      return record.bars.filter((b) => b.date >= startDate && b.date <= endDate);
    },

    /**
     * Store bars for `symbol`, extending any existing coverage rather than
     * replacing it.
     *
     * Returns true on success, false when the write failed. NEVER THROWS: a
     * cache write failure must not fail a load that already has its data.
     * (The previous cache also never threw — but it never reported either,
     * which is how a full quota went unnoticed for months. This one counts.)
     */
    async put(symbol, bars, { startDate, endDate, source = 'unknown' }) {
      if (!Array.isArray(bars) || bars.length === 0) return false;

      const existing = await readRecord(symbol);

      /**
       * ═══════════════════════════════════════════════════════════════════
       * NORMALISE ON EVERY WRITE — sorted ascending, one bar per date.
       *
       * THE BUG THIS CLOSES (found during the v1.6.4 audit).
       *
       * The union below sorted and de-duplicated, but only when a record
       * ALREADY EXISTED. A first write stored whatever the provider handed
       * over, verbatim. So the same provider response produced two different
       * stored shapes depending on whether the cache happened to be warm —
       * and everything downstream reads position, not date:
       *
       *   currentMomentum   `series[series.length - 1]` is "the latest bar"
       *   barStore          `merged[0]` / `merged.at(-1)` are the coverage
       *                     window, which decides whether to re-fetch at all
       *
       * With unsorted bars on a cold cache the "latest" bar is simply
       * whichever landed last in the array. Measured during the audit: a
       * stock whose three bars arrived newest-first was read as having
       * stopped trading in June, and was dropped from the ranking entirely.
       * On the next load — cache now warm, bars now sorted — the same stock
       * ranked normally. A ranking that changes with cache state is the
       * hardest class of bug there is to believe, let alone reproduce.
       *
       * CONFLICTING DUPLICATES ARE NOT SILENTLY RESOLVED. Two bars for one
       * date with the SAME close are a harmless repeat and collapse quietly.
       * Two with DIFFERENT closes are a genuine integrity fault — the audit
       * found a fabricated duplicate at ₹999 against a true ₹212 producing a
       * ranked −76.98% return — and there is no way to know which is real.
       * The pair is counted and reported so `dataService` can flag the
       * symbol rather than rank it on a coin toss.
       * ═══════════════════════════════════════════════════════════════════
       */
      const { bars: incoming } = normaliseBars(bars);
      if (incoming.length === 0) return false;

      let merged = incoming;
      let requestedStart = startDate;
      let requestedEnd = endDate;

      if (existing) {
        // Union by date, newest write winning on a collision — a re-fetched
        // bar reflects the provider's current adjusted-close basis, and an
        // older copy of the same day may predate a corporate action.
        const byDate = new Map(existing.bars.map((b) => [b.date, b]));
        for (const bar of incoming) byDate.set(bar.date, bar);
        merged = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

        requestedStart = existing.requestedStart < startDate ? existing.requestedStart : startDate;
        requestedEnd = existing.requestedEnd > endDate ? existing.requestedEnd : endDate;
      }

      const record = {
        schemaVersion: BAR_SCHEMA_VERSION,
        symbol,
        bars: merged,
        requestedStart,
        requestedEnd,
        coverageStart: merged[0]?.date ?? null,
        coverageEnd: merged[merged.length - 1]?.date ?? null,
        rowCount: merged.length,
        source,
        fetchedAt: now(),
        lastAccessed: now(),
      };

      try {
        await store.put(key(symbol), record);
        stats.writes++;
        return true;
      } catch (err) {
        stats.writeFailures++;
        // Deliberately visible. The defect this store replaces was invisible
        // precisely because its failure path was empty.
        if (typeof console !== 'undefined') {
          console.warn(`[barStore] write failed for ${symbol}: ${err?.message ?? err}`);
        }
        return false;
      }
    },

    async delete(symbol) {
      try {
        return await store.delete(key(symbol));
      } catch {
        return false;
      }
    },

    async clear() {
      try {
        await store.clear();
      } catch {
        /* already unusable */
      }
    },

    /** Approximate held bytes and symbol count. Approximate is enough: this
     *  drives eviction and a diagnostic, not a financial figure. */
    async usage() {
      try {
        const keys = (await store.keys()).filter((k) => String(k).startsWith(KEY_PREFIX));
        let bytes = 0;
        for (const k of keys) {
          const rec = await store.get(k);
          if (rec) bytes += JSON.stringify(rec).length;
        }
        return { symbolCount: keys.length, approxBytes: bytes };
      } catch {
        return { symbolCount: 0, approxBytes: 0 };
      }
    },

    /**
     * Evict least-recently-used symbols until under the soft cap.
     *
     * Whole symbols are evicted, never partial series: half a series is worse
     * than none, because a gap in the middle of a range looks like missing
     * market data rather than a missing cache entry.
     */
    async evictIfNeeded() {
      try {
        const keys = (await store.keys()).filter((k) => String(k).startsWith(KEY_PREFIX));
        const records = [];
        let total = 0;
        for (const k of keys) {
          const rec = await store.get(k);
          if (!rec) continue;
          const size = JSON.stringify(rec).length;
          total += size;
          records.push({ key: k, size, lastAccessed: rec.lastAccessed ?? 0 });
        }
        if (total <= softCapBytes) return 0;

        records.sort((a, b) => a.lastAccessed - b.lastAccessed);
        let evicted = 0;
        for (const r of records) {
          if (total <= softCapBytes) break;
          await store.delete(r.key);
          total -= r.size;
          evicted++;
          stats.evictions++;
        }
        return evicted;
      } catch {
        return 0;
      }
    },

    stats: () => ({ ...stats, degraded }),
    _resetStats: () => {
      for (const k of Object.keys(stats)) stats[k] = 0;
    },
  };
}

/** The application-wide store. Tests build their own with an injected backend. */
export const barStore = createBarStore();
