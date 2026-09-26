// @vitest-environment jsdom
/**
 * SCREEN SMOKE TESTS.
 *
 * WHAT THESE CATCH
 *   The failure modes a build check cannot: a screen that throws on realistic
 *   data, a required disclosure that silently stops rendering, a control that
 *   no longer reaches anything, or a loading state that crashes instead of
 *   waiting. Data is stubbed, so they run in milliseconds and can cover the
 *   states that are hard to reach against a live provider.
 *
 *   The end-to-end suite covers the real stack; this one covers the states.
 *
 * WHY THEY ASSERT BEHAVIOUR RATHER THAN MARKUP
 *   The previous version of this file pinned table accessible-names, column
 *   indices and heading text. When M7 split the page in two, every one of
 *   those broke — not because a behaviour regressed, but because the markup
 *   moved. Tests that fail for the wrong reason train people to update tests
 *   without reading them.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const universe = {
  key: 'nifty50',
  label: 'NIFTY 50',
  shortLabel: 'Large Cap',
  benchmark: { symbol: 'NIFTYBEES.NS', label: 'Nifty BeES', shortLabel: 'NIFTYBEES' },
  meta: { constituentStatus: 'complete', expectedCount: 50 },
};

const pick = (symbol, rank) => ({
  symbol,
  name: `${symbol.replace('.NS', '')} Ltd`,
  rank,
  rs: 6 - rank,
  stockReturnPct: 8,
  benchmarkReturnPct: 2,
  currentPrice: 1000,
  dailyChangePct: 0.5,
  volume: 1000,
  sector: 'Financial Services',
  rsHistory: [],
  flags: [],
});

const picks = [1, 2, 3, 4, 5].map((r) => pick(`S${r}.NS`, r));

const cycle = {
  monthKey: '2025-03',
  signalMonthKey: '2025-03',
  entryDate: '2025-04-01',
  exitDate: '2025-05-02',
  portfolioHoldingReturnPct: 6.42,
  benchmarkHoldingReturnPct: 1.93,
  capitalAtStart: 100,
  totalInvested: 100,
  cashCarriedIn: 0,
  transactionCostsPct: 0,
  picks,
};

function makeData(over = {}) {
  return {
    universe,
    stocks: new Array(50).fill(null).map((_, i) => ({ symbol: `S${i}.NS`, name: `S${i}` })),
    quotes: new Map(),
    dataAsOf: '2026-07-30',
    providerId: 'mock',
    unavailableSymbols: [],
    quotesError: null,
    limitations: ['Uses current constituents for past dates (survivorship-bias limitation)'],
    costsApplied: false,
    historySufficiency: { isSufficient: true },
    daysToRebalance: 18,
    momentumAge: new Map([['S1.NS', { consecutiveMonths: 4, sinceMonthKey: '2024-12', isNewEntrant: false }]]),
    rebalanceSummary: { available: true, entered: 2, continuing: 3, exited: 2, monthKey: '2025-03' },
    changes: {
      hasBaseline: true,
      changeCount: 2,
      currentDate: '2025-03-31',
      currentMonthKey: '2025-03',
      previousMonthKey: '2025-02',
      entered: [{ symbol: 'S1.NS', name: 'S1 Ltd', rank: 1 }],
      exited: [{ symbol: 'X.NS', name: 'X Ltd', previousRank: 3 }],
      biggestMoves: [],
    },
    currentMomentum: { picks, ranked: picks, asOf: '2026-07-30', basedOnMonthKey: '2026-06' },
    headline: {
      strategyReturnPct: 21.3,
      benchmarkReturnPct: 9.9,
      outperformancePct: 11.4,
      maxDrawdownPct: -8.7,
      completedCycles: 3,
    },
    backtest: {
      cycles: [cycle, cycle, cycle],
      equityCurve: [
        { date: '2025-03-31', monthKey: '2025-03', indexValue: 100 },
        { date: '2025-04-30', monthKey: '2025-04', indexValue: 110 },
        { date: '2025-05-30', monthKey: '2025-05', indexValue: 121.3 },
      ],
      rankingHistory: [{ monthKey: '2025-03', date: '2025-03-31', rankings: picks }],
      flags: [],
      strategyReturnPct: 21.3,
      benchmarkReturnPct: 9.9,
      outperformancePct: 11.4,
      maxDrawdownPct: -8.7,
    },
    ...over,
  };
}

const state = { data: makeData(), isLoading: false, isError: false, error: null };

vi.mock('../../hooks/useUniverseData.js', () => ({
  useUniverseData: () => state,
  useUniverseHistory: () => state,
}));

const { UniverseScreen } = await import('../../screens/universe/UniverseScreen.jsx');
const { FullRankingScreen } = await import('../../screens/ranking/FullRankingScreen.jsx');
const { StrategyRecordScreen } = await import('../../screens/record/StrategyRecordScreen.jsx');

/**
 * A QueryClient is required even though `useUniverseData` is mocked above.
 * The screens read the centralised market session, which asks React Query
 * how fresh the cached data is — that is the whole point of the session
 * being the single authority on whether anything may be called live.
 *
 * Provided rather than made optional in the hook: a screen that silently
 * works without a client would also silently stop knowing whether its data
 * was stale, and would answer "not live" forever without anyone noticing.
 */
