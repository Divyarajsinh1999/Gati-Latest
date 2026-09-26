/**
 * BROWSER QA SWEEP — the gate jsdom cannot be.
 *
 * Drives the built site in headless Chromium across every screen and every
 * viewport, and checks the four things that have actually broken in this
 * project rather than a generic checklist:
 *
 *   1. AXE VIOLATIONS — serious and critical, zero tolerated.
 *   2. HORIZONTAL OVERFLOW — a table or a tape wider than the viewport
 *      produces a page that scrolls sideways on a phone.
 *   3. TOUCH TARGETS — anything interactive under 44x44 CSS px.
 *   4. CONTENT CLIPPED AT THE BOTTOM — the last element must not sit under
 *      the home indicator.
 *
 * WHY A SCRIPT AND NOT A VITEST FILE
 * jsdom has no layout engine: every geometric assertion above is meaningless
 * there, and it has missed several real faults in this project — the
 * ResponsiveContainer that draws nothing at zero width, the fixed popup
 * captured by a transformed ancestor, the nav bar covering the last card.
 * These have to be measured in a browser or not claimed at all.
 *
 * Usage: node scripts/browser-qa.mjs [baseUrl]
 */

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.argv[2] ?? 'http://localhost:4181';
const CHROME = process.env.CHROMIUM_PATH ?? undefined;

/**
 * ═════════════════════════════════════════════════════════════════════════
 * IS THIS SCREEN ACTUALLY POPULATED, OR IS IT AN ERROR STATE?
 *
 * THE GATE HOLE THIS CLOSES (v1.6.5 pre-release audit).
 *
 * This script checks whatever is sitting in `dist/`. `npm run build` builds
 * with the YAHOO provider, and in any environment without live market access
 * — CI, a container, a laptop offline — every data screen then renders its
 * error state. Measured during the audit, against a plain production build:
 *
 *   /nifty50                 0 rows   0 info icons   0 charts   error state
 *   /nifty50/all             0 rows   0 info icons   0 charts   error state
 *   /nifty50/record          0 rows   0 info icons   0 charts   error state
 *   /nifty50/stock/WIPRO.NS  0 rows   0 info icons   0 charts   error state
 *
 * Against a mock build the same routes carry 50 table rows, 42 info icons
 * and 5 charts between them. So "44/44 PASS, no axe violations, no overflow"
 * was, on those runs, a statement about four empty pages. Every table,
 * tooltip, chart and long-label overflow risk went unchecked while the gate
 * reported success.
 *
 * That is this project's oldest failure mode — a check that reports nothing
 * wrong because it never ran on anything. So the gate now REFUSES to pass on
 * an empty screen: each data route declares what must be present, and a
 * missing marker is a hard failure rather than a quiet zero.
 *
 * `npm run qa:browser` builds with the mock provider itself (see
 * package.json) so the run is deterministic and never depends on which build
 * happened to be sitting in dist/.
 * ═════════════════════════════════════════════════════════════════════════
 */
const EXPECTED_CONTENT = {
  '/nifty50': { infoTips: 6, charts: 1 },
  '/midcap150': { infoTips: 6, charts: 1 },
  '/smallcap250': { infoTips: 6, charts: 1 },
  '/nifty50/all': { rows: 10, infoTips: 5 },
  '/nifty50/record': { infoTips: 5, charts: 1 },
  '/nifty50/stock/WIPRO.NS': { infoTips: 5, charts: 1 },
};

async function contentShortfall(page, route) {
  const expected = EXPECTED_CONTENT[route];
  if (!expected) return null;

  const actual = await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr').length,
    infoTips: document.querySelectorAll('button[aria-label^="About "]').length,
    charts: document.querySelectorAll('svg.recharts-surface').length,
  }));

  const missing = Object.entries(expected)
    .filter(([key, min]) => actual[key] < min)
    .map(([key, min]) => `${key} ${actual[key]}<${min}`);

  return missing.length > 0 ? missing.join(', ') : null;
}

/**
 * Block until the route has rendered what it is declared to contain.
 *
 * Generous timeout, because the point is to stop measuring a skeleton — not
 * to police load time, which the perf gate owns. If the content never
 * arrives, this returns quietly and `contentShortfall` reports it as the
 * failure it is, with the actual counts.
 */
