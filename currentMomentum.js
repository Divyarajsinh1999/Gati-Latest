import { getMonthEndRecords, monthKey, previousMonthKey, istDateString } from './tradingCalendar.js';
import { computeStockRS } from './momentum.js';
import { rankByRS, selectTopN } from './ranking.js';
import { TOP_N, DATA_QUALITY_FLAGS } from '../config/constants.js';

/**
 * In-progress current-month momentum (spec Section 20).
 *
 *   Current Month Return % = ((Current Price / Previous Month-End Price) - 1) × 100
 *
 * THE SUBTLETY THAT MATTERS — what "Previous Month-End" means:
 * `getMonthEndRecords` returns the last available bar of EVERY month,
 * including the current, still-incomplete one. So its final entry is
 * today's bar, not last month's close. An earlier version of this code
 * took that final entry as the reference price, which meant it divided
 * today's price by itself: every stock reported exactly 0.00% return and
 * an RS of exactly 0, and the "live ranking" silently degenerated into the
 * alphabetical tie-break. The reference must be the last month-end
 * STRICTLY BEFORE the month the latest bar falls in.
 *
 * That distinction only shows up mid-month, which is why it survived a
 * build, a lint pass and a full test suite — and it's the reason this logic
 * now lives in an engine module with its own tests rather than inline in a
 * React hook.
 *
 * The benchmark and every stock are anchored to the SAME reference month,
 * so a stock that happens to be missing that month's data is excluded and
 * flagged rather than being compared against a different period.
 *
 * LOOKBACK WINDOW (added for Phase 4 / spec Section 25's longer-lookback
 * rules): `lookbackMonths` generalises "previous month-end" to "the
 * month-end `lookbackMonths` back from the current in-progress month".
 * Defaulting to 1 reproduces the original behaviour exactly — the very bug
 * this file's regression tests guard against — so this is additive, not a
 * silent change to the shipped 1-month strategy. This keeps the live
 * ranking shown on a strategy page measuring over the SAME window as the
 * backtest above it, rather than a 12-month strategy's backtest sitting
 * next to a "current momentum" table that's secretly still 1-month.
 */
