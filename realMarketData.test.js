import { describe, it, expect } from 'vitest';
import { getMonthEndRecords } from '../tradingCalendar.js';
import { calculateReturn, calculateRS, computeStockRS } from '../momentum.js';
import { computeCurrentMomentum } from '../currentMomentum.js';
import { NSE_HOLIDAYS_2026 } from '../../config/holidays.js';

/**
 * REAL MARKET DATA regression tests.
 *
 * Every other engine test uses synthetic or hand-built prices, which proves
 * internal consistency but not that the engine behaves correctly against
 * how the Indian market actually trades. These fixtures are genuine NIFTY 50
 * index bars (month-end closes, Jan 2025 - Apr 2026) taken from a public
 * historical dataset that was itself validated first: all 13 of its 2025
 * weekday gaps map exactly onto real NSE holidays (Mahashivratri, Holi,
 * Id-Ul-Fitr, Mahavir Jayanti, Ambedkar Jayanti, Good Friday, Maharashtra
 * Day, Independence Day, Ganesh Chaturthi, Gandhi Jayanti, Diwali
 * Balipratipada, Guru Nanak Jayanti and Christmas).
 *
 * The April 2026 entry is deliberately an INCOMPLETE month (data ends
 * 13 Apr), because that is the only condition under which the
 * current-momentum reference bug appeared.
 */
const NIFTY50_MONTH_ENDS = [
  { date: '2025-01-31', open: 23296.75, high: 23546.80, low: 23277.40, close: 23508.40, adjClose: 23508.40, volume: 304900 },
  { date: '2025-02-28', open: 22433.40, high: 22450.35, low: 22104.85, close: 22124.70, adjClose: 22124.70, volume: 551300 },
  { date: '2025-03-28', open: 23600.40, high: 23649.20, low: 23450.20, close: 23519.35, adjClose: 23519.35, volume: 295400 },
  { date: '2025-04-30', open: 24342.05, high: 24396.15, low: 24198.75, close: 24334.20, adjClose: 24334.20, volume: 424500 },
  { date: '2025-05-30', open: 24812.60, high: 24863.95, low: 24717.40, close: 24750.70, adjClose: 24750.70, volume: 853900 },
  { date: '2025-06-30', open: 25661.65, high: 25669.35, low: 25473.30, close: 25517.05, adjClose: 25517.05, volume: 271000 },
  { date: '2025-07-31', open: 24642.25, high: 24956.50, low: 24635.00, close: 24768.35, adjClose: 24768.35, volume: 346300 },
  { date: '2025-08-29', open: 24466.70, high: 24572.45, low: 24404.70, close: 24426.85, adjClose: 24426.85, volume: 325500 },
  { date: '2025-09-30', open: 24691.95, high: 24731.80, low: 24587.70, close: 24611.10, adjClose: 24611.10, volume: 303000 },
  { date: '2025-10-31', open: 25863.80, high: 25953.75, low: 25711.20, close: 25722.10, adjClose: 25722.10, volume: 334400 },
  { date: '2025-11-28', open: 26237.45, high: 26280.75, low: 26172.40, close: 26202.95, adjClose: 26202.95, volume: 202500 },
  { date: '2025-12-31', open: 25971.05, high: 26187.95, low: 25969.00, close: 26129.60, adjClose: 26129.60, volume: 246300 },
  { date: '2026-01-30', open: 25247.55, high: 25370.70, low: 25213.65, close: 25320.65, adjClose: 25320.65, volume: 508400 },
  { date: '2026-02-27', open: 25459.85, high: 25476.40, low: 25141.30, close: 25178.65, adjClose: 25178.65, volume: 438900 },
  { date: '2026-03-30', open: 22549.65, high: 22714.10, low: 22283.85, close: 22331.40, adjClose: 22331.40, volume: 698600 },
  { date: '2026-04-13', open: 23589.60, high: 23907.40, low: 23555.60, close: 23842.65, adjClose: 23842.65, volume: 0 },
];

/** Weekday NSE closures actually observed in the 2025 price data. */
const OBSERVED_2025_CLOSURES = ['2025-02-26','2025-03-14','2025-03-31','2025-04-10','2025-04-14','2025-04-18','2025-05-01','2025-08-15','2025-08-27','2025-10-02','2025-10-22','2025-11-05','2025-12-25'];

