/**
 * STOCK DETAIL — why this one stock sits where it does.
 *
 * WHAT THIS OWNS
 *   Composition. Every figure arrives shaped from `selectors/stockDetailView`,
 *   which in turn reads engines that already existed.
 *
 * WHAT THIS SCREEN IS FOR
 *   A ranking answers "which stocks". It cannot answer "why this one, and how
 *   settled is it" — and those are the questions someone asks immediately
 *   before acting. Showing all four windows together is the point: a stock
 *   ranked 1st on 1M and 90th on 12M is a very different proposition from one
 *   ranked 3rd on all four, and the ranking makes them look identical.
 *
 * WHAT IT MUST NEVER DO
 *   Suggest. It reports rank, Relative Strength, how long the run has lasted
 *   and which direction it has moved. Every one of those is a fact about the
 *   past. The decision stays the reader's.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UNIVERSES } from '../../config/universes.js';
import { universePath, rankingPath } from '../../config/routes.js';
import { getPref } from '../../preferences/prefStore.js';
import { useUniverseRoute } from '../../navigation/routeResolution.jsx';
import { useUniverseData } from '../../hooks/useUniverseData.js';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { selectStockDetail } from '../../selectors/stockDetailView.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button, RankBadge, Skeleton } from '../../components/primitives/index.jsx';
import { Card, CardRow, Section, Stat, StatGrid, StatCell, MetricGrid2x2, MetricCell } from '../../components/primitives/Surface.jsx';
import { InfoTip, RSLedger, RSLedgerKey } from '../../components/data/index.jsx';
import { EmptyState, ErrorState } from '../../components/feedback/index.jsx';
import { InvestmentCard } from './InvestmentCard.jsx';
import { StockChart } from './StockChart.jsx';
import { LiveDot, describePrice } from '../../components/data/LivePrice.jsx';

export function StockDetailScreen() {
  const navigate = useNavigate();
  const { symbol: rawSymbol } = useParams();
  const { universeKey, window: windowSlug } = useUniverseRoute();
  const universe = universeKey ? UNIVERSES[universeKey] : null;
  const symbol = rawSymbol ? decodeURIComponent(rawSymbol) : null;

  const { data, isLoading, isError, error } = useUniverseData(universeKey, {
    lookbackMonths: Number(windowSlug.replace('m', '')),
    includeCosts: getPref('includeCosts'),
  });

  // The centralised session — the single authority on whether a day change
  // may be labelled TODAY. Never re-derived here.
  const session = useMarketSession();

  const view = useMemo(
    () => (data && universe ? selectStockDetail({ data, symbol, universe, activeWindow: windowSlug, session }) : null),
    [data, universe, symbol, windowSlug, session],
  );

  // Session and freshness decide this, never the component — see LivePrice.jsx.
  const price = describePrice({
    session,
    priceDate: view?.currentPriceDate ?? null,
    tradeTime: null,
  });

  const back = () => navigate(rankingPath(universeKey));
  if (!universe) return null;

  if (isError) {
    return (
      <>
        <AppBar title={symbol ?? 'Stock'} onBack={back} />
        <ErrorState what="This stock's data could not be loaded" reason={error?.message ?? 'The data provider returned an error.'} />
      </>
    );
  }

  if (isLoading || !view) {
    return (
      <>
        <AppBar title={symbol ?? 'Stock'} subtitle={universe.label} onBack={back} />
        <div style={{ marginTop: 24 }}><Skeleton height={120} radius={10} /></div>
        <div style={{ marginTop: 24 }}><Skeleton height={180} radius={10} /></div>
      </>
    );
  }

  if (!view.found) {
    return (
      <>
        <AppBar title={symbol} onBack={back} />
        <EmptyState
          arc="none"
          baseline="halfMissing"
          accent="muted"
          title={`${symbol} is not in ${universe.label}`}
          body="It may belong to a different universe, or the ticker may have changed. Search finds any stock across all three."
          action={<Button variant="secondary" onClick={back}>Back to the ranking</Button>}
        />
      </>
    );
  }

  return (
    <>
      <AppBar
        title={view.name}
        subtitle={`${view.symbol} · ${view.universeLabel}`}
        onBack={back}
        windowChip={view.rank != null ? <RankBadge rank={view.rank} isTop={view.isTopFive} /> : null}
      />

      <Section title="Right now" why={`Measured against ${view.benchmarkLabel}, the benchmark for this universe.`}>
        {/*
          THE FOUR FIGURES SOMEONE OPENED THIS SCREEN FOR, in a fixed 2x2.

          They used to sit in a six-cell auto-flowing grid alongside day
          volume and trend, which meant the headline price shared its size
          and weight with a volume figure nobody opens a stock to read. The
          four primary metrics are now larger and alone; the supporting two
          moved below, where their smaller size states their rank.
        */}
        <MetricGrid2x2>
          <MetricCell>
            {/*
              The heading itself changes to "Last price" when the market is
              shut. That does more than a badge would: it tells the reader
              what they are looking at BEFORE they read the number, rather
              than qualifying it afterwards.
            */}
            <Stat
              size="lg"
              label={price.label}
              value={view.priceLabel}
              sublabel={price.sublabel}
              adornment={<LiveDot isLive={session.isLive} />}
            />
          </MetricCell>
          <MetricCell>
            <Stat
              size="lg"
              label="Today"
              value={view.dayChangeLabel}
              /* A dash when there was no session today — the reason sits
                 underneath, so the dash is never just an absence. */
              sublabel={view.today?.reason ?? null}
              direction={view.dayDirection}
              info={<InfoTip term="todaysChange" />}
            />
          </MetricCell>
          <MetricCell>
            <Stat
              size="lg"
              label="This month"
              value={view.currentMonthLabel}
              sublabel={view.priorMonthEndDate ? `from ${view.priorMonthEndLabel} on ${view.priorMonthEndDate}` : null}
              direction={view.currentMonthDirection}
              info={<InfoTip term="priorMonthEnd" />}
            />
          </MetricCell>
          <MetricCell>
            <Stat
              size="lg"
              label="Rank"
              value={view.isRanked ? `#${view.rank}` : '—'}
              sublabel={view.isRanked ? `of ${view.universeSize ?? ''} by relative strength`.trim() : 'not ranked'}
              info={<InfoTip term="rank" />}
            />
          </MetricCell>
        </MetricGrid2x2>

        {/* Supporting, not headline. Smaller by design. */}
        <div style={{ marginTop: 10 }}>
          <StatGrid min={140}>
            <StatCell>
              <Stat
                size="sm"
                label="Day volume"
                value={view.volumeLabel ?? '—'}
                sublabel={view.volume == null ? null : view.volumeIsToday ? 'shares traded today' : 'shares, last session'}
                info={<InfoTip term="dayVolume" />}
              />
            </StatCell>
            <StatCell>
              <Stat
                size="sm"
                label="Trend"
                value={view.trend?.label ?? '—'}
                sublabel={view.trend ? 'relative strength' : 'not enough history'}
                info={<InfoTip term="momentumDirection" />}
              />
            </StatCell>
          </StatGrid>
        </div>
      </Section>

      <StockChart symbol={view.symbol} series={view.priceSeries} name={view.name} />

      {/*
        BOTH LEGS OF THE COMPARISON, SIDE BY SIDE, OVER THE SAME DATES.

        The screen used to show the stock's move since the prior month-end
        without the benchmark's move over the same dates — which is the half
        that makes it mean anything. +8.4% is a triumph against a flat index
        and a disappointment against one up 12%.

        FIXED IN v1.6.3: the stock leg was pinned to one month while the
        benchmark leg and the total followed the selected window, so at 3M
        and above the card compared spans that did not match and printed a
        total belonging to neither. At 6M and 12M the two rows implied the
        stock had trailed while the total said it had won.

        The heading and subtitle now NAME the span. They previously read
        "Since the previous month-end" and "the final trading session of last
        month", which stayed put while the numbers underneath changed with
        the window — leaving the reader no way to tell that a figure moved
        because the window had moved.

        Called "Outperformance", never "Alpha": formal alpha adjusts for the
        market risk taken to earn the excess, and this is a subtraction.
      */}
      <Section
        title={`Over the last ${view.comparisonWindowLabel ?? ''}`.trim()}
        why={
          view.comparisonFromDate
            ? `Stock and benchmark both measured from ${view.comparisonFromDate} to the latest price — the same dates on both sides.`
            : 'Stock and benchmark measured over the same dates.'
        }
        info={<InfoTip term="relativeStrength" />}
      >
        <Card>
          <CardRow>
            <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink)' }}>
              {view.name}
            </span>
            <span
              className="tabular"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: view.stockWindowDirection === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)' }}
            >
              {view.stockWindowReturnLabel ?? '—'}
            </span>
          </CardRow>
          <CardRow>
            <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink-soft)' }}>
              {view.benchmarkLabel} <span style={{ color: 'var(--color-ink-muted)' }}>· benchmark</span>
            </span>
            <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink-soft)' }}>
              {view.benchmarkWindowReturnLabel ?? '—'}
            </span>
          </CardRow>
          <CardRow isLast tinted>
            <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
              Outperformance
              <InfoTip term="outperformance" />
            </span>
            <span
              className="tabular"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600,
                color: view.outperformanceDirection === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)',
              }}
            >
              {view.outperformanceLabel ?? '—'}
            </span>
          </CardRow>
        </Card>

        {/*
          The two legs normally start from the same session. When they do
          not — a stock halted on the reference month's last trading day
          while the index traded — the subtraction spans slightly different
          periods, and saying so is the only honest option: there is no
          price for a day the stock did not trade.
        */}
        {view.comparisonAligned === false ? (
          <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
            {view.name} measures from {view.comparisonFromDate}; {view.benchmarkLabel} from{' '}
            {view.comparisonBenchmarkFromDate}. The stock did not trade on the benchmark&rsquo;s
            reference session.
          </div>
        ) : null}
      </Section>

      <InvestmentCard
        symbol={view.symbol}
        name={view.name}
        universeKey={universeKey}
        currentPrice={view.currentPrice}
        // Latest session's volume — one day, not an average. The engine
        // labels its basis so the card can qualify the claim.
        volume={view.volume}
      />

      {/*
        THE REASON THIS SCREEN EXISTS. A ranking shows one window; this shows
        all four, so the reader can tell a stock that leads on every horizon
        from one that leads only on the horizon currently selected.
      */}
      <Section
        title="Relative Strength on every window"
        why="A stock ranked first on one month and ninetieth on twelve is a different proposition from one ranked third on all four. The ranking alone cannot show you which this is."
        info={<InfoTip term="relativeStrength" />}
      >
        <Card>
          {view.windows.map((window, i) => (
            <CardRow key={window.months} isLast={i === view.windows.length - 1} tinted={window.isActive}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--color-ink-muted)', minWidth: 36 }}>
                {window.label}
              </span>

              {window.available ? (
                <>
                  <div className="hidden sm:block" style={{ flexShrink: 0 }}>
                    <RSLedger stockReturnPct={window.stockReturnPct} benchmarkReturnPct={window.benchmarkReturnPct} width={100} />
                  </div>
                  <span style={{ minWidth: 0, flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
                    stock {window.stockReturnPct?.toFixed(1)}% · benchmark {window.benchmarkReturnPct?.toFixed(1)}%
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      color: window.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)',
                    }}
                  >
                    {window.rsLabel}
                  </span>
                </>
              ) : (
                // Not enough completed month-ends for this window. An em-dash,
                // never a zero — 0.0pp would read as "kept pace".
                <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
                  Not enough history yet for a {window.label} measurement
                </span>
              )}
            </CardRow>
          ))}
        </Card>
        <div style={{ marginTop: 10 }}><RSLedgerKey /></div>
      </Section>

      {view.rankHistory.length > 0 ? (
        <Section
          title="Where it has ranked"
          why="Its position at each recent rebalance, from the same history the strategy record uses."
          info={<InfoTip term="rebalance" />}
        >
          <Card>
            {view.rankHistory.map((entry, i) => (
              <CardRow key={entry.monthKey} isLast={i === view.rankHistory.length - 1}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)', minWidth: 64 }}>
                  {entry.monthKey}
                </span>
                <RankBadge rank={entry.rank} isTop={entry.rank <= 5} />
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
                  {entry.rsLabel}
                </span>
              </CardRow>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="" why="">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="quiet" onClick={back}>Back to the ranking →</Button>
          <Button variant="quiet" onClick={() => navigate(universePath(universeKey, windowSlug))}>
            {view.universeLabel} overview →
          </Button>
        </div>
      </Section>
    </>
  );
}
