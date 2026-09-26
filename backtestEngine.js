import { getMonthEndRecords, getNextTradingDay } from './tradingCalendar.js';
import { computeStockRS } from './momentum.js';
import { rankByRS, selectTopN } from './ranking.js';
import { markToExit } from './portfolio.js';
import { allocate, RECORD_WEIGHTING, isCapitalIndependent } from './weighting.js';
import { calculateRoundTripCost } from './transactionCosts.js';
import { EXECUTION_PRICE_FIELD, DEFAULT_CAPITAL_PER_UNIVERSE, TOP_N, DATA_QUALITY_FLAGS } from '../config/constants.js';

function indexByDate(series) {
  const map = new Map();
  for (const record of series) map.set(record.date, record);
  return map;
}

function indexByMonthKey(monthEndRecords) {
  const map = new Map();
  for (const record of monthEndRecords) map.set(record.monthKey, record);
  return map;
}

function priceOn(seriesByDate, date, field) {
  const record = seriesByDate.get(date);
  const value = record?.[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Runs the full monthly RS-momentum backtest for one universe.
 *
 * @param {Object} args
 * @param {Array<{symbol:string,name:string}>} args.stocks
 * @param {Map<string, Array>} args.priceSeriesMap  symbol -> ascending daily records
 * @param {Array} args.benchmarkSeries               ascending daily records (acts as the master trading-day calendar)
 * @param {number} [args.initialCapital]
 * @param {number} [args.topN]
 * @param {Object} [args.costConfig]
 * @param {number} [args.lookbackMonths=1]  measurement window, in month-ends.
 *   1 = the original monthly RS strategy. 3/6/12 give the longer-lookback
 *   variants from spec Section 25. This changes ONLY the window the return
 *   is measured over — the rebalance cadence stays monthly either way, which
 *   is what "3-month momentum, rebalanced monthly" conventionally means.
 *   Defaulting to 1 keeps every existing caller and result bit-identical.
 *
 * Returns { cycles, equityCurve, currentHolding, rankingHistory, flags }.
 * - `cycles`: one entry per COMPLETED rebalance (has both entry and exit) —
 *   this is the Monthly Performance Table (spec Section 19).
 * - `currentHolding`: the most recent picks that have been entered but not
 *   yet exited (still open) — deliberately NOT included in `cycles`, per
 *   spec Section 20's instruction not to confuse live/open positions with
 *   completed backtest history.
 * - `rankingHistory`: one full-universe rank+RS snapshot per signal date,
 *   for the ranking-history chart (spec Section 27) — independent of
 *   whether that signal ever got executed as a trade.
 */
export function runBacktest({
  stocks,
  priceSeriesMap,
  benchmarkSeries,
  initialCapital = DEFAULT_CAPITAL_PER_UNIVERSE,
  topN = TOP_N,
  costConfig,
  lookbackMonths = 1,
  weighting = RECORD_WEIGHTING,
}) {
  const flags = [];
  const benchmarkMonthEnds = getMonthEndRecords(benchmarkSeries);
  const benchmarkByDate = indexByDate(benchmarkSeries);

  // A k-month lookback needs k+1 month-ends before it can rank anything at
  // all. Flagging rather than returning a misleading empty result (Section 41).
  if (benchmarkMonthEnds.length < lookbackMonths + 1) {
    return {
      cycles: [], equityCurve: [], currentHolding: null, rankingHistory: [],
      flags: [...flags, DATA_QUALITY_FLAGS.INCOMPLETE_MONTH],
      weighting, isCapitalIndependent: isCapitalIndependent(weighting), notionalBase: initialCapital,
    };
  }

  // Build a per-stock month-end index and full-date index once, up front.
  const stockMonthEndsBySymbol = new Map();
  const stockByDateBySymbol = new Map();
  for (const { symbol } of stocks) {
    const series = priceSeriesMap.get(symbol) ?? [];
    stockMonthEndsBySymbol.set(symbol, indexByMonthKey(getMonthEndRecords(series)));
    stockByDateBySymbol.set(symbol, indexByDate(series));
  }

  const cycles = [];
  const equityCurve = [];
  const rankingHistory = []; // one snapshot per signal date — powers the ranking-history chart, kept separate from cycles/equityCurve so nothing about the existing trade logic changes
  let capitalAvailable = initialCapital;
  let openPositions = null; // positions currently held, awaiting exit
  let openEntryDate = null;
  let openRankSnapshot = null;

  // Ranking starts at benchmarkMonthEnds[lookbackMonths] — the first month
  // that has a full measurement window behind it. Spec Section 4/8: data
  // starts 2025-01-01, so the earliest months are deliberately skipped
  // rather than measured against a partial window.
  for (let i = lookbackMonths; i < benchmarkMonthEnds.length; i++) {
    const signal = benchmarkMonthEnds[i];
    const previousSignal = benchmarkMonthEnds[i - lookbackMonths];

    // --- 1. Rank the universe as of this month-end ---
    const rsRows = stocks.map(({ symbol, name }) => {
      const monthEnds = stockMonthEndsBySymbol.get(symbol);
      const currentRecord = monthEnds.get(signal.monthKey);
      const previousRecord = monthEnds.get(previousSignal.monthKey);
      if (!currentRecord || !previousRecord) {
        return { symbol, name, rs: null, stockReturnPct: null, benchmarkReturnPct: null, flags: [DATA_QUALITY_FLAGS.MISSING_DATA] };
      }
      const result = computeStockRS({
        currentRecord,
        previousRecord,
        currentBenchmark: signal,
        previousBenchmark: previousSignal,
      });
      return { symbol, name, ...result };
    });

    const ranked = rankByRS(rsRows);
    const { picks, isShort, shortfall } = selectTopN(ranked, topN);

    rankingHistory.push({
      monthKey: signal.monthKey,
      date: signal.date,
      rankings: ranked.map((r) => ({ symbol: r.symbol, name: r.name, rank: r.rank, rs: r.rs })),
    });

    // --- 2. Find the execution day (next trading day after the signal date) ---
    const executionRecord = getNextTradingDay(benchmarkSeries, signal.date);
    if (!executionRecord) {
      // Signal is the most recent month-end and the market hasn't opened
      // again yet — nothing to execute on. Stop here; these picks become
      // the "current momentum" leaders shown live, not a backtest cycle.
      break;
    }

    // --- 3. If a position is already open, exit it at this execution day ---
    if (openPositions) {
      const exitPrices = new Map();
      for (const pos of openPositions.positions) {
        const price = priceOn(stockByDateBySymbol.get(pos.symbol), executionRecord.date, EXECUTION_PRICE_FIELD);
        if (price != null) exitPrices.set(pos.symbol, price);
      }
      const { positions: exitedPositions, totalExitValue, flags: exitFlags } = markToExit(openPositions.positions, exitPrices);
      flags.push(...exitFlags);

      const benchmarkEntryPrice = priceOn(benchmarkByDate, openEntryDate, EXECUTION_PRICE_FIELD);
      const benchmarkExitPrice = priceOn(benchmarkByDate, executionRecord.date, EXECUTION_PRICE_FIELD);
      const benchmarkHoldingReturnPct =
        benchmarkEntryPrice && benchmarkExitPrice ? ((benchmarkExitPrice / benchmarkEntryPrice) - 1) * 100 : null;

      const totalInvested = openPositions.totalInvested;
      const roundTripCost = costConfig?.enabled
        ? exitedPositions.reduce((sum, p) => sum + calculateRoundTripCost(p.invested, p.exitValue ?? 0, costConfig), 0)
        : 0;
      const netExitValue = totalExitValue - roundTripCost + openPositions.remainingCash;
      const portfolioHoldingReturnPct = totalInvested > 0 ? ((netExitValue - (totalInvested + openPositions.remainingCash)) / (totalInvested + openPositions.remainingCash)) * 100 : null;

      const realizedCycle = {
        rankedAtMonthKey: openRankSnapshot.signal.monthKey,
        signalBenchmarkReturnPct: openRankSnapshot.signal.rsContext, // filled below
        entryDate: openEntryDate,
        exitDate: executionRecord.date,
        picks: exitedPositions.map((p) => ({
          ...p,
          holdingReturnPct: p.exitValue != null ? ((p.exitValue / p.invested) - 1) * 100 : null,
        })),
        capitalAtStart: totalInvested + openPositions.remainingCash,
        totalInvested,
        cashCarriedIn: openPositions.remainingCash,
        transactionCosts: roundTripCost,
        exitValue: netExitValue,
        portfolioHoldingReturnPct,
        benchmarkHoldingReturnPct,
        differencePct: portfolioHoldingReturnPct != null && benchmarkHoldingReturnPct != null ? portfolioHoldingReturnPct - benchmarkHoldingReturnPct : null,
        isShortOfTopN: openRankSnapshot.isShort,
      };

      cycles.push(realizedCycle);
      equityCurve.push({
        date: executionRecord.date,
        monthKey: signal.monthKey,
        value: netExitValue,
        // Base-100 index. Under FRACTIONAL weighting this is invariant to
        // `initialCapital`, which is what makes it safe to publish; `value`
        // is retained for the Investment Simulator and existing callers.
        indexValue: (netExitValue / initialCapital) * 100,
      });
      capitalAvailable = netExitValue;
    } else {
      equityCurve.push({
        date: executionRecord.date,
        monthKey: signal.monthKey,
        value: capitalAvailable,
        indexValue: (capitalAvailable / initialCapital) * 100,
      });
    }

    // --- 4. Enter the new picks at this same execution day ---
    if (picks.length > 0) {
      const picksWithEntry = picks
        .map((pick) => {
          const entryPrice = priceOn(stockByDateBySymbol.get(pick.symbol), executionRecord.date, EXECUTION_PRICE_FIELD);
          return entryPrice != null ? { ...pick, entryPrice } : null;
        })
        .filter(Boolean);

      const built = allocate(picksWithEntry, capitalAvailable, weighting);
      openPositions = built;
      openEntryDate = executionRecord.date;
      openRankSnapshot = { signal: { monthKey: signal.monthKey, rsContext: null }, isShort };
    } else {
      openPositions = null;
      flags.push(`No eligible picks at ${signal.monthKey} month-end — capital held as cash.`);
    }

    if (isShort) {
      flags.push(`Only ${picks.length} of ${topN} positions available for ${signal.monthKey} (shortfall: ${shortfall}).`);
    }
  }

  const currentHolding = openPositions
    ? { entryDate: openEntryDate, positions: openPositions.positions, totalInvested: openPositions.totalInvested, remainingCash: openPositions.remainingCash }
    : null;

  return {
    cycles,
    equityCurve,
    currentHolding,
    rankingHistory,
    flags,
    // Stated in the result, not assumed by the reader. A consumer that shows
    // a rupee figure from a capital-independent run would be reintroducing
    // the assumed account size decision D1 removed.
    weighting,
    isCapitalIndependent: isCapitalIndependent(weighting),
    notionalBase: initialCapital,
  };
}
