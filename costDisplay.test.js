/**
 * THE COST NOTE MUST STATE THE RATES THAT ARE ACTUALLY CHARGED.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT WENT WRONG
 *
 * Settings described the cost model as "STT 10.000%, stamp duty 1.500%,
 * slippage 5.000%" against real values of 0.1%, 0.015% and 0.05%. A helper
 * multiplied by 100 on values that were already percentages.
 *
 * WHY IT SURVIVED: the arithmetic it described was correct. `calculateTradeCost`
 * divides by 100 properly, so every backtest number was right — the error was
 * confined to one sentence nobody reconciles against anything. A reader who
 * believed it would have concluded costs alone made the strategy hopeless.
 *
 * Same shape as the drawdown chart and the unreachable UnknownRoute: a correct
 * engine, a correct-looking surface, and a broken join that no gate spanned.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRANSACTION_COSTS } from '../../../config/constants.js';

const source = readFileSync(
  resolve(process.cwd(), 'src/screens/settings/SettingsScreen.jsx'), 'utf8');

describe('the rates in config are percentages already', () => {
  it('holds the statutory rates at plausible levels', () => {
    // If any of these ever exceeds 1 the config has been switched to
    // fractions, and every consumer needs checking — not just this display.
    expect(TRANSACTION_COSTS.sttPct).toBeLessThan(1);
    expect(TRANSACTION_COSTS.stampDutyPct).toBeLessThan(1);
    expect(TRANSACTION_COSTS.slippagePct).toBeLessThan(1);
  });
});

describe('the Settings note', () => {
  it('does not multiply an already-percentage value by 100', () => {
    expect(source).not.toMatch(/value \* 100/);
  });

  it('formats the rates without rescaling them', () => {
    const helper = source.slice(source.indexOf('function pctOfTrade'));
    expect(helper.slice(0, 200)).toContain('Number(value).toFixed(3)');
  });

  it('would have produced an absurd STT figure under the old helper', () => {
    // Proves this guard is aimed at the real defect rather than at a style.
    const broken = (v) => Number((v * 100).toFixed(3));
    expect(broken(TRANSACTION_COSTS.sttPct)).toBe(10);
    const fixed = (v) => Number(Number(v).toFixed(3));
    expect(fixed(TRANSACTION_COSTS.sttPct)).toBe(0.1);
  });
});
