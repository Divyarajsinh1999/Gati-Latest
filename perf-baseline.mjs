/**
 * PERFORMANCE GATE — times the heavy derived pipeline against its budget.
 *
 * WHAT THIS OWNS
 *   Measuring how long a full backtest plus current-momentum pass takes for a
 *   50, 150 and 250-symbol universe, and failing the build when the budget is
 *   breached.
 *
 * WHAT THIS MUST NEVER DO
 *   Print a green tick without printing the numbers. This project's history
 *   contains "verified" claims that turned out to be false precisely because
 *   the verification summarised instead of showing its work. Every run prints
 *   the measured milliseconds.
 *
 * WHY SYNTHETIC DATA
 *   A gate that needs the network is a gate that gets skipped. The series are
 *   seeded and deterministic, so the same input is measured on every run and a
 *   change in the number means a change in the CODE.
 *
 * WHAT THIS IS NOT
 *   A benchmark of absolute speed on the user's device. It is a REGRESSION
 *   DETECTOR: the shape of the curve across 50 → 150 → 250 is more informative
 *   than any single figure, because super-linear growth means an accidental
 *   O(n²) — the exact trap of rebuilding the month-end index inside a ranking
 *   loop.
 *
 * Usage:  node scripts/perf-baseline.mjs [--json]
 */

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { deriveHeavy, deriveLight, deriveSizing } from '../src/compute/deriveUniverse.js';
import { makeUniverse } from '../tests/harness/syntheticSeries.js';

const budgets = JSON.parse(readFileSync(new URL('../perf-budgets.json', import.meta.url), 'utf8'));
const BUDGET_MS = budgets.compute.budgetMs;
const SIZES = budgets.compute.sizes;
const WARMUP = 2;
const RUNS = 7;
const asJson = process.argv.includes('--json');

/**
 * Measures the REAL unit of work: the full heavy derived pass, which is
 * backtest + ranking + RS history + change detection + snapshots. Timing only
 * the backtest would flatter the gate by leaving out everything M3 added.
 *
 * The light pass and the sizing pass are timed separately because they run on
 * completely different cadences — every 30-second quote tick, and every
 * keystroke in the Investment Simulator. Their budgets are one frame, not
 * 250ms, and folding them into one number would hide a regression in either.
 */
function timeOnce(universe) {
  const { stocks, priceSeriesMap, benchmarkSeries } = universe;

  const t0 = performance.now();
  const heavy = deriveHeavy({ stocks, priceSeriesMap, benchmarkSeries, universeKey: 'perf', lookbackMonths: 1 });
  const ms = performance.now() - t0;

  // Light pass: what a live quote tick actually costs.
  const quotes = new Map(stocks.map((s, i) => [s.symbol, { price: 100 + i, changePct: 1.5, volume: 1000 }]));
  const t1 = performance.now();
  deriveLight({ heavy, quotes });
  const lightMs = performance.now() - t1;

  // Sizing pass: what a keystroke in the Investment Simulator costs.
  const t2 = performance.now();
  deriveSizing({ derived: heavy, capital: 50_000 });
  const sizingMs = performance.now() - t2;

  const cycles = heavy?.backtest?.cycles?.length ?? 0;
  const ranked = heavy?.momentum?.ranked?.length ?? 0;

  // A timing harness that silently measures an early return is worse than no
  // harness: it reports a fast, meaningless number and hides a regression.
  // Both passes must have actually done work.
  if (cycles === 0 || ranked === 0) {
    throw new Error(
      `Perf harness measured no work (cycles=${cycles}, ranked=${ranked}). ` +
        `The engine returned early — check the fixture, not the timing.`,
    );
  }

  return { ms, lightMs, sizingMs, cycles, ranked };
}

const results = [];

