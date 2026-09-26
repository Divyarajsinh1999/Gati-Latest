/**
 * STRATEGY RECORD — everything about how this universe and window performed.
 *
 * WHAT THIS OWNS
 *   The analytical half that M6 deliberately removed from the universe screen:
 *   the full metric set, the charts, the monthly history, and the method.
 *
 * WHAT THIS MUST NEVER DO
 *   Show a rupee figure for the record. It is capital-independent by decision
 *   D1; a rupee amount here would reintroduce the assumed account size that
 *   decision removed. Money belongs to the Investment Simulator.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE SAMPLE-SIZE NOTICE IS THE ONE THING ALLOWED ABOVE THE HEADLINE
 *
 * The standing rule is that disclosures never precede the answer — that was
 * the composition failure the whole restructure exists to fix. This is the
 * single principled exception, because a thin-sample warning does not qualify
 * the app in general. It qualifies the exact figure directly beneath it, and a
 * Sharpe ratio computed on seven rebalances read without that context is not
 * merely unqualified: it is misleading.
 *
 * EVERYTHING ELSE IS COLLAPSED BY DEFAULT (decision D4). A reader who wants
 * three metrics has already seen them on the universe screen; a reader who
 * came here wants depth and can open it. Twelve equally-weighted tiles was the
 * density failure, not the metrics themselves.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSES } from '../../config/universes.js';
import { universePath } from '../../config/routes.js';
import { getPref, setPref } from '../../preferences/prefStore.js';
import { useUniverseRoute } from '../../navigation/routeResolution.jsx';
import { useUniverseData } from '../../hooks/useUniverseData.js';
import { selectRecordView } from '../../selectors/recordView.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Chip, Skeleton, Button } from '../../components/primitives/index.jsx';
import { Card, Eyebrow } from '../../components/primitives/Surface.jsx';
import { MetricTile, MetricGroup, InfoTip } from '../../components/data/index.jsx';
import { ErrorState, DataNotes, InsufficientHistoryState } from '../../components/feedback/index.jsx';
import { EquityCurveChart } from '../../components/charts/EquityCurveChart.jsx';
import { DrawdownChart } from '../../components/charts/DrawdownChart.jsx';
import { MonthlyReturnsChart } from '../../components/charts/MonthlyReturnsChart.jsx';
import { TopPicksAttributionChart } from '../../components/charts/TopPicksAttributionChart.jsx';
import { RankingHistoryChart } from '../../components/charts/RankingHistoryChart.jsx';
import { ChartCard } from '../../components/charts/ChartCard.jsx';
import { applyRange, isValidRange, DEFAULT_RANGE } from '../../utils/chartRange.js';

export function StrategyRecordScreen() {
  const navigate = useNavigate();
  const { universeKey, window: windowSlug } = useUniverseRoute();
  const universe = universeKey ? UNIVERSES[universeKey] : null;
  // Held in state, not read once from the preference: toggling costs re-runs
  // the backtest in place over data already in memory. Reloading the page to
  // pick up a changed preference would refetch 250 symbols to recompute
  // something that takes microseconds.
  const [includeCosts, setIncludeCosts] = useState(() => getPref('includeCosts'));

  // Remembered across sessions and across universes: a reader comparing three
  // universes at 1Y should not have to reselect it three times.
  const [range, setRange] = useState(() => {
    const saved = getPref('chartRange');
    return isValidRange(saved) ? saved : DEFAULT_RANGE;
  });
  const onRangeChange = useCallback((next) => {
    setRange(next);
    setPref('chartRange', next);
  }, []);
  const toggleCosts = useCallback(() => {
    setIncludeCosts((prev) => {
      setPref('includeCosts', !prev);
      return !prev;
    });
  }, []);

  const { data, isLoading, isError, error } = useUniverseData(universeKey, {
    lookbackMonths: Number(windowSlug.replace('m', '')),
    includeCosts,
  });

  const view = useMemo(() => (data ? selectRecordView({ data, windowSlug }) : null), [data, windowSlug]);

  if (!universe) return null;

  const back = () => navigate(universePath(universeKey, windowSlug));

  if (isError) {
    return (
      <>
        <AppBar title="Record" onBack={back} />
        <ErrorState what={`${universe.label} data could not be loaded`} reason={error?.message ?? 'The data provider returned an error.'} />
      </>
    );
  }

  return (
    <>
      <AppBar
        title="Strategy record"
        subtitle={universe.label}
        onBack={back}
        windowChip={<Chip tone="gold">{windowSlug.toUpperCase()}</Chip>}
      />

      {isLoading || !view ? (
        <RecordSkeleton />
      ) : !view.hasRecord ? (
        <InsufficientHistoryState
          needed={view.monthsNeeded}
          have={view.completedCycles}
          onSwitchWindow={() => navigate(universePath(universeKey, '1m'))}
        />
      ) : (
        <>
          {/* The one permitted exception to "no disclosure above the answer". */}
          {view.isThinSample ? (
            <div style={{ marginTop: 16 }}>
              <DataNotes
                notes={[{
                  id: 'thin',
                  severity: 'exclusion',
                  title: `${view.completedCycles} completed rebalances — an early read, not a track record`,
                  body: 'The figures below are correct for the data available. Ratios like Sharpe and Sortino need many more months before they mean much.',
                }]}
              />
            </div>
          ) : null}

          <Headline headline={view.headline} afterTax={view.afterTax} />
          <PerformanceCharts universeKey={universeKey}
            equityCurve={view.equityCurve}
            benchmarkCurve={view.benchmarkCurve}
            range={range}
            onRangeChange={onRangeChange}
          />
          <MetricGroup title="Performance">
            {view.performance.map((m) => <MetricTile key={m.key} {...m} />)}
          </MetricGroup>

          <div style={{ marginTop: 24 }}>
            <MetricGroup title="Risk" collapsible defaultOpen={false} headline={view.riskHeadline}>
              {view.risk.map((m) => <MetricTile key={m.key} {...m} />)}
            </MetricGroup>
          </div>

          <div style={{ marginTop: 24 }}>
            <MetricGroup title="Consistency" collapsible defaultOpen={false} headline={view.consistencyHeadline}>
              {view.consistency.map((m) => <MetricTile key={m.key} {...m} />)}
            </MetricGroup>
          </div>

          <DeeperCharts cycles={data.backtest.cycles} rankingHistory={data.backtest.rankingHistory} />
          <CurrentHolding holding={view.currentHolding} />
          <MonthlyHistory rows={view.monthlyHistory} />
          <CostIndicator includeCosts={includeCosts} onToggle={toggleCosts} totalCostsPct={view.totalCostsPct} />
          {/*
            Exports live in Reports, where the approved architecture puts them.
            M7 parked a copy here to avoid dropping the feature when the old
            page was deleted; M8 built the real home and this copy should have
            gone with it. Two panels producing the same files is one of them
            waiting to drift.
          */}
          <MethodSummary onOpen={() => navigate('/methodology')} />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Headline({ headline, afterTax }) {
  return (
    <section style={{ marginTop: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          Since {headline.startLabel}
        </span>
        <InfoTip term="capitalIndependent" />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 10vw, 44px)', fontWeight: 300,
          letterSpacing: '-0.04em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
          color: headline.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)',
          marginTop: 4,
        }}
      >
        {headline.strategyLabel}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Chip tone="neutral">Benchmark {headline.benchmarkLabel}</Chip>
        <Chip tone={headline.outperformanceDirection}>Outperformance {headline.outperformanceLabel}</Chip>
      </div>

      {/*
        ═══════════════════════════════════════════════════════════════════
        ALWAYS VISIBLE, WHATEVER THE TOGGLES SAY (D22).

        A monthly rebalance makes nearly every gain short-term, so tax is the
        largest single drag on this strategy — larger than brokerage, STT and
        slippage combined. Putting it behind a setting would make the biggest
        cost the easiest one to forget.

        It is one quiet line, not a second headline: the record's basis is
        still whatever the reader chose in Settings. This just refuses to let
        the number be invisible.
        ═══════════════════════════════════════════════════════════════════
      */}
      {afterTax?.netLabel ? (
        <p
          style={{
            margin: '12px 0 0', fontSize: 12, lineHeight: 1.55,
            color: 'var(--color-ink-muted)', maxWidth: '64ch',
          }}
        >
          After {afterTax.includesCosts ? 'costs and tax' : 'tax'}:{' '}
          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
            {afterTax.netLabel}
          </strong>{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>({afterTax.dragLabel})</span>.
          {/* The one sentence that changes a decision rather than a number. */}
          {afterTax.flipsVerdict ? (
            <span style={{ color: 'var(--color-warn)' }}>
              {' '}That is behind the benchmark — the strategy beats it before tax and loses to it after.
            </span>
          ) : null}{' '}
          Estimated at {afterTax.effectiveRatePct?.toFixed(1)}% of net gains, losses set off within
          each financial year. Not tax advice.
        </p>
      ) : null}
    </section>
  );
}

