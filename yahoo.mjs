/**
 * SHARED YAHOO HELPERS for the serverless functions.
 *
 * WHAT THIS OWNS
 *   Symbol validation, request chunking, response normalisation, and the
 *   two-tier auth handshake — the parts `history.js` and the deprecated
 *   `market-data.js` alias both need.
 *
 * WHAT THIS MUST NEVER DO
 *   Calculate anything financial. This layer answers "where do numbers come
 *   from", never "what do they mean". It normalises shapes and nothing else.
 *
 * WHY THE PURE PARTS ARE EXPORTED SEPARATELY
 *   The build environment has no network route to Yahoo, so the fetching path
 *   cannot be exercised in CI. Validation, chunking and normalisation CAN be,
 *   and they are where the bugs actually live — a malformed symbol reaching
 *   an upstream URL, a chunk boundary dropping the last symbol, a null close
 *   becoming a zero price. Those are unit-tested; the fetch wrapper around
 *   them is deliberately thin.
 *
 * TWO-TIER AUTH — why this isn't one fetch
 *   Evidence on whether Yahoo's chart endpoint requires a cookie+crumb
 *   handshake is genuinely conflicting and differently dated: some sources
 *   show a plain request succeeding for .NS tickers, others show 401s. Both
 *   are plausible, because the anti-bot posture varies by endpoint, by IP
 *   reputation, and over time. So: try the cheap path, pay for the handshake
 *   only if actually rejected. Correct either way, cheaper in the common case.
 *
 *   Verified live 31 Jul 2026: tier 1 succeeded for all 453 configured
 *   tickers; tier 2 was separately confirmed functional. Set
 *   FORCE_AUTH_TIER=crumb to exercise the fallback deliberately — a fallback
 *   that only ever runs during an outage is a fallback nobody has tested.
 */

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Symbols per client request. Phase 4 caps this at 40: it keeps the URL well
 * under proxy limits (NSE tickers run ~10-15 chars) while turning a 251-
 * invocation cold load for Smallcap 250 into 8.
 */
export const MAX_SYMBOLS_PER_REQUEST = 40;

/**
 * Concurrent upstream requests per invocation. Yahoo's chart endpoint is
 * single-symbol, so a batch of 40 still means 40 upstream calls — but from
 * ONE function instance, sequenced, rather than 40 cold starts hammering in
 * parallel. 6 matches the client-side concurrency this replaces.
 */
export const UPSTREAM_CONCURRENCY = 6;

/* ------------------------------------------------------------------ */
/* PURE: validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * NSE/BSE-style ticker. Deliberately strict.
 *
 * This is not cosmetic. Without it the proxy will fetch any string a caller
 * supplies on their behalf, which turns a private data endpoint into an open
 * relay. Letters, digits, dot, hyphen and ampersand only (M&M.NS is real),
 * 1-20 characters.
 */
const SYMBOL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.\-&]{0,19}$/;

export function isValidSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_PATTERN.test(symbol);
}

/** ISO calendar date, `YYYY-MM-DD`, that is also a real date. */
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Parse and validate a `symbols` query param.
 * @returns {{ ok: true, symbols: string[] } | { ok: false, error: string }}
 */
export function parseSymbolsParam(raw) {
  if (!raw) return { ok: false, error: 'symbols query param is required (comma-separated)' };

  const symbols = [...new Set(String(raw).split(',').map((s) => s.trim()).filter(Boolean))];
  if (symbols.length === 0) return { ok: false, error: 'symbols query param contained no usable symbols' };

  if (symbols.length > MAX_SYMBOLS_PER_REQUEST) {
    return {
      ok: false,
      error: `too many symbols: ${symbols.length} (max ${MAX_SYMBOLS_PER_REQUEST} per request)`,
    };
  }

  const invalid = symbols.filter((s) => !isValidSymbol(s));
  if (invalid.length > 0) {
    return { ok: false, error: `invalid symbol format: ${invalid.slice(0, 3).join(', ')}` };
  }

  return { ok: true, symbols };
}

/* ------------------------------------------------------------------ */
/* PURE: chunking + normalisation                                      */
/* ------------------------------------------------------------------ */

