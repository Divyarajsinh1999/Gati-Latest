/**
 * CHART CARD — the frame every chart sits in.
 *
 * WHAT THIS OWNS
 *   A chart's title, its one-line statement of purpose, its range control, and
 *   its loading, empty and short-history states.
 *
 * WHAT THIS MUST NEVER DO
 *   Collapse to nothing when there is no data. The card keeps its height and
 *   explains itself, because a chart that disappears makes the page jump and
 *   leaves the reader wondering whether it failed or was never there.
 *
 * WHY EVERY CHART CARRIES A PURPOSE LINE
 *   An unexplained chart in a financial product is worse than no chart: the
 *   reader assumes it means something, cannot tell what, and either invents an
 *   interpretation or loses confidence in the page. One sentence prevents both.
 */

import { Skeleton } from '../primitives/index.jsx';
import { CHART_RANGES } from '../../utils/chartRange.js';

export function ChartCard({
  /**
   * Heading level. Defaults to 2 because a chart card is usually a top-level
   * section; pass 3 when it sits inside one. Getting this wrong skips a
   * heading level, which is how a screen-reader user loses the page outline.
   */
  headingLevel = 2,
  title,
  purpose,
  info,
  range,
  onRangeChange,
  /** Which range options to offer. Defaults to the strategy set. */
  ranges,
  coverage,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  height = 280,
  children,
}) {
  return (
    <section
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        borderRadius: 10,
        padding: 16,
        boxShadow: '0 1px 2px rgba(14,27,44,0.05)',
      }}
    >
      {/*
        The title and the range control WRAP ONTO SEPARATE ROWS on a narrow
        screen rather than sharing one.

        `flexWrap` alone was not enough: with `flex: 1` and `minWidth: 0` the
        title column shrank to whatever the six range buttons left it, which
        at 390px was about 90px — so "Adjusted closing price, 07 May 2026 to
        07 Aug 2026" wrapped into a tall thin ribbon beside the buttons
        instead of wrapping the buttons to the next line. A minimum width
        forces the wrap to happen where it should.
      */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200, flex: '1 1 200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Heading
              level={headingLevel}
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink)',
              }}
            >
              {title}
            </Heading>
            {info ?? null}
          </div>
          {purpose ? (
            <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
              {purpose}
            </p>
          ) : null}
        </div>

        {onRangeChange ? <RangeControl value={range} onChange={onRangeChange} ranges={ranges} /> : null}
      </div>

      {/*
        DECISION D2 — the range fell short of the data, so the chart shows
        everything it has and says so. This notice is load-bearing, not
        decoration: 3Y, 5Y and All currently render identically, and without
        it a reader would conclude the control is broken.
      */}
      {coverage?.isShort && coverage.notice ? (
        <p
          role="note"
          style={{
            margin: '10px 0 0',
            padding: '8px 10px',
            borderRadius: 6,
            background: 'var(--color-warn-soft)',
            color: 'var(--color-warn)',
            fontFamily: 'var(--font-display)',
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          {coverage.notice}
        </p>
      ) : null}

      <div style={{ marginTop: 12, minHeight: height }}>
        {isLoading ? (
          // Matches the final height exactly, so nothing reflows on arrival.
          <Skeleton height={height} radius={10} />
        ) : isEmpty ? (
          <div
            style={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 24,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              color: 'var(--color-ink-muted)',
            }}
          >
            {emptyMessage ?? 'Not enough completed months to chart this yet.'}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * Range control.
 *
 * Every range stays SELECTABLE, including ones the data cannot fill (D2).
 * Disabling would imply the range is unavailable, when the range is perfectly
 * valid and the data is what falls short — a distinction worth preserving.
 */
/** Renders the requested heading level, so the outline stays unbroken. */
function Heading({ level, children, ...rest }) {
  const Tag = `h${Math.min(Math.max(level, 1), 6)}`;
  return <Tag {...rest}>{children}</Tag>;
}

export function RangeControl({ value, onChange, ranges = CHART_RANGES }) {
  return (
    <div
      role="radiogroup"
      aria-label="Chart range"
      style={{ display: 'inline-flex', border: '1px solid var(--color-line)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}
    >
      {ranges.map((range) => {
        const active = range.key === value;
        return (
          <button
            key={range.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(range.key)}
            style={{
              // 36, not 30. WCAG 2.5.8 sets 24x24 as the floor and 30 cleared
              // it, but this control moved from the foot of a strategy chart
              // to directly under the reader's thumb on the stock screen, and
              // a 30px target between two neighbours 1px away is a mis-tap.
              height: 36,
              minWidth: 42,
              padding: '0 8px',
              border: 'none',
              borderRight: '1px solid var(--color-line)',
              background: active ? 'var(--color-gold-soft)' : 'transparent',
              color: active ? 'var(--color-gold)' : 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Legend.
 *
 * The swatch reproduces the series' DASH PATTERN, not just its colour. A
 * dashed series identified by a solid swatch teaches the wrong mapping, and
 * the mapping is the only thing a legend exists to teach.
 */
/**
 * The legend, which doubles as the series switch where a chart asks it to.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE LEGEND IS THE CONTROL, RATHER THAN A SEPARATE ONE (v1.6.1)
 *
 * The Dashboard's equity curve needs each line to be hideable. A separate
 * pair of checkboxes would put the name of a series in two places, and the
 * reader would have to work out that the box labelled "Benchmark" governs
 * the dashed grey line — a mapping the legend already teaches.
 *
 * So when `onToggle` is supplied the swatches become buttons. The swatch
 * still reproduces the PATTERN, so a hidden series keeps the dash that
 * identifies it and the reader can see what they are about to bring back.
 *
 * A HIDDEN SERIES IS DIMMED, NOT REMOVED. Dropping it from the legend would
 * leave no way to restore it, and — worse on this chart — a lone strategy
 * line with no benchmark beside it looks like a chart that never had one.
 * `aria-pressed` carries the state, so it is not signalled by opacity alone.
 * ═════════════════════════════════════════════════════════════════════════
 */
export function ChartLegend({ items, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
      {items.map((item) => {
        const hidden = item.hidden === true;
        const swatch = (
          <>
            <svg width="16" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke={item.stroke}
                strokeWidth="2"
                strokeDasharray={item.strokeDasharray}
                strokeLinecap="round"
              />
            </svg>
            {item.name}
          </>
        );

        const base = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--color-ink-muted)',
        };

        if (!onToggle) {
          return <span key={item.name} style={base}>{swatch}</span>;
        }

        return (
          <button
            key={item.name}
            type="button"
            onClick={() => onToggle(item.key ?? item.name)}
            aria-pressed={!hidden}
            style={{
              ...base,
              // 32px of vertical hit area on a 11px label, without the
              // legend growing a row taller than the text it labels.
              padding: '6px 4px',
              margin: '-6px -4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              opacity: hidden ? 0.4 : 1,
              textDecoration: hidden ? 'line-through' : 'none',
            }}
          >
            {swatch}
          </button>
        );
      })}
    </div>
  );
}
