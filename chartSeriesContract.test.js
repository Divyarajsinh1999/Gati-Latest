/**
 * THE CHART SERIES CONTRACT — every `dataKey` a chart asks for must be a key
 * its builder actually emits.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT WENT WRONG
 *
 * `buildDrawdownSeries` emits rows keyed `Drawdown`. `DrawdownChart` read
 * `dataKey="drawdown"`. Recharts renders NOTHING for a dataKey that is not
 * present in the data — no path, no axis ticks, no warning, no error. The
 * panel drew its title, its grid and its zero line, and stayed empty.
 *
 * It shipped. Measured in headless Chromium on /smallcap250/record: the
 * equity surface above it had two curves with 497- and 533-character path
 * data; the drawdown surface had a height of 140px, zero paths and zero
 * y-axis ticks.
 *
 * WHY NOTHING CAUGHT IT
 *   - `chartData.test.js` tests the builder in isolation and asserts on
 *     `r.Drawdown`. It passes, and it is right.
 *   - The chart's own test mounts it and asserts it does not throw. It
 *     passes, because an empty chart does not throw.
 *   - jsdom gives a ResponsiveContainer zero width, so nothing is drawn
 *     there even when the code is correct — a rendering assertion in jsdom
 *     could not tell the two cases apart.
 *
 * Two green tests either side of a broken join. This is the project's
 * recurring failure — everything reports success — and the fix is a test
 * that spans the seam rather than a better test on either end of it.
 *
 * WHY IT IS A SOURCE TEST
 * The defect is legible in the source: a literal in one file that has to
 * match a key produced in another. That is exactly what can be checked
 * cheaply and exactly, so it is checked here rather than inferred from
 * pixels.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildDrawdownSeries,
  buildMonthlyReturnsSeries,
} from '../../../utils/chartData.js';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

/** Every `dataKey="..."` literal in a chart file. */
function dataKeysIn(path) {
  return [...read(path).matchAll(/dataKey="([^"]+)"/g)].map((m) => m[1]);
}

/**
 * `date` is the x-axis key on every chart and is emitted by every builder;
 * listing it in each expectation below would add noise without adding cover.
 */
const X_AXIS_KEY = 'date';

describe('DrawdownChart', () => {
  const emitted = Object.keys(
    buildDrawdownSeries([
      { date: '2025-01-31', value: 100 },
      { date: '2025-02-28', value: 80 },
    ])[0],
  );

  it('asks only for keys the builder emits', () => {
    for (const key of dataKeysIn('src/components/charts/DrawdownChart.jsx')) {
      expect(emitted).toContain(key);
    }
  });

  it('still plots the series, not just the axes', () => {
    // The specific regression: the chart drew a grid and a zero line while
    // its one Area silently matched nothing.
    expect(dataKeysIn('src/components/charts/DrawdownChart.jsx'))
      .toContain('Drawdown');
  });

  it('the builder emits a capitalised key, which is the convention here', () => {
    // Recharts uses dataKey as the default series name in tooltips and
    // legends, so builders emit display-cased keys. Worth pinning: the
    // tempting "fix" for the bug above was to lowercase the builder, which
    // would have silently renamed the series everywhere it is labelled.
    expect(emitted).toContain('Drawdown');
    expect(emitted).not.toContain('drawdown');
  });
});

describe('MonthlyReturnsChart', () => {
  const emitted = Object.keys(
    buildMonthlyReturnsSeries([
      { exitDate: '2025-02-28', portfolioHoldingReturnPct: 4, benchmarkHoldingReturnPct: 2 },
    ])[0],
  );

  it('asks only for keys the builder emits', () => {
    for (const key of dataKeysIn('src/components/charts/MonthlyReturnsChart.jsx')) {
      expect(emitted).toContain(key);
    }
  });

  it('plots both series, so the comparison is not half a chart', () => {
    const keys = dataKeysIn('src/components/charts/MonthlyReturnsChart.jsx');
    expect(keys).toContain('Portfolio');
    expect(keys).toContain('Benchmark');
    expect(keys).toContain(X_AXIS_KEY);
  });
});
