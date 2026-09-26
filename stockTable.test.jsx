// @vitest-environment jsdom
/**
 * THE STOCK TABLE — structure, order and semantics.
 *
 * WHAT THESE CATCH
 *   A column silently disappearing, the responsive thresholds drifting, the
 *   ranking's own number being demoted below the day's move, and the markup
 *   losing the parts that make a data table navigable by screen reader.
 *
 * WHAT THESE CANNOT CATCH
 *   Whether `position: sticky` actually holds, or whether the scroller
 *   scrolls. jsdom computes no layout. Both were measured in headless
 *   Chromium at eight viewports: the rank cell moves less than 1px while the
 *   table is scrolled fully right, at every width, and the page itself never
 *   gains horizontal scroll.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StockTable } from '../data/StockTable.jsx';

const row = (overrides = {}) => ({
  symbol: 'RELIANCE.NS',
  name: 'Reliance Industries',
  rank: 1,
  isTopN: true,
  rs: 6.2,
  rsLabel: '+6.2%',
  rsDirection: 'gain',
  currentPrice: 1298,
  priceLabel: '₹1,298',
  dailyChangePct: 1.4,
  dayChangeLabel: '+1.40%',
  dayDirection: 'gain',
  priorMonthEndPrice: 1245.5,
  priorMonthEndLabel: '₹1,246',
  priorMonthEndDateLabel: '31 Jul 2026',
  stockReturnLabel: '+4.21%',
  stockReturnDirection: 'gain',
  benchmarkReturnLabel: '+1.98%',
  benchmarkReturnDirection: 'gain',
  volume: 2_450_000,
  volumeLabel: '24.50L',
  direction: { label: 'Improving', tone: 'gain' },
  ...overrides,
});

const setViewport = (width) => {
  window.innerWidth = width;
  window.dispatchEvent(new Event('resize'));
};

const draw = (rows = [row()], width = 1440) => {
  setViewport(width);
  return render(
    <MemoryRouter>
      <StockTable
        rows={rows}
        universeKey="nifty50"
        benchmarkLabel="NIFTYBEES"
        caption="NIFTY 50 ranked by Relative Strength"
        priceNote="Not live. This is the close of 26 Aug 2026."
      />
    </MemoryRouter>,
  );
};

beforeEach(() => setViewport(1440));
afterEach(cleanup);

describe('the eleven columns', () => {
  it('shows every one of them on a desktop', () => {
    draw();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent.trim());
    expect(headers.length).toBe(11);
  });

  it('covers each field the brief names', () => {
    draw();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent.toLowerCase());
    const joined = headers.join(' | ');
    for (const needle of ['#', 'ticker', 'stock', 'price', 'day %', 'prev month close', 'stock %', 'niftybees', 'rel. strength', 'day volume', 'trend']) {
      expect(joined, `missing a column for "${needle}"`).toContain(needle);
    }
  });

  it('names the benchmark column after the actual benchmark', () => {
    // "Benchmark %" is true but uninformative when the app knows which one.
    draw();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).join()).toContain('NIFTYBEES');
  });
});

/**
 * THE ORDER IS A PRODUCT DECISION, NOT A LAYOUT ONE.
 *
 * Relative Strength is the only number the ranking is built from, and the
 * rows are already sorted by it. It originally sat after Price and Day % —
 * the conventional order — which on a phone put the day's move in front of
 * the reader and the ranking's own number out of sight. A stock that rose
 * today is not thereby strong, and that is precisely the misreading.
 */
