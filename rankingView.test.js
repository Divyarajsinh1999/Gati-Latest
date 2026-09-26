/**
 * RANKING VIEW MODEL TESTS — M7.
 *
 * The rule most worth guarding is that a sorted view never obscures the
 * strategy's actual decision: every row keeps its true rank whatever order it
 * is displayed in, and null values never sort to an extreme where they would
 * imply something the data does not support.
 */

import { describe, it, expect } from 'vitest';
import { selectRankingView, RANKING_FILTERS, RANKING_SORTS } from '../rankingView.js';

const row = (symbol, rank, over = {}) => ({
  symbol, name: `${symbol.replace('.NS', '')} Ltd`, rank,
  rs: 10 - rank, stockReturnPct: 8, benchmarkReturnPct: 2,
  currentPrice: 1000 + rank, dailyChangePct: rank % 2 === 0 ? 1.5 : -0.5,
  sector: 'Financials', ...over,
});

const ranked = [row('A.NS', 1), row('B.NS', 2), row('C.NS', 3), row('D.NS', 12, { rs: -3 }), row('E.NS', 13, { rs: -4 })];

function makeData(over = {}) {
  return {
    currentMomentum: { ranked, picks: [ranked[0], ranked[1], ranked[2]] },
    momentumAge: new Map([['A.NS', { consecutiveMonths: 4 }]]),
    unavailableSymbols: [],
    stocks: new Array(50).fill({}),
    ...over,
  };
}

const view = (opts = {}) => selectRankingView({ data: makeData(opts.data), ...opts });

describe('shaping', () => {
  it('keeps the true rank on every row', () => {
    expect(view().rows.map((r) => r.rank)).toEqual([1, 2, 3, 12, 13]);
  });

  it('marks the Top-N segment', () => {
    expect(view().rows.filter((r) => r.isTopN).map((r) => r.symbol)).toEqual(['A.NS', 'B.NS', 'C.NS']);
  });

  it('carries momentum age through without recomputing it', () => {
    expect(view().rows[0].momentumAge).toBe(4);
    expect(view().rows[1].momentumAge).toBeNull();
  });

  it('formats RS with a % sign', () => {
    expect(view().rows[0].rsLabel).toBe('+9.0%');
    expect(view().rows[3].rsLabel).toBe('−3.0%');
  });

  it('counts each filter so the chips can show totals', () => {
    expect(view().counts).toEqual({ all: 5, top: 3, positive: 3, negative: 2 });
  });
});

describe('search', () => {
  it('matches on name and on ticker', () => {
    expect(view({ search: 'B Ltd' }).rows).toHaveLength(1);
    expect(view({ search: 'c.ns' }).rows).toHaveLength(1);
  });

  it('ignores surrounding whitespace and case', () => {
    expect(view({ search: '  a.NS  ' }).rows[0].symbol).toBe('A.NS');
  });

  it('returns an empty list rather than everything on no match', () => {
    expect(view({ search: 'ZZZZ' }).rows).toEqual([]);
  });
});

describe('filters', () => {
  it.each(RANKING_FILTERS.map((f) => f.key))('applies the "%s" filter', (key) => {
    const rows = view({ filter: key }).rows;
    if (key === 'all') expect(rows).toHaveLength(5);
    if (key === 'top') expect(rows.every((r) => r.isTopN)).toBe(true);
    if (key === 'positive') expect(rows.every((r) => r.rs > 0)).toBe(true);
    if (key === 'negative') expect(rows.every((r) => r.rs < 0)).toBe(true);
  });
});

describe('sorting', () => {
  it('defaults to rank order — the only order that reflects the strategy', () => {
    expect(view().rows.map((r) => r.rank)).toEqual([1, 2, 3, 12, 13]);
    expect(view({ sort: 'rank' }).activeSort).toBe('rank');
  });

  it.each(RANKING_SORTS.map((s) => s.key))('never loses or duplicates a row under "%s"', (sort) => {
    const symbols = view({ sort }).rows.map((r) => r.symbol).sort();
    expect(symbols).toEqual(['A.NS', 'B.NS', 'C.NS', 'D.NS', 'E.NS']);
  });

  it('PRESERVES the true rank when sorted by something else', () => {
    // A sorted view must never obscure what the strategy actually decided.
    const rows = view({ sort: 'name' }).rows;
    expect(rows.find((r) => r.symbol === 'D.NS').rank).toBe(12);
  });

  it('sorts nulls LAST rather than to an extreme', () => {
    // A stock with no quote has not "fallen the most"; sorting it to either
    // end would say something untrue about it.
    const data = makeData({ currentMomentum: { ranked: [...ranked, row('N.NS', 20, { dailyChangePct: null, currentPrice: null })], picks: [] } });
    const rows = selectRankingView({ data, sort: 'dayChange' }).rows;
    expect(rows.at(-1).symbol).toBe('N.NS');
  });
});

