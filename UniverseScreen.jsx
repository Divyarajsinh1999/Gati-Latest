/**
 * THE UNIVERSE SCREEN.
 *
 * WHAT THIS OWNS
 *   Composition and layout. Nothing else — every value arrives shaped from
 *   `selectors/universeView.js`, and the lint boundary forbids this file from
 *   importing an engine.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE FOUR QUESTIONS (decision D12), and where each is answered:
 *
 *   1. What are the current Top 5?        the Top 5 card, above the fold
 *   2. What changed since last rebalance? the change line, under the verdict
 *   3. Why are these ranked here?         the RS Ledger on every row
 *   4. What action follows?               per-row status: new / held
 *
 * SECTION ORDER, fixed by the approved UX specification:
 *   verdict -> changed -> Top 5 -> view all -> performance ->
 *   data notes -> methodology
 *
 * WHAT IS DELIBERATELY ABSENT
 *   The three disclosure boxes that used to sit ABOVE the answer; nine of the
 *   twelve metric tiles; five of the six charts; the 250-row table. None was
 *   deleted — each moved down a level or into the strategy record. The failure
 *   this screen exists to fix was composition, not content.
 *
 * SIZING MOVED TO THE STOCK, v1.4.0 (owner brief, 8 Aug 2026)
 *   This card used to carry a single "Your amount" field that sized all five
 *   picks at once. It is gone. One number for the whole list could only ever
 *   describe a hypothetical portfolio bought in one transaction at today's
 *   prices — which is not how anyone actually holds stock, and it meant the
 *   share counts on these rows belonged to nobody.
 *
 *   Investment is now a property of a STOCK, entered on its detail screen
 *   against real quantities, prices and dates the reader actually paid. See
 *   screens/stock/InvestmentCard.jsx.
 * ═════════════════════════════════════════════════════════════════════════
 */

import {useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSES } from '../../config/universes.js';
import { universePath, rankingPath, recordPath, stockPath, WINDOW_SLUGS } from '../../config/routes.js';
import { getPref, setPref } from '../../preferences/prefStore.js';
import { useUniverseRoute } from '../../navigation/routeResolution.jsx';
import { useUniverseData } from '../../hooks/useUniverseData.js';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { usePortfolio } from '../../hooks/usePortfolio.js';
import { useSnapshotAudit } from '../../hooks/useSnapshotAudit.js';
import { selectUniverseView } from '../../selectors/universeView.js';
import { MonthlyPerformanceChart } from '../../components/charts/MonthlyPerformanceChart.jsx';
import { EquityCurveChart } from '../../components/charts/EquityCurveChart.jsx';
import { selectUniversePositions } from '../../selectors/portfolioView.js';
import { readViewState, writeViewState, restoreScroll } from '../../navigation/viewState.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { UnknownRoute } from '../../navigation/routeResolution.jsx';
import { UniverseTabs } from '../../components/layout/UniverseTabs.jsx';
import { Button, Chip, RankBadge, Skeleton, Segmented } from '../../components/primitives/index.jsx';
import { InfoTip, MetricTile, MetricGroup, RSLedger, RSLedgerKey } from '../../components/data/index.jsx';
import { Sparkline, SectorBadge } from '../../components/data/ScanAids.jsx';
import { Card, Eyebrow, Section } from '../../components/primitives/Surface.jsx';
import { DataNotes, ErrorState, EmptyState, OfflineState, InsufficientHistoryState } from '../../components/feedback/index.jsx';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { IconChevronRight, IconWarning } from '../../design/icons.jsx';


