import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { formatDate, formatPct } from '../../utils/formatters.js';
import { buildMonthlyReturnsSeries } from '../../utils/chartData.js';
import { useChartTheme, chartDefaults } from './chartTheme.js';

export function MonthlyReturnsChart({ cycles }) {
  const chart = useChartTheme();
  const data = buildMonthlyReturnsSeries(cycles);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h2 className="font-display mb-3 text-sm font-semibold">Monthly Returns</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
          <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { style: 'short' })} tick={{ fontSize: 11, fill: chart.inkMuted }} minTickGap={24} />
          <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: chart.inkMuted }} width={50} />
          <Tooltip {...chartDefaults(chart).tooltip} labelFormatter={(d) => formatDate(d)} formatter={(v) => formatPct(v)} />
          <Legend wrapperStyle={{ fontSize: 12, color: chart.inkMuted }} />
          <ReferenceLine y={0} stroke="var(--color-line)" />
          <Bar dataKey="Portfolio" fill="var(--color-gold)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Benchmark" fill="var(--color-ink-muted)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
