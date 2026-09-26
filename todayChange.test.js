/**
 * TODAY % — the rule, at every session the exchange can be in.
 *
 * THE REPORTED BUG: on a Saturday a stock showed "Today −2.28%". Nothing
 * traded on Saturday; that was Friday's move under a label saying TODAY.
 *
 * The cause was treating "a quote object came back" as "these are live
 * figures". Yahoo returns a quote at the weekend — the last session's,
 * complete with a change percentage. The presence of a response says
 * nothing about when the trading happened.
 */

import { describe, it, expect } from 'vitest';
import { resolveTodayChange } from '../todayChange.js';
import { getMarketStatus, nowInIST } from '../../engine/tradingCalendar.js';
import { NSE_HOLIDAYS_2026 } from '../../config/holidays.js';

/** Builds the session shape the components pass in, from a real instant. */
function sessionAt(iso, { isLive = false } = {}) {
  const status = getMarketStatus(nowInIST(new Date(iso)), NSE_HOLIDAYS_2026);
  return { ...status, isLive: isLive && status.status === 'OPEN' };
}

const row = (asOf, pct = -2.28) => ({ dailyChangePct: pct, dailyChangeAsOf: asOf });

describe('the Saturday bug', () => {
  it('shows a dash, not Friday\'s move, on a Saturday', () => {
    // 2026-08-08 is a Saturday. The newest figure is Friday the 7th's.
    const session = sessionAt('2026-08-08T06:00:00Z');
    expect(session.status).toBe('WEEKEND');

    const today = resolveTodayChange(row('2026-08-07'), session);
    expect(today.applicable).toBe(false);
    expect(today.label).toBe('—');
    expect(today.reason).toBe('No trading today');
  });

  it('never shows zero, which would be a claim about the stock', () => {
    // "0%" says the stock did not move today. On a Sunday nothing moved
    // because nothing traded — a fact about the calendar, not the stock.
    const today = resolveTodayChange(row('2026-08-07'), sessionAt('2026-08-09T06:00:00Z'));
    expect(today.label).not.toBe('0.00%');
    expect(today.label).not.toContain('0');
    expect(today.pct).toBeNull();
  });

  it('carries no direction, so nothing renders green or red', () => {
    const today = resolveTodayChange(row('2026-08-07', 2.28), sessionAt('2026-08-08T06:00:00Z'));
    expect(today.direction).toBeNull();
  });
});

describe('an actual trading session', () => {
  it('shows the figure when the quote is from today and the market is open', () => {
    // 06:00 UTC = 11:30 IST on Thursday 6 Aug — mid-session.
    const session = sessionAt('2026-08-06T06:00:00Z', { isLive: true });
    expect(session.status).toBe('OPEN');

    const today = resolveTodayChange(row('2026-08-06', 2.28), session);
    expect(today.applicable).toBe(true);
    expect(today.label).toBe('+2.28%');
    expect(today.direction).toBe('gain');
    expect(today.isLive).toBe(true);
  });

  it('still shows the completed figure after the close on a trading day', () => {
    // 12:00 UTC = 17:30 IST Thursday. The session is over; the day happened,
    // and its move is a complete, true fact about today.
    const session = sessionAt('2026-08-06T12:00:00Z');
    expect(session.status).toBe('CLOSED');

    const today = resolveTodayChange(row('2026-08-06', 2.28), session);
    expect(today.applicable).toBe(true);
    expect(today.label).toBe('+2.28%');
    // But not LIVE — nothing is updating.
    expect(today.isLive).toBe(false);
  });

  it('withholds it before the opening bell, when today has not traded yet', () => {
    // 02:00 UTC = 07:30 IST Thursday. A weekday, but the newest figure is
    // still Wednesday's, and Wednesday is not today.
    const session = sessionAt('2026-08-06T02:00:00Z');
    const today = resolveTodayChange(row('2026-08-05', 2.28), session);
    expect(today.applicable).toBe(false);
    expect(today.reason).toBe('No session yet today');
  });

  it('does not claim LIVE during the pre-open auction', () => {
    // 03:30 UTC = 09:00 IST. Orders match; continuous trading has not begun,
    // so a price quoted then is not a traded price.
    const session = sessionAt('2026-08-06T03:30:00Z');
    expect(session.status).toBe('PRE_OPEN');
    expect(resolveTodayChange(row('2026-08-06', 2.28), session).isLive).toBe(false);
  });
});

