import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUniverseBundle } from '../data/dataService.js';
import { getMarketStatus } from '../engine/tradingCalendar.js';
import { runBacktest } from '../engine/backtestEngine.js';
import { buildRSHistory, attachRSHistory, computeMomentumAge, summariseRebalance } from '../engine/rsHistory.js';
import { detectChanges, tradingDaysToRebalance } from '../engine/changeDetection.js';
import { calculateMaxDrawdown } from '../engine/metrics.js';
import { computeCurrentMomentum } from '../engine/currentMomentum.js';
import { assessHistorySufficiency } from '../engine/historySufficiency.js';
import { DEFAULT_CAPITAL_PER_UNIVERSE, TOP_N, TRANSACTION_COSTS, DATA_QUALITY_FLAGS, REFRESH_CADENCE_MS } from '../config/constants.js';

/**
 * Live refresh cadence during market hours.
 *
 * Moved to config/constants.js as REFRESH_CADENCE_MS so that the status
 * header reads the SAME number this poller uses. It previously said
 * "15 min" beside data refreshing every 30 seconds, because the two were
 * unrelated strings. Rationale for the value lives with the constant.
 */
const LIVE_REFRESH_MS = REFRESH_CADENCE_MS;

/**
 * Raw market-data fetch for one universe.
 *
 * Keyed ONLY on universeKey — deliberately. Everything that's a *strategy
 * parameter* rather than a *data* parameter (capital, topN, whether to
 * charge transaction costs) is applied afterwards in a useMemo by
 * useUniverseData below, so changing any of them re-runs the backtest
 * (microseconds, synchronous) without refetching 250 symbols over the
 * network. Before this split, `capital` was part of the query key, which
 * is why the Strategy page had to freeze it in a setterless useState to
 * avoid a full refetch on every keystroke.
 */
export function useUniverseHistory(universeKey) {
  return useQuery({
    queryKey: ['universe-data', universeKey],
    // All fetching lives in the data layer (spec Section 34). No fallback
    // mask on failure: if the live provider fails, this rejects, and the UI
    // shows an explicit error rather than synthetic data (see dataService.js).
    queryFn: () => fetchUniverseBundle(universeKey),
    // A falsy universeKey means the caller has nothing valid to ask for yet
    // (e.g. StrategyPage resolving an unknown strategy key before its
    // redirect renders) — don't fire a fetch that can only fail.
    enabled: Boolean(universeKey),
    staleTime: LIVE_REFRESH_MS,
    // Only poll while the market is actually open — a closed market can't
    // produce new prices, so refetching then would just be wasted requests
    // against a free, unofficial endpoint with no published quota. This is
    // re-evaluated on every tick, so polling starts automatically at market
    // open and stops automatically at close, without a page reload.
    refetchInterval: () => (getMarketStatus().status === 'OPEN' ? LIVE_REFRESH_MS : false),
  });
}

/**
 * Universe data + everything derived from it (backtest, live rankings).
 *
 * @param {string} universeKey
 * @param {Object} [options]
 * @param {number} [options.capital]         backtest starting capital
 * @param {number} [options.topN]
 * @param {boolean} [options.includeCosts]   charge transaction costs in the backtest
 * @param {number} [options.lookbackMonths]  measurement window (spec Section 25's
 *   longer-lookback strategies) — a STRATEGY parameter like the others above,
 *   not a data one, so switching windows re-runs the backtest over the
 *   already-fetched prices rather than refetching. Defaulting to 1
 *   reproduces the original single-strategy behaviour exactly.
 */
