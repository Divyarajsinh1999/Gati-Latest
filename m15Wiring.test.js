/**
 * EVERY M15 ADDITION IS ACTUALLY REACHABLE.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THIS PROJECT'S CHARACTERISTIC FAILURE IS A MODULE THAT PASSES EVERY TEST
 * AND IS NEVER IMPORTED.
 *
 * It has happened repeatedly: a compute layer nothing called, a brand mark
 * pointing at a file that did not exist, a drawdown chart whose dataKey
 * matched nothing, an UnknownRoute the router never reached. Each time the
 * unit tests were green, because unit tests verify the piece and the fault
 * lives in the join.
 *
 * It happened again during M15 itself. `assessPortfolioLiquidity` was wired
 * into `selectSizing` — which computes a whole-portfolio allocation that NO
 * SCREEN RENDERS, because v1.4.0 moved investment onto the stock. The call
 * was correct, tested, and dead. Caught by grepping for consumers, not by the
 * suite.
 *
 * So this file asserts reachability rather than behaviour: every engine
 * module added in M15 must be imported by a selector or hook, and every
 * selector must be read by a screen. It is a cheap test that would have
 * caught four historical bugs.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();

/** Every non-test source file, as text. */
function sourceFiles(dir = resolve(ROOT, 'src'), out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__') continue;
      sourceFiles(full, out);
      continue;
    }
    if (!/\.(js|jsx)$/.test(name)) continue;
    out.push({ path: full.slice(ROOT.length + 1), text: readFileSync(full, 'utf8') });
  }
  return out;
}

const FILES = sourceFiles();

/** Files that reference `name`, excluding the file that declares it. */
const consumersOf = (name, declaredIn) =>
  FILES.filter((f) => f.path !== declaredIn && f.text.includes(name));

describe('M15 engine modules are imported by a real consumer', () => {
  const cases = [
    ['applyTax', 'src/engine/tax.js'],
    ['calculateUnderwaterDuration', 'src/engine/metrics.js'],
    ['assessLiquidity', 'src/engine/liquidity.js'],
  ];

  it.each(cases)('%s is used outside its own module', (name, declaredIn) => {
    expect(consumersOf(name, declaredIn).length).toBeGreaterThan(0);
  });
});