for (const count of SIZES) {
  const universe = makeUniverse({ count, seed: 1337 });
  for (let i = 0; i < WARMUP; i++) timeOnce(universe);

  const samples = [];
  const lightSamples = [];
  const sizingSamples = [];
  let meta = null;
  for (let i = 0; i < RUNS; i++) {
    const r = timeOnce(universe);
    samples.push(r.ms);
    lightSamples.push(r.lightMs);
    sizingSamples.push(r.sizingMs);
    meta = r;
  }

  samples.sort((a, b) => a - b);
  // GATE ON THE MINIMUM, not the median.
  //
  // This harness runs on shared CI hardware where another job's load shows up
  // directly in wall-clock time. Measured during M2: the UNCHANGED pre-M1
  // source varied between 128 ms and 350 ms for the same 250-symbol workload
  // depending only on machine contention — a 2.7x spread with zero code
  // difference. A median-based gate on that signal fails builds at random,
  // and a gate that fails at random is a gate people learn to re-run.
  //
  // The minimum of several runs is the least-contended sample, and it is the
  // standard estimator for CPU-bound micro-benchmarks for exactly this
  // reason. It does not weaken the gate: it is a lower bound, so if even the
  // best run is over budget, the code genuinely is too slow.
  const best = samples[0];
  const median = samples[Math.floor(samples.length / 2)];
  results.push({
    symbols: count,
    bestMs: round1(best),
    medianMs: round1(median),
    worstMs: round1(samples[samples.length - 1]),
    rebalanceCycles: meta.cycles,
    rankedRows: meta.ranked,
    // Two decimals: these are sub-millisecond by design, and rounding them
    // to whole milliseconds would print "0ms" and say nothing.
    lightMs: round2(Math.min(...lightSamples)),
    sizingMs: round2(Math.min(...sizingSamples)),
    budgetMs: BUDGET_MS,
    pass: best <= BUDGET_MS,
  });
}

if (asJson) {
  console.log(JSON.stringify({ budgetMs: BUDGET_MS, results }, null, 2));
} else {
  console.log('');
  console.log('  HEAVY PASS — backtest + ranking + RS history + changes + snapshots');
  console.log(`  budget ${BUDGET_MS}ms · gated on BEST of ${RUNS} runs after ${WARMUP} warmup`);
  console.log(`  (best, not median — shared CI hardware adds up to 2.7x noise; see source)`);
  console.log('  ' + '─'.repeat(66));
  console.log('  symbols   best      median   worst    light    sizing   verdict');
  console.log('  ' + '─'.repeat(66));
  for (const r of results) {
    console.log(
      '  ' +
        String(r.symbols).padEnd(9) +
        `${r.bestMs}ms`.padEnd(10) +
        `${r.medianMs}ms`.padEnd(9) +
        `${r.worstMs}ms`.padEnd(9) +
        `${r.lightMs}ms`.padEnd(9) +
        `${r.sizingMs}ms`.padEnd(9) +
        (r.pass ? 'PASS' : 'FAIL'),
    );
  }
  console.log('  ' + '─'.repeat(66));

  // Scaling check: 250 symbols is 5x the work of 50. Materially worse than
  // linear points at an accidental quadratic, which is the failure this
  // measurement exists to catch early.
  const small = results.find((r) => r.symbols === SIZES[0]);
  const large = results.find((r) => r.symbols === SIZES[SIZES.length - 1]);
  if (small && large && small.bestMs > 0) {
    const sizeRatio = large.symbols / small.symbols;
    const timeRatio = large.bestMs / small.bestMs;
    const shape = timeRatio > sizeRatio * 1.6 ? 'SUPER-LINEAR — investigate' : 'linear or better';
    console.log(`  scaling: ${sizeRatio}x symbols → ${timeRatio.toFixed(2)}x time  (${shape})`);
  }
  // The split is the point: a quote tick and a keystroke must both cost far
  // less than one frame, or the app stutters twice a minute and while typing.
  const worstLight = Math.max(...results.map((r) => r.lightMs));
  const worstSizing = Math.max(...results.map((r) => r.sizingMs));
  console.log(`  light pass (quote tick) worst: ${worstLight}ms   sizing (keystroke) worst: ${worstSizing}ms   [16ms = one frame]`);
  console.log('');
}

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(
    `  PERFORMANCE BUDGET BREACHED for ${failed.map((f) => `${f.symbols} symbols`).join(', ')}.\n` +
      `  Escalation path is the Web Worker compute implementation, not a budget increase.\n`,
  );
  process.exit(1);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
