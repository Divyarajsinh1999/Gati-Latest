/**
 * Central, documented assumptions for the momentum engine.
 *
 * Per the project spec's "Price & Return Convention" and "Backtest Execution
 * Safeguard" sections, every convention that affects a number on screen must
 * be written down in ONE place rather than assumed silently inside
 * calculation code. If you change any of these, the change applies
 * everywhere automatically — nothing else in src/engine hardcodes these values.
 */

/** Data history start date (spec Section 4). */
export const DATA_START_DATE = '2025-01-01';

/**
 * Which OHLC field is used for all RETURN / RS calculations.
 * 'adjClose' (split & dividend adjusted) is preferred per spec Section 6.
 * If a provider can't supply adjClose for a symbol, the engine falls back to
 * 'close' and flags a DATA_QUALITY warning rather than silently mixing
 * conventions — see engine/momentum.js.
 */
export const RETURN_PRICE_FIELD = 'adjClose';
export const RETURN_PRICE_FIELD_FALLBACK = 'close';

/**
 * Execution convention (spec Section 15).
 * Signal is measured on the LAST trading day's close of the month.
 * The trade is assumed to fill at the NEXT trading day's price, using the
 * field below — never the signal day's own close — so the backtest can't
 * accidentally use a price that wasn't yet known when the decision was made.
 */
export const EXECUTION_PRICE_FIELD = 'open';

/** Default hypothetical capital per universe (spec Section 12). */
export const DEFAULT_CAPITAL_PER_UNIVERSE = 50_000;

/** Number of stocks selected each month per universe (spec Section 11). */
export const TOP_N = 5;

/**
 * Tie-break rule when two stocks land on the exact same RS value (not
 * specified in the source spec — documented here as an explicit, deterministic
 * assumption per Section 39's "same inputs -> same results" requirement):
 *   1. Higher raw stock return wins
 *   2. Otherwise, alphabetical by symbol
 */
export const TIE_BREAK = 'stockReturn-then-symbol';

/**
 * Rebalancing cash convention (not fully pinned down in the source spec —
 * documented assumption, see engine/backtestEngine.js):
 * proceeds from exiting the previous month's five positions, PLUS any cash
 * carried forward, are pooled into a single portfolio value and re-split
 * equally across the new Top 5. Only the leftover from integer share
 * flooring carries forward as cash — the whole portfolio compounds monthly,
 * it is not reset to a fixed 50,000 every month.
 */
export const REBALANCE_CONVENTION = 'pool-and-resplit';

/** Minimum number of monthly observations before CAGR/Sharpe/Sortino are
 *  shown as meaningful numbers rather than "insufficient period" (spec
 *  Section 18: "CAGR when meaningful for the available period"). */
export const MIN_MONTHS_FOR_CAGR = 6;
export const MIN_MONTHS_FOR_RISK_ADJUSTED = 12;

/** Annualised risk-free rate assumption used for Sharpe/Sortino. This is a
 *  configurable placeholder (approx. recent Indian short-term T-Bill yield) —
 *  update it before relying on these ratios for real decisions. */
export const ANNUAL_RISK_FREE_RATE = 0.065;

/**
 * Transaction costs (spec Section 16). OFF by default so the first backtest
 * shown is gross performance, as the spec explicitly allows.
 *
 * Verified 2026-07-29 against Budget 2026 coverage, Zerodha's published
 * charges, NSE's own SEBI-turnover-fee page, and several broker rate cards:
 *   - sttPct: 0.1% each side for cash-market delivery — Budget 2026 (effective
 *     1 Apr 2026) explicitly left this UNCHANGED; only F&O STT rates rose.
 *   - stampDutyPct: 0.015%, buy-side only — confirmed current, uniform
 *     nationwide since the Finance Act 2019 reform (no more state-by-state
 *     variation for exchange-executed trades).
 *   - sebiFeePct: 0.0001% (₹10/crore) — confirmed directly on nseindia.com.
 *   - gstPct: 18%, applied to (brokerage + exchange charges + SEBI fee) only,
 *     never to STT/stamp duty — confirmed across multiple broker sources.
 *   - exchangeTxnPct: sources disagree in a ~0.003%–0.0035% band (0.00297%,
 *     0.00322%, 0.00345% each appeared in different current rate cards) —
 *     small enough relative to STT/stamp duty that it rarely changes the
 *     bottom line, but shown as a range here rather than false precision.
 *     Using the low end; verify against your own broker's current rate card
 *     before treating net-of-cost numbers as exact.
 */
export const TRANSACTION_COSTS = {
  enabled: false,
  brokeragePct: 0, // many discount brokers charge 0 on equity delivery
  sttPct: 0.1,
  exchangeTxnPct: 0.00297, // reported range across sources: 0.00297%-0.00345%; see note above
  sebiFeePct: 0.0001,
  stampDutyPct: 0.015, // buy-side only
  gstPct: 18,
  slippagePct: 0.05, // assumed slippage per trade — not a published rate, a modelling assumption
};

