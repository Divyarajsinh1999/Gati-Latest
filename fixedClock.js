/**
 * FIXED CLOCK — deterministic time for tests.
 *
 * WHAT THIS OWNS
 *   A single, explicit "now" for any test that touches market status, data
 *   freshness, or a cache TTL.
 *
 * WHAT THIS MUST NEVER DO
 *   Become a way for engines to read the clock. Engines take the current date
 *   as an ARGUMENT — that is what makes them deterministic and what lets the
 *   heavy compute pass move into a Web Worker later. This harness exists for
 *   the layers that legitimately do read a clock (market status, TTL, UI), not
 *   as a shortcut around that rule.
 *
 * WHY IST MATTERS
 *   India has no DST, so IST is a fixed UTC+5:30. Every wall-clock assertion
 *   about session boundaries (09:15 open, 15:30 close) must be expressed in
 *   IST or it will pass on one machine and fail on another.
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Build a Date for an IST wall-clock moment.
 *
 * @param {string} istDateTime e.g. '2026-08-03 10:30' (IST wall clock)
 * @returns {Date} the corresponding real instant
 */
export function istMoment(istDateTime) {
  const [datePart, timePart = '00:00'] = istDateTime.trim().split(/\s+/);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000;
  return new Date(utcMs);
}

/**
 * The IST-shifted Date that `nowInIST()` would return at a given IST moment.
 * Engine calendar helpers read UTC getters off an IST-shifted Date, so tests
 * asserting against them need the same shape rather than a real instant.
 *
 * @param {string} istDateTime e.g. '2026-08-03 10:30'
 */
export function istShifted(istDateTime) {
  const [datePart, timePart = '00:00'] = istDateTime.trim().split(/\s+/);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm));
}

/**
 * Freeze Date.now() and `new Date()` for the duration of a callback.
 * Restores the originals even if the callback throws.
 *
 * @template T
 * @param {string} istDateTime
 * @param {() => T} fn
 * @returns {T}
 */
export function withFrozenClock(istDateTime, fn) {
  const fixed = istMoment(istDateTime);
  const RealDate = globalThis.Date;
  const realNow = RealDate.now;

  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixed.getTime());
        return;
      }
      super(...args);
    }
    static now() {
      return fixed.getTime();
    }
  }

  globalThis.Date = FrozenDate;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
    globalThis.Date.now = realNow;
  }
}

/** Well-known IST moments, so tests state intent rather than arithmetic. */
export const MOMENTS = {
  /** Monday, mid-session. */
  MARKET_OPEN: '2026-08-03 10:30',
  /** Monday, one minute before the bell. */
  PRE_OPEN: '2026-08-03 09:14',
  /** Monday, one minute after close. */
  POST_CLOSE: '2026-08-03 15:31',
  /** Saturday. */
  WEEKEND: '2026-08-01 11:00',
  /** Independence Day 2026 — a real NSE holiday, deliberately on a weekday. */
  HOLIDAY: '2026-08-15 11:00',
};