describe('column order', () => {
  it('puts Relative Strength ahead of the day move', () => {
    draw();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent.toLowerCase());
    expect(headers.findIndex((h) => h.includes('rel. strength'))).toBeLessThan(
      headers.findIndex((h) => h.includes('day %')),
    );
  });

  it('keeps Relative Strength visible on the narrowest phone', () => {
    draw([row()], 320);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent.toLowerCase());
    expect(headers.join(' ')).toContain('rel. strength');
  });

  it('leads with identity: rank, ticker, then name', () => {
    draw();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent.trim().toLowerCase());
    expect(headers[0]).toContain('#');
    expect(headers[1]).toContain('ticker');
    expect(headers[2]).toContain('stock');
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * EVERY COLUMN AT EVERY WIDTH — owner's instruction, 27 Aug 2026.
 *
 * These tests previously asserted that narrow screens showed FEWER columns:
 * five at 320px, rising to eleven at 1440. The columns were dropped by a
 * `minWidth` threshold, so a reader on a phone held upright could not reach
 * Stock %, Benchmark %, Prev month close, Day volume or Trend at all — those
 * five only existed once the phone was turned sideways.
 *
 * The owner's requirement is the opposite: the phone is the same product as
 * the desktop, and the whole table scrolls sideways to reach the rest. The
 * columns were never compressed to fit, so nothing has to shrink — the
 * scroller simply now has all eleven to move through at any width.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('every column, at every width', () => {
  it.each([320, 390, 430, 768, 1024, 1440, 1920])('shows all eleven at %ipx', (width) => {
    draw([row()], width);
    expect(screen.getAllByRole('columnheader')).toHaveLength(11);
  });

  it('reaches the five that used to be phone-only-in-landscape', () => {
    draw([row()], 390);
    const joined = screen.getAllByRole('columnheader').map((h) => h.textContent.toLowerCase()).join(' | ');
    for (const needle of ['stock %', 'niftybees', 'prev month close', 'day volume', 'trend']) {
      expect(joined, `"${needle}" is unreachable on an upright phone`).toContain(needle);
    }
  });

  it('renders the values for them too, not just the headers', () => {
    // A header with no cell beneath it is a column in name only.
    draw([row()], 320);
    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toHaveLength(11);
    expect(cells.join(' | ')).toContain('24.50L');
    expect(cells.join(' | ')).toContain('Improving');
  });

  it('keeps the same count however narrow, so nothing silently drops', () => {
    const counts = [320, 390, 430, 768, 1024, 1440, 1920].map((w) => {
      cleanup();
      draw([row()], w);
      return screen.getAllByRole('columnheader').length;
    });
    expect(new Set(counts).size, 'the column count varies with width').toBe(1);
  });
});

/**
 * THE WHOLE ROW TRAVELS — owner's instruction, 27 Aug 2026.
 *
 * Rank and Ticker used to be `position: sticky`, pinned to the left edge
 * while the figures slid under them. That is a defensible default and it is
 * not what the owner wants: on a phone the two frozen columns cost 144px of
 * a 390px screen, leaving 246px for nine columns of numbers to move through.
 * Releasing them gives the whole width back to the figures, and the row
 * order is memorable enough to keep your place without an anchor.
 */
describe('nothing is pinned', () => {
  it('leaves no cell stuck to the left edge', () => {
    draw([row()], 390);
    const pinned = [...document.querySelectorAll('th, td')].filter(
      (cell) => cell.style.position === 'sticky',
    );
    expect(pinned).toHaveLength(0);
  });

  it('still holds the header row in place vertically', () => {
    // Horizontal pinning is what was dropped. A 250-row table whose headers
    // scroll away is a different and much worse problem.
    draw([row()], 390);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.every((h) => h.style.position === 'static')).toBe(true);
  });
});

