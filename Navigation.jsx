/**
 * NAVIGATION — universe-first, replacing the Dashboard-led sidebar.
 *
 * WHAT THIS OWNS
 *   The five destinations, on both form factors.
 *
 * WHAT THIS MUST NEVER DO
 *   Hardcode a universe. Destinations are rendered from the registry, so
 *   adding a universe is a config entry and nothing else. The old sidebar read
 *   "the first three universes" positionally; that pattern does not return.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY UNIVERSE-FIRST
 *
 * An investor decides WHERE (large, mid, small) before WHAT. The old nav led
 * with a Dashboard whose only job was linking to three destinations that were
 * already in the nav — a tap that earned nothing.
 *
 * THE ACTIVE STATE IS CARRIED BY SHAPE, NOT COLOUR. A 3px indicator bar plus
 * a weight change, with colour merely reinforcing. Colour alone fails for a
 * colour-blind reader, and this is the one control that must always be
 * unambiguous.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { navDestinations } from '../../config/routes.js';
import { getPref } from '../../preferences/prefStore.js';
import {
  IconLargeCap, IconMidCap, IconSmallCap, IconPortfolio, IconReports, IconSettings,
} from '../../design/icons.jsx';

const ICON_FOR = {
  nifty50: IconLargeCap,
  midcap150: IconMidCap,
  smallcap250: IconSmallCap,
  portfolio: IconPortfolio,
  reports: IconReports,
  settings: IconSettings,
};

/** Universes keep their icon family; anything unmapped falls back visibly
 *  rather than rendering an empty slot. */
function iconFor(key) {
  return ICON_FOR[key] ?? IconReports;
}

/* ------------------------------------------------------------------ */
/* BOTTOM NAVIGATION — mobile                                          */
/* ------------------------------------------------------------------ */

export function BottomNav() {
  // Reading the preference rather than the URL: sub-views like /nifty50/all
  // carry no window in their path, and a nav that reset to 1M from there
  // would quietly change the comparison.
  const destinations = navDestinations(getPref('lastWindow'));

  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: 'flex',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-line)',
        // Reserved for the home indicator; content reserves the same space so
        // nothing ever hides behind the bar.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {destinations.map((destination) => {
        const Icon = iconFor(destination.key);
        return (
          <NavLink
            key={destination.key}
            to={destination.path}
            // The window lives in the path, so an exact match would fail the
            // moment a sub-view is open. Matching the universe segment keeps
            // the active state correct across /all, /record and /stock.
            end={false}
            // The visible label is abbreviated to fit six destinations on a
            // 320px bar; the accessible name carries the full one, so a
            // screen reader hears "My portfolio" rather than "Mine".
            aria-label={destination.title ?? destination.label}
            style={({ isActive }) => ({
              flex: 1,
              minWidth: 0,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              // Same constant the content reserves — see --gati-bottom-nav.
              height: 'var(--gati-bottom-nav)',
              textDecoration: 'none',
              color: isActive ? 'var(--color-gold)' : 'var(--color-ink-muted)',
            })}
          >
            {({ isActive }) => (
              <>
                {/* Shape carries the state; colour only reinforces it. */}
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: 20,
                    height: 3,
                    borderRadius: '0 0 3px 3px',
                    background: isActive ? 'var(--color-gold-fill)' : 'transparent',
                  }}
                />
                <Icon size={22} />
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: '-0.01em',
                    // Six destinations at 320px leave ~53px each. Clipping is
                    // better than wrapping, which would make one item two
                    // lines tall and shove the whole row off its baseline.
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {destination.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* ICON RAIL — desktop                                                 */
/* ------------------------------------------------------------------ */

/**
 * 72px rail replacing the 240px sidebar.
 *
 * The old sidebar spent 240px restating what a 56px bottom bar does. The rail
 * gives that width back to the content, which is where a dashboard actually
 * needs it.
 *
 * The rail stays dark in both themes — it is `chrome`, a deliberately fixed
 * frame around a surface that inverts.
 */
export function IconRail() {
  const destinations = navDestinations(getPref('lastWindow'));
  const [expanded, setExpanded] = useState(false);

  return (
    <nav
      aria-label="Main"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
        // Expands OVER the content on hover rather than pushing it. Reflowing
        // a dashboard because a cursor crossed the edge is disorienting, and
        // the destination count never changes — only the labels appear.
        width: expanded ? 200 : 72,
        transition: 'width 180ms ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '20px 0',
        background: 'var(--color-chrome)',
      }}
    >
      {/*
        The PNG already carries its own rounded corners in the alpha
        channel, at the artwork's own 0.18 radius ratio. The CSS radius
        below only needs to match it — set it LARGER and it shaves the
        gold border rule off the mark's corners. 28 * 0.18 = 5.
      */}
      {/*
        40px in the rail (v1.4.0, up from 28). The rail has width the app bar
        does not, and this is the only brand element on a desktop screen —
        the mark carries it. Radius tracks the artwork's own 0.18 rounding:
        40 * 0.18 = 7.
      */}
      <img
        src="/icons/gati-mark.png"
        alt="Gati"
        width={40}
        height={40}
        style={{ marginBottom: 20, borderRadius: 7 }}
      />

      {destinations.map((destination) => {
        const Icon = iconFor(destination.key);
        return (
          <NavLink
            key={destination.key}
            to={destination.path}
            title={destination.label}
            style={({ isActive }) => ({
              position: 'relative',
              width: expanded ? 168 : 48,
              height: 48,
              borderRadius: 10,
              display: 'flex',
              flexDirection: expanded ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: expanded ? 12 : 2,
              paddingLeft: expanded ? 14 : 0,
              textDecoration: 'none',
              color: 'var(--color-chrome-ink)',
              opacity: isActive ? 1 : 0.65,
              transition: 'width 180ms ease, opacity 120ms ease',
            })}
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: expanded ? -14 : -12,
                    width: 3,
                    height: 24,
                    borderRadius: '0 3px 3px 0',
                    background: isActive ? 'var(--color-gold-fill)' : 'transparent',
                  }}
                />
                <Icon size={22} />
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: expanded ? 13.5 : 9.5,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {destination.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
