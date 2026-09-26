/**
 * Phase 2.3 — corporate-action spot check (see ROADMAP.md).
 *
 * Finds a real stock among the app's 453 configured symbols that had a
 * split (or bonus, which Yahoo also reports via the same `splits` event)
 * since Jan 2025, then confirms the app's adjusted-close convention
 * produces a SANE return across it — this is the assumption spec Section 6
 * ("prefer adjusted prices... do not silently mix conventions") is most
 * likely to be quietly wrong about with real data, per ROADMAP.md.
 *
 * Deliberately a standalone script hitting Yahoo directly with
 * `events=split`, rather than reusing netlify/functions/market-data.js —
 * that function only ever requests `events=history` (it has no reason to
 * ask for split events; the app always uses adjClose, which already bakes
 * splits in). Modifying production code to add a query mode it doesn't
 * need would be the wrong kind of change for a one-off verification.
 *
 * Usage:  node scripts/verify-split-adjustment.mjs
 */

import { UNIVERSES, UNIVERSE_KEYS } from '../src/config/universes.js';
import { getMonthEndRecords } from '../src/engine/tradingCalendar.js';
import { computeStockRS } from '../src/engine/momentum.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const START = '2025-01-01';
const END = new Date().toISOString().slice(0, 10);
const SCAN_CONCURRENCY = 8;

function toUnixSeconds(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
}

/** Coarse monthly-interval scan just to find WHETHER a split happened — cheap per symbol. */
async function scanForSplits(symbol) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set('period1', String(toUnixSeconds(START)));
  url.searchParams.set('period2', String(toUnixSeconds(END)));
  url.searchParams.set('interval', '1mo');
  url.searchParams.set('events', 'split');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) return { symbol, ok: false, reason: `HTTP ${res.status}` };
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result) return { symbol, ok: false, reason: body?.chart?.error?.description ?? 'no result' };
  const splits = Object.values(result.events?.splits ?? {});
  return { symbol, ok: true, splits };
}

/** Full daily history (close + adjclose) once a candidate is found. */
async function fetchDaily(symbol) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set('period1', String(toUnixSeconds(START)));
  url.searchParams.set('period2', String(toUnixSeconds(END)));
  url.searchParams.set('interval', '1d');
  url.searchParams.set('events', 'history');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  const body = await res.json();
  const result = body.chart.result[0];
  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const adjcloses = result.indicators.adjclose?.[0]?.adjclose ?? closes;
  return timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    close: closes[i],
    adjClose: adjcloses[i],
  })).filter((r) => r.close != null);
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const targets = [];
for (const key of UNIVERSE_KEYS) {
  const u = UNIVERSES[key];
  for (const s of u.stocks) targets.push({ symbol: s.symbol, universe: key, name: s.name });
}

console.log(`Scanning ${targets.length} configured symbols for a split since ${START} (concurrency ${SCAN_CONCURRENCY})...\n`);

const t0 = Date.now();
const scanned = await mapWithConcurrency(targets, SCAN_CONCURRENCY, (t) => scanForSplits(t.symbol));
console.log(`Scan complete in ${((Date.now() - t0) / 1000).toFixed(1)}s.\n`);

const errors = scanned.filter((r) => !r.ok);
if (errors.length) {
  console.log(`${errors.length} symbol(s) failed to scan (not fatal — reporting and continuing):`);
  for (const e of errors.slice(0, 10)) console.log(`  ↳ ${e.symbol}: ${e.reason}`);
  if (errors.length > 10) console.log(`  ↳ ...and ${errors.length - 10} more`);
  console.log('');
}

const withSplits = scanned.filter((r) => r.ok && r.splits.length > 0);
console.log(`${withSplits.length} symbol(s) had a split/bonus event on record since ${START}:\n`);
for (const w of withSplits) {
  const t = targets.find((x) => x.symbol === w.symbol);
  for (const s of w.splits) {
    console.log(`  ${w.symbol} (${t.universe}) — ${s.date} · ratio ${s.numerator}:${s.denominator} (${s.splitRatio})`);
  }
}

if (withSplits.length === 0) {
  console.log('\nNo split found across any configured symbol in this window. Nothing further to spot-check —');
  console.log('the adjusted-close path remains verified only on synthetic/inferred cases, not a live one.');
  process.exit(0);
}

// Spot-check the FIRST one found in full, using the app's OWN functions —
// getMonthEndRecords and computeStockRS — against live data, not a
// reimplementation of the return math. Also fetches the matching
// benchmark over the same window, since RS needs both (spec Section 9).
const candidate = withSplits[0];
const candidateTarget = targets.find((t) => t.symbol === candidate.symbol);
const candidateSplit = candidate.splits[0];
const splitDateISO = new Date(candidateSplit.date * 1000).toISOString().slice(0, 10);
console.log(`\n--- Spot-checking ${candidate.symbol} (${candidateTarget.universe}), split on ${splitDateISO} ---\n`);

