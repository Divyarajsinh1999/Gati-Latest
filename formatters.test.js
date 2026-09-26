import { describe, it, expect } from 'vitest';
import { formatPct, formatGap } from '../formatters.js';

describe('formatGap — differences between two percentages', () => {
  /**
   * OWNER DECISION, 8 Aug 2026 (restated the same day).
   *
   * These values — Relative Strength, outperformance, the gap to a
   * benchmark — are arithmetically percentage POINTS, and the app used to
   * render them with a `pp` suffix for that reason. The owner's call is
   * that `pp` is a barrier for a beginner and every one should read as `%`,
   * framed as "this stock is X% ahead of its benchmark".
   *
   * The distinction is not lost, it moved: the Outperformance and Relative
   * Strength glossary entries now spell out that +11.4% means 11.4 points
   * ahead rather than 11.4% more. That is asserted in glossary.test.js.
   *
   * These tests pin the DISPLAY convention so it cannot drift back by
   * accident, and so a future reader can find the decision from the code.
   */
  it('renders a gap with a % sign, never pp', () => {
    expect(formatGap(18.93)).toBe('+18.93%');
    expect(formatGap(-6.95)).toBe('−6.95%');
    expect(formatGap(0)).toBe('0.00%');
  });

  it('keeps the typographic minus, so a column of gains and losses stays aligned', () => {
    // U+2212, the same width as `+`. A hyphen reads as a dash at 11px and
    // shifts every negative row half a character left.
    expect(formatGap(-3)).toContain('\u2212');
    expect(formatGap(-3)).not.toContain('-');
  });

  it('honours digits and showSign', () => {
    expect(formatGap(7.126, { digits: 1 })).toBe('+7.1%');
    expect(formatGap(7.126, { showSign: false })).toBe('7.13%');
    // showSign suppresses the PLUS only. A negative is not a presentation
    // choice — dropping its sign would state the opposite of the truth.
    expect(formatGap(-7.126, { showSign: false })).toBe('−7.13%');
  });

  it('returns an em-dash for a missing value rather than "NaN%"', () => {
    for (const bad of [null, undefined, Number.NaN, {}]) {
      expect(formatGap(bad)).toBe('—');
    }
  });

  it('emits no "pp" anywhere, for any input', () => {
    for (const value of [-100, -1.5, 0, 0.004, 12.5, 9999]) {
      expect(formatGap(value)).not.toMatch(/pp/);
    }
  });
});

describe('formatPct units', () => {
  /**
   * A DIFFERENCE between two percentages is not itself a percentage.
   * "The strategy beat its benchmark by 18.93%" implies a proportional
   * gain; "by 18.93pp" states an arithmetic gap. They are different
   * claims and only the second is true of Relative Strength, which the
   * spec defines as stock return % MINUS benchmark return %.
   *
   * This shipped wrong once — the hero rendered "+18.93%pp" by appending
   * a unit to a string that already carried one — so it's pinned here.
   */
  it('never doubles the unit', () => {
    for (const unit of ['%', '']) {
      const out = formatPct(5, { unit });
      expect(out.endsWith(unit)).toBe(true);
      // "5.00%%" must be impossible — it shipped once.
      expect(out).not.toMatch(/%%/);
    }
  });

  it('defaults to %, so every existing caller keeps its meaning', () => {
    expect(formatPct(12.5)).toBe('+12.50%');
    expect(formatPct(-3.25)).toBe('-3.25%');
  });

  it('still honours digits and showSign alongside a unit', () => {
    expect(formatPct(7.126, { digits: 1 })).toBe('+7.1%');
    expect(formatPct(7.126, { showSign: false })).toBe('7.13%');
  });

  it('returns an em-dash for missing values rather than "NaN%"', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatPct(undefined)).toBe('—');
    expect(formatPct(Number.NaN)).toBe('—');
  });
});