export function UniverseScreen() {
  const navigate = useNavigate();
  const { universeKey, window: windowSlug, redirectNotice } = useUniverseRoute();
  const isOnline = useOnlineStatus();
  const portfolio = usePortfolio();

  const universe = universeKey ? UNIVERSES[universeKey] : null;

  const path = universeKey ? universePath(universeKey, windowSlug) : '/';

  const lookbackMonths = Number(windowSlug.replace('m', ''));
  const { data, isLoading, isError, error } = useUniverseData(universeKey, {
    lookbackMonths,
    includeCosts: getPref('includeCosts'),
  });

// Decisions D7 and D10: if a corporate action has retroactively restated a
  // completed month, say which month and why rather than quietly serving a
  // different number than last time.
  const restatements = useSnapshotAudit({
    backtest: data?.backtest,
    universeKey,
    lookbackMonths,
  });

  // The centralised session — the single authority on whether a day change
  // may be labelled TODAY. Never re-derived here.
  const session = useMarketSession();

  const view = useMemo(
    () => (data && universe ? selectUniverseView({ data, universe, windowSlug, session }) : null),
    [data, universe, windowSlug, session],
  );

  /**
   * The user's own holdings in THIS universe.
   *
   * Returns null when they hold nothing here, so the block renders NOTHING —
   * not an empty card, not a prompt. Someone who does not want portfolio
   * tracking should never be nagged into it (Phase 1 §8.1).
   */
  const myPositions = useMemo(() => {
    if (!data?.currentMomentum) return null;
    const prices = new Map(
      (data.currentMomentum.ranked ?? [])
        .filter((row) => row.currentPrice != null)
        .map((row) => [row.symbol, { price: row.currentPrice, changePct: row.dailyChangePct }]),
    );
    return selectUniversePositions({
      positions: portfolio.positions,
      universeKey,
      priceBySymbol: prices,
      ranked: data.currentMomentum.ranked ?? [],
    });
  }, [portfolio.positions, universeKey, data]);

  // Restore where the reader was, once the content is tall enough to hold the
  // position. `restoreScroll` gives up rather than landing them somewhere they
  // never were.
  useEffect(() => {
    if (!view) return;
    restoreScroll(readViewState(path).scrollTop);
  }, [view, path]);

  useEffect(() => {
    const onScroll = () => writeViewState(path, { scrollTop: globalThis.scrollY ?? 0 });
    globalThis.addEventListener?.('scroll', onScroll, { passive: true });
    return () => {
      onScroll();
      globalThis.removeEventListener?.('scroll', onScroll);
    };
  }, [path]);

  const changeWindow = useCallback(
    (slug) => {
      setPref('lastWindow', slug);
      navigate(universePath(universeKey, slug));
    },
    [navigate, universeKey],
  );

  /*
    ═══════════════════════════════════════════════════════════════════════
    AN UNKNOWN UNIVERSE IS AN UNKNOWN ROUTE, AND MUST BE HANDED BACK TO THE
    ROUTER RATHER THAN SWALLOWED HERE.

    This was `return null`, which rendered a completely blank page for any
    mistyped path — /nifty5, /portfolo, /does-not-exist. Not a 404, not a
    redirect: the shell with an empty content area and no explanation.

    The cause is route specificity, not this line. React Router matches on
    specificity rather than declaration order, so `/:universeKey` is a better
    match for `/does-not-exist` than the `*` catch-all is — meaning
    UnknownRoute, which exists and works, was never reached. It had no test,
    and the app had no failing gate, so nothing said so.

    Rendering UnknownRoute here rather than adding a redirect keeps ONE
    fallback policy in the codebase: it already knows to preserve the valid
    half of a path, so /nifty50/bogus still lands on NIFTY 50.
    ═══════════════════════════════════════════════════════════════════════
  */
  if (!universe) return <UnknownRoute />;

  if (isError) {
    return (
      <>
        <AppBar title={universe.label} />
        {/*
          Offline gets its own state, because the cause and the remedy are
          different. "The provider returned an error" is confusing and slightly
          wrong when the real answer is that the device has no network — and it
          sends the reader looking for a fault that is not there.
        */}
        {!isOnline ? (
          <OfflineState onRetry={() => globalThis.location?.reload?.()} />
        ) : (
          <ErrorState
            what={`${universe.label} data could not be loaded`}
            reason={error?.message ?? 'The data provider returned an error.'}
          />
        )}
      </>
    );
  }

  return (
    <>
      <AppBar
        eyebrow={`MONTH-END SIGNAL · ${universe.benchmark.symbol}`}
        title="Dashboard"
        context={universe.label}
        subtitle={`${universe.label} — a disciplined view of India's strongest price momentum.`}
        /*
          NO WINDOW CHIP HERE (owner, 28 Aug 2026).

          It was the THIRD statement of the same fact on this screen. The
          verdict eyebrow reads "… · 1m window", and the Segmented control
          below it shows the active window as a selected option — that one is
          the actual control, and it stays. A gold chip repeating it beside
          the universe tabs only competed with them for attention, which is
          the opposite of what the head is for.

          The chip REMAINS on Live Rankings and the Strategy Record: there it
          is the only thing on the page naming the active window, so removing
          it would lose information rather than repetition.
        */
        aside={<UniverseTabs />}
      />

      {redirectNotice ? (
        <div style={{ marginTop: 12 }}>
          <DataNotes notes={[{ id: 'redirect', severity: 'info', title: redirectNotice }]} />
        </div>
      ) : null}

      {isLoading || !view ? (
        <LoadingState />
      ) : (
        <>
          <VerdictBlock verdict={view.verdict} timing={view.rebalanceTiming} windowSlug={windowSlug} onChangeWindow={changeWindow} />
          <ChangeLine summary={view.changeSummary} />
          <TopFiveCard
            universeKey={universeKey}
            rows={view.topFive}
            concentration={view.sectorConcentration}
          />
          <ViewAllLink count={view.rankedCount} onClick={() => navigate(rankingPath(universeKey))} />
          <MyPositions summary={myPositions} onOpen={() => navigate('/portfolio')} />
          <PerformanceBlock
            performance={view.performance}
            universeKey={universeKey}
            benchmarkLabel={universe?.benchmark?.shortLabel ?? 'Benchmark'}
            onOpenRecord={() => navigate(recordPath(universeKey))}
          />
          <ScreenNotes data={data} restatements={restatements} />
          <MethodologyLink onClick={() => navigate('/methodology')} />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* VERDICT — the focal point                                           */
/* ------------------------------------------------------------------ */

function VerdictBlock({ verdict, timing, windowSlug, onChangeWindow }) {
  return (
    <section style={{ marginTop: 16 }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 20,
          borderRadius: 16,
          background: 'var(--color-glass)',
          border: '1px solid var(--color-glass-line)',
          backdropFilter: 'blur(20px) saturate(1.1)',
        }}
      >
        {/* Key light from the upper right, fill from the lower left — the
            lighting of the app mark itself. The only lit surface on the
            screen; a second would read as wallpaper rather than as light. */}
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(closest-side at 85% 0%, var(--color-gold-fill) 0%, transparent 72%)', opacity: 0.22 }} />
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(closest-side at 5% 100%, var(--color-gain-fill) 0%, transparent 70%)', opacity: 0.14 }} />

        <div style={{ position: 'relative' }}>
          {verdict.available ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                  {verdict.isAhead ? 'Ahead of' : 'Behind'} {verdict.benchmarkLabel} · {windowSlug} window
                </span>
                <InfoTip term="outperformance" />
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(40px, 12vw, 60px)',
                  fontWeight: 300,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.05,
                  fontVariantNumeric: 'tabular-nums',
                  color: verdict.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)',
                }}
              >
                {verdict.outperformanceLabel}
              </div>

              {/* Both operands, so the subtraction is checkable rather than
                  trusted — the same discipline as the RS Ledger. */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <Chip tone="neutral">Strategy {verdict.strategyLabel}</Chip>
                <Chip tone="neutral">Benchmark {verdict.benchmarkValueLabel}</Chip>
                {verdict.isThinSample ? <Chip tone="warn">Thin sample · {verdict.completedCycles} rebalances</Chip> : null}
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
                No completed rebalance yet
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                {verdict.reason} The live ranking below is still current.
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Segmented
              label="Measured over"
              value={windowSlug}
              onChange={onChangeWindow}
              options={WINDOW_SLUGS.map((slug) => ({ value: slug, label: slug.toUpperCase() }))}
            />
          </div>
        </div>
      </div>

      {/* Rebalance timing: quiet context, never a countdown. A monthly
          strategy has nothing to do between rebalances, and urgency here
          would manufacture activity the method cannot justify. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, paddingLeft: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
          {timing.lastRebalanceLabel ? `Last rebalanced ${timing.lastRebalanceLabel} · ` : ''}
          {timing.nextReviewLabel}
        </span>
        <InfoTip term="rebalanceTiming" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* WHAT CHANGED — collapsed to one line                                */
/* ------------------------------------------------------------------ */

function ChangeLine({ summary }) {
  const [open, setOpen] = useState(false);
  if (!summary.available && !summary.headline) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => summary.available && setOpen((v) => !v)}
        aria-expanded={summary.available ? open : undefined}
        disabled={!summary.available}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 12px', borderRadius: 10,
          background: 'var(--color-surface)', border: '1px solid var(--color-line)',
          cursor: summary.available ? 'pointer' : 'default', textAlign: 'left',
          fontFamily: 'var(--font-display)', fontSize: 13,
          color: summary.available ? 'var(--color-ink)' : 'var(--color-ink-muted)',
        }}
      >
        <span>{summary.headline}</span>
        {summary.counts ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
            {summary.counts.label}
          </span>
        ) : null}
        {summary.available ? (
          <span style={{ marginLeft: 'auto', color: 'var(--color-gold)', display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }}>
            <IconChevronRight size={16} />
          </span>
        ) : null}
      </button>
      {/* Outside the toggle: a button inside a button is invalid HTML and
          gives a keyboard user two overlapping targets. */}
      <InfoTip term="rebalanceSummary" />
      </div>

      {open && summary.available ? (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'var(--color-surface-raised)', border: '1px solid var(--color-line)' }}>
          <ChangeDetail title="Entered the Top 5" rows={summary.entered} tone="gain" />
          <ChangeDetail title="Left the Top 5" rows={summary.exited} tone="loss" />
          {summary.biggestMoves.length ? (
            <div style={{ marginTop: 10 }}>
              <Eyebrow>Biggest rank moves</Eyebrow>
              {summary.biggestMoves.map((move) => (
                <div key={move.symbol} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 3 }}>
                  {move.name} · {move.from} → {move.to}{' '}
                  <span style={{ color: move.change > 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                    ({move.change > 0 ? '+' : '−'}{Math.abs(move.change)})
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Entrants and exits, with the reason attached.
 *
 * A bare list of names answers "what changed" and leaves "why" to guesswork —
 * which is the half a reader actually needs. Every value shown here is read
 * from rows the ranking already produced.
 */
function ChangeDetail({ title, rows, tone }) {
  if (!rows?.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 6 }}>
        {rows.map((row) => (
          <div key={row.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink)' }}>{row.name}</span>
            {row.rsLabel ? <Chip tone={tone}>{row.rsLabel}</Chip> : null}
            {row.direction ? <Chip tone={row.direction.tone}>{row.direction.label}</Chip> : null}
            {row.momentumAge > 1 ? <Chip tone="neutral">{row.momentumAge}m</Chip> : null}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
              {row.fromLabel ?? row.toLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TOP 5 — and the Investment Simulator, in one card                   */
/* ------------------------------------------------------------------ */

function TopFiveCard({ rows, universeKey, concentration }) {
  return (
    <section style={{ marginTop: 24 }}>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, padding: '16px 16px 14px', borderBottom: '1px solid var(--color-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 'auto' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
              Top 5 right now
            </h2>
            <InfoTip term="topFive" />
          </div>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
            {/* Explained once here rather than on all five rows: five identical
                icons in a five-row list is noise, not help. */}
            Momentum Age
            <InfoTip term="momentumAge" />
            <InfoTip term="momentumDirection" />
          </span>

        </div>

        {rows.length === 0 ? (
          <EmptyState title="No stocks could be ranked" body="Price data for this universe is unavailable, so no ranking can be produced." baseline="halfMissing" accent="loss" />
        ) : (
          rows.map((row, i) => <StockRow key={row.symbol} row={row} isLast={i === rows.length - 1} universeKey={universeKey} />)
        )}

      </Card>

      {/*
        ═══════════════════════════════════════════════════════════════════
        THIS LIST IS PROVISIONAL, AND THE DASHBOARD NEVER SAID SO.

        Found in the v1.6.5 audit. My Portfolio carried "This month is still
        running, so the Top 5 above can change" — the Dashboard, where the
        reader actually meets the Top 5, carried nothing, and its rebalance
        tooltip actively claimed the opposite ("the Top 5 does not change
        between rebalances", now corrected). Two screens, opposite claims.

        It is not a small distinction. Measured on the engine, eight stocks
        over twenty-one August sessions produced FOURTEEN different Top 5
        line-ups. A reader who takes the mid-month list as settled is acting
        on a ranking that has not finished forming.

        Deliberately NOT a countdown, and deliberately not predictive. It
        states two facts — the month is still running, and the strategy acts
        at the month-end close — and lets the reader draw the obvious
        conclusion that a list read late in the month is closer to final than
        one read on the 2nd.
        ═══════════════════════════════════════════════════════════════════
      */}
      <p
        style={{
          margin: '10px 4px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          lineHeight: 1.55,
          color: 'var(--color-ink-muted)',
        }}
      >
        Ranked on prices up to today, so this list can still change while the month runs. The
        strategy acts on the last trading day&rsquo;s close.
      </p>

      <div style={{ marginTop: 10 }}>
        <RSLedgerKey />
      </div>

      {/*
        SECTOR CONCENTRATION (D24).

        Sits UNDER the five it describes, not in a panel of its own.
        Promoting it would imply the strategy acts on it, and the strategy
        does not: ranking is Relative Strength alone and this changes nothing
        about the picks. It is context, and context belongs beside its subject.

        Amber only at three or more of five. Below that a five-stock portfolio
        across four sectors is about as spread as this strategy gets, and
        colouring it would train the reader to ignore the colour.
      */}
      {concentration ? (
        <p
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            margin: '10px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: concentration.isConcentrated ? 'var(--color-warn)' : 'var(--color-ink-muted)',
          }}
        >
          {/* A glyph as well as the colour, so the warning survives greyscale
              and a colour-blind reader — Section 30 forbids relying on colour
              alone. */}
          {concentration.isConcentrated ? <IconWarning size={13} /> : null}
          <span>SECTOR · {concentration.label}</span>
          <InfoTip term="sectorConcentration" />
        </p>
      ) : null}
    </section>
  );
}

function StockRow({ row, isLast, universeKey }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(stockPath(universeKey, row.symbol))}
      aria-label={`${row.name}, rank ${row.rank}`}
      className="gati-row-interactive"
      style={{
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-line)',
        // Uniform tint: every row here is selected, so the tint means
        // "in the Top 5", not "ranked higher".
        background: 'color-mix(in srgb, var(--color-gold-soft) 40%, transparent)',
      }}
    >
      <RankBadge rank={row.rank} isTop />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </span>
          {/* Question 4: what the STRATEGY did, never what to do. */}
          {row.status.label ? <Chip tone={row.status.tone}>{row.status.label}</Chip> : null}
          {/* Decision D13 — how established this run is. A fact about the
              strategy's own history, never a signal to act on. */}
          {row.momentumAge != null && row.momentumAge > 1 ? (
            <Chip tone="neutral">{row.momentumAge}m</Chip>
          ) : null}
          {/* Descriptive only (D14.3) — never a prediction or an instruction. */}
          {row.direction ? <Chip tone={row.direction.tone}>{row.direction.label}</Chip> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
            {row.symbol}
          </span>
          <SectorBadge sector={row.sector} />
        </div>
      </div>

      <div className="hidden sm:block" style={{ flexShrink: 0 }}>
        <Sparkline points={row.spark} />
      </div>

      {/* Question 3: both operands drawn, so the RS value is checkable. */}
      <div className="hidden md:block" style={{ flexShrink: 0 }}>
        <RSLedger stockReturnPct={row.stockReturnPct} benchmarkReturnPct={row.benchmarkReturnPct} width={104} />
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {row.priceLabel ?? '—'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: row.rsDirection === 'gain' ? 'var(--color-gain)' : row.rsDirection === 'loss' ? 'var(--color-loss)' : 'var(--color-ink-muted)' }}>
          {row.rsLabel ?? '—'}
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* VIEW ALL · PERFORMANCE · NOTES                                      */
/* ------------------------------------------------------------------ */

/**
 * Your holdings in this universe.
 *
 * Deliberately a SUMMARY plus a link, not a second holdings table. The
 * strategy's record and the user's money are two different numbers answering
 * two different questions, and putting them on the same screen as comparable
 * totals is how both stop meaning anything.
 */
function MyPositions({ summary, onOpen }) {
  if (!summary) return null;

  return (
    <Section
      title="Your holdings here"
      why="Separate from the record above, which describes the strategy rather than your money."
    >
      <Card>
        <button
          type="button"
          onClick={onOpen}
          className="gati-row-interactive"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '14px 16px', border: 'none', background: 'transparent',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)' }}>
              {summary.count} holding{summary.count === 1 ? '' : 's'} · {summary.valueLabel}
            </span>
            {summary.droppedOut > 0 ? (
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-warn)', marginTop: 2 }}>
                {summary.droppedOut} no longer in the Top 5
              </span>
            ) : null}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontVariantNumeric: 'tabular-nums',
              color: summary.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)',
            }}
          >
            {summary.pnlLabel} · {summary.pnlPctLabel}
          </span>
        </button>
      </Card>
    </Section>
  );
}

function ViewAllLink({ count, onClick }) {
  return (
    <div style={{ marginTop: 12 }}>
      <Button variant="quiet" onClick={onClick}>View all {count} →</Button>
    </div>
  );
}

function PerformanceBlock({ performance, onOpenRecord, benchmarkLabel, universeKey }) {
  return (
    <Section
      title="How this has performed"
      why="The record of every completed rebalance, in percentages that carry no assumed account size."
      info={<InfoTip term="capitalIndependent" />}
    >
      <MetricGroup title="Since the first rebalance">
        {performance.metrics.map((metric) => (
          <MetricTile
            key={metric.key}
            label={metric.label}
            value={metric.value}
            direction={metric.direction}
            glossaryKey={metric.glossaryKey}
          />
        ))}
      </MetricGroup>

      {/*
        ═══════════════════════════════════════════════════════════════════
        THE EQUITY CURVE, DIRECTLY UNDER THE TILES (owner, 27 Aug 2026).

        Placed here rather than higher up because it is the same subject at
        a finer grain: the tiles say the strategy finished ahead, the curve
        says how it got there and whether it was ever behind. Above the Top
        5 it would answer a question the reader has not asked yet.

        The line takes the UNIVERSE ACCENT — lime, cyan or magenta — from
        `seriesContract`, so it matches the nav, the tab dot and the
        strategy card for the universe in view. That is why `universeKey`
        is threaded down here rather than the chart defaulting to gold.

        INDEXED TO 100, NOT IN RUPEES. The reference build prints "₹62K" on
        this curve; D1 removed exactly that assumption, and it does not come
        back because the chart moved screens.
        ═══════════════════════════════════════════════════════════════════
      */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <Eyebrow>Portfolio vs {benchmarkLabel}</Eyebrow>
          <InfoTip term="capitalIndependent" />
        </div>
        <h3
          style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
          }}
        >
          Momentum equity curve
        </h3>

        {performance.hasCurve ? (
          <EquityCurveChart
            equityCurve={performance.equityCurve}
            benchmarkCurve={performance.benchmarkCurve}
            universeKey={universeKey}
            height={220}
            // The legend doubles as the switch for each line here.
            toggleable
          />
        ) : (
          /*
            One point is a dot, not a curve. The same reasoning as the
            month-by-month chart below: an axis with nothing traversing it
            looks like a chart that failed rather than a record that is
            short.
          */
          <InsufficientHistoryState
            title="Not enough completed rebalances to draw a curve"
            body="Two completed months are the minimum. Until then the totals above are the whole record."
          />
        )}
      </div>

      {/*
        MONTH BY MONTH, under the totals that summarise it.

        Placed inside the existing performance section rather than as a new
        one: it answers the same question as the tiles above it, at a finer
        grain. A section of its own would imply a separate subject and push
        "What changed" and the Top 5 further down the screen, which is the
        hierarchy the brief asks not to disturb.
      */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 8 }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)',
            }}
          >
            Month by month
          </h3>
          <InfoTip term="monthlyPerformance" />
        </div>

        {performance.hasMonthly ? (
          <MonthlyPerformanceChart monthly={performance.monthly} benchmarkLabel={benchmarkLabel} />
        ) : (
          /*
            Not an empty chart. An axis with one or two bars on it looks like
            a broken chart rather than a short record, and invites the reader
            to read a trend into a sample that cannot carry one.
          */
          <InsufficientHistoryState
            title={
              performance.monthlyCount === 0
                ? 'No completed months yet'
                : `Only ${performance.monthlyCount} completed month${performance.monthlyCount === 1 ? '' : 's'}`
            }
            body="A month-by-month chart appears once three rebalances have completed. Until then the totals above are the whole record."
          />
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Button variant="quiet" onClick={onOpenRecord}>Full record →</Button>
      </div>
    </Section>
  );
}

function ScreenNotes({ data, restatements = [] }) {
  const notes = [];

  // A past month changed since it was last computed. Surfaced here rather than
  // buried, because a figure the reader noted and can no longer reconcile is
  // the fastest way to lose their trust in every other figure.
  for (const change of restatements) {
    notes.push({
      id: `restated-${change.monthKey}`,
      severity: change.kind === 'selection-changed' ? 'failure' : 'info',
      title: `${change.monthKey} has been restated`,
      body: change.message,
    });
  }

  if (data.quotesError) {
    notes.push({
      id: 'quotes',
      severity: 'exclusion',
      title: 'Live prices unavailable',
      body: 'Showing the last available close. Rankings and the record are unaffected.',
    });
  }
  if (data.unavailableSymbols?.length) {
    notes.push({
      id: 'symbols',
      severity: 'exclusion',
      title: `${data.unavailableSymbols.length} of ${data.stocks.length} stocks excluded`,
      body: 'Their price history could not be loaded. They appear unranked at the end of the full ranking.',
    });
  }

  if (notes.length === 0) return null;
  return <section style={{ marginTop: 32 }}><DataNotes notes={notes} /></section>;
}

/**
 * Where the three disclosure boxes went.
 *
 * They used to sit above the verdict, so the first thing a reader saw was a
 * survivorship-bias caveat rather than an answer. Honesty requires that they
 * be available and findable, not first and loudest.
 */
function MethodologyLink({ onClick }) {
  return (
    <section style={{ marginTop: 32, paddingBottom: 8 }}>
      <Button variant="quiet" onClick={onClick}>How this is calculated →</Button>
    </section>
  );
}

function LoadingState() {
  // Dimensions match the final layout, so nothing reflows on arrival.
  return (
    <div style={{ marginTop: 16 }}>
      <Skeleton height={196} radius={16} />
      <div style={{ marginTop: 24 }}><Skeleton height={44} radius={10} /></div>
      <div style={{ marginTop: 24 }}>
        <Skeleton height={56} radius={10} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginTop: 1 }}><Skeleton height={64} radius={0} /></div>
        ))}
      </div>
    </div>
  );
}
