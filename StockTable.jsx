/**
 * THE STOCK TABLE — eleven columns, on a phone.
 *
 * WHAT THIS OWNS
 *   Laying out the full ranking as a real table.
 *
 * WHAT THIS MUST NEVER DO
 *   Shrink type to make everything fit. Eleven columns of financial figures
 *   on a 320px screen is 29px per column — the only way to reach it is 7px
 *   text, which is not a table, it is a picture of one. The columns scroll
 *   instead, at the same size they have on a desktop.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY A REAL <table>, NOT A GRID OF DIVS
 *
 * A screen reader announces "column 4 of 11, Day %" only if the markup says
 * so. `<th scope="col">` and `<caption>` are the entire accessibility story
 * for a data table, and a div grid cannot express them at any price. The
 * previous list was rows of divs; it read out as an undifferentiated stream.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EVERY COLUMN AT EVERY WIDTH — owner's instruction, 27 Aug 2026.
 * v1.6.1 CHANGED THIS. THE PREVIOUS BEHAVIOUR IS RECORDED BECAUSE IT WAS
 * DELIBERATE, AND WAS OVERRULED FOR A GOOD REASON.
 *
 * Each column used to carry a `minWidth` — the viewport below which it was
 * dropped — so a 320px phone showed five columns and a desktop showed all
 * eleven. The stated intent was that all eleven stayed "reachable by
 * scrolling", and that was simply not true: a dropped column is not in the
 * DOM, so no amount of scrolling reaches it. On an upright phone Stock %,
 * Benchmark %, Prev month close, Day volume and Trend did not exist. The
 * only way to see them was to turn the phone sideways, which the owner
 * correctly identified as the phone being a different product.
 *
 * All eleven now render at every width. Nothing is compressed to achieve
 * it — the columns keep their desktop widths and the scroller carries the
 * overflow, which is what it was already doing for the six that survived.
 *
 * NOTHING IS PINNED EITHER. Rank and Ticker were `position: sticky`, held
 * at the left edge while the figures slid beneath them. On a 390px phone
 * those two cost 144px, leaving 246px for the nine columns that actually
 * move — so the anchor consumed more than a third of the screen to steady a
 * row the reader can already identify by its position in the order. The
 * owner asked for the whole row to travel together. The header row keeps
 * its VERTICAL stickiness: that solves a different problem (250 rows whose
 * column names scroll away) and was never in question.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockPath } from '../../config/routes.js';
import { RankBadge, Chip } from '../primitives/index.jsx';
import { InfoTip } from './index.jsx';

/**
 * The eleven columns, in the order the brief specifies. All are rendered at
 * every viewport; `width` is the fixed column width the scroller pans across.
 */
const COLUMNS = [
  { key: 'rank', label: '#', width: 52, align: 'center', glossary: 'rank' },
  { key: 'ticker', label: 'Ticker', width: 92, align: 'left' },
  { key: 'name', label: 'Stock', width: 168, align: 'left' },
  /*
    RELATIVE STRENGTH COMES BEFORE PRICE, and that ordering is the point.

    The columns first read Price, Day %, then RS — the conventional order,
    and wrong for this product. RS is the ONLY number the ranking is built
    from; the rows are already sorted by it. Putting the day's move ahead of
    it invites the reader to scan a figure the strategy does not use, and to
    read a stock as strong because it happened to rise today.

    It matters most in the first screenful, which on a phone is where the
    reader starts before scrolling right. That is the ranking's own logic,
    in its own order.
  */
  { key: 'rs', label: 'Rel. strength', width: 108, align: 'right', glossary: 'relativeStrength' },
  { key: 'price', label: 'Price', width: 104, align: 'right', glossary: 'livePrice' },
  { key: 'day', label: 'Day %', width: 82, align: 'right', glossary: 'todaysChange' },
  { key: 'stockReturn', label: 'Stock %', width: 90, align: 'right', glossary: 'stockReturn' },
  { key: 'benchReturn', label: 'Benchmark %', width: 108, align: 'right', glossary: 'benchmark' },
  { key: 'priorClose', label: 'Prev month close', width: 132, align: 'right', glossary: 'priorMonthEnd' },
  { key: 'volume', label: 'Day volume', width: 100, align: 'right', glossary: 'dayVolume' },
  { key: 'trend', label: 'Trend', width: 104, align: 'left', glossary: 'momentumDirection' },
];

