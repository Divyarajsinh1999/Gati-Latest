/**
 * SYNTHETIC PRICE SERIES — deterministic, reproducible test data.
 *
 * WHAT THIS OWNS
 *   Generating price series of arbitrary size for performance measurement and
 *   for golden-master fixtures, from a seed, with no network.
 *
 * WHAT THIS MUST NEVER DO
 *   Reach production code. This is a test harness. Synthetic prices exist to
 *   measure how fast the engine runs and to freeze a known-good result — never
 *   to stand in for market data anywhere a user could see it. The product's
 *   standing rule is that a failure produces an error, never a number.
 *
 * WHY A SEEDED PRNG RATHER THAN Math.random()
 *   A performance number that varies run to run cannot gate a build, and a
 *   golden master built on random data cannot be frozen. Same seed, same
 *   series, on every machine, forever.
 */

/** mulberry32 — small, fast, and stable across engines. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Trading days between two dates, weekends excluded.
 * Holidays are deliberately NOT modelled: month-end detection is driven by
 * which dates are present, so omitting holidays would make the fixture easier
 * than reality. Weekends alone already produce months that end on the 28th,
 * 29th and 30th, which is the case that matters.
 */
export function tradingDays(startISO, endISO) {
  const out = [];
  const cur = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * One symbol's daily bars: a random walk with a mild per-symbol drift, so
 * rankings have real dispersion rather than every stock moving together.
 *
 * @param {object} opts
 * @param {string} opts.symbol
 * @param {string[]} opts.dates
 * @param {number} opts.seed
 * @param {number} [opts.startPrice]
 * @param {number} [opts.driftPctPerDay]
 * @param {number} [opts.volPctPerDay]
 */
export function makeSeries({
  symbol,
  dates,
  seed,
  startPrice = 500,
  driftPctPerDay = 0,
  volPctPerDay = 1.4,
}) {
  const rand = seededRandom(seed);
  let price = startPrice;
  return dates.map((date) => {
    const shock = (rand() - 0.5) * 2 * volPctPerDay;
    price = Math.max(1, price * (1 + (driftPctPerDay + shock) / 100));
    const close = round2(price);
    const open = round2(close * (1 + (rand() - 0.5) * 0.008));
    const high = round2(Math.max(open, close) * (1 + rand() * 0.006));
    const low = round2(Math.min(open, close) * (1 - rand() * 0.006));
    return {
      date,
      open,
      high,
      low,
      close,
      // Adjusted equals close in synthetic data: the mixed-basis guard is
      // exercised by dedicated unit tests with hand-built bars, not here.
      adjClose: close,
      volume: Math.floor(100_000 + rand() * 900_000),
      symbol,
    };
  });
}

/**
 * A whole universe: N stocks plus a benchmark, each with its own drift so the
 * resulting RS spread resembles a real ranking.
 *
 * @param {object} opts
 * @param {number} opts.count
 * @param {string} [opts.start]
 * @param {string} [opts.end]
 * @param {number} [opts.seed]
 */
export function makeUniverse({ count, start = '2025-01-01', end = '2026-07-31', seed = 42 }) {
  const dates = tradingDays(start, end);
  const rand = seededRandom(seed);

  const stocks = [];
  const priceSeriesMap = new Map();

  for (let i = 0; i < count; i++) {
    const symbol = `SYN${String(i).padStart(3, '0')}.NS`;
    stocks.push({ symbol, name: `Synthetic ${i}`, sector: SECTORS[i % SECTORS.length] });
    priceSeriesMap.set(
      symbol,
      makeSeries({
        symbol,
        dates,
        seed: seed + i * 7919,
        startPrice: 100 + Math.floor(rand() * 3000),
        // Spread drift across roughly -0.05%/day to +0.05%/day.
        driftPctPerDay: (rand() - 0.5) * 0.1,
      }),
    );
  }

  const benchmarkSeries = makeSeries({
    symbol: 'SYNBENCH.NS',
    dates,
    seed: seed - 1,
    startPrice: 250,
    driftPctPerDay: 0.01,
    volPctPerDay: 0.8,
  });

  return { stocks, priceSeriesMap, benchmarkSeries, dates };
}

const SECTORS = [
  'Financial Services', 'Information Technology', 'Capital Goods',
  'Healthcare', 'Automobile', 'FMCG', 'Metals & Mining',
];

function round2(n) {
  return Math.round(n * 100) / 100;
}
