/**
 * Equal-weight position sizing (spec Sections 12-13, 26).
 * Whole-share (no fractional shares) cash-market convention throughout.
 */

/** ₹ allocation per position for equal weighting across N picks. */
export function equalWeightAllocation(totalCapital, numPositions) {
  if (numPositions <= 0) throw new Error('numPositions must be > 0');
  return totalCapital / numPositions;
}

/** floor(allocation / entryPrice) — whole shares only (spec Section 13). */
export function calculateShares(allocation, entryPrice) {
  if (!(entryPrice > 0)) throw new Error(`calculateShares: invalid entryPrice ${entryPrice}`);
  return Math.floor(allocation / entryPrice);
}

/**
 * Builds the position table for a set of picks at a given total capital.
 * Returns each position's allocation/shares/invested/remaining, plus the
 * pooled remaining cash across all positions (spec Section 13: show Entry
 * Price, Target Allocation, Shares Purchased, Actual Amount Invested,
 * Remaining Cash).
 */
export function buildPositions(picks, totalCapital) {
  const n = picks.length;
  if (n === 0) {
    return { positions: [], totalInvested: 0, remainingCash: totalCapital };
  }
  const allocation = equalWeightAllocation(totalCapital, n);

  const positions = picks.map((pick) => {
    const shares = calculateShares(allocation, pick.entryPrice);
    const invested = shares * pick.entryPrice;
    return {
      symbol: pick.symbol,
      name: pick.name,
      entryPrice: pick.entryPrice,
      targetAllocation: allocation,
      shares,
      invested,
      remaining: allocation - invested,
    };
  });

  const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);
  const remainingCash = totalCapital - totalInvested;
  return { positions, totalInvested, remainingCash };
}

/**
 * FRACTIONAL equal-weight positions — the basis for the historical strategy
 * record (decision D1).
 *
 * Exactly 1/N of capital into each pick, with fractional share quantities and
 * therefore ZERO leftover cash. `totalCapital` is a notional base here, not a
 * claim about anyone's account: every figure derived from these positions is a
 * ratio, so the base cancels out. Passing 100 makes the resulting values read
 * directly as an index.
 *
 * WHY THIS EXISTS SEPARATELY FROM buildPositions
 *   Whole-share flooring makes the reported percentage return depend on the
 *   assumed account size — measured at a 2.15pp spread between ₹25,000 and a
 *   large notional, from lot sizes alone. A track record has to be comparable
 *   across periods, universes and windows, so it cannot carry one particular
 *   investor's cash drag. See weighting.js for the full measurement.
 *
 * The returned shape matches buildPositions exactly, so mark-to-exit, cost
 * application and cycle assembly downstream are shared, not duplicated.
 * `remaining` is 0 and `remainingCash` is 0 by construction — not by luck —
 * because the allocation is exact.
 */
export function buildFractionalPositions(picks, totalCapital) {
  const n = picks.length;
  if (n === 0) {
    return { positions: [], totalInvested: 0, remainingCash: totalCapital };
  }
  const allocation = equalWeightAllocation(totalCapital, n);

  const positions = picks.map((pick) => {
    if (!(pick.entryPrice > 0)) {
      throw new Error(`buildFractionalPositions: invalid entryPrice ${pick.entryPrice} for ${pick.symbol}`);
    }
    return {
      symbol: pick.symbol,
      name: pick.name,
      entryPrice: pick.entryPrice,
      targetAllocation: allocation,
      // Fractional by design. Never rounded, never floored — rounding here
      // would smuggle a smaller version of the same lot-size artefact back
      // into the record.
      shares: allocation / pick.entryPrice,
      invested: allocation,
      remaining: 0,
      isFractional: true,
    };
  });

  return { positions, totalInvested: totalCapital, remainingCash: 0 };
}

/**
 * Marks a set of positions to a later price (e.g. exit/execution price for
 * the next rebalance), returning per-position exit value and total.
 * `exitPrices` is a Map<symbol, price>. Positions with no available exit
 * price are marked and excluded from the total with a flag, rather than
 * silently valuing them at zero (spec Section 41).
 */
export function markToExit(positions, exitPrices) {
  let flags = [];
  const marked = positions.map((p) => {
    const exitPrice = exitPrices.get(p.symbol);
    if (exitPrice == null) {
      flags.push(`Missing exit price for ${p.symbol}`);
      return { ...p, exitPrice: null, exitValue: null };
    }
    return { ...p, exitPrice, exitValue: p.shares * exitPrice };
  });
  const totalExitValue = marked.reduce((sum, p) => sum + (p.exitValue ?? 0), 0);
  return { positions: marked, totalExitValue, flags };
}
