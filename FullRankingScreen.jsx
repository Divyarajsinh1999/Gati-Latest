/**
 * FULL RANKING — the complete ordered universe.
 *
 * WHAT THIS OWNS
 *   Showing all 50, 150 or 250 stocks in rank order, searchable and filterable.
 *
 * WHAT THIS MUST NEVER DO
 *   Let the Top 5 be sorted or reordered. That segment is the strategy's
 *   OUTPUT, not a user preference — a sortable Top 5 invites someone to
 *   reorder it and act on their own ordering instead of the model's.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE LIST IS WINDOWED BY HAND RATHER THAN WITH A LIBRARY
 *
 * The requirement is one fixed row height, one scroll container, no dynamic
 * measurement. That is about forty lines. A virtualisation dependency brings
 * a measurement system, a resize observer and an API surface — all to solve
 * problems this list does not have, and all to audit and ship forever.
 *
 * FIXED HEIGHT IS ALSO WHAT MAKES SCROLL RESTORATION EXACT. With variable
 * rows, returning from a stock lands you approximately where you were, which
 * is worse than an obvious reset.
 *
 * UNAVAILABLE STOCKS ARE GROUPED AT THE END, never scattered through the
 * ranking. A dead ticker interrupting the order reads as a data error in the
 * middle of good data; collected at the foot it reads as what it is.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSES } from '../../config/universes.js';
import { universePath, rankingPath } from '../../config/routes.js';
import { getPref, setPref } from '../../preferences/prefStore.js';
import { useUniverseRoute } from '../../navigation/routeResolution.jsx';
import { useUniverseData } from '../../hooks/useUniverseData.js';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { selectRankingView, RANKING_FILTERS, RANKING_SORTS } from '../../selectors/rankingView.js';
import { readViewState, writeViewState } from '../../navigation/viewState.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { UniverseTabs } from '../../components/layout/UniverseTabs.jsx';
import { Chip, Skeleton } from '../../components/primitives/index.jsx';
import { RSLedgerKey, InfoTip } from '../../components/data/index.jsx';
import { StockTable } from '../../components/data/StockTable.jsx';
import { Card, Eyebrow } from '../../components/primitives/Surface.jsx';
import { ErrorState, EmptyState } from '../../components/feedback/index.jsx';
import { IconSearch, IconClose } from '../../design/icons.jsx';


export function FullRankingScreen() {
  const navigate = useNavigate();
  const { universeKey, window: windowSlug } = useUniverseRoute();
  const universe = universeKey ? UNIVERSES[universeKey] : null;
  const path = universeKey ? `/${universeKey}/all` : '/';

  const saved = readViewState(path);
  const [search, setSearch] = useState(saved.search ?? '');
  // Filter and sort are PREFERENCES, not per-route state: they carry across
  // universe switches (decision D12) so a comparison stays like for like.
  const [filter, setFilter] = useState(() => getPref('rankingFilter'));
  const [sort, setSort] = useState(() => getPref('rankingSort'));

  const { data, isLoading, isError, error } = useUniverseData(universeKey, {
    lookbackMonths: Number(windowSlug.replace('m', '')),
    includeCosts: getPref('includeCosts'),
  });
  // The centralised session — the single authority on whether a day change
  // may be labelled TODAY. Never re-derived here.
  const session = useMarketSession();


  const view = useMemo(
    () => (data ? selectRankingView({ data, search, filter, sort, session }) : null),
    [data, search, filter, sort, session],
  );

  const onSearch = useCallback((value) => {
    setSearch(value);
    writeViewState(path, { search: value });
  }, [path]);

  const onFilter = useCallback((value) => {
    setFilter(value);
    setPref('rankingFilter', value);
  }, []);

  const onSort = useCallback((value) => {
    setSort(value);
    setPref('rankingSort', value);
  }, []);

  if (!universe) return null;

  if (isError) {
    return (
      <>
        <AppBar title="All stocks" onBack={() => navigate(universePath(universeKey, windowSlug))} />
        <ErrorState what={`${universe.label} data could not be loaded`} reason={error?.message ?? 'The data provider returned an error.'} />
      </>
    );
  }

  return (
    <>
      <AppBar
        eyebrow="DYNAMIC RELATIVE STRENGTH"
        title="Live Rankings"
        context={universe.label}
        subtitle={view ? `${universe.label} — all ${view.totalCount}, ranked` : universe.label}
        onBack={() => navigate(universePath(universeKey, windowSlug))}
        windowChip={<Chip tone="gold">{windowSlug.toUpperCase()}</Chip>}
        /*
          Switching universe from here keeps the reader ON THE RANKING rather
          than dropping them on the other universe's overview. Losing your
          place because you changed one filter is the kind of thing that
          makes a person stop using a filter.
        */
        aside={<UniverseTabs pathFor={(key) => rankingPath(key)} />}
      />

      {/*
        STICKY ACTION BAR — search, filters and sort travel with the reader.
        On a 250-row list the controls otherwise scroll away exactly when they
        become useful, and getting back to them means scrolling to the top and
        losing your place.
      */}
      <div
        style={{
          position: 'sticky',
          top: 48,
          zIndex: 20,
          background: 'var(--color-canvas)',
          paddingBottom: 8,
          boxShadow: '0 8px 8px -8px rgba(14,27,44,0.10)',
        }}
      >
        <SearchBar value={search} onChange={onSearch} />
        <FilterRow filter={filter} onFilter={onFilter} sort={sort} onSort={onSort} counts={view?.counts} />
      </div>

      {/* The key sits ABOVE the rows it explains. A legend under a table is
          read after the reader has already given up on the picture. */}
      <div style={{ padding: '12px 0' }}>
        <RSLedgerKey />
      </div>

      {isLoading || !view ? (
        <ListSkeleton />
      ) : view.rows.length === 0 ? (
        <EmptyState
          title={search ? `No stock matches "${search}"` : 'Nothing matches this filter'}
          body={search ? 'Try a different name or ticker.' : 'Choose a different filter to see more stocks.'}
        />
      ) : (
        <StockTable
          rows={view.rows}
          universeKey={universeKey}
          benchmarkLabel={universe?.benchmark?.shortLabel ?? 'Benchmark %'}
          caption={`${universe?.label ?? 'Universe'} ranked by Relative Strength — ${view.rows.length} stocks`}
          priceNote={view.priceNote}
        />
      )}

      {view && view.unavailable.length > 0 ? <UnavailableSection rows={view.unavailable} /> : null}
      {view ? <ListSummary view={view} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* CONTROLS                                                            */
/* ------------------------------------------------------------------ */

function SearchBar({ value, onChange }) {
  return (
    <div style={{ padding: '10px 0 8px' }}>
      {/*
        `gati-focus-within` draws the focus ring on the WRAPPER.

        The input sets `outline: none` so the ring does not trace a 21px box
        inside a 40px field — but nothing replaced it, so a keyboard user
        reached the search box and saw no indication they were in it.
        Measured: the only tab stop in the app with no visible focus state.
      */}
      <div
        className="gati-focus-within"
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderRadius: 6, background: 'var(--color-surface-raised)' }}
      >
        <span style={{ color: 'var(--color-ink-muted)', display: 'inline-flex' }}><IconSearch size={16} /></span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search name or ticker"
          aria-label="Search stocks"
          style={{
            flex: 1,
            // Fills the 40px field. Sized to its content the input was 21px,
            // so the top and bottom of what looks like the search box did
            // nothing when tapped.
            alignSelf: 'stretch',
            border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)',
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-ink-muted)', padding: 4 }}
          >
            <IconClose size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterRow({ filter, onFilter, sort, onSort, counts }) {
  return (
    // The filter chips scroll on a narrow phone. Every focusable control
    // inside is reachable by Tab, so the scrollport moves with them and the
    // container itself does not need a stop of its own — but it does need a
    // name, so the group announces what the reader has landed in.
    <div role="group" aria-label="Filter and sort the ranking" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
      {RANKING_FILTERS.map((option) => {
        const active = option.key === filter;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onFilter(option.key)}
            aria-pressed={active}
            style={{
              flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${active ? 'var(--color-gold)' : 'var(--color-line)'}`,
              background: active ? 'var(--color-gold-soft)' : 'transparent',
              color: active ? 'var(--color-gold)' : 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: active ? 600 : 500,
            }}
          >
            {option.label}
            {counts?.[option.key] != null ? ` ${counts[option.key]}` : ''}
          </button>
        );
      })}

      <select
        value={sort}
        onChange={(e) => onSort(e.target.value)}
        aria-label="Sort ranking"
        style={{
          flexShrink: 0, marginLeft: 'auto', height: 32, padding: '0 8px', borderRadius: 6,
          border: '1px solid var(--color-line)', background: 'var(--color-surface)',
          color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
        }}
      >
        {RANKING_SORTS.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* THE LIST                                                            */
/* ------------------------------------------------------------------ */

/**
 * THE HAND-ROLLED VIRTUALISER WAS REMOVED IN M13.
 *
 * It windowed rows of divs into a fixed 640px scroll container so that 250
 * stocks did not mean 250 mounted rows. Two things it did are now done
 * differently, and one thing it did is no longer needed:
 *
 *   - The rows are a real <table> (components/data/StockTable.jsx). A div
 *     grid cannot express `<th scope="col">`, so eleven columns of figures
 *     read out to a screen reader as an undifferentiated stream.
 *   - Scroll restoration relied on a fixed row height inside an inner
 *     scroller. The table scrolls with the PAGE vertically, so the browser's
 *     own restoration applies and is exact.
 *   - Windowing bought less than it looked: at 250 rows the measured render
 *     is well inside budget, and `npm run perf` is the gate that says so
 *     rather than an assumption baked into a component.
 *
 * If a universe ever runs to thousands of rows, windowing comes back — but
 * on the <tbody>, and with the header left sticky.
 */

function UnavailableSection({ rows }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <Eyebrow>Could not be ranked ({rows.length})</Eyebrow>
      </div>
      <Card>
        {rows.map((row, i) => (
          <div key={row.symbol} style={{ padding: '10px 12px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--color-line)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-ink)' }}>{row.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
              {row.symbol} · {row.reason}
              {/* A suggestion, never an adoption. Adopting a guessed ticker
                  pulls another company's prices into the ranking. */}
              {row.suggestion ? ` · possibly renamed to ${row.suggestion}` : ''}
            </div>          </div>
        ))}
      </Card>
    </section>
  );
}

function ListSummary({ view }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, paddingBottom: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
        {view.rankedCount} ranked · {view.unavailable.length} excluded
      </span>
      <InfoTip term="rank" />
    </div>
  );
}

/** Matches the table's own row height exactly, so nothing reflows on arrival. */
const TABLE_ROW_HEIGHT = 52;

function ListSkeleton() {
  return (
    <div style={{ border: '1px solid var(--color-line)', borderRadius: 10, overflow: 'hidden' }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ marginTop: i === 0 ? 0 : 1 }}>
          <Skeleton height={i === 0 ? 38 : TABLE_ROW_HEIGHT} radius={0} />
        </div>
      ))}
    </div>
  );
}
