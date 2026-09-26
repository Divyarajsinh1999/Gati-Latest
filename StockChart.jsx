/**
 * STOCK PRICE CHART — the one on the detail screen, at a readable size.
 *
 * WHAT THIS OWNS
 *   Drawing one stock's closing price over a selected window.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS REPLACED A SPARKLINE
 *
 * The detail screen carried a 90×24px sparkline in the corner of a status
 * row. A sparkline is a shape, not a chart: it has no axis, no dates, no
 * values, and it cannot be interrogated. It answered "roughly which way"
 * and nothing else, on the one screen where a reader is deciding about a
 * specific stock.
 *
 * This is 300px tall, sits directly under the headline figures, carries
 * both axes and a tooltip, and is the second thing on the screen.
 *
 * RANGE CHANGES DO NOT REFETCH. The full series is already in memory from
 * the universe bundle — `applyRange` filters an array. Nothing is
 * re-requested, no query key changes, the screen does not remount. That is
 * why the control feels instant rather than showing a spinner.
 *
 * THE PRICE CONVENTION IS STATED, NOT ASSUMED. The chart draws `adjClose`
 * where the provider supplies it and falls back to `close` otherwise, and
 * says which in its purpose line — the two diverge around a split or a
 * dividend, and a chart that silently mixed them would draw a cliff that
 * never happened.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { applyRange, STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE } from '../../utils/chartRange.js';
import { useChartTheme, chartDefaults } from '../../components/charts/chartTheme.js';
import { ChartCard } from '../../components/charts/ChartCard.jsx';
import { formatDate, formatINR } from '../../utils/formatters.js';

export function StockChart({ symbol, series = [], name }) {
  const [rangeKey, setRangeKey] = useState(DEFAULT_STOCK_RANGE);
  const palette = useChartTheme();
  const defaults = chartDefaults(palette);

  const coverage = useMemo(
    () => applyRange(series, rangeKey, STOCK_CHART_RANGES, DEFAULT_STOCK_RANGE),
    [series, rangeKey],
  );

  const { data, usesAdjusted } = useMemo(() => {
    const points = coverage.points
      .map((bar) => {
        const value = bar.adjClose ?? bar.close ?? null;
        return typeof value === 'number' && Number.isFinite(value) ? { date: bar.date, price: value } : null;
      })
      .filter(Boolean);
    // Derived from the bars rather than accumulated while mapping: a flag set
    // inside a map body is a side effect that survives a bailed-out render.
    return { data: points, usesAdjusted: coverage.points.some((bar) => bar.adjClose != null) };
  }, [coverage.points]);

  /**
   * The direction over the WINDOW SHOWN, not over all history — the reader is
   * looking at this window, so the colour has to describe it. A green fill
   * under a line that visibly ends lower than it started is the kind of small
   * contradiction that costs a reader's trust in everything else on the page.
   */
  const isUp = data.length >= 2 && data[data.length - 1].price >= data[0].price;
  const stroke = isUp ? palette.gain : palette.loss;
  const gradientId = `stock-fill-${symbol.replace(/[^\w]/g, '')}`;

  return (
    <div style={{ marginTop: 24 }}>
      <ChartCard
        title="Price"
        purpose={
          data.length === 0
            ? 'No price history is available for this stock.'
            : `${usesAdjusted ? 'Adjusted closing' : 'Closing'} price, ${formatDate(data[0].date)} to ${formatDate(data[data.length - 1].date)}.`
        }
        range={rangeKey}
        onRangeChange={setRangeKey}
        ranges={STOCK_CHART_RANGES}
        coverage={coverage}
        isEmpty={data.length === 0}
        emptyMessage={`No price bars were returned for ${name ?? symbol}.`}
        height={300}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Horizontal only. Both axes gridded is twice the ink for no
                extra information — the house rule, kept. */}
            <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(d, { style: 'short' })}
              tick={{ fontSize: 11, fill: palette.inkMuted }}
              // Labels DROP rather than rotate, per the visual system.
              minTickGap={30}
              {...defaults.axis}
            />
            <YAxis
              tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(0) : '—')}
              tick={{ fontSize: 11, fill: palette.inkMuted }}
              width={52}
              // Never anchored at zero: a stock trading at ₹3,200 against a
              // zero baseline compresses every real move into a flat line.
              domain={['auto', 'auto']}
              {...defaults.axis}
            />
            <Tooltip
              {...defaults.tooltip}
              formatter={(value) => [formatINR(value, { precise: true }), 'Close']}
              labelFormatter={(label) => formatDate(label)}
            />

            <Area
              type="monotone"
              dataKey="price"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              // No dots on a 100-point series — they become a texture rather
              // than marks, and hide the line they are meant to sit on.
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
