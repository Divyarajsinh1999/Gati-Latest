// @vitest-environment jsdom
/**
 * END-TO-END INTEGRATION — deliberately mocks NOTHING.
 *
 * Every other component test stubs `useUniverseData`, which means the seams
 * between the layers are never exercised: MockProvider → dataService →
 * runBacktest → computeCurrentMomentum → rsHistory → React Query → the screen.
 * A shape mismatch anywhere along that path would pass every unit test and
 * still produce a broken app — as it did during M7, when two engine helpers
 * that return objects were read as though they returned numbers.
 *
 * Runs against the deterministic Mock provider (seeded walk, identical output
 * every run), so assertions are structural and invariant-based rather than
 * pinned to synthetic prices: the exact numbers are meaningless, but the
 * RELATIONSHIPS between them must hold whatever the prices are.
 *
 * M7 SPLIT THE OLD PAGE IN TWO. Each assertion now runs against whichever
 * screen owns it — the universe screen for the live ranking, the record for
 * the historical figures. The behaviours are unchanged; only their address is.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UniverseScreen } from '../../screens/universe/UniverseScreen.jsx';
import { StrategyRecordScreen } from '../../screens/record/StrategyRecordScreen.jsx';
import { parseStrategyKey, universePath } from '../../config/routes.js';

const TIMEOUT = 20_000;

function mount(path, element, routePath) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderUniverse(strategyKey = 'nifty50') {
  const { universeKey, window } = parseStrategyKey(strategyKey);
  return mount(universePath(universeKey, window), <UniverseScreen />, '/:universeKey/:window?');
}

function renderRecord(strategyKey = 'nifty50') {
  const { universeKey, window } = parseStrategyKey(strategyKey);
  // The record inherits its window from the preference, exactly as the app does.
  localStorage.setItem('gati.pref.lastWindow', JSON.stringify(window));
  return mount(`/${universeKey}/record`, <StrategyRecordScreen />, '/:universeKey/record');
}

/**
 * Read a metric tile's full text by its label.
 *
 * Scoped to the node whose tile actually contains a figure: M9 added a chart
 * legend that also renders the word "Benchmark", and an unscoped query picks
 * up the swatch label — whose parent has no percentage in it at all.
 */
function tile(label) {
  const matcher = (content) => content.trim().toLowerCase() === label.toLowerCase();
  for (const node of screen.getAllByText(matcher)) {
    const text = node.closest('div')?.parentElement?.textContent ?? '';
    if (/[-+−]?\d+(\.\d+)?(%|pp)/.test(text)) return text;
  }
  return '';
}

/**
 * The Top 5 card, scoped.
 *
 * The verdict figure uses the same `+11.4pp` format as the rows, so an
 * unscoped query picks it up first and compares the headline against a stock.
 */
function topFiveCard() {
  return within(screen.getByText('Top 5 right now').closest('section'));
}

function parsePct(text) {
  const m = String(text).match(/([-+−]?\d+(?:\.\d+)?)(?:%|pp)/);
  if (!m) return null;
  return Number(m[1].replace('−', '-'));
}

beforeEach(() => {
  localStorage.clear(); // the data layer caches locally; start clean
});
afterEach(cleanup);

/* ------------------------------------------------------------------ */
/* THE LIVE RANKING — universe screen                                  */
/* ------------------------------------------------------------------ */

describe('end-to-end: real provider → engine → universe screen', () => {
  it('renders the universe with a populated Top 5', async () => {
    renderUniverse();
    await waitFor(() => expect(screen.getByText('Top 5 right now')).toBeTruthy(), { timeout: TIMEOUT });

    // M14: the visible title is "Dashboard"; the universe is carried in
    // the heading's accessible name so three routes do not share one h1.
    expect(screen.getByRole('heading', { level: 1, name: /NIFTY 50/ })).toBeTruthy();
    expect(screen.getAllByText(/^[+−-]\d+\.\d+%$/).length).toBeGreaterThanOrEqual(5);
  }, 30_000);

  it('CRITICAL: current-month RS values are not all zero', async () => {
    // The assertion that would have caught the previous-month-end bug, where
    // every stock divided today's price by itself and reported exactly 0.00%.
    // Any non-zero RS proves the reference is a genuinely earlier month-end;
    // differing values prove the order is momentum, not the tie-break.
    renderUniverse();
    await waitFor(() => expect(screen.getByText('Top 5 right now')).toBeTruthy(), { timeout: TIMEOUT });

    const values = topFiveCard()
      .getAllByText(/^[+−-]\d+\.\d+%$/)
      .map((el) => parsePct(el.textContent))
      .filter((v) => v != null);

    expect(values.length).toBeGreaterThanOrEqual(5);
    expect(values.filter((v) => v !== 0).length).toBeGreaterThan(0);
    expect(new Set(values).size).toBeGreaterThan(2);
  }, 30_000);

  it('orders the Top 5 by descending RS, rank 1 highest', async () => {
    renderUniverse();
    await waitFor(() => expect(screen.getByText('Top 5 right now')).toBeTruthy(), { timeout: TIMEOUT });

    const values = topFiveCard()
      .getAllByText(/^[+−-]\d+\.\d+%$/)
      .map((el) => parsePct(el.textContent))
      .filter((v) => v != null)
      .slice(0, 5);

    expect(values.length).toBe(5);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 1e-9);
    }
  }, 30_000);

  /**
   * THE GLOBAL AMOUNT BOX IS GONE (v1.4.0, owner brief 8 Aug 2026).
   *
   * This slot used to hold a reconciliation of "Invested + Cash left = the
   * amount you typed", sizing all five picks at once. That control was
   * removed: one number for the whole list could only ever describe a
   * hypothetical portfolio bought in a single transaction at today's prices,
   * so the share counts it produced belonged to no actual holding.
   *
   * The invariant it guarded — whole-share flooring must account for every
   * rupee, with nothing lost to rounding — still matters, and still has a
   * home: it now applies to a reader's real position. It is asserted against
   * the arithmetic directly in selectors/__tests__/investmentView.test.js
   * rather than by driving a form through the DOM, which is both faster and
   * a more precise statement of the thing being protected.
   */
  it('no longer offers a global amount box on the universe screen', async () => {
    renderUniverse();
    await waitFor(() => expect(topFiveCard().getByText(/Top 5 right now/)).toBeTruthy(), { timeout: TIMEOUT });
    expect(screen.queryByLabelText(/your amount/i)).toBeNull();
    expect(screen.queryByText(/^Invested ₹/)).toBeNull();
  }, 30_000);

  it('runs a longer-lookback window end-to-end', async () => {
    // Would catch a wiring mistake where the window changed in the UI but the
    // engine call silently stayed on one month.
    renderUniverse('nifty50-rs-3m');
    await waitFor(() => expect(screen.getByText('Top 5 right now')).toBeTruthy(), { timeout: TIMEOUT });

    expect(screen.getByRole('radio', { name: '3M' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByText(/^[+−-]\d+\.\d+%$/).length).toBeGreaterThanOrEqual(5);
  }, 30_000);
});

