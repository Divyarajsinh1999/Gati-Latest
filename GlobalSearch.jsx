/**
 * GLOBAL SEARCH — find any stock, from anywhere, instantly.
 *
 * WHAT THIS OWNS
 *   Matching a query against every constituent in every universe, and taking
 *   the reader to it.
 *
 * WHAT THIS MUST NEVER DO
 *   Fetch. Every one of the 453 constituents is already in `config/universes`,
 *   loaded with the app — so this searches memory, works offline, returns in
 *   under a millisecond, and costs nothing on a screen where the reader may
 *   never open it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT SEARCHES THE CONSTITUENT LISTS RATHER THAN LIVE RANKINGS
 *
 * Searching rankings would mean having ranked all three universes, which means
 * fetching ~450 symbols across three queries before a search box could return
 * anything. A reader typing "TITAN" wants to know where TITAN lives, not to
 * wait for a backtest.
 *
 * So the answer is instant and always available, and the RANK is then shown on
 * the universe screen the reader lands on — which is the screen that has
 * legitimately computed it.
 *
 * WHY RESULTS ARE GROUPED BY UNIVERSE
 *   Which universe a stock belongs to is the single most useful fact about it
 *   here: it determines which benchmark it is measured against, and therefore
 *   what its Relative Strength even means.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSES, UNIVERSE_KEYS } from '../../config/universes.js';
import { rankingPath } from '../../config/routes.js';
import { writeViewState } from '../../navigation/viewState.js';
import { SectorBadge } from '../data/ScanAids.jsx';
import { IconSearch, IconClose } from '../../design/icons.jsx';

/** Enough to scan; beyond this the reader should refine rather than scroll. */
const MAX_RESULTS = 8;

/**
 * Flattened index, built once at module load.
 *
 * 453 entries is small enough that a linear scan per keystroke is faster than
 * any index that would need maintaining, and it cannot fall out of sync with
 * the config the way a duplicated structure would.
 */
const INDEX = UNIVERSE_KEYS.flatMap((universeKey) =>
  (UNIVERSES[universeKey].stocks ?? []).map((stock) => ({
    ...stock,
    universeKey,
    universeLabel: UNIVERSES[universeKey].shortLabel,
    haystack: `${stock.name} ${stock.symbol}`.toLowerCase(),
  })),
);

export function searchConstituents(query, limit = MAX_RESULTS) {
  const term = String(query ?? '').trim().toLowerCase();
  if (term.length < 2) return [];

  const starts = [];
  const contains = [];

  for (const entry of INDEX) {
    const at = entry.haystack.indexOf(term);
    if (at === -1) continue;
    // A prefix match is almost always what was meant. Someone typing "TCS"
    // wants TCS, not the first alphabetical company containing those letters.
    (at === 0 || entry.symbol.toLowerCase().startsWith(term) ? starts : contains).push(entry);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains].slice(0, limit);
}

/**
 * The search overlay.
 *
 * Opens on `/` from anywhere, or from the search control. Escape closes and
 * returns focus, because a keyboard user who cannot get back to where they
 * were has been trapped by a convenience.
 */
export function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const openerRef = useRef(null);

  const results = useMemo(() => searchConstituents(query), [query]);

  // The highlighted row is DERIVED from the result set rather than reset in an
  // effect: setting state from an effect renders twice and briefly highlights
  // a row that is no longer in the list.
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      // Focus returns to whatever opened this, not to the top of the document.
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open]);

  const go = useCallback(
    (entry) => {
      if (!entry) return;
      // Seed the ranking's search so the reader lands on the row they asked
      // for, in the screen that has actually ranked it.
      writeViewState(`/${entry.universeKey}/all`, { search: entry.symbol });
      onClose();
      setQuery('');
      navigate(rankingPath(entry.universeKey));
    },
    [navigate, onClose],
  );

  if (!open) return null;

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(results[activeIndex]);
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '10vh 16px 16px',
        background: 'color-mix(in srgb, var(--color-ink) 40%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search stocks"
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(14,27,44,0.16)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--color-line)' }}>
          <span style={{ color: 'var(--color-ink-muted)', display: 'inline-flex' }}><IconSearch size={18} /></span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search any stock by name or ticker"
            aria-label="Search any stock by name or ticker"
            aria-autocomplete="list"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              color: 'var(--color-ink)',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-ink-muted)', padding: 6 }}
          >
            <IconClose size={16} />
          </button>
        </div>

        <ul role="listbox" aria-label="Search results" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '50vh', overflowY: 'auto' }}>
          {results.map((entry, i) => (
            <li key={`${entry.universeKey}:${entry.symbol}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '11px 16px',
                  border: 'none',
                  borderBottom: '1px solid var(--color-line)',
                  background: i === activeIndex ? 'var(--color-surface-raised)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>{entry.symbol}</span>
                    <SectorBadge sector={entry.sector} />
                  </span>
                </span>
                {/* Which universe it belongs to determines which benchmark it
                    is measured against, and therefore what its RS means. */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-gold)', flexShrink: 0 }}>
                  {entry.universeLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-ink-muted)' }}>
          {query.trim().length < 2
            ? 'Type at least two characters · searches all 453 stocks, offline'
            : results.length === 0
              ? `No stock matches "${query.trim()}"`
              : `${results.length} match${results.length === 1 ? '' : 'es'} · ↑↓ to move · Enter to open`}
        </div>
      </div>
    </div>
  );
}
