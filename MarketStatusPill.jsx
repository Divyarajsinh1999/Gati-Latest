/**
 * MARKET STATUS — a pill, and the panel behind it.
 *
 * WHAT THIS OWNS
 *   How the session is presented. Nothing about what the session IS: every
 *   value here comes from `useMarketSession`, which is the one place the
 *   application decides what the market is doing and whether the numbers on
 *   screen can honestly be called live.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE COLLAPSED STATE IS THE WHOLE DESIGN
 *
 * It replaces a full-width bar reading "Markets closed for the weekend"
 * followed by "Data as of 07 Aug 2026". Two lines of chrome, on every
 * screen, saying something the reader needs to check once.
 *
 * Now: a dot, a word, a cadence. `● LIVE · 30 sec`. The word "Market" is
 * gone — a status dot beside a trading app does not need to announce which
 * market. Everything else moved behind the tap, which already existed and
 * which readers already knew about.
 *
 * THE CADENCE IS READ, NEVER WRITTEN. It comes from the same constant the
 * poller uses. The old bar implied a freshness it had no connection to.
 * When polling is paused — market closed, or offline — it says "paused"
 * rather than naming an interval nothing is running on.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. The dot carries a colour, but the word
 * beside it says LIVE, CLOSED, WEEKEND or HOLIDAY in text, and the panel
 * spells the whole thing out. A reader who cannot distinguish the dot
 * colours loses nothing.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useId } from 'react';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { formatDate, formatDateTime } from '../../utils/formatters.js';
import { IconChevronDown } from '../../design/icons.jsx';

const TONE = {
  live: { dot: 'var(--color-gain-fill)', fg: 'var(--color-gain)', bg: 'var(--color-gain-soft)' },
  closed: { dot: 'var(--color-ink-muted)', fg: 'var(--color-ink-muted)', bg: 'var(--color-surface-raised)' },
  degraded: { dot: 'var(--color-warn)', fg: 'var(--color-warn)', bg: 'var(--color-warn-soft)' },
  failed: { dot: 'var(--color-loss-fill)', fg: 'var(--color-loss)', bg: 'var(--color-loss-soft)' },
};

/**
 * What the data actually is right now, in one word the reader can act on.
 * Deliberately not a synonym for the session: the market can be open while
 * the data is delayed, and that is the case worth being loud about.
 */
const FRESHNESS_COPY = {
  live: 'Live prices, updating now',
  delayed: 'Market is open but these prices are older than today',
  'last close': 'Latest available close',
  cached: 'Saved on this device — no connection',
  stale: 'Older than expected',
  sample: 'Sample data — NOT real market prices',
  loading: 'Loading',
};

export function MarketStatusPill() {
  const session = useMarketSession();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tone = TONE[session.tone] ?? TONE.closed;

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // The pill is terse by design, so the accessible name carries the
        // sentence a screen reader needs and the eye does not.
        aria-label={`Market ${session.label}. ${FRESHNESS_COPY[session.freshness]}. Tap for data details.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 32,
          padding: '0 10px',
          border: 'none',
          borderRadius: 999,
          background: tone.bg,
          color: tone.fg,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.04em',
        }}
      >
        <span
          // Pulses ONLY when the data is genuinely live. Stopping it in every
          // other state is what makes its presence mean something.
          className={session.isLive ? 'gati-status-pulse' : undefined}
          style={{ width: 6, height: 6, borderRadius: 999, background: tone.dot, flexShrink: 0 }}
        />
        <span style={{ fontWeight: 600 }}>{session.label}</span>
        <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
        {/*
          NO OPACITY HERE. The palette tokens clear WCAG AA on their own —
          loss on loss-soft measures 5.00:1 — but an `opacity: 0.85` blends
          the text toward its background and drops the same pair to 3.94:1,
          which axe caught at 11px. The hierarchy between the status word and
          the cadence comes from WEIGHT (600 against 400), which costs no
          contrast. Measured, not assumed.
        */}
        <span>{session.cadenceLabel}</span>
        <IconChevronDown
          size={12}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', opacity: 0.6 }}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          style={{
            marginTop: 6,
            padding: 14,
            borderRadius: 10,
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-line)',
          }}
        >
          <Row label="Status" value={session.label} emphasis />
          <Row label="Session" value={session.sessionName} />
          <Row label="Trading date" value={formatDate(session.tradingDate)} />
          <Row
            label="Data"
            value={FRESHNESS_COPY[session.freshness] ?? '—'}
            tone={session.freshness === 'sample' || session.freshness === 'delayed' ? 'warn' : undefined}
          />
          <Row label="Newest price bar" value={session.dataAsOf ? formatDate(session.dataAsOf) : 'none held'} />
          <Row
            label="Last checked"
            value={session.fetchedAt ? formatDateTime(new Date(session.fetchedAt).toISOString()) : 'not yet'}
          />
          <Row label="Refresh" value={session.isPolling ? `every ${session.cadenceLabel}` : 'paused while closed'} />
          <Row label="Source" value={session.providerId ?? 'unknown'} />

          {/*
            Shown only when it is true. The holiday list covers 2026; for any
            other year the status is derived from session hours alone, and
            saying so is the difference between a limit and a lie.
          */}
          {!session.holidayCalendarKnown ? (
            <Row
              label="Note"
              value="Exchange holidays are not loaded for this year — status uses trading hours only."
              tone="warn"
            />
          ) : null}
          {session.holiday ? <Row label="Holiday" value={session.holiday.name} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, emphasis, tone }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'baseline',
        padding: '3px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      <span style={{ color: 'var(--color-ink-muted)', flex: '0 0 108px' }}>{label}</span>
      <span
        style={{
          color: tone === 'warn' ? 'var(--color-warn)' : 'var(--color-ink)',
          fontWeight: emphasis ? 600 : 400,
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}
