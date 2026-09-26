/**
 * THE IST WALL CLOCK — the test that was missing.
 *
 * `getMarketStatus` was already tested thoroughly, but always with a Date
 * handed to it. `nowInIST`, the impure part that turns "right now" into an
 * IST wall clock, had no test at all — and it was wrong. It added the
 * DEVICE's timezone offset to an instant that was already absolute, so in
 * Asia/Kolkata the +5:30 and the −5:30 cancelled and the function returned
 * plain UTC. The market read OPEN from 14:45 to 21:00 IST.
 *
 * CI runs in UTC, where `getTimezoneOffset()` is 0 and the fault is
 * arithmetically invisible. So these tests move the device clock on purpose.
 * A version of this file that only ran in UTC would pass against the broken
 * implementation, which is the entire lesson.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { nowInIST, getMarketStatus, IST_OFFSET_MS } from '../tradingCalendar.js';
import { NSE_HOLIDAYS_2026 } from '../../config/holidays.js';

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/**
 * Device zones chosen to be awkward, not representative:
 *   Asia/Kolkata     the zone the bug hid in — offset exactly cancels
 *   Pacific/Chatham  a :45 offset, so any half-hour assumption shows up
 *   America/New_York a DST zone west of UTC
 *   Australia/Sydney a DST zone east of UTC, southern-hemisphere schedule
 */
const DEVICE_ZONES = ['UTC', 'Asia/Kolkata', 'Pacific/Chatham', 'America/New_York', 'Australia/Sydney'];

/** Ground truth from the platform tz database, never from our own arithmetic. */
const istParts = (instant) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  // Intl reports midnight as hour 24 in some ICU versions.
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
};

const ourParts = (instant) => {
  const d = nowInIST(instant);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

describe.each(DEVICE_ZONES)('with the device clock set to %s', (zone) => {
  const withZone = (fn) => {
    process.env.TZ = zone;
    try {
      return fn();
    } finally {
      process.env.TZ = ORIGINAL_TZ;
    }
  };

  it('matches the tz database at every instant across a full year', () => {
    withZone(() => {
      const mismatches = [];
      // Every 37 minutes: a prime-ish step, so the samples land on every
      // minute-of-hour and cross both DST transitions in the device zone.
      for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 37 * 60000) {
        const instant = new Date(t);
        const truth = istParts(instant);
        if (ourParts(instant) !== truth) mismatches.push(instant.toISOString());
      }
      expect(mismatches.slice(0, 5)).toEqual([]);
    });
  });

  it('reports the market CLOSED at 20:00 IST — the exact symptom that was reported', () => {
    withZone(() => {
      // 14:30 UTC is 20:00 IST on a Thursday. Under the old implementation
      // this read as 14:30 on an Indian device and therefore as OPEN.
      const instant = new Date('2026-08-06T14:30:00Z');
      expect(getMarketStatus(nowInIST(instant), NSE_HOLIDAYS_2026).status).toBe('CLOSED');
    });
  });

  it('reports the market OPEN in the middle of the real session', () => {
    withZone(() => {
      // 06:00 UTC is 11:30 IST on a Thursday — squarely inside 09:15–15:30.
      const instant = new Date('2026-08-06T06:00:00Z');
      expect(getMarketStatus(nowInIST(instant), NSE_HOLIDAYS_2026).status).toBe('OPEN');
    });
  });

  it('closes at 15:30 IST to the minute, and is still open a minute earlier', () => {
    withZone(() => {
      // 15:30 IST = 10:00 UTC.
      expect(getMarketStatus(nowInIST(new Date('2026-08-06T09:59:00Z'))).status).toBe('OPEN');
      expect(getMarketStatus(nowInIST(new Date('2026-08-06T10:00:00Z'))).status).toBe('CLOSED');
    });
  });

  it('opens at 09:15 IST to the minute, and reports the auction before it', () => {
    withZone(() => {
      // 09:15 IST = 03:45 UTC. The 09:00–09:15 pre-open call auction is
      // deliberately NOT "open": orders match but continuous trading has not
      // started, so a price quoted then is not a traded price.
      expect(getMarketStatus(nowInIST(new Date('2026-08-06T03:29:00Z'))).status).toBe('CLOSED');
      expect(getMarketStatus(nowInIST(new Date('2026-08-06T03:44:00Z'))).status).toBe('PRE_OPEN');
      expect(getMarketStatus(nowInIST(new Date('2026-08-06T03:45:00Z'))).status).toBe('OPEN');
    });
  });

  it('names the holiday rather than only flagging one', () => {
    withZone(() => {
      const result = getMarketStatus(nowInIST(new Date('2026-01-26T05:00:00Z')), NSE_HOLIDAYS_2026);
      expect(result.holiday?.name).toBe('Republic Day');
    });
  });

  it('admits when the holiday calendar does not cover the year', () => {
    withZone(() => {
      // The list is 2026 only. A 2027 weekday still reports on session hours,
      // but must not imply a holiday check that never happened.
      const y2027 = getMarketStatus(nowInIST(new Date('2027-01-26T05:00:00Z')), NSE_HOLIDAYS_2026);
      expect(y2027.holidayCalendarKnown).toBe(false);
      const y2026 = getMarketStatus(nowInIST(new Date('2026-08-06T06:00:00Z')), NSE_HOLIDAYS_2026);
      expect(y2026.holidayCalendarKnown).toBe(true);
    });
  });

  it('reads the calendar DAY in IST, not in the device zone', () => {
    withZone(() => {
      // 20:00 UTC on Friday 2026-08-07 is 01:30 IST on SATURDAY 2026-08-08.
      // A device in New York still sees Friday evening; the exchange does not.
      expect(getMarketStatus(nowInIST(new Date('2026-08-07T20:00:00Z'))).status).toBe('WEEKEND');
    });
  });

  it('lands a holiday on the right IST date from either side of the dateline', () => {
    withZone(() => {
      // Republic Day, 2026-01-26. 05:00 UTC is 10:30 IST that morning.
      expect(getMarketStatus(nowInIST(new Date('2026-01-26T05:00:00Z')), NSE_HOLIDAYS_2026).status).toBe('HOLIDAY');
      // 19:00 UTC on the 25th is 00:30 IST on the 26th — already the holiday.
      expect(getMarketStatus(nowInIST(new Date('2026-01-25T19:00:00Z')), NSE_HOLIDAYS_2026).status).toBe('HOLIDAY');
    });
  });
});

describe('the offset itself', () => {
  it('is a constant, because India has never observed daylight saving', () => {
    expect(IST_OFFSET_MS).toBe(5.5 * 60 * 60 * 1000);
  });

  it('uses no device information at all', () => {
    // The whole class of bug was reading `getTimezoneOffset()`. An absolute
    // instant plus a fixed offset cannot depend on where the reader is.
    const instant = new Date('2026-08-06T14:30:00Z');
    const results = new Set();
    for (const zone of DEVICE_ZONES) {
      process.env.TZ = zone;
      results.add(nowInIST(instant).getTime());
    }
    process.env.TZ = ORIGINAL_TZ;
    expect(results.size).toBe(1);
  });
});
