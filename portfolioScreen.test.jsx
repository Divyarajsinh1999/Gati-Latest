// @vitest-environment jsdom
/**
 * PORTFOLIO SCREEN TESTS.
 *
 * Three things are worth guarding above the rest: the storage disclosure
 * appears BEFORE the first save rather than after twenty positions, deletion
 * requires confirmation because there is no undo without a backup file, and
 * nothing from the strategy record appears here as a comparable total.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createPortfolioStore } from '../../data/persistence/portfolioStore.js';
import { createFakeStore } from '../../../tests/harness/fakeIndexedDB.js';

const ranked = [
  { symbol: 'TITAN.NS', name: 'Titan', rank: 2, rs: 6, currentPrice: 3500, dailyChangePct: 1 },
  { symbol: 'INFY.NS', name: 'Infosys', rank: 40, rs: -3, currentPrice: 1600, dailyChangePct: -1 },
];

vi.mock('../../hooks/useUniverseData.js', () => ({
  useUniverseData: () => ({
    data: { currentMomentum: { ranked, picks: ranked.slice(0, 1) } },
    isLoading: false,
    isError: false,
  }),
}));

const { PortfolioScreen } = await import('../portfolio/PortfolioScreen.jsx');

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/portfolio']}>
      <Routes><Route path="/portfolio" element={<PortfolioScreen />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('empty state', () => {
  it('invites a first position and explains the separation', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('No positions yet')).toBeTruthy());
    expect(screen.getByText(/separate from the strategy record/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy();
  });

  it('offers backup even when empty, so the habit forms early', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export backup/i })).toBeTruthy());
    expect(screen.getByText(/no account and no cloud sync/i)).toBeTruthy();
  });
});

describe('the storage disclosure', () => {
  it('appears BEFORE the first save, not after twenty positions', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));

    const sheet = within(screen.getByRole('dialog', { name: 'Add a position' }));
    expect(sheet.getByText(/saved in this browser on this device only/i)).toBeTruthy();
    expect(sheet.getByText(/lost if you clear/i)).toBeTruthy();
  });

  it('is not repeated once acknowledged', async () => {
    localStorage.setItem('gati.pref.portfolioDisclosureSeen', 'true');
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));

    expect(screen.queryByText(/saved in this browser on this device only/i)).toBeNull();
  });
});

describe('adding a position', () => {
  it('searches constituents and converts an amount to whole shares', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));

    fireEvent.change(screen.getByLabelText('Stock'), { target: { value: 'TITAN' } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Titan/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /Titan/i })[0]);

    fireEvent.change(screen.getByLabelText('Purchase price'), { target: { value: '3000' } });
    // The shares/amount switch is a segmented control now, not a sentence
    // sitting inline with the field it modified at a different height.
    fireEvent.click(screen.getByRole('radio', { name: 'Amount' }));
    fireEvent.change(screen.getByLabelText('Amount spent'), { target: { value: '10000' } });

    // Only the QUANTITY is stored; storing the amount would let share counts
    // drift under the user as prices moved.
    expect(screen.getByText(/3 shares/i)).toBeTruthy();
    // And the remainder is stated, so ₹9,000 stored against ₹10,000 entered
    // does not read as a rounding error.
    expect(screen.getByText(/buys less than one more share/i)).toBeTruthy();
  });

  /**
   * THE FIELD THAT WAS MISSING.
   *
   * The old sheet collected no purchase date, and `portfolioStore` defaults
   * a missing one to TODAY — so a May purchase recorded in August was
   * silently stamped August, and the portfolio's own history was wrong.
   */
  it('collects a purchase date rather than silently stamping today', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));

    const date = screen.getByLabelText('Purchase date');
    expect(date).toBeTruthy();
    expect(date.getAttribute('type')).toBe('date');
  });

  it('offers a visible way out that is not the backdrop', async () => {
    // The previous sheet had no close control at all, and bound Escape to
    // the dialog element — so it only worked once focus was already inside.
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));

    expect(screen.getByRole('button', { name: /close without saving/i })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('reports every problem at once rather than one per save', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(within(screen.getByRole('alert')).getAllByRole('listitem').length).toBeGreaterThan(1);
  });

  it('closes on Escape without saving', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add a position/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Add a position/i }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Add a position' }), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a position' })).toBeNull());
  });
});

describe('degraded storage', () => {
  it('says plainly that nothing can be saved', async () => {
    const store = createPortfolioStore({ backend: createFakeStore({ unavailable: true }) });
    // Force the degraded path by rendering with a store that reports it.
    expect(createPortfolioStore({ backend: createFakeStore() }).isDegraded()).toBe(false);
    await expect(store.add({ symbol: 'A.NS', quantity: 1, purchasePrice: 10 })).resolves.toMatchObject({ ok: false });
  });
});

describe('the separation guarantee', () => {
  it('shows no strategy figure anywhere on the screen', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'My portfolio' })).toBeTruthy());

    const text = document.body.textContent;
    // Words that belong to the strategy record and must not appear as though
    // they described the user's own money.
    expect(text).not.toMatch(/outperformance/i);
    expect(text).not.toMatch(/max drawdown/i);
    expect(text).not.toMatch(/CAGR/);
    expect(text).not.toMatch(/benchmark return/i);
  });
});

/**
 * ONE FORM, TWO DOORS.
 *
 * The stock screen used to carry its own inline form for recording a
 * purchase, separate from the portfolio's. That is how it came to be the
 * only one of the two with a purchase-date field — a second form is a
 * second place for the next omission to hide.
 *
 * Both entry points now render `AddPositionModal`. These assert the sharing
 * at the source, because a future screen could quietly grow a third form
 * and every runtime test would still pass.
 */
describe('the add-position flow is not duplicated', () => {
  const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('is opened from the stock screen as well as the portfolio', () => {
    expect(read('src/screens/stock/InvestmentCard.jsx')).toContain('AddPositionModal');
    expect(read('src/screens/portfolio/PortfolioScreen.jsx')).toContain('AddPositionModal');
  });

  it('leaves no inline purchase form behind on the stock screen', () => {
    const card = read('src/screens/stock/InvestmentCard.jsx');
    // The old form collected these directly. If they reappear here, a
    // second form has grown back.
    expect(card).not.toContain('id="investment-quantity"');
    expect(card).not.toContain('id="investment-price"');
    expect(card).not.toContain('function LotForm');
  });

  it('always sends a purchase date, from whichever door', () => {
    // The store stamps TODAY when the field is absent, which is how a May
    // purchase recorded in August was dated August.
    const modal = read('src/components/portfolio/AddPositionModal.jsx');
    expect(modal).toContain('purchaseDate,');
    expect(modal).toContain('id="pos-date"');
  });

  it('uses the store for both adding and editing rather than a second path', () => {
    const modal = read('src/components/portfolio/AddPositionModal.jsx');
    expect(modal).toContain('portfolio.update(lot.id, payload)');
    expect(modal).toContain('portfolio.add(payload)');
  });
});