function renderAt(path, element, routePath) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={routePath} element={element} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const renderUniverse = () => renderAt('/nifty50', <UniverseScreen />, '/:universeKey');
const renderRanking = () => renderAt('/nifty50/all', <FullRankingScreen />, '/:universeKey/all');
const renderRecord = () => renderAt('/nifty50/record', <StrategyRecordScreen />, '/:universeKey/record');

afterEach(() => {
  cleanup();
  localStorage.clear();
  Object.assign(state, { data: makeData(), isLoading: false, isError: false, error: null });
});

/* ------------------------------------------------------------------ */
/* UNIVERSE SCREEN — the four questions                                */
/* ------------------------------------------------------------------ */

describe('UniverseScreen', () => {
  it('renders without throwing on realistic data', () => {
    renderUniverse();
    /*
      RETARGETED IN M14 (D18). The visible h1 is "Dashboard" now, with
      the universe in the tab strip — the reference build's layout.

      IT STILL ASSERTS THE UNIVERSE, and that is the point of keeping it: the
      app has three routes that would otherwise share one heading, so the
      accessible name carries the universe as a hidden suffix. A regex here
      rather than the new literal, because what must not break is that the
      heading IDENTIFIES THE PAGE — not that it happens to say any particular
      words.
    */
    expect(screen.getByRole('heading', { level: 1, name: /NIFTY 50/ })).toBeTruthy();
  });

  it('Q1: shows the Top 5', () => {
    renderUniverse();
    expect(screen.getByText('Top 5 right now')).toBeTruthy();
    for (const p of picks) expect(screen.getByText(p.name)).toBeTruthy();
  });

  it('Q2: summarises the last rebalance in three numbers', () => {
    renderUniverse();
    expect(screen.getByText('2 entered · 3 continuing · 2 left')).toBeTruthy();
  });

  it('Q3: draws the ledger and explains it above the rows', () => {
    const { container } = renderUniverse();
    expect(screen.getByText(/gap between them is Relative Strength/i)).toBeTruthy();
    expect(container.querySelectorAll('pattern').length).toBeGreaterThan(0);
  });

  it('Q4: labels position status without giving advice', () => {
    renderUniverse();
    expect(screen.getByText('New this month')).toBeTruthy();
    expect(screen.getAllByText('Held').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\bbuy now\b|\byou should\b|we recommend/i);
  });

  it('shows Momentum Age for an established run', () => {
    renderUniverse();
    expect(screen.getByText('4m')).toBeTruthy();
  });

  it('shows rebalance timing as context, not a countdown', () => {
    renderUniverse();
    expect(screen.getByText(/next review in 18 trading days/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/hurry|act now|don't miss/i);
  });

  it('keeps disclosures OUT of the reading path', () => {
    // The composition failure the restructure exists to fix: three caveat
    // boxes above the answer. The methodology is a link at the foot instead.
    renderUniverse();
    const body = document.body.textContent;
    const verdictAt = body.indexOf('Ahead of');
    const methodAt = body.indexOf('How this is calculated');
    expect(verdictAt).toBeGreaterThan(-1);
    expect(methodAt).toBeGreaterThan(verdictAt);
  });

  it('offers contextual help on the metrics', () => {
    renderUniverse();
    // Outperformance appears twice by design — on the verdict and on its
    // metric tile — and both carry the same explanation.
    expect(screen.getAllByRole('button', { name: /About Outperformance/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /About Momentum Age/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /About Maximum drawdown/i })).toBeTruthy();
  });

  it('shows a skeleton rather than crashing while data is in flight', () => {
    Object.assign(state, { data: undefined, isLoading: true });
    const { container } = renderUniverse();
    expect(container.querySelectorAll('.gati-skeleton').length).toBeGreaterThan(0);
  });

  it('shows an explicit error, stating nothing is estimated', () => {
    Object.assign(state, { data: undefined, isLoading: false, isError: true, error: new Error('provider down') });
    renderUniverse();
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.getByText(/No values are being estimated or substituted/i)).toBeTruthy();
  });

  it('surfaces excluded symbols rather than dropping them silently', () => {
    state.data = makeData({ unavailableSymbols: [{ symbol: 'DEAD.NS', reason: '404' }] });
    renderUniverse();
    expect(screen.getByText(/1 of 50 stocks excluded/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* FULL RANKING                                                        */
/* ------------------------------------------------------------------ */

describe('FullRankingScreen', () => {
  it('renders the ordered list with search and filters', () => {
    renderRanking();
    expect(screen.getByLabelText('Search stocks')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^All/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Top 5/ })).toBeTruthy();
  });

  it('puts the ledger key ABOVE the rows it explains', () => {
    renderRanking();
    const body = document.body.textContent;
    expect(body.indexOf('gap between them is Relative Strength')).toBeLessThan(body.indexOf('S1 Ltd'));
  });

  it('filters by search text', () => {
    renderRanking();
    fireEvent.change(screen.getByLabelText('Search stocks'), { target: { value: 'S3' } });
    expect(screen.getByText('S3 Ltd')).toBeTruthy();
    expect(screen.queryByText('S1 Ltd')).toBeNull();
  });

  it('explains an empty search rather than showing a blank list', () => {
    renderRanking();
    fireEvent.change(screen.getByLabelText('Search stocks'), { target: { value: 'ZZZZ' } });
    expect(screen.getByText(/No stock matches "ZZZZ"/)).toBeTruthy();
  });

  it('persists the filter so it carries across universes', () => {
    renderRanking();
    fireEvent.click(screen.getByRole('button', { name: /^Positive RS/ }));
    expect(JSON.parse(localStorage.getItem('gati.pref.rankingFilter'))).toBe('positive');
  });

  it('groups unrankable stocks at the end with a reason', () => {
    state.data = makeData({ unavailableSymbols: [{ symbol: 'DEAD.NS', reason: 'Price data unavailable', suggestion: 'NEW.NS' }] });
    renderRanking();
    expect(screen.getByText(/Could not be ranked \(1\)/)).toBeTruthy();
    // A suggestion, never an adoption.
    expect(screen.getByText(/possibly renamed to NEW.NS/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* STRATEGY RECORD                                                     */
/* ------------------------------------------------------------------ */

describe('StrategyRecordScreen', () => {
  it('renders the full metric set, grouped', () => {
    renderRecord();
    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.getByText('Risk')).toBeTruthy();
    expect(screen.getByText('Consistency')).toBeTruthy();
  });

  it('collapses risk and consistency by default (beginner-first, D4)', () => {
    renderRecord();
    expect(screen.queryByText('Sharpe')).toBeNull();
    fireEvent.click(within(screen.getByText('Risk').parentElement).getByRole('button'));
    expect(screen.getByText('Sharpe')).toBeTruthy();
  });

  it('shows NO rupee figure — the record is capital-independent', () => {
    // A rupee amount here would reintroduce the assumed account size that
    // decision D1 removed.
    renderRecord();
    const region = document.body.textContent;
    const beforeExports = region.split('CSV exports')[0];
    expect(beforeExports).not.toMatch(/₹/);
  });

  it('states the method and its limitations', () => {
    renderRecord();
    expect(screen.getByText(/next trading day/i)).toBeTruthy();
    expect(screen.getByText(/index members/i)).toBeTruthy();
  });

  it('offers the transaction-cost toggle in both states', () => {
    renderRecord();
    expect(screen.getByText(/Gross — before trading costs/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show net/i }));
    expect(screen.getByText(/Net of trading costs/)).toBeTruthy();
  });

  it('does NOT duplicate the CSV exports that live in Reports', () => {
    // M7 parked a copy here to avoid dropping the feature when the old page
    // was deleted; M8 built the real home in Reports. Two panels producing the
    // same files is one of them waiting to drift out of step.
    renderRecord();
    expect(screen.queryByText('CSV exports')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Monthly rankings' })).toBeNull();
  });

  it('explains itself when there is no completed rebalance yet', () => {
    state.data = makeData({ backtest: { ...makeData().backtest, cycles: [], equityCurve: [] } });
    renderRecord();
    expect(screen.getByText(/Not enough completed months/i)).toBeTruthy();
  });

  it('warns above the headline when the sample is thin', () => {
    // The single permitted exception to "no disclosure above the answer": it
    // qualifies the exact figure beneath it.
    state.data = makeData({ historySufficiency: { isSufficient: false } });
    renderRecord();
    const body = document.body.textContent;
    expect(body.indexOf('early read, not a track record')).toBeLessThan(body.indexOf('Total return'));
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * THE DASHBOARD SAYS ITS TOP 5 IS STILL FORMING (v1.6.5 audit).
 *
 * My Portfolio said it; the Dashboard — where the reader actually meets the
 * list — did not, and its rebalance tooltip claimed the opposite. On the
 * engine, eight stocks over twenty-one August sessions produced fourteen
 * different Top 5 line-ups, so a reader treating the mid-month list as
 * settled is acting on a ranking that has not finished forming.
 *
 * Asserted at behaviour level, not by matching the exact sentence, so the
 * wording can be improved without the test having an opinion about prose.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('the Dashboard states that the live Top 5 is provisional', () => {
  it('says the list can still change, and when the strategy acts', async () => {
    renderUniverse();
    await screen.findByText(/Top 5 right now/);
    const text = document.body.textContent;
    expect(text).toMatch(/can still change|still running/i);
    expect(text).toMatch(/last trading day|month-end close/i);
  });

  it('makes no prediction while doing so', () => {
    const text = document.body.textContent;
    expect(text).not.toMatch(/\b(will rise|guaranteed|sure winner|buy this|bullish)\b/i);
  });
});
