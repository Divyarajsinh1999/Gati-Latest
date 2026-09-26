// @vitest-environment jsdom
/**
 * M8 SCREEN TESTS — Reports, Settings, Methodology.
 *
 * These assert the behaviours the milestone's decisions turn on: that reports
 * explain WHY and not only what (D14.4), that the methodology version is
 * stamped everywhere it matters (D14.5), that the expensive comparison stays
 * collapsed until asked for, and that nothing here fabricates a figure it
 * does not have.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { METHODOLOGY_VERSION, METHODOLOGY_SECTIONS } from '../../config/methodology.js';
import { UNIVERSE_KEYS, UNIVERSES } from '../../config/universes.js';

const pick = (symbol, rank) => ({
  symbol, name: `${symbol} Ltd`, rank, rs: 6 - rank,
  stockReturnPct: 8, benchmarkReturnPct: 2, currentPrice: 1000,
  dailyChangePct: 0.4, rsHistory: [], sector: 'Financials',
});
const picks = [1, 2, 3, 4, 5].map((r) => pick(`S${r}`, r));

const cycle = {
  signalMonthKey: '2025-03',
  portfolioHoldingReturnPct: 6.4,
  benchmarkHoldingReturnPct: 1.9,
  picks,
};

function makeData() {
  return {
    universe: UNIVERSES[UNIVERSE_KEYS[0]],
    stocks: [],
    priceSeriesMap: new Map(),
    benchmarkSeries: [],
    unavailableSymbols: [],
    quotesError: null,
    currentMomentum: { picks, ranked: picks },
    momentumAge: new Map(),
    headline: {
      strategyReturnPct: 21.3, benchmarkReturnPct: 9.9,
      outperformancePct: 11.4, maxDrawdownPct: -8.7, completedCycles: 3,
    },
    backtest: { cycles: [cycle, cycle], equityCurve: [], rankingHistory: [], flags: [] },
  };
}

const state = { data: makeData(), isLoading: false, isError: false, error: null };

vi.mock('../../hooks/useUniverseData.js', () => ({
  useUniverseData: () => state,
  useUniverseHistory: () => state,
}));

vi.mock('../../hooks/useDataFreshness.js', () => ({
  useDataFreshness: () => ({ fetchedAt: '2026-08-03T10:00:00Z', dataAsOf: '2026-08-01', providerId: 'yahoo', isLoaded: true }),
}));

const { ReportsScreen } = await import('../reports/ReportsScreen.jsx');
const { SettingsScreen } = await import('../settings/SettingsScreen.jsx');
const { MethodologyScreen } = await import('../methodology/MethodologyScreen.jsx');

function renderAt(path, element, routePath = path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={routePath} element={element} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  Object.assign(state, { data: makeData(), isLoading: false, isError: false, error: null });
});

/* ------------------------------------------------------------------ */
/* REPORTS                                                             */
/* ------------------------------------------------------------------ */

