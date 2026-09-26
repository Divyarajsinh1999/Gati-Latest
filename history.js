/**
 * GET /api/history?symbols=A.NS,B.NS,...&start=2025-01-01&end=2026-08-03
 *
 * BATCHED historical bars. This is the fix for a measured defect.
 *
 * THE DEFECT
 *   `/api/market-data` accepted ONE symbol per request, so a cold Smallcap 250
 *   load issued 251 separate function invocations, and a full three-universe
 *   cold start issued 453. The quote path was already fixed this way months
 *   ago — `/api/quote` batches 50 symbols per upstream request and turns 453
 *   into ~10 — but the history path never received the same treatment.
 *
 * THE FIX
 *   The client sends up to 40 cache-miss symbols per call. This function fans
 *   out to Yahoo internally at bounded concurrency. Smallcap 250 becomes 7
 *   invocations plus 1 for the benchmark: 251 → 8.
 *
 *   Yahoo's chart endpoint is single-symbol, so the upstream request count is
 *   unchanged. What changes is that those requests now come from ONE warm
 *   function instance in a controlled sequence, rather than from 251 cold
 *   starts — which is both cheaper and far less likely to trip the
 *   IP-reputation throttling this endpoint is known for.
 *
 * PER-SYMBOL FAILURE SEMANTICS
 *   A failed symbol returns an error ENTRY and the response is still 200.
 *   Only a total failure returns 5xx. One dead ticker costs one row; failing
 *   all 40 for it would throw away good data. The client mirrors this
 *   asymmetry exactly.
 *
 * Exercise the auth fallback deliberately with FORCE_AUTH_TIER=crumb.
 */

import {
  parseSymbolsParam,
  isValidDate,
  toUnixSeconds,
  fetchSymbolBars,
  mapWithConcurrency,
  UPSTREAM_CONCURRENCY,
  HISTORY_CACHE_HEADERS,
} from './_shared/yahoo.mjs';

export default async (req) => {
  const url = new URL(req.url);

  const parsed = parseSymbolsParam(url.searchParams.get('symbols'));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end') ?? new Date().toISOString().slice(0, 10);

  if (!start || !isValidDate(start)) {
    return Response.json({ error: 'start is required and must be YYYY-MM-DD' }, { status: 400 });
  }
  if (!isValidDate(end)) {
    return Response.json({ error: 'end must be YYYY-MM-DD' }, { status: 400 });
  }
  if (start > end) {
    return Response.json({ error: 'start must not be after end' }, { status: 400 });
  }

  const period1 = toUnixSeconds(start);
  const period2 = toUnixSeconds(end);
  const forceCrumb = process.env.FORCE_AUTH_TIER === 'crumb';

  try {
    const results = await mapWithConcurrency(parsed.symbols, UPSTREAM_CONCURRENCY, (symbol) =>
      fetchSymbolBars(symbol, period1, period2, { forceCrumb }),
    );

    const series = {};
    let failed = 0;
    let authTier = 'simple';

    for (const r of results) {
      if (r.error) {
        failed++;
        series[r.symbol] = { error: r.error };
      } else {
        series[r.symbol] = { records: r.records };
      }
      // Report the highest tier any symbol needed. If this starts reading
      // 'crumb' in production it means Yahoo has tightened, which is the
      // early warning worth monitoring.
      if (r.authTier === 'crumb') authTier = 'crumb';
    }

    // Every symbol failing is an outage, not a data-quality finding, and
    // returning 200 with 40 empty entries would let the client render it as
    // one. Fail loudly instead.
    if (failed === parsed.symbols.length && failed > 0) {
      return Response.json(
        {
          error: `All ${failed} symbols failed. First reason: ${results[0].error}`,
          requested: parsed.symbols.length,
          failed,
          authTier,
        },
        { status: 502 },
      );
    }

    return Response.json(
      { series, requested: parsed.symbols.length, failed, authTier },
      { headers: HISTORY_CACHE_HEADERS },
    );
  } catch (err) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
};

export const config = { path: '/api/history' };
