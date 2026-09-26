/**
 * BOTTOM CLEARANCE — guarded at the source, because a browser test would not
 * have caught how this broke.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * RETARGETED IN M14 (D18), NOT RETIRED.
 *
 * The bottom bar is gone — navigation is a sidebar that becomes a drawer.
 * So the thing being cleared changed, and it would have been easy to delete
 * this file on the grounds that the bar it guarded no longer exists.
 *
 * Two reasons not to. First, the home indicator did not go anywhere: content
 * flush with the bottom of a notched phone still ends underneath it, so
 * clearance is still required — only its source moved from a bar height to
 * the safe-area inset. Second, the actual fault this pins is not about
 * navigation at all. It is an inline `padding` SHORTHAND silently beating a
 * class, which can recur on any element anyone styles inline.
 *
 * `<main>` now carries no inline style whatsoever, which retires the fault
 * at source rather than guarding against it — and the assertions below say
 * exactly that, so if a style object ever comes back, this fails.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT WENT WRONG
 *
 * `<main>` carried `className="pb-24"` for clearance AND an inline
 * `style={{ padding: '0 16px' }}`. A `padding` SHORTHAND sets all four
 * sides, so it reset padding-bottom to zero, and an inline style beats a
 * class. The comment above it described reserved space that was not
 * reserved.
 *
 * Measured across ten routes at 390x844: computed padding-bottom was 0px on
 * every one, and the last element of every screen sat under the bar.
 *
 * WHY A SOURCE TEST. jsdom loads no stylesheet, so it cannot compute the
 * cascade that produced the bug; and in a real browser the fault is a few
 * pixels of a card behind a translucent bar — visible only if you scroll to
 * the bottom of the right route and look. The defect is legible in the
 * source, so that is where it is pinned.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const shell = read('src/components/layout/AppShell.jsx');
const css = read('src/index.css');

/** Everything declared on <main>, up to its content. */
const mainStyle = shell.slice(shell.indexOf('id="main"'), shell.indexOf('<Outlet'));

describe('the main content region', () => {
  it('reserves clearance through the shared class', () => {
    expect(mainStyle).toContain('gati-content');
  });

  /**
   * The exact fault. A shorthand anywhere in this style object silently
   * zeroes the bottom padding again.
   */
  it('never uses a `padding` shorthand, which would zero the bottom again', () => {
    expect(mainStyle).not.toMatch(/\bpadding:\s/);
  });

  it('carries no inline style at all, so there is nothing to beat the class', () => {
    expect(mainStyle).not.toMatch(/style=\{\{/);
  });

  it('sets no inline paddingBottom that would beat the class', () => {
    expect(mainStyle).not.toMatch(/paddingBottom:/);
  });
});

describe('the clearance itself', () => {
  it('exists as a class in the stylesheet', () => {
    expect(css).toContain('.gati-content');
  });

  /**
   * Derived, not a magic number. `pb-24` was 96px against a 56px bar — it
   * happened to be enough, which is why nobody questioned it, and it would
   * have silently become too little the moment the bar grew.
   */
  it('is derived from the safe-area inset, not a literal', () => {
    const block = css.slice(css.indexOf('.gati-content'));
    const rule = block.slice(0, block.indexOf('}'));
    expect(rule).toContain('var(--safe-bottom)');
    // Longhand only. A shorthand here would be legal CSS and would also make
    // the derived bottom trivially droppable in a later edit.
    expect(rule).toMatch(/padding-bottom:/);
  });

  it('clears the home indicator as well as the bar', () => {
    // On a device with a home indicator the bar sits 34px higher than its
    // own height suggests. Reserving only the bar leaves content under it.
    expect(css).toMatch(/--safe-bottom:\s*env\(safe-area-inset-bottom/);
  });

  it('still clears the home indicator on the narrow layout', () => {
    // The drawer breakpoint restyles .gati-content. Clearance must survive
    // that override — this is the exact shape of edit that dropped it before.
    const narrow = css.slice(css.indexOf('@media (max-width: 760px)'));
    const rule = narrow.slice(narrow.indexOf('.gati-content'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('var(--safe-bottom)');
  });
});

/*
  THE BOTTOM BAR ITSELF.

  `components/layout/Navigation.jsx` is no longer imported by anything in the
  application — M14 replaced it with the sidebar. It is RETAINED rather than
  deleted, because the owner chose the full reference shell with the hybrid
  (bottom nav on mobile) option in front of them, and reverting that choice
  should be an import rather than a rewrite.

  Its own tests still pass, which is the dangerous part: this project has
  been bitten three times by a module that was fully tested and never wired,
  and every time the tests reported success. So the assertions below are not
  about the bar's height any more — they PIN THE FACT THAT IT IS UNWIRED, in
  the same spirit as D16's compute layer. If someone imports it again, this
  fails and they are forced to come and read why.
*/
describe('the retired bottom bar', () => {
  const shellSource = read('src/components/layout/AppShell.jsx');

  it('is not imported by the shell', () => {
    expect(shellSource).not.toContain('Navigation.jsx');
    expect(shellSource).not.toMatch(/\bBottomNav\b/);
  });

  it('still declares its height as a property, so a revert is one import', () => {
    const nav = read('src/components/layout/Navigation.jsx');
    expect(css).toMatch(/--gati-bottom-nav:\s*\d+px/);
    expect(nav).toContain('var(--gati-bottom-nav)');
    expect(nav).toContain('safe-area-inset-bottom');
  });
});
