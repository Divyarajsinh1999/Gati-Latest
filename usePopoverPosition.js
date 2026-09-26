/**
 * POPOVER POSITION — a panel that is always fully on screen.
 *
 * WHAT THIS OWNS
 *   Turning a trigger's position into fixed coordinates for a panel, clamped
 *   to the visible viewport and to the device's safe areas.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS TO FIX
 *
 * The information panel was `position: absolute; left: 0; width: 300px`
 * inside a `position: relative` span. That anchors its LEFT edge to the icon
 * and lets it run 300px to the right — so an icon in the right-hand half of
 * a 390px phone put half the explanation past the edge of the document.
 * Worse than merely clipped: it widened the page, so the reader had to
 * scroll the whole interface sideways to finish a sentence, and the icons
 * that most needed explaining were the ones in right-aligned numeric
 * columns.
 *
 * `absolute` cannot solve this. The panel's position has to be computed
 * against the VIEWPORT, which means `fixed` and a measurement.
 *
 * THE RULES, IN ORDER
 *   1. The panel never exceeds the viewport width less its margins. On a
 *      narrow phone it simply becomes a full-width sheet.
 *   2. It is centred on the trigger, then slid horizontally until both edges
 *      are inside. Sliding preserves the connection to the icon; shrinking
 *      would make the text harder to read at exactly the size where it is
 *      already hardest.
 *   3. It opens below the trigger, unless there is more room above — a panel
 *      that would run off the bottom flips instead of scrolling the page.
 *   4. If it fits in neither direction it takes the taller side and scrolls
 *      ITSELF. The page never scrolls to accommodate it.
 *   5. Safe-area insets are subtracted first, so nothing lands under a notch,
 *      a home indicator or a rounded corner.
 *
 * `position: fixed` IS NOT ENOUGH ON ITS OWN.
 * A fixed element inside an ancestor with `transform`, `filter`, `perspective`
 * or `will-change` is positioned against THAT ANCESTOR, not the viewport —
 * and this app has transforms on hover-lift rows and route transitions. The
 * coordinates below are viewport coordinates, so the panel must be rendered
 * into `document.body` through a portal for them to mean what they say.
 * Measured: without the portal, a panel computed at top 281px rendered at
 * 505px and hung 212px below a 568px-tall screen.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useLayoutEffect, useCallback } from 'react';

/** Gap between the trigger and the panel. */
const OFFSET = 8;
/** Minimum breathing room at the viewport edge, on top of any safe area. */
const MARGIN = 12;
/** Below this the panel gives up on being a popover and fills the width. */
const PREFERRED_WIDTH = 320;

function safeAreaInsets() {
  if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => {
    const value = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(value) ? value : 0;
  };
  return {
    top: read('--safe-top'),
    right: read('--safe-right'),
    bottom: read('--safe-bottom'),
    left: read('--safe-left'),
  };
}

/**
 * @param {object} args
 * @param {React.RefObject<HTMLElement>} args.triggerRef
 * @param {boolean} args.open
 * @returns {{style: object, placement: 'below'|'above'}}
 */
export function usePopoverPosition({ triggerRef, open }) {
  const [position, setPosition] = useState({ style: { visibility: 'hidden' }, placement: 'below' });

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const inset = safeAreaInsets();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = inset.left + MARGIN;
    const right = viewportWidth - inset.right - MARGIN;
    const available = Math.max(0, right - left);

    // Rule 1 — never wider than the space there is.
    const width = Math.min(PREFERRED_WIDTH, available);

    // Rule 2 — centre on the trigger, then slide until both edges are inside.
    const centred = rect.left + rect.width / 2 - width / 2;
    const x = Math.max(left, Math.min(centred, right - width));

    // Rule 3 — below by default, above when there is more room there.
    const top = inset.top + MARGIN;
    const bottom = viewportHeight - inset.bottom - MARGIN;
    const spaceBelow = bottom - (rect.bottom + OFFSET);
    const spaceAbove = rect.top - OFFSET - top;
    const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;

    /**
     * Rule 4 — the panel scrolls ITSELF; the page never scrolls for it.
     *
     * The 120px floor is a readability minimum, and it can exceed the space
     * on the chosen side — on a short landscape phone with the icon near the
     * middle, both sides can be under 120. So the height is taken first and
     * the position is then CLAMPED to the viewport, rather than trusting that
     * the preferred side had room. Positioning always resolves to `top`,
     * because clamping two competing anchors is where this goes wrong.
     */
    const height = Math.max(120, Math.min(placeAbove ? spaceAbove : spaceBelow, bottom - top));
    const desiredTop = placeAbove ? rect.top - OFFSET - height : rect.bottom + OFFSET;
    const y = Math.max(top, Math.min(desiredTop, bottom - height));

    setPosition({
      placement: placeAbove ? 'above' : 'below',
      style: {
        position: 'fixed',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        maxHeight: Math.round(height),
        overflowY: 'auto',
      },
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    // Measured BEFORE paint, so the panel never appears at the wrong place
    // and jumps. A useEffect here produces one visibly misplaced frame.
    measure();

    // Any of these moves the trigger under the panel. `capture: true` catches
    // scrolls inside the table the icon lives in, not just the page.
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    // Rotating a phone changes the viewport after the resize event on some
    // browsers, so re-measure once the new dimensions have settled.
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('orientationchange', measure);
    };
  }, [open, measure]);

  return position;
}
