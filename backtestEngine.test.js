import { describe, it, expect } from 'vitest';
import { runBacktest } from '../backtestEngine.js';

/**
 * Hand-computed scenario (topN = 1 for a simple, fully-traceable single
 * position at a time). Numbers below are independently computed in the PR
 * notes / thinking, not derived from the code under test, so this actually
 * catches wiring bugs (e.g. reading `close` where the convention says
 * `adjClose`, or the signal date instead of the next trading day).
 *
 * `close` and `open` are deliberately set to DIFFERENT values from
 * `adjClose` at every date, specifically so that if the engine ever reads
 * the wrong field it produces a visibly wrong number instead of an
 * accidentally-correct one.
 *
 * Ranking #1 (Feb-end vs Jan-end): A +8% vs benchmark +3% => RS +5
 *                                   B +2% vs benchmark +3% => RS -1
 *                                   => A selected, entered at Mar-02 open (109)
 * Ranking #2 (Mar-end vs Feb-end): A +6.481% vs bench +1.942% => RS +4.540
 *                                   B +3.922% vs bench +1.942% => RS +1.980
 *                                   => A selected again; A's Mar-02 position
 *                                      exits at Apr-01 open (116), re-enters at 116
 * Ranking #3 (Apr-end vs Mar-end): A +4.348% vs bench +4.762% => RS -0.414
 *                                   B +7.547% vs bench +4.762% => RS +2.785
 *                                   => B selected; A's Apr-01 position exits
 *                                      at May-01 open (121); B enters at 58 (open)
 */
function withDecoys(monthEndValue) {
  // month-end record: adjClose is the "real" value; close/open are decoys
  return { adjClose: monthEndValue, close: monthEndValue + 5, open: monthEndValue + 2 };
}
function executionDay(openValue) {
  // execution-day record: open is the "real" value; close/adjClose are decoys
  return { open: openValue, close: openValue + 5, adjClose: openValue + 3 };
}

const benchmarkSeries = [
  { date: '2025-01-31', ...withDecoys(200) },
  { date: '2025-02-28', ...withDecoys(206) },
  { date: '2025-03-02', ...executionDay(207) },
  { date: '2025-03-31', ...withDecoys(210) },
  { date: '2025-04-01', ...executionDay(211) },
  { date: '2025-04-30', ...withDecoys(220) },
  { date: '2025-05-01', ...executionDay(221) },
];

const stockASeries = [
  { date: '2025-01-31', ...withDecoys(100) },
  { date: '2025-02-28', ...withDecoys(108) },
  { date: '2025-03-02', ...executionDay(109) },
  { date: '2025-03-31', ...withDecoys(115) },
  { date: '2025-04-01', ...executionDay(116) },
  { date: '2025-04-30', ...withDecoys(120) },
  { date: '2025-05-01', ...executionDay(121) },
];

const stockBSeries = [
  { date: '2025-01-31', ...withDecoys(50) },
  { date: '2025-02-28', ...withDecoys(51) },
  { date: '2025-03-02', ...executionDay(51.5) },
  { date: '2025-03-31', ...withDecoys(53) },
  { date: '2025-04-01', ...executionDay(53.5) },
  { date: '2025-04-30', ...withDecoys(57) },
  { date: '2025-05-01', ...executionDay(58) },
];

const stocks = [
  { symbol: 'A', name: 'A Ltd' },
  { symbol: 'B', name: 'B Ltd' },
];
const priceSeriesMap = new Map([
  ['A', stockASeries],
  ['B', stockBSeries],
]);

