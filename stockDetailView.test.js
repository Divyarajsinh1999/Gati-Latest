/**
 * STOCK DETAIL VIEW MODEL TESTS.
 *
 * The screen exists to answer one question a ranking cannot: is this stock
 * leading on every horizon, or only on the one currently selected? So the
 * assertions concentrate on the four-window view — and on the rule that a
 * window with no history yields NOTHING rather than a zero, because 0.0pp
 * reads as "kept pace with the benchmark", which is a specific and wrong claim.
 */

import { describe, it, expect } from 'vitest';
import { selectStockDetail } from '../stockDetailView.js';
import { computeCurrentMomentum } from '../../engine/currentMomentum.js';

const dates = ['2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-30', '2025-06-30'];
const bars = (prices) =>
  dates.map((date, i) => ({ date, open: prices[i], high: prices[i], low: prices[i], close: prices[i], adjClose: prices[i], volume: 1 }));

const universe = {
  key: 'nifty50',
  label: 'NIFTY 50',
  benchmark: { symbol: 'NIFTYBEES.NS', shortLabel: 'NIFTYBEES' },
  stocks: [{ symbol: 'A.NS', name: 'A Ltd', sector: 'Financial Services' }],
};

function makeData(over = {}) {
  return {
    priceSeriesMap: new Map([['A.NS', bars([100, 108, 118, 126, 138, 150])]]),
    benchmarkSeries: bars([100, 102, 104, 106, 108, 110]),
    momentumAge: new Map([['A.NS', { consecutiveMonths: 3, sinceMonthKey: '2025-04', isNewEntrant: false }]]),
    currentMomentum: {
      ranked: [{
        symbol: 'A.NS', name: 'A Ltd', sector: 'Financial Services', rank: 2, rs: 6.4,
        currentPrice: 150, dailyChangePct: 1.2, dailyChangeIsLive: true,
        priorMonthEndPrice: 138, priorMonthEndDate: '2025-05-30', currentMonthReturnPct: 8.7,
        rsTrend: 'improving',
      }],
      picks: [{ symbol: 'A.NS' }],
    },
    backtest: {
      rankingHistory: [
        { monthKey: '2025-04', date: '2025-04-30', rankings: [{ symbol: 'A.NS', rank: 9, rs: 2.1 }] },
        { monthKey: '2025-05', date: '2025-05-30', rankings: [{ symbol: 'A.NS', rank: 4, rs: 4.8 }] },
        { monthKey: '2025-06', date: '2025-06-30', rankings: [{ symbol: 'B.NS', rank: 1, rs: 9 }] },
      ],
    },
    ...over,
  };
}

const view = (over) => selectStockDetail({ data: makeData(over), symbol: 'A.NS', universe, activeWindow: '1m' });

describe('identification', () => {
  it('resolves a stock that is in the universe', () => {
    const v = view();
    expect(v.found).toBe(true);
    expect(v.name).toBe('A Ltd');
    expect(v.rank).toBe(2);
    expect(v.isTopFive).toBe(true);
  });

  it('reports a stock that is not in this universe rather than erroring', () => {
    const v = selectStockDetail({ data: makeData(), symbol: 'ZZZ.NS', universe, activeWindow: '1m' });
    expect(v.found).toBe(false);
    expect(v.symbol).toBe('ZZZ.NS');
  });

  it('returns null without data', () => {
    expect(selectStockDetail({ data: null, symbol: 'A.NS', universe })).toBeNull();
  });

  it('distinguishes "in the universe but unranked" from "not in the universe"', () => {
    // Different causes, different remedies — worth telling apart.
    const v = selectStockDetail({
      data: makeData({ currentMomentum: { ranked: [], picks: [] } }),
      symbol: 'A.NS',
      universe,
    });
    expect(v.found).toBe(true);
    expect(v.isRanked).toBe(false);
    expect(v.rank).toBeNull();
  });
});

