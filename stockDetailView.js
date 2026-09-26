/**
 * STOCK DETAIL VIEW MODEL.
 *
 * WHAT THIS OWNS
 *   Shaping everything known about ONE stock: its rank, its Relative Strength
 *   across all four windows, how long it has held its place, and how it got
 *   here.
 *
 * WHAT THIS MUST NEVER DO
 *   Compute a return. Every figure comes from engines that already exist —
 *   `buildSingleStockRSHistory` (written in M3 and unused until now),
 *   `computeMomentumAge`, and the ranking the universe screen already
 *   produced. This file selects and labels.
 *
 * WHY ALL FOUR WINDOWS APPEAR TOGETHER
 *   It is the one question a ranking cannot answer: whether a stock leads on
 *   every horizon or only the one currently selected. A stock ranked 1st on
 *   1M and 90th on 12M is a very different proposition from one ranked 3rd on
 *   all four, and the ranking alone makes them look identical.
 */

import { buildSingleStockRSHistory } from '../engine/rsHistory.js';
import { formatINR, formatPct, formatDate, formatGap, formatCompactNumber } from '../utils/formatters.js';
import { resolveTodayChange } from './todayChange.js';
import { MOMENTUM_DIRECTION } from '../engine/rsHistory.js';

const WINDOWS = [1, 3, 6, 12];

