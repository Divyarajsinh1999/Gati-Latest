import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatDate } from '../../utils/formatters.js';
import { buildRankingHistorySeries } from '../../utils/chartData.js';
import { useChartTheme, chartDefaults } from './chartTheme.js';

const LINE_COLORS = ['#ad8a3d', '#1e8e5a', '#2b6cb0', '#c23b34', '#7c5cbf', '#b4600f', '#0e7490'];

/**
 * Plots rank-over-time (spec Section 27: "Ranking History") for whichever
 * stocks reached the Top 5 at least once during the backtest — charting all
 * ~150/250 universe members on one line chart would be unreadable, and the
 * ones that never cracked the Top 5 aren't what this view is for. Y-axis is
 * inverted (rank 1 at the top) since a "better" rank is visually a smaller
 * number, which reads backwards on a normal axis.
 */
export function RankingHistoryChart({ rankingHistory, topN = 5, maxLines = 7 }) {
  const chart = useChartTheme();
  const { data, symbols } = useMemo(() => buildRankingHistorySeries(rankingHistory, topN, maxLines), [rankingHistory, topN, maxLines]);

  if (symbols.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h2 className="font-display mb-1 text-sm font-semibold">Ranking History</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">Not enough completed months yet to chart rank movement.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h2 className="font-display mb-1 text-sm font-semibold">Ranking History</h2>
      <p className="mb-3 text-xs text-[var(--color-ink-muted)]">Stocks that reached the Top {topN} at least once · lower on the chart = better rank</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
          <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { style: 'short' })} tick={{ fontSize: 11, fill: chart.inkMuted }} minTickGap={24} />
          <YAxis reversed allowDecimals={false} tick={{ fontSize: 11, fill: chart.inkMuted }} width={28} />
          <Tooltip {...chartDefaults(chart).tooltip} labelFormatter={(d) => formatDate(d)} />
          <Legend wrapperStyle={{ fontSize: 11, color: chart.inkMuted }} />
          {symbols.map((symbol, i) => (
            <Line
              key={symbol}
              type="monotone"
              dataKey={symbol}
              name={symbol.replace('.NS', '')}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