/** Split an array into fixed-size chunks. Never drops or duplicates an item. */
export function chunk(items, size) {
  if (size < 1) throw new Error('chunk size must be >= 1');
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function toUnixSeconds(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
}

/**
 * Yahoo's column-oriented chart payload → one row per trading day.
 *
 * Rows whose close is null are DROPPED, not zero-filled. Yahoo emits a row
 * even for days with all-null OHLC (rare gaps); a zero there would become an
 * infinite return or a division by zero downstream. A missing day is simply
 * a missing day, and the gap is preserved.
 */
export function normalizeChartResult(result) {
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0] ?? {};
  const adjclose = result?.indicators?.adjclose?.[0]?.adjclose ?? [];

  const records = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (quote.close?.[i] == null) continue;
    records.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      // Falls back to raw close when Yahoo omits adjusted. The client flags
      // this rather than silently mixing conventions — a ratio formed from
      // one adjusted and one unadjusted price reports a split as a crash.
      adjClose: adjclose[i] ?? quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    });
  }
  return records;
}

/** Bounded-concurrency map preserving INPUT order. */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/* ------------------------------------------------------------------ */
/* I/O: auth + fetch                                                   */
/* ------------------------------------------------------------------ */

let cachedAuth = null;
const AUTH_TTL_MS = 55 * 60 * 1000;

export function _resetAuthCache() {
  cachedAuth = null;
}

/** Tier 2: cookie + crumb. Only reached when tier 1 is actually rejected. */
export async function getAuth(fetchImpl = fetch) {
  if (cachedAuth && Date.now() - cachedAuth.fetchedAt < AUTH_TTL_MS) return cachedAuth;

  // fc.yahoo.com answers 404 while still setting the cookie we need, which is
  // why this reads the header rather than checking the status.
  const cookieRes = await fetchImpl('https://fc.yahoo.com', { redirect: 'manual' });
  const setCookie = cookieRes.headers.get('set-cookie');
  if (!setCookie) throw new Error('Yahoo auth handshake failed: no set-cookie header from fc.yahoo.com');
  const cookie = setCookie.split(';')[0];

  const crumbRes = await fetchImpl('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { Cookie: cookie, 'User-Agent': USER_AGENT },
  });
  if (!crumbRes.ok) throw new Error(`Yahoo auth handshake failed: getcrumb returned ${crumbRes.status}`);
  const crumb = (await crumbRes.text()).trim();

  cachedAuth = { cookie, crumb, fetchedAt: Date.now() };
  return cachedAuth;
}

export function buildChartUrl(symbol, period1, period2, crumb) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set('period1', String(period1));
  url.searchParams.set('period2', String(period2));
  url.searchParams.set('interval', '1d');
  url.searchParams.set('events', 'history');
  if (crumb) url.searchParams.set('crumb', crumb);
  return url;
}

/**
 * Fetch one symbol's bars, escalating auth tiers only when rejected.
 *
 * NEVER THROWS FOR A SINGLE SYMBOL. Returns `{ symbol, records, authTier }` or
 * `{ symbol, error, authTier }`. One dead ticker must not fail the other 39 —
 * that asymmetry is the reliability design, not an implementation detail.
 */
export async function fetchSymbolBars(symbol, period1, period2, { fetchImpl = fetch, forceCrumb = false } = {}) {
  try {
    let res;
    let authTier;

    if (forceCrumb) {
      const auth = await getAuth(fetchImpl);
      res = await fetchImpl(buildChartUrl(symbol, period1, period2, auth.crumb), {
        headers: { Cookie: auth.cookie, 'User-Agent': USER_AGENT },
      });
      authTier = 'crumb';
    } else {
      res = await fetchImpl(buildChartUrl(symbol, period1, period2, null), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      authTier = 'simple';
    }

    if (res.status === 401 || res.status === 403) {
      const auth = await getAuth(fetchImpl);
      res = await fetchImpl(buildChartUrl(symbol, period1, period2, auth.crumb), {
        headers: { Cookie: auth.cookie, 'User-Agent': USER_AGENT },
      });
      authTier = 'crumb';

      if (res.status === 401) {
        // Cached crumb had gone stale — refresh once and retry.
        _resetAuthCache();
        const fresh = await getAuth(fetchImpl);
        res = await fetchImpl(buildChartUrl(symbol, period1, period2, fresh.crumb), {
          headers: { Cookie: fresh.cookie, 'User-Agent': USER_AGENT },
        });
      }
    }

    if (!res.ok) return { symbol, error: `Yahoo Finance returned ${res.status}`, authTier };

    const body = await res.json();
    const result = body?.chart?.result?.[0];
    if (!result) {
      return { symbol, error: `Yahoo Finance: ${body?.chart?.error?.description ?? 'no result in response'}`, authTier };
    }

    return { symbol, records: normalizeChartResult(result), authTier };
  } catch (err) {
    return { symbol, error: String(err?.message ?? err), authTier: 'unknown' };
  }
}

/** JSON response with the historical cache policy. Bars don't change intraday. */
export const HISTORY_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=21600, stale-while-revalidate=3600',
};
