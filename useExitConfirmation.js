/**
 * BACK AND EXIT.
 *
 * WHAT THIS OWNS
 *   Deciding whether a back gesture is navigation INSIDE Gati or an attempt
 *   to leave it, and asking only in the second case.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE RULE, AND WHY IT IS THE HARD PART
 *
 * Home → Universe → Stock, then Back, must go Stock → Universe. Asking "do
 * you want to exit?" there would be worse than having no confirmation at
 * all: a dialog that appears when the reader is plainly still navigating
 * teaches them to dismiss dialogs without reading, which is the habit that
 * makes the real one useless.
 *
 * So the prompt requires BOTH:
 *   - nowhere left to go back to inside Gati (depth 0), and
 *   - a back gesture that would otherwise leave the origin
 *
 * DEPTH IS COUNTED, NOT INFERRED FROM THE URL. A reader can arrive at the
 * home route by pressing back from a stock, and at that moment they DO have
 * app history behind them. The route alone cannot tell the two apart; a
 * counter that increments on PUSH and decrements on POP can.
 *
 * THE GUARD ENTRY
 * A browser gives no chance to cancel a back that leaves the page — by the
 * time anything is observable the navigation has happened. The only
 * mechanism is to put a disposable history entry in front, let the gesture
 * consume THAT, and re-arm it. That is what `pushState` below does, and why
 * the entry carries a marker rather than being an ordinary route.
 *
 * WHAT THIS REFUSES TO DO
 * `window.close()` only works on windows a script opened. In an ordinary
 * browser tab it silently does nothing — so a dialog whose YES button
 * "closes the app" would lie in the most common case of all. The hook
 * reports whether closing is even plausible (installed/standalone), and
 * when the attempt fails the dialog says so instead of pretending.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** True when Gati is running as an installed app rather than in a tab. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      // iOS Safari's own flag, which predates the display-mode query.
      window.navigator?.standalone === true
    );
  } catch {
    return false;
  }
}

export function useExitConfirmation() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [isAsking, setIsAsking] = useState(false);
  const [closeFailed, setCloseFailed] = useState(false);

  /**
   * How many pushes deep into Gati the reader is.
   *
   * A ref, not state: it is read inside a `popstate` listener that must see
   * the current value, and it must never itself cause a render.
   */
  const depth = useRef(0);

  /**
   * Whether the reader is already resting AT the bottom of the stack.
   *
   * The difference between arriving at the bottom and trying to leave from
   * it, which a depth counter cannot tell apart: both are a POP that lands
   * on the root.
   */
  const atBottom = useRef(false);

  useEffect(() => {
    // Any forward navigation means there is somewhere to come back to
    // again, so the next back is ordinary navigation.
    if (navigationType === 'PUSH') {
      depth.current += 1;
      atBottom.current = false;
    } else if (navigationType === 'POP') {
      depth.current = Math.max(0, depth.current - 1);
    }
    // REPLACE deliberately does not move the counter — it swaps the current
    // entry rather than adding or removing one.
  }, [location, navigationType]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    /**
     * =================================================================
     * TWO EARLIER ATTEMPTS, AND WHY THEY FAILED.
     *
     * 1. A DEPTH COUNTER read inside the listener. React Router and this
     *    hook are woken by the same `popstate`, and the router's effect
     *    had already decremented the counter by the time this ran -- so
     *    the back that merely ARRIVED at the root looked identical to one
     *    leaving from it. Measured: back from the full list to the
     *    universe screen raised the exit dialog.
     *
     * 2. A MARKER IN history.state. React Router v7 owns that object: it
     *    writes {usr, key, idx} and had replaced the marker before
     *    anything could read it. Measured directly -- the marker was gone
     *    on the very first check.
     *
     * What works is counting VISITS TO THE BOTTOM. This listener is
     * registered inside the router, so it always runs after the router's
     * own, which makes the ordering deterministic rather than a race. The
     * first `popstate` at the bottom is an ARRIVAL; a second, with no
     * forward navigation in between, is an attempt to LEAVE, and only
     * that one asks.
     *
     * The pushed entry is disposable and its state irrelevant -- the
     * router will overwrite it. All that matters is that an entry EXISTS
     * for the next back gesture to consume, so the browser does not leave
     * the page before anything can be shown.
     * =================================================================
     */
    window.history.pushState(null, '');
    atBottom.current = true;

    const onPopState = () => {
      // Above the bottom of Gati's own stack: an ordinary in-app back.
      if (depth.current > 0) return;

      const leaving = atBottom.current;
      atBottom.current = true;
      // Re-arm unconditionally, so a disposable entry always sits in front
      // of the exit whether we asked this time or not.
      window.history.pushState(null, '');
      if (leaving) setIsAsking(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const stay = useCallback(() => {
    setIsAsking(false);
    setCloseFailed(false);
  }, []);

  /**
   * Attempts to close, and admits it when it cannot.
   *
   * There is no reliable way to ask a browser whether `close()` will work,
   * so the only honest test is to try it and see whether we are still here
   * a moment later.
   */
  const leave = useCallback(() => {
    try {
      window.close();
    } catch {
      // Ignored — the check below is what actually decides.
    }
    setTimeout(() => {
      // Still running, so nothing closed. Say so rather than leaving the
      // reader tapping a button that appears to do nothing.
      setCloseFailed(true);
    }, 250);
  }, []);

  return { isAsking, closeFailed, canClose: isStandalone(), stay, leave };
}
