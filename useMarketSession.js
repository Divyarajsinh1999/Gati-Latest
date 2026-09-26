/**
 * THE MARKET SESSION — one source of truth for "what is the market doing".
 *
 * WHAT THIS OWNS
 *   Every question the interface asks about the exchange clock and about how
 *   current the numbers on screen are: the session, the refresh cadence
 *   actually in use, and whether what is displayed can honestly be called
 *   live.
 *
 * WHAT THIS MUST NEVER DO
 *   Fetch. It reads the session from `engine/tradingCalendar.js` and the
 *   freshness from React Query's existing cache. It adds no request and no
 *   second polling timer.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS RATHER THAN EACH COMPONENT CALLING getMarketStatus()
 *
 * Before this, `AppBar` derived the session on its own 30-second timer and
 * `useUniverseHistory` derived it again, independently, inside
 * `refetchInterval`. Two clocks. They agreed in practice only because they
 * called the same pure function within milliseconds of each other — nothing
 * made them agree, and a third caller could easily have drifted a tick out
 * and shown LIVE in the header while polling had already stopped.
 *
 * There is now ONE ticker. Components subscribe; nobody re-derives.
 *
 * THE CADENCE IS READ, NOT ASSERTED. `REFRESH_CADENCE_MS` is the same
 * constant `useUniverseHistory` polls on, so the interface cannot claim a
 * frequency the application does not use. The old header said "15 min"
 * beside data that refreshes every 30 seconds.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useMemo } from 'react';
import { getMarketStatus, nowInIST } from '../engine/tradingCalendar.js';
import { REFRESH_CADENCE_MS, SESSION_TICK_MS } from '../config/constants.js';
import { useDataFreshness } from './useDataFreshness.js';
import { useOnlineStatus } from './useOnlineStatus.js';

/**
 * One timer for the whole application.
 *
 * A module-level ticker rather than a timer per hook call: the session is a
 * property of the world, not of a component, and eight subscribers should
 * not mean eight intervals waking the device up.
 */
const listeners = new Set();
let intervalId = null;
let current = getMarketStatus();

function tick() {
  const next = getMarketStatus(nowInIST());
  // Referential stability matters: `current` is handed straight to consumers,
  // so a new object every second would re-render every subscriber every
  // second. Only the fields that can change are compared.
  if (
    next.status === current.status &&
    next.tradingDate === current.tradingDate &&
    next.holidayCalendarKnown === current.holidayCalendarKnown
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener(next);
}

function subscribe(listener) {
  listeners.add(listener);
  if (intervalId == null) {
    tick();
    intervalId = setInterval(tick, SESSION_TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/** The raw session, without any data-freshness reasoning layered on. */
export function useMarketSessionStatus() {
  const [session, setSession] = useState(current);
  useEffect(() => subscribe(setSession), []);
  return session;
}

/** Human labels. Deliberately short — the compact header has no room for a
 *  sentence, and "Market" adds nothing next to a status dot. */
const COMPACT_LABEL = {
  OPEN: 'LIVE',
  PRE_OPEN: 'PRE-OPEN',
  CLOSED: 'CLOSED',
  WEEKEND: 'WEEKEND',
  HOLIDAY: 'HOLIDAY',
};

const SESSION_NAME = {
  OPEN: 'NSE cash market · continuous trading',
  PRE_OPEN: 'NSE cash market · pre-open call auction',
  CLOSED: 'NSE cash market · closed',
  WEEKEND: 'NSE cash market · weekend',
  HOLIDAY: 'NSE cash market · exchange holiday',
};

/**
 * Formats a millisecond cadence the way a person reads it.
 * @param {number} ms
 */
export function formatCadence(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)} sec`;
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? '1 min' : `${minutes} min`;
}

/**
 * Everything the interface needs to describe the market and the data, from
 * one place.
 *
 * @returns {{
 *   status: 'OPEN'|'PRE_OPEN'|'CLOSED'|'WEEKEND'|'HOLIDAY',
 *   label: string,               compact label, e.g. 'LIVE'
 *   sessionName: string,
 *   tradingDate: string,         'YYYY-MM-DD' in IST
 *   asOf: Date,
 *   holiday: {date:string,name:string}|null,
 *   holidayCalendarKnown: boolean,
 *   isPolling: boolean,          whether the app is actually refreshing now
 *   cadenceMs: number|null,
 *   cadenceLabel: string,
 *   tone: 'live'|'closed'|'degraded'|'failed',
 *   isLive: boolean,             SAFE to call the numbers live
 *   freshness: 'live'|'delayed'|'last close'|'cached'|'stale'|'sample'|'loading',
 *   fetchedAt: number|null,
 *   dataAsOf: string|null,
 *   providerId: string|null,
 *   isOnline: boolean,
 * }}
 */
export function useMarketSession() {
  const session = useMarketSessionStatus();
  const { fetchedAt, dataAsOf, providerId } = useDataFreshness();
  const isOnline = useOnlineStatus();

  return useMemo(() => {
    const isPolling = session.status === 'OPEN' && isOnline;
    const isSynthetic = providerId === 'mock';
    const isLoaded = fetchedAt != null;
    // ISO date strings compare correctly with <, no parsing needed.
    const isStaleWhileOpen = session.status === 'OPEN' && dataAsOf != null && dataAsOf < session.tradingDate;

    /**
     * THE LIVE CLAIM, IN ONE PLACE.
     *
     * "Live" is the single most misleading word a financial interface can
     * print, so it is granted here and nowhere else. It requires all four:
     * the exchange is actually trading, the device is online, the data is
     * real rather than sample, and the newest bar is from today.
     */
    const isLive = session.status === 'OPEN' && isOnline && !isSynthetic && !isStaleWhileOpen && isLoaded;

    let tone = 'closed';
    let freshness = 'last close';

    if (!isLoaded) {
      tone = 'closed';
      freshness = 'loading';
    } else if (isSynthetic) {
      // Outranks everything: sample figures must never be mistaken for market
      // figures, whatever the exchange is doing.
      tone = 'failed';
      freshness = 'sample';
    } else if (!isOnline) {
      tone = 'degraded';
      freshness = 'cached';
    } else if (isStaleWhileOpen) {
      tone = 'degraded';
      freshness = 'delayed';
    } else if (isLive) {
      tone = 'live';
      freshness = 'live';
    }

    return {
      ...session,
      label: COMPACT_LABEL[session.status] ?? 'CLOSED',
      sessionName: SESSION_NAME[session.status] ?? SESSION_NAME.CLOSED,
      isPolling,
      cadenceMs: isPolling ? REFRESH_CADENCE_MS : null,
      // When nothing is being polled, saying "30 sec" would be a claim about
      // behaviour that is not happening.
      cadenceLabel: isPolling ? formatCadence(REFRESH_CADENCE_MS) : 'paused',
      tone,
      isLive,
      freshness,
      fetchedAt,
      dataAsOf,
      providerId,
      isOnline,
    };
  }, [session, fetchedAt, dataAsOf, providerId, isOnline]);
}