async function waitForContent(page, route) {
  const expected = EXPECTED_CONTENT[route];
  if (!expected) {
    // Static screens have nothing to wait for; a short settle is enough for
    // fonts and layout to stop moving.
    await page.waitForTimeout(1200);
    return;
  }
  try {
    await page.waitForFunction(
      (want) =>
        document.querySelectorAll('tbody tr').length >= (want.rows ?? 0) &&
        document.querySelectorAll('button[aria-label^="About "]').length >= (want.infoTips ?? 0) &&
        document.querySelectorAll('svg.recharts-surface').length >= (want.charts ?? 0),
      expected,
      { timeout: 30000 },
    );
  } catch {
    // Fall through — the shortfall check reports what is actually missing.
  }
  // Charts animate in; let the last frame settle before measuring overflow.
  await page.waitForTimeout(900);
}

const ROUTES = [
  ['/nifty50', 'Dashboard'],
  ['/midcap150', 'Dashboard (mid)'],
  ['/smallcap250', 'Dashboard (small)'],
  ['/nifty50/all', 'Live Rankings'],
  ['/nifty50/record', 'Strategy Record'],
  /*
    STOCK DETAIL, ADDED IN THE v1.6.5 PRE-RELEASE AUDIT.

    It was outside this gate from the day it was written — never once checked
    for accessibility violations, horizontal overflow or undersized touch
    targets at any viewport. It is not an obscure corner: every row of the
    ranking table links to it, so it is one tap from the primary screen, and
    it carries a chart, a comparison card and two metric grids. It had also
    just been modified (v1.6.3) with no visual gate covering the change.

    The symbol is hard-coded because the gate runs against the mock provider,
    whose NIFTY 50 universe always contains it.
  */
  ['/nifty50/stock/WIPRO.NS', 'Stock Detail'],
  ['/strategies', 'Strategies'],
  ['/portfolio', 'My Portfolio'],
  ['/reports', 'Reports'],
  ['/paper-log', 'Paper log'],
  ['/how-it-works', 'How it works'],
  // Two more that existed and were never covered.
  ['/methodology', 'Methodology'],
  ['/about', 'About'],
  ['/settings', 'Settings'],
];

const VIEWPORTS = [
  ['phone', { width: 390, height: 844 }],
  ['phone-small', { width: 320, height: 568 }],
  ['tablet', { width: 768, height: 1024 }],
  ['desktop', { width: 1440, height: 900 }],
];

/**
 * Interactive elements below the touch-target floor.
 *
 * TWO THRESHOLDS, AND THE DISTINCTION IS NOT PEDANTRY.
 *   24px is WCAG 2.2 SC 2.5.8, level AA — a real conformance failure.
 *   44px is SC 2.5.5, level AAA, and the comfort target this project has
 *   used for primary controls.
 *
 * The first version of this script failed the build at 44 and reported forty
 * failing combinations, most of which were the sidebar's 42px rows and a
 * scroll container that is not a target at all. A gate that always fails
 * teaches you to stop reading it. Under 24 fails; 24–43 is reported so it
 * can be judged.
 *
 * EXCLUDED, deliberately: the skip link (visually hidden until focused, and
 * full width when it appears) and elements whose only interactive quality is
 * a tabindex for keyboard SCROLLING — a scrollable region is not a tap
 * target, and flagging it hides the ones that are.
 */
