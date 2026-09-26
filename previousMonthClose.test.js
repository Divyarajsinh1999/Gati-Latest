/**
 * PREVIOUS MONTH CLOSE — the number every monthly figure is measured from.
 *
 * Getting this wrong does not produce an error. It produces a stock return,
 * a benchmark return and a Relative Strength that are all internally
 * consistent and all measured from the wrong day — so the ranking is
 * plausible, ordered, and quietly incorrect.
 *
 * The rule under test: the previous month close is the last bar THAT
 * ACTUALLY EXISTS in the previous calendar month. Not thirty days ago, not
 * the last calendar date, not the nearest data point.
 */

import { describe, it, expect } from 'vitest';
import { getMonthEndRecords, monthKey } from '../tradingCalendar.js';
import { computeCurrentMomentum } from '../currentMomentum.js';
import { normaliseBars } from '../../data/cache/barStore.js';

const bars = (entries) => entries.map(([date, close]) => ({ date, close, adjClose: close }));

const monthEndFor = (series, key) =>
  getMonthEndRecords(series).find((record) => record.monthKey === key) ?? null;

describe('the last trading session of the month', () => {
  it('uses the 31st when the month ends on a trading day', () => {
    // July 2026: the 31st is a Friday.
    const series = bars([['2026-07-29', 100], ['2026-07-30', 101], ['2026-07-31', 102]]);
    expect(monthEndFor(series, '2026-07').date).toBe('2026-07-31');
    expect(monthEndFor(series, '2026-07').close).toBe(102);
  });

  it('falls back to Friday when the month ends on a Saturday', () => {
    // May 2026 ends on a Sunday the 31st; the 30th is a Saturday. The last
    // session is Friday the 29th, and no calendar lookup is needed to know
    // that — there is simply no bar for the weekend.
    const series = bars([['2026-05-28', 90], ['2026-05-29', 95]]);
    expect(monthEndFor(series, '2026-05').date).toBe('2026-05-29');
  });

  it('falls back past a holiday that lands on the final weekday', () => {
    // Whatever the reason for the gap — holiday, halt, exchange closure —
    // the answer is the same: the last bar that exists.
    const series = bars([['2026-01-28', 50], ['2026-01-29', 51], ['2026-01-30', 52]]);
    // 2026-01-31 is absent (Saturday); Republic Day on the 26th is also absent.
    expect(monthEndFor(series, '2026-01').date).toBe('2026-01-30');
  });

  it('falls back when a stock simply has no bar on the final session', () => {
    // A trading halt or suspension on the last day. The benchmark traded;
    // this stock did not.
    const series = bars([['2026-07-29', 100], ['2026-07-30', 101]]);
    expect(monthEndFor(series, '2026-07').date).toBe('2026-07-30');
  });

  it('never reaches into a different month for an answer', () => {
    // A stock with no July bars at all must report NOTHING for July, not
    // June's close relabelled.
    const series = bars([['2026-06-29', 80], ['2026-06-30', 81], ['2026-08-03', 90]]);
    expect(monthEndFor(series, '2026-07')).toBeNull();
    expect(monthEndFor(series, '2026-06').date).toBe('2026-06-30');
  });
});

describe('month and year transitions', () => {
  it('separates December from January across a year boundary', () => {
    const series = bars([
      ['2026-12-30', 200], ['2026-12-31', 205],
      ['2027-01-01', 206], ['2027-01-04', 210],
    ]);
    expect(monthEndFor(series, '2026-12').date).toBe('2026-12-31');
    expect(monthEndFor(series, '2027-01').date).toBe('2027-01-04');
  });

  it('keys 2027 dates as 2027, not as month 13 of 2026', () => {
    expect(monthKey('2027-01-04')).toBe('2027-01');
    expect(monthKey('2026-12-31')).toBe('2026-12');
  });

  it('handles a January that opens on a holiday', () => {
    // 1 January is an NSE holiday in most years, so the first session of the
    // year is the 2nd or later. Nothing special is required — the bar for
    // the 1st simply is not there.
    const series = bars([['2026-12-31', 205], ['2027-01-04', 210], ['2027-01-05', 212]]);
    expect(monthEndFor(series, '2027-01').date).toBe('2027-01-05');
  });

  it('is unaffected by the holiday calendar not covering 2027', () => {
    // Month-end selection reads bars, never the holiday list. A year with no
    // published calendar still resolves correctly, which is why the missing
    // 2027 holiday data does not compromise the strategy.
    const series = bars([['2027-03-30', 300], ['2027-03-31', 305]]);
    expect(monthEndFor(series, '2027-03').date).toBe('2027-03-31');
  });
});

