/**
 * PORTFOLIO STORE — the user's own positions.
 *
 * WHAT THIS OWNS
 *   Persisting, migrating, exporting and importing manually-entered holdings.
 *
 * WHAT THIS MUST NEVER DO
 *   Clear on a version bump. The bar store may, because prices are
 *   re-fetchable; these are not. A migration bug here loses something the user
 *   typed in and cannot get back, so records are MIGRATED and never dropped.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY EXPORT IS MANDATORY, NOT A NICETY   (decision D3)
 *
 * There is no account and no cloud sync — deliberately, per Phase 1 §42. That
 * means this data lives in one browser on one device and disappears if the
 * user clears site data, switches browser, or replaces their phone.
 *
 * Device-local storage with no export path is a data-loss trap. Export is the
 * ONLY backup mechanism that exists, which is why it ships in the same
 * milestone as the store rather than "later".
 *
 * The same reasoning drives the disclosure shown before the first save: a user
 * who enters twenty positions and then discovers the terms has been treated
 * badly, and the app knew the terms all along.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * WHY QUANTITY IS THE STORED TRUTH
 *   The UI offers "shares OR amount" as mutually exclusive inputs. If amount
 *   were stored, share counts would drift under the user as prices moved;
 *   storing both would let the two disagree. So amount is converted to whole
 *   shares AT ENTRY and the quantity is what persists.
 */

import { createIndexedDBBackend, createMemoryBackend, isIndexedDBAvailable, STORES } from '../cache/idbBackend.js';

/** Bump only alongside a migration. Never to force a clear. */
export const PORTFOLIO_SCHEMA_VERSION = 1;

const KEY_PREFIX = 'pos:';
const EXPORT_FORMAT = 'gati.portfolio.v1';

/**
 * Time-ordered, collision-free, generated offline.
 *
 * Sortable by construction, so records have a natural order without a separate
 * index, and unique without a server to hand out ids.
 */
function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Validate a position.
 *
 * Returns a list of problems rather than throwing, so a form can show all of
 * them at once instead of revealing them one save at a time.
 */
export function validatePosition(input) {
  const problems = [];
  if (!input || typeof input !== 'object') return ['No position supplied'];

  if (typeof input.symbol !== 'string' || input.symbol.trim() === '') problems.push('A stock must be chosen');
  if (!(input.purchasePrice > 0) || !Number.isFinite(input.purchasePrice)) problems.push('Purchase price must be a positive number');
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) problems.push('Quantity must be a whole number of shares');
  if (input.purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate)) problems.push('Purchase date must be a real date');

  return problems;
}

function isWellFormed(record) {
  return (
    record != null &&
    typeof record === 'object' &&
    typeof record.id === 'string' &&
    typeof record.symbol === 'string' &&
    Number.isFinite(record.purchasePrice) &&
    Number.isInteger(record.quantity)
  );
}

/**
 * Migrate a stored record forward.
 *
 * Returns null only when a record is beyond repair — and a null is DROPPED
 * from the returned list rather than silently replaced with defaults, because
 * inventing a purchase price would be fabricating a financial value.
 */
function migrate(record) {
  if (!isWellFormed(record)) return null;
  if (record.schemaVersion === PORTFOLIO_SCHEMA_VERSION) return record;
  // No migrations yet. When one is needed it belongs here, stepwise, so a
  // record two versions old passes through every intermediate step.
  return { ...record, schemaVersion: PORTFOLIO_SCHEMA_VERSION };
}