describe('the four-window view — the reason this screen exists', () => {
  it('reports every window', () => {
    expect(view().windows.map((w) => w.label)).toEqual(['1M', '3M', '6M', '12M']);
  });

  it('marks the window the reader arrived on', () => {
    expect(view().windows.find((w) => w.isActive).label).toBe('1M');
  });

  it('computes real Relative Strength on the windows it can', () => {
    const oneMonth = view().windows.find((w) => w.months === 1);
    expect(oneMonth.available).toBe(true);
    expect(oneMonth.rsLabel).toMatch(/^[+−]\d+\.\d+%$/);
    // Both operands travel with the value, so it stays checkable.
    expect(oneMonth.stockReturnPct).toBeTypeOf('number');
    expect(oneMonth.benchmarkReturnPct).toBeTypeOf('number');
  });

  it('marks a window with too little history UNAVAILABLE, never zero', () => {
    // A fabricated 0.0pp would read as "kept pace with the benchmark".
    const twelve = view().windows.find((w) => w.months === 12);
    expect(twelve.available).toBe(false);
    expect(twelve.rs).toBeNull();
    expect(twelve.rsLabel).toBeNull();
  });

  it('handles a stock with no price series at all', () => {
    const v = selectStockDetail({ data: makeData({ priceSeriesMap: new Map() }), symbol: 'A.NS', universe });
    expect(v.found).toBe(true);
    expect(v.windows.every((w) => w.available === false)).toBe(true);
  });
});

