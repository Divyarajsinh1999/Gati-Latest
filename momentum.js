import { RETURN_PRICE_FIELD, RETURN_PRICE_FIELD_FALLBACK } from '../config/constants.js';
import { DATA_QUALITY_FLAGS } from '../config/constants.js';

/**
 * Percentage return between two prices (spec Section 8):
 *   Return% = ((current / previous) - 1) * 100
 * Throws on non-positive inputs rather than returning NaN/Infinity silently,
 * per spec Section 35: "Prevent divide-by-zero and invalid-return calculations."
 */
export function calculateReturn(currentPrice, previousPrice) {
  if (!(previousPrice > 0) || !(currentPrice > 0) || !Number.isFinite(currentPrice) || !Number.isFinite(previousPrice)) {
    throw new Error(`calculateReturn: invalid prices (previous=${previousPrice}, current=${currentPrice})`);
  }
  return ((currentPrice / previousPrice) - 1) * 100;
}

/**
 * Relative Strength (spec Section 9): RS = Stock Return% - Benchmark Return%.
 * Deliberately just a subtraction — kept as its own named function (rather
 * than inlined everywhere) so the definition only needs to change in one
 * place if the strategy definition ever changes.
 */
export function calculateRS(stockReturnPct, benchmarkReturnPct) {
  return stockReturnPct - benchmarkReturnPct;
}

/**
 * Picks the correct price field for return calculations off a single price
 * record, preferring adjusted close (spec Section 6) and falling back to
 * close with an explicit flag rather than silently mixing conventions
 * (spec Section 41).
 *
 * Returns { price, field, flags[] } — `field` matters: a ratio is only
 * meaningful when BOTH of its prices came from the same field. See
 * assertSameConvention below.
 */
export function resolveReturnPrice(record) {
  const preferred = record[RETURN_PRICE_FIELD];
  if (typeof preferred === 'number' && Number.isFinite(preferred) && preferred > 0) {
    return { price: preferred, field: RETURN_PRICE_FIELD, flags: [] };
  }
  const fallback = record[RETURN_PRICE_FIELD_FALLBACK];
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) {
    return { price: fallback, field: RETURN_PRICE_FIELD_FALLBACK, flags: [DATA_QUALITY_FLAGS.PRICE_FIELD_FALLBACK] };
  }
  return { price: null, field: null, flags: [DATA_QUALITY_FLAGS.MISSING_DATA] };
}

/**
 * A return is (currentPrice / previousPrice). That ratio is only valid when
 * both prices are on the SAME basis.
 *
 * This guard exists because of a genuinely dangerous failure mode. Suppose a
 * 1:5 split occurs, the older bar has only a raw `close` (5000) and the
 * newer bar has an `adjClose` (1050). The naive ratio reports **-79%** for a
 * stock that actually rose 5% — that stock is then ranked dead last and can
 * never be selected. The same mix in the opposite direction fabricates a
 * ~+400% gain, which would sit at rank 1 and dominate the Top 5 every time.
 *
 * A warning flag is not sufficient here: the number itself is meaningless,
 * and spec Section 41 is explicit that suspicious data must be flagged
 * rather than calculated around. So this refuses to produce a value at all.
 */
function assertSameConvention(previous, current, label) {
  if (previous.field && current.field && previous.field !== current.field) {
    return `${label}: cannot compare ${previous.field} against ${current.field} — mixing adjusted and unadjusted prices would misstate the return (a split would read as a crash)`;
  }
  return null;
}

/**
 * Computes { stockReturnPct, benchmarkReturnPct, rs, flags[] } for one
 * stock across two month-end (or current-vs-month-end) price records.
 * Never throws on bad data — returns null with a flags[] explanation
 * instead, so a single missing price can't crash a whole ranking pass
 * (spec Section 35: "Handle missing values safely").
 */
export function computeStockRS({ currentRecord, previousRecord, currentBenchmark, previousBenchmark }) {
  const flags = [];
  const cur = resolveReturnPrice(currentRecord);
  const prev = resolveReturnPrice(previousRecord);
  const curB = resolveReturnPrice(currentBenchmark);
  const prevB = resolveReturnPrice(previousBenchmark);
  flags.push(...cur.flags, ...prev.flags, ...curB.flags, ...prevB.flags);

  if (cur.price == null || prev.price == null) {
    return { stockReturnPct: null, benchmarkReturnPct: null, rs: null, flags: [...flags, DATA_QUALITY_FLAGS.MISSING_DATA] };
  }
  if (curB.price == null || prevB.price == null) {
    return { stockReturnPct: null, benchmarkReturnPct: null, rs: null, flags: [...flags, DATA_QUALITY_FLAGS.BENCHMARK_MISSING] };
  }

  // Refuse a mixed-basis ratio outright rather than reporting a wrong number
  // behind a warning badge.
  const conventionErrors = [
    assertSameConvention(prev, cur, 'Stock'),
    assertSameConvention(prevB, curB, 'Benchmark'),
  ].filter(Boolean);
  if (conventionErrors.length > 0) {
    return { stockReturnPct: null, benchmarkReturnPct: null, rs: null, flags: [...flags, ...conventionErrors] };
  }

  const stockReturnPct = calculateReturn(cur.price, prev.price);
  const benchmarkReturnPct = calculateReturn(curB.price, prevB.price);
  const rs = calculateRS(stockReturnPct, benchmarkReturnPct);
  return { stockReturnPct, benchmarkReturnPct, rs, flags };
}
