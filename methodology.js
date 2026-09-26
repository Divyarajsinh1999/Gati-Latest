/**
 * METHODOLOGY — the calculation, versioned, as data.
 *
 * WHAT THIS OWNS
 *   The version stamp every report carries, and the eleven sections that
 *   explain how Gati arrives at a number.
 *
 * WHAT THIS MUST NEVER DO
 *   Contain logic. It is prose and a version string; config is the
 *   dependency-free leaf, and both the reports and the methodology screen read
 *   from here so they cannot describe the calculation differently.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE VERSION EXISTS   (decision D14.5)
 *
 * If the calculation ever changes, results produced before and after must stay
 * identifiable rather than silently blended. A reader comparing a figure they
 * noted in March against one shown in August needs to know whether the method
 * moved underneath them.
 *
 * This is the same instinct as the D10 revision trail: a figure that changed
 * must be explainable, not merely different.
 *
 * BUMP THE VERSION whenever a change alters a published number — the weighting
 * basis, the price convention, the execution convention, the ranking rule or
 * the tie-break. Do NOT bump it for a display change, a new chart, or a
 * refactor that leaves every figure identical.
 * ═════════════════════════════════════════════════════════════════════════
 */

/**
 * Current methodology version.
 *
 * 2.0 — fractional equal weights (decision D1). Supersedes 1.0, which sized
 *       the historical record on whole shares and therefore reported a
 *       different return at every account size.
 */
export const METHODOLOGY_VERSION = '2.0';

export const METHODOLOGY_HISTORY = [
  {
    version: '2.0',
    from: '2026-08-03',
    summary: 'Historical record uses exact fractional equal weights and is capital-independent.',
    changed: 'Every historical percentage. Whole-share execution moved to the Investment Simulator.',
  },
  {
    version: '1.0',
    from: '2025-01-01',
    summary: 'Historical record sized on whole shares against a notional ₹50,000.',
    changed: 'Original method. Reported return varied with the assumed account size.',
  },
];

/**
 * The eleven sections, in fixed order.
 *
 * `id` is the deep-link anchor, so an inline caveat anywhere in the app can
 * point at the exact paragraph that qualifies it rather than at the top of a
 * long page.
 */
export const METHODOLOGY_SECTIONS = [
  {
    id: 'what-is-rs',
    title: 'What Relative Strength is',
    body: [
      "Gati ranks stocks on one number: the stock's return over a period minus its benchmark index's return over the same period, measured on the same dates.",
      'That subtraction removes the market move, so what is left is the stock outpacing or lagging its own peers rather than simply rising in a rising market.',
      'It is the only ranking input. There is no scoring model on top, no weighting of factors, and nothing hidden — which is what makes every rank checkable from two published numbers.',
    ],
    why: 'A single transparent rule can be verified by the reader. A composite score cannot, and would carry more authority than the evidence supports.',
  },
  {
    id: 'windows',
    title: 'The four measurement windows',
    body: [
      'Returns can be measured over one, three, six or twelve months. Only the measurement period changes; the portfolio still rebalances monthly in every case.',
      'A short window reacts quickly and trades more. A long one is steadier but slower to notice strength fading.',
    ],
    why: 'Neither is correct. They suit different temperaments, and showing all four lets the reader see which window earned its trading rather than being told.',
  },
  {
    id: 'selection',
    title: 'How the Top 5 is chosen',
    body: [
      'At each month-end the whole universe is ranked by Relative Strength, highest first, and the top five are held in equal weight until the next rebalance.',
      'Ties break deterministically: higher RS first, then higher raw return, then alphabetically by symbol.',
    ],
    why: 'Equal weight expresses the only view the strategy has — the ranking. Sizing by conviction would add a judgement the method cannot justify.',
  },
  {
    id: 'execution-convention',
    title: 'Execution convention',
    body: [
      "The signal is taken at the closing price of the last trading day of the month. Trades are priced at the NEXT trading day's open.",
      'A closing price cannot be known before the close, so buying at the same close the decision depended on would use information that did not exist.',
    ],
    why: 'This is the most common way a backtest flatters itself. The one-day gap is what makes the record something a person could actually have traded.',
  },
  {
    id: 'price-basis',
    title: 'Price convention',
    body: [
      'All returns use split- and dividend-adjusted closing prices. Execution uses the unadjusted open of the next session.',
      'Gati refuses to form a ratio from one adjusted and one unadjusted price, returning an error rather than a number.',
    ],
    why: 'A mixed pair across a 1:5 split reports a 5% gain as a 79% crash, and that stock would then rank last permanently. Refusing is safer than flagging.',
  },
  {
    id: 'weighting',
    title: 'Weighting and rebalancing',
    body: [
      'The historical record uses exact fractional equal weights — 20% in each of five picks, with no leftover cash.',
      'Whole-share buying, idle cash and cash drag are real, and they live in the Investment Simulator where you enter your own amount.',
    ],
    why: 'Under whole-share sizing the same signals returned 5.73% at ₹25,000 and 7.89% at a large amount. Publishing one of those as the return would mean picking a number and hoping it matched you.',
  },
  {
    id: 'costs',
    title: 'Transaction costs',
    body: [
      'Brokerage, STT, exchange fees, GST, stamp duty and slippage can be applied as a round trip at every rebalance.',
      'The record shows gross by default, with net available as a toggle.',
    ],
    why: "A monthly strategy pays these twelve times a year. The rates are reasonable estimates rather than your broker's exact schedule, so net figures are indicative.",
  },
  {
    id: 'survivorship',
    title: 'Survivorship bias',
    body: [
      "Gati uses today's index members for historical dates, because historical membership is not freely available for Indian indices.",
      "Today's members are disproportionately the ones that did well — often that is why they were added.",
    ],
    why: 'It biases results upward by an unknown amount. The alternative to this limitation is having no backtest at all, so it is stated plainly wherever a backtest appears.',
  },
  {
    id: 'constituents',
    title: 'Constituent sources',
    body: [
      'Index membership comes from a third-party mirror of the published lists, with structural integrity checks on the expected count.',
      'The date each list was captured is shown in Settings.',
    ],
    why: 'Indices reconstitute semi-annually. A list that has aged quietly is a slow way to be wrong, so its age is visible rather than assumed.',
  },
  {
    id: 'data',
    title: 'Data, freshness and failure',
    body: [
      'Prices refresh every 30 seconds while the market is open and stop when it closes. Historical bars are cached for six hours.',
      'Where a value cannot be verified, Gati says it is unavailable. Nothing is estimated, interpolated, zero-filled or substituted.',
      'A renamed or delisted ticker is flagged with a suggestion; it is never adopted automatically.',
    ],
    why: 'A wrong number shown confidently is not recoverable, because the reader acts on it before anyone notices. An outage is visible; a plausible wrong figure is not.',
  },
  {
    id: 'limitations',
    title: 'Known limitations',
    body: [
      'Data begins in January 2025, so longer windows have few completed rebalances and their statistics are early reads rather than track records.',
      'Five holdings is concentrated, and momentum strategies tend to hold correlated stocks from the same sector at once.',
      'Backtested results assume every trade filled at the next open. Real fills gap, and real liquidity varies.',
    ],
    why: 'Every one of these makes the record look better than live trading would. Saying so is the difference between a research tool and a sales pitch.',
  },
];

export function getMethodologySection(id) {
  return METHODOLOGY_SECTIONS.find((s) => s.id === id) ?? null;
}