const benchmarkSymbol = UNIVERSES[candidateTarget.universe].benchmark.symbol;
const [stockDaily, benchmarkDaily] = await Promise.all([fetchDaily(candidate.symbol), fetchDaily(benchmarkSymbol)]);
console.log(`Fetched ${stockDaily.length} daily bars for ${candidate.symbol}, ${stockDaily[0]?.date} → ${stockDaily.at(-1)?.date}.`);
console.log(`Fetched ${benchmarkDaily.length} daily bars for benchmark ${benchmarkSymbol}.`);

const stockMonthEnds = getMonthEndRecords(stockDaily);
const benchmarkMonthEnds = getMonthEndRecords(benchmarkDaily);
const splitMonthKey = splitDateISO.slice(0, 7);
const splitIdx = stockMonthEnds.findIndex((m) => m.monthKey === splitMonthKey);

if (splitIdx <= 0) {
  console.log(`Split month ${splitMonthKey} has no prior month-end in range for ${candidate.symbol} — can't compute a straddling return.`);
  process.exit(0);
}

const previousRecord = stockMonthEnds[splitIdx - 1];
const currentRecord = stockMonthEnds[splitIdx];
const previousBenchmark = benchmarkMonthEnds.find((m) => m.monthKey === previousRecord.monthKey);
const currentBenchmark = benchmarkMonthEnds.find((m) => m.monthKey === currentRecord.monthKey);

console.log(`\nMonth-end straddling the split: ${previousRecord.monthKey} (${previousRecord.date}) → ${currentRecord.monthKey} (${currentRecord.date})`);
console.log(`  raw close:  ${previousRecord.close.toFixed(2)} → ${currentRecord.close.toFixed(2)}`);
console.log(`  adjClose:   ${previousRecord.adjClose.toFixed(2)} → ${currentRecord.adjClose.toFixed(2)}`);

// 1. THE ACTUAL APP FUNCTION, on the real data exactly as Yahoo returned it.
const real = computeStockRS({ currentRecord, previousRecord, currentBenchmark, previousBenchmark });
console.log(`\n[computeStockRS on real Yahoo data]`);
console.log(`  stockReturnPct: ${real.stockReturnPct?.toFixed(2)}%  benchmarkReturnPct: ${real.benchmarkReturnPct?.toFixed(2)}%  RS: ${real.rs?.toFixed(2)}pp`);
console.log(`  flags: ${real.flags.length ? real.flags.join(', ') : '(none)'}`);

const realIsSane = real.stockReturnPct != null && Math.abs(real.stockReturnPct) < 50 && real.flags.length === 0;
console.log(
  realIsSane
    ? `  ✅ Sane, unflagged return across a real split — confirms Yahoo's own 'close'/'adjClose' fields are ALREADY split-consistent\n     for this ticker (no artificial cliff to guard against here specifically).`
    : `  ⚠️ Either an extreme return or a data-quality flag was raised — needs a closer look.`,
);

// 2. THE DANGEROUS SCENARIO THE v0.14.2 FIX GUARDS AGAINST, reconstructed
// from this SAME real split: what if adjClose had been missing on just the
// earlier bar (a genuine Yahoo gap this project has seen before), forcing
// a fallback to `close` for that one record while the later record still
// uses `adjClose`? This is the actual failure mode assertSameConvention
// exists for — simulated here on real prices rather than synthetic ones,
// to show the guard still catches it live-data-shaped.
const previousRecordMissingAdj = { ...previousRecord, adjClose: null };
const mixed = computeStockRS({ currentRecord, previousRecord: previousRecordMissingAdj, currentBenchmark, previousBenchmark });
console.log(`\n[computeStockRS with adjClose missing on the earlier bar — the v0.14.2 danger scenario]`);
console.log(`  stockReturnPct: ${mixed.stockReturnPct ?? 'null'}  RS: ${mixed.rs ?? 'null'}`);
console.log(`  flags: ${mixed.flags.join(', ')}`);
const guardHolds = mixed.stockReturnPct === null && mixed.flags.some((f) => /mixing|convention/i.test(f) || /cannot compare/i.test(f));
console.log(
  guardHolds
    ? `  ✅ Refused to produce a number rather than silently mixing bases — assertSameConvention still holds on live-shaped data.`
    : `  ⚠️ Expected a refusal here; got a computed value instead. This would need investigating before Phase 2.3 could be called closed.`,
);

console.log(`\nPhase 2.3 spot-check: ${realIsSane && guardHolds ? 'PASSED' : 'NEEDS ATTENTION'} (${candidate.symbol}, ${splitDateISO}, ${candidateSplit.splitRatio} split).`);
