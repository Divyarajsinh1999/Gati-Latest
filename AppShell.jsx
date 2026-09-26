/**
 * APP SHELL — the terminal frame every screen sits inside (D18, M14).
 *
 * WHAT THIS OWNS
 *   The sidebar, the topbar, the ticker tape, and the space reserved for all
 *   three.
 *
 * WHAT THIS MUST NEVER DO
 *   Participate in a route transition. The frame stays perfectly still while
 *   only the content cross-fades; a bar that animates with the page makes the
 *   whole app feel like it is reloading.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ONE NAVIGATION, NOT TWO
 *
 * This previously rendered BOTH an icon rail and a bottom bar, letting media
 * queries pick — deliberately, so no measurement was needed before first
 * paint. The terminal shell has one navigation that becomes a drawer under
 * 760px, so there is a single component and the media query moves it rather
 * than choosing between two.
 *
 * THE DRAWER'S OPEN STATE IS THE ONE PIECE OF JS LAYOUT HERE, and it has to
 * be: an off-canvas panel that is merely translated stays focusable, so a
 * keyboard user tabs into invisible controls behind a scrim. The `inert`
 * attribute in Sidebar.jsx is what actually prevents that; this state is what
 * drives it.
 *
 * WHY THE DRAWER CLOSES ON NAVIGATE
 * Tapping a destination on a phone should leave the reader looking at that
 * destination, not at the menu they used to reach it. `onNavigate` is passed
 * down for exactly this and nothing else.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
import { IndexStrip } from './IndexStrip.jsx';
import { ExitConfirmation } from './ExitConfirmation.jsx';
import { GlobalSearch } from '../search/GlobalSearch.jsx';
import { useKeyboardShortcuts, SHORTCUTS } from '../../navigation/useKeyboardShortcuts.js';
import { parsePath } from '../../config/routes.js';
import { getPref } from '../../preferences/prefStore.js';

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /**
   * KEYBOARD SHORTCUTS.
   *
   * These were written in M5 and, until M10, never actually wired — the hook
   * existed, nothing called it, and only `/` worked because the shell had its
   * own duplicate handler. Reported as delivered; not delivered.
   *
   * Now there is ONE handler. Every shortcut duplicates a visible control, and
   * none fires while the reader is typing.
   */
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onShowShortcuts: () => setShortcutsOpen((v) => !v),
  });

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  /*
    THE DRAWER CLOSES ON EVERY ROUTE CHANGE, not just on a nav tap. Deep
    links out of the drawer — a search result, a stock row inside it — would
    otherwise leave it standing open over the screen they navigated to.

    DERIVED, NOT SYNCHRONISED. The obvious version is an effect that calls
    setMenuOpen(false) when the pathname changes, and the lint rule that
    rejects it is right: that renders the drawer open once at the new route
    and then closes it, which is a visible flicker on a slow phone. Storing
    the path the drawer was opened AT makes "still open" a comparison rather
    than a second render.
  */
  const [menu, setMenu] = useState({ open: false, at: location.pathname });
  const menuOpen = menu.open && menu.at === location.pathname;
  const openMenu = useCallback(() => setMenu({ open: true, at: location.pathname }), [location.pathname]);
  const closeMenu = useCallback(() => setMenu((m) => ({ ...m, open: false })), []);

  /* Escape closes the drawer, matching every other overlay in the app. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, closeMenu]);

  /*
    THE SIDEBAR POINTS AT THE UNIVERSE THE READER IS ACTUALLY IN.

    Read from the URL first and the stored preference second. A route like
    /reports carries no universe, and falling straight to a default there
    would silently move "Live Rankings" to large cap the moment someone
    opened Reports from a small-cap screen.
  */
  const parsed = parsePath(location.pathname);
  const universeKey = parsed.universeKey ?? getPref('lastUniverse') ?? undefined;
  const activeWindow = getPref('lastWindow');

  return (
    <div className="gati-shell">
      {/* Skip link: the first tab stop on every page, so a keyboard user is
          not forced through seven navigation items to reach the content. */}
      <a href="#main" className="gati-skip-link">Skip to content</a>

      {menuOpen && (
        <button
          type="button"
          className="gati-scrim"
          aria-label="Close navigation"
          onClick={closeMenu}
        />
      )}

      <Sidebar
        open={menuOpen}
        onNavigate={closeMenu}
        universeKey={universeKey}
        activeWindow={activeWindow}
      />

      <div className="gati-workspace">
        <TopBar
          onOpenMenu={openMenu}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/*
          The ticker tape sits under the topbar and above the screen, so it is
          present on every route rather than being a home-only widget that
          vanishes when the reader opens a stock. It reads from one global
          query — see hooks/useIndexQuotes.js for why that is fewer requests
          than folding it into each universe bundle.
        */}
        <IndexStrip />

        {/*
          Mounted in the shell, not in a route, so the history guard is armed
          once for the session rather than re-armed on every navigation —
          which would push a junk entry per screen and break back entirely.
        */}
        <ExitConfirmation />

        <main
          id="main"
          // Keyed on pathname so content cross-fades between routes while the
          // frame stays perfectly still.
          key={location.pathname}
          className="gati-route-enter gati-content"
        >
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={closeSearch} />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/**
 * The shortcut list, reachable with `?`.
 *
 * Every shortcut duplicates a visible control, so this is a convenience rather
 * than documentation of hidden functionality — but an accelerator nobody can
 * discover is an accelerator nobody uses.
 */
function ShortcutSheet({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'color-mix(in srgb, var(--color-ink) 40%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{
          width: '100%', maxWidth: 380, padding: 20, borderRadius: 16,
          background: 'var(--color-surface)', border: '1px solid var(--color-line)',
          boxShadow: '0 12px 40px rgba(14,27,44,0.16)',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>
          Keyboard shortcuts
        </h2>
        <dl style={{ margin: 0 }}>
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.description} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
              <dt style={{ display: 'flex', gap: 4 }}>
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    style={{
                      minWidth: 24, padding: '2px 6px', borderRadius: 4, textAlign: 'center',
                      border: '1px solid var(--color-line)', background: 'var(--color-surface-raised)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink)',
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink-soft)' }}>
                {shortcut.description}
              </dd>
            </div>
          ))}
        </dl>
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            style={{
              height: 36, padding: '0 14px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--color-line)', background: 'transparent',
              fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
