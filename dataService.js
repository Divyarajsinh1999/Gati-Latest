import { YahooFinanceProvider } from './providers/YahooFinanceProvider.js';
import { MockProvider, withSyntheticPadding } from './providers/MockProvider.js';
import { getUniverse } from '../config/universes.js';
import { DATA_START_DATE } from '../config/constants.js';
import { getRenameSuggestion } from '../config/renamedTickers.js';
import { cacheGet, cacheSet } from './localCache.js';
import { barStore, normaliseBars } from './cache/barStore.js';
import { quoteCacheKey } from './cache/cacheKeys.js';

/**
 * Which provider is "live" — this is the ONE place that decides Yahoo vs
 * Mock vs (later) something else, per spec Section 5's swappable-provider
 * requirement. Controlled by an env var so a real deployment defaults to
 * Yahoo while local/offline development defaults to Mock.
 *
 * Set VITE_DATA_PROVIDER=mock to force offline mode anywhere (see .env.example).
 */
const providerId = import.meta.env?.VITE_DATA_PROVIDER ?? (import.meta.env?.PROD ? 'yahoo' : 'mock');
const provider = providerId === 'yahoo' ? new YahooFinanceProvider() : new MockProvider();

/**
 * NO FALLBACK TO SAMPLE DATA ON LIVE FAILURE. (User directive, 31 Jul 2026 —
 * overrides this project's earlier v0.13.0 design, recorded below for
 * anyone wondering why a fallback isn't here.)
 *
 * The earlier design caught any live-provider failure and quietly re-ran the
 * whole fetch against MockProvider, so the dashboard kept rendering numbers
 * — loudly flagged as synthetic via a banner, but numbers all the same. The
 * user was explicit that this is the wrong tradeoff for a financial tool:
 * an honest "couldn't load" beats a plausible-looking fake number, even a
 * clearly labelled one. Spec Section 35's #11 ("do not fabricate
 * unavailable market data") already argued this way; this is that argument
 * taken to its actual conclusion rather than half-applied.
 *
 * So: if the live provider fails, the error propagates. React Query's
 * `isError` fires, `query.data` stays undefined, and the page renders an
 * explicit error card and nothing else — no charts, no rankings, no
 * numbers of any kind. See ErrorState in StrategyPage.jsx and the
 * equivalent card in Dashboard.jsx.
 *
 * Per-symbol tolerance (added v0.14.5): a failure fetching ONE stock does
 * not fail its universe. That stock is left out of `priceSeriesMap`, listed
 * in `unavailableSymbols`, and still appears in the rankings table as an
 * unranked row carrying a specific flag. Only a benchmark failure, or every
 * single symbol failing, escalates to a universe-wide error — see
 * `getUniverseHistoricalData` for why that asymmetry is correct.
 *
 * Quote-independent failure (added v0.14.7): a failure fetching LIVE QUOTES
 * does not fail the bundle either, and is handled separately from the
 * per-symbol case above — it's a single batched request for ALL symbols
 * (see quote.js), so it fails as one unit, not per-stock. On failure,
 * `quotes` stays an empty Map and `quotesError` carries the reason; the
 * historical data, rankings and backtest render normally regardless,
 * since none of them read from `quotes`. See `fetchUniverseBundle`.
 */
// Historical freshness is now owned by the bar store (BAR_TTL_MS, 6h), which
// is the single place that decides whether cached bars still count. Keeping a
// second copy here would be two sources of truth for one policy.
const QUOTE_TTL_MS = 60 * 1000; // 1 min

/** Max simultaneous in-flight historical requests. Cached symbols resolve
 *  immediately and don't meaningfully consume a slot, so this mainly bounds
 *  the cold-start burst. Retained for the legacy per-symbol path only. */
const HISTORICAL_CONCURRENCY = 6;

/**
 * Symbols per request to /api/history. Must not exceed the server's cap.
 *
 * THE DEFECT THIS FIXES: the old endpoint took ONE symbol per request, so a
 * cold Smallcap 250 load issued 251 separate function invocations and a full
 * three-universe start issued 453. At 40 per request that becomes 7 for the
 * stocks plus 1 for the benchmark — measured and asserted in
 * __tests__/batchedFetch.test.js.
 */
const HISTORY_BATCH_SIZE = 40;

/** In-flight de-duplication. Two universes sharing a symbol, or a re-render
 *  racing itself, must not produce two identical requests. */
const inFlight = new Map();