/** Viewport width, as a live value. One listener, whatever the row count. */
function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    // Rotating a phone can settle its dimensions after `resize` fires.
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return width;
}

export function StockTable({ rows, universeKey, benchmarkLabel, caption, priceNote }) {
  const navigate = useNavigate();
  // Read only to re-check overflow on rotation. It no longer decides which
  // columns exist — every width gets all eleven.
  useViewportWidth();
  const scrollerRef = useRef(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const columns = COLUMNS;

  const checkOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (el) setHasOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [checkOverflow, columns.length, rows.length]);

  return (
    <div>
      {/*
        Stated, not left to be discovered. A table that scrolls sideways with
        no indication reads as a table with its right-hand columns broken.
        Announced politely so it does not interrupt, and only when true.
      */}
      {hasOverflow ? (
        <p
          style={{
            margin: '0 0 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            letterSpacing: '0.04em',
            color: 'var(--color-ink-muted)',
          }}
        >
          SCROLL SIDEWAYS FOR MORE COLUMNS →
        </p>
      ) : null}

      <div
        ref={scrollerRef}
        className="gati-no-scrollbar"
        // A scrollable region must be focusable and named, or a keyboard user
        // can reach the rows but never the columns to the right of them.
        tabIndex={0}
        role="region"
        aria-label={`${caption}. Scrollable table, ${columns.length} columns shown.`}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          // Horizontal only: this sits inside a vertically scrolling page, and
          // without it a slightly diagonal swipe steals the page's gesture.
          touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          border: '1px solid var(--color-line)',
          borderRadius: 10,
          background: 'var(--color-surface)',
        }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            // Fixed so a long company name cannot widen its column and knock
            // every figure to the right of it out of alignment.
            tableLayout: 'fixed',
            width: columns.reduce((total, column) => total + column.width, 0),
            minWidth: '100%',
          }}
        >
          <caption className="gati-visually-hidden">{caption}</caption>

          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{
                    ...cellBase(column),
                    // Vertical only. The horizontal pin was released in
                    // v1.6.1 so the whole row travels together.
                    position: 'static',
                    top: 0,
                    height: 38,
                    background: 'var(--color-surface-raised)',
                    borderBottom: '1px solid var(--color-line)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    {column.key === 'benchReturn' && benchmarkLabel ? benchmarkLabel : column.label}
                    {column.glossary ? (
                      <InfoTip
                        term={column.glossary}
                        /*
                          The price column's explanation depends on the
                          session, not just on the term. See `priceNote`.
                        */
                        note={column.key === 'price' ? priceNote : null}
                      />
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <Row
                key={row.symbol}
                row={row}
                columns={columns}
                onOpen={() => navigate(stockPath(universeKey, row.symbol))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellBase(column) {
  return {
    width: column.width,
    padding: '0 10px',
    textAlign: column.align,
  };
}

function Row({ row, columns, onOpen }) {
  const open = (event) => {
    // A row is not a link, so Enter and Space have to be wired by hand. Space
    // must not also scroll the page.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  const background = row.isTopN
    ? 'color-mix(in srgb, var(--color-gold-soft) 40%, var(--color-surface))'
    : 'var(--color-surface)';

  return (
    <tr
      onClick={onOpen}
      onKeyDown={open}
      tabIndex={0}
      // The row is the control, so it carries the name. Without this a screen
      // reader announces eleven cells and never says what was activated.
      aria-label={`${row.name}, ${row.symbol}, rank ${row.rank}`}
      className="gati-row-interactive"
      style={{ cursor: 'pointer', background }}
    >
      {columns.map((column) => (
        <td
          key={column.key}
          style={{
            ...cellBase(column),
            position: 'static',
            height: 52,
            background,
            borderBottom: '1px solid var(--color-line)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          <Cell column={column} row={row} />
        </td>
      ))}
    </tr>
  );
}

/** Monospace, tabular figures — a column of numbers must align to be scanned. */
const NUM = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5,
  fontVariantNumeric: 'tabular-nums',
};

function Cell({ column, row }) {
  switch (column.key) {
    case 'rank':
      return <RankBadge rank={row.rank} isTop={row.isTopN} />;

    case 'ticker':
      return (
        <span style={{ ...NUM, fontSize: 11.5, color: 'var(--color-ink-soft)' }}>
          {/* The `.NS` suffix is a data-source detail, not part of the name. */}
          {row.symbol.replace(/\.NS$/, '')}
        </span>
      );

    case 'name':
      return (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13.5,
            color: 'var(--color-ink)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          // The cell truncates, so the full name stays reachable on hover and
          // is what assistive technology reads.
          title={row.name}
        >
          {row.name}
        </span>
      );

    case 'price':
      return <span style={{ ...NUM, color: 'var(--color-ink)' }}>{row.priceLabel ?? '—'}</span>;

    case 'day':
      return <Signed label={row.dayChangeLabel} direction={row.dayDirection} />;

    case 'priorClose':
      /*
        THE PRICE, AND THE SESSION IT IS THE CLOSE OF (owner, 27 Aug 2026).

        A figure labelled "Prev month close" with no date attached cannot be
        checked, and the owner had no way to see whether it was holding still
        through the month or drifting. It is the DENOMINATOR of the stock
        return two columns to the left, so it is the number most worth being
        able to verify against a broker statement.

        Rendered small and dim beneath: it is evidence for the figure above
        it, not a second figure.
      */
      return (
        <span style={{ display: 'block', lineHeight: 1.25 }}>
          <span style={{ ...NUM, color: 'var(--color-ink-soft)', display: 'block' }}>
            {row.priorMonthEndLabel ?? '—'}
          </span>
          {row.priorMonthEndDateLabel ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--color-ink-muted)' }}>
              {row.priorMonthEndDateLabel}
            </span>
          ) : null}
        </span>
      );

    case 'stockReturn':
      return <Signed label={row.stockReturnLabel} direction={row.stockReturnDirection} />;

    case 'benchReturn':
      return <Signed label={row.benchmarkReturnLabel} direction={row.benchmarkReturnDirection} muted />;

    case 'rs':
      /*
        RS GETS A PILL (M14, D18). It is the column the whole table is sorted
        by and the one figure a reader is actually hunting for; the reference
        build gives it a tinted chip for exactly that reason, and it is the
        difference between a wall of numbers and a table with a subject.

        Tinted by DIRECTION rather than always in the accent, because an
        RS of -8.82 rendered on an acid-lime wash — which is what the
        reference does — reads as a positive at a glance. The sign, the
        colour and the tint all agree here.
      */
      return (
        <span
          className="gati-rs-pill"
          data-direction={row.rsDirection ?? 'flat'}
        >
          <Signed label={row.rsLabel} direction={row.rsDirection} strong />
        </span>
      );

    case 'volume':
      return <span style={{ ...NUM, color: 'var(--color-ink-muted)' }}>{row.volumeLabel ?? '—'}</span>;

    case 'trend':
      return row.direction ? <Chip tone={row.direction.tone}>{row.direction.label}</Chip> : <span style={{ color: 'var(--color-ink-muted)' }}>—</span>;

    default:
      return null;
  }
}

/**
 * A signed figure.
 *
 * The sign is inside the string from `formatPct` / `formatGap`, so direction
 * survives without colour — which is the requirement, not a nicety. Colour is
 * the second channel, never the only one.
 */
function Signed({ label, direction, muted, strong }) {
  if (!label) return <span style={{ ...NUM, color: 'var(--color-ink-muted)' }}>—</span>;
  const colour = muted
    ? 'var(--color-ink-soft)'
    : direction === 'gain'
      ? 'var(--color-gain)'
      : direction === 'loss'
        ? 'var(--color-loss)'
        : 'var(--color-ink-muted)';
  return <span style={{ ...NUM, color: colour, fontWeight: strong ? 600 : 400 }}>{label}</span>;
}
