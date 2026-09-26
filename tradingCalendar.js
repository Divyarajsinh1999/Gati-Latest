import { ALL_KNOWN_HOLIDAYS, getHoliday, isYearCovered } from '../config/holidays.js';

/**
 * Trading-calendar utilities.
 *
 * Design rule (spec Section 8 / 22): NEVER assume a calendar date is a
 * trading day. Month-end detection below works purely off which dates
 * actually have data — weekends and holidays simply won't be present in the
 * price series, so they're handled correctly with zero holiday-list
 * maintenance. The holiday list in config/holidays.js is only used for the
 * *live* "is the market open right now" indicator, which has no price series
 * to fall back on.
 */

/** 'YYYY-MM' key for a Date or ISO date string. */
/**
 * The calendar month immediately before a `YYYY-MM` key.
 *
 * Pure string/number arithmetic on the key itself — no Date object, so there
 * is no timezone to get wrong. December rolls to the previous year.
 *
 * Used to test whether a series' newest month-end really is LAST month or
 * merely the newest one it happens to have: a stock with June and August
 * bars but no July anchors to June, and any "this month" figure measured
 * from there silently spans two months.
 */
export function previousMonthKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}$/.test(key)) return null;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function monthKey(dateLike) {
  const d = typeof dateLike === 'string' ? new Date(dateLike + 'T00:00:00Z') : dateLike;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Given an ascending array of daily price records (each with a `date`
 * field, ISO 'YYYY-MM-DD'), return one record per calendar month: the LAST
 * record actually present in that month (spec Section 8: "identify the last
 * valid trading day of that month... use actual available trading data").
 * Output is ascending by date and each record is tagged with `monthKey`.
 */
export function getMonthEndRecords(series) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const byMonth = new Map();
  for (const record of series) {
    const key = monthKey(record.date);
    // Since input is ascending, the last write for a key wins — no need to compare dates.
    byMonth.set(key, record);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => (a[1].date < b[1].date ? -1 : 1))
    .map(([key, record]) => ({ ...record, monthKey: key }));
}

/**
 * Returns the first trading-day record strictly AFTER `afterDate` in an
 * ascending series. Used to find the execution day for a signal generated
 * at a month-end close (spec Section 15's execution convention).
 * Returns null if there is no later record (e.g. signal is the most recent
 * month-end and the next trading day hasn't happened yet).
 */
export function getNextTradingDay(series, afterDate) {
  for (const record of series) {
    if (record.date > afterDate) return record;
  }
  return null;
}

/**
 * The IST wall clock, as a Date whose UTC getters read as IST.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THIS WAS WRONG FOR EVERY USER IN INDIA UNTIL v1.4.0, AND EVERY TEST PASSED
 *
 * The previous implementation was:
 *
 *     const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
 *     return new Date(utcMs + 5.5 * 60 * 60000);
 *
 * `getTime()` is ALREADY an absolute UTC instant. Adding the device's
 * timezone offset to it applies a shift that was never needed, and in
 * Asia/Kolkata that shift is exactly −5:30 — which cancels the +5:30 on the
 * next line. The function returned plain UTC.
 *
 * The consequence: on a phone set to Indian time, the market read as OPEN
 * from 14:45 to 21:00 IST and CLOSED during the actual session. Precisely
 * the "sometimes shows Market Open when the market is closed" symptom.
 *
 * WHY NOTHING CAUGHT IT: CI and every dev container run in UTC, where
 * `getTimezoneOffset()` is 0 and the bug is arithmetically invisible. The
 * test suite was correct, comprehensive, and blind — it had no way to see a
 * fault that only exists off the machine it ran on. The regression test for
 * this pins the device clock to four zones on purpose.
 *
 * The correct conversion needs no device information at all: an absolute
 * instant plus a fixed offset. India has never observed DST, so the offset
 * is a constant rather than a lookup.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * @param {Date} [now] the absolute instant to convert. Injectable so the
 *   session logic can be tested at a chosen moment instead of "whenever
 *   the suite happens to run".
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function nowInIST(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

/**
 * The IST calendar date of an absolute instant, as 'YYYY-MM-DD'.
 *
 * Exists so a quote's timestamp can be compared against the exchange's
 * trading date. A quote returned at 03:30 UTC on Monday is Monday in IST
 * (09:00); the same instant is still Sunday in New York. Only the IST date
 * is the exchange's date, and only that comparison answers "did this trade
 * happen today".
 *
 * @param {Date|string|number} instant
 * @returns {string|null} null when the input is not a usable instant, so a
 *   missing timestamp can never masquerade as today's date.
 */
export function istDateString(instant) {
  if (instant == null) return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  return nowInIST(d).toISOString().slice(0, 10);
}

const MARKET_OPEN_MINUTES = 9 * 60 + 15; // 9:15 AM IST
const MARKET_CLOSE_MINUTES = 15 * 60 + 30; // 3:30 PM IST

/** The 09:00–09:15 pre-open call auction. Orders match; continuous trading
 *  has not started. Reported separately rather than folded into OPEN,
 *  because a price during the auction is not a traded price. */
const PRE_OPEN_MINUTES = 9 * 60;

/**
 * Live market status (spec Section 22).
 *
 * Returns 'OPEN' | 'PRE_OPEN' | 'CLOSED' | 'WEEKEND' | 'HOLIDAY', the IST
 * instant the call was made at, and enough detail for the UI to explain
 * itself without re-deriving anything.
 *
 * `holidayCalendarKnown` is false when the holiday list does not cover this
 * date's year. In that case a weekday outside a holiday still reports OPEN
 * on session hours alone — but the flag lets the UI say so, rather than
 * implying a holiday check happened that did not.
 *
 * TAKES AN IST-SHIFTED DATE, not an absolute instant. Callers pass
 * `nowInIST()`. The default argument does that for them.
 */
export function getMarketStatus(referenceDate = nowInIST(), holidays = ALL_KNOWN_HOLIDAYS) {
  const day = referenceDate.getUTCDay(); // IST-shifted Date, so UTC getters read as IST wall-clock
  const minutesNow = referenceDate.getUTCHours() * 60 + referenceDate.getUTCMinutes();
  const holidayCalendarKnown = isYearCovered(referenceDate);
  const tradingDate = referenceDate.toISOString().slice(0, 10);
  const base = { asOf: referenceDate, tradingDate, holidayCalendarKnown, holiday: null };

  if (day === 0 || day === 6) {
    return { ...base, status: 'WEEKEND' };
  }
  const holiday = getHoliday(referenceDate, holidays);
  if (holiday) {
    return { ...base, status: 'HOLIDAY', holiday };
  }
  if (minutesNow >= MARKET_OPEN_MINUTES && minutesNow < MARKET_CLOSE_MINUTES) {
    return { ...base, status: 'OPEN' };
  }
  if (minutesNow >= PRE_OPEN_MINUTES && minutesNow < MARKET_OPEN_MINUTES) {
    return { ...base, status: 'PRE_OPEN' };
  }
  return { ...base, status: 'CLOSED' };
}