/**
 * Like `Promise.all(items.map(fn))` but with at most `limit` promises in
 * flight. Results are returned in INPUT order regardless of completion
 * order — callers below zip them back against the stock list by index, so
 * order-scrambling here would silently attach the wrong price series to
 * the wrong symbol.
 */
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

/**
 * Historical daily series for MANY symbols. The primary path.
 *
 * Three things happen here, in this order, and the order is the whole point:
 *
 *   1. Ask the bar store for each symbol. Hits cost nothing and never reach
 *      the network.
 *   2. Batch only the MISSES, in chunks, to /api/history.
 *   3. Write results back to the bar store.
 *
 * The cache is checked BEFORE batching rather than after, so a warm load
 * issues zero requests — not "fewer" requests. That is asserted, because the
 * previous implementation's cache silently stopped working above roughly a
 * hundred symbols (localStorage quota) and nobody noticed for months.
 *
 * NEVER REJECTS FOR ONE SYMBOL. Returns a Map of symbol → { records } or
 * { error }, mirroring the provider contract.
 *
 * @returns {Promise<{ results: Map<string, {records?: object[], error?: string}>, requests: number }>}
 */
export async function getHistoricalSeriesBatch(
  symbols,
  { startDate = DATA_START_DATE, endDate = todayISO(), from = provider, store = barStore } = {},
) {
  const results = new Map();
  const misses = [];

  for (const symbol of symbols) {
    const cached = await store.get(symbol, { startDate, endDate });
    if (cached && cached.length > 0) results.set(symbol, { records: cached });
    else misses.push(symbol);
  }

  if (misses.length === 0) return { results, requests: 0 };

  // A provider predating the batch contract (notably the hand-written test
  // doubles that guard the failure-asymmetry behaviour) still works: fall
  // back to the per-symbol path rather than requiring every double to be
  // rewritten. Both real providers implement the batch method.
  const supportsBatch = typeof from.getHistoricalDataBatch === 'function';
  let requests = 0;

  if (supportsBatch) {
    const batches = chunkArray(misses, HISTORY_BATCH_SIZE);
    for (const batch of batches) {
      requests++;
      try {
        const batchResult = await from.getHistoricalDataBatch(batch, startDate, endDate);
        for (const symbol of batch) {
          results.set(symbol, batchResult.get(symbol) ?? { error: 'not present in provider response' });
        }
      } catch (error) {
        // The whole batch failed. Record it per symbol so the caller's
        // existing per-symbol tolerance still applies — a batch is a
        // transport detail, not a unit of financial meaning.
        const reason = String(error?.message ?? error);
        for (const symbol of batch) results.set(symbol, { error: reason });
      }
    }
  } else {
    const settled = await mapWithConcurrency(misses, HISTORICAL_CONCURRENCY, async (symbol) => {
      requests++;
      try {
        return { symbol, records: await from.getHistoricalData(symbol, startDate, endDate) };
      } catch (error) {
        return { symbol, error: String(error?.message ?? error) };
      }
    });
    for (const r of settled) {
      results.set(r.symbol, r.records ? { records: r.records } : { error: r.error });
    }
  }

  /*
    ═══════════════════════════════════════════════════════════════════════
    NORMALISE FETCHED RECORDS BEFORE ANYTHING READS THEM.

    A cache HIT returns bars the store has already sorted and de-duplicated.
    A cache MISS returns the provider's array verbatim, and `results` is what
    the engine consumes — the write-back below is a side effect, not the
    path the numbers travel. So without this the same provider response could
    produce two different rankings depending only on whether the cache
    happened to be warm, which is close to impossible to reproduce or believe.

    `normaliseBars` is imported from the store rather than reimplemented:
    "well-formed series" needs exactly one definition, and two copies of a
    sort-and-dedupe rule is two chances to disagree about what a series is.
    ═══════════════════════════════════════════════════════════════════════
  */
  for (const symbol of misses) {
    const entry = results.get(symbol);
    if (!entry?.records?.length) continue;
    const { bars: clean, conflicts } = normaliseBars(entry.records);

    if (conflicts.length > 0) {
      /*
        TWO DIFFERENT CLOSES FOR ONE SESSION.

        Not resolvable here, and not resolvable anywhere: which of them is the
        real price is not a question this app can answer, and picking one
        would be a guess presented as a fact. If the affected date happens to
        be a month-end, the return computed from it is simply wrong — the
        audit that found this measured a fabricated ₹999 against a true ₹212
        producing a RANKED −76.98%.

        Routed into the same failure channel as a dead ticker, so it appears
        in "Could not be ranked" with its reason instead of becoming a new
        pipe nothing reads. Excluding one stock of 250 costs a row; ranking
        it on a price that contradicts itself costs the ranking's credibility.
      */
      results.set(symbol, {
        error: `Price history disagrees with itself on ${conflicts.length === 1 ? conflicts[0] : `${conflicts.length} sessions`} — two different closes for the same session`,
      });
      continue;
    }

    results.set(symbol, { ...entry, records: clean });
  }

  // Write-back. A failed write costs speed, never correctness, so it must not
  // fail the load — but the store COUNTS failures, unlike the cache it
  // replaces, whose empty catch block hid a full quota indefinitely.
  for (const symbol of misses) {
    const entry = results.get(symbol);
    if (entry?.records?.length) {
      await store.put(symbol, entry.records, { startDate, endDate, source: from.id });
    }
  }
  await store.evictIfNeeded();

  return { results, requests };
}

