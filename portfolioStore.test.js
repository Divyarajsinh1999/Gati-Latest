/**
 * PORTFOLIO STORE TESTS.
 *
 * This is the only data in Gati that is NOT re-fetchable. Prices can be pulled
 * again; a purchase price someone typed in cannot. So these tests weight
 * durability above everything: a failed write must leave prior state intact, a
 * schema bump must migrate rather than clear, and the export must round-trip
 * exactly — because it is the only backup mechanism that exists.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPortfolioStore, validatePosition, PORTFOLIO_SCHEMA_VERSION,
} from '../persistence/portfolioStore.js';
import { createFakeStore } from '../../../tests/harness/fakeIndexedDB.js';

const valid = {
  symbol: 'TITAN.NS',
  name: 'Titan Company',
  universeKey: 'nifty50',
  quantity: 10,
  purchasePrice: 3200.5,
};

let store;
beforeEach(() => {
  store = createPortfolioStore({ backend: createFakeStore(), now: () => Date.parse('2026-08-04T10:00:00Z') });
});

/* ------------------------------------------------------------------ */
/* VALIDATION                                                          */
/* ------------------------------------------------------------------ */

describe('validatePosition', () => {
  it('accepts a well-formed position', () => {
    expect(validatePosition(valid)).toEqual([]);
  });

  it('reports EVERY problem at once, not one per save', () => {
    const problems = validatePosition({ symbol: '', quantity: 0, purchasePrice: -1 });
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses a fractional quantity', () => {
    // Indian cash-market delivery trades in whole shares.
    expect(validatePosition({ ...valid, quantity: 2.5 })).toContain('Quantity must be a whole number of shares');
  });

  it('refuses a zero or negative price', () => {
    for (const purchasePrice of [0, -5, Number.NaN, Infinity]) {
      expect(validatePosition({ ...valid, purchasePrice }).length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

describe('add / list / update / remove', () => {
  it('round-trips a position', async () => {
    const result = await store.add(valid);
    expect(result.ok).toBe(true);

    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: 'TITAN.NS', quantity: 10, purchasePrice: 3200.5 });
    expect(rows[0].schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION);
  });

  it('rejects an invalid position without storing anything', async () => {
    const result = await store.add({ ...valid, quantity: 0 });
    expect(result.ok).toBe(false);
    expect(await store.count()).toBe(0);
  });

  it('keeps multiple lots of the same symbol SEPARATE', async () => {
    // A second purchase must never mutate the first: the two have different
    // prices and dates, and merging them at rest would lose that.
    await store.add(valid);
    await store.add({ ...valid, quantity: 5, purchasePrice: 3400 });
    expect(await store.count()).toBe(2);
  });

  it('updates by full replacement, never a partial patch', async () => {
    const { position } = await store.add(valid);
    const result = await store.update(position.id, { quantity: 12 });

    expect(result.ok).toBe(true);
    expect(result.position.quantity).toBe(12);
    // Untouched fields survive; a half-written record is impossible.
    expect(result.position.purchasePrice).toBe(3200.5);
    expect(result.position.symbol).toBe('TITAN.NS');
  });

  it('refuses an update that would make a position invalid', async () => {
    const { position } = await store.add(valid);
    const result = await store.update(position.id, { quantity: -3 });
    expect(result.ok).toBe(false);
    expect((await store.list())[0].quantity).toBe(10);
  });

  it('reports a missing position rather than creating one', async () => {
    expect((await store.update('nope', { quantity: 1 })).ok).toBe(false);
    expect(await store.count()).toBe(0);
  });

  it('deletes hard, with no soft-delete', async () => {
    // A trash nobody empties is storage that lies about being empty.
    const { position } = await store.add(valid);
    expect((await store.remove(position.id)).ok).toBe(true);
    expect(await store.count()).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* DURABILITY                                                          */
/* ------------------------------------------------------------------ */

describe('durability', () => {
  it('a failed write leaves prior state intact', async () => {
    const backend = createFakeStore();
    const s = createPortfolioStore({ backend });
    await s.add(valid);

    // Quota exhausted mid-session.
    const tight = createPortfolioStore({ backend: createFakeStore({ quotaBytes: 10 }) });
    const result = await tight.add(valid);
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/other positions are unaffected/i);

    // The first store is untouched.
    expect(await s.count()).toBe(1);
  });

  it('survives unusable storage without throwing', async () => {
    const s = createPortfolioStore({ backend: createFakeStore({ unavailable: true }) });
    await expect(s.list()).resolves.toEqual([]);
    await expect(s.add(valid)).resolves.toMatchObject({ ok: false });
  });

  it('DROPS a corrupt record rather than repairing it', async () => {
    // Repairing would mean inventing a purchase price, which is fabricating a
    // financial value — the one thing this product never does.
    const backend = createFakeStore();
    const s = createPortfolioStore({ backend });
    const { position } = await s.add(valid);
    await backend.put(`pos:${position.id}`, { id: position.id, symbol: 'X' }); // no price, no quantity

    expect(await s.list()).toEqual([]);
    expect(s.stats().dropped).toBe(1);
  });

  it('MIGRATES an older record instead of clearing it', async () => {
    // Bars may be cleared on a schema bump because they are re-fetchable.
    // Positions are not, so they migrate forward.
    const backend = createFakeStore();
    const s = createPortfolioStore({ backend });
    await backend.put('pos:legacy', {
      id: 'legacy', symbol: 'TCS.NS', name: 'TCS',
      quantity: 4, purchasePrice: 3000, schemaVersion: 0, createdAt: '2026-01-01T00:00:00Z',
    });

    const rows = await s.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION);
    expect(rows[0].purchasePrice).toBe(3000);
  });
});

/* ------------------------------------------------------------------ */
/* BACKUP — the only recovery path that exists                          */
/* ------------------------------------------------------------------ */

describe('export and import', () => {
  it('exports a self-describing payload', async () => {
    await store.add(valid);
    const payload = await store.exportAll();

    // Carries its format and version, so a future import can tell what it is
    // looking at rather than guessing from shape.
    expect(payload.format).toBe('gati.portfolio.v1');
    expect(payload.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION);
    expect(payload.positions).toHaveLength(1);
  });

  it('round-trips exactly onto a fresh device', async () => {
    await store.add(valid);
    await store.add({ ...valid, symbol: 'INFY.NS', name: 'Infosys', quantity: 20, purchasePrice: 1500 });
    const payload = await store.exportAll();

    const fresh = createPortfolioStore({ backend: createFakeStore() });
    const result = await fresh.importAll(payload);

    expect(result).toMatchObject({ ok: true, imported: 2, skipped: 0 });
    expect(await fresh.list()).toEqual(await store.list());
  });

  it('MERGES rather than wiping what is already there', async () => {
    // Importing a backup onto a device that already has positions must not
    // silently delete the ones already present.
    const other = createPortfolioStore({ backend: createFakeStore() });
    await other.add({ ...valid, symbol: 'HDFCBANK.NS', name: 'HDFC Bank' });

    await store.add(valid);
    await other.importAll(await store.exportAll());

    expect(await other.count()).toBe(2);
  });

  it('replaces only when explicitly asked', async () => {
    const other = createPortfolioStore({ backend: createFakeStore() });
    await other.add({ ...valid, symbol: 'HDFCBANK.NS' });
    await store.add(valid);

    await other.importAll(await store.exportAll(), { replace: true });
    const rows = await other.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe('TITAN.NS');
  });

  it('rejects a file that is not a Gati export', async () => {
    for (const bad of [null, {}, { format: 'something-else', positions: [] }, { format: 'gati.portfolio.v1' }]) {
      expect((await store.importAll(bad)).ok).toBe(false);
    }
  });

  it('SKIPS unreadable records and reports how many, rather than failing wholesale', async () => {
    const result = await store.importAll({
      format: 'gati.portfolio.v1',
      schemaVersion: 1,
      positions: [
        { id: 'a', symbol: 'A.NS', quantity: 1, purchasePrice: 100 },
        { id: 'b', symbol: 'B.NS' }, // no price or quantity
      ],
    });
    expect(result).toMatchObject({ ok: true, imported: 1, skipped: 1 });
  });

  it('is idempotent — re-importing the same file changes nothing', async () => {
    await store.add(valid);
    const payload = await store.exportAll();
    await store.importAll(payload);
    await store.importAll(payload);
    expect(await store.count()).toBe(1);
  });
});

/**
 * THE PURCHASE DATE, AND THE TRAP IN ITS DEFAULT.
 *
 * The store stamps TODAY when a caller omits `purchaseDate`. That is a
 * reasonable convenience and it caused a real bug: the Add Position sheet
 * had no date field at all, so a purchase made in May and recorded in
 * August was silently dated August, and the portfolio's own history was
 * wrong with nothing on screen to suggest it.
 *
 * The fix was at the UI layer — every caller now sends the date explicitly.
 * These tests pin the store's behaviour so the next reader understands that
 * an absent date is not an error, which is exactly why it was dangerous.
 */
describe('purchase date', () => {
  it('keeps the date it is given, exactly', async () => {
    const saved = await store.add({ symbol: 'A.NS', quantity: 10, purchasePrice: 100, purchaseDate: '2026-05-04' });
    expect(saved.ok).toBe(true);
    const [position] = await store.list();
    expect(position.purchaseDate).toBe('2026-05-04');
  });

  it('defaults a MISSING date to today rather than refusing the write', async () => {
    // Documented, not endorsed. A caller that forgets the field gets a
    // plausible wrong answer instead of an error, which is the shape of
    // failure hardest to notice.
    await store.add({ symbol: 'A.NS', quantity: 10, purchasePrice: 100 });
    const [position] = await store.list();
    // Against the store's INJECTED clock, not the wall clock — the suite
    // pins "today" to 2026-08-04 so this assertion means the same thing
    // whenever it runs.
    expect(position.purchaseDate).toBe('2026-08-04');
  });

  it('rejects a malformed date instead of quietly substituting today', async () => {
    const result = await store.add({ symbol: 'A.NS', quantity: 10, purchasePrice: 100, purchaseDate: '04-05-2026' });
    expect(result.ok).toBe(false);
    expect(await store.list()).toHaveLength(0);
  });

  it('preserves the original date through an edit that does not mention it', async () => {
    // Correcting a quantity must not re-stamp the purchase as today.
    const saved = await store.add({ symbol: 'A.NS', quantity: 10, purchasePrice: 100, purchaseDate: '2026-05-04' });
    await store.update(saved.position.id, { symbol: 'A.NS', quantity: 12, purchasePrice: 100 });
    const [position] = await store.list();
    expect(position.quantity).toBe(12);
    expect(position.purchaseDate).toBe('2026-05-04');
  });
});