describe('context', () => {
  it('states the prior month-end WITH its date, so the month-to-date figure is checkable', () => {
    const v = view();
    expect(v.priorMonthEndLabel).toContain('138');
    expect(v.priorMonthEndDate).toBeTruthy();
    expect(v.currentMonthLabel).toContain('8.7');
  });

  it('reports momentum age and direction as facts about the past', () => {
    const v = view();
    expect(v.momentumAge).toBe(3);
    expect(v.momentumAgeLabel).toContain('3 consecutive months');
    expect(v.direction.label).toBe('Improving');
    // Never phrased as an instruction.
    expect(`${v.momentumAgeLabel} ${v.direction.label}`.toLowerCase()).not.toMatch(/buy|sell|should|recommend/);
  });

  it('calls a one-month run a new entrant', () => {
    const v = view({ momentumAge: new Map([['A.NS', { consecutiveMonths: 1, isNewEntrant: true }]]) });
    expect(v.momentumAgeLabel).toBe('New entrant this month');
  });

  it('reads rank history from the backtest, omitting months it was absent', () => {
    const v = view();
    expect(v.rankHistory.map((r) => r.monthKey)).toEqual(['2025-04', '2025-05']);
    expect(v.rankHistory[0].rank).toBe(9);
  });

  it('samples a sparkline rather than computing one', () => {
    expect(view().spark).toHaveLength(6);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * LIKE FOR LIKE: BOTH LEGS OF THE COMPARISON MUST SPAN THE SAME DATES.
 *
 * THE BUG THESE GUARD (owner report, 28 Aug 2026).
 *
 * The comparison card read three fields off the ranking row:
 *
 *   stock leg        row.currentMonthReturnPct   ← ALWAYS one month
 *   benchmark leg    row.benchmarkReturnPct      ← the SELECTED window
 *   outperformance   row.rs                      ← the SELECTED window
 *
 * At a 1M window all three agree and the card is correct, which is why it
 * survived. At any other window the stock leg alone stayed at one month, so
 * the card compared a 1-month stock return against a 3-, 6- or 12-month
 * benchmark return and then printed a total belonging to neither.
 *
 * Measured against the real engine on a stock rising steadily against a slow
 * benchmark, this is what the screen showed:
 *
 *   window   stock    benchmark   outperformance   stock − benchmark
 *      1M    +3.87%      +0.95%          +2.92              +2.92  ✓
 *      3M    +3.87%      +3.25%         +10.39              +0.62  ✗
 *      6M    +3.87%      +6.66%         +22.74              −2.79  ✗
 *     12M    +3.87%     +13.82%         +53.96              −9.95  ✗
 *
 * Note the SIGN FLIP at 6M and 12M. The two rows appear to say the stock
 * trailed its benchmark while the total beneath them says it beat it by 22
 * points. A reader checking the subtraction — which the card is laid out to
 * invite, and which the RS Ledger's whole design encourages — gets a
 * different answer from the one printed, with a different sign.
 *
 * These build their input through `computeCurrentMomentum` rather than
 * hand-written rows, because the defect was precisely a WIRING error between
 * two correct engine outputs. A fixture with numbers typed in by hand could
 * be made to agree with either behaviour and would prove nothing.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('the comparison card measures both legs over the same span', () => {
  const daily = (start, end, base, drift) => {
    const out = [];
    const d = new Date(start + 'T00:00:00Z');
    const stop = new Date(end + 'T00:00:00Z');
    let p = base;
    while (d <= stop) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        p *= 1 + drift;
        out.push({ date: d.toISOString().slice(0, 10), close: +p.toFixed(4), adjClose: +p.toFixed(4), volume: 1000 });
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  };

  // Rising much faster than its benchmark, so the windows differ sharply and
  // a mismatch cannot hide inside rounding.
  const stockBars = daily('2025-06-02', '2026-08-27', 100, 0.0020);
  const benchBars = daily('2025-06-02', '2026-08-27', 200, 0.0005);

  const detailAt = (slug) => {
    const momentum = computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A Ltd' }],
      priceSeriesMap: new Map([['A.NS', stockBars]]),
      benchmarkSeries: benchBars,
      quotes: new Map(),
      lookbackMonths: Number(slug.replace('m', '')),
    });
    return selectStockDetail({
      data: {
        priceSeriesMap: new Map([['A.NS', stockBars]]),
        benchmarkSeries: benchBars,
        currentMomentum: momentum,
        momentumAge: new Map(),
      },
      symbol: 'A.NS',
      universe,
      activeWindow: slug,
    });
  };

  const SLUGS = ['1m', '3m', '6m', '12m'];

  it.each(SLUGS)('%s — the printed subtraction equals the printed total', (slug) => {
    const v = detailAt(slug);
    expect(v.stockWindowReturnPct).not.toBeNull();
    expect(v.benchmarkWindowReturnPct).not.toBeNull();
    expect(v.stockWindowReturnPct - v.benchmarkWindowReturnPct).toBeCloseTo(v.outperformancePct, 6);
  });

  it.each(SLUGS)('%s — the stock leg is the window return, not the month-to-date one', (slug) => {
    const v = detailAt(slug);
    // At 1M the two coincide, which is exactly why the bug hid there. At
    // every other window they must differ, and the card must show the
    // window one.
    if (slug === '1m') {
      expect(v.stockWindowReturnPct).toBeCloseTo(v.monthToDatePct, 6);
    } else {
      expect(v.stockWindowReturnPct).not.toBeCloseTo(v.monthToDatePct, 2);
      expect(v.stockWindowReturnPct).toBeGreaterThan(v.monthToDatePct);
    }
  });

  it('the stock leg actually grows with the window, rather than sitting still', () => {
    // The fingerprint of the bug: +3.87% at every window because the field
    // never depended on the window at all.
    const legs = SLUGS.map((s) => detailAt(s).stockWindowReturnPct);
    expect(new Set(legs.map((n) => n.toFixed(4))).size, 'the stock leg is window-independent').toBe(4);
    for (let i = 1; i < legs.length; i += 1) expect(legs[i]).toBeGreaterThan(legs[i - 1]);
  });

  it('never prints a total whose sign contradicts its own two rows', () => {
    for (const slug of SLUGS) {
      const v = detailAt(slug);
      const impliedAhead = v.stockWindowReturnPct > v.benchmarkWindowReturnPct;
      expect(v.outperformancePct > 0, `${slug} contradicts itself`).toBe(impliedAhead);
    }
  });

  it('states which window the card is measuring, and from when', () => {
    // A card that silently changes span needs to say so, or the reader has
    // no way to know the numbers moved because the window did.
    const v = detailAt('6m');
    expect(v.comparisonWindowLabel).toBe('6M');
    expect(v.comparisonMonths).toBe(6);
    expect(v.comparisonFromDate).toBeTruthy();
  });

  it('the stated start date moves with the window', () => {
    const from = SLUGS.map((s) => detailAt(s).comparisonFromDate);
    expect(new Set(from).size).toBe(4);
  });

  it('keeps month-to-date as its own separate, correctly-labelled figure', () => {
    // Not deleted: "This month" is a real thing a reader wants, and it is
    // honestly labelled with its own anchor date. It simply is not the
    // comparison, which is what went wrong.
    const v = detailAt('6m');
    expect(v.monthToDatePct).not.toBeNull();
    expect(v.priorMonthEndDate).toBeTruthy();
  });
});

describe('the comparison card under bad data', () => {
  const flat = (dates, price) =>
    dates.map((date) => ({ date, close: price, adjClose: price, volume: 1 }));

  it('reports nothing rather than a partial comparison when history is short', () => {
    // Two months of data cannot answer a 6-month question. The engine
    // refuses; the card must not fill the gap with a one-month figure.
    const short = ['2026-07-30', '2026-07-31', '2026-08-26', '2026-08-27'];
    const momentum = computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A Ltd' }],
      priceSeriesMap: new Map([['A.NS', flat(short, 100)]]),
      benchmarkSeries: flat(short, 200),
      quotes: new Map(),
      lookbackMonths: 6,
    });
    const v = selectStockDetail({
      data: { priceSeriesMap: new Map([['A.NS', flat(short, 100)]]), benchmarkSeries: flat(short, 200), currentMomentum: momentum, momentumAge: new Map() },
      symbol: 'A.NS', universe, activeWindow: '6m',
    });
    expect(v.stockWindowReturnPct).toBeNull();
    expect(v.benchmarkWindowReturnPct).toBeNull();
    expect(v.outperformancePct).toBeNull();
    expect(v.stockWindowReturnLabel).toBeNull();
  });

  it('drops both legs together when the benchmark is missing, never one alone', () => {
    // A stock return shown beside an em-dash benchmark reads as if the stock
    // stood alone. Relative Strength is undefined without the benchmark, so
    // the whole card is undefined.
    const dates6 = ['2026-06-29', '2026-06-30', '2026-07-30', '2026-07-31', '2026-08-27'];
    const momentum = computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A Ltd' }],
      priceSeriesMap: new Map([['A.NS', flat(dates6, 100)]]),
      benchmarkSeries: [],
      quotes: new Map(),
      lookbackMonths: 1,
    });
    const v = selectStockDetail({
      data: { priceSeriesMap: new Map([['A.NS', flat(dates6, 100)]]), benchmarkSeries: [], currentMomentum: momentum, momentumAge: new Map() },
      symbol: 'A.NS', universe, activeWindow: '1m',
    });
    expect(v.stockWindowReturnPct).toBeNull();
    expect(v.benchmarkWindowReturnPct).toBeNull();
    expect(v.outperformancePct).toBeNull();
  });

  it('survives a stock that is in the universe but was never ranked', () => {
    const v = selectStockDetail({
      data: { priceSeriesMap: new Map(), benchmarkSeries: [], currentMomentum: { ranked: [], picks: [] }, momentumAge: new Map() },
      symbol: 'A.NS', universe, activeWindow: '3m',
    });
    expect(v.found).toBe(true);
    expect(v.stockWindowReturnPct).toBeNull();
    expect(v.comparisonWindowLabel).toBe('3M');
  });
});