/**
 * SHORT-TERM CAPITAL GAINS TAX — Section 111A (D22).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 *
 * A monthly rebalance means almost nothing is held for twelve months, so
 * nearly every gain is short-term. For this strategy that is a heavier drag
 * than brokerage, STT and slippage combined — and it was the one cost the app
 * did not show. It can change the verdict rather than just the number: a
 * strategy ahead of its benchmark by 3% gross can be behind it after tax.
 *
 * THE RATE, AND WHY IT CARRIES A DATE
 *
 * Section 111A was 15% for years. The Finance (No. 2) Act, 2024 raised it to
 * 20% for transfers on or after 23 July 2024. Health and education cess of 4%
 * applies on top, giving 20.8% effective for a taxpayer with no surcharge.
 *
 * Roughly half the sources available today still print 15%. They are stale,
 * and a wrong rate here would quietly mis-state every net figure in the app.
 * Hence a dated constant rather than a literal inside a calculation: this has
 * changed once inside two years and will change again.
 *
 * WHAT IS DELIBERATELY NOT MODELLED
 *   - Surcharge (capped at 15% on 111A gains, and income-dependent)
 *   - Long-term gains and the ₹1.25 lakh exemption — a monthly rebalance
 *     essentially never produces them
 *   - Losses carried in from earlier years
 *   - The Section 87A rebate, and everything else specific to a person
 *
 * So this is an ESTIMATE, labelled as one wherever it appears, and Gati never
 * calls it tax advice.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const CAPITAL_GAINS_TAX = {
  enabled: false,

  /** Section 111A, per the Finance (No. 2) Act, 2024. Effective 23 Jul 2024. */
  shortTermPct: 20,
  /** Health and education cess, charged on the tax rather than on the gain. */
  cessPct: 4,

  /** Indian financial year starts in April. 1-indexed month. */
  fiscalYearStartMonth: 4,

  /**
   * Short-term losses are set off against short-term gains within the year.
   *
   * Not an option so much as a correctness requirement: taxing every winner
   * while ignoring every loser overstates the bill substantially — on the
   * measured record it was 87% too high — and reports a cost the investor
   * would never actually pay.
   */
  setOffLossesWithinYear: true,

  /**
   * A year ending in a net loss owes nothing, and that loss is NOT carried
   * forward here, though the law allows eight years if the return is filed on
   * time. Modelling carry-forward would make the figure depend on the
   * reader's filing behaviour, which the app cannot know. Erring toward
   * "worse than reality" is the safer error for a number someone may act on.
   */
  carryLossesForward: false,

  /** Provenance, surfaced in the UI so the reader can check it themselves. */
  source: 'Section 111A, Finance (No. 2) Act 2024 — effective 23 July 2024',
};

/** Semantic colour roles used across the UI — kept here, not re-declared in
 *  components, so Section 30's "consistent semantic colours" holds by
 *  construction. Maps to the CSS custom properties in index.css. */
export const SEMANTIC = {
  gain: 'var(--color-gain)',
  loss: 'var(--color-loss)',
  neutral: 'var(--color-ink-muted)',
  warn: 'var(--color-warn)',
  accent: 'var(--color-gold)',
};

/** Data quality flag types (spec Section 41) — used so every part of the
 *  app renders the same badge/label for the same underlying issue. */
export const DATA_QUALITY_FLAGS = {
  MISSING_DATA: 'Missing Data',
  STALE_PRICE: 'Stale Price',
  INCOMPLETE_MONTH: 'Incomplete Month',
  BENCHMARK_MISSING: 'Benchmark Data Missing',
  PRICE_FIELD_FALLBACK: 'Using Close (Adjusted Close unavailable)',
  SURVIVORSHIP_BIAS: 'Uses current constituents for past dates (survivorship-bias limitation)',
  // Distinct from MISSING_DATA on purpose. MISSING_DATA means "we have this
  // symbol's series but it doesn't cover the dates we need". This means the
  // fetch itself failed for this one symbol — most often a ticker that was
  // renamed or delisted (Indian tickers churn: the 2025 Tata Motors demerger
  // retired TATAMOTORS.NS outright). The distinction matters because the
  // remedy is different: one needs more history, the other needs the symbol
  // corrected in config/universes.js.
  SYMBOL_UNAVAILABLE: 'Symbol unavailable — may have been renamed or delisted',
};


/**
 * THE LIVE REFRESH CADENCE — one number, read by both the poller and the UI.
 *
 * 30 seconds, not lower. Batching (see netlify/functions/quote.js) is what
 * makes 30s safe on a free, unofficial endpoint with no contractual rate
 * limit: it turns a full refresh into ~10 requests rather than 250. Going
 * faster buys little — NSE prices do not change meaningfully faster than
 * this for a monthly-rebalance momentum strategy — while raising the odds of
 * tripping Yahoo's undocumented abuse detection.
 *
 * WHY IT MOVED HERE: the header used to print "15 min" beside data that
 * refreshes every 30 seconds, because the number in the UI and the number in
 * `useUniverseHistory` were unrelated strings. Both now read this constant,
 * so the interface cannot claim a cadence the application does not use.
 */
export const REFRESH_CADENCE_MS = 30 * 1000;

/**
 * How often the session clock is re-evaluated.
 *
 * Independent of the data cadence: this costs no network, and it is what
 * makes the header flip to LIVE at 09:15:xx without a page reload. Kept at
 * 15s so the transition is never more than a quarter-minute late.
 */
export const SESSION_TICK_MS = 15 * 1000;
