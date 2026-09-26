/**
 * THE REBALANCE ACTION LIST (D23).
 *
 * The join the app was missing: real holdings against the current Top 5.
 * The failure mode is not a crash — it is a list that looks plausible and
 * tells someone to sell the wrong thing, so the cases below are the ones
 * where a wrong implementation still reads convincingly.
 */

import { describe, it, expect } from 'vitest';
import { selectRebalanceActions } from '../portfolioView.js';

const lot = (symbol, universeKey = 'nifty50') => ({
  id: `${symbol}-1`, symbol, name: symbol, universeKey,
  quantity: 10, purchasePrice: 100, purchaseDate: '2026-01-05',
});

const rankRow = (symbol, rank, universeKey = 'nifty50') => ({
  symbol, name: symbol, rank, sector: 'IT', universeKey,
});

const prices = (...symbols) => new Map(symbols.map((s) => [s, { price: 120 }]));

const RANKED = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => rankRow(s, i + 1));

describe('a portfolio that matches the Top 5', () => {
  const r = selectRebalanceActions({
    positions: ['A', 'B', 'C', 'D', 'E'].map((s) => lot(s)),
    universeKey: 'nifty50', ranked: RANKED,
    priceBySymbol: prices('A', 'B', 'C', 'D', 'E'), isMonthComplete: true,
  });

  it('reports no difference', () => {
    expect(r.hasDifference).toBe(false);
    expect(r.stillRanked).toHaveLength(5);
    expect(r.noLongerRanked).toHaveLength(0);
    expect(r.notHeld).toHaveLength(0);
  });
});

describe('a portfolio that has drifted', () => {
  /*
    Held:  A B F        (F has slipped to rank 6)
    Top 5: A B C D E
      still ranked  A B      → 2
      no longer     F        → 1
      not held      C D E    → 3
  */
  const r = selectRebalanceActions({
    positions: ['A', 'B', 'F'].map((s) => lot(s)),
    universeKey: 'nifty50', ranked: RANKED,
    priceBySymbol: prices('A', 'B', 'F'), isMonthComplete: true,
  });

  it('splits the holdings into the three groups', () => {
    expect(r.stillRanked.map((p) => p.symbol).sort()).toEqual(['A', 'B']);
    expect(r.noLongerRanked.map((p) => p.symbol)).toEqual(['F']);
    expect(r.notHeld.map((p) => p.symbol).sort()).toEqual(['C', 'D', 'E']);
  });

  it('never emits a quantity or an order value', () => {
    // D23: subtraction, not advice. Sizing a trade would make this a
    // recommendation, which is a different product.
    for (const row of r.notHeld) {
      expect(row).not.toHaveProperty('shares');
      expect(row).not.toHaveProperty('amount');
      expect(row).not.toHaveProperty('orderValue');
    }
  });

  it('describes a state rather than issuing an instruction', () => {
    expect(r.summary).toContain('no longer ranked');
    expect(r.summary.toLowerCase()).not.toContain('sell');
    expect(r.summary.toLowerCase()).not.toContain('buy');
  });
});

describe('a stock missing from the ranking entirely', () => {
  it('is not reported as dropped out', () => {
    /*
      Z is held but absent from the ranking — delisted, renamed, or a data
      gap. Calling that "no longer in the Top 5" implies a sell on the
      strength of a row that is not there.
    */
    const r = selectRebalanceActions({
      positions: [lot('A'), lot('Z')],
      universeKey: 'nifty50', ranked: RANKED,
      priceBySymbol: prices('A', 'Z'), isMonthComplete: true,
    });
    expect(r.noLongerRanked.map((p) => p.symbol)).not.toContain('Z');
    expect(r.unranked.map((p) => p.symbol)).toEqual(['Z']);
  });
});

describe('universes stay separate', () => {
  it('ignores holdings from another universe', () => {
    // A smallcap holding is not "missing" from the NIFTY 50 Top 5. Counting
    // it would manufacture an action out of a category error.
    const r = selectRebalanceActions({
      positions: [lot('A'), lot('X', 'smallcap250')],
      universeKey: 'nifty50', ranked: RANKED,
      priceBySymbol: prices('A', 'X'), isMonthComplete: true,
    });
    const seen = [...r.stillRanked, ...r.noLongerRanked, ...r.unranked].map((p) => p.symbol);
    expect(seen).not.toContain('X');
  });

  it('describes five stocks even when a flat list is passed by mistake', () => {
    /*
      THE TRAP THIS PROJECT ALREADY HIT ONCE.

      Rank is not unique across universes — each has its own rank 1. Rows from
      three universes concatenated contain THREE stocks at rank 1 and so on,
      so "rank <= 5" over them describes fifteen. The caller is responsible
      for passing one universe's rows, and this pins what happens if it does
      not: the list must still be scoped to holdings in THIS universe, so a
      mistake shows up as extra "not held" entries rather than as silently
      wrong advice about the reader's own positions.
    */
    const flat = [
      ...RANKED,
      ...['M1', 'M2', 'M3', 'M4', 'M5'].map((s, i) => rankRow(s, i + 1, 'midcap150')),
    ];
    const r = selectRebalanceActions({
      positions: [lot('A')], universeKey: 'nifty50', ranked: flat,
      priceBySymbol: prices('A'), isMonthComplete: true,
    });
    // Ten rows tie for ranks 1-5 across the two universes, which is exactly
    // the nonsense a flat list produces. Documented, not endorsed.
    expect(r.notHeld.length).toBeGreaterThan(4);
  });
});

describe('holding nothing', () => {
  it('says so rather than returning an empty comparison', () => {
    const r = selectRebalanceActions({
      positions: [], universeKey: 'nifty50', ranked: RANKED, isMonthComplete: true,
    });
    expect(r.holdsNothing).toBe(true);
    expect(r.summary).toContain('none of the current Top 5');
  });
});

describe('a provisional month', () => {
  it('carries the flag so the screen can say the signal is not final', () => {
    const r = selectRebalanceActions({
      positions: [lot('A')], universeKey: 'nifty50', ranked: RANKED,
      priceBySymbol: prices('A'), isMonthComplete: false,
    });
    expect(r.isMonthComplete).toBe(false);
  });
});

describe('no ranking at all', () => {
  it('returns null rather than an empty action list', () => {
    // A failed fetch must not render as "sell everything, buy nothing".
    expect(selectRebalanceActions({
      positions: [lot('A')], universeKey: 'nifty50', ranked: [],
    })).toBeNull();
  });
});
