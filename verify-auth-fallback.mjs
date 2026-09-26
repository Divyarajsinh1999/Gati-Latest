/**
 * Proves BOTH Yahoo auth tiers work — including the one that never fires.
 *
 * Live verification established that tier 1 (`simple`) always succeeds, which
 * is good news with a sting in it: the cookie+crumb fallback in
 * market-data.js / quote.js is now the only code path in the fetch layer that
 * never executes. It runs for the first time precisely when Yahoo has started
 * rejecting us — the worst possible moment to discover it's broken.
 *
 * This runs each function twice: once normally, once with FORCE_AUTH_TIER=crumb.
 *
 * Deliberately NOT mocked. A mock would prove the branch is reachable, which
 * was never in doubt. What's in doubt is whether Yahoo's handshake still
 * behaves the way the code assumes — and only Yahoo can answer that. (This
 * project has been bitten three times by green tests that proved internal
 * consistency rather than correctness; see HANDOFF.md.)
 *
 * Usage:  node scripts/verify-auth-fallback.mjs
 */

const SYMBOL = 'RELIANCE.NS';
const START = '2026-07-01';
const END = new Date().toISOString().slice(0, 10);

/** Re-imports a function module under a given FORCE_AUTH_TIER setting. */
async function withTier(tier, fn) {
  const previous = process.env.FORCE_AUTH_TIER;
  if (tier) process.env.FORCE_AUTH_TIER = tier;
  else delete process.env.FORCE_AUTH_TIER;
  try {
    // Cache-bust so the module re-reads env and starts with a cold auth cache.
    return await fn(`?t=${tier ?? 'default'}-${Date.now()}`);
  } finally {
    if (previous === undefined) delete process.env.FORCE_AUTH_TIER;
    else process.env.FORCE_AUTH_TIER = previous;
  }
}

async function checkMarketData(bust, expectedTier) {
  const mod = await import(`../netlify/functions/market-data.js${bust}`);
  const url = `http://local/api/market-data?symbol=${SYMBOL}&start=${START}&end=${END}`;
  const res = await mod.default(new Request(url));
  const body = await res.json();
  const rows = body.records?.length ?? 0;
  const ok = res.status === 200 && rows > 0 && body.authTier === expectedTier;
  console.log(
    `${ok ? '✅' : '❌'} market-data · expected authTier=${expectedTier.padEnd(6)} ` +
      `got=${String(body.authTier).padEnd(6)} · HTTP ${res.status} · ${rows} rows` +
      (body.error ? ` · ${body.error}` : ''),
  );
  return ok;
}

async function checkQuote(bust, expectedTier) {
  const mod = await import(`../netlify/functions/quote.js${bust}`);
  const url = `http://local/api/quote?symbols=${SYMBOL},TCS.NS,INFY.NS`;
  const res = await mod.default(new Request(url));
  const body = await res.json();
  // NOTE: `quotes` is an OBJECT keyed by symbol, not an array. Reading it as
  // an array is exactly the bug that made this check report 0/3 priced while
  // quote.js was in fact returning correct prices — a false alarm that cost
  // a session's investigation. Kept explicit here so it isn't reintroduced.
  const quotes = body.quotes ?? {};
  const list = Object.values(quotes);
  const priced = list.filter((q) => typeof q.price === 'number').length;
  const tier = list[0]?.authTier;
  const ok = res.status === 200 && priced === 3 && tier === expectedTier;
  console.log(
    `${ok ? '✅' : '❌'} quote       · expected authTier=${expectedTier.padEnd(6)} ` +
      `got=${String(tier).padEnd(6)} · HTTP ${res.status} · ${priced}/3 priced`,
  );
  return ok;
}

console.log('Verifying both Yahoo auth tiers against the live endpoint\n');

// IMPORTANT: the two endpoints do NOT behave the same way, and assuming they
// did was a real mistake in this project's record.
//   v8/finance/chart  (market-data.js) — plain request succeeds -> `simple`
//   v7/finance/quote  (quote.js)       — plain request 401s     -> `crumb`
// So `crumb` is the CORRECT expectation for quotes even with nothing forced.
// The fallback is not a dormant hedge; it carries every live price the
// dashboard shows.
console.log('Tier 1 — normal operation (no forcing):');
const t1 = [
  await withTier(null, (b) => checkMarketData(b, 'simple')),
  await withTier(null, (b) => checkQuote(b, 'crumb')),
];

console.log('\nTier 2 — fallback forced via FORCE_AUTH_TIER=crumb:');
const t2 = [
  await withTier('crumb', (b) => checkMarketData(b, 'crumb')),
  await withTier('crumb', (b) => checkQuote(b, 'crumb')),
];

const passed = [...t1, ...t2].filter(Boolean).length;
console.log(`\n${passed}/4 checks passed.`);

if (passed === 4) {
  console.log('Both auth paths are functional — the fallback is tested, not just written.');
} else {
  console.log(
    'A failing tier-2 check means the fallback would NOT save you if Yahoo tightened.\n' +
      'Check whether fc.yahoo.com still returns a set-cookie header (it answers 404\n' +
      'while doing so, which is expected) and whether /v1/test/getcrumb still issues a crumb.',
  );
  process.exitCode = 1;
}