describe('ReportsScreen', () => {
  const renderReports = () => renderAt('/reports', <ReportsScreen />);

  it('renders without throwing', () => {
    renderReports();
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeTruthy();
  });

  it('stamps the methodology version (D14.5)', () => {
    renderReports();
    expect(screen.getAllByText(`Methodology v${METHODOLOGY_VERSION}`).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /About Methodology version/i })).toBeTruthy();
  });

  it('explains WHY each section exists, not only what it shows (D14.4)', () => {
    renderReports();
    expect(screen.getByText(/which part of the market the strategy is finding momentum in/i)).toBeTruthy();
    expect(screen.getByText(/only works at one window is usually a coincidence/i)).toBeTruthy();
  });

  it('compares the three universes side by side, never summed', () => {
    renderReports();
    for (const key of UNIVERSE_KEYS) {
      expect(screen.getByText(UNIVERSES[key].label)).toBeTruthy();
    }
    expect(document.body.textContent).not.toMatch(/combined return|total across/i);
  });

  it('keeps the twelve-backtest matrix COLLAPSED until asked for', () => {
    // Roughly 650ms of compute. Eagerly computing it would make this the
    // slowest screen in the app to serve a section most visits never open.
    renderReports();
    const toggle = screen.getByRole('button', { name: /Every window, every universe/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('warns that the matrix costs a moment, rather than appearing to hang', () => {
    renderReports();
    expect(screen.getByText(/Computes twelve backtests/i)).toBeTruthy();
  });

  it('offers every CSV export, now living here rather than on the record', () => {
    renderReports();
    for (const label of ['Current rankings', 'Top 5', 'Monthly rankings', 'Trades']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('lets the reader pick which universe to export', () => {
    renderReports();
    const exportSection = within(screen.getByLabelText('CSV exports').parentElement);
    expect(exportSection).toBeTruthy();
    expect(screen.getAllByRole('button', { name: UNIVERSES[UNIVERSE_KEYS[1]].shortLabel }).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* SETTINGS                                                            */
/* ------------------------------------------------------------------ */

describe('SettingsScreen', () => {
  const renderSettings = () => renderAt('/settings', <SettingsScreen />);

  it('renders every group', () => {
    renderSettings();
    for (const group of ['Appearance', 'Investing defaults', 'Data and sources', 'Methodology']) {
      expect(screen.getByText(group)).toBeTruthy();
    }
  });

  it('applies a change immediately, with no save button', () => {
    // A settings screen with a save step invites people to change three
    // things and lose two.
    renderSettings();
    expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: '6M' }));
    expect(JSON.parse(localStorage.getItem('gati.pref.lastWindow'))).toBe('6m');
  });

  it('toggles transaction costs and persists it', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('radio', { name: 'NET' }));
    expect(JSON.parse(localStorage.getItem('gati.pref.includeCosts'))).toBe(true);
  });

  it('shows where the data came from and how fresh it is', () => {
    renderSettings();
    expect(screen.getByText('yahoo')).toBeTruthy();
    expect(screen.getByText('Newest price bar')).toBeTruthy();
    expect(screen.getByText('Last checked')).toBeTruthy();
  });

  it('shows constituent provenance per universe', () => {
    renderSettings();
    for (const key of UNIVERSE_KEYS) {
      expect(screen.getByText(UNIVERSES[key].shortLabel)).toBeTruthy();
    }
  });

  it('records the methodology history, so old figures stay explainable', () => {
    renderSettings();
    // The version appears as both the current chip and its history row.
    expect(screen.getAllByText(`v${METHODOLOGY_VERSION}`).length).toBeGreaterThan(0);
    expect(screen.getByText(/fractional equal weights/i)).toBeTruthy();
  });

  it('explains that clearing the cache loses nothing the user entered', () => {
    renderSettings();
    expect(screen.getByText(/Nothing you have entered is affected/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear cache' })).toBeTruthy();
  });

  it('states that the investment amount belongs to the Simulator only', () => {
    renderSettings();
    expect(screen.getByText(/strategy record never assumes an amount/i)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* METHODOLOGY                                                         */
/* ------------------------------------------------------------------ */

describe('MethodologyScreen', () => {
  const renderMethodology = (hash = '') => renderAt(`/methodology${hash}`, <MethodologyScreen />, '/methodology');

  it('lists all eleven sections', () => {
    renderMethodology();
    expect(METHODOLOGY_SECTIONS).toHaveLength(11);
    for (const section of METHODOLOGY_SECTIONS) {
      expect(screen.getByText(section.title)).toBeTruthy();
    }
  });

  it('collapses everything on arrival', () => {
    renderMethodology();
    for (const section of METHODOLOGY_SECTIONS) {
      expect(screen.getByRole('button', { name: section.title }).getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('OPENS the section reached by deep link', () => {
    // Someone following a link from a specific caveat wants that paragraph,
    // not a table of contents.
    renderMethodology('#execution-convention');
    expect(screen.getByRole('button', { name: /Execution convention/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/next trading day/i)).toBeTruthy();
  });

  it('explains WHY each rule works that way (D14.4)', () => {
    renderMethodology();
    fireEvent.click(screen.getByRole('button', { name: /What Relative Strength is/i }));
    expect(screen.getByText('Why it works this way')).toBeTruthy();
    expect(screen.getByText(/can be verified by the reader/i)).toBeTruthy();
  });

  it('expands and collapses everything at once', () => {
    renderMethodology();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getAllByText('Why it works this way')).toHaveLength(METHODOLOGY_SECTIONS.length);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('Why it works this way')).toBeNull();
  });

  it('states the limitations rather than only the method', () => {
    renderMethodology('#limitations');
    expect(screen.getByText(/look better than live trading would/i)).toBeTruthy();
  });

  it('every section carries a why, enforced', () => {
    for (const section of METHODOLOGY_SECTIONS) {
      expect(section.why, `${section.id} has no reasoning`).toBeTruthy();
      expect(section.why.length).toBeGreaterThan(40);
      expect(section.body.length).toBeGreaterThan(0);
    }
  });
});