describe('the stock and its benchmark', () => {
  const benchmark = bars([
    ['2026-07-29', 100], ['2026-07-30', 100], ['2026-07-31', 100], ['2026-08-03', 110],
  ]);

  const run = (stockSeries) =>
    computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A' }],
      priceSeriesMap: new Map([['A.NS', stockSeries]]),
      benchmarkSeries: benchmark,
      quotes: new Map(),
    }).ranked[0];

  it('reports the two legs as aligned when both traded on the same day', () => {
    const row = run(bars([['2026-07-30', 200], ['2026-07-31', 200], ['2026-08-03', 220]]));
    expect(row.priorMonthEndDate).toBe('2026-07-31');
    expect(row.benchmarkPriorMonthEndDate).toBe('2026-07-31');
    expect(row.priorMonthEndAligned).toBe(true);
  });

  /**
   * THE CASE THAT USED TO PASS SILENTLY.
   *
   * A stock halted on the final session measures its month from the 30th
   * while the benchmark measures from the 31st — so Relative Strength
   * subtracts two returns computed over different spans. Forcing them to
   * match would mean inventing a stock price for a day it did not trade, so
   * the mismatch is REPORTED rather than repaired.
   */
  it('reports a mismatch rather than hiding it or inventing a price', () => {
    const row = run(bars([['2026-07-29', 200], ['2026-07-30', 200], ['2026-08-03', 220]]));
    expect(row.priorMonthEndDate).toBe('2026-07-30');
    expect(row.benchmarkPriorMonthEndDate).toBe('2026-07-31');
    expect(row.priorMonthEndAligned).toBe(false);
    // And it still produces a figure — the flag qualifies it, it does not
    // suppress the row.
    expect(row.priorMonthEndPrice).toBe(200);
  });

  it('reports alignment as unknown rather than true when a leg is missing', () => {
    const row = run(bars([['2026-08-03', 220]]));
    expect(row.priorMonthEndDate).toBeNull();
    expect(row.priorMonthEndAligned).toBeNull();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * A SERIES THAT STOPS BEFORE THIS MONTH IS NOT A ZERO-RETURN STOCK.
 *
 * THE BUG THESE GUARD (found 27 Aug 2026, reported by the owner as "the
 * previous-month date keeps changing").
 *
 * The prior month-end was taken as the stock's OWN last bar before the
 * current month — correct while a stock is trading, and wrong the moment it
 * stops. A stock whose data ends on 27 July reported:
 *
 *   prev month close   27 Jul   (not 31 Jul — the month's actual last session)
 *   current price      27 Jul   (the same bar)
 *   month to date      0.00%    (the bar divided by itself)
 *   Relative Strength  ranked   (on that fabricated zero)
 *
 * So the date drifted to wherever the stock's data happened to stop, which
 * is exactly the moving 27th-of-the-month the owner saw, and the stock was
 * ranked against its benchmark on a return that had never been earned.
 *
 * `DATA_QUALITY_FLAGS.STALE_PRICE` had existed since the first version and
 * was never once emitted — this is the case it was defined for.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('a stock whose data stops before the current month', () => {
  // The benchmark is trading normally through August.
  const benchmark = bars([
    ['2026-07-27', 100], ['2026-07-30', 100], ['2026-07-31', 100],
    ['2026-08-03', 104], ['2026-08-27', 110],
  ]);

  const run = (stockSeries) =>
    computeCurrentMomentum({
      stocks: [{ symbol: 'STALE.NS', name: 'Stale Co' }],
      priceSeriesMap: new Map([['STALE.NS', stockSeries]]),
      benchmarkSeries: benchmark,
      quotes: new Map(),
    }).ranked[0];

  // Last bar 27 July, while the benchmark has run on to 27 August.
  const stale = bars([['2026-07-24', 200], ['2026-07-27', 210]]);

  it('never reports a mid-month date as the previous month close', () => {
    // 27 July is not the last session of July. The stock has no valid
    // month-end to show, and a mid-month bar dressed as one is worse than
    // an em-dash: the reader has no way to tell it apart from a real close.
    const row = run(stale);
    expect(row.priorMonthEndDate).not.toBe('2026-07-27');
  });

  it('does not fabricate a 0.00% month-to-date by dividing a bar by itself', () => {
    const row = run(stale);
    expect(row.currentMonthReturnPct).not.toBe(0);
    expect(row.currentMonthReturnPct).toBeNull();
  });

  it('refuses to rank it, rather than ranking it on the fabricated zero', () => {
    const row = run(stale);
    expect(row.rank).toBeNull();
    expect(row.rs).toBeNull();
  });

  it('says WHY, with the stale-price flag rather than the missing-data one', () => {
    // The remedy differs: missing data needs more history, a stale series
    // needs the symbol checked for a halt, a rename or a delisting.
    const row = run(stale);
    expect(row.flags).toContain('Stale Price');
    expect(row.flags).not.toContain('Missing Data');
  });

  it('reports the session its data actually stops at', () => {
    const row = run(stale);
    expect(row.lastBarDate).toBe('2026-07-27');
  });

  it('still ranks a stock that has traded this month, however thinly', () => {
    // One August bar is enough. The rule is "has this month's data", not
    // "has traded often" — thin trading is a liquidity question, and it is
    // answered somewhere else.
    const row = run(bars([['2026-07-31', 200], ['2026-08-03', 210]]));
    expect(row.rank).toBe(1);
    expect(row.priorMonthEndDate).toBe('2026-07-31');
    expect(row.currentMonthReturnPct).toBeCloseTo(5, 6);
  });
});

describe('the previous month close holds still for the whole month', () => {
  /**
   * The owner's requirement, stated directly: on 27 August the figure must
   * be 31 July's close, exactly as it was on 2 August and exactly as it
   * will be on 31 August. It is a property of the calendar, not of how far
   * through the month the reader happens to be.
   */
  const july = [['2026-07-29', 100], ['2026-07-30', 101], ['2026-07-31', 102]];
  const august = [
    ['2026-08-03', 103], ['2026-08-10', 106], ['2026-08-17', 108],
    ['2026-08-24', 111], ['2026-08-27', 112],
  ];

  const asOf = (upTo) => {
    const stock = bars([...july, ...august].slice(0, 3 + upTo));
    const benchmarkSeries = bars(
      [...july, ...august].slice(0, 3 + upTo).map(([d, c]) => [d, c * 2]),
    );
    return computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A' }],
      priceSeriesMap: new Map([['A.NS', stock]]),
      benchmarkSeries,
      quotes: new Map(),
    }).ranked[0];
  };

  it.each([1, 2, 3, 4, 5])('reports 31 July on every August session (%i)', (sessions) => {
    const row = asOf(sessions);
    expect(row.priorMonthEndDate).toBe('2026-07-31');
    expect(row.priorMonthEndPrice).toBe(102);
  });

  it('moves only when the month itself does', () => {
    const sept = computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A' }],
      priceSeriesMap: new Map([['A.NS', bars([...july, ...august, ['2026-09-01', 115]])]]),
      benchmarkSeries: bars([...july, ...august, ['2026-09-01', 115]].map(([d, c]) => [d, c * 2])),
      quotes: new Map(),
    }).ranked[0];
    expect(sept.priorMonthEndDate).toBe('2026-08-27');
  });
});