describe('runBacktest — full hand-computed integration scenario', () => {
  const result = runBacktest({ stocks, priceSeriesMap, benchmarkSeries, initialCapital: 100_000, topN: 1 });

  it('skips the first month (no prior month-end to rank against) and produces exactly 2 completed cycles', () => {
    expect(result.cycles).toHaveLength(2);
  });

  it('cycle 1: A entered at Mar-02 (109), exited at Apr-01 (116), matches hand-computed return', () => {
    const c1 = result.cycles[0];
    expect(c1.entryDate).toBe('2025-03-02');
    expect(c1.exitDate).toBe('2025-04-01');
    expect(c1.picks[0].symbol).toBe('A');
    // FRACTIONAL basis (decision D1): exactly 1/N of capital per pick, so
    // shares are fractional and there is no leftover cash by construction.
    // Hand-computed: 100000/109 shares, exited at 116.
    expect(c1.picks[0].shares).toBeCloseTo(100_000 / 109, 6);
    expect(c1.totalInvested).toBeCloseTo(100_000, 6);
    expect(c1.exitValue).toBeCloseTo((100_000 / 109) * 116, 6);
    expect(c1.cashCarriedIn).toBe(0); // zero by construction, not by luck
    expect(c1.portfolioHoldingReturnPct).toBeCloseTo((116 / 109 - 1) * 100, 6);
    expect(c1.benchmarkHoldingReturnPct).toBeCloseTo(1.9324, 3);
    expect(c1.differencePct).toBeCloseTo(4.4866, 2);
  });

  it('cycle 2: A re-entered at Apr-01 (116), exited at May-01 (121), matches hand-computed return', () => {
    const c2 = result.cycles[1];
    expect(c2.entryDate).toBe('2025-04-01');
    expect(c2.exitDate).toBe('2025-05-01');
    expect(c2.picks[0].symbol).toBe('A');
    expect(c2.portfolioHoldingReturnPct).toBeCloseTo((121 / 116 - 1) * 100, 6);
    expect(c2.benchmarkHoldingReturnPct).toBeCloseTo(4.7393, 3);
    expect(c2.differencePct).toBeCloseTo(-0.4315, 2);
  });

  it('equity curve has one point per rebalance and compounds (not reset to 100,000 each month)', () => {
    expect(result.equityCurve).toHaveLength(3);
    // Hand-computed under FRACTIONAL: 100000 -> x116/109 -> x121/116.
    expect(result.equityCurve[0].value).toBeCloseTo(100_000, 6);
    expect(result.equityCurve[1].value).toBeCloseTo((100_000 / 109) * 116, 2);
    expect(result.equityCurve[2].value).toBeCloseTo((100_000 / 109) * 121, 2);

    // The base-100 index is what gets published, because it carries no
    // account size. Under FRACTIONAL it is value/notional and therefore
    // identical no matter what notional was passed in.
    expect(result.equityCurve[2].indexValue).toBeCloseTo((121 / 109) * 100, 6);
  });

  it('switches into B for the current (still-open) holding once B outranks A, and does not report it as a completed cycle', () => {
    expect(result.currentHolding).not.toBeNull();
    expect(result.currentHolding.positions[0].symbol).toBe('B');
    expect(result.currentHolding.entryDate).toBe('2025-05-01');
  });

  it('reconciles capital exactly at every step: invested + remaining always equals capital available', () => {
    for (const cycle of result.cycles) {
      expect(cycle.totalInvested + cycle.cashCarriedIn).toBeCloseTo(cycle.capitalAtStart, 6);
    }
  });

  it('charges transaction costs when costConfig.enabled is true, and reports them per cycle', () => {
    // Regression guard for a real bug: the cost module was fully built and
    // unit-tested, but nothing ever passed a costConfig into runBacktest,
    // so `costConfig?.enabled` was permanently undefined and every "net"
    // figure was silently gross. This test exercises the integration point
    // rather than the cost formulas (those are in transactionCosts.test.js).
    const args = { stocks, priceSeriesMap, benchmarkSeries, initialCapital: 100_000, topN: 1 };

    const gross = runBacktest(args);
    const net = runBacktest({
      ...args,
      costConfig: {
        enabled: true,
        brokeragePct: 0,
        sttPct: 0.1,
        exchangeTxnPct: 0.003,
        sebiFeePct: 0.0001,
        stampDutyPct: 0.015,
        gstPct: 18,
        slippagePct: 0.05,
      },
    });

    const grossFinal = gross.equityCurve[gross.equityCurve.length - 1].value;
    const netFinal = net.equityCurve[net.equityCurve.length - 1].value;

    expect(netFinal).toBeLessThan(grossFinal);
    expect(gross.cycles.every((c) => c.transactionCosts === 0)).toBe(true);
    expect(net.cycles.every((c) => c.transactionCosts > 0)).toBe(true);

    // Costs should be a realistic drag, not a rounding error and not ruinous:
    // roughly 0.2-0.5% of turnover per round trip on these assumptions.
    const dragPct = ((grossFinal - netFinal) / grossFinal) * 100;
    expect(dragPct).toBeGreaterThan(0.05);
    expect(dragPct).toBeLessThan(5);
  });

  it('leaves results identical to gross when costConfig is present but disabled', () => {
    const args = { stocks, priceSeriesMap, benchmarkSeries, initialCapital: 100_000, topN: 1 };
    const gross = runBacktest(args);
    const explicitlyOff = runBacktest({ ...args, costConfig: { enabled: false, sttPct: 0.1, gstPct: 18 } });
    expect(explicitlyOff.equityCurve.map((p) => p.value)).toEqual(gross.equityCurve.map((p) => p.value));
  });

  it('records a full-universe ranking snapshot at every signal date, independent of whether it was executed', () => {
    // 3 signal dates were ranked (Feb, Mar, Apr); the trailing partial "May"
    // signal from the synthetic data's final data point also gets ranked
    // (see the file-level comment on stockASeries/benchmarkSeries above) but
    // never executed since there's no trading day after it.
    expect(result.rankingHistory.length).toBeGreaterThanOrEqual(3);
    const febSnapshot = result.rankingHistory.find((r) => r.monthKey === '2025-02');
    expect(febSnapshot.rankings.map((r) => r.symbol)).toEqual(expect.arrayContaining(['A', 'B']));
    expect(febSnapshot.rankings.find((r) => r.symbol === 'A').rank).toBe(1); // A had RS +5 vs B's -1
  });
});
