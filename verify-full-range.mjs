/**
 * Phase 1.4 — full-range fetch check.
 *
 * `verify-live-data.mjs` deliberately uses ~1-month windows (22 rows) so the
 * whole run stays fast. That leaves one thing unproven: whether Yahoo
 * truncates, caps or paginates a *long* range differently. That failure would
 * be silent — no error, just a short series — and a short series quietly
 * shortens every backtest, which is the worst failure shape this project has.
 *
 * This drives the REAL shipped handler (`netlify/functions/market-data.js`)
 * rather than a hand-rolled fetch, so what's verified is the code that ships.
 *
 * Usage:  node scripts/verify-full-range.mjs
 */

import handler from '../netlify/functions/market-data.js';
import { UNIVERSES, UNIVERSE_KEYS } from '../src/config/universes.js';

const START = '2025-01-01';
const END = new Date().toISOString().slice(0, 10);

// One liquid large cap, one mid, one small, plus all three benchmarks. The
// benchmarks matter most: a truncated benchmark series breaks an entire
// universe's RS calculation (spec Section 17), not just one row.
// Drawn from the live config rather than typed by hand. Hardcoding a ticker
// here once cost a spurious failure: TATAMOTORS.NS 404s because the 2025
// demerger retired it, which says nothing about long-range fetching. Indian
// tickers churn; the config is the thing that's kept current.
const SYMBOLS = [
  UNIVERSES.nifty50.stocks[0].symbol,
  UNIVERSES.midcap150.stocks[0].symbol,
  ...UNIVERSE_KEYS.map((k) => UNIVERSES[k].benchmark.symbol),
];

// ~252 trading days/year in India; Jan 2025 → Jul 2026 is ~19 months.
// Anything under this floor means something was cut off.
const MIN_EXPECTED_ROWS = 340;

async function call(symbol) {
  const url = `http://local/api/market-data?symbol=${encodeURIComponent(symbol)}&start=${START}&end=${END}`;
  const res = await handler(new Request(url));
  return { status: res.status, body: await res.json() };
}

function monthsCovered(records) {
  return new Set(records.map((r) => r.date.slice(0, 7))).size;
}

/** Any gap longer than this in a daily series suggests a dropped chunk. */
function largestGapDays(records) {
  let worst = 0;
  let at = null;
  for (let i = 1; i < records.length; i++) {
    const days = Math.round(
      (new Date(records[i].date) - new Date(records[i - 1].date)) / 86400000,
    );
    if (days > worst) {
      worst = days;
      at = `${records[i - 1].date} → ${records[i].date}`;
    }
  }
  return { worst, at };
}

console.log(`Full-range fetch check: ${START} → ${END}\n`);

let failures = 0;
const summary = [];

for (const symbol of SYMBOLS) {
  const { status, body } = await call(symbol);

  if (status !== 200) {
    console.log(`❌ ${symbol} — HTTP ${status}: ${body.error}`);
    failures++;
    continue;
  }

  const recs = body.records ?? [];
  const first = recs[0]?.date ?? '—';
  const last = recs.at(-1)?.date ?? '—';
  const gap = largestGapDays(recs);
  const problems = [];

  if (recs.length < MIN_EXPECTED_ROWS) {
    problems.push(`only ${recs.length} rows (expected ≥ ${MIN_EXPECTED_ROWS}) — possible truncation`);
  }
  // Jan 2 2025 was the first NSE session of the year; allow a few days' slack
  // for genuinely later listings, but flag a start that drifted far in.
  if (first > '2025-01-10') {
    problems.push(`series starts ${first}, not early Jan 2025 — possible front truncation`);
  }
  if (gap.worst > 12) {
    problems.push(`${gap.worst}-day gap at ${gap.at} — possible dropped chunk`);
  }
  // Every row must carry an adjusted close, since that's the basis every
  // return in this app is computed on (spec Section 6).
  const missingAdj = recs.filter((r) => r.adjClose == null).length;
  if (missingAdj > 0) problems.push(`${missingAdj} rows missing adjClose`);

  const ok = problems.length === 0;
  if (!ok) failures++;

  console.log(
    `${ok ? '✅' : '❌'} ${symbol.padEnd(20)} ${String(recs.length).padStart(4)} rows · ` +
      `${first} → ${last} · ${monthsCovered(recs)} months · ` +
      `max gap ${gap.worst}d · authTier=${body.authTier}`,
  );
  problems.forEach((p) => console.log(`      ↳ ${p}`));

  summary.push({ symbol, rows: recs.length, first, last, authTier: body.authTier, problems });
}

console.log(
  `\n${SYMBOLS.length - failures}/${SYMBOLS.length} symbols returned a complete, gap-free full-range series.`,
);

if (failures > 0) process.exitCode = 1;