export function selectStockDetail({ data, symbol, universe, activeWindow = '1m', session = null }) {
  if (!data || !symbol) return null;

  /**
   * The selected window, as a number of months.
   *
   * This is the SAME slug the screen used to fetch `data` — the hook passes
   * `lookbackMonths` from it into `computeCurrentMomentum` — so the ranking
   * row below was computed over exactly this span. Parsed here so the card
   * can NAME its span rather than leaving the reader to infer it.
   */
  const parsedWindow = Number(String(activeWindow).replace('m', ''));
  const windowMonths = Number.isFinite(parsedWindow) && parsedWindow > 0 ? parsedWindow : 1;

  const ranked = data.currentMomentum?.ranked ?? [];
  const row = ranked.find((r) => r.symbol === symbol);
  const constituent = (universe?.stocks ?? []).find((s) => s.symbol === symbol);

  // Not in this universe at all, or excluded for want of data. Both are real
  // answers and neither is an error.
  if (!row && !constituent) return { found: false, symbol };

  const series = data.priceSeriesMap?.get(symbol) ?? [];
  const benchmarkSeries = data.benchmarkSeries ?? [];

  // The M3 engine, finally used. Indexes the month-ends once and shares that
  // index across all four windows, which is the whole reason it exists as one
  // function rather than four calls.
  const rsByWindow =
    series.length && benchmarkSeries.length
      ? buildSingleStockRSHistory({ series, benchmarkSeries, windows: WINDOWS, months: 6 })
      : new Map();

  const age = data.momentumAge?.get(symbol) ?? null;
  const isTopFive = (data.currentMomentum?.picks ?? []).some((p) => p.symbol === symbol);

  // ONE rule for the whole app — see selectors/todayChange.js.
  const today = resolveTodayChange(row, session);

  return {
    found: true,
    symbol,
    name: row?.name ?? constituent?.name ?? symbol,
    sector: row?.sector ?? constituent?.sector ?? null,
    universeLabel: universe?.label ?? null,
    benchmarkLabel: universe?.benchmark?.shortLabel ?? universe?.benchmark?.symbol ?? null,

    // Excluded from the ranking rather than absent from the universe — a
    // distinction worth stating, because the causes are different.
    isRanked: Boolean(row?.rank),
    /**
     * How many stocks the rank is out of.
     *
     * "#4" alone is meaningless — fourth of five is very different from
     * fourth of 250, and the reader has no way to tell which universe they
     * are in from the number itself. Counts only the RANKED rows: a stock
     * whose data failed has no rank, so including it would inflate the
     * denominator and quietly flatter every position above it.
     */
    universeSize: ranked.filter((r) => r.rank != null).length || null,
    rank: row?.rank ?? null,
    isTopFive,

    // The raw number as well as the label: the investment card multiplies by
    // it, and re-parsing a formatted string would be a rounding bug waiting.
    currentPrice: row?.currentPrice ?? null,
    // Which session the price is from, so "Last price · 07 Aug 2026" can be
    // stated rather than the reader having to assume it is current.
    currentPriceDate: row?.currentPriceDate ? formatDate(row.currentPriceDate) : null,
    priceLabel: row?.currentPrice == null ? null : formatINR(row.currentPrice),
    /**
     * TODAY, gated on the exchange's own calendar — see todayChange.js.
     * The market session is the sole authority; nothing here re-derives it.
     */
    today,
    dayChangeLabel: today.label,
    dayDirection: today.direction,
    isLiveDayChange: today.isLive,

    // The official prior month-end, with its date, so the current-month figure
    // beneath it is checkable rather than merely asserted.
    priorMonthEndLabel: row?.priorMonthEndPrice == null ? null : formatINR(row.priorMonthEndPrice),
    priorMonthEndDate: row?.priorMonthEndDate ? formatDate(row.priorMonthEndDate) : null,
    /**
     * MONTH TO DATE — window-independent, and deliberately kept separate.
     *
     * This is the "This month" tile: how far the stock has moved since the
     * last completed month-end, whatever window is selected. It is a real
     * thing a reader wants and it is honestly labelled with its own anchor
     * date, so it stays exactly as it was.
     *
     * What it is NOT is either leg of the comparison card below. Confusing
     * the two is precisely the bug fixed in v1.6.3 — see
     * `stockWindowReturnPct`.
     */
    monthToDatePct: row?.currentMonthReturnPct ?? null,
    currentMonthLabel: row?.currentMonthReturnPct == null ? null : formatPct(row.currentMonthReturnPct),
    currentMonthDirection: row?.currentMonthReturnPct == null ? null : row.currentMonthReturnPct >= 0 ? 'gain' : 'loss',

    /**
     * ═══════════════════════════════════════════════════════════════════
     * THE COMPARISON: STOCK, BENCHMARK, AND THE GAP — ALL OVER THE
     * SELECTED WINDOW, ALL FROM THE SAME DATES.
     *
     * THE BUG THIS FIXES (owner report, 28 Aug 2026). These three fields
     * used to be read off the ranking row like this:
     *
     *   stock leg      row.currentMonthReturnPct   ← ALWAYS one month
     *   benchmark leg  row.benchmarkReturnPct      ← the SELECTED window
     *   gap            row.rs                      ← the SELECTED window
     *
     * At a 1M window all three agree, which is why it shipped and survived.
     * At any other window the stock leg alone stayed pinned to one month, so
     * the card compared a 1-month stock return against a 6-month benchmark
     * return and printed a total belonging to neither. Worse, at 6M and 12M
     * the two visible rows implied the stock had TRAILED its benchmark while
     * the total beneath them said it had beaten it by 22 points. A reader
     * checking the subtraction — which the card's whole layout invites —
     * got a different answer, with a different sign.
     *
     * `computeCurrentMomentum` already computes all three consistently:
     * `computeStockRS` takes both legs from the same reference month-end and
     * runs both to the same latest bar, and `rs` is exactly their difference.
     * The fix is to read the pair it produces instead of substituting one
     * leg from somewhere else. No arithmetic was added here — this file
     * still computes nothing, which is the rule at the top of it.
     *
     * RENAMED FROM `stockSinceMonthEndPct` DELIBERATELY. A field called
     * "since month end" holding a six-month figure is how this survives a
     * second time; the name now says what the number is.
     * ═══════════════════════════════════════════════════════════════════
     */
    stockWindowReturnPct: row?.stockReturnPct ?? null,
    stockWindowReturnLabel: row?.stockReturnPct == null ? null : formatPct(row.stockReturnPct),
    stockWindowDirection: row?.stockReturnPct == null ? null : row.stockReturnPct >= 0 ? 'gain' : 'loss',
    benchmarkWindowReturnPct: row?.benchmarkReturnPct ?? null,
    benchmarkWindowReturnLabel: row?.benchmarkReturnPct == null ? null : formatPct(row.benchmarkReturnPct),

    /**
     * NOT LABELLED ALPHA. Formal alpha adjusts for how much market risk was
     * taken to earn the excess; this is a plain subtraction. Calling it alpha
     * would claim a rigour the arithmetic does not have.
     */
    outperformancePct: row?.rs ?? null,
    outperformanceLabel: row?.rs == null ? null : formatGap(row.rs, { digits: 2 }),
    outperformanceDirection: row?.rs == null ? null : row.rs >= 0 ? 'gain' : 'loss',

    /**
     * WHICH SPAN THE CARD ABOVE IS MEASURING, AND FROM WHEN.
     *
     * The card's heading used to read "Since the previous month-end" and its
     * subtitle "Both measured from <date> — the final trading session of last
     * month". Both were true only at 1M. Even with the figures corrected, a
     * card whose span changes silently underneath a fixed heading leaves the
     * reader unable to tell that the numbers moved because the WINDOW moved.
     *
     * `previousMonthEndDate` is the window's own reference session — the same
     * bar `computeStockRS` measured the stock leg from — so the date shown is
     * the date actually used, not one reconstructed from the window length.
     */
    comparisonMonths: windowMonths,
    comparisonWindowLabel: `${windowMonths}M`,
    comparisonFromDate: row?.previousMonthEndDate ? formatDate(row.previousMonthEndDate) : null,
    /**
     * Whether both legs start from the SAME session. They usually do; they
     * differ when a stock was halted on the reference month's last trading
     * day and the index was not, so the stock measures from the day before.
     * Reported rather than repaired — there is no price for a day the stock
     * did not trade, and inventing one is the fabrication this app refuses.
     */
    comparisonAligned:
      row?.previousMonthEndDate != null && row?.benchmarkPreviousMonthEndDate != null
        ? row.previousMonthEndDate === row.benchmarkPreviousMonthEndDate
        : null,
    comparisonBenchmarkFromDate: row?.benchmarkPreviousMonthEndDate
      ? formatDate(row.benchmarkPreviousMonthEndDate)
      : null,

    /**
     * VOLUME — cumulative for the session, and labelled as such.
     *
     * Yahoo returns `regularMarketVolume`, which is the running total of
     * shares traded since the open, NOT a rate. Showing it as "Volume"
     * invites reading it as activity happening now; a reader who saw
     * 2.4M at 10am and 2.4M at 3pm would conclude the stock had stopped
     * trading rather than that they had misread the field.
     */
    volume: row?.volume ?? null,
    volumeLabel: row?.volume == null ? null : formatCompactNumber(row.volume),
    /**
     * Whether the volume figure belongs to TODAY.
     *
     * Same rule as the day change, and for the same reason: this was
     * `Boolean(row.dailyChangeIsLive)`, which is true at the weekend
     * because a quote object comes back. The screen read "20.20L shares
     * traded today" on a Saturday. Volume is a cumulative session total, so
     * a stale one belongs to the last session that traded, not to today.
     */
    volumeIsToday: today.applicable,

    momentumAge: age?.consecutiveMonths ?? null,
    momentumAgeLabel:
      age == null
        ? null
        : age.consecutiveMonths === 1
          ? 'New entrant this month'
          : `${age.consecutiveMonths} consecutive months in the Top 5`,
    direction: row?.rsTrend ? MOMENTUM_DIRECTION[row.rsTrend] ?? null : null,

    /**
     * TREND — derived from the RS trend the engine already classifies.
     *
     * The brief asked for BULLISH / NEUTRAL / BEARISH and warned against
     * inventing thresholds. Gati already has one, in `engine/rsHistory.js`:
     * TREND_BAND_PP decides whether trailing Relative Strength has risen,
     * held or fallen. That is reused verbatim rather than a second,
     * disagreeing definition being introduced.
     *
     * The wording stays Gati's own — "Improving / Stable / Weakening"
     * describes what the number DID. "Bullish" describes what someone
     * expects it to do next, which this app does not claim to know.
     */
    trend: row?.rsTrend ? { key: row.rsTrend, ...MOMENTUM_DIRECTION[row.rsTrend] } : null,

    /** The full price series, for the chart. Sampled, never recomputed. */
    priceSeries: series,

    /**
     * RS across every window. A window with no history yields an EMPTY series,
     * never a zero — a fabricated 0.0pp would read as "kept pace with the
     * benchmark", which is a specific claim the data does not support.
     */
    windows: WINDOWS.map((months) => {
      const points = rsByWindow.get(months) ?? [];
      const latest = points[points.length - 1] ?? null;
      return {
        months,
        label: `${months}M`,
        isActive: `${months}m` === activeWindow,
        available: latest != null,
        rs: latest?.rs ?? null,
        rsLabel: latest?.rs == null ? null : formatGap(latest.rs, { digits: 1 }),
        direction: latest?.rs == null ? null : latest.rs >= 0 ? 'gain' : 'loss',
        stockReturnPct: latest?.stockReturnPct ?? null,
        benchmarkReturnPct: latest?.benchmarkReturnPct ?? null,
        asOf: latest?.signalDate ? formatDate(latest.signalDate) : null,
        history: points,
      };
    }),

    // Rank at each of the recent completed rebalances, oldest first. Straight
    // from the backtest's existing output — no ranking is recomputed.
    rankHistory: (data.backtest?.rankingHistory ?? [])
      .slice(-6)
      .map((snapshot) => {
        const entry = snapshot.rankings.find((r) => r.symbol === symbol);
        return {
          monthKey: snapshot.monthKey,
          rank: entry?.rank ?? null,
          rs: entry?.rs ?? null,
          rsLabel: entry?.rs == null ? null : formatGap(entry.rs, { digits: 1 }),
        };
      })
      .filter((entry) => entry.rank != null),

    // The tail of the price series, for the sparkline. Sampled, not computed.
    spark: series.length >= 2 ? series.slice(-60).map((bar) => bar.adjClose ?? bar.close).filter((v) => typeof v === 'number') : null,
  };
}
