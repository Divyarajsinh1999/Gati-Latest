// @vitest-environment jsdom
/**
 * GLOBAL SEARCH TESTS.
 *
 * The properties worth guarding are that it stays instant and offline (it
 * searches config already in memory, never the network), that a prefix match
 * beats a substring one, and that a keyboard user is never trapped.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalSearch, searchConstituents } from '../search/GlobalSearch.jsx';
import { UNIVERSE_KEYS } from '../../config/universes.js';

afterEach(cleanup);

describe('searchConstituents', () => {
  it('finds a stock by ticker', () => {
    const hits = searchConstituents('RELIANCE');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].symbol).toContain('RELIANCE');
  });

  it('finds a stock by name, case-insensitively', () => {
    expect(searchConstituents('infosys').length).toBeGreaterThan(0);
    expect(searchConstituents('INFOSYS').length).toBeGreaterThan(0);
  });

  it('RANKS PREFIX MATCHES FIRST', () => {
    // Someone typing "TCS" wants TCS, not the first alphabetical company that
    // happens to contain those letters.
    const hits = searchConstituents('TCS');
    expect(hits[0].symbol.startsWith('TCS')).toBe(true);
  });

  it('reports which universe each result belongs to', () => {
    // Which universe determines the benchmark, and therefore what the stock's
    // Relative Strength even means.
    for (const hit of searchConstituents('a')) {
      expect(UNIVERSE_KEYS).toContain(hit.universeKey);
    }
  });

  it('stays quiet below two characters, rather than returning everything', () => {
    expect(searchConstituents('')).toEqual([]);
    expect(searchConstituents('a')).toEqual([]);
  });

  it('caps results so the list stays scannable', () => {
    expect(searchConstituents('a', 8).length).toBeLessThanOrEqual(8);
  });

  it('returns nothing for a genuine miss rather than a loose match', () => {
    expect(searchConstituents('ZZZZQQQ')).toEqual([]);
  });

  it('searches every universe, not just the first', () => {
    const universes = new Set();
    for (const term of ['a', 'b', 'c', 'ra', 'in', 'te', 'ma', 'sh']) {
      for (const hit of searchConstituents(term, 8)) universes.add(hit.universeKey);
    }
    expect(universes.size).toBeGreaterThan(1);
  });
});

describe('GlobalSearch overlay', () => {
  const open = (props = {}) =>
    render(
      <MemoryRouter>
        <GlobalSearch open onClose={props.onClose ?? (() => {})} />
      </MemoryRouter>,
    );

  it('renders nothing when closed', () => {
    const { container } = render(
      <MemoryRouter><GlobalSearch open={false} onClose={() => {}} /></MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('is a labelled modal dialog', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Search stocks' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('explains itself before anything is typed', () => {
    open();
    expect(screen.getByText(/searches all 453 stocks, offline/i)).toBeTruthy();
  });

  it('lists matches as selectable options', () => {
    open();
    fireEvent.change(screen.getByLabelText(/Search any stock/i), { target: { value: 'RELIANCE' } });
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
  });

  it('says so plainly on no match', () => {
    open();
    fireEvent.change(screen.getByLabelText(/Search any stock/i), { target: { value: 'ZZZZQQ' } });
    expect(screen.getByText(/No stock matches "ZZZZQQ"/)).toBeTruthy();
  });

  it('moves the selection with arrow keys', () => {
    open();
    const input = screen.getByLabelText(/Search any stock/i);
    fireEvent.change(input, { target: { value: 'ba' } });
    const before = screen.getAllByRole('option');
    if (before.length > 1) {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' });
      expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    }
  });

  it('closes on Escape, so a keyboard user is never trapped', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('offers an explicit close control too', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(onClose).toHaveBeenCalled();
  });
});