/* ------------------------------------------------------------------ */
/* THE HISTORICAL RECORD                                               */
/* ------------------------------------------------------------------ */

describe('end-to-end: real provider → engine → strategy record', () => {
  it('produces a backtest whose outperformance equals strategy minus benchmark', async () => {
    renderRecord();
    await waitFor(() => expect(screen.getByText('Performance')).toBeTruthy(), { timeout: TIMEOUT });

    const total = parsePct(tile('Total return'));
    const benchmark = parsePct(tile('Benchmark'));
    const outperformance = parsePct(tile('Outperformance'));

    expect(total).not.toBeNull();
    expect(benchmark).not.toBeNull();
    expect(outperformance).not.toBeNull();
    // The identity that must hold whatever the data, allowing for display
    // rounding on each of the three figures.
    expect(Math.abs(outperformance - (total - benchmark))).toBeLessThan(0.2);
  }, 30_000);

  it('reports a max drawdown that is real and non-positive', async () => {
    renderRecord();
    await waitFor(() => expect(screen.getByText('Risk')).toBeTruthy(), { timeout: TIMEOUT });

    fireEvent.click(within(screen.getByText('Risk').parentElement).getByRole('button'));
    const dd = parsePct(tile('Max drawdown'));
    expect(dd).not.toBeNull();
    expect(dd).toBeLessThanOrEqual(0);
  }, 30_000);

  it('toggling transaction costs changes the result WITHOUT refetching', async () => {
    renderRecord();
    await waitFor(() => expect(screen.getByText('Performance')).toBeTruthy(), { timeout: TIMEOUT });

    const gross = parsePct(tile('Total return'));
    fireEvent.click(screen.getByRole('button', { name: /Show net/i }));

    await waitFor(() => {
      // Net of costs must be strictly worse than gross. If this ever reads
      // equal, the cost module has become unreachable again — which shipped
      // once already, unit-tested and wired to nothing.
      expect(parsePct(tile('Total return'))).toBeLessThan(gross);
    }, { timeout: 10_000 });
  }, 30_000);

  it('states the method and its limitations with real data present', async () => {
    renderRecord();
    await waitFor(() => expect(screen.getByText('Performance')).toBeTruthy(), { timeout: TIMEOUT });

    const text = document.body.textContent.replace(/\s+/g, ' ');
    expect(text).toMatch(/next trading day.s open/i);
    expect(text).toMatch(/adjusted/i);
    expect(text).toMatch(/index members/i);
  }, 30_000);

  it('flags the 12-month window as a thin sample rather than an unearned CAGR', async () => {
    // With data from January 2025, a 12-month window cannot yet have produced
    // a dozen completed rebalances. This is the real-data check that the
    // sample-size guard actually fires, not just its unit test.
    renderRecord('nifty50-rs-12m');
    await waitFor(
      () => expect(screen.getByText(/early read, not a track record|Not enough completed months/i)).toBeTruthy(),
      { timeout: TIMEOUT },
    );
  }, 30_000);

  it('keeps exports in Reports rather than duplicating them here', async () => {
    // The exports themselves are covered against Reports in the screen suite.
    // What matters here is that exactly one panel exists in the product.
    renderRecord();
    await waitFor(() => expect(screen.getByText('Performance')).toBeTruthy(), { timeout: TIMEOUT });
    expect(screen.queryByText('CSV exports')).toBeNull();
  }, 30_000);
});
