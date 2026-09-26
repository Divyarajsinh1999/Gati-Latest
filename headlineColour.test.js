/**
 * THE HEADLINE IS COLOURED BY THE NUMBER IT IS SHOWING.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT WENT WRONG
 *
 * The record's headline figure is the STRATEGY RETURN. Its colour was taken
 * from OUTPERFORMANCE. So a record reading "+16.69%" printed in the loss
 * colour whenever the benchmark happened to do better — exactly the case a
 * momentum investor most needs to read carefully.
 *
 * Red on a positive number is read as a loss before the digits are read.
 * Section 30 is explicit: green is gain, red is loss.
 *
 * WHY NO TEST CAUGHT IT: every existing assertion checked the LABEL, and the
 * label was always right. Colour lived in a sibling field nothing compared
 * against the value it described. It was caught by looking at a screenshot.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { selectRecordView } from '../recordView.js';

function viewWith({ strategyReturnPct, benchmarkReturnPct }) {
  const end = 100 * (1 + strategyReturnPct / 100);
  return selectRecordView({
    windowSlug: '1m',
    data: {
      headline: {
        strategyReturnPct,
        benchmarkReturnPct,
        outperformancePct: strategyReturnPct - benchmarkReturnPct,
        maxDrawdownPct: -5,
      },
      backtest: {
        cycles: [{
          entryDate: '2025-05-30', exitDate: '2025-06-30',
          portfolioHoldingReturnPct: strategyReturnPct,
          benchmarkHoldingReturnPct: benchmarkReturnPct,
          capitalAtStart: 100, totalInvested: 100, exitValue: end,
        }],
        equityCurve: [
          { date: '2025-05-30', monthKey: '2025-05', indexValue: 100, value: 100 },
          { date: '2025-06-30', monthKey: '2025-06', indexValue: end, value: end },
        ],
      },
    },
  });
}

describe('a profitable record that trails its benchmark', () => {
  const view = viewWith({ strategyReturnPct: 16.69, benchmarkReturnPct: 23.66 });

  it('shows the gain colour, not the loss colour', () => {
    // The exact shipped case.
    expect(view.headline.direction).toBe('gain');
    expect(view.headline.direction).not.toBe('loss');
  });

  it('still reports the shortfall on the outperformance chip', () => {
    // formatGap uses U+2212 MINUS SIGN, not a hyphen.
    expect(view.headline.outperformanceLabel).toContain('\u2212');
  });

  it('keeps the chip RED while the headline is green', () => {
    /*
      THE BUG THIS TEST WAS ADDED FOR, after the first version of it missed.

      Both the headline and the chip read one `direction` field. Colouring the
      headline by its own return made the chip inherit it, so a screenshot
      showed "Outperformance −7.0%" in green — one misreading traded for
      another. The original test checked the chip's LABEL and passed anyway.

      Two figures with two meanings need two fields.
    */
    expect(view.headline.direction).toBe('gain');
    expect(view.headline.outperformanceDirection).toBe('loss');
  });
});

describe('a losing record', () => {
  it('shows the loss colour', () => {
    expect(viewWith({ strategyReturnPct: -8.2, benchmarkReturnPct: -2 })
      .headline.direction).toBe('loss');
  });

  it('shows the loss colour even when it beats a worse benchmark', () => {
    // The mirror of the original bug: down 8% but ahead of a benchmark down
    // 20% is still a loss, and must not be painted green.
    expect(viewWith({ strategyReturnPct: -8.2, benchmarkReturnPct: -20 })
      .headline.direction).toBe('loss');
  });
});

describe('the underwater metric sits with the drawdown', () => {
  it('appears in the risk group with a sublabel MetricTile can render', () => {
    const view = viewWith({ strategyReturnPct: 16.69, benchmarkReturnPct: 23.66 });
    const tile = view.risk.find((m) => m.key === 'underwaterDuration');
    expect(tile).toBeTruthy();
    // `sublabel`, not an invented `note` — MetricTile renders this prop.
    expect(tile).toHaveProperty('sublabel');
    expect(view.risk.findIndex((m) => m.key === 'underwaterDuration'))
      .toBe(view.risk.findIndex((m) => m.key === 'maxDrawdown') + 1);
  });
});