/**
 * What the model holds now — deliberately without rupee figures.
 *
 * The old page showed this as a scaled ₹50,000 position, which implied an
 * investment nobody had made. Decision D1 removed that assumption; the holding
 * is a list of names and weights, and money lives in the Simulator.
 */
/**
 * Equity curve with drawdown beneath it, on the SAME x-domain.
 *
 * Stacked with no gap between them so a dip and its cause line up vertically.
 * Two charts side by side would make the reader match dates by eye, which is
 * exactly the work a chart is supposed to remove.
 *
 * Styling is deliberate but provisional: M9 is the chart-system pass that
 * brings every series onto the approved specification.
 */
function PerformanceCharts({ equityCurve, benchmarkCurve, range, onRangeChange, universeKey }) {
  // Both series are windowed by the SAME range, from the same dates, so the
  // two lines never describe different periods.
  const strategy = applyRange(equityCurve, range);
  const benchmark = applyRange(benchmarkCurve, range);

  return (
    <section style={{ marginTop: 8, marginBottom: 24 }}>
      <ChartCard
        title="Strategy against its benchmark"
        purpose="Indexed to 100 at the start of the range, so it carries no assumed account size."
        info={<InfoTip term="capitalIndependent" />}
        range={range}
        onRangeChange={onRangeChange}
        coverage={strategy}
        isEmpty={strategy.points.length < 2}
        emptyMessage="At least two completed rebalances are needed before a curve means anything."
        height={260}
      >
        <EquityCurveChart equityCurve={strategy.points} benchmarkCurve={benchmark.points} universeKey={universeKey} />

        {/*
          Drawdown sits DIRECTLY beneath with no gap and shares the equity
          curve's crosshair, so a dip and the moment that caused it line up
          under one cursor. Two charts side by side would make the reader
          match dates by eye — the work a chart exists to remove.
        */}
        <div style={{ marginTop: 4, borderTop: '1px solid var(--color-line)', paddingTop: 8 }}>
          <Eyebrow>How far below its peak</Eyebrow>
          <DrawdownChart equityCurve={strategy.points} universeKey={universeKey} />
        </div>
      </ChartCard>
    </section>
  );
}

