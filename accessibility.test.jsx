// @vitest-environment jsdom
/**
 * ACCESSIBILITY AUDIT — automated, across every screen.
 *
 * WHAT THIS OWNS
 *   Running axe against each rendered screen and failing the build on any
 *   serious or critical violation.
 *
 * WHY AUTOMATED CHECKING IS NECESSARY BUT NOT SUFFICIENT
 *   Axe catches roughly a third to a half of real accessibility problems —
 *   the mechanical ones: missing names, bad contrast, invalid nesting, absent
 *   roles. It cannot judge whether a focus order makes sense, whether an
 *   announcement is useful, or whether a label describes what a control
 *   actually does. Those are covered by the behavioural assertions in the
 *   screen suites and by the manual pass recorded in TODO.md.
 *
 *   What this file guarantees is that the mechanical third never regresses
 *   silently, which is exactly the kind that creeps back in during a redesign.
 *
 * SEVERITY: the build fails on `serious` and `critical`. `moderate` and
 * `minor` are reported but not blocking, because several are contested
 * heuristics and a gate that cries wolf is a gate people disable.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axe from 'axe-core';

/* ---------------- shared stub data ---------------- */

const pick = (symbol, rank) => ({
  symbol,
  name: `${symbol} Ltd`,
  rank,
  rs: 6 - rank,
  stockReturnPct: 8,
  benchmarkReturnPct: 2,
  currentPrice: 1000,
  dailyChangePct: 0.4,
  sector: 'Financial Services',
  rsHistory: [],
  rsTrend: 'improving',
});
const picks = [1, 2, 3, 4, 5].map((r) => pick(`S${r}`, r));
const cycle = {
  signalMonthKey: '2025-03',
  portfolioHoldingReturnPct: 6.4,
  benchmarkHoldingReturnPct: 1.9,
  capitalAtStart: 100,
  totalInvested: 100,
  cashCarriedIn: 0,
  picks: picks.map((p) => ({ ...p, invested: 20, exitValue: 21 })),
};

function makeData() {
  return {
    stocks: new Array(50).fill(null).map((_, i) => ({ symbol: `S${i}.NS`, name: `S${i}` })),
    priceSeriesMap: new Map(),
    benchmarkSeries: [],
    quotes: new Map(),
    unavailableSymbols: [],
    quotesError: null,
    limitations: [],
    costsApplied: false,
    historySufficiency: { isSufficient: true },
    daysToRebalance: 18,
    momentumAge: new Map([['S1', { consecutiveMonths: 4, sinceMonthKey: '2024-12', isNewEntrant: false }]]),
    rebalanceSummary: { available: true, entered: 2, continuing: 3, exited: 2, monthKey: '2025-03' },
    changes: {
      hasBaseline: true,
      changeCount: 2,
      currentDate: '2025-03-31',
      currentMonthKey: '2025-03',
      previousMonthKey: '2025-02',
      entered: [{ symbol: 'S1', name: 'S1 Ltd', rank: 1 }],
      exited: [{ symbol: 'X', name: 'X Ltd', previousRank: 3 }],
      biggestMoves: [{ symbol: 'S1', name: 'S1 Ltd', from: 20, to: 1, change: 19 }],
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
    },
  };
}

const state = { data: makeData(), isLoading: false, isError: false, error: null };

vi.mock('../../hooks/useUniverseData.js', () => ({
  useUniverseData: () => state,
  useUniverseHistory: () => state,
}));
vi.mock('../../hooks/useDataFreshness.js', () => ({
  useDataFreshness: () => ({ fetchedAt: '2026-08-04T10:00:00Z', dataAsOf: '2026-08-03', providerId: 'yahoo', isLoaded: true }),
}));
vi.mock('../../hooks/useMarketStatus.js', () => ({
  useMarketStatus: () => ({ status: 'OPEN', asOf: new Date('2026-08-04T05:00:00Z') }),
}));

const { UniverseScreen } = await import('../universe/UniverseScreen.jsx');
const { FullRankingScreen } = await import('../ranking/FullRankingScreen.jsx');
const { StrategyRecordScreen } = await import('../record/StrategyRecordScreen.jsx');
const { ReportsScreen } = await import('../reports/ReportsScreen.jsx');
const { SettingsScreen } = await import('../settings/SettingsScreen.jsx');
const { MethodologyScreen } = await import('../methodology/MethodologyScreen.jsx');
const { PortfolioScreen } = await import('../portfolio/PortfolioScreen.jsx');
const { StockDetailScreen } = await import('../stock/StockDetailScreen.jsx');
const { GlobalSearch } = await import('../../components/search/GlobalSearch.jsx');

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  Object.assign(state, { data: makeData(), isLoading: false, isError: false, error: null });
});

/**
 * Run axe over a rendered container.
 *
 * `region` is disabled: it requires every node to sit inside a landmark, which
 * is true in the real app (the shell provides `main`) but not when a screen is
 * mounted alone. Testing the screen in isolation is what makes these fast and
 * specific, so the landmark structure is asserted separately below.
 */
async function auditContainer(container) {
  const results = await axe.run(container, {
    rules: { region: { enabled: false } },
    resultTypes: ['violations'],
  });
  return results.violations;
}

