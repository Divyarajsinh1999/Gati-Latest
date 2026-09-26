import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import { buildAttributionSeries } from '../../utils/chartData.js';
import { useChartTheme, chartDefaults } from './chartTheme.js';

/**
 * "Top 5 Performance" (spec Section 27): which stocks actually did the heavy
 * lifting across the whole backtest, not just in any single month. Sums
 * each pick's rupee P&L (exit value − invested) across every cycle it
 * appeared in, so a stock held across three separate rebalances gets its
 * contribution added up rather than shown three separate times.
 */
export function TopPicksAttributionChart({ cycles, maxBars = 10 }) {
  const chart = useChartTheme();
  const data = useMemo(() => buildAttributionSeries(cycles, maxBars), [cycles, maxBars]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h2 className="font-display mb-1 text-sm font-semibold">Top 5 Performance — Contribution</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">No completed cycles yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h2 className="font-display mb-1 text-sm font-semibold">Top 5 Performance — Contribution</h2>
      <p className="mb-3 text-xs text-[var(--color-ink-muted)]">Total ₹ P&amp;L contributed across every cycle each stock was held, most impactful first</p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: chart.inkMuted }} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: chart.inkMuted }} />
          <Tooltip {...chartDefaults(chart).tooltip} formatter={(v) => [`${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`, 'Contribution']} labelFormatter={(label) => label} />
          <ReferenceLine x={0} stroke="var(--color-line)" />
          <Bar dataKey="contribution" radius={[0, 3, 3, 0]}>
            {data.map((row) => (
              <Cell key={row.symbol} fill={row.contribution >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