export function useUniverseData(
  universeKey,
  { capital = DEFAULT_CAPITAL_PER_UNIVERSE, topN = TOP_N, includeCosts = false, lookbackMonths = 1 } = {},
) {
  const query = useUniverseHistory(universeKey);

  const derived = useMemo(() => {
    if (!query.data) return null;
    const { stocks, priceSeriesMap, benchmarkSeries, quotes, unavailableSymbols } = query.data;

    // Transaction costs are now actually wired through (spec Section 16's
    // ON/OFF switch). Previously runBacktest was called with no costConfig
    // at all, so the whole cost module was unreachable dead code.
    const costConfig = { ...TRANSACTION_COSTS, enabled: includeCosts };

    const backtest = runBacktest({ stocks, priceSeriesMap, benchmarkSeries, initialCapital: capital, topN, costConfig, lookbackMonths });
    const currentMomentum = computeCurrentMomentum({ stocks, priceSeriesMap, benchmarkSeries, quotes, topN, unavailableSymbols, lookbackMonths });

    // Sample-size honesty check (spec Sections 39/41) — a longer window
    // burns more of the available history before its first signal, so the
    // same DATA_START_DATE yields far fewer completed rebalances. See
    // engine/historySufficiency.js for the thresholds and reasoning.
    const historySufficiency = assessHistorySufficiency({ cyclesCount: backtest.cycles.length, lookbackMonths });

    // M6 / decision D12 — the universe screen must answer "why is this ranked
    // here?" and "what changed?". Both are PROJECTIONS of work the backtest
    // already did: it ranks the whole universe at every month-end, so the
    // trailing RS series and the entry/exit diff cost a pass over existing
    // output rather than a second pass over prices.
    const rsHistoryBySymbol = buildRSHistory({ rankingHistory: backtest.rankingHistory, topN });
    const changes = detectChanges({ rankingHistory: backtest.rankingHistory, topN });
    const daysToRebalance = tradingDaysToRebalance(benchmarkSeries);

    // Decision D13 — both are projections of rankingHistory, which the
    // backtest above already produced. No prices re-read, no ranking redone.
    const momentumAge = computeMomentumAge({ rankingHistory: backtest.rankingHistory, topN });
    const rebalanceSummary = summariseRebalance({ changes, topN });

    // HEADLINE METRICS — computed ONCE, here, rather than inline in a page.
    //
    // These were previously derived inside StrategyPage, which put a financial
    // calculation in a component and meant a second screen showing the same
    // figures would have had to repeat the arithmetic. Two copies of one
    // formula is exactly how two screens end up disagreeing about a number.
    //
    // All three are capital-independent (decision D1): the strategy return
    // comes from the base-100 index, and the benchmark from its own compounded
    // month-end returns, so neither depends on the notional.
    const last = backtest.equityCurve[backtest.equityCurve.length - 1] ?? null;
    const strategyReturnPct = last ? last.indexValue - 100 : null;

    const benchmarkReturnPct = backtest.cycles.length
      // `benchmarkHoldingReturnPct` is the benchmark's move over the SAME
      // holding period as the cycle — signal-to-signal — which is the like-for
      // like comparison. `signalBenchmarkReturnPct` is the ranking input and
      // covers a different span; using it here would compare two different
      // periods and call the difference alpha.
      ? (backtest.cycles.reduce((acc, c) => acc * (1 + (c.benchmarkHoldingReturnPct ?? 0) / 100), 1) - 1) * 100
      : null;

    const headline = {
      strategyReturnPct,
      benchmarkReturnPct,
      outperformancePct:
        strategyReturnPct == null || benchmarkReturnPct == null ? null : strategyReturnPct - benchmarkReturnPct,
      // Measured on the index, so the drawdown is a percentage of the
      // portfolio rather than of an assumed rupee amount.
      // calculateMaxDrawdown returns { value, peakIndex, troughIndex } — the
      // percentage is `.value`, and it is reported as a NEGATIVE number
      // because a drawdown is a fall.
      maxDrawdownPct: -Math.abs(calculateMaxDrawdown(backtest.equityCurve.map((p) => p.indexValue)).value),
      completedCycles: backtest.cycles.length,
    };

    // Spec Section 40: if today's constituent list is used for historical
    // dates, that must be labelled in the product, not just the README.
    // Every universe here uses a current snapshot, so this always applies.
    const limitations = [DATA_QUALITY_FLAGS.SURVIVORSHIP_BIAS];

    return {
      backtest: { ...backtest, ...headline },
      headline,
      currentMomentum: {
        ...currentMomentum,
        ranked: attachRSHistory(currentMomentum.ranked, rsHistoryBySymbol),
      },
      rsHistoryBySymbol,
      momentumAge,
      rebalanceSummary,
      changes,
      daysToRebalance,
      historySufficiency,
      limitations,
      costsApplied: includeCosts,
    };
  }, [query.data, capital, topN, includeCosts, lookbackMonths]);

  return {
    ...query,
    data: query.data && derived ? { ...query.data, ...derived } : undefined,
  };
}