function describeViolations(violations) {
  return violations
    .map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`)
    .join('\n');
}

const BLOCKING = new Set(['serious', 'critical']);

function renderAt(path, element, routePath) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={routePath} element={element} /></Routes>
    </MemoryRouter>,
  );
}

const SCREENS = [
  ['Universe', () => renderAt('/nifty50', <UniverseScreen />, '/:universeKey')],
  ['Full ranking', () => renderAt('/nifty50/all', <FullRankingScreen />, '/:universeKey/all')],
  ['Strategy record', () => renderAt('/nifty50/record', <StrategyRecordScreen />, '/:universeKey/record')],
  ['Reports', () => renderAt('/reports', <ReportsScreen />, '/reports')],
  ['Settings', () => renderAt('/settings', <SettingsScreen />, '/settings')],
  ['Methodology', () => renderAt('/methodology', <MethodologyScreen />, '/methodology')],
  // Added in M11. A screen outside the gate is a screen whose accessibility
  // nobody is checking.
  ['My portfolio', () => renderAt('/portfolio', <PortfolioScreen />, '/portfolio')],
  // Added in M12. Every screen belongs in the gate; one outside it is a screen
  // whose accessibility nobody is checking.
  ['Stock detail', () => renderAt('/nifty50/stock/S1', <StockDetailScreen />, '/:universeKey/stock/:symbol')],
];

describe('accessibility audit — every screen', () => {
  it.each(SCREENS)('%s has no serious or critical violations', async (_name, mount) => {
    const { container } = mount();
    const violations = await auditContainer(container);
    const blocking = violations.filter((v) => BLOCKING.has(v.impact));
    expect(blocking, `\n${describeViolations(blocking)}\n`).toHaveLength(0);
  }, 30_000);
});

describe('accessibility audit — overlays', () => {
  it('the add-position sheet is clean', async () => {
    // Modal dialogs are where focus management and naming most often go wrong,
    // and this one carries a form.
    const { container } = renderAt('/portfolio', <PortfolioScreen />, '/portfolio');
    const trigger = await screen.findByRole('button', { name: /Add a position/i });
    fireEvent.click(trigger);
    const blocking = (await auditContainer(container)).filter((v) => BLOCKING.has(v.impact));
    expect(blocking, `\n${describeViolations(blocking)}\n`).toHaveLength(0);
  }, 30_000);

  it('the search dialog is clean', async () => {
    const { container } = render(
      <MemoryRouter><GlobalSearch open onClose={() => {}} /></MemoryRouter>,
    );
    const blocking = (await auditContainer(container)).filter((v) => BLOCKING.has(v.impact));
    expect(blocking, `\n${describeViolations(blocking)}\n`).toHaveLength(0);
  }, 30_000);
});

describe('accessibility audit — degraded states', () => {
  // Error and empty states are the easiest to get wrong, because they are the
  // hardest to reach by hand and therefore the least often looked at.
  it('the error state is clean', async () => {
    Object.assign(state, { data: undefined, isLoading: false, isError: true, error: new Error('provider down') });
    const { container } = renderAt('/nifty50', <UniverseScreen />, '/:universeKey');
    const blocking = (await auditContainer(container)).filter((v) => BLOCKING.has(v.impact));
    expect(blocking, `\n${describeViolations(blocking)}\n`).toHaveLength(0);
  }, 30_000);

  it('the loading state is clean', async () => {
    Object.assign(state, { data: undefined, isLoading: true });
    const { container } = renderAt('/nifty50', <UniverseScreen />, '/:universeKey');
    const blocking = (await auditContainer(container)).filter((v) => BLOCKING.has(v.impact));
    expect(blocking, `\n${describeViolations(blocking)}\n`).toHaveLength(0);
  }, 30_000);
});

describe('semantics that axe cannot judge', () => {
  it('every screen has exactly one h1', () => {
    for (const [name, mount] of SCREENS) {
      const { container, unmount } = mount();
      const h1s = container.querySelectorAll('h1');
      expect(h1s.length, `${name} has ${h1s.length} h1 elements`).toBe(1);
      unmount();
    }
  });

  it('heading levels never skip a step', () => {
    for (const [name, mount] of SCREENS) {
      const { container, unmount } = mount();
      const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]));
      let previous = 0;
      for (const level of levels) {
        if (previous !== 0) expect(level - previous, `${name} jumps h${previous} -> h${level}`).toBeLessThanOrEqual(1);
        previous = level;
      }
      unmount();
    }
  });

  it('every interactive control has an accessible name', () => {
    for (const [name, mount] of SCREENS) {
      const { container, unmount } = mount();
      for (const el of container.querySelectorAll('button, a[href], input, select')) {
        const named =
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          el.getAttribute('title') ||
          el.textContent?.trim() ||
          (el.id && container.querySelector(`label[for="${el.id}"]`)) ||
          // A WRAPPING label is an implicit association and names the control
          // just as well as `for=`. Missing this was a false positive, not a
          // product defect — worth stating, because a test that cries wolf is
          // a test people learn to override.
          el.closest('label')?.textContent?.trim();
        expect(Boolean(named), `${name}: an unnamed <${el.tagName.toLowerCase()}>`).toBe(true);
      }
      unmount();
    }
  });

  it('no interactive control is nested inside another', () => {
    // Invalid HTML, and it gives a keyboard user two overlapping targets.
    for (const [name, mount] of SCREENS) {
      const { container, unmount } = mount();
      for (const el of container.querySelectorAll('button, a[href]')) {
        expect(el.querySelector('button, a[href]'), `${name}: nested interactive control`).toBeNull();
      }
      unmount();
    }
  });
});
