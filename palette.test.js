/**
 * PALETTE CONTRAST TESTS — decision D5, and a permanent regression guard.
 *
 * These values shipped below the WCAG AA floor for several versions because
 * nobody had measured them. A design system whose contrast is checked by eye
 * is a design system whose contrast is not checked.
 *
 * The two corrected pairings are the high-traffic ones: gold-on-gold-soft
 * appears on every selected segment, every active window chip and every
 * preset; gain-on-gain-soft appears on every positive chip in the app.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function token(name, { dark = false } = {}) {
  // Dark values are declared after the light ones, so the last match is the
  // dark override and the first is the light default.
  const all = [...css.matchAll(new RegExp(`--color-${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());
  if (all.length === 0) throw new Error(`token --color-${name} not found`);
  return dark ? all[all.length - 1] : all[0];
}

function relativeLuminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe('D5 — the two corrected tokens', () => {
  it('gold text clears AA on its own soft background', () => {
    // Was #8a6a1f at 4.40:1 — below the floor, on every selected control.
    expect(contrast(token('gold'), token('gold-soft'))).toBeGreaterThanOrEqual(AA);
  });

  it('gain text clears AA on its own soft background', () => {
    // Was #0b7d52 at 4.45:1 — below the floor, on every positive chip.
    expect(contrast(token('gain'), token('gain-soft'))).toBeGreaterThanOrEqual(AA);
  });

  /*
    RETARGETED IN M14, NOT WEAKENED.

    This pinned `gold` to #7d601b — the D5 correction of a value that had
    shipped below the contrast floor. D18 replaced the whole palette with the
    terminal scheme at the owner's instruction, so the pin's subject genuinely
    moved: gold is acid lime now, and #7d601b is not a colour this app has any
    more.

    What the pin was FOR still holds, so it is re-aimed rather than deleted.
    Its job is to catch a silent revert to a value that failed — so it now
    names both the current value and the two known-bad ones by hex, and the
    assertions above still prove the pairing clears AA independently of any
    literal.
  */
  const PRE_D5_FAILURES = ['#8a6a1f', '#0b7d52'];

  it('keeps the M14 values, and cannot silently revert to a known-bad one', () => {
    expect(token('gold')).toBe('#5c6b00');
    expect(token('gain')).toBe('#0a7049');
    expect(PRE_D5_FAILURES).not.toContain(token('gold'));
    expect(PRE_D5_FAILURES).not.toContain(token('gain'));
  });

  it('dark gold-soft is measurable, not an alpha wash', () => {
    // An rgba() token cannot be run through a contrast check, so a token
    // declared that way is one this suite silently stops guarding.
    expect(token('gold-soft', { dark: true })).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('light mode contrast floor', () => {
  const pairs = [
    ['ink', 'canvas'], ['ink', 'surface'],
    ['ink-muted', 'surface'], ['ink-muted', 'surface-raised'],
    ['gold', 'surface'], ['gain', 'surface'], ['loss', 'surface'],
    ['loss', 'loss-soft'], ['warn', 'warn-soft'],
    ['on-gold', 'gold-fill'],
  ];
  it.each(pairs)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(AA);
  });
});

describe('dark mode contrast floor', () => {
  const pairs = [
    ['ink', 'surface'], ['ink-muted', 'surface'], ['ink-muted', 'surface-raised'],
    ['gold', 'surface'], ['gain', 'surface'], ['loss', 'surface'], ['warn', 'surface'],
  ];
  it.each(pairs)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(token(fg, { dark: true }), token(bg, { dark: true }))).toBeGreaterThanOrEqual(AA);
  });
});

describe('permanent prohibitions', () => {
  it('white on gold-fill stays prohibited', () => {
    // Measured 2.35:1. This is the entire reason --color-on-gold exists.
    expect(contrast('#ffffff', token('gold-fill'))).toBeLessThan(3);
  });

  it('uses neither pure black nor a pure-white page background', () => {
    // Dense tabular numerals on #000 produce harsh halation.
    expect(token('canvas', { dark: true }).toLowerCase()).not.toBe('#000000');
    expect(token('canvas').toLowerCase()).not.toBe('#ffffff');
  });

  it('defines a disabled token per theme rather than leaving it per-component', () => {
    expect(token('disabled-ink')).toBeTruthy();
    expect(token('disabled-ink', { dark: true })).toBeTruthy();
    expect(token('disabled-ink')).not.toBe(token('disabled-ink', { dark: true }));
  });
});
