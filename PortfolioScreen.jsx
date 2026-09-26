/**
 * MY PORTFOLIO — what the user actually owns.
 *
 * WHAT THIS OWNS
 *   Displaying, adding, editing and deleting the user's own holdings, and the
 *   backup that is their only protection against losing them.
 *
 * WHAT THIS MUST NEVER DO
 *   Show a strategy figure beside a personal one as though they were
 *   comparable totals. The model's record is capital-independent and describes
 *   a rule; this describes one person's money. Blending them would destroy
 *   both, so the only thing carried across is a per-holding STATUS: is this
 *   still in the Top 5?
 *
 * WHY THE DISCLOSURE COMES BEFORE THE FIRST SAVE
 *   There is no account and no sync, so this data lives in one browser on one
 *   device. Someone who enters twenty positions and then learns the terms has
 *   been treated badly, and the app knew the terms all along.
 */

import { useState, useMemo, useRef } from 'react';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';
import { usePortfolio } from '../../hooks/usePortfolio.js';
import { useUniverseData } from '../../hooks/useUniverseData.js';
import { selectPortfolioView, selectPortfolioHistory, selectRebalanceActions } from '../../selectors/portfolioView.js';
import { AddPositionModal } from '../../components/portfolio/AddPositionModal.jsx';
import { PortfolioValueChart } from './PortfolioValueChart.jsx';
import { formatDate } from '../../utils/formatters.js';
import { getPref } from '../../preferences/prefStore.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button, Chip, Segmented, Skeleton } from '../../components/primitives/index.jsx';
import { Card, CardFooter, Section, Stat, StatGrid, StatCell } from '../../components/primitives/Surface.jsx';
import { InfoTip } from '../../components/data/index.jsx';
import { SectorBadge } from '../../components/data/ScanAids.jsx';
import { EmptyState, DataNotes, InsufficientHistoryState } from '../../components/feedback/index.jsx';
import { IconAdd, IconDownload, IconClose } from '../../design/icons.jsx';

