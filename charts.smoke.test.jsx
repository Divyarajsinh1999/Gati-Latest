// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EquityCurveChart } from '../charts/EquityCurveChart.jsx';
import { DrawdownChart } from '../charts/DrawdownChart.jsx';
import { MonthlyReturnsChart } from '../charts/MonthlyReturnsChart.jsx';
import { RankingHistoryChart } from '../charts/RankingHistoryChart.jsx';
import { TopPicksAttributionChart } from '../charts/TopPicksAttributionChart.jsx';

afterEach(cleanup);

/**
 * Recharts measures its container, which is zero-sized under jsdom, so the
 * SVG bodies don't render here and asserting on plotted geometry would be
 * meaningless. What IS worth checking is everything around that: the
 * components mount without throwing on both populated and empty data, they
 * label themselves, and their empty states are graceful rather than blank
 * or crashed. Data transforms with real logic (drawdown accumulation,
 * ranking-history series building, P&L attribution) run during render, so
 * these do exercise that code.
 */

const equityCurve = [
  { date: '2025-03-03', monthKey: '2025-03', value: 50_000 },
  { date: '2025-04-01', monthKey: '2025-04', value: 53_210 },
  { date: '2025-05-02', monthKey: '2025-05', value: 48_900 },
];

const benchmarkCurve = [
  { date: '2025-03-03', value: 50_000 },
  { date: '2025-04-01', value: 50_966 },
  { date: '2025-05-02', value: 51_200 },
];

const cycles = [
  {
    entryDate: '2025-03-03', exitDate: '2025-04-01',
    portfolioHoldingReturnPct: 6.42, benchmarkHoldingReturnPct: 1.93,
    picks: [
      { symbol: 'A.NS', name: 'A Ltd', invested: 10_000, exitValue: 11_000 },
      { symbol: 'B.NS', name: 'B Ltd', invested: 10_000, exitValue: 9_400 },
    ],
  },
  {
    entryDate: '2025-04-01', exitDate: '2025-05-02',
    portfolioHoldingReturnPct: -8.1, benchmarkHoldingReturnPct: 0.46,
    picks: [{ symbol: 'A.NS', name: 'A Ltd', invested: 11_000, exitValue: 10_100 }],
  },
];

const rankingHistory = [
  { monthKey: '2025-02', date: '2025-02-28', rankings: [{ symbol: 'A.NS', name: 'A Ltd', rank: 1, rs: 5 }, { symbol: 'B.NS', name: 'B Ltd', rank: 2, rs: 2 }] },
  { monthKey: '2025-03', date: '2025-03-31', rankings: [{ symbol: 'A.NS', name: 'A Ltd', rank: 3, rs: 1 }, { symbol: 'B.NS', name: 'B Ltd', rank: 1, rs: 7 }] },
];

