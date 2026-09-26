import { downloadCSV } from './csvExport.js';

/**
 * Builders for every report spec Section 28 lists.
 *
 * Each report is a `buildX(...)` pure function returning row objects, plus a
 * thin `exportX(...)` wrapper that downloads them. The split exists so the
 * row shaping — which is where "exported values must match displayed
 * values" can actually break — is unit-testable without a DOM.
 *
 * Kept out of the page components so the UI stays presentational (spec
 * Section 34), and so number formatting for exports lives in exactly one
 * place: 2dp for percentages and money, integers untouched.
 */

const pct = (v) => (v == null ? '' : v.toFixed(2));
const money = (v) => (v == null ? '' : v.toFixed(2));

export function buildCurrentRankingsRows(ranked) {
  return ranked.map((r) => ({
    Rank: r.rank ?? '',
    Symbol: r.symbol,
    Name: r.name,
    Sector: r.sector ?? '',
    'Current Price': money(r.currentPrice),
    'Daily Change %': pct(r.dailyChangePct),
    'Previous Month-End Price': money(r.previousMonthEndPrice),
    'Month Return %': pct(r.stockReturnPct),
    'Benchmark Return %': pct(r.benchmarkReturnPct),
    'RS (%)': pct(r.rs),
    Volume: r.volume ?? '',
    'Data Flags': (r.flags ?? []).join('; '),
  }));
}

export function buildTop5Rows(picks) {
  return picks.map((p) => ({
    Rank: p.rank,
    Symbol: p.symbol,
    Name: p.name,
    Sector: p.sector ?? '',
    'Current Price': money(p.currentPrice),
    'Month Return %': pct(p.stockReturnPct),
    'Benchmark Return %': pct(p.benchmarkReturnPct),
    'RS (%)': pct(p.rs),
  }));
}

export function buildCurrentPortfolioRows(positions) {
  return positions.map((p) => ({
    Symbol: p.symbol,
    'Entry Price': money(p.entryPrice),
    'Target Allocation': money(p.targetAllocation),
    Shares: p.shares,
    Invested: money(p.invested),
    'Remaining Cash': money(p.remaining),
  }));
}

export function buildMonthlyHistoryRows(cycles) {
  return cycles.map((c) => ({
    'Ranked At Month': c.rankedAtMonthKey ?? '',
    'Held From': c.entryDate,
    'Held To': c.exitDate,
    'Top 5': c.picks.map((p) => p.symbol).join(' | '),
    'Portfolio Return %': pct(c.portfolioHoldingReturnPct),
    'Benchmark Return %': pct(c.benchmarkHoldingReturnPct),
    'Difference (%)': pct(c.differencePct),
    'Transaction Costs': money(c.transactionCosts),
    'Portfolio Value At Exit': money(c.exitValue),
  }));
}

/** Monthly rankings: the full-universe rank snapshot at every signal date. */
export function buildMonthlyRankingsRows(rankingHistory) {
  const rows = [];
  for (const snapshot of rankingHistory ?? []) {
    for (const r of snapshot.rankings) {
      rows.push({
        Month: snapshot.monthKey,
        'Signal Date': snapshot.date,
        Rank: r.rank ?? '',
        Symbol: r.symbol,
        Name: r.name,
        'RS (%)': pct(r.rs),
      });
    }
  }
  return rows;
}

/** Trades: one row per position per completed cycle, entry through exit. */
export function buildTradesRows(cycles) {
  const rows = [];
  for (const c of cycles ?? []) {
    for (const p of c.picks) {
      rows.push({
        Symbol: p.symbol,
        'Entry Date': c.entryDate,
        'Entry Price': money(p.entryPrice),
        Shares: p.shares,
        Invested: money(p.invested),
        'Exit Date': c.exitDate,
        'Exit Price': money(p.exitPrice),
        'Exit Value': money(p.exitValue),
        'Return %': pct(p.holdingReturnPct),
      });
    }
  }
  return rows;
}

export function buildBacktestResultsRows(summary) {
  return Object.entries(summary ?? {}).map(([metric, value]) => ({ Metric: metric, Value: value }));
}

export function buildBenchmarkComparisonRows(cycles, benchmarkSymbol) {
  return (cycles ?? []).map((c) => ({
    'Held From': c.entryDate,
    'Held To': c.exitDate,
    'Portfolio Return %': pct(c.portfolioHoldingReturnPct),
    [`Benchmark (${benchmarkSymbol}) Return %`]: pct(c.benchmarkHoldingReturnPct),
    'Outperformance (%)': pct(c.differencePct),
  }));
}

// --- download wrappers -------------------------------------------------

export const exportCurrentRankings = (key, ranked) => downloadCSV(`${key}-current-rankings`, buildCurrentRankingsRows(ranked));
export const exportTop5 = (key, picks) => downloadCSV(`${key}-top5`, buildTop5Rows(picks));
export const exportCurrentPortfolio = (key, positions) => downloadCSV(`${key}-current-portfolio`, buildCurrentPortfolioRows(positions));
export const exportMonthlyHistory = (key, cycles) => downloadCSV(`${key}-monthly-history`, buildMonthlyHistoryRows(cycles));
export const exportMonthlyRankings = (key, rankingHistory) => downloadCSV(`${key}-monthly-rankings`, buildMonthlyRankingsRows(rankingHistory));
export const exportTrades = (key, cycles) => downloadCSV(`${key}-trades`, buildTradesRows(cycles));
export const exportBacktestResults = (key, summary) => downloadCSV(`${key}-backtest-results`, buildBacktestResultsRows(summary));
export const exportBenchmarkComparison = (key, cycles, benchmarkSymbol) =>
  downloadCSV(`${key}-benchmark-comparison`, buildBenchmarkComparisonRows(cycles, benchmarkSymbol));
