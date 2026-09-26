/**
 * TOPBAR — the terminal shell's sticky header (D18).
 *
 * WHAT THIS OWNS
 *   The breadcrumb, the market status, the search affordance, and the button
 *   that opens the drawer on a phone.
 *
 * WHAT THIS MUST NEVER DO
 *   Derive the market session itself. It subscribes to `useMarketSession`,
 *   which is the single authority — two components deriving the session on
 *   separate clocks is the exact fault M13 fixed, and reintroducing it here
 *   would put a stale word next to a live number.
 *
 * NOT PORTED FROM THE REFERENCE BUILD
 *   The notification bell and the "DM" profile avatar. Gati has no accounts
 *   (D3) and nothing sits behind either control, so both would be furniture
 *   that implies a feature. An affordance that does nothing is worse than a
 *   gap where one might have been.
 */

import { useLocation } from 'react-router-dom';
import { breadcrumbFor } from '../../config/routes.js';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { IconSearch, IconSystem, IconMarketClosed } from '../../design/icons.jsx';

/**
 * The market status block.
 *
 * Colour is never the only signal — the label spells the state out, and the
 * second line carries the trading date so "CLOSED" is attributable to a day
 * rather than floating free.
 */
function MarketStatus() {
  const session = useMarketSession();

  const tone = {
    live: 'var(--color-gain)',
    closed: 'var(--color-ink-muted)',
    degraded: 'var(--color-warn)',
    failed: 'var(--color-loss)',
  }[session.tone] ?? 'var(--color-ink-muted)';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        paddingRight: 15, borderRight: '1px solid var(--color-line)',
      }}
    >
      <span style={{ color: tone, display: 'grid', placeItems: 'center' }} aria-hidden="true">
        <IconMarketClosed size={16} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ font: `500 9px var(--font-mono)`, letterSpacing: '0.1em', color: tone }}>
          {session.label}
        </strong>
        <span style={{ marginTop: 2, fontSize: 9, color: 'var(--color-ink-muted)' }}>
          {/* The cadence only appears while something is genuinely polling.
              Naming an interval the app is not running is how the old header
              came to claim "15 min" beside 30-second data. */}
          {session.isPolling ? `Refreshing · ${session.cadenceLabel}` : session.tradingDate}
        </span>
      </div>
    </div>
  );
}

export function TopBar({ onOpenMenu, onOpenSearch }) {
  const location = useLocation();
  const where = breadcrumbFor(location.pathname);

  return (
    <header className="gati-topbar">
      <div className="gati-topbar-left">
        <button
          type="button"
          className="gati-icon-button gati-menu-button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
        >
          <IconSystem size={18} />
        </button>
        {/*
          A real <nav> with an ordered list, not a row of styled spans. The
          breadcrumb is the only thing on a phone that names the current
          screen, so it has to be reachable rather than decorative.
        */}
        <nav aria-label="Breadcrumb" className="gati-breadcrumb">
          <span>Gati</span>
          <i aria-hidden="true">/</i>
          <strong aria-current="page">{where}</strong>
        </nav>
      </div>

      <div className="gati-topbar-right">
        <MarketStatus />
        <button
          type="button"
          className="gati-search-button"
          onClick={onOpenSearch}
          aria-label="Search stocks"
          title="Search (press /)"
        >
          <IconSearch size={16} />
          <span>Search stocks</span>
          <kbd aria-hidden="true">/</kbd>
        </button>
      </div>
    </header>
  );
}
