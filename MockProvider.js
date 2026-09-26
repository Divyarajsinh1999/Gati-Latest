import { MarketDataProvider } from './MarketDataProvider.js';
import { DATA_START_DATE } from '../../config/constants.js';

/**
 * Mock / offline provider.
 *
 * This sandbox's network policy allows npm/GitHub but not financial-data
 * hosts, so Yahoo Finance could not be called live while building this
 * project (see YahooFinanceProvider.js's header for the full note). This
 * provider exists so the rest of the app — engine, UI, charts, CSV export —
 * can be developed and demoed end-to-end without any network access at all,
 * and so local development doesn't hammer Yahoo Finance's rate limits while
 * iterating on UI.
 *
 * Prices are a seeded random walk (deterministic per symbol — same symbol
 * always produces the same series on every run, so screenshots/tests are
 * stable) with a mild upward drift and per-symbol volatility. This is
 * SYNTHETIC DATA, not a forecast or a real historical series.
 */
export class MockProvider extends MarketDataProvider {
  get id() {
    return 'mock';
  }

  async getHistoricalData(symbol, startDate = DATA_START_DATE, endDate = todayISO()) {
    const rand = mulberry32(hashString(symbol));
    const drift = 0.0003 + rand() * 0.0004; // small daily upward drift, varies per symbol
    const vol = 0.012 + rand() * 0.018; // daily volatility, varies per symbol

    let price = 50 + rand() * 2950; // starting price anywhere from ~50 to ~3000
    const records = [];

    for (const date of businessDaysBetween(startDate, endDate)) {
      const changePct = drift + gaussian(rand) * vol;
      const open = price;
      price = Math.max(1, price * (1 + changePct));
      const close = price;
      const high = Math.max(open, close) * (1 + rand() * 0.006);
      const low = Math.min(open, close) * (1 - rand() * 0.006);
      const volume = Math.round(50_000 + rand() * 2_000_000);
      records.push({
        date,
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        adjClose: round2(close), // no corporate actions simulated
        volume,
      });
    }
    return records;
  }

  /**
   * BATCHED — mirrors the live provider's contract exactly, including its
   * per-symbol result shape, so switching providers cannot change how the
   * data service behaves. There is no network here to batch, but the SHAPE
   * has to match or the mock stops being a faithful stand-in.
   */
  async getHistoricalDataBatch(symbols, startDate = DATA_START_DATE, endDate = todayISO()) {
    const out = new Map();
    for (const symbol of symbols) {
      out.set(symbol, { records: await this.getHistoricalData(symbol, startDate, endDate) });
    }
    return out;
  }

  async getLatestQuotes(symbols) {
    const result = new Map();
    for (const symbol of symbols) {
      const series = await this.getHistoricalData(symbol);
      const last = series[series.length - 1];
      const prev = series[series.length - 2] ?? last;
      result.set(symbol, {
        price: last.close,
        changePct: prev ? ((last.close / prev.close - 1) * 100) : 0,
        asOf: last.date,
        isStale: false,
      });
    }
    return result;
  }
}

/** Pads a partial/empty universe stock list with clearly-fake symbols up to
 *  `count`, purely so the UI and engine can be exercised at realistic scale
 *  (e.g. a 150- or 250-row ranking table) while the real official
 *  constituent CSV hasn't been imported yet. Never mixed into real config —
 *  callers must opt into this explicitly and the UI should badge these. */
export function withSyntheticPadding(realStocks, count, prefix) {
  const padded = [...realStocks];
  for (let i = realStocks.length; i < count; i++) {
    const n = String(i + 1).padStart(4, '0');
    padded.push({ symbol: `${prefix}-SAMPLE-${n}.NS`, name: `Sample ${prefix} Co. ${n}`, sector: 'Sample Data', isSynthetic: true });
  }
  return padded;
}

// --- helpers -----------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function* businessDaysBetween(startDate, endDate) {
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      yield cur.toISOString().slice(0, 10);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG. Returns a function producing [0,1). */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform for approximately normal daily returns. */
function gaussian(rand) {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
