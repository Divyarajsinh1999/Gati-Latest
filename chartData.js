/**
 * Data transforms behind the charts.
 *
 * Extracted from the chart components for two reasons. First, spec Section
 * 34 says UI components shouldn't be doing the calculating. Second, and more
 * practically: Recharts 3.x measures real layout to decide what to draw, and
 * jsdom provides none, so a rendered chart in tests yields no plottable
 * geometry to assert on. Asserting on these transforms instead answers the
 * question that actually matters — *are the numbers right?* — without
 * needing a real browser.
 *
 * (Full geometry assertions would need vitest browser mode plus Playwright.
 * That was judged a poor trade for this project's scope; see TODO.md.)
 */

/**
 * Zips the strategy and benchmark curves into rows for the equity chart.
 * Pairs by INDEX, matching how the benchmark curve is constructed — one
 * point per rebalance, in the same order — and yields null rather than
 * dropping a row when the benchmark is short, so a gap shows as a gap.
 */
export function buildEquityComparisonSeries(equityCurve = [], benchmarkCurve = []) {
  return equityCurve.map((point, i) => ({
    date: point.date,
    Portfolio: point.value,
    Benchmark: benchmarkCurve[i]?.value ?? null,
  }));
}

/**
 * The benchmark's own equity curve, indexed to 100 alongside the strategy's.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * MOVED HERE IN v1.6.1, from inside recordView.js, when the Dashboard gained
 * the same chart. It is compounding, and compounding written twice is two
 * chances to disagree about what the benchmark did — the kind of divergence
 * nobody notices until two screens show different numbers for one month.
 *
 * WHY IT COMPOUNDS THE CYCLES RATHER THAN READING THE INDEX DIRECTLY
 * The benchmark leg of each rebalance is a HOLDING-PERIOD return: what the
 * index did between this month's execution and the next one. Chaining those
 * is what makes the two lines comparable — both answer "what would this have
 * done to money held over exactly these periods", so a gap between them is
 * the strategy's doing and not an artefact of measuring different spans.
 *
 * A null benchmark return is treated as a flat period rather than breaking
 * the chain. That is the lesser of two evils and it is not free: it
 * understates a month the index actually moved. Breaking the chain would
 * discard every point after it, which is worse.
 * ═════════════════════════════════════════════════════════════════════════
 */
export function buildIndexedBenchmarkCurve(curve = [], cycles = []) {
  if (curve.length === 0) return [];
  const out = [{ date: curve[0].date, monthKey: curve[0].monthKey, value: 100 }];
  let value = 100;
  cycles.forEach((cycle, i) => {
    value *= 1 + (cycle.benchmarkHoldingReturnPct ?? 0) / 100;
    const point = curve[i + 1];
    if (point) out.push({ date: point.date, monthKey: point.monthKey, value });
  });
  return out;
}

/**
 * Underwater (drawdown) series: percentage below the running peak at each
 * point. Peak is monotonic non-decreasing, so drawdown is always <= 0.
 */
export function buildDrawdownSeries(equityCurve = []) {
  const { rows } = equityCurve.reduce(
    (acc, point) => {
      const peak = Math.max(acc.peak, point.value);
      const drawdownPct = peak > 0 ? ((point.value - peak) / peak) * 100 : 0;
      return { peak, rows: [...acc.rows, { date: point.date, Drawdown: drawdownPct }] };
    },
    { peak: -Infinity, rows: [] },
  );
  return rows;
}

/** Per-cycle portfolio vs benchmark returns for the monthly bar chart. */
export function buildMonthlyReturnsSeries(cycles = []) {
  return cycles.map((c) => ({
    date: c.exitDate,
    Portfolio: c.portfolioHoldingReturnPct,
    Benchmark: c.benchmarkHoldingReturnPct,
  }));
}

/**
 * Rank-over-time series for the ranking-history chart.
 *
 * Only stocks that reached the Top N at least once get a line — charting
 * all 150/250 universe members would be unreadable, and a stock that never
 * cracked the Top 5 isn't what this view is for. Among those qualifiers,
 * the `maxLines` with the most Top-N appearances win, so a one-month
 * flicker doesn't crowd out a stock that held a spot for most of the
 * backtest. Ties in appearance count are broken alphabetically so the
 * output is deterministic (spec Section 39).
 *
 * A qualifying stock that was unranked in a given month gets `null` for
 * that month rather than a fabricated rank.
 */
export function buildRankingHistorySeries(rankingHistory = [], topN = 5, maxLines = 7) {
  if (!rankingHistory || rankingHistory.length === 0) return { data: [], symbols: [] };

  const appearances = new Map();
  for (const snapshot of rankingHistory) {
    for (const row of snapshot.rankings) {
      if (row.rank != null && row.rank <= topN) {
        appearances.set(row.symbol, (appearances.get(row.symbol) ?? 0) + 1);
      }
    }
  }

  const symbols = [...appearances.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .slice(0, maxLines)
    .map(([symbol]) => symbol);

  const data = rankingHistory.map((snapshot) => {
    const row = { date: snapshot.date, monthKey: snapshot.monthKey };
    for (const symbol of symbols) {
      row[symbol] = snapshot.rankings.find((r) => r.symbol === symbol)?.rank ?? null;
    }
    return row;
  });

  return { data, symbols };
}

/**
 * Aggregate rupee P&L contribution per stock across every cycle it was held.
 *
 * A stock held across three separate rebalances gets its contributions
 * summed rather than appearing three times. Picks with no exit value are
 * SKIPPED, not counted as zero — a missing exit price is a data-quality
 * issue flagged elsewhere, and silently scoring it as break-even would
 * quietly distort the attribution.
 *
 * Selection takes the `maxBars` largest absolute contributors (so big
 * detractors aren't hidden behind small winners), then sorts the survivors
 * by signed value for display.
 */
export function buildAttributionSeries(cycles = [], maxBars = 10) {
  if (!cycles || cycles.length === 0) return [];

  const bySymbol = new Map();
  for (const cycle of cycles) {
    for (const pick of cycle.picks ?? []) {
      if (pick.exitValue == null || !(pick.invested > 0)) continue;
      const existing = bySymbol.get(pick.symbol) ?? { symbol: pick.symbol, name: pick.name, contribution: 0, timesHeld: 0 };

      // PERCENTAGE POINTS OF PORTFOLIO RETURN, not rupees (decisions D1/A2).
      //
      // A rupee figure here would depend on the notional the backtest happened
      // to run with, which is exactly the account-size assumption the
      // capital-independent record removed. The position's own return, scaled
      // by the weight it carried that month, is the share of the portfolio's
      // move it was responsible for — and that is invariant to the notional.
      const positionReturnPct = ((pick.exitValue - pick.invested) / pick.invested) * 100;
      const weight = cycle.totalInvested > 0 ? pick.invested / cycle.totalInvested : 0;
      existing.contribution += positionReturnPct * weight;

      existing.timesHeld += 1;
      bySymbol.set(pick.symbol, existing);
    }
  }

  return [...bySymbol.values()]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, maxBars)
    .sort((a, b) => b.contribution - a.contribution)
    .map((row) => ({ ...row, label: `${row.symbol.replace('.NS', '')} (×${row.timesHeld})` }));
}
