/**
 * CHART RANGES — selecting a window of a series, honestly.
 *
 * WHAT THIS OWNS
 *   Which points a selected range contains, and what to say when the data
 *   falls short of it.
 *
 * WHAT THIS MUST NEVER DO
 *   Pad, extrapolate, compress or stretch. Decision D2 is explicit, and it is
 *   the same principle as D10 applied to an axis: a chart stretched to fill a
 *   range it has no data for is a fabricated picture, and a picture is harder
 *   to check than a number.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE NOTICE IS NOT OPTIONAL
 *
 * With data from 2025-01-01, the 3Y, 5Y and All ranges currently produce an
 * IDENTICAL chart. A reader who selects 5Y, sees nothing change, and is told
 * nothing will reasonably conclude the control is broken.
 *
 * So the coverage notice is the only thing distinguishing "this range happens
 * to equal All" from "this button does nothing". It is load-bearing.
 * ═════════════════════════════════════════════════════════════════════════
 */

/** Selectable ranges, in display order. All remain selectable (D2). */
export const CHART_RANGES = [
  { key: '3m', label: '3M', months: 3 },
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
  { key: '3y', label: '3Y', months: 36 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: null },
];

export const DEFAULT_RANGE = '1y';

/**
 * Ranges for a SINGLE STOCK's price chart.
 *
 * A different set from the strategy ranges above, and deliberately so. The
 * strategy record is a multi-year question; a momentum reader looking at one
 * stock is asking about the last few months, because that is the horizon the
 * ranking itself measures. Months rather than years also means every option
 * here has real data behind it, so none of them render the identical chart.
 *
 * ADDING A RANGE IS ONE LINE. `applyRange` reads `months` from whichever set
 * it is handed, so a 9M or 2Y option needs no other change.
 */
export const STOCK_CHART_RANGES = [
  { key: '1m', label: '1M', months: 1 },
  { key: '2m', label: '2M', months: 2 },
  { key: '3m', label: '3M', months: 3 },
  { key: '4m', label: '4M', months: 4 },
  { key: '5m', label: '5M', months: 5 },
  { key: 'all', label: 'All', months: null },
];

export const DEFAULT_STOCK_RANGE = '3m';

export function isValidRange(key, ranges = CHART_RANGES) {
  return ranges.some((r) => r.key === key);
}

/** Months of history a series actually spans, from its own first and last date. */
export function monthsCovered(series = []) {
  if (series.length < 2) return 0;
  const first = new Date(`${String(series[0].date).slice(0, 10)}T00:00:00Z`);
  const last = new Date(`${String(series[series.length - 1].date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return 0;
  return (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth());
}

/**
 * Apply a range to a series.
 *
 * @returns {{
 *   points: Array, rangeKey: string, requestedMonths: number|null,
 *   availableMonths: number, isTruncated: boolean, isShort: boolean,
 *   notice: string|null, neededFrom: string|null
 * }}
 *
 * `isShort` is the D2 case: the reader asked for more than exists, so the
 * chart shows everything it has and says so. `isTruncated` is the ordinary
 * case: there was more, and the range narrowed it.
 */
export function applyRange(series = [], rangeKey = DEFAULT_RANGE, ranges = CHART_RANGES, fallbackKey = DEFAULT_RANGE) {
  // An unknown key falls back to the SET'S OWN default, then to its first
  // option. Never to a key from a different set — the stock chart and the
  // strategy chart share this function but not their range vocabularies.
  const range = ranges.find((r) => r.key === rangeKey) ?? ranges.find((r) => r.key === fallbackKey) ?? ranges[0];
  const available = monthsCovered(series);

  if (series.length === 0) {
    return {
      points: [], rangeKey: range.key, requestedMonths: range.months,
      availableMonths: 0, isTruncated: false, isShort: false,
      notice: null, neededFrom: null,
    };
  }

  // "All" asks for everything, so it can never fall short.
  if (range.months == null) {
    return {
      points: series, rangeKey: range.key, requestedMonths: null,
      availableMonths: available, isTruncated: false, isShort: false,
      notice: null, neededFrom: null,
    };
  }

  const last = new Date(`${String(series[series.length - 1].date).slice(0, 10)}T00:00:00Z`);
  const cutoff = new Date(last);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - range.months);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const points = series.filter((p) => String(p.date).slice(0, 10) >= cutoffISO);
  const isShort = available < range.months;

  return {
    points,
    rangeKey: range.key,
    requestedMonths: range.months,
    availableMonths: available,
    // Points were dropped, so the reader is genuinely seeing a window.
    isTruncated: !isShort && points.length < series.length,
    isShort,
    // The date from which data would be needed to honour the request. Stated
    // rather than implied, so the shortfall is checkable.
    neededFrom: isShort ? cutoffISO : null,
    notice: isShort ? describeShortfall(range, available, cutoffISO) : null,
  };
}

function describeShortfall(range, availableMonths, neededFrom) {
  const have =
    availableMonths <= 0
      ? 'less than a month'
      : availableMonths === 1
        ? '1 month'
        : `${availableMonths} months`;

  return (
    `Showing all ${have} of verified history. ` +
    `${range.label} would need data from ${formatMonth(neededFrom)}, which does not exist yet — ` +
    `nothing here is stretched or estimated to fill the range.`
  );
}

function formatMonth(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