/**
 * Historical daily series for ONE symbol.
 *
 * Expressed in terms of the batch path so there is exactly one caching and
 * fetching implementation. Retained because the benchmark is deliberately
 * fetched alone (see getUniverseHistoricalData), and because throwing on
 * failure is the right shape for that one caller.
 */
export async function getHistoricalSeries(symbol, { startDate = DATA_START_DATE, endDate = todayISO(), from = provider, store = barStore } = {}) {
  const dedupeKey = `${from.id}:${symbol}:${startDate}:${endDate}`;
  if (inFlight.has(dedupeKey)) return inFlight.get(dedupeKey);

  const promise = (async () => {
    const { results } = await getHistoricalSeriesBatch([symbol], { startDate, endDate, from, store });
    const entry = results.get(symbol);
    if (!entry || entry.error) throw new Error(entry?.error ?? `No data for ${symbol}`);
    return entry.records;
  })().finally(() => inFlight.delete(dedupeKey));

  inFlight.set(dedupeKey, promise);
  return promise;
}

/** Split an array into fixed-size chunks; never drops or duplicates an item. */
function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Historical series for an entire universe (all stocks + its benchmark),
 * as a Map<symbol, records[]> plus the benchmark's own series — exactly
 * the shape engine/backtestEngine.js expects.
 *
 * `padToExpectedCount`: when true and the universe's constituent list is
 * only partial (see config/universes.js meta.constituentStatus), pads with
 * clearly-labeled synthetic tickers so the ranking table/backtest can be
 * demoed at the real 150/250-row scale. Only meaningful with the Mock
 * provider — Yahoo obviously can't return data for a fake ticker.
 */