export function computeCurrentMomentum({ stocks = [], priceSeriesMap, benchmarkSeries = [], quotes, topN = TOP_N, unavailableSymbols = [], lookbackMonths = 1 } = {}) {
  // Symbols whose fetch failed outright (renamed/delisted ticker, etc.), as
  // opposed to symbols we have data for that merely doesn't reach far
  // enough back. Same visible outcome — an unranked row — but a different
  // flag, because the fix is different. See DATA_QUALITY_FLAGS.
  const unavailable = new Map(unavailableSymbols.map((u) => [u.symbol, { reason: u.reason, suggestion: u.suggestion ?? null }]));
  const empty = { picks: [], ranked: [], asOf: null, basedOnMonthKey: null, flags: [] };
  if (benchmarkSeries.length === 0) {
    return { ...empty, flags: [DATA_QUALITY_FLAGS.BENCHMARK_MISSING] };
  }

  const latestBenchmark = benchmarkSeries[benchmarkSeries.length - 1];
  const currentMonthKey = monthKey(latestBenchmark.date);

  // The month-end `lookbackMonths` back from the current (possibly
  // incomplete) month. `priorMonthEnds` is ascending, so its LAST entry is
  // 1 month back, the second-to-last is 2 months back, and so on — hence
  // indexing from the end by `lookbackMonths`. lookbackMonths=1 reduces to
  // exactly the original "last element" lookup.
  const priorMonthEnds = getMonthEndRecords(benchmarkSeries).filter((m) => m.monthKey < currentMonthKey);
  const referenceBenchmark = priorMonthEnds[priorMonthEnds.length - lookbackMonths];

  if (!referenceBenchmark) {
    // Fewer completed months exist than the window needs, so there is
    // nothing valid to measure the current month against. Say so rather
    // than reporting a fabricated 0% or silently falling back to a
    // shorter window than the one asked for.
    return {
      ...empty,
      asOf: latestBenchmark.date,
      flags: [
        `${DATA_QUALITY_FLAGS.INCOMPLETE_MONTH}: fewer than ${lookbackMonths} completed month(s) before ${currentMonthKey} to measure against`,
      ],
    };
  }

  // Benchmark's own prior month-end, computed once outside the row loop.
  const benchmarkPriorEntry = priorMonthEnds[priorMonthEnds.length - 1] ?? null;
  const benchmarkPriorMonthEnd = benchmarkPriorEntry
    ? (benchmarkPriorEntry.adjClose ?? benchmarkPriorEntry.close ?? null)
    : null;
  const benchmarkLatestClose = latestBenchmark.adjClose ?? latestBenchmark.close ?? null;

  const rows = stocks.map((stock) => {
    const { symbol, name, sector, isSynthetic } = stock;
    const series = priceSeriesMap?.get(symbol) ?? [];
    const latestRecord = series[series.length - 1];
    const quote = quotes?.get(symbol);

    // Display-only fields (spec Section 21). The live quote is used here but
    // deliberately NOT inside the RS maths below — see the note on price
    // convention at the bottom of this file.
    // Month-end index computed ONCE per stock and reused for both the
    // window reference and the always-1-month figure below. Calling
    // getMonthEndRecords twice per stock would double the cost of the
    // hottest loop in the app for no benefit.
    const stockMonthEnds = getMonthEndRecords(series);
    const referenceRecord = stockMonthEnds.find((m) => m.monthKey === referenceBenchmark.monthKey);

    // THE OFFICIAL PREVIOUS MONTH-END, always one month back regardless of
    // the active window. A 3-month strategy still needs to show "previous
    // month's close" and "this month so far" — those are facts about the
    // stock, not about the strategy being viewed.
    //
    // Never estimated, never the calendar's last date: this is the last bar
    // that ACTUALLY EXISTS in the prior month, which is why a month ending
    // on a holiday (28 Mar 2025 for Id-Ul-Fitr) resolves correctly with no
    // holiday list involved.
    /**
     * ═══════════════════════════════════════════════════════════════════
     * IS THIS SERIES STILL RUNNING? — asked BEFORE any month-end is read.
     *
     * THE BUG THIS CLOSES (owner report, 27 Aug 2026: "the previous-month
     * date keeps changing"). The prior month-end below is the stock's own
     * last bar before the current month. While a stock trades that is the
     * right rule and resolves holidays with no calendar involved. The
     * moment a stock STOPS — halt, suspension, a rename the fetch layer
     * did not catch — it silently becomes the wrong rule.
     *
     * A series ending 27 July, read on 27 August, produced:
     *
     *   prev month close   27 Jul, a mid-month bar wearing a month-end's
     *                      label — and the date the owner watched drift
     *   current price      27 Jul, the very same bar
     *   month to date      0.00%, that bar divided by itself
     *   ranking            included, on a return never earned
     *
     * This is the same divide-by-itself failure the header of this file
     * describes for the BENCHMARK. It was fixed there and survived here,
     * per stock, for as long as a symbol has been able to go quiet.
     *
     * THE RULE: a stock with no bar in the benchmark's current month has
     * no current-month price, and therefore no current-month return. Not
     * zero — absent. It is flagged STALE_PRICE and left unranked.
     *
     * Deliberately NOT a tolerance in days. "Has it traded this month" is
     * a fact; "is five sessions too many" is a judgement, and a stock
     * halted for a week mid-month still has a real August price to
     * measure. Thin trading is a liquidity question, answered elsewhere.
     * ═══════════════════════════════════════════════════════════════════
     */
    const isStale =
      latestRecord != null && monthKey(latestRecord.date) !== currentMonthKey;

    const priorMonthEnd = isStale
      ? null
      : stockMonthEnds.filter((m) => m.monthKey < currentMonthKey).pop() ?? null;
    const priorMonthEndPrice = priorMonthEnd ? (priorMonthEnd.adjClose ?? priorMonthEnd.close ?? null) : null;
    const latestClose = latestRecord ? (latestRecord.adjClose ?? latestRecord.close ?? null) : null;

    // Current month-to-date %, computed on the ADJUSTED basis on both sides
    // so it survives a corporate action mid-month. Deliberately NOT derived
    // from the live quote, which is unadjusted — see the note at the bottom
    // of this file.
    /**
     * MONTH TO DATE — only when the anchor really is LAST month.
     *
     * `priorMonthEnd` is the newest month-end before the current one, which
     * for a stock trading normally is last month. For a stock with a GAP it
     * is not: a series with June bars and August bars but no July anchors to
     * 30 June, and dividing August's price by it yields a TWO-month move
     * that the detail screen labels "This month" (audit, v1.6.4 — measured
     * at +14.43% for a stock whose actual August move was smaller).
     *
     * The row is already excluded from the ranking for want of a reference
     * month, so the ranking was never wrong. The figure was, and the detail
     * screen renders it for any symbol reachable by URL.
     *
     * So the anchor must be the immediately preceding calendar month. If it
     * is not, there is no month-to-date figure — absent, not approximated.
     */
    const expectedPriorKey = previousMonthKey(currentMonthKey);
    const priorIsLastMonth = priorMonthEnd?.monthKey === expectedPriorKey;

    const currentMonthReturnPct =
      priorIsLastMonth && priorMonthEndPrice != null && latestClose != null && priorMonthEndPrice > 0
        ? ((latestClose / priorMonthEndPrice) - 1) * 100
        : null;

    // Day change from the live quote when available. The fallback compares
    // the last two CLOSES rather than fabricating a zero, and is flagged as
    // a fallback so the UI can say the market is closed rather than implying
    // a live tick.
    const previousBar = series.length >= 2 ? series[series.length - 2] : null;
    const fallbackDayPct =
      previousBar?.close > 0 && latestRecord?.close != null
        ? ((latestRecord.close / previousBar.close) - 1) * 100
        : null;

    const display = {
      sector: sector ?? null,
      isSynthetic: Boolean(isSynthetic),
      // The window's reference price (equals the previous month-end when the
      // window is 1 month, which is the common case).
      previousMonthEndPrice: referenceRecord ? (referenceRecord.adjClose ?? referenceRecord.close ?? null) : null,
      previousMonthEndDate: referenceRecord?.date ?? null,
      // The official prior month-end, window-independent. Stated with its
      // date so the figure is checkable rather than merely asserted.
      priorMonthEndPrice,
      priorMonthEndDate: priorMonthEnd?.date ?? null,
      priorMonthEndKey: priorMonthEnd?.monthKey ?? null,

      /**
       * The last session this stock has data for, and whether that puts it
       * behind the market.
       *
       * Stated rather than merely acted on: a row that vanished from the
       * ranking with no reason attached is indistinguishable from a bug,
       * and the reader is the only one who can tell a delisting from a
       * halt from a ticker this app has wrong in its universe file.
       */
      lastBarDate: latestRecord?.date ?? null,
      isStale,

      /**
       * DO THE TWO LEGS MEASURE FROM THE SAME SESSION?
       *
       * The stock's prior month-end and the benchmark's are each the last
       * bar that ACTUALLY EXISTS in that month, which is the right rule —
       * it resolves a month ending on a Saturday or a holiday with no
       * calendar lookup at all. But the two can legitimately differ: if a
       * stock is halted on 31 July and the index is not, the stock measures
       * from the 30th and the benchmark from the 31st.
       *
       * Relative Strength then subtracts two returns measured over
       * different spans. Usually the distortion is small; occasionally, on
       * a volatile final session, it is not.
       *
       * FORCING ALIGNMENT WOULD BE WORSE. There is no stock price for a day
       * the stock did not trade, and inventing one to make the dates match
       * is exactly the fabrication this app refuses everywhere else. So the
       * mismatch is REPORTED rather than repaired, and the interface can
       * say the two legs start from different sessions.
       */
      benchmarkPriorMonthEndDate: benchmarkPriorEntry?.date ?? null,
      priorMonthEndAligned:
        priorMonthEnd?.date != null && benchmarkPriorEntry?.date != null
          ? priorMonthEnd.date === benchmarkPriorEntry.date
          : null,

      /**
       * THE SAME QUESTION, ASKED OF THE WINDOW'S REFERENCE SESSION.
       *
       * The two fields above describe the 1-MONTH anchor, which is what the
       * "This month" figure measures from. At a 3, 6 or 12-month window the
       * RS legs measure from a DIFFERENT month-end entirely, and whether
       * those two dates line up is a separate fact that nothing reported.
       *
       * Added in v1.6.3, when the stock detail card started showing the
       * window legs: the card states where each leg starts, so it needs the
       * benchmark's reference date and not merely the stock's. At a 1-month
       * window these collapse onto the pair above, as they should.
       */
      benchmarkPreviousMonthEndDate: referenceBenchmark.date,
      previousMonthEndAligned:
        referenceRecord?.date != null
          ? referenceRecord.date === referenceBenchmark.date
          : null,
      currentMonthReturnPct,
      currentPrice: quote?.price ?? latestRecord?.close ?? null,
      currentPriceDate: latestRecord?.date ?? null,
      dailyChangePct: quote?.changePct ?? fallbackDayPct,
      /**
       * WHICH SESSION THE DAY CHANGE BELONGS TO — the field that makes it
       * checkable instead of merely present.
       *
       * `dailyChangeIsLive` used to mean "a quote object came back", which
       * is true at the weekend: Yahoo returns the last session's quote,
       * change percentage and all. The UI read that as live and printed
       * Friday's move under a label saying TODAY.
       *
       * The date is taken from the quote's own `regularMarketTime` where
       * there is one, and from the last bar otherwise. The view layer
       * compares it against the exchange's trading date — see
       * selectors/todayChange.js. The engine deliberately does NOT make
       * that judgement itself: it has no clock and should not acquire one.
       */
      dailyChangeAsOf:
        (quote?.changePct != null ? istDateString(quote.asOf) : null) ?? latestRecord?.date ?? null,
      dailyChangeIsLive: quote?.changePct != null,
      volume: quote?.volume ?? latestRecord?.volume ?? null,
      // Which field the return maths used, so a fallback to unadjusted close
      // is visible rather than silent.
      priceBasis: latestRecord?.adjClose != null ? 'adjClose' : latestRecord?.close != null ? 'close' : null,
    };

    if (!referenceRecord || !latestRecord || isStale) {
      const isUnavailable = unavailable.has(symbol);
      const failure = isUnavailable ? unavailable.get(symbol) : null;

      /*
        Three exclusions, three different remedies, so three different
        flags. SYMBOL_UNAVAILABLE means the fetch failed and the ticker
        needs correcting; MISSING_DATA means the series does not reach back
        far enough and needs more history; STALE_PRICE means the series is
        real but has stopped, and the symbol needs checking for a halt or a
        delisting. Collapsing them would send the reader to the wrong fix.
      */
      const flag = isUnavailable
        ? DATA_QUALITY_FLAGS.SYMBOL_UNAVAILABLE
        : isStale
          ? DATA_QUALITY_FLAGS.STALE_PRICE
          : DATA_QUALITY_FLAGS.MISSING_DATA;

      return {
        symbol,
        name,
        ...display,
        rs: null,
        stockReturnPct: null,
        benchmarkReturnPct: null,
        isUnavailable,
        unavailableReason:
          failure?.reason ??
          (isStale
            ? `No price data since ${latestRecord?.date ?? 'an earlier session'} — the market has traded to ${latestBenchmark.date}`
            : null),
        // A known-rename suggestion for a human to verify — never acted on
        // automatically. See config/renamedTickers.js.
        unavailableSuggestion: failure?.suggestion ?? null,
        flags: [flag],
      };
    }

    const result = computeStockRS({
      currentRecord: latestRecord,
      previousRecord: referenceRecord,
      currentBenchmark: latestBenchmark,
      previousBenchmark: referenceBenchmark,
    });
    return { symbol, name, ...display, ...result };
  });

  const ranked = rankByRS(rows);
  const { picks } = selectTopN(ranked, topN);

  return {
    picks,
    ranked,
    asOf: latestBenchmark.date,
    basedOnMonthKey: referenceBenchmark.monthKey,
    referenceDate: referenceBenchmark.date,
    currentMonthKey,
    // The benchmark's own month-to-date move, so the UI can show what the
    // stock's current-month figure is being judged against without
    // recomputing it per row.
    benchmarkCurrentMonthReturnPct: benchmarkPriorMonthEnd && benchmarkLatestClose != null && benchmarkPriorMonthEnd > 0
      ? ((benchmarkLatestClose / benchmarkPriorMonthEnd) - 1) * 100
      : null,
    isCurrentMonthComplete: false,
    flags: [],
  };
}

/**
 * PRICE CONVENTION NOTE.
 *
 * RS above is computed from the price SERIES, not from the live quote
 * object, for two reasons. A daily-interval bar for the current day is an
 * in-progress bar whose close already tracks the live price, so nothing is
 * lost. And more importantly it shares the adjusted-close basis of the
 * month-end it is divided by — substituting a raw unadjusted quote price
 * into an adjusted-price ratio would break across any split or bonus since
 * that month-end, which is precisely the silent convention-mixing spec
 * Section 6 forbids.
 *
 * The live quote still drives the "Current Price" and "Daily Change %"
 * columns Section 21 asks for; it just stays out of the return maths.
 */
