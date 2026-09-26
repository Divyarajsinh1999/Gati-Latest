/**
 * CSV EXPORTS.
 *
 * WHAT THIS OWNS
 *   The seven exports the specification requires, and the guarantee that what
 *   they contain matches what is on screen.
 *
 * WHY IT LIVES HERE FOR NOW
 *   The approved information architecture puts exports in Reports, which is
 *   M8. But routing the record screen away from the old page would have
 *   removed CSV export from the product entirely for a milestone — the same
 *   mistake as deleting the calculator before its replacement existed.
 *
 *   So it moves to the Strategy Record, which is where its data already lives,
 *   and moves again to Reports when Reports exists. Tracked in TODO.md.
 *
 * EXPORTED VALUES MUST EQUAL DISPLAYED VALUES, including the current
 * transaction-cost setting. An export that quietly differs from the screen is
 * worse than no export, because the discrepancy is discovered in a spreadsheet
 * days later with no way to tell which number was right.
 */

import * as exports from '../../utils/strategyExports.js';
import { Button } from '../primitives/index.jsx';

export function ExportPanel({ universe, strategyKey, currentMomentum, backtest, summary, hideHeading = false }) {
  const items = [
    { label: 'Current rankings', run: () => exports.exportCurrentRankings(strategyKey, currentMomentum.ranked) },
    { label: 'Top 5', run: () => exports.exportTop5(strategyKey, currentMomentum.picks) },
    { label: 'Monthly rankings', run: () => exports.exportMonthlyRankings(strategyKey, backtest.rankingHistory) },
    { label: 'Monthly performance', run: () => exports.exportMonthlyHistory(strategyKey, backtest.cycles) },
    { label: 'Trades', run: () => exports.exportTrades(strategyKey, backtest.cycles) },
    { label: 'Backtest results', run: () => exports.exportBacktestResults(strategyKey, summary) },
    { label: 'Benchmark comparison', run: () => exports.exportBenchmarkComparison(strategyKey, backtest.cycles, universe.benchmark.symbol) },
  ];

  return (
    <section aria-labelledby={hideHeading ? undefined : "exports-heading"} aria-label={hideHeading ? "CSV exports" : undefined} style={{ marginTop: hideHeading ? 0 : 32 }}>
      {hideHeading ? null : (
        <>
          <h2
            id="exports-heading"
            style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}
          >
            CSV exports
          </h2>
          <p style={{ margin: '6px 0 10px', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
            Values match what is shown here, including the current transaction-cost setting.
          </p>
        </>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => (
          <Button key={item.label} variant="secondary" onClick={item.run} style={{ height: 36, fontSize: 12 }}>
            {item.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