async function smallTargets(page) {
  return page.evaluate(() => {
    const FAIL_UNDER = 24;
    const WARN_UNDER = 44;
    const selector = 'a, button, [role="button"], input, select';
    const out = { failing: [], warning: [] };
    for (const el of document.querySelectorAll(selector)) {
      if (el.classList.contains('gati-skip-link')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      let r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;

      /*
        A VISUALLY-HIDDEN INPUT IS NOT THE TARGET — ITS LABEL IS.

        The theme control is three radios clipped to 1x1 with a styled label
        over each. That is the correct accessible pattern, not a defect: the
        real input keeps the semantics and the keyboard behaviour while the
        label takes the tap. Measuring the input reported three 1x1 failures
        on every Settings render and said nothing true about what a finger
        has to hit. Measure the label instead.
      */
      if (style.clipPath?.includes('inset(50%)') || style.position === 'absolute' && r.width <= 1) {
        const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
        if (!label) continue;
        r = label.getBoundingClientRect();
      }

      const smallest = Math.min(r.width, r.height);
      if (smallest >= WARN_UNDER) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 28);
      const entry = `${label} ${Math.round(r.width)}x${Math.round(r.height)}`;
      (smallest < FAIL_UNDER ? out.failing : out.warning).push(entry);
    }
    return out;
  });
}

/*
  The server lives in THIS repository (scripts/serve-dist.mjs).

  It used to be `/home/claude/serve.mjs` — an untracked scratch file in a
  home directory — so this gate ran on exactly one machine and failed with
  ERR_CONNECTION_REFUSED on every other. A quality gate with a dependency
  nobody can check out is worse than no gate: it appears in package.json and
  implies a coverage that was never happening.
*/
const server = spawn('node', [new URL('serve-dist.mjs', import.meta.url).pathname], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2000));

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
let failures = 0;
const rows = [];

for (const [vpName, viewport] of VIEWPORTS) {
  // A context, not browser.newPage() — axe-core injects into every frame of
  // a context and refuses to run against a bare page.
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  for (const [route, label] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });

    /*
      WAIT FOR THE CONTENT, NOT FOR A GUESS AT HOW LONG IT TAKES.

      This was a flat 2200ms. Measured during the v1.6.5 audit, time to
      content is 2.5s for NIFTY 50, 3.3s for Midcap 150 and 4.5s for
      Smallcap 250 — so the small-cap dashboard was ALWAYS still on its
      loading skeleton when every check ran against it. With the checks
      being "no axe violations" and "no overflow", a skeleton passed them
      all, on every viewport, every run.

      Now the gate waits for what the route is declared to contain and only
      then measures. A route with no declaration keeps a short settle pause.
    */
    await waitForContent(page, route);

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact));

    const overflow = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));

    const targets = await smallTargets(page);

    // An empty screen passes every other check trivially — see
    // EXPECTED_CONTENT. A shortfall is fatal, not a warning.
    const shortfall = await contentShortfall(page, route);

    // Warnings (24-43px targets) are printed, not fatal.
    const bad = serious.length > 0 || overflow > 0 || targets.failing.length > 0 || shortfall != null;
    if (bad) failures += 1;

    rows.push({
      viewport: vpName,
      route: label,
      axe: serious.length,
      overflowPx: overflow,
      failing: targets.failing,
      warning: targets.warning,
      shortfall,
      axeIds: serious.map((v) => `${v.id}(${v.nodes.length})`),
    });
  }

  await context.close();
}

await browser.close();
server.kill();

console.log('\n  BROWSER QA — %d combinations\n', rows.length);
console.log(`  ${'viewport'.padEnd(13)}${'route'.padEnd(24)}${'axe'.padEnd(6)}${'overflow'.padEnd(10)}under-44 targets`);
console.log('  ' + '-'.repeat(94));
for (const r of rows) {
  const flag = r.axe || r.overflowPx || r.failing.length || r.shortfall ? '!' : ' ';
  console.log(`${flag} ${r.viewport.padEnd(13)}${r.route.padEnd(24)}${String(r.axe || '-').padEnd(6)}${(r.overflowPx ? `${r.overflowPx}px` : '-').padEnd(10)}${r.failing.length ? `FAIL ${r.failing.join(' | ')}` : (r.warning.length ? r.warning.join(' | ') : '-')}`);
  if (r.axeIds.length) console.log('      %s', r.axeIds.join(', '));
  if (r.shortfall) console.log('      EMPTY SCREEN — %s', r.shortfall);
}
console.log('  ' + '-'.repeat(94));
console.log('  %s\n', failures === 0 ? 'PASS — screens populated, no serious axe violations, no overflow, no sub-24px targets' : `FAIL — ${failures} combination(s)`);
process.exit(failures === 0 ? 0 : 1);