describe('M15 selector output is read by a screen', () => {
  /*
    The specific failure this catches: a selector field that is computed,
    returned, tested, and never rendered. `sizing` is the cautionary example
    — it is still computed and still reaches no screen, which is why nothing
    new was attached to it.
  */
  /*
    ASSERTED ON THE DATA FLOW, NOT ON THE WORD.

    The first version of this checked whether the screen's text contained the
    field name. It passed with the feature deliberately unwired, because
    `sectorConcentration` also appears in an `InfoTip term=` attribute — a
    glossary reference, not a wiring. A guard that passes for the wrong reason
    is worse than none, since it certifies the exact thing it cannot see.

    Each pattern below matches the value actually being READ from the view or
    summary object, which is what "reachable" means.
  */
  const cases = [
    ['sectorConcentration', 'src/screens/universe/UniverseScreen.jsx', /view\.sectorConcentration/],
    ['rebalanceActions', 'src/screens/portfolio/PortfolioScreen.jsx', /actions=\{rebalanceActions\}/],
    ['afterTax', 'src/screens/record/StrategyRecordScreen.jsx', /afterTax=\{view\.afterTax\}/],
    ['underwaterDuration', 'src/selectors/recordView.js', /calculateUnderwaterDuration\(/],
    ['liquidity', 'src/screens/stock/InvestmentCard.jsx', /summary\.liquidity/],
  ];

  it.each(cases)('%s is read, not merely mentioned, in %s', (field, screen, pattern) => {
    const file = FILES.find((f) => f.path === screen);
    expect(file, `${screen} not found`).toBeTruthy();
    expect(file.text).toMatch(pattern);
  });
});

describe('the paper log is reachable', () => {
  const routes = FILES.find((f) => f.path === 'src/config/routes.js').text;
  const app = FILES.find((f) => f.path === 'src/App.jsx').text;

  it('has a route', () => {
    expect(app).toContain('/paper-log');
    expect(app).toContain('PaperLogScreen');
  });

  it('has a sidebar destination', () => {
    // A screen with a route and no way to reach it is the same bug wearing a
    // different hat.
    expect(routes).toContain("path: '/paper-log'");
  });

  it('is a known top-level path, so a mistyped URL does not blank the page', () => {
    expect(routes).toContain("'paper-log'");
  });
});

describe('nothing new was attached to the unwired sizing selector', () => {
  it('selectSizing gained no liquidity call', () => {
    /*
      `selectSizing` computes a whole-portfolio allocation that no screen
      renders — pre-existing, and left alone rather than deleted in case the
      owner wants it back. But nothing new may be hung off it: work added
      there is dead on arrival, which is exactly what happened once in P6.
    */
    const universeView = FILES.find((f) => f.path === 'src/selectors/universeView.js').text;
    const sizing = universeView.slice(universeView.indexOf('function selectSizing'));
    expect(sizing).not.toContain('assessPortfolioLiquidity');
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 * THE SAME GUARD, EXTENDED TO THE v1.6.1 CUSTOMISATIONS.
 *
 * Four of the five owner requests added a value in one layer that only
 * means anything if another layer reads it. That is precisely the shape of
 * join this file exists to watch, and each would fail silently: the
 * selector would compute correctly, its unit test would pass, and the
 * screen would render as though the feature had never been asked for.
 * ═══════════════════════════════════════════════════════════════════════
 */
describe('v1.6.1 selector output is read by a screen', () => {
  const cases = [
    // The Dashboard equity curve — both legs, plus the universe key that
    // colours the line, which is easy to omit and fails invisibly by
    // falling back to gold on all three universes.
    ['equityCurve', 'src/screens/universe/UniverseScreen.jsx', /equityCurve=\{performance\.equityCurve\}/],
    ['benchmarkCurve', 'src/screens/universe/UniverseScreen.jsx', /benchmarkCurve=\{performance\.benchmarkCurve\}/],
    ['universe accent', 'src/screens/universe/UniverseScreen.jsx', /universeKey=\{universeKey\}/],
    // The live-or-close note behind the Price info button.
    ['priceNote', 'src/screens/ranking/FullRankingScreen.jsx', /priceNote=\{view\.priceNote\}/],
    // The prior month-end date beside the figure it qualifies.
    ['priorMonthEndDateLabel', 'src/components/data/StockTable.jsx', /row\.priorMonthEndDateLabel/],
  ];

  it.each(cases)('%s is read, not merely computed, in %s', (field, screen, pattern) => {
    const file = FILES.find((f) => f.path === screen);
    expect(file, `${screen} not found`).toBeTruthy();
    expect(file.text).toMatch(pattern);
  });

  it('the benchmark curve is built in exactly one place', () => {
    /*
      It was duplicated the moment the Dashboard wanted the same chart. Two
      compounding loops is two chances to disagree about what the benchmark
      did, and the disagreement would surface as the record and the
      Dashboard quietly showing different numbers for one month — not as a
      failing test.
    */
    const definitions = FILES.filter((f) => /function buildIndexedBenchmarkCurve/.test(f.text));
    expect(definitions.map((f) => f.path)).toEqual(['src/utils/chartData.js']);
  });

  it('the stale-price flag is emitted, not just defined', () => {
    /*
      `DATA_QUALITY_FLAGS.STALE_PRICE` sat in constants.js from the first
      version to v1.6.0 without a single emitter — declared, exported, and
      describing a condition nothing ever detected. The engine now raises it.
    */
    const emitters = FILES.filter(
      (f) => f.path !== 'src/config/constants.js' && f.text.includes('STALE_PRICE'),
    );
    expect(emitters.map((f) => f.path)).toContain('src/engine/currentMomentum.js');
  });
});
