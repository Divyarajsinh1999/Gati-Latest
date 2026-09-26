import { MarketDataProvider } from './MarketDataProvider.js';

/**
 * Yahoo Finance provider.
 *
 * IMPORTANT — read this before trusting live data from this provider:
 * Yahoo Finance has no official public API. This uses the same unofficial
 * `query1.finance.yahoo.com/v8/finance/chart/...` endpoint that libraries
 * like yfinance (Python) and yahoo-finance2 (Node) use. Research turned up
 * conflicting, differently-dated evidence on whether a cookie + "crumb"
 * handshake is currently required for this specific endpoint — some recent
 * sources show a plain request succeeding, others show 401s without it.
 * The server-side function (netlify/functions/market-data.js) hedges both
 * ways: it tries a plain request first and only performs the handshake if
 * that's rejected. That logic lives entirely server-side, NOT in this file,
 * so no cookie/crumb ever needs to reach the browser.
 *
 * This sandbox's network egress only allows npm/GitHub/PyPI-type hosts, not
 * finance.yahoo.com, so the function could be written to match the
 * documented/observed shape of the endpoint but could NOT be exercised
 * against a live Yahoo response during this build. Verify it against a real
 * request (`netlify dev` locally, or after deploying) before relying on it —
 * see README.md "Known gaps" for the exact command to sanity-check this,
 * including which auth tier actually ends up firing.
 */
export class YahooFinanceProvider extends MarketDataProvider {
  get id() {
    return 'yahoo';
  }

  /**
   * BATCHED — the primary path. One call to our own function carries up to 40
   * symbols; the function fans out to Yahoo internally at bounded concurrency.
   *
   * This is the fix for a measured defect: the previous single-symbol endpoint
   * meant a cold Smallcap 250 load issued 251 separate function invocations.
   * It now issues 7, plus 1 for the benchmark.
   *
   * Per-symbol failures come back as entries, not rejections — see the
   * contract in MarketDataProvider.js for why that asymmetry matters.
   */
  async getHistoricalDataBatch(symbols, startDate, endDate) {
    const params = new URLSearchParams({ symbols: symbols.join(','), start: startDate, end: endDate });
    const res = await fetch(`/api/history?${params.toString()}`);

    if (!res.ok) {
      // A non-200 here means the whole batch failed (every symbol errored, or
      // the request was malformed). That IS fatal for these symbols, so it
      // rejects — the caller decides whether losing them fails the universe.
      const body = await safeJson(res);
      throw new Error(`Yahoo Finance history fetch failed: ${res.status} ${body?.error ?? ''}`);
    }

    const payload = await res.json();
    const out = new Map();
    for (const symbol of symbols) {
      const entry = payload.series?.[symbol];
      if (!entry) out.set(symbol, { error: 'not present in provider response' });
      else if (entry.error) out.set(symbol, { error: entry.error });
      else out.set(symbol, { records: entry.records });
    }
    return out;
  }

  /** Single-symbol convenience, expressed in terms of the batch path so the
   *  two cannot drift apart. */
  async getHistoricalData(symbol, startDate, endDate) {
    const result = await this.getHistoricalDataBatch([symbol], startDate, endDate);
    const entry = result.get(symbol);
    if (!entry || entry.error) {
      throw new Error(`Yahoo Finance fetch failed for ${symbol}: ${entry?.error ?? 'no data'}`);
    }
    return entry.records;
  }

  async getLatestQuotes(symbols) {
    // The whole symbol list goes in ONE call to our own function; the
    // function itself groups them into ~50-symbol batches before talking to
    // Yahoo (see netlify/functions/quote.js), so a 450-symbol universe costs
    // roughly 10 upstream requests instead of 450.
    const params = new URLSearchParams({ symbols: symbols.join(',') });
    const res = await fetch(`/api/quote?${params.toString()}`);
    if (!res.ok) {
      const body = await safeJson(res);
      throw new Error(`Yahoo Finance quote fetch failed: ${res.status} ${body?.error ?? ''}`);
    }
    const payload = await res.json();
    return new Map(Object.entries(payload.quotes));
  }
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
