/**
 * LAUNCH SPLASH — Luxury Light Sweep.
 *
 * WHAT THIS OWNS
 *   The layers, and nothing else. Every duration comes from config/splash.js
 *   and every phase from useSplashSequence; this file decides only what is
 *   stacked on what.
 *
 * WHAT THIS MUST NEVER DO
 *   Block the application. It renders as a sibling of the router, so the
 *   app mounts, routes and fetches underneath it the whole time. Removing
 *   this component changes when the app becomes VISIBLE, never when it
 *   becomes READY.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE LAYER STACK, BOTTOM TO TOP
 *
 *   .halo      a soft radial glow that rises late and settles faint
 *   .dim       the mark, almost unlit — present from the first frame,
 *              because the brief asks for a logo revealed by light rather
 *              than a logo that fades in
 *   .lit       the same mark at full brightness, masked so that only the
 *              part the light has already crossed is shown
 *   .glint     a specular band riding the reveal edge, screen-blended
 *
 * WHY THE MASK MOVES BY TRANSFORM AND NOT BY `mask-position`
 *
 * The obvious way to sweep a mask is to animate `mask-position`. That
 * repaints the masked element every frame. The same effect is available
 * from transforms alone, which the compositor can run without the main
 * thread:
 *
 *   .lit  is 2.5x the stage width and carries a static mask that is opaque
 *         on its left and transparent on its right
 *   .lit img  sits inside it and counter-translates by exactly the same
 *         distance, so on screen the artwork never moves
 *
 * The wrapper slides 1.5 stage-widths right; the image slides 1.5 stage-
 * widths left within it. Net movement of the artwork: zero. Net movement of
 * the mask across the artwork: 1.5 stage-widths. The two are exact inverses
 * (-60% of 2.5S is -1.5S; +150% of S is +1.5S), so nothing drifts.
 *
 * Verified two ways: the arithmetic is asserted in config/__tests__/splash.js,
 * and the rendered artwork's bounding box was measured across the sweep in a
 * real browser and does not move by a single pixel.
 *
 * DEGRADATION
 * A browser without `mask-image` ignores the mask and shows `.lit` in full
 * from the first frame. That is a logo appearing without a sweep — plain,
 * not broken. Such a browser also lacks WebP, in which case the image fails
 * to load and `onError` starts the app immediately instead.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from 'react';
import { useSplashSequence } from '../../hooks/useSplashSequence.js';
import {
  SPLASH_LOGO_SRC,
  SPLASH_LOGO_SIZE,
  SPLASH_BACKGROUND,
  SPLASH_EASING,
} from '../../config/splash.js';

export function SplashScreen() {
  /**
   * A splash that cannot draw its own logo is worse than no splash: it is
   * an empty dark rectangle holding the app back for two seconds. If the
   * asset fails, the sequence is disabled and the app appears at once.
   */
  const [assetFailed, setAssetFailed] = useState(false);
  const onAssetError = useCallback(() => setAssetFailed(true), []);

  const { phase, timing, reducedMotion, skip } = useSplashSequence({ enabled: !assetFailed });

  if (phase === 'done') return null;

  /**
   * Timing crosses into CSS as custom properties rather than as inline
   * `animation` shorthands, so the keyframes stay in the stylesheet where
   * they can be overridden by the reduced-motion block, and this file
   * stays free of animation syntax.
   */
  const vars = {
    '--splash-bg': SPLASH_BACKGROUND,
    '--splash-size': SPLASH_LOGO_SIZE,
    '--splash-ease': SPLASH_EASING,
    '--splash-sweep-delay': `${timing.sweepDelay}ms`,
    '--splash-sweep-duration': `${timing.sweepDuration}ms`,
    '--splash-glow-delay': `${timing.glowDelay}ms`,
    '--splash-glow-duration': `${timing.glowDuration}ms`,
    '--splash-fade-duration': `${timing.fadeOut}ms`,
  };

  return (
    /*
      aria-hidden: the splash carries no information, so announcing it would
      only delay a screen-reader user from reaching content that is already
      in the DOM beneath it. The click handler is a convenience for pointer
      users; every keyboard and assistive-technology path reaches the app
      without needing it.
    */
    <div
      className={`gati-splash${phase === 'leaving' ? ' gati-splash--leaving' : ''}${
        reducedMotion ? ' gati-splash--still' : ''
      }`}
      style={vars}
      aria-hidden="true"
      onClick={skip}
    >
      <div className="gati-splash__stage">
        <div className="gati-splash__halo" />

        <img
          className="gati-splash__dim"
          src={SPLASH_LOGO_SRC}
          alt=""
          decoding="async"
          fetchPriority="high"
          draggable="false"
          onError={onAssetError}
        />

        <div className="gati-splash__lit">
          <img
            className="gati-splash__lit-art"
            src={SPLASH_LOGO_SRC}
            alt=""
            decoding="async"
            draggable="false"
          />
        </div>

        <div className="gati-splash__glint">
          <div className="gati-splash__glint-band" />
        </div>
      </div>
    </div>
  );
}
