/**
 * REPORTS — everything cross-cutting, and everything previously homeless.
 *
 * WHAT THIS OWNS
 *   Comparison across universes and windows, monthly history, and CSV export.
 *
 * WHAT THIS MUST NEVER DO
 *   Blend universes into one number. Three portfolios measured against three
 *   different benchmarks are not addable, and a combined figure would describe
 *   nothing that exists.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE PERFORMANCE DECISION IN THIS FILE
 *
 * The window matrix is 3 universes x 4 windows = twelve backtests. Measured,
 * that is roughly 650ms of compute — far past a frame, and pointless for a
 * reader who came here for the exports.
 *
 * So it is COLLAPSED BY DEFAULT and computes on first expand, then memoises.
 * The price data is already in the query cache and shared with every universe
 * screen, so nothing is re-fetched — the cost is arithmetic, paid once, only
 * by a reader who asked for it.
 *
 * Computing it eagerly would have made this screen the slowest in the app to
 * serve a section most visits never open.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';
import { universePath, WINDOW_SLUGS } from '../../config/routes.js';
import { METHODOLOGY_VERSION } from '../../config/methodology.js';
import { getPref } from '../../preferences/prefStore.js';
import { useUniverseData } from '../../hooks/useUniverseData.js';
import { selectUniverseComparison, selectWindowMatrix, selectMonthlyHistory } from '../../selectors/reportsView.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button, Chip, Skeleton } from '../../components/primitives/index.jsx';
import { Card, Section as Surface } from '../../components/primitives/Surface.jsx';
import { InfoTip } from '../../components/data/index.jsx';
import { ExportPanel } from '../../components/data/ExportPanel.jsx';
import { EmptyState } from '../../components/feedback/index.jsx';
import { usePortfolio } from '../../hooks/usePortfolio.js';
import { IconChevronDown } from '../../design/icons.jsx';

export function ReportsScreen() {
  const navigate = useNavigate();
  const activeWindow = getPref('lastWindow');
  const includeCosts = getPref('includeCosts');

  // One hook call per universe: the count is fixed by the registry, so this
  // is a legal fixed-order use of hooks rather than a loop.
  const large = useUniverseData(UNIVERSE_KEYS[0], { lookbackMonths: monthsOf(activeWindow), includeCosts });
  const mid = useUniverseData(UNIVERSE_KEYS[1], { lookbackMonths: monthsOf(activeWindow), includeCosts });
  const small = useUniverseData(UNIVERSE_KEYS[2], { lookbackMonths: monthsOf(activeWindow), includeCosts });

  const results = useMemo(
    () => UNIVERSE_KEYS.map((key, i) => ({ key, ...[large, mid, small][i] })),
    [large, mid, small],
  );

  const loading = results.some((r) => r.isLoading);
  const comparison = useMemo(() => selectUniverseComparison(results, activeWindow), [results, activeWindow]);

  return (
    <>
      <AppBar
        eyebrow="AUDITABLE OUTPUTS"
        title="Reports"
        subtitle={`Every export uses the same calculations shown on screen. Methodology v${METHODOLOGY_VERSION}.`}
      />

      <MethodologyStamp />

      <PortfolioEntry onOpen={() => navigate('/portfolio')} />

      <Section
        title="Where strength is right now"
        why="Comparing the three universes at the same window shows which part of the market the strategy is finding momentum in — the same rule, three different opportunity sets."
        glossaryKey="outperformance"
      >
        {loading ? <Skeleton height={140} radius={10} /> : (
          <UniverseComparison rows={comparison} onOpen={(key) => navigate(universePath(key, activeWindow))} />
        )}
      </Section>

      <CollapsibleSection
        title="Every window, every universe"
        why="A strategy that only works at one window is usually a coincidence. This is the twelve-way view that shows whether the edge survives the measurement period changing."
        glossaryKey="lookbackWindow"
        note="Computes twelve backtests on data already loaded — a moment on first open, then instant."
      >
        {loading ? <Skeleton height={200} radius={10} /> : <WindowMatrix results={results} onOpen={(key, slug) => navigate(universePath(key, slug))} />}
      </CollapsibleSection>

      <CollapsibleSection
        title="Every rebalance, month by month"
        why="The record's total return hides the path. This shows what the strategy held each month and what that month actually returned."
        glossaryKey="rebalance"
      >
        {loading ? <Skeleton height={200} radius={10} /> : <MonthlyHistoryReport results={results} activeWindow={activeWindow} />}
      </CollapsibleSection>

      <ExportSection results={results} activeWindow={activeWindow} loading={loading} />
    </>
  );
}

function monthsOf(slug) {
  return Number(String(slug).replace('m', '')) || 1;
}

/* ------------------------------------------------------------------ */
/* SECTION CHROME                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every section states WHY it exists, not just what it shows (decision D14.4).
 * A number without its reasoning is a fact the reader cannot check.
 */