describe('semantics a screen reader depends on', () => {
  it('is a real table with a caption and scoped headers', () => {
    draw();
    expect(screen.getByRole('table')).toBeTruthy();
    // The caption names the table; without it the reader hears "table" alone.
    expect(document.querySelector('caption')?.textContent).toContain('NIFTY 50');
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header.getAttribute('scope')).toBe('col');
    }
  });

  it('names each row, so activating one announces what was opened', () => {
    draw();
    const rowEl = screen.getAllByRole('row')[1];
    expect(rowEl.getAttribute('aria-label')).toContain('Reliance Industries');
    expect(rowEl.getAttribute('aria-label')).toContain('rank 1');
  });

  it('makes the scroll container focusable and named', () => {
    draw([row()], 320);
    const region = screen.getByRole('region');
    // A scrollable region no keyboard can reach hides its right-hand columns.
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-label')).toBeTruthy();
  });

  it('reaches every row by keyboard', () => {
    draw([row(), row({ symbol: 'TCS.NS', name: 'TCS', rank: 2, isTopN: false })]);
    for (const rowEl of screen.getAllByRole('row').slice(1)) {
      expect(rowEl.getAttribute('tabindex')).toBe('0');
    }
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * EVERY COLUMN THAT COULD BE MISREAD CARRIES AN EXPLANATION (owner, 27 Aug).
 *
 * "Stock %" and "Price" were the two columns with no icon — and the two most
 * easily misread of the eleven. A month-to-date figure sitting beside a day
 * move gets read as a second day move; a price read during a closed market
 * gets taken for a live one.
 *
 * D9 makes contextual help a product requirement, and a requirement with no
 * test decays silently: the app still works, it is just quietly less
 * understandable than it was.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('contextual help on the columns', () => {
  it('explains Stock % and Price, not just the other nine', () => {
    draw();
    const names = screen.getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter(Boolean);
    expect(names).toContain('About Stock %');
    expect(names).toContain('About Price');
  });

  it('reaches them on a phone too, where the icons matter most', () => {
    draw([row()], 390);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toContain('About Stock %');
    expect(names).toContain('About Price');
  });

  it('tells the reader whether the price is live or a close', () => {
    // The one thing the static glossary cannot answer, because it changes by
    // the minute. Passed in as a note rather than written into glossary.js.
    draw();
    const trigger = screen.getAllByRole('button').find((b) => b.getAttribute('aria-label') === 'About Price');
    fireEvent.click(trigger);
    expect(document.body.textContent).toContain('Not live. This is the close of 26 Aug 2026.');
  });
});

describe('the previous month close is auditable', () => {
  it('shows the session it is the close of, beside the figure', () => {
    // Without the date the reader cannot tell a month-end from whatever bar
    // the data happened to stop at — which is the bug v1.6.1 fixed upstream.
    draw();
    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    const cell = cells.find((c) => c.includes('₹1,246'));
    expect(cell).toContain('31 Jul 2026');
  });

  it('shows the price alone rather than an invented date when there is none', () => {
    draw([row({ priorMonthEndDateLabel: null })]);
    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    expect(cells.some((c) => c.trim() === '₹1,246')).toBe(true);
  });
});

/**
 * COLOUR IS THE SECOND CHANNEL, NEVER THE ONLY ONE. Every signed figure
 * carries its sign inside the string, so direction survives for a reader who
 * cannot distinguish the green from the red.
 */
describe('never colour alone', () => {
  it('signs every positive and negative figure in text', () => {
    draw([row({ dayChangeLabel: '-1.40%', dayDirection: 'loss', rsLabel: '−6.2%', rsDirection: 'loss' })]);
    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    expect(cells.some((c) => c.includes('-1.40%'))).toBe(true);
    expect(cells.some((c) => c.includes('−6.2%'))).toBe(true);
  });

  it('shows the trend as a word, not a colour swatch', () => {
    draw();
    expect(screen.getByText('Improving')).toBeTruthy();
  });
});

describe('missing values', () => {
  it('shows an em-dash rather than a zero for an unknown figure', () => {
    // A fabricated 0.00% would read as "did not move", which is a claim.
    draw([row({ priceLabel: null, dayChangeLabel: null, rsLabel: null, volumeLabel: null, direction: null })]);
    const cells = screen.getAllByRole('cell').map((c) => c.textContent.trim());
    expect(cells.filter((c) => c === '—').length).toBeGreaterThanOrEqual(4);
    expect(cells.some((c) => c === '0.00%')).toBe(false);
  });
});
