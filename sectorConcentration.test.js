/**
 * SECTOR CONCENTRATION (D24).
 *
 * The failure mode here is not a crash — it is a line that reads plausibly
 * and tells the reader their portfolio is diversified when it is not. So the
 * cases below are the ones where a wrong implementation still looks right.
 */

import { describe, it, expect } from 'vitest';
import { selectSectorConcentration } from '../universeView.js';

/** Five picks with the given sectors. */
const picks = (...sectors) => sectors.map((sector, i) => ({ symbol: `S${i}`, sector }));

describe('a concentrated Top 5', () => {
  const r = selectSectorConcentration(picks('Financials', 'Financials', 'Financials', 'IT', 'Auto'));

  it('names the sector and the count', () => {
    expect(r.topSector).toBe('Financials');
    expect(r.count).toBe(3);
    expect(r.sharePct).toBeCloseTo(60, 6);
    expect(r.label).toBe('3 of 5 in Financials');
  });

  it('flags at three of five', () => {
    expect(r.isConcentrated).toBe(true);
  });

  it('is not a score', () => {
    // D15/C5: plain figures that keep their meaning, never a blend that
    // hides its inputs.
    expect(r).not.toHaveProperty('score');
    expect(r).not.toHaveProperty('diversificationScore');
  });
});

describe('a spread Top 5', () => {
  it('does not flag at two of five', () => {
    // Two is the most any sector can hold without the flag. Flagging here
    // would fire on almost every month and train the reader to ignore it.
    const r = selectSectorConcentration(picks('IT', 'IT', 'Auto', 'Pharma', 'Energy'));
    expect(r.isConcentrated).toBe(false);
    expect(r.label).toBe('Spread across 4 sectors');
  });

  it('reports five distinct sectors', () => {
    const r = selectSectorConcentration(picks('Financials', 'IT', 'Auto', 'Pharma', 'Energy'));
    expect(r.label).toBe('Spread across 5 sectors');
  });
});

describe('unknown sectors are named, never absorbed', () => {
  it('does not claim diversification it cannot see', () => {
    /*
      THE BUG THIS EXISTS FOR.

      Three of five have no sector. Reporting "Spread across 2 sectors" is
      true of what the data shows and is a claim about diversification with
      no basis — a concentration could be hiding in the three it cannot
      classify. Same standing rule as the data layer: flag the gap, never
      calculate around it.
    */
    const r = selectSectorConcentration(picks(null, null, null, 'IT', 'Auto'));
    expect(r.unknownCount).toBe(3);
    expect(r.label).toContain('3 unclassified');
    expect(r.label).not.toBe('Spread across 2 sectors');
  });

  it('still flags a real concentration alongside a gap', () => {
    const r = selectSectorConcentration(picks('Financials', 'Financials', 'Financials', null, 'Auto'));
    expect(r.isConcentrated).toBe(true);
    expect(r.label).toBe('3 of 5 in Financials · 1 unclassified');
  });

  it('says so plainly when nothing is classified', () => {
    const r = selectSectorConcentration(picks(null, null));
    expect(r.label).toBe('Sector data unavailable');
    expect(r.isConcentrated).toBe(false);
  });
});

describe('stability and degenerate input', () => {
  it('breaks ties alphabetically rather than by insertion order', () => {
    // Without this the label flips between renders on a tie, which reads as
    // the portfolio changing when nothing has.
    const a = selectSectorConcentration(picks('IT', 'IT', 'Auto', 'Auto', 'Pharma'));
    const b = selectSectorConcentration(picks('Auto', 'Auto', 'IT', 'IT', 'Pharma'));
    expect(a.topSector).toBe(b.topSector);
    expect(a.topSector).toBe('Auto');
  });

  it('returns null for no picks rather than a misleading zero', () => {
    expect(selectSectorConcentration([])).toBeNull();
    expect(selectSectorConcentration(null)).toBeNull();
  });
});
