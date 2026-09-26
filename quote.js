/**
 * GET /api/quote?symbols=RELIANCE.NS,TCS.NS,NIFTYBEES.NS,...
 *
 * BATCHED — this is the important part. Yahoo's v7 quote endpoint accepts
 * MANY symbols in one request (`?symbols=A,B,C,...`), confirmed working
 * with .NS tickers specifically. An earlier version of this function called
 * v8/finance/chart once PER symbol, so a full 453-symbol universe refresh
 * meant 453 separate requests — a fast route to getting rate-limited or
 * IP-blocked on a free, unofficial endpoint with no published quota.
 *
 * Now: the client makes ONE call to this function with all the symbols it
 * needs, and this function internally groups them into chunks of
 * BATCH_SIZE and issues one Yahoo request per chunk — 453 symbols becomes
 * roughly 10 upstream requests instead of 453. The `fields` parameter also
 * trims the response to only what the app actually uses, which matters at
 * this volume.
 *
 * Same two-tier auth strategy as market-data.js: try a plain request first,
 * only perform the cookie+crumb handshake if Yahoo actually rejects it. See
 * that file for the full reasoning.
 *
 * VERIFIED LIVE (31 Jul 2026): tier 1 (`simple`) succeeds, and batching was
 * confirmed against real Yahoo — 10 symbols priced in a single request, as
 * designed. Tier 2 was separately confirmed functional. Set
 * FORCE_AUTH_TIER=crumb to exercise the fallback deliberately rather than
 * discovering its condition during an outage.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Symbols per upstream request. Yahoo's endpoint doesn't publish a documented
 * cap; 50 keeps the URL comfortably short (NSE tickers run ~10-15 chars with
 * the .NS suffix, so 50 of them is well under typical proxy/URL length
 * limits) while still cutting request count by ~50x.
 */
const BATCH_SIZE = 50;

const FIELDS = [
  'regularMarketPrice',
  'regularMarketChange',
  'regularMarketChangePercent',
  'regularMarketTime',
  'regularMarketVolume',
  'previousClose',
  'marketState',
  'shortName',
].join(',');

let cachedAuth = null;
const AUTH_TTL_MS = 55 * 60 * 1000;

async function getAuth() {
  if (cachedAuth && Date.now() - cachedAuth.fetchedAt < AUTH_TTL_MS) return cachedAuth;
  const cookieRes = await fetch('https://fc.yahoo.com', { redirect: 'manual' });
  const setCookie = cookieRes.headers.get('set-cookie');
  if (!setCookie) throw new Error('Yahoo auth handshake failed: no set-cookie header');
  const cookie = setCookie.split(';')[0];
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { Cookie: cookie, 'User-Agent': USER_AGENT },
  });
  if (!crumbRes.ok) throw new Error(`getcrumb returned ${crumbRes.status}`);
  const crumb = (await crumbRes.text()).trim();
  cachedAuth = { cookie, crumb, fetchedAt: Date.now() };
  return cachedAuth;
}

function buildUrl(symbols, crumb) {
  const url = new URL('https://query1.finance.yahoo.com/v7/finance/quote');
  url.searchParams.set('symbols', symbols.join(','));
  url.searchParams.set('fields', FIELDS);
  if (crumb) url.searchParams.set('crumb', crumb);
  return url;
}

function toQuote(entry) {
  const price = entry.regularMarketPrice ?? null;
  const prevClose = entry.previousClose ?? null;
  return {
    symbol: entry.symbol,
    price,
    changePct: entry.regularMarketChangePercent ?? (price != null && prevClose ? ((price / prevClose - 1) * 100) : null),
    asOf: entry.regularMarketTime ? new Date(entry.regularMarketTime * 1000).toISOString() : null,
    volume: entry.regularMarketVolume ?? null,
    isStale: entry.marketState ? entry.marketState !== 'REGULAR' : null,
    name: entry.shortName ?? null,
  };
}

/** One batch of up to BATCH_SIZE symbols, in a single Yahoo request. */
async function fetchBatch(symbols) {
  // See market-data.js — lets the fallback be exercised on purpose rather
  // than only during an incident.
  const forceCrumb = process.env.FORCE_AUTH_TIER === 'crumb';

  let res;
  let authTier;

  if (forceCrumb) {
    const auth = await getAuth();
    res = await fetch(buildUrl(symbols, auth.crumb), { headers: { Cookie: auth.cookie, 'User-Agent': USER_AGENT } });
    authTier = 'crumb';
  } else {
    res = await fetch(buildUrl(symbols, null), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    authTier = 'simple';
  }

  if (res.status === 401 || res.status === 403) {
    const auth = await getAuth();
    res = await fetch(buildUrl(symbols, auth.crumb), { headers: { Cookie: auth.cookie, 'User-Agent': USER_AGENT } });
    authTier = 'crumb';
  }

  if (!res.ok) {
    return symbols.map((s) => ({ symbol: s, error: `status ${res.status}`, authTier }));
  }

  const body = await res.json();
  const results = body.quoteResponse?.result ?? [];
  const bySymbol = new Map(results.map((r) => [r.symbol, r]));

  return symbols.map((s) => {
    const entry = bySymbol.get(s);
    if (!entry) return { symbol: s, error: 'not found', authTier };
    return { ...toQuote(entry), authTier };
  });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get('symbols');
  if (!symbolsParam) {
    return Response.json({ error: 'symbols query param is required (comma-separated)' }, { status: 400 });
  }
  const symbols = [...new Set(symbolsParam.split(',').map((s) => s.trim()).filter(Boolean))];

  try {
    const batches = chunk(symbols, BATCH_SIZE);
    // Batches run concurrently (there are only ~10 of them even at full
    // universe scale), which is a world apart from the old one-request-
    // per-symbol fan-out this replaces.
    const results = (await Promise.all(batches.map(fetchBatch))).flat();

    const quotes = {};
    for (const r of results) quotes[r.symbol] = r;
    const failed = results.filter((r) => r.error).length;

    return Response.json(
      { quotes, requested: symbols.length, batches: batches.length, failed },
      { headers: { 'Cache-Control': 'public, max-age=30' } },
    );
  } catch (err) {
    return Response.json({ error: String(err.message ?? err) }, { status: 500 });
  }
};

export const config = { path: '/api/quote' };
