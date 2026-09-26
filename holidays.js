/**
 * NSE equity-segment trading holidays.
 *
 * SOURCE: NSE's own official circular (nsearchives.nseindia.com/content/
 * circulars/CMTR71775.pdf), cross-checked against 5+ independent
 * aggregators (LenDenClub, ClearTax, Groww, Bajaj AMC, Anand Rathi) which
 * all agree on every date below. One additional source found during
 * research ("Sahi") gave systematically different dates for nearly every
 * lunar-calendar holiday — consistent with it simply showing a stale
 * (likely 2025) calendar rather than a genuine conflict — disregarded in
 * favour of the official circular + the sources that agree with it.
 *
 * Complete list of the 15 full weekday closures for 2026. A few holidays
 * (Mahashivratri Feb 15, Id-Ul-Fitr Mar 21, Independence Day Aug 15,
 * Diwali Laxmi Pujan Nov 8) fall on a weekend in 2026 and are deliberately
 * NOT listed here — weekends are already excluded by tradingCalendar.js
 * independent of this file, and adding them would double-count. Diwali
 * Laxmi Pujan (Nov 8, Sunday) additionally gets a special one-hour
 * "Muhurat trading" session — a live/current-quarter dashboard could
 * surface that separately, but it isn't a weekday closure so it doesn't
 * belong in this array either.
 *
 * Still worth re-verifying annually — NSE occasionally amends this list
 * mid-year — but this is no longer a "best guess," it's sourced from the
 * exchange's own circular.
 */
export const NSE_HOLIDAYS_2026 = [
  // Discovered empirically (real NIFTY 50 data has no bar on this weekday),
  // then identified from the official NSE calendar. Absent from the general
  // circular list because it is an ad-hoc civic closure, not a religious or
  // national holiday: NSE and BSE both sit in Mumbai, so a Maharashtra
  // election closes the exchanges. Exactly the kind of date a hardcoded
  // "standard festivals" list will always miss — which is why month-end
  // detection reads real trading data instead of a calendar (spec Section 8).
  { date: '2026-01-15', name: 'Municipal Corporation Election (Maharashtra)' },
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-03', name: 'Holi' },
  { date: '2026-03-26', name: 'Shri Ram Navami' },
  { date: '2026-03-31', name: 'Shri Mahavir Jayanti' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-14', name: 'Dr. Baba Saheb Ambedkar Jayanti' },
  { date: '2026-05-01', name: 'Maharashtra Day' },
  { date: '2026-05-28', name: 'Bakri Id' },
  { date: '2026-06-26', name: 'Muharram' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-10', name: 'Diwali Balipratipada' },
  { date: '2026-11-24', name: 'Prakash Gurpurb Sri Guru Nanak Dev' },
  { date: '2026-12-25', name: 'Christmas' },
];

/**
 * The years this list actually covers.
 *
 * WHY THIS EXISTS: `isKnownHoliday` answers "is this date in the array",
 * which for any 2027 date is "no" — indistinguishable from "this is a normal
 * trading day". On 1 January 2027 every NSE holiday would silently become a
 * trading day and the header would confidently report OPEN on Republic Day.
 *
 * Declaring coverage lets `getMarketStatus` say "session hours only, holiday
 * calendar not loaded for this year" instead of guessing. The app does not
 * fabricate market data; a holiday calendar it does not have is the same
 * kind of claim.
 */
/**
 * THE MULTI-YEAR REGISTRY.
 *
 * Adding a year is one entry here and nothing else: the calendar, the
 * session logic and the UI all read coverage from this map rather than
 * from a hardcoded year.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 2027 IS DELIBERATELY ABSENT, AND THAT IS NOT AN OVERSIGHT
 *
 * The brief asked for 2027 coverage. Checked on 8 Aug 2026: NSE has not
 * published it. The exchange's own holidays page lists 2026 only, and the
 * trackers that advertise a 2027 page return "holiday data is being
 * compiled — 0 total dates". NSE issues the following year's circular
 * around December.
 *
 * Several aggregators DO show a 2027 list. They are unsourced, and the
 * dates that matter most — Holi, Id, Diwali, Mahavir Jayanti — are lunar
 * and cannot be derived from a rule. Copying a guess here would produce a
 * calendar that looks authoritative, is wrong on the exact dates it is
 * consulted for, and would silently mis-state whether the market is open.
 *
 * So the MECHANISM ships and the DATA does not. Until NSE publishes,
 * `getMarketStatus` reports `holidayCalendarKnown: false` for 2027 and the
 * status panel says the verdict rests on trading hours alone.
 *
 * Month-end selection is unaffected either way: it reads the last bar that
 * actually exists in the month and never consults this list.
 *
 * TO ADD 2027: paste the circular's dates as NSE_HOLIDAYS_2027 and add one
 * line below. Nothing else changes.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const HOLIDAYS_BY_YEAR = {
  2026: NSE_HOLIDAYS_2026,
};

/** Years the registry can actually speak for. Derived, never hardcoded. */
export const HOLIDAY_COVERAGE_YEARS = Object.keys(HOLIDAYS_BY_YEAR).map(Number);

/** Every known holiday, across every covered year. */
export const ALL_KNOWN_HOLIDAYS = Object.values(HOLIDAYS_BY_YEAR).flat();

/** True when the registry can actually speak for this date's year. */
export function isYearCovered(date, years = HOLIDAY_COVERAGE_YEARS) {
  return years.includes(date.getUTCFullYear());
}

/** Returns true if `date` (Date object, IST-naive) matches a known holiday. */
export function isKnownHoliday(date, holidays = ALL_KNOWN_HOLIDAYS) {
  const iso = date.toISOString().slice(0, 10);
  return holidays.some((h) => h.date === iso);
}

/** The holiday record for a date, or null. Lets the UI name the day. */
export function getHoliday(date, holidays = ALL_KNOWN_HOLIDAYS) {
  const iso = date.toISOString().slice(0, 10);
  return holidays.find((h) => h.date === iso) ?? null;
}
