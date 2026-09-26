/**
 * PORTFOLIO VALUE OVER TIME.
 *
 * WHAT THIS OWNS
 *   Drawing the two series `buildPortfolioHistory` produces. It computes
 *   nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY TWO LINES AND NOT ONE
 *
 * A value line alone cannot be read. It rises when the holdings gain AND it
 * rises when the reader buys more, and those are opposite facts about the
 * same money. Drawing what was PAID underneath it separates them: the cost
 * line steps up on a purchase, the value line moves with the market, and
 * the gap between them is the profit.
 *
 * The gap is filled, so the profit is an area rather than a subtraction the
 * reader has to perform by eye — and it is tinted by SIGN, so a portfolio
 * under water reads as under water at a glance.
 *
 * THE COST LINE IS A STEP, NOT A CURVE. Money is spent on a day, not eased
 * in over a week. `type="stepAfter"` says that; a smoothed cost line would
 * imply purchases that never happened on days between them.
 *
 * NO ZERO BASELINE. This is a value in rupees, not a return: anchoring a
 * ₹50,000 portfolio to zero compresses every real move into a flat line at
 * the top of the frame.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useChartTheme, chartDefaults } from '../../components/charts/chartTheme.js';
import { formatINR, formatDate, formatCompactNumber } from '../../utils/formatters.js';

export function PortfolioValueChart({ points = [], height = 260 }) {
  const palette = useChartTheme();
  const defaults = chartDefaults(palette);

  const { data, isUp } = useMemo(() => {
    const rows = points.map((point) => ({
      date: point.date,
      value: point.value,
      invested: point.invested,
      // Recharts stacks an area from a baseline; giving it the pair lets the
      // gap be filled without a second synthetic series.
      band: [Math.min(point.invested, point.value), Math.max(point.invested, point.value)],
      gain: point.gain,
    }));
    const last = rows.at(-1);
    return { data: rows, isUp: last ? last.gain >= 0 : true };
  }, [points]);

  const gainColour = isUp ? palette.gain : palette.loss;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="portfolio-gap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gainColour} stopOpacity={0.22} />
            <stop offset="100%" stopColor={gainColour} stopOpacity={0.06} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(d, { style: 'short' })}
          tick={{ fontSize: 11, fill: palette.inkMuted }}
          minTickGap={34}
          {...defaults.axis}
        />
        <YAxis
          tickFormatter={(v) => formatCompactNumber(v)}
          tick={{ fontSize: 11, fill: palette.inkMuted }}
          width={54}
          domain={['auto', 'auto']}
          {...defaults.axis}
        />

        <Tooltip
          {...defaults.tooltip}
          labelFormatter={(label) => formatDate(label)}
          formatter={(raw, name) => {
            if (name === 'band') return null; // the fill is not a datum
            return [formatINR(raw), name === 'value' ? 'Worth now' : 'What you paid'];
          }}
        />

        {/* The profit, as an area between the two lines. */}
        <Area
          dataKey="band"
          name="band"
          stroke="none"
          fill="url(#portfolio-gap)"
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />

        {/* Cost: a step. Money is spent on a day, not eased in over a week. */}
        <Line
          type="stepAfter"
          dataKey="invested"
          name="invested"
          stroke={palette.inkMuted}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />

        <Line
          type="monotone"
          dataKey="value"
          name="value"
          stroke={gainColour}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
