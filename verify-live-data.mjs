#!/usr/bin/env node
/**
 * Live-data verification checklist, automated.
 *
 * WHAT THIS IS FOR: the Yahoo Finance fetch functions (netlify/functions/
 * market-data.js, quote.js) were written to match the documented/observed
 * shape of Yahoo's unofficial chart endpoint, but could never be exercised
 * against a live response while this project was built — that sandbox's
 * network egress didn't reach finance.yahoo.com. This script is what turns
 * "go verify it live" from an open-ended task into a fixed ~10-minute one:
 * start `netlify dev`, run this, read the report.
 *
 * USAGE:
 *   netlify dev                                    # in one terminal
 *   node scripts/verify-live-data.mjs               # in another
 *   node scripts/verify-live-data.mjs http://localhost:8888/.netlify/functions   # explicit base URL
 *
 * Exits 0 if every check passed, 1 otherwise (so it's CI-friendly too).
 * Also writes scripts/verify-live-data-results.json so results are
 * diffable over time — Yahoo's behavior here has no SLA and can change.
 *
 * WHAT EACH CHECK IS ACTUALLY FOR (read this before "fixing" a failure):
 *   1. baseline        — does the simple path work at all for an ordinary,
 *                         extremely liquid stock? If this fails, nothing
 *                         else matters until it's fixed.
 *   2-3. special chars  — M&M.NS and BAJAJ-AUTO.NS exercise URL-encoding of
 *                         tickers with & and - in them. A failure here
 *                         specifically (but not #1) points at encoding, not
 *                         at Yahoo access generally.
 *   4. derived ticker   — GVT&D.NS (GE Vernova T&D India) was derived from
 *                         a Screener.in URL slug during config research,
 *                         never independently confirmed against Yahoo
 *                         itself. This is the single highest-value check
 *                         to run before trusting the Midcap 150 config.
 *   5-7. benchmarks     — NIFTYBEES.NS / NIFTYMIDCAP150.NS / NIFTYSMLCAP250.NS
 *                         are index-level tickers, not ordinary equities —
 *                         confirms the chart endpoint actually serves them
 *                         (a live Yahoo *quote page* existing, which was
 *                         confirmed via web search, is not the same thing
 *                         as this programmatic endpoint serving them).
 *   8-9. partial history — LENSKART.NS / MEESHO.NS listed after the spec's
 *                         Jan 2025 data-start date. Confirms the function
 *                         returns whatever history *is* available instead
 *                         of erroring out — this is what lets the engine's
 *                         own MISSING_DATA flag do its job instead of the
 *                         fetch layer silently failing first.
 *   10. invalid symbol  — confirms a bad ticker produces a clean error
 *                         response, not a 500 or a malformed body that'd
 *                         crash the UI.
 *   11. quote endpoint  — separate function, separate check.
 *   12. cache headers   — confirms Cache-Control survives the round trip
 *                         (spec Section 4's "sensible refresh interval").
 *   13. burst probe     — fires several requests back-to-back and reports
 *                         (does not fail on) any 429s, since the real app
 *                         will eventually fetch ~450 symbols and this is
 *                         the first signal of whether that needs throttling.
 *
 * Every check also reports which `authTier` fired ("simple" or "crumb") —
 * that field settles the exact question this script exists to answer.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Base URL for the functions.
 *
 * These functions declare custom routes via `export const config = { path:
 * '/api/...' }`, so Netlify serves them at `/api/*` rather than the legacy
 * `/.netlify/functions/*`. Hardcoding the legacy path made every check fail
 * with a plain-text "Function not found", which is easy to mistake for a
 * data-provider problem when it is really a routing mismatch. The script now
 * probes both and uses whichever answers, so it can't misdiagnose itself.
 */
const CANDIDATE_BASES = ['http://localhost:8888/api', 'http://localhost:8888/.netlify/functions'];
let baseUrl = process.argv[2] ?? null;
const results = [];

async function resolveBaseUrl() {
  if (baseUrl) return baseUrl;
  for (const candidate of CANDIDATE_BASES) {
    try {
      const res = await fetch(`${candidate}/market-data?symbol=RELIANCE.NS&start=2025-01-01&end=2025-01-05`);
      const text = await res.clone().text();
      // A JSON body means a real function answered. Netlify's "Function not
      // found" is plain text, so anything unparseable means wrong door.
      try { JSON.parse(text); } catch { continue; }
      return candidate;
    } catch { /* server not up on that path; try the next */ }
  }
  return null;
}

