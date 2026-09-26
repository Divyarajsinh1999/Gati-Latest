/**
 * DRAWDOWN — the worst fall from a peak, beneath the curve that caused it.
 *
 * WHAT THIS OWNS
 *   The depth of every decline, on the SAME x-domain and the SAME crosshair
 *   as the equity curve above it.
 *
 * WHY THE SHARED CROSSHAIR MATTERS
 *   Two charts side by side make the reader match dates by eye, which is
 *   precisely the work a chart is supposed to remove. Sharing `syncId` means
 *   one cursor reads both: hover a dip here and the equity curve shows the
 *   moment that caused it.
 *
 * WHY IT SITS DIRECTLY BENEATH WITH NO GAP
 *   They are one visual object with two panels, not two charts. A gap invites
 *   the eye to read them separately, and separately they are much less useful.
 */

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { formatDate, formatPct } from '../../utils/formatters.js';
import { buildDrawdownSeries } from '../../utils/chartData.js';
import { useChartTheme, chartDefaults, seriesContract, SYNC_ID } from './chartTheme.js';

export function DrawdownChart({ equityCurve, height = 140, universeKey }) {
  const palette = useChartTheme();
  const defaults = chartDefaults(palette);
  // Optional: a chart with no universe in scope falls back to the brand
  // accent rather than failing. See universeAccent().
  const series = seriesContract(palette, universeKey);
  const data = buildDrawdownSeries(equityCurve);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} syncId={SYNC_ID}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(d, { style: 'short' })}
          tick={{ fontSize: 10, fill: palette.inkMuted }}
          minTickGap={28}
          {...defaults.axis}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v)}%`}
          tick={{ fontSize: 10, fill: palette.inkMuted }}
          width={44}
          {...defaults.axis}
        />
        {/* Zero is where the portfolio was at its peak — not an ordinary
            gridline, so it is drawn with the stronger hairline. */}
        <ReferenceLine y={0} stroke={palette.line} strokeWidth={1} />
        <Tooltip
          {...defaults.tooltip}
          labelFormatter={(d) => formatDate(d)}
          formatter={(v) => [formatPct(v), 'Below peak']}
        />
        <Area
          type="monotone"
          /*
            `Drawdown`, capitalised, because that is the key
            `buildDrawdownSeries` emits — and Recharts silently renders
            NOTHING for a dataKey that is not present in the data. It does
            not warn. See the contract test in chartSeriesContract.test.js
            for why this is now pinned rather than trusted.
          */
          dataKey="Drawdown"
          stroke={series.drawdown.stroke}
          strokeWidth={series.drawdown.strokeWidth}
          fill={series.drawdown.fill}
          fillOpacity={series.drawdown.fillOpacity}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
