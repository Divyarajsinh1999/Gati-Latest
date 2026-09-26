/**
 * Validates every ticker in src/config against live Yahoo Finance.
 *
 * WHY THIS MATTERS MORE THAN IT SOUNDS:
 * The Midcap 150 and Smallcap 250 lists came from a third-party mirror, not
 * NSE's own CSV (`provenance: 'third-party-mirror'`). Until now nothing had
 * ever confirmed those 400 tickers are real, correctly spelled, and still
 * quoted. Indian tickers change more than most: demergers rename them
 * (Tata Motors, 2025), suffixes shift, and a delisted name simply 404s.
 *
 * A wrong ticker does NOT announce itself. It silently drops a stock from the
 * universe, which changes which stocks can reach the Top 5 — a financial
 * accuracy defect (spec Sections 40/41), not a cosmetic one.
 *
 * Uses a SHORT window per symbol: this is a "does this ticker resolve and
 * quote" check, not a history check. Concurrency is deliberately modest and
 * matches the app's own historical-fetch cap.
 *
 * Usage:  node scripts/verify-constituent-symbols.mjs
 */

import handler from '../netlify/functions/market-data.js';
import { UNIVERSES, UNIVERSE_KEYS } from '../src/config/universes.js';

const CONCURRENCY = 6; // matches the app's historical-fetch cap
const START = '2026-06-01';
const END = new Date().toISOString().slice(0, 10);
const MIN_ROWS = 5; // a live ticker over ~2 months should comfortably clear this

async function checkSymbol(symbol) {
  const url = `http://local/api/market-data?symbol=${encodeURIComponent(symbol)}&start=${START}&end=${END}`;
  try {
    const res = await handler(new Request(url));
    const body = await res.json();
    if (res.status !== 200) return { symbol, ok: false, reason: body.error ?? `HTTP ${res.status}` };
    const rows = body.records?.length ?? 0;
    if (rows < MIN_ROWS) return { symbol, ok: false, reason: `only ${rows} rows — thin or stale listing` };
    const last = body.records.at(-1);
    return { symbol, ok: true, rows, last: last.date, close: last.close, authTier: body.authTier };
  } catch (err) {
    return { symbol, ok: false, reason: String(err.message ?? err) };
  }
}

/** Order-preserving bounded-concurrency map — same shape as the app's own. */
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
  targets.push({ symbol: u.benchmark.symbol, universe: key, kind: 'benchmark', name: u.benchmark.label });
  for (const s of u.stocks) targets.push({ symbol: s.symbol, universe: key, kind: 'stock', name: s.name });
}

console.log(`Validating ${targets.length} configured symbols against live Yahoo Finance`);
console.log(`Window ${START} → ${END} · concurrency ${CONCURRENCY}\n`);

const t0 = Date.now();
let done = 0;
const results = await mapWithConcurrency(targets, CONCURRENCY, async (t) => {
  const r = await checkSymbol(t.symbol);
  done++;
  if (done % 50 === 0) process.stdout.write(`  …${done}/${targets.length}\n`);
  return { ...t, ...r };
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

const failed = results.filter((r) => !r.ok);
const tiers = new Set(results.filter((r) => r.ok).map((r) => r.authTier));

console.log(`\nCompleted in ${elapsed}s · authTier(s) observed: ${[...tiers].join(', ') || 'none'}\n`);

for (const key of UNIVERSE_KEYS) {
  const inUniverse = results.filter((r) => r.universe === key);
  const bad = inUniverse.filter((r) => !r.ok);
  const icon = bad.length === 0 ? '✅' : '❌';
  console.log(
    `${icon} ${UNIVERSES[key].label.padEnd(14)} ${inUniverse.length - bad.length}/${inUniverse.length} resolved`,
  );
  for (const b of bad) {
    console.log(`      ↳ ${b.kind === 'benchmark' ? 'BENCHMARK ' : ''}${b.symbol} (${b.name}) — ${b.reason}`);
  }
}

console.log(
  `\n${results.length - failed.length}/${results.length} symbols resolved against live Yahoo Finance.`,
);

if (failed.length) {
  console.log(
    `\n${failed.length} symbol(s) need attention. A ticker that does not resolve is silently\n` +
      `excluded from its universe, which changes which stocks can reach the Top 5.`,
  );
  process.exitCode = 1;
}