describe('the close, not any other price of the day', () => {
  it('takes the closing price, never the open, high or low', () => {
    const series = [{ date: '2026-07-31', open: 90, high: 130, low: 85, close: 102, adjClose: 102 }];
    expect(monthEndFor(series, '2026-07').close).toBe(102);
  });

  it('prefers the adjusted close where the provider supplies one', () => {
    // Around a split the two diverge, and only the adjusted series gives a
    // return that is not a phantom cliff.
    const series = [{ date: '2026-07-31', close: 1000, adjClose: 500 }];
    const record = monthEndFor(series, '2026-07');
    expect(record.adjClose).toBe(500);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * A GAP IS NOT A MONTH (found in the v1.6.4 cross-check audit).
 *
 * `priorMonthEnd` is the newest month-end BEFORE the current month, which
 * for a normally-trading stock is last month. For a stock with a hole in its
 * history it is not: June bars and August bars with no July anchors to
 * 30 June, and August's price divided by it is a TWO-MONTH move that the
 * detail screen labels "This month". Measured at +14.43% during the audit.
 *
 * The ranking was never affected — such a row is already excluded for want
 * of a reference month — but the stock detail screen renders the figure for
 * any symbol reachable by URL, and a two-month return under a one-month
 * heading is the same class of fault as the window mismatch fixed in v1.6.3.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('month-to-date requires the anchor to be last month', () => {
  const benchmark = bars([
    ['2026-06-30', 100], ['2026-07-31', 105], ['2026-08-27', 110],
  ]);

  const run = (series) =>
    computeCurrentMomentum({
      stocks: [{ symbol: 'GAP.NS', name: 'Gap Co' }],
      priceSeriesMap: new Map([['GAP.NS', series]]),
      benchmarkSeries: benchmark,
      quotes: new Map(),
    }).ranked[0];

  it('reports no month-to-date when the stock skipped last month entirely', () => {
    const row = run(bars([['2026-06-29', 200], ['2026-06-30', 201], ['2026-08-27', 230]]));
    expect(row.currentMonthReturnPct).toBeNull();
  });

  it('still reports one when last month is present', () => {
    const row = run(bars([['2026-06-30', 200], ['2026-07-31', 212], ['2026-08-27', 230]]));
    expect(row.currentMonthReturnPct).toBeCloseTo(8.4906, 3);
  });

  it('crosses a year boundary correctly', () => {
    // December → January is the case a naive month−1 gets wrong.
    const decJan = bars([['2025-12-31', 100], ['2026-01-30', 110]]);
    const row = computeCurrentMomentum({
      stocks: [{ symbol: 'Y.NS', name: 'Y' }],
      priceSeriesMap: new Map([['Y.NS', decJan]]),
      benchmarkSeries: bars([['2025-12-31', 50], ['2026-01-30', 51]]),
      quotes: new Map(),
    }).ranked[0];
    expect(row.priorMonthEndDate).toBe('2025-12-31');
    expect(row.currentMonthReturnPct).toBeCloseTo(10, 6);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * THE ANSWER MUST NOT DEPEND ON ARRAY ORDER (v1.6.4 audit).
 *
 * Everything downstream reads POSITION: `series[series.length - 1]` is "the
 * latest bar". A provider response in a different order, or a cold cache
 * storing one verbatim, therefore changed which bar counted as latest.
 * Measured: a stock whose bars arrived newest-first was read as having
 * stopped trading in June and dropped out of the ranking — then ranked
 * normally on the next load once the cache had sorted them.
 *
 * Series are now normalised on ingest (see barStore.normaliseBars), so these
 * pin the property end to end.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('bar order does not change the answer', () => {
  const bench = bars([['2026-06-30', 101], ['2026-07-31', 105], ['2026-08-27', 110]]);
  const rows = [['2026-06-30', 200], ['2026-07-31', 212], ['2026-08-27', 230]];

  const runWith = (ordered) =>
    computeCurrentMomentum({
      stocks: [{ symbol: 'A.NS', name: 'A' }],
      priceSeriesMap: new Map([['A.NS', normaliseBars(bars(ordered)).bars]]),
      benchmarkSeries: bench,
      quotes: new Map(),
    }).ranked[0];

  it.each([
    ['ascending', rows],
    ['descending', [...rows].reverse()],
    ['latest first', [rows[2], rows[0], rows[1]]],
    ['shuffled', [rows[1], rows[2], rows[0]]],
  ])('%s produces the same month-end, latest bar and return', (_name, ordered) => {
    const row = runWith(ordered);
    expect(row.priorMonthEndDate).toBe('2026-07-31');
    expect(row.lastBarDate).toBe('2026-08-27');
    expect(row.stockReturnPct).toBeCloseTo(8.4906, 3);
    expect(row.rank).toBe(1);
  });
});