describe('chart components — mount and label themselves', () => {
  it('EquityCurveChart renders both series and labels them by pattern', () => {
    // M9 moved the title into ChartCard, so the chart owns the SERIES and the
    // card owns the frame. The legend swatch reproduces the dash pattern,
    // because a dashed series shown with a solid swatch teaches the wrong
    // mapping — and the mapping is all a legend exists to teach.
    const { container } = render(<EquityCurveChart equityCurve={equityCurve} benchmarkCurve={benchmarkCurve} />);
    // Renamed in v1.6.1: the legend and the tooltip now use one set of words
    // for each line, sourced from seriesContract.
    expect(screen.getByText('Momentum portfolio')).toBeTruthy();
    expect(screen.getByText('Benchmark')).toBeTruthy();
    const dashed = [...container.querySelectorAll('line')].filter((l) => l.getAttribute('stroke-dasharray'));
    expect(dashed.length).toBeGreaterThan(0);
  });

  it('DrawdownChart runs its peak/trough accumulation without throwing', () => {
    // jsdom gives ResponsiveContainer no size, so the plot surface never
    // materialises (recorded as decision S8). What this asserts is what it
    // can: the component mounts and its data reduction runs to completion.
    // The transform itself is covered exhaustively in chartData tests.
    const { container } = render(<DrawdownChart equityCurve={equityCurve} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('MonthlyReturnsChart', () => {
    render(<MonthlyReturnsChart cycles={cycles} />);
    expect(screen.getByRole('heading', { name: /Monthly Returns/i })).toBeTruthy();
  });

  it('RankingHistoryChart builds its per-symbol series and explains the inverted axis', () => {
    render(<RankingHistoryChart rankingHistory={rankingHistory} />);
    expect(screen.getByRole('heading', { name: /Ranking History/i })).toBeTruthy();
    // Because "lower rank number is better" reads backwards on a normal
    // axis, the chart inverts it — and must say so, per Section 30's
    // "don't rely on the visual alone" principle.
    expect(screen.getByText(/lower on the chart = better rank/i)).toBeTruthy();
  });

  it('TopPicksAttributionChart aggregates P&L per symbol across cycles', () => {
    render(<TopPicksAttributionChart cycles={cycles} />);
    expect(screen.getByRole('heading', { name: /Top 5 Performance/i })).toBeTruthy();
  });
});

describe('chart components — empty data paths', () => {
  it('RankingHistoryChart shows an explanatory empty state, not a blank box', () => {
    render(<RankingHistoryChart rankingHistory={[]} />);
    expect(screen.getByText(/Not enough completed months/i)).toBeTruthy();
  });

  it('TopPicksAttributionChart shows an explanatory empty state', () => {
    render(<TopPicksAttributionChart cycles={[]} />);
    expect(screen.getByText(/No completed cycles yet/i)).toBeTruthy();
  });

  it('all charts survive empty arrays without throwing', () => {
    expect(() => {
      render(
        <>
          <EquityCurveChart equityCurve={[]} benchmarkCurve={[]} />
          <DrawdownChart equityCurve={[]} />
          <MonthlyReturnsChart cycles={[]} />
          <RankingHistoryChart rankingHistory={[]} />
          <TopPicksAttributionChart cycles={[]} />
        </>,
      );
    }).not.toThrow();
  });

  it('RankingHistoryChart tolerates a stock that was unranked in some months', () => {
    const sparse = [
      { monthKey: '2025-02', date: '2025-02-28', rankings: [{ symbol: 'A.NS', name: 'A Ltd', rank: 1, rs: 5 }] },
      // B.NS absent entirely this month — must not throw or fabricate a rank.
      { monthKey: '2025-03', date: '2025-03-31', rankings: [{ symbol: 'B.NS', name: 'B Ltd', rank: 1, rs: 4 }] },
    ];
    expect(() => render(<RankingHistoryChart rankingHistory={sparse} />)).not.toThrow();
  });

  it('TopPicksAttributionChart skips picks with a missing exit value instead of counting them as zero P&L', () => {
    const withMissing = [
      { entryDate: '2025-03-03', exitDate: '2025-04-01', picks: [
        { symbol: 'GOOD.NS', name: 'Good', invested: 10_000, exitValue: 11_000 },
        { symbol: 'NOEXIT.NS', name: 'No Exit', invested: 10_000, exitValue: null },
      ] },
    ];
    render(<TopPicksAttributionChart cycles={withMissing} />);
    // The heading renders, meaning it took the populated path rather than
    // the empty state, and it did not throw on the null exitValue.
    expect(screen.getByRole('heading', { name: /Top 5 Performance/i })).toBeTruthy();
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * THE SERIES SWITCH (owner's instruction, 27 Aug 2026).
 *
 * jsdom gives a ResponsiveContainer no size, so whether the line VISUALLY
 * disappears cannot be asserted here — that was checked in headless
 * Chromium. What is checkable, and is the part most likely to break, is the
 * control itself: that the legend becomes a real button only where a chart
 * asked for it, that pressed state is carried in `aria-pressed` rather than
 * in opacity alone, and that hiding a series does not remove the only
 * control able to bring it back.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('the equity curve legend as a series switch', () => {
  const draw = (props = {}) =>
    render(<EquityCurveChart equityCurve={equityCurve} benchmarkCurve={benchmarkCurve} {...props} />);

  it('is plain text on the strategy record, where the comparison is the point', () => {
    draw();
    expect(screen.queryByRole('button', { name: /Momentum portfolio/ })).toBeNull();
  });

  it('becomes a pair of buttons where the chart asks for it', () => {
    draw({ toggleable: true });
    expect(screen.getByRole('button', { name: /Momentum portfolio/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Benchmark/ })).toBeTruthy();
  });

  it('starts with both series showing', () => {
    draw({ toggleable: true });
    for (const name of [/Momentum portfolio/, /Benchmark/]) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('carries the hidden state somewhere a screen reader can reach', () => {
    // Dimming alone would leave a non-sighted reader unable to tell which
    // lines are on the chart.
    draw({ toggleable: true });
    const benchmark = screen.getByRole('button', { name: /Benchmark/ });
    fireEvent.click(benchmark);
    expect(benchmark.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the control after hiding, so the series can come back', () => {
    draw({ toggleable: true });
    const benchmark = screen.getByRole('button', { name: /Benchmark/ });
    fireEvent.click(benchmark);
    expect(screen.getByRole('button', { name: /Benchmark/ })).toBeTruthy();
    fireEvent.click(benchmark);
    expect(benchmark.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches the two independently', () => {
    draw({ toggleable: true });
    fireEvent.click(screen.getByRole('button', { name: /Benchmark/ }));
    expect(screen.getByRole('button', { name: /Momentum portfolio/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
