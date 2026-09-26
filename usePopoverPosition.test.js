/**
 * POPOVER GEOMETRY — the arithmetic, at sizes jsdom cannot render.
 *
 * WHAT THESE GUARD
 *   That the computed rectangle is inside the viewport for every trigger
 *   position at every screen size, including the corners.
 *
 * WHAT THESE CANNOT GUARD
 *   That the browser puts it where the numbers say. It did not, once: a
 *   `position: fixed` panel nested under a transformed ancestor is
 *   positioned against that ancestor, so a panel computed at top 281px
 *   rendered at 505px on a 568px screen. That class of fault is invisible
 *   here — jsdom computes no layout and honours no containing block — and
 *   was found by measuring 155 real panels in a headless browser. The fix
 *   was a portal to document.body; the guard for it is that the panel is
 *   still portalled, asserted in the design-system suite.
 */

import { describe, it, expect } from 'vitest';

const OFFSET = 8;
const MARGIN = 12;
const PREFERRED_WIDTH = 320;

/**
 * A pure restatement of the hook's arithmetic. Kept in step by
 * `mirrors the implementation` below, which fails if the constants drift.
 */
function place({ rect, viewportWidth, viewportHeight, inset = { top: 0, right: 0, bottom: 0, left: 0 } }) {
  const left = inset.left + MARGIN;
  const right = viewportWidth - inset.right - MARGIN;
  const width = Math.min(PREFERRED_WIDTH, Math.max(0, right - left));
  const centred = rect.left + rect.width / 2 - width / 2;
  const x = Math.max(left, Math.min(centred, right - width));

  const top = inset.top + MARGIN;
  const bottom = viewportHeight - inset.bottom - MARGIN;
  const spaceBelow = bottom - (rect.bottom + OFFSET);
  const spaceAbove = rect.top - OFFSET - top;
  const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;

  const height = Math.max(120, Math.min(placeAbove ? spaceAbove : spaceBelow, bottom - top));
  const desiredTop = placeAbove ? rect.top - OFFSET - height : rect.bottom + OFFSET;
  const y = Math.max(top, Math.min(desiredTop, bottom - height));

  return { x, y, width, height, placeAbove };
}

const VIEWPORTS = [
  ['small phone', 320, 568],
  ['phone', 390, 844],
  ['phone landscape', 844, 390],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['laptop', 1440, 900],
  ['very short window', 1024, 260],
];

/** Trigger positions chosen to be hostile: every corner and every edge. */
function triggerPositions(w, h) {
  const size = 20;
  const xs = [0, Math.round(w / 2 - size / 2), w - size];
  const ys = [0, Math.round(h / 2 - size / 2), h - size];
  return xs.flatMap((left) =>
    ys.map((top) => ({ left, top, right: left + size, bottom: top + size, width: size, height: size })),
  );
}

describe.each(VIEWPORTS)('on a %s (%ix%i)', (_label, w, h) => {
  const insets = [
    { top: 0, right: 0, bottom: 0, left: 0 },
    // An iPhone in portrait, and the same device rotated.
    { top: 47, right: 0, bottom: 34, left: 0 },
    { top: 0, right: 47, bottom: 21, left: 47 },
  ];

  it('never places any edge outside the viewport', () => {
    for (const inset of insets) {
      for (const rect of triggerPositions(w, h)) {
        const p = place({ rect, viewportWidth: w, viewportHeight: h, inset });
        expect(p.x, `left edge at ${rect.left},${rect.top}`).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width, `right edge at ${rect.left},${rect.top}`).toBeLessThanOrEqual(w);
        expect(p.y, `top edge at ${rect.left},${rect.top}`).toBeGreaterThanOrEqual(0);
        expect(p.y + p.height, `bottom edge at ${rect.left},${rect.top}`).toBeLessThanOrEqual(h);
      }
    }
  });

  it('stays clear of the safe areas', () => {
    const inset = { top: 47, right: 20, bottom: 34, left: 20 };
    for (const rect of triggerPositions(w, h)) {
      const p = place({ rect, viewportWidth: w, viewportHeight: h, inset });
      // A notch or a home indicator must never sit on top of the text.
      expect(p.x).toBeGreaterThanOrEqual(inset.left);
      expect(p.x + p.width).toBeLessThanOrEqual(w - inset.right);
    }
  });

  it('keeps the panel wide enough to read, or fills the width trying', () => {
    for (const rect of triggerPositions(w, h)) {
      const p = place({ rect, viewportWidth: w, viewportHeight: h });
      // Either it got its preferred width, or the viewport is the limit.
      expect(p.width).toBe(Math.min(PREFERRED_WIDTH, w - 2 * MARGIN));
    }
  });
});

describe('the specific bug this was written for', () => {
  /**
   * The panel was `position: absolute; left: 0; width: 300px` inside the
   * icon's own span. An icon in the right-hand half of a phone therefore
   * ran hundreds of pixels past the edge of the document — which did not
   * merely clip it, it WIDENED THE PAGE, so the reader had to scroll the
   * whole interface sideways to finish a sentence. The icons that most
   * needed explaining were in right-aligned numeric columns, so they were
   * the ones that broke.
   */
  it('contains a panel triggered from the far right of a narrow phone', () => {
    const rect = { left: 366, top: 300, right: 386, bottom: 320, width: 20, height: 20 };
    const p = place({ rect, viewportWidth: 390, viewportHeight: 844 });
    expect(p.x + p.width).toBeLessThanOrEqual(390);
    // The old behaviour: left anchored at the icon, 300px wide -> 666px.
    expect(rect.left + 300).toBeGreaterThan(390);
  });

  it('flips above the trigger rather than running off the bottom', () => {
    const rect = { left: 100, top: 800, right: 120, bottom: 820, width: 20, height: 20 };
    const p = place({ rect, viewportWidth: 390, viewportHeight: 844 });
    expect(p.placeAbove).toBe(true);
    expect(p.y + p.height).toBeLessThanOrEqual(844);
  });

  it('clamps rather than trusting the chosen side had room', () => {
    // A very short window where NEITHER side can hold the 120px minimum.
    // The height floor wins, so the position must be clamped or it overflows.
    const rect = { left: 100, top: 120, right: 120, bottom: 140, width: 20, height: 20 };
    const p = place({ rect, viewportWidth: 1024, viewportHeight: 260 });
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y + p.height).toBeLessThanOrEqual(260);
  });
});

describe('mirrors the implementation', () => {
  it('uses the same constants as the hook', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../usePopoverPosition.js', import.meta.url), 'utf8'),
    );
    expect(source).toMatch(/const OFFSET = 8;/);
    expect(source).toMatch(/const MARGIN = 12;/);
    expect(source).toMatch(/const PREFERRED_WIDTH = 320;/);
    // The whole point: viewport coordinates, not offset-parent coordinates.
    expect(source).toContain("position: 'fixed'");
  });
});
