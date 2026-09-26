/**
 * WEIGHTING — the two allocation bases, kept deliberately separate.
 *
 * WHAT THIS OWNS
 *   Deciding how capital is divided across the Top N, and which of the two
 *   bases applies to a given question.
 *
 * WHAT THIS MUST NEVER DO
 *   Blur the two. That is the entire reason this module exists as its own
 *   named file rather than a boolean buried in the backtest.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE TWO QUESTIONS, AND WHY THEY NEED DIFFERENT MATHS   (decision D1)
 *
 *   "How did this STRATEGY perform?"      → FRACTIONAL
 *   "What would MY money have done?"      → WHOLE_SHARE
 *
 * FRACTIONAL puts exactly 1/N in each pick. No leftover cash, no lot-size
 * artefacts. The portfolio's return is the equal-weighted mean of its picks'
 * returns, which makes it capital-independent: the same signals produce the
 * same percentage return whether the notional is ₹1 or ₹1 crore. That is what
 * a track record has to be if two periods, two universes or two windows are
 * ever going to be compared.
 *
 * WHOLE_SHARE floors to buyable quantities and leaves the remainder as idle
 * cash, because Indian cash-market delivery trades in whole shares and that
 * cash really does sit there earning nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS ISN'T A STYLE PREFERENCE — the measurement that settled it
 *
 * The same signals, the same stocks, the same dates, varying ONLY the
 * assumed capital, under whole-share flooring:
 *
 *     ₹25,000    → 5.7321%   (20.57% of capital idle on average)
 *     ₹50,000    → 6.9958%   ( 8.84% idle)
 *     ₹1,00,000  → 7.5896%   ( 5.03% idle)
 *     ₹5,00,000  → 7.7549%   ( 1.08% idle)
 *     ₹50 crore  → 7.8875%   ( 0.00% idle)
 *
 * A 2.15 percentage-point spread produced by nothing but account size. The
 * ₹25,000 row is not merely different — it is misleading, because it reports
 * the strategy underperforming by 2.15pp when the strategy did no such thing.
 * That gap is an artefact of lot sizes, not of stock selection. The figures
 * converge on 7.8875% as flooring error vanishes, and that converged number
 * is exactly what FRACTIONAL produces directly.
 *
 * Flooring is not wrong. It is REAL, and it is precisely what happens when
 * someone actually places the trades — which is why it survives, in the
 * Investment Simulator, where the user has supplied their own amount and the
 * idle cash is a genuine cost they should see.
 */

import { equalWeightAllocation, buildPositions, buildFractionalPositions } from './portfolio.js';

/** @readonly */
export const WEIGHTING = {
  /** Exact 1/N. Capital-independent. The basis for ALL published history. */
  FRACTIONAL: 'fractional',
  /** floor(allocation / price), with the remainder held as idle cash. */
  WHOLE_SHARE: 'whole-share',
};

/** The basis the historical strategy record uses, always. Decision D1. */
export const RECORD_WEIGHTING = WEIGHTING.FRACTIONAL;

/** The basis the Investment Simulator uses, always. Decision D1. */
export const SIMULATOR_WEIGHTING = WEIGHTING.WHOLE_SHARE;

/**
 * Allocate `totalCapital` across `picks` on the given basis.
 *
 * Both paths return the same shape, so callers downstream (mark-to-exit, cost
 * application, cycle assembly) are identical. Only the numbers differ, which
 * is the point: one switch, one place, no divergent code paths to keep in
 * sync.
 *
 * @param {Array<{symbol:string,name:string,entryPrice:number}>} picks
 * @param {number} totalCapital  a real amount for WHOLE_SHARE; a notional
 *   base for FRACTIONAL, where it cancels out of every percentage
 * @param {string} [basis]
 * @returns {{positions:Array, totalInvested:number, remainingCash:number, basis:string}}
 */
export function allocate(picks, totalCapital, basis = RECORD_WEIGHTING) {
  if (basis === WEIGHTING.FRACTIONAL) {
    return { ...buildFractionalPositions(picks, totalCapital), basis };
  }
  if (basis === WEIGHTING.WHOLE_SHARE) {
    return { ...buildPositions(picks, totalCapital), basis };
  }
  // An unrecognised basis must not silently fall back to one of them: the
  // choice determines every historical number in the product.
  throw new Error(`allocate: unknown weighting basis "${basis}"`);
}

/**
 * True when a basis produces figures independent of the notional.
 *
 * The UI uses this to decide whether a rupee amount may be shown alongside a
 * percentage at all. Under FRACTIONAL there is no meaningful rupee value —
 * only a ratio — and presenting one would reintroduce exactly the assumed
 * account size that decision D1 removed.
 */
export function isCapitalIndependent(basis) {
  return basis === WEIGHTING.FRACTIONAL;
}

export { equalWeightAllocation };