describe('exchange holidays', () => {
  it('shows a dash on Republic Day and says why', () => {
    const session = sessionAt('2026-01-26T06:00:00Z');
    expect(session.status).toBe('HOLIDAY');

    const today = resolveTodayChange(row('2026-01-23', -2.28), session);
    expect(today.applicable).toBe(false);
    expect(today.reason).toBe('Exchange holiday');
  });
});

describe('device timezone', () => {
  const ORIGINAL = process.env.TZ;

  it.each(['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Chatham'])(
    'reaches the same verdict on a device set to %s',
    (zone) => {
      process.env.TZ = zone;
      try {
        // Saturday in IST, whatever the reader's own clock says.
        const weekend = resolveTodayChange(row('2026-08-07'), sessionAt('2026-08-08T06:00:00Z'));
        expect(weekend.applicable).toBe(false);
        const trading = resolveTodayChange(row('2026-08-06', 1.5), sessionAt('2026-08-06T06:00:00Z'));
        expect(trading.applicable).toBe(true);
      } finally {
        process.env.TZ = ORIGINAL;
      }
    },
  );
});

describe('missing and malformed data', () => {
  it('shows a dash when there is no percentage at all', () => {
    const session = sessionAt('2026-08-06T06:00:00Z');
    expect(resolveTodayChange({ dailyChangePct: null, dailyChangeAsOf: '2026-08-06' }, session).label).toBe('—');
  });

  it('shows a dash when the figure has no session date', () => {
    // Undated, so unattributable. It must not default to today.
    const session = sessionAt('2026-08-06T06:00:00Z');
    const today = resolveTodayChange({ dailyChangePct: 2.28, dailyChangeAsOf: null }, session);
    expect(today.applicable).toBe(false);
  });

  it('refuses to claim today when there is no session object', () => {
    // First render, or a caller that forgot to pass one. Silence is the safe
    // direction: the alternative is asserting today on no evidence.
    expect(resolveTodayChange(row('2026-08-06', 2.28), null).applicable).toBe(false);
    expect(resolveTodayChange(row('2026-08-06', 2.28), undefined).label).toBe('—');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '2.28', {}])(
    'rejects a non-finite percentage (%s)',
    (bad) => {
      const session = sessionAt('2026-08-06T06:00:00Z');
      expect(resolveTodayChange({ dailyChangePct: bad, dailyChangeAsOf: '2026-08-06' }, session).applicable).toBe(false);
    },
  );
});

/**
 * VOLUME IS SUBJECT TO THE SAME RULE.
 *
 * Day volume is a CUMULATIVE session total, so a stale figure belongs to the
 * last session that traded — not to today. The stock screen read "20.20L
 * shares traded today" on a Saturday, from the same faulty signal that
 * produced the Today % bug: `dailyChangeIsLive`, which is true whenever a
 * quote object comes back, and one comes back at the weekend.
 */
describe('day volume attribution', () => {
  it('is not "today" when there was no session today', () => {
    const weekend = resolveTodayChange(row('2026-08-07', 1.2), sessionAt('2026-08-08T06:00:00Z'));
    // The screen keys the "shares traded today" wording off this flag.
    expect(weekend.applicable).toBe(false);
  });

  it('is "today" during a real session', () => {
    const open = resolveTodayChange(row('2026-08-06', 1.2), sessionAt('2026-08-06T06:00:00Z'));
    expect(open.applicable).toBe(true);
  });
});