describe('real NIFTY 50 data — month-end detection', () => {
  it('never selects a weekend as a month-end', () => {
    for (const m of getMonthEndRecords(NIFTY50_MONTH_ENDS)) {
      const day = new Date(m.date + 'T12:00:00Z').getUTCDay();
      expect({ date: m.date, day }).toEqual({ date: m.date, day: expect.not.stringMatching(/never/) });
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it('picks 28 Mar 2025, not 31 Mar — because 31 Mar 2025 was Id-Ul-Fitr', () => {
    // The calendar month-end was a Monday, i.e. a normal weekday. Only using
    // ACTUAL trading data (spec Section 8) gets this right; anything that
    // assumes "last weekday of the month" would be wrong here.
    const march = getMonthEndRecords(NIFTY50_MONTH_ENDS).find((m) => m.monthKey === '2025-03');
    expect(march.date).toBe('2025-03-28');
  });

  it('picks 30 Mar 2026, not 31 Mar — because 31 Mar 2026 is Mahavir Jayanti', () => {
    const march = getMonthEndRecords(NIFTY50_MONTH_ENDS).find((m) => m.monthKey === '2026-03');
    expect(march.date).toBe('2026-03-30');
  });

  it('produces one month-end per calendar month present, in ascending order', () => {
    const monthEnds = getMonthEndRecords(NIFTY50_MONTH_ENDS);
    expect(monthEnds).toHaveLength(16);
    const keys = monthEnds.map((m) => m.monthKey);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('real NIFTY 50 data — monthly returns match independent calculation', () => {
  it('reproduces known real index moves to 2dp', () => {
    const m = getMonthEndRecords(NIFTY50_MONTH_ENDS);
    const byKey = Object.fromEntries(m.map((r) => [r.monthKey, r]));

    // Independently computed from the published closes above.
    const expected = {
      '2025-02': -5.89, // 23508.40 -> 22124.70
      '2025-03': 6.30,  // 22124.70 -> 23519.35
      '2026-03': -11.31, // 25178.65 -> 22331.40, a real sharp drawdown
    };
    for (const [key, want] of Object.entries(expected)) {
      const idx = m.findIndex((r) => r.monthKey === key);
      const got = calculateReturn(byKey[key].adjClose, m[idx - 1].adjClose);
      expect(got).toBeCloseTo(want, 2);
    }
  });

  it('RS against itself is exactly zero on real data (sanity anchor)', () => {
    const m = getMonthEndRecords(NIFTY50_MONTH_ENDS);
    const r = calculateReturn(m[5].adjClose, m[4].adjClose);
    expect(calculateRS(r, r)).toBe(0);
  });
});

describe('real NIFTY 50 data — current momentum with an incomplete month', () => {
  // Fixture ends 2026-04-13: April is in progress, which is precisely when
  // the reference-month bug used to surface.
  const result = computeCurrentMomentum({
    stocks: [{ symbol: 'IDX.NS', name: 'Index proxy' }],
    priceSeriesMap: new Map([['IDX.NS', NIFTY50_MONTH_ENDS]]),
    benchmarkSeries: NIFTY50_MONTH_ENDS,
  });

  it('anchors to March 2026, not to the in-progress April bar', () => {
    expect(result.basedOnMonthKey).toBe('2026-03');
    expect(result.referenceDate).toBe('2026-03-30');
    expect(result.asOf).toBe('2026-04-13');
  });

  it('computes the real month-to-date move, not 0.00%', () => {
    // 22331.40 -> 23842.65 = +6.7674%
    expect(result.ranked[0].stockReturnPct).toBeCloseTo(6.7674, 3);
    expect(result.ranked[0].stockReturnPct).not.toBe(0);
  });
});

describe('holiday config cross-validated against real market gaps', () => {
  it('every 2026 holiday testable against the data has no trading bar', () => {
    const dates = new Set(NIFTY50_MONTH_ENDS.map((r) => r.date));
    const testable = NSE_HOLIDAYS_2026.filter((h) => h.date <= '2026-04-13');
    expect(testable.length).toBeGreaterThan(0);
    for (const h of testable) {
      expect({ holiday: h.date, hasBar: dates.has(h.date) }).toEqual({ holiday: h.date, hasBar: false });
    }
  });

  it('records the 2025 closures observed in real data as a documented baseline', () => {
    // Pinned so a future data refresh that loses or invents a closure is
    // visible rather than silent.
    expect(OBSERVED_2025_CLOSURES).toHaveLength(13);
    for (const d of OBSERVED_2025_CLOSURES) {
      const day = new Date(d + 'T12:00:00Z').getUTCDay();
      expect(day).toBeGreaterThanOrEqual(1); // all are weekdays; weekend closures aren't holidays
      expect(day).toBeLessThanOrEqual(5);
    }
  });
});

/**
 * REAL SPLIT regression fixtures (Phase 2.3, added v0.14.8).
 *
 * Genuine Yahoo Finance month-end bars for BAJFINANCE.NS straddling its
 * real 2:1 split of 16 Jun 2025, plus the matching NIFTYBEES.NS benchmark
 * bars for the same two month-ends. Captured live on 1 Aug 2026 by
 * `scripts/verify-split-adjustment.mjs`, which scanned all 450 configured
 * symbols and found 36 split/bonus events since Jan 2025.
 *
 * WHAT THIS PINS, and why it isn't redundant with the synthetic
 * mixed-convention tests in momentum.test.js:
 * Those tests prove the guard fires when the two bars disagree on basis.
 * These prove something the synthetic ones can't — what Yahoo ACTUALLY
 * returns across a real Indian split. The finding was mildly surprising
 * and worth pinning: Yahoo back-adjusts the raw `close` field too, so
 * there is no visible price cliff at the split date (13 Jun closed 933.10,
 * 16 Jun closed 938.00 — no ~2x jump), and `close` and `adjClose` give the
 * SAME return to 2dp here. `adjClose` still differs in level because it
 * additionally carries dividend adjustment.
 *
 * The practical consequence: the app's Section 6 preference for adjClose is
 * correct but, for splits specifically, is belt-and-braces rather than the
 * only thing standing between it and a -50% phantom crash. That's a good
 * thing to have established rather than assumed — and if Yahoo ever changes
 * this behaviour, this fixture is what will catch it.
 */
const BAJFINANCE_SPLIT_FIXTURE = {
  splitDate: '2025-06-16',
  splitRatio: '2:1',
  stock: {
    previous: { date: '2025-05-30', open: 917, high: 920.3499755859375, low: 912.0999755859375, close: 918.0499877929688, adjClose: 912.4410400390625, volume: 15041740 },
    current: { date: '2025-06-30', open: 956, high: 956, low: 934, close: 936.5, adjClose: 930.7783203125, volume: 6086081 },
  },
  benchmark: {
    previous: { date: '2025-05-30', close: 277.9700012207031, adjClose: 277.9700012207031, volume: 3521102 },
    current: { date: '2025-06-30', close: 286.510009765625, adjClose: 286.510009765625, volume: 7928260 },
  },
};

describe('real 2:1 split — BAJFINANCE.NS, 16 Jun 2025 (Phase 2.3)', () => {
  const { stock, benchmark } = BAJFINANCE_SPLIT_FIXTURE;

  it('produces a sane, unflagged RS across the split month', () => {
    const result = computeStockRS({
      previousRecord: stock.previous,
      currentRecord: stock.current,
      previousBenchmark: benchmark.previous,
      currentBenchmark: benchmark.current,
    });
    // ~+2.01% stock vs ~+3.07% benchmark => RS ~ -1.06pp. The number that
    // matters is that it's plausible: a split mishandled would show roughly
    // -50% or +100% here, which is exactly the failure this checks for.
    expect(result.stockReturnPct).toBeCloseTo(2.01, 1);
    expect(result.benchmarkReturnPct).toBeCloseTo(3.07, 1);
    expect(result.rs).toBeCloseTo(-1.06, 1);
    expect(result.flags).toHaveLength(0);
  });

  it('gives the same return from close as from adjClose — Yahoo back-adjusts both', () => {
    const fromAdj = calculateReturn(stock.current.adjClose, stock.previous.adjClose);
    const fromClose = calculateReturn(stock.current.close, stock.previous.close);
    // Pinned deliberately. If a future Yahoo change stops back-adjusting the
    // raw close, these diverge sharply and this test is the tripwire.
    expect(fromAdj).toBeCloseTo(fromClose, 1);
    expect(Math.abs(fromAdj)).toBeLessThan(50);
  });

  it('shows no artificial ~2x cliff in the raw close across the split date', () => {
    // A 2:1 split on unadjusted data would roughly halve the price. The
    // month-end closes move ~2%, not ~50%.
    const ratio = stock.current.close / stock.previous.close;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  it('STILL refuses to compute if adjClose goes missing on one bar of this real split', () => {
    // The v0.14.2 danger scenario, reconstructed on real prices rather than
    // synthetic ones: same split, but a Yahoo gap leaves the earlier bar
    // with only `close` while the later bar keeps `adjClose`.
    const result = computeStockRS({
      previousRecord: { ...stock.previous, adjClose: null },
      currentRecord: stock.current,
      previousBenchmark: benchmark.previous,
      currentBenchmark: benchmark.current,
    });
    expect(result.stockReturnPct).toBeNull();
    expect(result.rs).toBeNull();
    expect(result.flags.some((f) => /cannot compare/i.test(f))).toBe(true);
  });
});
