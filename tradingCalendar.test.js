import { describe, it, expect } from 'vitest';
import { getMonthEndRecords, getNextTradingDay, monthKey, getMarketStatus } from '../tradingCalendar.js';
import { NSE_HOLIDAYS_2026 } from '../../config/holidays.js';

describe('getMonthEndRecords — spec Section 8: use actual trading data, not calendar assumptions', () => {
  it('picks the last available date in each month even when the calendar month-end is a weekend/holiday', () => {
    // Jan 31 2025 is a Friday (real trading day); Feb 2025's last trading day
    // is the 28th (Friday) since the 28th is a Friday in 2025 — but to make
    // the test robust to any specific calendar, we simulate a month whose
    // last two calendar days are skipped (as if a weekend), and check the
    // engine correctly falls back to the last date actually present.
    const series = [
      { date: '2025-01-30', close: 100 },
      { date: '2025-01-31', close: 101 }, // true last trading day of Jan
      { date: '2025-02-25', close: 110 },
      { date: '2025-02-26', close: 111 },
      { date: '2025-02-27', close: 112 }, // true last trading day of Feb (28th missing = simulated holiday)
      { date: '2025-03-03', close: 120 },
    ];
    const monthEnds = getMonthEndRecords(series);
    expect(monthEnds.map((m) => m.date)).toEqual(['2025-01-31', '2025-02-27', '2025-03-03']);
    expect(monthEnds[1].close).toBe(112);
  });

  it('returns an empty array for empty input rather than throwing', () => {
    expect(getMonthEndRecords([])).toEqual([]);
  });
});

describe('getNextTradingDay — execution-day lookup for the Section 15 convention', () => {
  it('finds the first record strictly after the signal date, skipping any gap', () => {
    const series = [
      { date: '2025-01-31', close: 101 },
      { date: '2025-02-03', close: 102 }, // Monday after a Friday month-end
    ];
    expect(getNextTradingDay(series, '2025-01-31').date).toBe('2025-02-03');
  });

  it('returns null when the signal date is the most recent data point', () => {
    const series = [{ date: '2025-01-31', close: 101 }];
    expect(getNextTradingDay(series, '2025-01-31')).toBeNull();
  });
});

describe('monthKey', () => {
  it('formats as YYYY-MM regardless of input type', () => {
    expect(monthKey('2025-07-04')).toBe('2025-07');
    expect(monthKey(new Date('2025-12-01T00:00:00Z'))).toBe('2025-12');
  });
});

describe('getMarketStatus', () => {
  it('reports WEEKEND on a Saturday regardless of time of day', () => {
    const saturday = new Date(Date.UTC(2026, 6, 25, 10, 0)); // 2026-07-25 is a Saturday
    expect(getMarketStatus(saturday, []).status).toBe('WEEKEND');
  });

  it('reports OPEN on a weekday within 9:15am-3:30pm IST and no holiday configured', () => {
    const weekdayNoon = new Date(Date.UTC(2026, 6, 29, 12, 0)); // 2026-07-29 is a Wednesday, 12:00 "IST wall clock"
    expect(getMarketStatus(weekdayNoon, []).status).toBe('OPEN');
  });

  it('reports CLOSED on a weekday outside trading hours', () => {
    const weekdayEvening = new Date(Date.UTC(2026, 6, 29, 20, 0));
    expect(getMarketStatus(weekdayEvening, []).status).toBe('CLOSED');
  });

  it('reports HOLIDAY when the date matches the configured holiday list', () => {
    const republicDay = new Date(Date.UTC(2026, 0, 26, 12, 0)); // Monday, in trading hours
    expect(getMarketStatus(republicDay, [{ date: '2026-01-26', name: 'Republic Day' }]).status).toBe('HOLIDAY');
  });

  it('recognises real dates from the shipped 2026 NSE holiday list (regression guard against future transcription errors)', () => {
    const ganeshChaturthi = new Date(Date.UTC(2026, 8, 14, 12, 0)); // 2026-09-14, a Monday in trading hours
    expect(getMarketStatus(ganeshChaturthi, NSE_HOLIDAYS_2026).status).toBe('HOLIDAY');

    const dayAfter = new Date(Date.UTC(2026, 8, 15, 12, 0)); // 2026-09-15, ordinary Tuesday
    expect(getMarketStatus(dayAfter, NSE_HOLIDAYS_2026).status).toBe('OPEN');
  });

  it('does NOT flag a weekend-falling festival as an extra weekday holiday (Mahashivratri 2026 falls on a Sunday, deliberately excluded from the list)', () => {
    const mahashivratri = new Date(Date.UTC(2026, 1, 15, 12, 0)); // 2026-02-15
    // Correctly reported as WEEKEND (day-of-week check fires first), not
    // HOLIDAY — and Mahashivratri is intentionally absent from
    // NSE_HOLIDAYS_2026 in the first place, since it isn't a separate
    // weekday closure this year.
    expect(getMarketStatus(mahashivratri, NSE_HOLIDAYS_2026).status).toBe('WEEKEND');
  });
});
