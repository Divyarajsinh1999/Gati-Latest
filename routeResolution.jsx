/**
 * ROUTE RESOLUTION — turning a URL into a valid destination, always.
 *
 * WHAT THIS OWNS
 *   Legacy redirects, unknown-path fallbacks, and remembering where the user
 *   was so the app opens there next time.
 *
 * WHAT THIS MUST NEVER DO
 *   Render a blank page. Every path resolves to something real, and an
 *   unrecognised one says why it landed where it did. A blank screen is
 *   indistinguishable from a crash to the person looking at it, and it is the
 *   most common way a routing change silently breaks a bookmark.
 */

import { useEffect } from 'react';
import { Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  parsePath, resolveFallback, universePath, parseStrategyKey,
  isValidUniverse, isValidWindow, DEFAULT_WINDOW,
} from '../config/routes.js';
import { UNIVERSE_KEYS } from '../config/universes.js';
import { getPref, setPref } from '../preferences/prefStore.js';

/**
 * Where the app opens.
 *
 * The last universe is remembered, so a returning user lands where they left
 * off rather than on a default they have to correct every visit. A remembered
 * universe that no longer exists falls through to the first — a stale
 * preference must never produce a dead route.
 */
export function RootRedirect() {
  const location = useLocation();
  const remembered = getPref('lastUniverse');
  const universeKey = isValidUniverse(remembered) ? remembered : UNIVERSE_KEYS[0];
  const window_ = getPref('lastWindow');

  return (
    <Navigate
      to={universePath(universeKey, isValidWindow(window_) ? window_ : DEFAULT_WINDOW)}
      replace
      /*
        STATE IS CARRIED THROUGH, and without this the explanation is lost.

        A mistyped URL redirects to `/`, and `/` redirects again to the
        remembered universe. `<Navigate>` starts with empty state, so the
        `redirectNotice` that UnknownRoute attached was dropped on that
        second hop — the reader landed on NIFTY 50 from /nifty5 with no
        indication that anything had been corrected, which is precisely the
        silent substitution UnknownRoute's comment says it exists to avoid.

        The universe screen already renders the notice; it was simply never
        arriving.
      */
      state={location.state}
    />
  );
}

/**
 * Legacy `/strategy/:strategyKey` → the new universe URL.
 *
 * THE WINDOW IS PRESERVED. `/strategy/midcap150-rs-6m` lands on
 * `/midcap150/6m`, not on the default. Dropping it would silently change what
 * a shared link shows — someone sent a 6-month ranking and their reader sees a
 * 1-month one, with nothing indicating the substitution.
 *
 * `replace` is deliberate: the old URL should not sit in history where Back
 * would bounce the user straight back into the redirect.
 */
export function LegacyStrategyRedirect() {
  const { strategyKey } = useParams();
  const parsed = parseStrategyKey(strategyKey);

  if (!parsed) {
    const remembered = getPref('lastUniverse');
    const universeKey = isValidUniverse(remembered) ? remembered : UNIVERSE_KEYS[0];
    return <Navigate to={universePath(universeKey)} replace />;
  }

  return <Navigate to={universePath(parsed.universeKey, parsed.window)} replace />;
}

/**
 * Anything unrecognised.
 *
 * Falls back to the most specific VALID part of the path. Someone who typed a
 * bad window on a real universe still lands on that universe, because throwing
 * away the half that worked helps nobody.
 */
export function UnknownRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parsePath(location.pathname);
  const fallback = resolveFallback(parsed) ?? { path: '/', message: 'That page does not exist.' };

  useEffect(() => {
    // The message rides on navigation state so the destination can surface it.
    // Silently redirecting would leave the user wondering why they are
    // somewhere they did not ask for.
    navigate(fallback.path, { replace: true, state: { redirectNotice: fallback.message } });
  }, [navigate, fallback.path, fallback.message]);

  return null;
}

/**
 * Resolve the active universe and window from the URL, and remember them.
 *
 * The window comes from the path when present and from the remembered
 * preference otherwise, which is what lets `/nifty50/all` inherit a window
 * without carrying it in every sub-view's URL.
 */
export function useUniverseRoute() {
  const { universeKey, window: windowParam } = useParams();
  const location = useLocation();

  const validUniverse = isValidUniverse(universeKey) ? universeKey : null;
  const remembered = getPref('lastWindow');
  const activeWindow = isValidWindow(windowParam)
    ? windowParam
    : isValidWindow(remembered)
      ? remembered
      : DEFAULT_WINDOW;

  useEffect(() => {
    if (!validUniverse) return;
    // Written on every visit rather than on change, so the preference tracks
    // where the user actually spends time rather than only explicit switches.
    setPref('lastUniverse', validUniverse);
    if (isValidWindow(windowParam)) setPref('lastWindow', windowParam);
  }, [validUniverse, windowParam]);

  return {
    universeKey: validUniverse,
    window: activeWindow,
    // Present when the path named a window explicitly; sub-views inherit and
    // this is false there, which the UI uses to decide whether changing the
    // window should push a new URL.
    windowIsExplicit: isValidWindow(windowParam),
    redirectNotice: location.state?.redirectNotice ?? null,
  };
}
