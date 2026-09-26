/**
 * EXECUTION METRICS — what whole-share reality costs, made visible.
 *
 * WHAT THIS OWNS
 *   The gap between the strategy as evaluated and the strategy as actually
 *   executable at one particular amount of money: idle cash, cash drag,
 *   execution efficiency, and the ideal-versus-executable return difference.
 *
 * WHAT THIS MUST NEVER DO
 *   Feed anything back into the historical record. Decision D1 draws a hard
 *   line: strategy evaluation is capital-independent; execution simulation is
 *   capital-specific. These numbers belong exclusively to the Investment
 *   Simulator, where the user has entered their own amount.
 *
 * WHY THESE NUMBERS DESERVE TO BE SHOWN AT ALL
 *   Because they are real, and because hiding them would be the mirror image
 *   of the mistake D1 fixed. The record must not carry one investor's cash
 *   drag — but that investor still has it, and at small account sizes it is
 *   not a rounding error. Measured on real signals: at ₹25,000 an average
 *   20.6% of capital sat idle and the executable return came in 2.15pp below
 *   the strategy's. Someone deciding whether ₹25,000 is enough to run this
 *   strategy deserves to see that, stated plainly, rather than discovering it
 *   after a year of trading.
 *
 *   So: the record says what the strategy did. The Simulator says what YOUR
 *   money would have done, and shows the difference as an explicit cost of
 *   lot sizes rather than as an unexplained shortfall.
 */

/**
 * Execution quality for one sized portfolio.
 *
 * @param {object} args
 * @param {number} args.capital           the user's entered amount
 * @param {number} args.totalInvested     actually deployed after flooring
 * @param {Array}  [args.positions]       for per-position drag detail
 * @returns {{
 *   capital:number, invested:number, idleCash:number,
 *   cashDragPct:number, executionEfficiencyPct:number,
 *   worstPositionDragPct:number|null, positionsAtRisk:Array
 * }}
 */
export function calculateExecutionQuality({ capital, totalInvested, positions = [] }) {
  if (!(capital > 0)) {
    throw new Error(`calculateExecutionQuality: capital must be > 0, got ${capital}`);
  }

  const idleCash = Math.max(0, capital - totalInvested);

  // Two views of the same fact, kept separate because they answer different
  // questions and users reliably want one or the other, not a blend:
  //   cashDragPct           "how much of my money isn't working?"
  //   executionEfficiencyPct "how much of my plan did I actually get?"
  const cashDragPct = (idleCash / capital) * 100;
  const executionEfficiencyPct = (totalInvested / capital) * 100;

  // Per-position drag identifies WHICH holding is causing it, which is
  // actionable in a way the aggregate is not: a single ₹4,000 share in a
  // ₹2,000 slot is a different problem from uniformly awkward lot sizes.
  const withDrag = positions
    .filter((p) => p.targetAllocation > 0)
    .map((p) => ({
      symbol: p.symbol,
      name: p.name,
      entryPrice: p.entryPrice,
      shares: p.shares,
      invested: p.invested,
      unusedCash: p.remaining ?? 0,
      dragPct: ((p.remaining ?? 0) / p.targetAllocation) * 100,
      // A slot that cannot buy even one share is not drag — it is a position
      // the user simply cannot take at this amount, and it needs saying.
      isUnaffordable: p.shares === 0,
    }))
    .sort((a, b) => b.dragPct - a.dragPct);

  return {
    capital,
    invested: totalInvested,
    idleCash,
    cashDragPct,
    executionEfficiencyPct,
    worstPositionDragPct: withDrag.length ? withDrag[0].dragPct : null,
    positionsAtRisk: withDrag.filter((p) => p.isUnaffordable || p.dragPct > 25),
    perPosition: withDrag,
  };
}

/**
 * The ideal-versus-executable comparison (decision D1's user-facing payoff).
 *
 * `idealReturnPct` comes from the capital-independent record. `executableReturnPct`
 * comes from re-running the same signals with whole-share flooring at the
 * user's amount. The difference is attributable to lot sizes and nothing else,
 * because every other input is identical.
 *
 * @returns {{
 *   idealReturnPct:number|null, executableReturnPct:number|null,
 *   shortfallPct:number|null, captureRatioPct:number|null, verdict:string
 * }}
 */
export function compareIdealToExecutable({ idealReturnPct, executableReturnPct }) {
  if (idealReturnPct == null || executableReturnPct == null) {
    return {
      idealReturnPct: idealReturnPct ?? null,
      executableReturnPct: executableReturnPct ?? null,
      shortfallPct: null,
      captureRatioPct: null,
      verdict: 'unavailable',
    };
  }

  const shortfallPct = idealReturnPct - executableReturnPct;

  // How much of the strategy's return this account size actually captured.
  // Undefined rather than infinite when the ideal return is zero or negative:
  // "captured 140% of a -3% return" is arithmetically true and useless.
  const captureRatioPct = idealReturnPct > 0 ? (executableReturnPct / idealReturnPct) * 100 : null;

  let verdict;
  if (Math.abs(shortfallPct) < 0.05) verdict = 'negligible';
  else if (shortfallPct > 1.5) verdict = 'material';
  else if (shortfallPct > 0) verdict = 'noticeable';
  else verdict = 'favourable'; // flooring occasionally helps, by luck of prices

  return { idealReturnPct, executableReturnPct, shortfallPct, captureRatioPct, verdict };
}

/**
 * The smallest capital at which every pick is affordable.
 *
 * Answers "how much do I need for this strategy to be executable at all?",
 * which is the question a small account actually has. Derived from the most
 * expensive share in the set, because equal weighting means every slot must
 * clear that price.
 */
export function minimumViableCapital(picks, topN = picks.length) {
  const prices = picks.map((p) => p.entryPrice).filter((p) => p > 0);
  if (prices.length === 0 || topN <= 0) return null;
  return Math.max(...prices) * topN;
}
