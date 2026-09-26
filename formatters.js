const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN');

/**
 * @param {number} value
 * @param {object} [options]
 * @param {boolean} [options.precise]  paise, for a figure being reconciled
 * @param {boolean} [options.showSign] prefix a gain with `+`
 *
 * `showSign` exists for profit and loss, where the sign is the point. A
 * negative already carries its own sign from the locale formatter, so this
 * only ever adds the `+` — a loss can never be rendered without its minus.
 */
export function formatINR(value, { precise = false, showSign = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const formatted = precise ? inrPrecise.format(value) : inr.format(value);
  return showSign && value > 0 ? `+${formatted}` : formatted;
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return num.format(value);
}

/**
 * @param {number} value
 * @param {Object} [options]
 * @param {number} [options.digits]
 * @param {boolean} [options.showSign]
 * @param {'%'|''} [options.unit] the unit to append.
 */
export function formatPct(value, { digits = 2, showSign = true, unit = '%' } = {}) {
  // Guards the TYPE, not just null. A caller passing an object (a metrics
  // function returns { value, ... }, not a number) is a bug — but it must
  // surface as an em-dash, not a white screen on a page of correct figures.
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}${unit}`;
}

/**
 * A DIFFERENCE between two percentages — Relative Strength, outperformance,
 * a portfolio's gap to its benchmark — rendered with a `%` sign.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SEPARATE FUNCTION FROM formatPct
 *
 * These values are arithmetically percentage POINTS, not percentages. A
 * stock up 18.6% against a benchmark down 0.2% is 18.8 points ahead; it is
 * not "18.8% better", which would mean something else and larger. The app
 * used to render them with a `pp` suffix for exactly that reason.
 *
 * The owner's decision (8 Aug 2026, restated 8 Aug) is that `pp` is a
 * barrier for a beginner and every one of these should read as `%`, framed
 * as "this stock is X% ahead of its benchmark". That is implemented, and
 * the distinction is carried in the glossary entry rather than lost.
 *
 * This stays a distinct function even though it now formats identically to
 * formatPct, because the call sites still say which kind of quantity they
 * are showing. If the convention is ever revisited, it is one edit here
 * rather than a hunt through five selectors.
 * ═══════════════════════════════════════════════════════════════════════
 */
export function formatGap(value, { digits = 2, showSign = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  // U+2212 MINUS SIGN, not a hyphen. These labels have always used it: it is
  // the same width as `+`, so a column of gains and losses stays aligned, and
  // a hyphen at small sizes reads as a dash rather than a sign. Changing the
  // suffix from `pp` to `%` should not quietly change the sign glyph too.
  const sign = value < 0 ? '−' : showSign && value > 0 ? '+' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

/**
 * A large count, abbreviated the Indian way — 24.5L, 3.2Cr.
 *
 * Volume figures run to eight digits. Rendered in full they dominate a row
 * of prices while being the least precise number in it: nobody acts on the
 * last three shares of 24,512,883. Lakh and crore rather than K/M/B because
 * the reader is reading an Indian market in Indian units.
 */
export function formatCompactNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return num.format(value);
}

export function formatDate(isoDate, { style = 'medium' } = {}) {
  if (!isoDate) return '—';
  const d = new Date(isoDate.length === 10 ? isoDate + 'T00:00:00Z' : isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: style === 'short' ? 'short' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateTime(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(d) + ' IST';
}

/** Semantic direction for colouring: 'gain' | 'loss' | 'neutral'. */
export function directionOf(value) {
  if (value == null || Number.isNaN(value)) return 'neutral';
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'neutral';
}