export function PortfolioScreen() {
  const portfolio = usePortfolio();
  const [adding, setAdding] = useState(false);
  /**
   * Which universe's holdings to show. 'all' by default, because a portfolio
   * is one pot of money — the split is a lens, not the primary reading.
   */
  const [universeFilter, setUniverseFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const importRef = useRef(null);

  const months = Number(String(getPref('lastWindow')).replace('m', '')) || 1;
  // One hook per universe; the count is fixed by the registry, so this is a
  // legal fixed-order use of hooks rather than a loop.
  const large = useUniverseData(UNIVERSE_KEYS[0], { lookbackMonths: months });
  const mid = useUniverseData(UNIVERSE_KEYS[1], { lookbackMonths: months });
  const small = useUniverseData(UNIVERSE_KEYS[2], { lookbackMonths: months });

  /**
   * Daily bars for the history chart, and the benchmark's own dates as the
   * trading calendar. Both come from bundles the screen has already
   * fetched for its prices — no extra request.
   */
  const { seriesBySymbol, calendarSeries } = useMemo(() => {
    const series = new Map();
    let calendar = null;
    for (const result of [large, mid, small]) {
      for (const [symbol, bars] of result.data?.priceSeriesMap ?? []) series.set(symbol, bars);
      const bench = result.data?.benchmarkSeries;
      if (bench?.length && (!calendar || bench.length > calendar.length)) calendar = bench;
    }
    return { seriesBySymbol: series, calendarSeries: calendar };
  }, [large, mid, small]);

  const { priceBySymbol, ranked, rankedByUniverse } = useMemo(() => {
    const prices = new Map();
    const rankedRows = [];

    /*
      ═══════════════════════════════════════════════════════════════════
      KEPT PER UNIVERSE AS WELL AS FLAT, AND THIS IS NOT A CONVENIENCE.

      `ranked` is deliberately flat, and correct that way, because
      `annotateWithRanking` looks each holding up BY SYMBOL — and symbols are
      unique across the three universes.

      A RANK IS NOT. Every universe has its own rank 1, so a `rank <= 5` test
      over the flat list describes fifteen stocks rather than five. The
      rebalance action list compares against a Top 5, so it needs one
      universe's rows at a time. Passing the flat list would produce an action
      list that looked entirely plausible and told the reader to buy ten
      stocks that were never picked.
      ═══════════════════════════════════════════════════════════════════
    */
    const byUniverse = new Map(UNIVERSE_KEYS.map((k) => [k, []]));
    const results = [[UNIVERSE_KEYS[0], large], [UNIVERSE_KEYS[1], mid], [UNIVERSE_KEYS[2], small]];

    for (const [key, result] of results) {
      const momentum = result.data?.currentMomentum;
      if (!momentum) continue;
      for (const row of momentum.ranked ?? []) {
        if (row.currentPrice != null) prices.set(row.symbol, { price: row.currentPrice, changePct: row.dailyChangePct });
        rankedRows.push(row);
        byUniverse.get(key)?.push(row);
      }
    }
    return { priceBySymbol: prices, ranked: rankedRows, rankedByUniverse: byUniverse };
  }, [large, mid, small]);

  const view = useMemo(
    () => selectPortfolioView({ positions: portfolio.positions, priceBySymbol, ranked }),
    [portfolio.positions, priceBySymbol, ranked],
  );

  /**
   * The value history, from the reader's OWN purchase dates forward.
   * Built from raw lots, not the aggregated rows — a second purchase has to
   * enter the series on its own date rather than on the first one's.
   */
  const history = useMemo(
    () => selectPortfolioHistory({ positions: portfolio.positions, seriesBySymbol, calendarSeries }),
    [portfolio.positions, seriesBySymbol, calendarSeries],
  );

  /**
   * Only universes the reader actually holds something in.
   *
   * Offering all three regardless would put two dead options in front of
   * someone with one large-cap stock, each leading to an empty list.
   */
  const filterOptions = useMemo(() => {
    const held = UNIVERSE_KEYS.filter((key) => view.positions.some((p) => p.universeKey === key));
    if (held.length < 2) return [];
    return [
      { value: 'all', label: 'All' },
      ...held.map((key) => ({ value: key, label: UNIVERSES[key].shortLabel })),
    ];
  }, [view.positions]);

  const visiblePositions = useMemo(
    () =>
      universeFilter === 'all'
        ? view.positions
        : view.positions.filter((p) => p.universeKey === universeFilter),
    [view.positions, universeFilter],
  );

  /*
    THE REBALANCE ACTION LIST (D23), per universe.

    ═══════════════════════════════════════════════════════════════════════
    ONLY WHEN A SINGLE UNIVERSE IS SELECTED, and that is correctness rather
    than layout preference. Each universe has its own Top 5 and its own
    benchmark; an "All" view would concatenate three separate comparisons and
    a reader scanning it would take fifteen ranked stocks for one portfolio's
    target. The tab strip already exists for exactly this choice.

    `isMonthComplete` IS FALSE HERE, ALWAYS, AND DELIBERATELY.

    The ranking on screen is the in-progress current month. The strategy's
    real signal is the last trading day's close, which by definition has not
    happened while that month is still running. Claiming otherwise would
    invite acting on a provisional list — the one behaviour a monthly rule
    exists to prevent. When the app grows a settled month-end signal this
    becomes a real computation; until then a hardcoded false is the honest
    value, and it is named rather than omitted so the wording stays truthful.
    ═══════════════════════════════════════════════════════════════════════
  */
  const rebalanceActions = useMemo(() => {
    /*
      THE RULE IS "IS THE COMPARISON UNAMBIGUOUS", NOT "HAS A FILTER BEEN
      CLICKED" — and the difference was a bug caught in a browser, not by a
      test.

      The first version showed the list only when `universeFilter !== 'all'`.
      But the filter strip itself only appears once holdings span two or more
      universes. A reader holding five large caps — the ordinary case, and
      exactly the reader this feature is for — had no filter to select, so the
      list never appeared at all. Every unit test passed, because they call
      the selector directly and never meet the filter.

      So: an explicit filter wins; otherwise, if every holding sits in one
      universe, that universe is unambiguous and the comparison is valid.
      Holdings spread across universes with no filter selected stay null,
      because concatenating three separate Top 5s would read as one target
      list of fifteen.
    */
    const universesHeld = new Set(portfolio.positions.map((p) => p.universeKey));
    const effectiveUniverse = universeFilter !== 'all'
      ? universeFilter
      : universesHeld.size === 1
        ? [...universesHeld][0]
        : null;

    if (!effectiveUniverse) return null;

    return selectRebalanceActions({
      positions: portfolio.positions,
      universeKey: effectiveUniverse,
      ranked: rankedByUniverse.get(effectiveUniverse) ?? [],
      priceBySymbol,
      isMonthComplete: false,
    });
  }, [universeFilter, portfolio.positions, rankedByUniverse, priceBySymbol]);

  /*
    The TOTALS deliberately stay whole-portfolio even when the list is
    filtered. "Total invested" is a fact about the reader's money, not about
    the tab they happen to be looking at, and a headline that silently
    changed meaning with a filter is how someone misreads their own position.
  */

  return (
    <>
      {/*
        NO BACK CONTROL. My Portfolio is a top-level destination in the
        sidebar now, and the sidebar is on screen at every width — so a back
        arrow here pointed at /reports, which is not where most readers came
        from. A back control that guesses wrong is worse than none: it
        teaches the reader that the arrow moves them somewhere arbitrary.
        Sub-screens (ranking, record, stock detail) still have one, because
        they genuinely sit beneath something.
      */}
      <AppBar
        eyebrow="YOUR OWN HOLDINGS"
        title="My portfolio"
        subtitle="Valued at the latest prices and checked against the current Top 5."
      />

      {portfolio.isDegraded ? (
        <div style={{ marginTop: 16 }}>
          <DataNotes
            notes={[{
              id: 'degraded',
              severity: 'failure',
              title: 'Positions cannot be saved on this device',
              body: 'Storage is unavailable, so anything entered will be lost when you close the tab. Private browsing is the usual cause.',
            }]}
          />
        </div>
      ) : null}

      {portfolio.isLoading ? (
        <div style={{ marginTop: 24 }}><Skeleton height={120} radius={10} /></div>
      ) : view.isEmpty ? (
        <EmptyState
          arc="below"
          baseline="full"
          title="No positions yet"
          body="Add what you actually hold to see its value, profit and loss, and whether each stock is still in its universe's Top 5. This is separate from the strategy record, which never assumes you invested anything."
          action={<Button variant="primary" onClick={() => setAdding(true)}><IconAdd size={16} /> Add a position</Button>}
        />
      ) : (
        <>
          <Section title="Totals" why="Your money, valued at the latest available prices. Nothing here touches the strategy record.">
            <StatGrid min={140}>
              <StatCell><Stat label="Invested" value={view.totals.investedLabel} /></StatCell>
              <StatCell><Stat label="Current value" value={view.totals.valueLabel} /></StatCell>
              <StatCell>
                <Stat
                  label="Profit / loss"
                  value={view.totals.pnlLabel}
                  sublabel={view.totals.pnlPctLabel}
                  direction={view.totals.direction}
                  info={<InfoTip term="unrealisedPnl" />}
                />
              </StatCell>
              <StatCell>
                <Stat
                  label="Today"
                  value={view.totals.todaysChangeLabel}
                  direction={view.totals.todaysDirection}
                  info={<InfoTip term="todaysChange" />}
                />
              </StatCell>
            </StatGrid>
          </Section>

          <Section
            title="Value over time"
            why={
              history.hasHistory
                ? `From ${formatDate(history.startDate)}, when you made your first purchase. Nothing is shown before that — it would be a gain you did not make.`
                : 'Your holdings valued day by day, once there is enough history to draw.'
            }
          >
            {history.hasHistory ? (
              <>
                <PortfolioValueChart points={history.points} />
                <p
                  style={{
                    margin: '8px 0 0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    letterSpacing: '0.03em',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  SOLID — WORTH NOW · DASHED — WHAT YOU PAID · SHADED — YOUR GAIN
                </p>
              </>
            ) : (
              <InsufficientHistoryState
                title="Not enough history yet"
                body={
                  history.unpriceable.length > 0
                    ? `No price history is available for ${history.unpriceable.join(', ')}, so a value line cannot be drawn without inventing one.`
                    : 'A chart appears once your holdings have a few days of prices behind them. The totals above are the whole picture until then.'
                }
              />
            )}
          </Section>

          <Section
            title="Holdings"
            why="Weight is share of current value, not of what you paid — a position that has doubled carries twice the risk it did at purchase."
            info={<InfoTip term="portfolioWeight" />}
            action={<Button variant="quiet" onClick={() => setAdding(true)}>Add position →</Button>}
          >
            {/*
              Shown only when there is something to filter. A control offering
              three categories to someone who holds one stock is noise, and
              two of its options would lead to an empty list.
            */}
            {filterOptions.length > 2 ? (
              <div style={{ marginBottom: 10 }}>
                <Segmented
                  label="Show"
                  name="portfolio-universe"
                  options={filterOptions}
                  value={universeFilter}
                  onChange={setUniverseFilter}
                />
              </div>
            ) : null}

            <Card>
              {visiblePositions.map((position, i) => (
                <HoldingRow
                  key={position.id ?? position.symbol}
                  position={position}
                  isLast={i === visiblePositions.length - 1}
                  onDelete={() => setConfirmDelete(position)}
                />
              ))}
              <CardFooter>
                {visiblePositions.length} holding{visiblePositions.length === 1 ? '' : 's'}
                {universeFilter !== 'all' ? ` of ${view.positions.length}` : ''}
                {view.hasExclusions ? ` · ${view.excluded.length} could not be priced` : ''}
              </CardFooter>
            </Card>
          </Section>

          {/* Directly under the holdings it compares against, so the two
              lists are read as one thought rather than two features. */}
          <RebalanceActions actions={rebalanceActions} />

          {view.hasExclusions ? (
            <div style={{ marginTop: 16 }}>
              <DataNotes
                notes={[{
                  id: 'excluded',
                  severity: 'exclusion',
                  title: `${view.excluded.length} holding${view.excluded.length === 1 ? '' : 's'} excluded from the totals`,
                  body: 'No current price is available for them. They are left out rather than valued at zero or at cost, either of which would misstate your total.',
                }]}
              />
            </div>
          ) : null}
        </>
      )}

      <BackupSection portfolio={portfolio} importRef={importRef} />

      {adding ? (
        <AddPositionModal
          portfolio={portfolio}
          priceBySymbol={priceBySymbol}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDelete
          position={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await portfolio.remove(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * THE DIFFERENCE BETWEEN WHAT IS HELD AND WHAT THE RULE PICKS (D23).
 *
 * Plain groups. No quantities, no order values, no button that places
 * anything — the Investment Simulator sizes positions and this does not.
 *
 * The provisional notice is not decoration: this list looks identical on the
 * 3rd of the month and on the 30th, and only the second reflects a signal the
 * strategy would actually act on.
 */
function RebalanceActions({ actions }) {
  if (!actions) return null;

  const groups = [
    {
      key: 'still',
      title: 'Still in the Top 5',
      tone: 'var(--color-gain)',
      rows: actions.stillRanked,
      note: 'No change implied.',
    },
    {
      key: 'dropped',
      title: 'No longer in the Top 5',
      tone: 'var(--color-loss)',
      rows: actions.noLongerRanked,
      note: 'The rule would exit these at the next rebalance.',
    },
    {
      key: 'missing',
      title: 'In the Top 5, not held',
      tone: 'var(--color-gold)',
      rows: actions.notHeld,
      note: 'The rule would enter these at the next rebalance.',
    },
    {
      key: 'unranked',
      title: 'Not in the ranking',
      tone: 'var(--color-warn)',
      rows: actions.unranked,
      // Absent data is never an instruction. "Sell" here would act on a row
      // that is not there.
      note: 'No current ranking for these — check the stock before acting.',
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <Section title="Against the current Top 5" why={actions.summary}>
      <Card padded>
        {actions.holdsNothing ? (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-ink-muted)' }}>
            {actions.summary}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 15 }}>
            {groups.map((group) => (
              <div key={group.key}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: group.tone, marginBottom: 7,
                  }}
                >
                  {group.title} · {group.rows.length}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 5 }}>
                  {group.rows.map((row) => (
                    <span
                      key={row.symbol}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid var(--color-line)',
                        background: 'var(--color-surface-raised)',
                        fontSize: 12.5, color: 'var(--color-ink)',
                      }}
                    >
                      <strong style={{ fontWeight: 600 }}>{row.name || row.symbol}</strong>
                      {/*
                        The ticker only when it ADDS something. A position
                        whose name was never filled in carries the symbol as
                        its name, and printing both rendered "WIPRO.NS
                        WIPRO.NS" — noise that reads like a data fault.
                      */}
                      {row.name && row.name !== row.symbol ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-ink-muted)' }}>
                          {row.symbol}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-ink-muted)' }}>{group.note}</p>
              </div>
            ))}
          </div>
        )}

        {/*
          ALWAYS PRESENT WHILE THE MONTH IS RUNNING. The strategy acts on the
          last trading day's close; anything before that is a ranking in
          progress, and this list cannot show the difference on its own.
        */}
        {!actions.isMonthComplete ? (
          <p
            style={{
              margin: '15px 0 0', paddingTop: 13,
              borderTop: '1px solid var(--color-line)',
              fontSize: 11.5, lineHeight: 1.55, color: 'var(--color-ink-muted)',
            }}
          >
            This month is still running, so the Top 5 above can change. The strategy acts on the
            last trading day&rsquo;s close, not on today&rsquo;s ranking.
          </p>
        ) : null}
      </Card>
    </Section>
  );
}

function HoldingRow({ position, isLast, onDelete }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid var(--color-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)' }}>{position.name}</span>
            {/* The feature's real value: connecting what you own to what the
                model currently says. A status, never a recommendation. */}
            {position.status.label ? <Chip tone={position.status.tone}>{position.status.label}</Chip> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
              {position.quantity} × {position.investedLabel && `avg ₹${position.purchasePrice.toFixed(2)}`}
              {position.lotLabel ? ` · ${position.lotLabel}` : ''}
            </span>
            <SectorBadge sector={position.sector} />
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            {position.valueLabel}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums',
              color: position.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)',
            }}
          >
            {position.pnlLabel} · {position.pnlPctLabel}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${position.name}`}
          style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-ink-muted)', padding: 6, flexShrink: 0 }}
        >
          <IconClose size={16} />
        </button>
      </div>

      {/* A 4px weight bar: where the risk actually sits today. */}
      {position.weightPct != null ? (
        <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: 'var(--color-line)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, position.weightPct)}%`, height: '100%', background: 'var(--color-gold-fill)' }} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BackupSection({ portfolio, importRef }) {
  const [message, setMessage] = useState(null);

  return (
    <Section
      title="Backup"
      why="There is no account and no cloud sync, so a file you keep is the only way these positions survive a cleared browser or a new device."
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => portfolio.exportBackup()}>
          <IconDownload size={16} /> Export backup
        </Button>
        <Button variant="secondary" onClick={() => importRef.current?.click()}>
          Restore from file
        </Button>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          aria-label="Restore portfolio from a backup file"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const result = await portfolio.importBackup(file);
            setMessage(
              result.ok
                ? `Restored ${result.imported} position${result.imported === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped} unreadable` : ''}.`
                : result.problems?.[0] ?? 'That file could not be read.',
            );
            event.target.value = '';
          }}
        />
      </div>
      {message ? (
        <p role="status" style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-muted)' }}>
          {message}
        </p>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Add a position.
 *
 * Shares OR amount, mutually exclusive. Amount is converted to whole shares at
 * the price entered and only the QUANTITY is stored — storing the amount would
 * let share counts drift under the user as prices moved.
 */
/**
 * Deletion confirmation — the only modal dialog in the product.
 *
 * Outlined with loss-coloured text, never a filled red button: a filled red
 * button invites the accident it warns about.
 */
function ConfirmDelete({ position, onCancel, onConfirm }) {
  return (
    <div
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
      style={{
        position: 'fixed', inset: 0, zIndex: 61, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'color-mix(in srgb, var(--color-ink) 40%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Remove ${position.name}`}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        style={{ width: '100%', maxWidth: 380, padding: 20, borderRadius: 16, background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
      >
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>
          Remove {position.name}?
        </h2>
        <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink-muted)' }}>
          This deletes the position from this device. It cannot be undone unless you have a backup file.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>Keep it</Button>
          <Button variant="destructive" onClick={onConfirm}>Remove</Button>
        </div>
      </div>
    </div>
  );
}
