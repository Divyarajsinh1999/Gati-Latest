/**
 * THE SPLASH SEQUENCE — animation logic, with no markup in it.
 *
 * WHAT THIS OWNS
 *   How long the splash lives, which phase it is in, when it is dismissed,
 *   and restoring the browser chrome colour on the way out.
 *
 * WHAT THIS MUST NEVER DO
 *   Wait for data. The splash is a fixed-length brand moment layered over
 *   an app that boots normally underneath it. Gating it on a fetch would
 *   turn a 2-second animation into an indefinite one on a slow network,
 *   and the app already has skeletons for that job.
 *
 * WHY A STATE MACHINE AND NOT `setTimeout` IN THE COMPONENT
 *   Three phases, two of them entered on a timer, all of them cancellable
 *   by a tap. Kept in the component, that is four `useEffect`s racing each
 *   other and a cleanup bug per render. Here it is one reducer-shaped
 *   value the component reads.
 *
 * PHASES
 *   'playing'   the sweep and glow are running
 *   'leaving'   the cross-fade to the app has started; splash still mounted
 *   'done'      unmounted; the component returns null
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SPLASH_TIMING,
  SPLASH_TIMING_REDUCED,
  splashFadeStart,
  splashTotalDuration,
} from '../config/splash.js';
import { applyTheme, readStoredPreference, resolveTheme, DARK_MEDIA_QUERY } from '../utils/theme.js';

/**
 * Reads the reduced-motion preference once, at mount.
 *
 * Deliberately not reactive. Someone who changes the OS setting midway
 * through a 2-second launch animation is not a case worth a listener, and
 * swapping choreography mid-sequence would produce exactly the jarring
 * motion the preference exists to prevent.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Puts the browser/OS chrome colour back to the theme's own value.
 *
 * The pre-paint bootstrap in index.html sets <meta name="theme-color"> to
 * the splash background so the Android address bar and iOS status bar do
 * not show a seam against a dark splash. Once the splash leaves, that is
 * the wrong colour — it has to return to whatever the resolved theme uses,
 * which is what applyTheme() already knows how to do.
 */
function systemPrefersDark() {
  try {
    return window.matchMedia?.(DARK_MEDIA_QUERY).matches ?? false;
  } catch {
    return false;
  }
}

function restoreChrome() {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute('data-splash');
  applyTheme(resolveTheme(readStoredPreference(), systemPrefersDark()));
}

/**
 * Drives one launch splash.
 *
 * @param {object} [options]
 * @param {boolean} [options.enabled] false renders nothing and restores chrome
 *   immediately — used when the logo fails to load, so a missing asset
 *   starts the app rather than showing an empty dark rectangle.
 * @returns {{
 *   phase: 'playing'|'leaving'|'done',
 *   timing: typeof SPLASH_TIMING,
 *   reducedMotion: boolean,
 *   skip: () => void,
 * }}
 */
export function useSplashSequence({ enabled = true } = {}) {
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const timing = reducedMotion ? SPLASH_TIMING_REDUCED : SPLASH_TIMING;

  /**
   * `enabled` is folded in as a DERIVED value rather than pushed into state.
   *
   * The first version set state from an effect when the asset failed, which
   * costs a second render pass and is exactly the cascade the lint rule
   * warns about. Deriving it means a failed asset is already 'done' on the
   * very render that observes the failure — no extra frame, no window in
   * which an empty dark rectangle is on screen.
   */
  const [scheduledPhase, setScheduledPhase] = useState('playing');
  const phase = enabled ? scheduledPhase : 'done';
  const timers = useRef([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);

  /**
   * Ends the splash early. Idempotent, and it still fades rather than
   * cutting — the brief rules out sudden cuts, and that applies to the
   * skip path too.
   */
  const skip = useCallback(() => {
    setScheduledPhase((current) => {
      if (current !== 'playing') return current;
      clearTimers();
      timers.current.push(setTimeout(() => setScheduledPhase('done'), timing.fadeOut));
      return 'leaving';
    });
  }, [clearTimers, timing.fadeOut]);

  useEffect(() => {
    if (!enabled) {
      // The asset failed. `phase` is already 'done' by derivation; all that
      // remains is to stop the timers that would otherwise fire into a
      // component that is no longer rendering anything.
      clearTimers();
      return undefined;
    }
    // Scheduled from mount, not chained, so a late frame in one phase
    // cannot push every phase after it.
    timers.current.push(setTimeout(() => setScheduledPhase('leaving'), splashFadeStart(timing)));
    timers.current.push(setTimeout(() => setScheduledPhase('done'), splashTotalDuration(timing)));
    return clearTimers;
  }, [enabled, timing, clearTimers]);

  // The chrome colour goes back when the splash is genuinely gone, not when
  // the fade starts — restoring it mid-fade shows the seam it exists to hide.
  // One place does this, so every exit path (timer, tap, failed asset) is
  // guaranteed to leave the browser chrome correct.
  useEffect(() => {
    if (phase === 'done') restoreChrome();
  }, [phase]);

  return { phase, timing, reducedMotion, skip };
}