export async function getUniverseHistoricalData(universeKey, { from = provider, padToExpectedCount = from.id === 'mock' } = {}) {
  const universe = getUniverse(universeKey);
  const stocks =
    padToExpectedCount && universe.meta.constituentStatus === 'partial'
      ? withSyntheticPadding(universe.stocks, universe.meta.expectedCount, universe.shortLabel.replace(/\s+/g, '').toUpperCase())
      : universe.stocks;

  // Bounded concurrency, not Promise.all over all ~250 symbols. An
  // unbounded fan-out means 250 simultaneous requests to a provider with
  // no published quota (and historical responses are much larger than
  // quotes), which is a reliable way to get throttled.
  //
  // THE BENCHMARK IS FETCHED FIRST, ALONE, AND IS STILL FATAL IF IT FAILS.
  // That asymmetry is deliberate: RS is defined as stock return minus
  // *benchmark* return (spec Section 9), so without the benchmark there is
  // no ranking to compute for anyone — a universe-wide failure is the honest
  // outcome. An individual stock is different: losing one of 250 costs one
  // row, so failing all 250 for it would be throwing away good data.
  const benchmarkSeries = await getHistoricalSeries(universe.benchmark.symbol, { from });

  // Per-symbol tolerance, now via ONE batched path. Each symbol resolves to
  // either its series or a recorded failure — never a rejection, so one dead
  // ticker (renamed, delisted) can't take down the other 249.
  //
  // Batching changed the transport, NOT this behaviour: a batch is a
  // transport detail and must never become a unit of financial meaning. If a
  // whole batch fails, each of its symbols is recorded as failed individually
  // and the same asymmetry applies.
  const { results } = await getHistoricalSeriesBatch(stocks.map((s) => s.symbol), { from });

  const priceSeriesMap = new Map();
  const unavailableSymbols = [];
  stocks.forEach((stock, idx) => {
    const entry = results.get(stock.symbol);
    const result = {
      symbol: stock.symbol,
      records: entry?.records?.length ? entry.records : null,
      reason: entry?.error ?? 'no data returned',
    };
    if (result.records) {
      priceSeriesMap.set(result.symbol, result.records);
    } else {
      // Not added to priceSeriesMap at all. The engine already treats a
      // missing/empty series as an unrankable row (rankByRS sorts null-RS
      // rows to the bottom with rank: null), so the stock still appears —
      // flagged — rather than silently vanishing from the universe.
      //
      // `suggestion` comes from the RENAMED_TICKERS config, not from
      // guessing here — see renamedTickers.js for why the app itself never
      // picks a replacement symbol. Most failures will have no entry and
      // suggestion will just be null; that's the expected, honest default.
      unavailableSymbols.push({
        symbol: result.symbol,
        name: stocks[idx].name,
        reason: result.reason,
        suggestion: getRenameSuggestion(result.symbol),
      });
    }
  });

  // If NOTHING resolved, this isn't a renamed ticker — it's an outage, and
  // pretending otherwise would render an entire universe of empty rows as
  // though that were a data-quality finding. Fail loudly instead.
  if (stocks.length > 0 && priceSeriesMap.size === 0) {
    throw new Error(
      `No historical data could be fetched for any of the ${stocks.length} symbols in ${universe.label}. ` +
        `First reason: ${unavailableSymbols[0]?.reason ?? 'unknown'}`,
    );
  }

  return { universe, stocks, priceSeriesMap, benchmarkSeries, unavailableSymbols };
}

/** Latest quotes for a list of symbols, cached briefly. */
export async function getLatestQuotes(symbols, { from = provider } = {}) {
  // Hashed, not the joined symbol list. A 251-symbol universe produced a
  // ~4 kB key string that was rebuilt and compared on every lookup; see
  // cache/cacheKeys.js.
  const cacheKey = quoteCacheKey(from.id, symbols);
  const cached = cacheGet(cacheKey);
  if (cached) return new Map(Object.entries(cached));

  const quotes = await from.getLatestQuotes(symbols);
  cacheSet(cacheKey, Object.fromEntries(quotes), QUOTE_TTL_MS);
  return quotes;
}

export function getActiveProviderId() {
  return provider.id;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetches everything one universe needs.
 *
 * Orchestration lives here rather than in the React hook so the data layer
 * owns "where do numbers come from" end to end (spec Section 34). No
 * try/catch here on purpose — see the note above `HISTORICAL_TTL_MS`: a
 * live-provider failure is meant to reach the caller as a real error, not
 * be silently absorbed into synthetic data.
 */
export async function fetchUniverseBundle(universeKey) {
  const { universe, stocks, priceSeriesMap, benchmarkSeries, unavailableSymbols } = await getUniverseHistoricalData(universeKey, { from: provider });

  // Quotes and history hit different Yahoo endpoints under different auth
  // tiers (see HANDOFF.md's Phase 1 correction: v7/quote needs the
  // cookie+crumb handshake, v8/chart doesn't), so they fail INDEPENDENTLY.
  // A quote failure must NOT discard historical data that already loaded —
  // the backtest and month-end rankings (spec Sections 8-19) never touch
  // live quotes at all; only the "Current Price"/"Daily Change %" display
  // columns (Section 21) do, and computeCurrentMomentum already falls back
  // to each stock's last historical close when a quote is missing (see the
  // price-convention note in currentMomentum.js). So this failure is caught
  // here specifically, unlike a historical/benchmark failure above, which
  // is still meant to propagate and fail the whole bundle.
  let quotes = new Map();
  let quotesError = null;
  try {
    quotes = await getLatestQuotes([universe.benchmark.symbol, ...stocks.map((s) => s.symbol)], { from: provider });
  } catch (error) {
    quotesError = String(error?.message ?? error);
  }

  // Date of the newest bar actually held — NOT Date.now().
  const dataAsOf = benchmarkSeries.length ? benchmarkSeries[benchmarkSeries.length - 1].date : null;
  return { universe, stocks, priceSeriesMap, benchmarkSeries, quotes, quotesError, dataAsOf, providerId: provider.id, unavailableSymbols };
}