function record(name, pass, detail) {
  results.push({ name, pass, detail: detail ?? null });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

const REQUIRED_RECORD_FIELDS = ['date', 'open', 'high', 'low', 'close', 'adjClose', 'volume'];

async function fetchMarketData(symbol, { start = '2025-01-01', end = '2025-01-31' } = {}) {
  const url = `${baseUrl}/market-data?symbol=${encodeURIComponent(symbol)}&start=${start}&end=${end}`;
  const res = await fetch(url);
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
}

async function checkBaselineSymbol(name, symbol) {
  try {
    const { status, body } = await fetchMarketData(symbol);
    if (status !== 200) return record(name, false, `HTTP ${status}: ${body?.error ?? 'no body'}`);
    if (!Array.isArray(body.records) || body.records.length === 0) {
      return record(name, false, 'records missing or empty');
    }
    const r0 = body.records[0];
    const missingField = REQUIRED_RECORD_FIELDS.find((f) => !(f in r0));
    if (missingField) return record(name, false, `record missing "${missingField}" field`);
    record(name, true, `${body.records.length} rows, authTier=${body.authTier}`);
  } catch (err) {
    record(name, false, `threw: ${err.message}`);
  }
}

async function checkPartialHistorySymbol(name, symbol) {
  // Same shape checks as baseline, but explicitly allows (doesn't require)
  // a shorter series than the requested window — that's the point of this check.
  try {
    const { status, body } = await fetchMarketData(symbol, { start: '2025-01-01', end: new Date().toISOString().slice(0, 10) });
    if (status !== 200) return record(name, false, `HTTP ${status}: ${body?.error ?? 'no body'}`);
    if (!Array.isArray(body.records)) return record(name, false, 'records is not an array');
    record(name, true, `${body.records.length} rows returned (partial history is expected and fine here), authTier=${body.authTier}`);
  } catch (err) {
    record(name, false, `threw: ${err.message}`);
  }
}

async function checkInvalidSymbol() {
  try {
    const { status, body } = await fetchMarketData('NOTAREALTICKERXYZ.NS');
    if (status >= 200 && status < 300 && Array.isArray(body?.records) && body.records.length > 0) {
      return record('10. invalid symbol handled cleanly', false, 'expected an error/empty result, got data');
    }
    // Guard against a false pass: if the endpoint is unreachable, EVERY
    // symbol looks "cleanly rejected". Only count this as a pass when the
    // function actually replied with a parseable body.
    if (body == null) {
      return record('10. invalid symbol handled cleanly', false, `HTTP ${status} with no JSON body — endpoint unreachable, not a real pass`);
    }
    record('10. invalid symbol handled cleanly', true, `HTTP ${status}, error: ${body?.error ?? '(empty records)'}`);
  } catch (err) {
    record('10. invalid symbol handled cleanly', false, `threw instead of returning a clean error: ${err.message}`);
  }
}

async function checkQuoteEndpoint() {
  const symbols = ['RELIANCE.NS', 'TCS.NS', 'NIFTYBEES.NS'];
  try {
    const res = await fetch(`${baseUrl}/quote?symbols=${symbols.join(',')}`);
    const body = await res.json();
    if (res.status !== 200) return record('quote endpoint', false, `HTTP ${res.status}: ${body?.error}`);
    const missing = symbols.filter((s) => !(s in (body.quotes ?? {})));
    if (missing.length > 0) return record('quote endpoint', false, `missing quotes for: ${missing.join(', ')}`);
    const priced = symbols.filter((s) => typeof body.quotes[s].price === 'number');
    // Report authTier here too. Omitting it hid a real fact for a whole
    // release: the quote endpoint (v7/finance/quote) 401s on a plain request
    // and runs on `crumb`, while market-data (v8/finance/chart) runs on
    // `simple`. Checks 1-9 all print `simple`, which made it look like the
    // crumb path had never fired anywhere. It fires on every quote.
    const qTier = body.quotes[symbols[0]]?.authTier ?? 'unknown';
    record('quote endpoint', priced.length === symbols.length, `${priced.length}/${symbols.length} symbols priced, ${body.batches} batch(es), authTier=${qTier}`);
  } catch (err) {
    record('quote endpoint', false, `threw: ${err.message}`);
  }
}

async function checkQuoteBatching() {
  // The whole point of the batching rewrite: confirm many symbols really
  // do come back from ONE call, and that the batch count is far below the
  // symbol count -- proving the endpoint is grouping requests rather than
  // silently issuing one upstream call per symbol.
  const symbols = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 'ITC.NS', 'LT.NS', 'SBIN.NS', 'WIPRO.NS', 'TITAN.NS'];
  try {
    const res = await fetch(`${baseUrl}/quote?symbols=${symbols.join(',')}`);
    const body = await res.json();
    if (res.status !== 200) return record('13. batching: many symbols in one call', false, `HTTP ${res.status}`);
    const priced = symbols.filter((s) => typeof body.quotes[s]?.price === 'number');
    const ok = priced.length === symbols.length && body.batches === 1;
    const tier = body.quotes[symbols[0]]?.authTier ?? 'unknown';
    record('13. batching: many symbols in one call', ok, `${priced.length}/${symbols.length} priced in ${body.batches} batch(es) (expected 1), authTier=${tier}`);
  } catch (err) {
    record('13. batching: many symbols in one call', false, `threw: ${err.message}`);
  }
}