describe('unavailable stocks', () => {
  it('excludes unrankable rows from the ordered list', () => {
    const data = makeData({ currentMomentum: { ranked: [...ranked, row('Z.NS', null)], picks: [] } });
    expect(selectRankingView({ data }).rows.every((r) => r.rank != null)).toBe(true);
  });

  it('reports them separately with a reason', () => {
    const data = makeData({ unavailableSymbols: [{ symbol: 'DEAD.NS', reason: '404', suggestion: 'NEW.NS' }] });
    const v = selectRankingView({ data });
    expect(v.unavailable).toHaveLength(1);
    expect(v.unavailable[0]).toMatchObject({ symbol: 'DEAD.NS', reason: '404', suggestion: 'NEW.NS' });
  });

  it('defaults the reason rather than leaving it blank', () => {
    const data = makeData({ unavailableSymbols: [{ symbol: 'DEAD.NS' }] });
    expect(selectRankingView({ data }).unavailable[0].reason).toBe('Price data unavailable');
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * A ROW THE ENGINE EXCLUDED MUST STILL BE ACCOUNTED FOR.
   *
   * `unavailable` was built ONLY from `unavailableSymbols` — the symbols
   * whose FETCH failed. A row the engine declined to rank for a data-quality
   * reason (missing history, and since v1.6.1 a stale series) was filtered
   * out of the ordered list and appeared in no other list either. It simply
   * ceased to exist: 50 stocks in the universe, 49 rows on screen, and a
   * footer reading "49 ranked · 0 excluded".
   *
   * Silent subtraction is the one failure this app is least allowed. A stock
   * visibly excluded with a reason is a data-quality notice; a stock that is
   * merely absent is indistinguishable from a bug, and the reader cannot
   * even tell there is something to ask about.
   * ═══════════════════════════════════════════════════════════════════════
   */
  it('surfaces a row the engine refused to rank, rather than dropping it', () => {
    const data = makeData({
      currentMomentum: {
        ranked: [...ranked, row('STALE.NS', null, { rs: null, flags: ['Stale Price'], unavailableReason: 'No price data since 2026-07-27' })],
        picks: [],
      },
    });
    const v = selectRankingView({ data });
    expect(v.rows.some((r) => r.symbol === 'STALE.NS')).toBe(false);
    expect(v.unavailable.map((u) => u.symbol)).toContain('STALE.NS');
  });

  it('carries the engine’s own reason through instead of a generic one', () => {
    const data = makeData({
      currentMomentum: {
        ranked: [...ranked, row('STALE.NS', null, { rs: null, flags: ['Stale Price'], unavailableReason: 'No price data since 2026-07-27' })],
        picks: [],
      },
    });
    const entry = selectRankingView({ data }).unavailable.find((u) => u.symbol === 'STALE.NS');
    expect(entry.reason).toContain('2026-07-27');
  });

  it('never lists the same symbol twice when both paths flag it', () => {
    // A failed fetch also produces an unranked row. One stock, one entry.
    const data = makeData({
      currentMomentum: { ranked: [...ranked, row('DEAD.NS', null, { rs: null, isUnavailable: true })], picks: [] },
      unavailableSymbols: [{ symbol: 'DEAD.NS', reason: '404' }],
    });
    const v = selectRankingView({ data });
    expect(v.unavailable.filter((u) => u.symbol === 'DEAD.NS')).toHaveLength(1);
  });

  it('adds up: ranked plus excluded equals the universe', () => {
    const data = makeData({
      currentMomentum: { ranked: [...ranked, row('STALE.NS', null, { rs: null })], picks: [] },
      stocks: new Array(6).fill({}),
    });
    const v = selectRankingView({ data });
    expect(v.rankedCount + v.unavailable.length).toBe(v.totalCount);
  });
});

describe('missing inputs', () => {
  it('returns null without data', () => {
    expect(selectRankingView({ data: null })).toBeNull();
  });

  it('survives an empty universe', () => {
    const v = selectRankingView({ data: { currentMomentum: { ranked: [], picks: [] }, stocks: [] } });
    expect(v.rows).toEqual([]);
    expect(v.rankedCount).toBe(0);
  });
});
