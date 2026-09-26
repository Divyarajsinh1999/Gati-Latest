/**
 * MONTHLY PERFORMANCE — one bar per completed month, against zero.
 *
 * WHAT THIS OWNS
 *   Drawing the months the strategy has actually completed. It computes
 *   nothing: every value comes from `selectPerformance`, which reshapes what
 *   the backtest engine already recorded. A chart that recalculated its own
 *   numbers could disagree with the record it is drawn from.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ZERO IS THE SUBJECT, NOT THE FLOOR
 *
 * An equity curve asks "how much". This asks "did it make money, or lose
 * it" — and that question is answered by which side of one line a bar sits
 * on. So the zero line is drawn heavier than the gridlines and is the only
 * horizontal rule with a colour of its own.
 *
 * The Y domain is forced symmetric around zero. Left to itself, recharts
 * fits the data: a run of good months puts zero at the bottom of the frame
 * and a −1% month becomes a bar that looks like a catastrophe. Symmetry
 * keeps a bad month looking as bad as it actually was, no more.
 *
 * PER-BAR COLOUR, NOT PER-SERIES. Gains and losses are the same series, so
 * each bar takes its colour from its own sign — the strategy's own months
 * are gold-on-gain and red-on-loss, and the benchmark sits behind in a
 * neutral tone because it is the thing being measured AGAINST, not a
 * competitor with its own good and bad days.
 *
 * WHY THREE MONTHS IS THE FLOOR
 * Two bars is not a chart. Below three the screen shows the figures as text
 * and says the sample is thin, which is the honest presentation of a record
 * that has barely started.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useChartTheme, chartDefaults } from './chartTheme.js';
import { formatPct } from '../../utils/formatters.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM' -> 'Aug'. The year is added only when the series crosses one. */
function monthLabel(monthKey, showYear) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const name = MONTHS[Number(month) - 1] ?? monthKey;
  return showYear ? `${name} '${year.slice(2)}` : name;
}

export function MonthlyPerformanceChart({ monthly = [], benchmarkLabel = 'Benchmark', height = 260 }) {
  const palette = useChartTheme();
  const defaults = chartDefaults(palette);

  const { data, domain, ticks } = useMemo(() => {
    const spansYears = new Set(monthly.map((m) => m.monthKey?.slice(0, 4))).size > 1;
    const rows = monthly.map((m) => ({
      label: monthLabel(m.monthKey, spansYears),
      monthKey: m.monthKey,
      strategy: m.strategyPct,
      benchmark: m.benchmarkPct,
    }));

    // Symmetric around zero — see the header note. Padded so the tallest bar
    // does not touch the frame, and floored at 2% so a very quiet stretch of
    // months does not magnify a 0.1% wobble into a mountain.
    const magnitudes = rows.flatMap((r) => [r.strategy, r.benchmark]).filter((v) => v != null).map(Math.abs);
    const peak = Math.max(2, ...magnitudes) * 1.15;

    /**
     * TICKS ARE GENERATED, NOT LEFT TO RECHARTS — so that ZERO IS ALWAYS ONE.
     *
     * Recharts picks its own round numbers to fit the domain, and on a real
     * series they came out as −18, −8, +2, +12: no zero anywhere on the axis
     * of a chart whose entire question is which side of zero a month fell.
     *
     * Built outward from zero in a round step instead, so the labelled
     * neutral line is guaranteed and the axis stays symmetric.
     */
    const rough = peak / 3;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? magnitude * 10;
    const ticks = [0];
    for (let value = step; value <= peak + step * 0.001; value += step) {
      ticks.unshift(-value);
      ticks.push(value);
    }

    return { data: rows, domain: [-peak, peak], ticks };
  }, [monthly]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
        {/* Horizontal only — vertical gridlines on a bar chart draw the eye
            along the axis the bars already occupy. */}
        <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: palette.inkMuted }}
          // Labels DROP rather than rotate, per the visual system. On a
          // narrow phone that means every other month, which still reads.
          interval="preserveStartEnd"
          minTickGap={8}
          {...defaults.axis}
        />
        <YAxis
          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
          tick={{ fontSize: 11, fill: palette.inkMuted }}
          width={46}
          domain={domain}
          ticks={ticks}
          {...defaults.axis}
        />

        <Tooltip
          {...defaults.tooltip}
          cursor={{ fill: palette.line, fillOpacity: 0.25 }}
          formatter={(value, name) => [formatPct(value), name]}
          labelFormatter={(label) => label}
        />

        {/* The line the whole chart is about. Drawn AFTER the grid so it sits
            on top of it, and heavier, so it never reads as another gridline. */}
        <ReferenceLine y={0} stroke={palette.inkMuted} strokeWidth={1.5} />

        <Bar dataKey="benchmark" name={benchmarkLabel} radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((row) => (
            // Neutral in both directions: the benchmark is the thing being
            // measured against, not a competitor with its own good months.
            <Cell key={row.monthKey} fill={palette.inkMuted} fillOpacity={0.35} />
          ))}
        </Bar>

        <Bar dataKey="strategy" name="Gati" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((row) => (
            <Cell key={row.monthKey} fill={row.strategy >= 0 ? palette.gain : palette.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
