/**
 * THE DECISION JOURNAL (D25).
 *
 * The value of an entry is that it PREDATES the outcome. So these tests
 * concentrate on the ways that property could be quietly lost — a backdated
 * timestamp, an editable symbol list, a derived "followed the ranking" flag —
 * rather than on whether the store can round-trip a string.
 */

import { describe, it, expect } from 'vitest';
import { createJournalStore, validateEntry, MAX_NOTE_LENGTH } from '../persistence/journalStore.js';
import { STORES } from '../cache/idbBackend.js';

const storeAt = (t = 1_700_000_000_000) => createJournalStore({ now: () => t });

const entry = (over = {}) => ({
  monthKey: '2026-08', universeKey: 'nifty50', note: 'Took the ranking as-is.', ...over,
});

describe('validation', () => {
  it('requires a month in YYYY-MM', () => {
    expect(validateEntry(entry({ monthKey: '2026-8' })).ok).toBe(false);
    expect(validateEntry(entry({ monthKey: 'August' })).ok).toBe(false);
    expect(validateEntry(entry()).ok).toBe(true);
  });

  it('requires a universe', () => {
    expect(validateEntry(entry({ universeKey: '' })).ok).toBe(false);
  });

  it('rejects an entry that says nothing', () => {
    expect(validateEntry({ monthKey: '2026-08', universeKey: 'nifty50' }).ok).toBe(false);
  });

  it('accepts symbols with no note, and a note with no symbols', () => {
    expect(validateEntry(entry({ note: '', symbols: ['WIPRO.NS'] })).ok).toBe(true);
    expect(validateEntry(entry({ note: 'Sat this one out.', symbols: [] })).ok).toBe(true);
  });

  it('caps the note length', () => {
    expect(validateEntry(entry({ note: 'x'.repeat(MAX_NOTE_LENGTH + 1) })).ok).toBe(false);
  });

  it('uppercases and de-duplicates symbols', () => {
    const { value } = validateEntry(entry({ symbols: ['wipro.ns', 'WIPRO.NS', ' trent.ns ', ''] }));
    expect(value.symbols).toEqual(['WIPRO.NS', 'TRENT.NS']);
  });

  it('does NOT reject a symbol outside the Top 5', () => {
    /*
      The point of the journal is to capture a DEVIATION. Validating symbols
      against this month's ranking would reject precisely the entries worth
      keeping — and would make a stored entry depend on ranking data that can
      change after it was written.
    */
    const { ok, value } = validateEntry(entry({ symbols: ['SOMETHINGELSE.NS'] }));
    expect(ok).toBe(true);
    expect(value.symbols).toEqual(['SOMETHINGELSE.NS']);
  });
});

describe('what an entry stores', () => {
  it('never carries a return, a value or a P&L', async () => {
    // D25: a claim, not a calculation. Performance comes from the strategy
    // record, computed once. A number here would be a second place for the
    // figures to disagree.
    const s = storeAt();
    const { value } = await s.add(entry({ symbols: ['A'] }));
    for (const banned of ['return', 'returnPct', 'value', 'pnl', 'gain']) {
      expect(value).not.toHaveProperty(banned);
    }
  });

  it('stamps createdAt itself and ignores any supplied one', async () => {
    /*
      THE PROPERTY THE WHOLE FEATURE RESTS ON. If a caller could set the
      timestamp, hindsight could be backdated into an entry and it would stop
      being evidence of anything.
    */
    const s = storeAt(1_700_000_000_000);
    const { value } = await s.add(entry({ createdAt: '2001-01-01T00:00:00.000Z' }));
    expect(value.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(value.createdAt).not.toContain('2001');
  });

  it('records followedRanking as asserted, not derived', async () => {
    const s = storeAt();
    const a = await s.add(entry({ followedRanking: true }));
    const b = await s.add(entry({ monthKey: '2026-09', followedRanking: false }));
    expect(a.value.followedRanking).toBe(true);
    expect(b.value.followedRanking).toBe(false);
  });
});

describe('editing', () => {
  it('allows the note to change', async () => {
    const s = storeAt();
    const { value } = await s.add(entry({ note: 'first' }));
    const edited = await s.updateNote(value.id, 'second');
    expect(edited.ok).toBe(true);
    expect(edited.value.note).toBe('second');
    expect(edited.value.editedAt).toBeTruthy();
  });

  it('does not allow the month, universe, symbols or timestamp to change', async () => {
    /*
      An entry whose symbols could be rewritten after the fact is no longer a
      record of what was believed at the time. `updateNote` is the only
      mutation, by design.
    */
    const s = storeAt();
    const { value } = await s.add(entry({ symbols: ['A'] }));
    const edited = await s.updateNote(value.id, 'changed my mind');
    expect(edited.value.monthKey).toBe(value.monthKey);
    expect(edited.value.universeKey).toBe(value.universeKey);
    expect(edited.value.symbols).toEqual(['A']);
    expect(edited.value.createdAt).toBe(value.createdAt);
  });

  it('reports a missing entry rather than creating one', async () => {
    const s = storeAt();
    expect((await s.updateNote('does-not-exist', 'hello')).ok).toBe(false);
  });
});

describe('listing', () => {
  it('returns newest first', async () => {
    let t = 1000;
    const s = createJournalStore({ now: () => (t += 1000) });
    await s.add(entry({ monthKey: '2026-06' }));
    await s.add(entry({ monthKey: '2026-07' }));
    await s.add(entry({ monthKey: '2026-08' }));
    const list = await s.list();
    expect(list.map((e) => e.monthKey)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('survives a storage failure by returning nothing, not throwing', async () => {
    const hostile = {
      keys: () => { throw new Error('blocked'); },
      get: () => { throw new Error('blocked'); },
      put: () => { throw new Error('blocked'); },
      delete: () => { throw new Error('blocked'); },
    };
    const s = createJournalStore({ backend: hostile });
    await expect(s.list()).resolves.toEqual([]);
    await expect(s.add(entry())).resolves.toMatchObject({ ok: false });
  });
});

describe('separation from the portfolio', () => {
  it('uses its own store', () => {
    // A paper intention is not a holding. Sharing a store would let an
    // intention be valued as real money — the confusion D1 prevents.
    expect(STORES.JOURNAL).toBe('journal');
    expect(STORES.JOURNAL).not.toBe(STORES.PORTFOLIO);
  });
});