/**
 * Reports composes the shared Section rather than defining its own.
 *
 * This screen previously carried a near-identical local copy, as did the
 * universe screen and the record. Three copies of one container is how three
 * screens drift a pixel apart and the product starts to feel unfinished.
 */
function Section({ title, why, glossaryKey, children }) {
  return (
    <Surface title={title} why={why} info={glossaryKey ? <InfoTip term={glossaryKey} /> : null}>
      {children}
    </Surface>
  );
}

function CollapsibleSection({ title, why, glossaryKey, note, children }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ marginTop: 32 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 0,
          border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
          {title}
        </h2>
        <span style={{ marginLeft: 'auto', color: 'var(--color-ink-muted)', display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}>
          <IconChevronDown size={18} />
        </span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <p style={{ margin: '4px 0 12px', fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1.5, color: 'var(--color-ink-muted)', maxWidth: 620 }}>
          {why}
          {note ? <span style={{ display: 'block', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{note}</span> : null}
        </p>
        {glossaryKey ? <InfoTip term={glossaryKey} /> : null}
      </div>
      {open ? children : null}
    </section>
  );
}

/**
 * Entry point to My Portfolio.
 *
 * Shown whether or not positions exist, because this is the only route to the
 * feature — but the WORDING changes: an invitation when empty, a summary when
 * not. A "0 positions" card would be a nag; a missing card would be a dead end.
 */
function PortfolioEntry({ onOpen }) {
  const portfolio = usePortfolio();
  if (portfolio.isLoading) return null;

  return (
    <Section
      title="My portfolio"
      why="Your own holdings, valued at the latest prices and checked against the current Top 5. Kept entirely separate from the strategy record, which never assumes you invested anything."
    >
      <Button variant="secondary" onClick={onOpen}>
        {portfolio.isEmpty
          ? 'Add your first position →'
          : `View ${portfolio.positions.length} holding${portfolio.positions.length === 1 ? '' : 's'} →`}
      </Button>
    </Section>
  );
}

function MethodologyStamp() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
      <Chip tone="neutral">Methodology v{METHODOLOGY_VERSION}</Chip>
      <InfoTip term="methodologyVersion" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UNIVERSE COMPARISON                                                 */
/* ------------------------------------------------------------------ */

function UniverseComparison({ rows, onOpen }) {
  if (!rows.length) return <EmptyState title="No comparable records yet" body="At least one completed rebalance is needed in each universe." arc="below" />;

  return (
    <Card>
      {rows.map((row, i) => (
        <button
          key={row.key}
          type="button"
          onClick={() => onOpen(row.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
            border: 'none', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--color-line)',
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)' }}>{row.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
              {row.available ? `Strategy ${row.strategyLabel} · Benchmark ${row.benchmarkLabel}` : row.reason}
            </div>
          </div>
          {row.available ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontVariantNumeric: 'tabular-nums', color: row.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {row.outperformanceLabel}
            </span>
          ) : null}
        </button>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* WINDOW MATRIX                                                       */
/* ------------------------------------------------------------------ */

function WindowMatrix({ results, onOpen }) {
  // Computed here rather than in the parent, so it runs only once the section
  // is opened and this component mounts.
  const matrix = useMemo(() => selectWindowMatrix(results), [results]);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(90px, 1fr) repeat(${WINDOW_SLUGS.length}, minmax(56px, 1fr))`,
          gap: 1,
          background: 'var(--color-line)',
          border: '1px solid var(--color-line)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <Cell header />
        {WINDOW_SLUGS.map((slug) => <Cell key={slug} header>{slug.toUpperCase()}</Cell>)}

        {matrix.map((row) => (
          <RowCells key={row.key} row={row} onOpen={onOpen} />
        ))}
      </div>
      <p style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
        How far ahead of or behind its benchmark. The value carries the colour, not the cell — a heat map would turn a
        precise number into an impression.
      </p>
    </div>
  );
}

function RowCells({ row, onOpen }) {
  return (
    <>
      <Cell header>{row.label}</Cell>
      {row.cells.map((cell) => (
        <Cell key={cell.window} onClick={cell.available ? () => onOpen(row.key, cell.window) : undefined}>
          {cell.available ? (
            <>
              <span style={{ color: cell.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)', fontWeight: 500 }}>
                {cell.label}
              </span>
              <span style={{ display: 'block', fontSize: 9.5, color: 'var(--color-ink-muted)' }}>{cell.cycles} cycles</span>
            </>
          ) : (
            // Never a zero: no completed rebalance is not a break-even.
            <span style={{ color: 'var(--color-ink-muted)' }}>—</span>
          )}
        </Cell>
      ))}
    </>
  );
}

function Cell({ header, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        padding: '10px 8px',
        background: 'var(--color-surface)',
        border: 'none',
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: header ? 'var(--font-mono)' : 'var(--font-mono)',
        fontSize: header ? 10.5 : 12,
        fontWeight: header ? 600 : 400,
        letterSpacing: header ? '0.1em' : 0,
        textTransform: header ? 'uppercase' : 'none',
        color: header ? 'var(--color-ink-muted)' : 'var(--color-ink)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children ?? ''}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* MONTHLY HISTORY                                                     */
/* ------------------------------------------------------------------ */

function MonthlyHistoryReport({ results, activeWindow }) {
  const [selected, setSelected] = useState(UNIVERSE_KEYS[0]);
  const rows = useMemo(() => selectMonthlyHistory(results, selected), [results, selected]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {UNIVERSE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            aria-pressed={key === selected}
            style={{
              height: 30, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${key === selected ? 'var(--color-gold)' : 'var(--color-line)'}`,
              background: key === selected ? 'var(--color-gold-soft)' : 'transparent',
              color: key === selected ? 'var(--color-gold)' : 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: key === selected ? 600 : 500,
            }}
          >
            {UNIVERSES[key].shortLabel}
          </button>
        ))}
        <Chip tone="neutral">{activeWindow.toUpperCase()} window</Chip>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No completed rebalances yet" body="This window needs at least one full month-to-month cycle." arc="below" />
      ) : (
        <Card>
          {rows.map((row, i) => (
            <div key={row.monthKey} style={{ padding: '10px 12px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--color-line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-muted)', minWidth: 60 }}>{row.monthKey}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: row.direction === 'gain' ? 'var(--color-gain)' : 'var(--color-loss)', minWidth: 64 }}>
                  {row.returnLabel}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)', marginLeft: 'auto' }}>
                  vs {row.benchmarkLabel}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--color-ink-soft)', marginTop: 3 }}>
                {row.picksLabel}
              </div>
              {/* D14.1 — what changed, not only what it returned. */}
              {row.changeLabel ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                  {row.changeLabel}
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EXPORTS                                                             */
/* ------------------------------------------------------------------ */

function ExportSection({ results, activeWindow, loading }) {
  const [selected, setSelected] = useState(UNIVERSE_KEYS[0]);
  const result = results.find((r) => r.key === selected);

  return (
    <Section
      title="Export the data"
      why="Every figure Gati shows can be taken out and checked in your own tools. Exported values match the screen, including the current transaction-cost setting."
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {UNIVERSE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            aria-pressed={key === selected}
            style={{
              height: 30, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${key === selected ? 'var(--color-gold)' : 'var(--color-line)'}`,
              background: key === selected ? 'var(--color-gold-soft)' : 'transparent',
              color: key === selected ? 'var(--color-gold)' : 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: key === selected ? 600 : 500,
            }}
          >
            {UNIVERSES[key].shortLabel}
          </button>
        ))}
      </div>

      {loading || !result?.data ? (
        <Skeleton height={80} radius={10} />
      ) : (
        <ExportPanel
          universe={UNIVERSES[selected]}
          strategyKey={activeWindow === '1m' ? selected : `${selected}-rs-${activeWindow}`}
          currentMomentum={result.data.currentMomentum}
          backtest={result.data.backtest}
          summary={{ 'Methodology Version': METHODOLOGY_VERSION, Window: activeWindow }}
          hideHeading
        />
      )}
    </Section>
  );
}