/**
 * The three charts M7 lost.
 *
 * They belonged on the record per the approved specification and fell out of
 * the product when the old page was deleted — nothing referenced them for two
 * milestones. Restored here, collapsed by default (decision D4): a reader who
 * wanted three headline metrics has already seen them above.
 */
function DeeperCharts({ cycles, rankingHistory }) {
  const [open, setOpen] = useState(false);

  return (
    <section style={{ marginTop: 32 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          // 44px tall. It was 17px — the natural height of an 9px eyebrow
          // with no padding — which is a legitimate control that a thumb
          // cannot reliably hit. Padding rather than a fixed height so the
          // label stays vertically centred if it ever wraps.
          padding: '13px 0',
          border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <Eyebrow>More charts</Eyebrow>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-gold)' }}>
          {open ? 'Hide' : 'Show 3'}
        </span>
      </button>

      {open ? (
        <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
          <ChartCard
            title="Every month, side by side"
            purpose="Whether the strategy beat its benchmark month by month, not just overall."
            info={<InfoTip term="winRate" />}
            isEmpty={cycles.length === 0}
            height={220}
          >
            <MonthlyReturnsChart cycles={cycles} />
          </ChartCard>

          <ChartCard
            title="Which stocks did the work"
            purpose="Each holding's share of the portfolio's total move."
            info={<InfoTip term="capitalIndependent" />}
            isEmpty={cycles.length === 0}
            emptyMessage="No completed holdings to attribute yet."
            height={240}
          >
            <TopPicksAttributionChart cycles={cycles} />
          </ChartCard>

          <ChartCard
            title="How ranks moved"
            purpose="Where each recent leader sat at every rebalance. Rank 1 is at the top."
            info={<InfoTip term="rank" />}
            isEmpty={(rankingHistory?.length ?? 0) < 2}
            emptyMessage="At least two completed rebalances are needed to show movement."
            height={240}
          >
            <RankingHistoryChart rankingHistory={rankingHistory} />
          </ChartCard>
        </div>
      ) : null}
    </section>
  );
}

function CurrentHolding({ holding }) {
  if (!holding?.length) return null;
  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <Eyebrow>What the model holds now</Eyebrow>
        <InfoTip term="topFive" />
      </div>
      <Card>
        {holding.map((row, i) => (
          <div key={row.symbol} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: i === holding.length - 1 ? 'none' : '1px solid var(--color-line)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)', flex: 1 }}>{row.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>{row.weightLabel}</span>
          </div>
        ))}
      </Card>
    </section>
  );
}