export function createPortfolioStore({ backend, now = () => Date.now() } = {}) {
  const usingIndexedDB = backend ? false : isIndexedDBAvailable();
  const store = backend ?? (usingIndexedDB ? createIndexedDBBackend(STORES.PORTFOLIO) : createMemoryBackend());
  const stats = { reads: 0, writes: 0, writeFailures: 0, dropped: 0 };

  const key = (id) => KEY_PREFIX + id;

  async function readAll() {
    try {
      stats.reads++;
      const keys = (await store.keys()).filter((k) => String(k).startsWith(KEY_PREFIX));
      const out = [];
      for (const k of keys) {
        const migrated = migrate(await store.get(k));
        if (migrated) out.push(migrated);
        else stats.dropped++;
      }
      return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    } catch {
      // Storage unreadable: the app works, the portfolio is empty for this
      // session, and nothing stored is destroyed.
      return [];
    }
  }

  return {
    /** True when running without durable storage — the UI says so. */
    isDegraded: () => !backend && !usingIndexedDB,

    list: readAll,

    /**
     * Add a position.
     *
     * Whole shares only. A caller supplying an amount converts it BEFORE
     * calling, at the price being entered, so the stored quantity can never
     * drift under the user.
     */
    async add(input) {
      const problems = validatePosition(input);
      if (problems.length > 0) return { ok: false, problems };

      const record = {
        id: newId(),
        schemaVersion: PORTFOLIO_SCHEMA_VERSION,
        symbol: input.symbol.trim(),
        name: input.name ?? input.symbol.trim(),
        universeKey: input.universeKey ?? null,
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        purchaseDate: input.purchaseDate ?? new Date(now()).toISOString().slice(0, 10),
        createdAt: new Date(now()).toISOString(),
        updatedAt: new Date(now()).toISOString(),
      };

      try {
        // One key, one write — atomic by construction. A failure leaves the
        // prior state untouched rather than half a position.
        await store.put(key(record.id), record);
        stats.writes++;
        return { ok: true, position: record };
      } catch (error) {
        stats.writeFailures++;
        return { ok: false, problems: ['Could not save. Your other positions are unaffected.'], error };
      }
    },

    /**
     * Update a position.
     *
     * Full replacement of the mutable fields, never a partial patch, so a
     * half-written record is impossible.
     */
    async update(id, changes) {
      const existing = migrate(await store.get(key(id)).catch(() => null));
      if (!existing) return { ok: false, problems: ['That position no longer exists'] };

      const merged = {
        ...existing,
        quantity: changes.quantity ?? existing.quantity,
        purchasePrice: changes.purchasePrice ?? existing.purchasePrice,
        purchaseDate: changes.purchaseDate ?? existing.purchaseDate,
        updatedAt: new Date(now()).toISOString(),
      };

      const problems = validatePosition(merged);
      if (problems.length > 0) return { ok: false, problems };

      try {
        await store.put(key(id), merged);
        stats.writes++;
        return { ok: true, position: merged };
      } catch (error) {
        stats.writeFailures++;
        return { ok: false, problems: ['Could not save the change. Nothing was altered.'], error };
      }
    },

    /** Hard delete, after explicit confirmation in the UI. No soft-delete: a
     *  trash nobody empties is just storage that lies about being empty. */
    async remove(id) {
      try {
        await store.delete(key(id));
        return { ok: true };
      } catch {
        return { ok: false, problems: ['Could not delete. Nothing was changed.'] };
      }
    },

    async count() {
      return (await readAll()).length;
    },

    /**
     * Export everything as a portable object.
     *
     * Carries its format and version so a future import can tell what it is
     * looking at rather than guessing from shape.
     */
    async exportAll() {
      return {
        format: EXPORT_FORMAT,
        schemaVersion: PORTFOLIO_SCHEMA_VERSION,
        exportedAt: new Date(now()).toISOString(),
        positions: await readAll(),
      };
    },

    /**
     * Import a previously exported file.
     *
     * MERGES by id rather than replacing wholesale: importing a backup onto a
     * device that already has positions should not silently delete the ones
     * that were already there. Malformed records are counted and skipped, not
     * repaired — repairing would mean inventing a price.
     */
    async importAll(payload, { replace = false } = {}) {
      if (!payload || payload.format !== EXPORT_FORMAT || !Array.isArray(payload.positions)) {
        return { ok: false, problems: ['That file is not a Gati portfolio export'] };
      }

      if (replace) {
        for (const record of await readAll()) await store.delete(key(record.id)).catch(() => {});
      }

      let imported = 0;
      let skipped = 0;
      for (const raw of payload.positions) {
        const record = migrate(raw);
        if (!record) {
          skipped++;
          continue;
        }
        try {
          await store.put(key(record.id), { ...record, schemaVersion: PORTFOLIO_SCHEMA_VERSION });
          imported++;
        } catch {
          skipped++;
        }
      }
      return { ok: true, imported, skipped };
    },

    stats: () => ({ ...stats }),
  };
}

export const portfolioStore = createPortfolioStore();
