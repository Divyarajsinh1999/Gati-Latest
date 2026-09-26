/**
 * EQUITY CURVE — the strategy against its benchmark, indexed to 100.
 *
 * WHAT THIS OWNS
 *   Drawing two series on one axis, on the binding contract.
 *
 * WHAT THIS MUST NEVER DO
 *   Render a rupee value. The record is capital-independent (decision D1), so
 *   the axis is an INDEX. A previous version formatted these values with
 *   `formatINR`, which printed an index of 121.3 as "₹121" — a rupee figure
 *   that corresponded to nothing at all.
 *
 * THE SERIES CONTRACT: strategy solid gold, benchmark dashed grey, never
 * reversed. It is the crossing motif from the app mark at chart scale — a
 * quiet flat baseline crossed by an accelerating line — and a reader who
 * learns it once here reads every other chart for free.
 */

import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { formatDate } from '../../utils/formatters.js';
import { buildEquityComparisonSeries } from '../../utils/chartData.js';
import { useChartTheme, chartDefaults, seriesContract, SYNC_ID } from './chartTheme.js';
import { ChartLegend } from './ChartCard.jsx';

/** Index values, not currency. One decimal is all the precision the eye uses. */
const formatIndex = (v) => (typeof v === 'number' ? v.toFixed(0) : '—');
const formatIndexPrecise = (v) => (typeof v === 'number' ? `${v.toFixed(1)} (${(v - 100).toFixed(1)}%)` : '—');

/**
 * @param {boolean} [toggleable] whether the legend hides and restores each
 *   series. Off by default, so the strategy record — where the whole point
 *   is the comparison — cannot have half of it switched off by accident.
 *   The Dashboard turns it on (owner's instruction, 27 Aug 2026).
 */
export function EquityCurveChart({ equityCurve, benchmarkCurve, height = 260, universeKey, toggleable = false }) {
  const palette = useChartTheme();
  const defaults = chartDefaults(palette);
  // Optional: a chart with no universe in scope falls back to the brand
  // accent rather than failing. See universeAccent().
  const series = seriesContract(palette, universeKey);
  const data = buildEquityComparisonSeries(equityCurve, benchmarkCurve);

  /*
    Visibility is LOCAL and resets on navigation, deliberately. Hiding the
    benchmark is a momentary act — "let me look at just the strategy for a
    second" — not a preference. Persisting it would mean a reader who once
    hid the benchmark comes back weeks later to a curve with nothing to
    judge it against and no memory of having asked for that.
  */
  const [hidden, setHidden] = useState(() => ({ Portfolio: false, Benchmark: false }));
  const toggle = (key) => setHidden((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} syncId={SYNC_ID}>
          {/* Horizontal only, dashed. Both axes gridded is twice the ink for
              no extra information. */}
          <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d, { style: 'short' })}
            tick={{ fontSize: 11, fill: palette.inkMuted }}
            // Labels DROP rather than rotate. Rotated axis labels are slower
            // to read and are prohibited by the visual system.
            minTickGap={28}
            {...defaults.axis}
          />
          <YAxis
            tickFormatter={formatIndex}
            tick={{ fontSize: 11, fill: palette.inkMuted }}
            width={44}
            domain={['auto', 'auto']}
            {...defaults.axis}
          />
          {/* 100 is the starting point, so it is not an ordinary gridline —
              everything above it is gain and everything below is loss. */}
          <ReferenceLine y={100} stroke={palette.line} strokeWidth={1} />
          <Tooltip
            {...defaults.tooltip}
            labelFormatter={(d) => formatDate(d)}
            formatter={(v, name) => [formatIndexPrecise(v), name]}
          />
          {/*
            `hide` rather than not rendering the <Line>. Recharts computes
            the y-domain from mounted series, so unmounting one would rescale
            the axis under the survivor — the remaining line would visibly
            jump and change shape when the other was switched off, which
            reads as the data changing rather than the view.
          */}
          <Line type="monotone" dataKey="Portfolio" {...series.strategy} dot={false} isAnimationActive={false} hide={hidden.Portfolio} />
          <Line type="monotone" dataKey="Benchmark" {...series.benchmark} dot={false} isAnimationActive={false} hide={hidden.Benchmark} />
        </LineChart>
      </ResponsiveContainer>

      <ChartLegend
        onToggle={toggleable ? toggle : undefined}
        items={[
          {
            key: 'Portfolio',
            name: 'Momentum portfolio',
            stroke: series.strategy.stroke,
            hidden: hidden.Portfolio,
          },
          {
            key: 'Benchmark',
            name: 'Benchmark',
            stroke: series.benchmark.stroke,
            strokeDasharray: series.benchmark.strokeDasharray,
            hidden: hidden.Benchmark,
          },
        ]}
      />
    </>
  );
}
