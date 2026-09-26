/**
 * THE BRAND MARK IN THE INTERFACE — size, squareness, sharpness.
 *
 * The mark is the one element on screen that is purely brand, so the two
 * ways it can be got wrong are both quiet: a non-square box stretches it,
 * and a source smaller than the rendered size at high DPR softens it. Both
 * look approximately fine in a screenshot at 1x.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const appBar = read('src/components/layout/AppBar.jsx');
const sidebar = read('src/components/layout/Sidebar.jsx');

/** PNG dimensions from the IHDR chunk — no image library needed. */
function pngSize(path) {
  const buffer = readFileSync(resolve(process.cwd(), path));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('the source asset', () => {
  const mark = pngSize('public/icons/gati-mark.png');

  it('is square, so no rendered box can distort it', () => {
    expect(mark.width).toBe(mark.height);
  });

  /**
   * The rail draws it at 40 CSS px. A phone or laptop at a 4x device pixel
   * ratio therefore asks for 160 device pixels; a 128px source — what
   * shipped before v1.4.0 — would be upscaled.
   */
  it('carries enough resolution for the largest render at 4x', () => {
    const LARGEST_RENDER_PX = 40;
    expect(mark.width).toBeGreaterThanOrEqual(LARGEST_RENDER_PX * 4);
  });
});

/*
  RETARGETED IN M14 (D18). The mark used to sit in a sticky per-screen app
  bar that compressed on scroll; it now sits in the sidebar, which is on
  every screen and does not move. So the two assertions about compression
  had no subject left.

  They are re-aimed rather than dropped, because what they were protecting
  is unchanged and still easy to get wrong quietly: the mark must stay
  SQUARE (a non-square box stretches it), must not be rounded harder than
  the artwork rounds itself (which shaves the gold rule off its edge), and
  must not carry objectFit (which crops it). All three still look
  approximately fine in a 1x screenshot, which is why they are pinned here
  rather than left to review.
*/
describe('where it is rendered', () => {
  it('is drawn square in the sidebar', () => {
    expect(sidebar).toMatch(/width=\{34\}/);
    expect(sidebar).toMatch(/height=\{34\}/);
  });

  it('never sets objectFit, which would imply a box it has to fit', () => {
    // A square source in a square box needs no fitting. `objectFit: cover`
    // here would silently crop the gold rule off the artwork's edge.
    const markBlock = sidebar.slice(sidebar.indexOf('gati-mark'));
    expect(markBlock.slice(0, 400)).not.toContain('objectFit');
  });

  it('rounds no harder than the artwork does', () => {
    // The artwork's own corner radius is 0.18 of its side. A larger CSS
    // radius shaves the gold rule that traces its edge — see docs/BRAND.md.
    expect(6 / 34).toBeLessThanOrEqual(0.18);
  });

  it('is not drawn a second time in the page head', () => {
    // The topbar names the screen and the sidebar carries the brand. A mark
    // in both put two logos on one viewport, which is how an app starts
    // looking like a template.
    expect(appBar).not.toContain('gati-mark');
  });
});
