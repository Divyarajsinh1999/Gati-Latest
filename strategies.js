/**
 * Strategy registry (spec Sections 24, 25, 34).
 *
 * Section 34 requires that adding a strategy not mean rewriting unrelated
 * parts of the app, and Section 25 is explicit that the longer-lookback
 * variants are NOT to be built pre-emptively. This file is the seam that
 * satisfies both: every shipped strategy is registered here as data, and a
 * new one is an entry in this object rather than a change to the engine,
 * the UI, or the data layer.
 *
 * WHAT A STRATEGY IS, IN THIS APP:
 * a (universe × ranking rule) pair. The universe supplies the stock list and
 * its benchmark; the rule supplies the measurement window and selection
 * count. `runBacktest` already knows nothing about which rule produced its
 * picks, so the rule reduces to parameters it accepts.
 *
 * 3/6/12-MONTH RULES — REGISTERED BY EXPLICIT USER DECISION (2 Aug 2026):
 * Section 25 forbids building these pre-emptively, so they sat as untested
 * groundwork (`lookbackMonths` on `runBacktest`/`computeCurrentMomentum`)
 * until the user was asked directly and chose to add all three, across all
 * three universes. That's 4 rules × 3 universes = 12 strategies.
 *
 * THE SAMPLE-SIZE PROBLEM THIS CREATES, AND HOW IT'S HANDLED:
 * data starts at DATA_START_DATE (2025-01-01, see constants.js). A k-month
 * window needs k+1 month-ends before it can rank anything at all, so with
 * ~19 month-ends available, the 12-month rule only gets ~7 completed
 * rebalances — an early read, not a track record. Rather than hide that or
 * silently present a CAGR/Sharpe with false confidence, every consumer of
 * a backtest result also computes `assessHistorySufficiency` (see
 * engine/historySufficiency.js) and the UI surfaces it as a notice ABOVE
 * the metrics, not buried below them. The numbers are not wrong — the
 * sample is just thin, and the app says so rather than pretending.
 */
import { UNIVERSES, UNIVERSE_KEYS } from './universes.js';
import { TOP_N, DATA_START_DATE } from './constants.js';

/**
 * @typedef {Object} StrategyDefinition
 * @property {string} key            stable id, used in routes and exports
 * @property {string} universeKey    which universe it ranks within
 * @property {string} label
 * @property {string} shortLabel
 * @property {string} description    plain-language, shown in the UI
 * @property {number} lookbackMonths measurement window in month-ends
 * @property {number} topN
 */

/** The monthly RS rule — the one the app shipped with (Sections 7–11). */
const MONTHLY_RS = {
  ruleKey: 'rs-1m',
  ruleLabel: 'Monthly Relative Strength',
  ruleShortLabel: '1M',
  lookbackMonths: 1,
  topN: TOP_N,
  describe: (u) =>
    `Ranks every ${u.label} stock by its one-month return minus ${u.benchmark.label}'s ` +
    `return over the same month, then holds the top ${TOP_N}, rebalanced monthly.`,
};

/**
 * Longer-lookback rules (spec Section 25), registered 2 Aug 2026 by
 * explicit user choice — see the file header. All three measure over a
 * longer window but keep the SAME monthly rebalance cadence as the 1-month
 * rule; only the return window changes, not how often positions turn over.
 * That is the conventional meaning of "3-month momentum, rebalanced
 * monthly" and keeps these directly comparable to the original strategy.
 */
const RS_3M = {
  ruleKey: 'rs-3m',
  ruleLabel: '3-Month Relative Strength',
  ruleShortLabel: '3M',
  lookbackMonths: 3,
  topN: TOP_N,
  describe: (u) =>
    `Ranks every ${u.label} stock by its three-month return minus ${u.benchmark.label}'s ` +
    `return over the same window, then holds the top ${TOP_N}, rebalanced monthly.`,
};

const RS_6M = {
  ruleKey: 'rs-6m',
  ruleLabel: '6-Month Relative Strength',
  ruleShortLabel: '6M',
  lookbackMonths: 6,
  topN: TOP_N,
  describe: (u) =>
    `Ranks every ${u.label} stock by its six-month return minus ${u.benchmark.label}'s ` +
    `return over the same window, then holds the top ${TOP_N}, rebalanced monthly.`,
};

const RS_12M = {
  ruleKey: 'rs-12m',
  ruleLabel: '12-Month Relative Strength',
  ruleShortLabel: '12M',
  lookbackMonths: 12,
  topN: TOP_N,
  describe: (u) =>
    `Ranks every ${u.label} stock by its twelve-month return minus ${u.benchmark.label}'s ` +
    `return over the same window, then holds the top ${TOP_N}, rebalanced monthly. With data starting ` +
    `${DATA_START_DATE}, this window currently has very few completed rebalances — see the in-app notice.`,
};

/**
 * Builds one strategy per universe from a rule. Kept as a function so
 * adding a second rule later produces a parallel set without duplication.
 */
function strategiesForRule(rule) {
  const out = {};
  for (const universeKey of UNIVERSE_KEYS) {
    const u = UNIVERSES[universeKey];
    // The 1-month rule keeps the bare universe key as its strategy key, so
    // existing routes, saved URLs and CSV filenames stay valid. Any future
    // rule gets a suffixed key — see STRATEGY_KEY note below.
    const key = rule.lookbackMonths === 1 ? universeKey : `${universeKey}-${rule.ruleKey}`;
    out[key] = {
      key,
      universeKey,
      ruleKey: rule.ruleKey,
      ruleLabel: rule.ruleLabel,
      ruleShortLabel: rule.ruleShortLabel,
      label: `${u.label} ${rule.ruleLabel}`,
      shortLabel: u.shortLabel,
      description: rule.describe(u),
      lookbackMonths: rule.lookbackMonths,
      topN: rule.topN,
    };
  }
  return out;
}

/** @type {Record<string, StrategyDefinition>} */
export const STRATEGIES = {
  ...strategiesForRule(MONTHLY_RS),
  ...strategiesForRule(RS_3M),
  ...strategiesForRule(RS_6M),
  ...strategiesForRule(RS_12M),
};

export const STRATEGY_KEYS = Object.keys(STRATEGIES);

export function getStrategy(key) {
  const strategy = STRATEGIES[key];
  if (!strategy) throw new Error(`Unknown strategy: ${key}`);
  return strategy;
}

/**
 * Safe lookup for UI code — returns undefined instead of throwing, so a
 * page component can render a "not found" redirect instead of crashing on
 * a stale bookmark or a hand-typed URL for a strategy key that never
 * existed (see StrategyPage.jsx).
 */
export function findStrategy(key) {
  return STRATEGIES[key];
}

/** Backtest parameters for a strategy — the only thing the engine needs. */
export function strategyParams(key) {
  const { lookbackMonths, topN } = getStrategy(key);
  return { lookbackMonths, topN };
}

/**
 * Every registered strategy for one universe, ordered shortest-to-longest
 * window. Powers the on-page window switcher (StrategyRuleSwitcher) —
 * deliberately NOT surfaced in the global sidebar/tab bar, which stays at
 * 3 universes (see components/layout/Navigation.jsx); 12 links don't fit a phone.
 */
export function strategiesForUniverse(universeKey) {
  return Object.values(STRATEGIES)
    .filter((s) => s.universeKey === universeKey)
    .sort((a, b) => a.lookbackMonths - b.lookbackMonths);
}