function MonthlyHistory({ rows }) {
  if (!rows?.length) return null;
  return (
    <section style={{ marginTop: 32 }}>
      <Eyebrow>Every rebalance</Eyebrow>
      <span style={{ marginLeft: 6 }}><InfoTip term="rebalanceSummary" /></span>
      <div style={{ marginTop: 8 }}>
      <Card>
        {rows.map((row, i) => (
          <div key={row.monthKey} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--color-line)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)', minWidth: 64 }}>{row.monthKey}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.picksLabel}
              </span>
              {/* D14.1 — how the portfolio changed, not only what it returned. */}
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
                {row.changeLabel}
              </span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: row.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {row.returnLabel}
            </span>
          </div>
        ))}
      </Card>
      </div>
    </section>
  );
}

function CostIndicator({ includeCosts, onToggle, totalCostsPct }) {
  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, border: '1px solid var(--color-line)', background: 'var(--color-surface)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink)', flex: 1 }}>
          {includeCosts ? 'Net of trading costs' : 'Gross — before trading costs'}
          {includeCosts && totalCostsPct != null ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}> · {totalCostsPct.toFixed(2)}% paid</span>
          ) : null}
        </span>
        <InfoTip term="grossVsNet" />
        <Button variant="quiet" onClick={onToggle}>{includeCosts ? 'Show gross' : 'Show net'}</Button>
      </div>
    </section>
  );
}

function MethodSummary({ onOpen }) {
  return (
    <section style={{ marginTop: 32, paddingBottom: 8 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1.55, color: 'var(--color-ink-muted)' }}>
        Ranked at each month-end close and executed at the next trading day&rsquo;s open, on
        split- and dividend-adjusted prices, in exact equal weights. Uses today&rsquo;s index
        members for historical dates, which flatters results by an unknown amount.
      </div>
      <div style={{ marginTop: 8 }}>
        <Button variant="quiet" onClick={onOpen}>How this is calculated →</Button>
      </div>
    </section>
  );
}

function RecordSkeleton() {
  return (
    <div style={{ marginTop: 24 }}>
      <Skeleton height={96} radius={10} />
      <div style={{ marginTop: 24 }}><Skeleton height={120} radius={10} /></div>
      <div style={{ marginTop: 24 }}><Skeleton height={44} radius={10} /></div>
      <div style={{ marginTop: 8 }}><Skeleton height={44} radius={10} /></div>
    </div>
  );
}
