import { useEffect, useState } from 'react';

/**
 * Chart colours for Recharts.
 *
 * WHY THIS FILE EXISTS: every other component in this app themes itself
 * for free, because it references `var(--color-*)` in a class and the
 * cascade resolves it. Recharts does not work that way — it writes colours
 * into raw SVG presentation attributes (`stroke="#666"`, `fill="..."`)
 * from JS props, and its defaults are hardcoded light-mode greys. A chart
 * left alone therefore stays light-mode grey on a dark page: axis labels
 * go nearly invisible and gridlines glare.
 *
 * So chart colours have to be resolved to concrete values in JS and passed
 * as props. `useChartTheme` reads the SAME tokens from the live document,
 * which means the palette still has exactly one definition
 * (src/index.css) — this is a bridge, not a second source of truth. If a
 * token changes there, charts follow automatically.
 */

const TOKENS = {
  ink: '--color-ink',
  inkMuted: '--color-ink-muted',
  line: '--color-line',
  surface: '--color-surface',
  gold: '--color-gold-fill',
  gain: '--color-gain-fill',
  loss: '--color-loss-fill',
  // M14: the three universe accents, so a chart can be tinted by the
  // universe it describes without any component knowing the hexes.
  uniNifty50: '--color-uni-nifty50-fill',
  uniMidcap150: '--color-uni-midcap150-fill',
  uniSmallcap250: '--color-uni-smallcap250-fill',
};

/** Fallbacks for environments with no computed styles (jsdom). Dark, since
 *  M14 made dark the default theme — a light fallback would mean jsdom
 *  snapshots describing a palette almost no reader sees. */
const FALLBACK = {
  ink: '#edf3f4',
  inkMuted: '#8a98a2',
  line: '#222d34',
  surface: '#10161a',
  gold: '#d7ff43',
  gain: '#3fcf98',
  loss: '#e8546b',
  uniNifty50: '#d7ff43',
  uniMidcap150: '#7dd3fc',
  uniSmallcap250: '#f0abfc',
};

/**
 * The accent for a universe, for charts that describe exactly one.
 *
 * Falls back to `gold` rather than throwing: a chart with no universe in
 * scope — the portfolio value curve spans all three — is a legitimate case,
 * not an error.
 */
export function universeAccent(palette, universeKey) {
  return {
    nifty50: palette.uniNifty50,
    midcap150: palette.uniMidcap150,
    smallcap250: palette.uniSmallcap250,
  }[universeKey] ?? palette.gold;
}

function readTokens() {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return FALLBACK;
  try {
    const styles = getComputedStyle(document.documentElement);
    const out = {};
    for (const [key, cssVar] of Object.entries(TOKENS)) {
      const value = styles.getPropertyValue(cssVar).trim();
      out[key] = value || FALLBACK[key];
    }
    return out;
  } catch {
    return FALLBACK;
  }
}

/**
 * Live chart palette. Re-reads whenever the theme attribute flips, so
 * charts re-colour on toggle without a page reload.
 */
export function useChartTheme() {
  const [palette, setPalette] = useState(readTokens);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return undefined;
    const observer = new MutationObserver(() => setPalette(readTokens()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return palette;
}

/**
 * Shared axis/grid/tooltip props so all six charts stay consistent and no
 * single chart quietly drifts to its own grey.
 */
export function chartDefaults(palette) {
  return {
    /*
      M14 matched these to the reference build's Chart.js configuration,
      read out of its bundle rather than guessed: ticks at 9px mono, grid
      at 6% white, no vertical lines, no tick marks, no axis line.

      The grid is deliberately WEAKER than the tokenised hairline. `--line`
      is tuned for borders that must be seen; a gridline that is seen is a
      gridline competing with the data. 45% of it lands close to the
      reference's rgba(255,255,255,.06) on dark while still resolving to
      something sane on light — which the literal would not.
    */
    axis: {
      stroke: palette.inkMuted,
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      tickLine: false,
      axisLine: false,
    },
    grid: {
      stroke: palette.line,
      strokeOpacity: 0.45,
      vertical: false,
    },
    tooltip: {
      contentStyle: {
        background: palette.surface,
        border: `1px solid ${palette.line}`,
        borderRadius: 8,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: palette.ink,
      },
      labelStyle: { color: palette.inkMuted },
    },
  };
}


/* ══════════════════════════════════════════════════════════════════════
   THE SERIES CONTRACT

   The strategy is ALWAYS solid gold. The benchmark is ALWAYS dashed grey.
   Never reversed, in any chart, anywhere.

   This is the crossing motif from the app mark, at chart scale: a flat,
   quiet baseline crossed by an accelerating line. A reader who learns it
   once on the equity curve reads every other chart for free — and a chart
   that swapped them would silently invert the conclusion.

   Legend swatches reproduce the PATTERN, not just the colour, because a
   dashed series identified by a solid swatch teaches the wrong mapping.
   ══════════════════════════════════════════════════════════════════════ */

export function seriesContract(palette, universeKey) {
  /*
    M14: the strategy stroke takes the UNIVERSE accent where there is one, so
    a small-cap equity curve is magenta and a midcap one cyan — matching the
    nav bar, the tab dot and the strategy card for that universe. The
    contract above is unchanged: strategy still solid, benchmark still dashed
    grey, never reversed. Only the hue moved, and it moved to mean something.

    1.5px and no dots, from the reference build. A 2px stroke with visible
    points reads as a line chart of seven values; this reads as a series.
  */
  const strategy = universeAccent(palette, universeKey);
  return {
    /*
      `name` is what Recharts prints in a TOOLTIP, and it has to be the same
      words the legend uses or the chart labels one line two different ways.
      Renamed from 'Strategy' in v1.6.1, when the Dashboard's legend became
      "Momentum portfolio" at the owner's instruction — the tooltip would
      otherwise have kept saying "Strategy" for the line the legend beside it
      had just called something else.
    */
    strategy: { stroke: strategy, strokeWidth: 1.5, strokeDasharray: undefined, dot: false, name: 'Momentum portfolio' },
    benchmark: { stroke: palette.inkMuted, strokeWidth: 1.5, strokeDasharray: '4 3', dot: false, name: 'Benchmark' },
    drawdown: { stroke: palette.loss, strokeWidth: 1.5, fill: palette.loss, fillOpacity: 0.12, dot: false, name: 'Drawdown' },
  };
}

/**
 * Categorical palette for rank lines — the ONE place colour is categorical
 * rather than semantic, because rank identity carries no positive or negative
 * meaning. Capped at seven: beyond that the chart is unreadable and rows are
 * dropped rather than the palette extended.
 */
export const RANK_COLOURS = [
  '#ad8a3d', '#1e8e5a', '#2b6cb0', '#c23b34', '#7c5cbf', '#b4600f', '#0e7490',
];

/**
 * Synchronised hover.
 *
 * Charts sharing this id share a crosshair, so a drawdown and the equity
 * curve that caused it line up under one cursor. Matching dates by eye across
 * two charts is exactly the work a chart is supposed to remove.
 */
export const SYNC_ID = 'gati-record';
