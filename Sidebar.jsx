/**
 * SIDEBAR — the terminal shell's permanent left rail (D18).
 *
 * WHAT THIS OWNS
 *   The five WORKSPACE destinations, the two SYSTEM ones, the data-engine
 *   status card, and the version footer. On a phone it is the same component
 *   behind a transform, not a second navigation.
 *
 * WHAT THIS MUST NEVER DO
 *   Hardcode a universe or a destination. Everything renders from
 *   `terminalDestinations()`, so adding a view is a registry entry. The
 *   sidebar this replaced read "the first three universes" positionally in a
 *   much older version, and that pattern does not return.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ACTIVE STATE IS SHAPE AND WEIGHT, NOT COLOUR ALONE
 *
 * The reference build marks the active item with a lime tint and a lime bar.
 * A reader with a colour vision deficiency, or anyone looking at a greyscale
 * screenshot, gets nothing from that. Here the bar, the background and the
 * label weight all change together — and `aria-current="page"` carries it to
 * a screen reader, which is what the CSS actually keys off.
 *
 * WHY NAV ITEMS ARE LINKS, NOT BUTTONS
 *
 * The reference build renders every destination as a `<button>` and switches
 * a state variable. That produces one URL for the whole application: nothing
 * is shareable, the back button leaves the app, and a refresh loses the
 * reader's place. Gati's URL model is the product — these are `NavLink`s.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { NavLink } from 'react-router-dom';
import { terminalDestinations } from '../../config/routes.js';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { APP_VERSION } from '../../hooks/useBuildInfo.js';
import {
  IconRank, IconRelativeStrength, IconBenchmark, IconPortfolio,
  IconReports, IconSettings, IconInfo, IconSystem, IconCalendar,
} from '../../design/icons.jsx';

const ICON_FOR = {
  command: IconRank,
  ranking: IconRelativeStrength,
  strategies: IconBenchmark,
  portfolio: IconPortfolio,
  reports: IconReports,
  // Calendar rather than a document icon: the journal is organised by month,
  // and it is the month that identifies an entry.
  paper: IconCalendar,
  how: IconInfo,
  settings: IconSettings,
};

/**
 * Plain-language state of the DATA, not of the exchange.
 *
 * Deliberately the same wording as `MarketStatusPill`'s panel, because two
 * components describing the same condition in different words is how a
 * reader ends up trusting whichever one they saw last.
 */
const FRESHNESS_COPY = {
  live: 'Live prices',
  delayed: 'Older than today',
  'last close': 'Latest available close',
  cached: 'Saved on this device',
  stale: 'Older than expected',
  sample: 'Sample data — not real prices',
  loading: 'Loading',
};

/**
 * The data-engine card.
 *
 * The reference build's card reads "Snapshot mode / Provider adapter ready",
 * which was honest there — that app has no fetch layer at all. Here it has to
 * describe a real provider, because a card that says "ready" while a fetch is
 * failing is worse than no card.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT DESCRIBES THE DATA, NOT THE MARKET, AND THE DIFFERENCE IS THE POINT.
 *
 * The first version of this card printed `session.label` — which is the
 * EXCHANGE session — under the heading "Data engine". On mock data that
 * rendered a bold "LIVE" beside a red dot: the exchange was open, so the
 * label said LIVE, while the dot correctly reported that nothing on screen
 * was real. Two true statements that read as one false one.
 *
 * `freshness` is the field that answers "what am I looking at". A card in
 * the chrome of every screen is the last place a live claim should be
 * guessed at.
 * ═════════════════════════════════════════════════════════════════════════
 */
function DataEngineCard() {
  const session = useMarketSession();

  // TONE DRIVES THE DOT, and the dot is never the only signal: the line
  // beneath it names the state in words.
  const toneColour = {
    live: 'var(--color-gain)',
    closed: 'var(--color-ink-muted)',
    degraded: 'var(--color-warn)',
    failed: 'var(--color-loss)',
  }[session.tone] ?? 'var(--color-ink-muted)';

  return (
    <div className="gati-system-card">
      <div className="gati-system-row">
        <IconSystem size={14} />
        <span>Data engine</span>
        <i
          aria-hidden="true"
          style={{
            width: 6, height: 6, borderRadius: '50%', background: toneColour,
            boxShadow: `0 0 8px ${toneColour}`, flex: 'none',
          }}
        />
      </div>
      <strong style={{ color: session.freshness === 'sample' ? 'var(--color-warn)' : undefined }}>
        {FRESHNESS_COPY[session.freshness] ?? 'Unknown'}
      </strong>
      <small>
        {/* Names the cadence actually in use, or says nothing is polling.
            Never a number the application does not act on. */}
        {session.isPolling ? `Refreshing every ${session.cadenceLabel}` : 'Polling paused'}
      </small>
    </div>
  );
}

export function Sidebar({ open = false, onNavigate, universeKey, activeWindow }) {
  const sections = terminalDestinations(universeKey, activeWindow);

  return (
    <aside
      className={`gati-sidebar${open ? ' gati-sidebar--open' : ''}`}
      /*
        ═══════════════════════════════════════════════════════════════════
        THE CLOSED DRAWER IS TAKEN OUT OF THE TAB ORDER BY CSS, NOT BY A
        PROP, AND THE REASON IS A BUG THIS NEARLY SHIPPED WITH.

        The first version put `inert` on this element whenever `open` was
        false. That is correct on a phone — an offscreen drawer whose links
        are still focusable means a keyboard user tabs into a panel they
        cannot see, the same class of fault as the unreachable scroller M13
        found.

        But `open` only means "drawer open", and on desktop the sidebar is
        ALWAYS visible while `open` stays false. So `inert` would have made
        the entire navigation keyboard-unreachable on every desktop screen —
        a total accessibility failure, invisible to anyone using a mouse,
        and not something jsdom would have shown either.

        The condition is a width, so it belongs in a media query.
        `visibility: hidden` inside the drawer breakpoint removes the closed
        panel from the tab order and from the accessibility tree, and simply
        does not apply above 760px. No measurement before paint, no JS
        branch that can disagree with the layout. See index.css.
        ═══════════════════════════════════════════════════════════════════
      */
    >
      <div className="gati-brand-row">
        <div className="gati-brand-mark">
          {/* Supplied artwork (S2), never redrawn. Radius tracks the
              artwork's own 0.18 rounding: 34 * 0.18 = 6. */}
          <img src="/icons/gati-mark.png" alt="" width={34} height={34} style={{ borderRadius: 6 }} />
        </div>
        <div className="gati-brand-text">
          <strong>GATI</strong>
          <span>INDIA / TERMINAL</span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.section}>
          <div className="gati-sidebar-section">{section.section}</div>
          <nav aria-label={section.section} className="gati-nav-list">
            {section.items.map((item) => {
              const Icon = ICON_FOR[item.key] ?? IconReports;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end={item.end ?? false}
                  className="gati-nav-item"
                  onClick={onNavigate}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="gati-sidebar-bottom">
        <DataEngineCard />
        <div className="gati-version-row">
          <span>v{APP_VERSION}</span>
          {/*
            The milestone this build belongs to. `APP_VERSION` is compiled in
            from package.json, so it cannot drift; this label is hand-written
            and DID drift — it still read M14 through the whole of v1.6.0,
            which was M15. Worth a moment when releasing: a version row that
            is half automatic and half stale is more misleading than one that
            shows nothing, because the accurate half lends the wrong half
            credibility.
          */}
          <span>M16</span>
        </div>
      </div>
    </aside>
  );
}