async function checkCacheHeaders() {
  try {
    const { headers } = await fetchMarketData('RELIANCE.NS');
    const cacheControl = headers.get('cache-control');
    record('Cache-Control header present', !!cacheControl, cacheControl ?? '(missing)');
  } catch (err) {
    record('Cache-Control header present', false, `threw: ${err.message}`);
  }
}

async function checkBurstOfRequests() {
  const symbols = ['INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'ITC.NS', 'LT.NS', 'SBIN.NS', 'WIPRO.NS', 'TITAN.NS'];
  const started = Date.now();
  const outcomes = await Promise.all(
    symbols.map(async (s) => {
      try {
        const { status } = await fetchMarketData(s);
        return status;
      } catch {
        return 'threw';
      }
    }),
  );
  const elapsedMs = Date.now() - started;
  const rateLimited = outcomes.filter((s) => s === 429).length;
  const ok = outcomes.filter((s) => s === 200).length;
  // Informational — does not fail the run. This is the first real signal of
  // whether fetching a full ~450-symbol universe needs batching/throttling.
  record(
    'burst of 8 requests (informational, not pass/fail)',
    true,
    `${ok}/${symbols.length} ok, ${rateLimited} rate-limited, ${elapsedMs}ms elapsed`,
  );
}

async function main() {
  baseUrl = await resolveBaseUrl();

  if (!baseUrl) {
    console.error('Could not reach the functions on either known path:');
    for (const c of CANDIDATE_BASES) console.error(`  - ${c}`);
    console.error('\nIs `netlify dev` running in another terminal, and showing "Server now ready"?');
    console.error('If it runs on a different port, pass the base URL explicitly, e.g.:');
    console.error('  node scripts/verify-live-data.mjs http://localhost:9999/api');
    process.exit(1);
  }

  console.log(`Verifying live data against ${baseUrl}\n`);

  await checkBaselineSymbol('1. baseline: RELIANCE.NS', 'RELIANCE.NS');
  await checkBaselineSymbol('2. special char (&): M&M.NS', 'M&M.NS');
  await checkBaselineSymbol('3. special char (-): BAJAJ-AUTO.NS', 'BAJAJ-AUTO.NS');
  await checkBaselineSymbol('4. derived ticker (needs confirming): GVT&D.NS', 'GVT&D.NS');
  await checkBaselineSymbol('5. benchmark: NIFTYBEES.NS', 'NIFTYBEES.NS');
  await checkBaselineSymbol('6. benchmark: NIFTYMIDCAP150.NS', 'NIFTYMIDCAP150.NS');
  await checkBaselineSymbol('7. benchmark: NIFTYSMLCAP250.NS', 'NIFTYSMLCAP250.NS');
  await checkPartialHistorySymbol('8. partial history: LENSKART.NS', 'LENSKART.NS');
  await checkPartialHistorySymbol('9. partial history: MEESHO.NS', 'MEESHO.NS');
  await checkInvalidSymbol();
  await checkQuoteEndpoint();
  await checkQuoteBatching();
  await checkCacheHeaders();
  await checkBurstOfRequests();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-live-data-results.json');
  writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), baseUrl, results }, null, 2));
  console.log(`Full results written to ${outPath}`);

  if (failed.length > 0) {
    const failedNames = failed.map((f) => f.name);
    const hasFailure = (prefixes) => failedNames.some((n) => prefixes.some((p) => n.startsWith(p)));

    console.log('');
    if (hasFailure(['1.', '2.', '3.'])) {
      console.log('- Checks 1-3 failed: the fetch mechanism itself is broken — start there before looking at anything else.');
    }
    if (hasFailure(['4.'])) {
      console.log('- Check 4 failed: GVT&D.NS needs a different ticker — check screener.in/company/GVT&D manually and update universes.js.');
    }
    if (hasFailure(['5.', '6.', '7.'])) {
      console.log('- A benchmark check failed: comparisons for that universe will be broken even if stock data works — fix before trusting any backtest for it.');
    }
    if (hasFailure(['8.', '9.'])) {
      console.log('- A partial-history check failed: check normalizeChartResult() in market-data.js.');
    }
    if (hasFailure(['invalid symbol handled cleanly'])) {
      console.log('- Invalid-symbol handling failed: the function is throwing or returning malformed data for unknown tickers instead of a clean error.');
    }
    if (hasFailure(['quote endpoint'])) {
      console.log('- Quote endpoint failed: check netlify/functions/quote.js separately from market-data.js — they share the auth logic but not the parsing logic.');
    }
    process.exit(1);
  }
}

main();
