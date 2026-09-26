// @vitest-environment jsdom
/**
 * SCAN AIDS + SURFACE TESTS.
 *
 * The sparkline's job is to convey SHAPE, and the two behaviours worth
 * guarding are the ones where a naive implementation would say something
 * untrue: a flat series must not divide by zero, and too little history must
 * produce nothing rather than an invented line.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Sparkline, SectorBadge, shortSector } from '../data/ScanAids.jsx';
import { Card, Section, Stat, Eyebrow, StatGrid, StatCell } from '../primitives/Surface.jsx';

afterEach(cleanup);

describe('Sparkline', () => {
  it('draws a polyline through the points', () => {
    const { container } = render(<Sparkline points={[10, 12, 11, 15]} />);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path.getAttribute('d').startsWith('M')).toBe(true);
  });

  it('colours by NET direction, first point to last', () => {
    // Not by the final tick, which would flicker on a live refresh and mean
    // nothing.
    const up = render(<Sparkline points={[10, 20, 15]} />);
    expect(up.container.innerHTML).toContain('--color-gain-fill');
    cleanup();

    const down = render(<Sparkline points={[20, 10, 15, 12]} />);
    expect(down.container.innerHTML).toContain('--color-loss-fill');
  });

  it('handles a perfectly flat series without dividing by zero', () => {
    // A flat line is a real answer — "this did not move" — not an error.
    const { container } = render(<Sparkline points={[100, 100, 100]} />);
    const d = container.querySelector('path').getAttribute('d');
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('renders NOTHING drawable when there is too little history', () => {
    // An invented line would imply a shape the data does not have.
    for (const points of [null, undefined, [], [42]]) {
      const { container, unmount } = render(<Sparkline points={points} />);
      expect(container.querySelector('path')).toBeNull();
      unmount();
    }
  });

  it('is decorative — the numbers beside it carry the meaning', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} />);
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('normalises to its own range, so shape is comparable and scale is not', () => {
    const small = render(<Sparkline points={[1, 2, 3]} />).container.querySelector('path').getAttribute('d');
    cleanup();
    const large = render(<Sparkline points={[1000, 2000, 3000]} />).container.querySelector('path').getAttribute('d');
    expect(small).toBe(large);
  });
});

describe('SectorBadge', () => {
  it('shortens a known sector and keeps the full name available', () => {
    render(<SectorBadge sector="Information Technology" />);
    const badge = screen.getByText('IT');
    expect(badge.getAttribute('title')).toBe('Information Technology');
  });

  it('falls back predictably for an unmapped sector', () => {
    expect(shortSector('Something New')).toBe('SOME');
  });

  it('renders nothing without a sector, rather than an empty box', () => {
    const { container } = render(<SectorBadge sector={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('is monochrome — colour in this product means gain, loss, caution or brand', () => {
    const { container } = render(<SectorBadge sector="Healthcare" />);
    const html = container.innerHTML;
    expect(html).not.toContain('--color-gain');
    expect(html).not.toContain('--color-loss');
    expect(html).not.toContain('--color-gold');
  });
});

describe('Surface primitives', () => {
  it('Card renders its children on a bordered surface', () => {
    const { container } = render(<Card><span>inside</span></Card>);
    expect(screen.getByText('inside')).toBeTruthy();
    expect(container.firstChild.getAttribute('style')).toContain('--color-line');
  });

  it('Section renders a heading and its explanation', () => {
    render(<Section title="Where strength is" why="Because a rank alone hides it."><div /></Section>);
    expect(screen.getByRole('heading', { level: 2, name: 'Where strength is' })).toBeTruthy();
    expect(screen.getByText('Because a rank alone hides it.')).toBeTruthy();
  });

  it('Section accepts contextual help as a NODE, not a domain key', () => {
    // The primitive must never import the glossary; passing a node keeps it
    // free of domain knowledge.
    render(<Section title="T" info={<span>help</span>}><div /></Section>);
    expect(screen.getByText('help')).toBeTruthy();
  });

  it('Stat applies direction colour only to signed values', () => {
    const signed = render(<Stat label="Return" value="+21.3%" direction="gain" />);
    expect(signed.container.innerHTML).toContain('--color-gain');
    cleanup();

    const unsigned = render(<Stat label="Positions" value="5" />);
    expect(unsigned.container.innerHTML).not.toContain('--color-gain');
  });

  it('Stat shows an em-dash rather than a fabricated value', () => {
    render(<Stat label="CAGR" value={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('StatGrid shares one border with hairline gaps, not per-tile borders', () => {
    const { container } = render(<StatGrid><StatCell>a</StatCell><StatCell>b</StatCell></StatGrid>);
    const grid = container.firstChild.getAttribute('style');
    expect(grid).toContain('gap: 1px');
    expect(grid).toContain('--color-line');
  });

  it('Eyebrow is the only uppercase treatment in the system', () => {
    const { container } = render(<Eyebrow>Performance</Eyebrow>);
    expect(container.firstChild.getAttribute('style')).toContain('uppercase');
    expect(container.firstChild.getAttribute('style')).toContain('--font-mono');
  });
});
