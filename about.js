/**
 * ABOUT GATI — the brand statement, as data.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT THIS PAGE MAY AND MAY NOT SAY
 *
 * This is the one screen written in the first person about the product
 * rather than about a number, which makes it the easiest place in the app
 * to over-claim. A reader arriving here is deciding whether to trust Gati
 * with real money.
 *
 * So the constraints are tighter here than anywhere else, and they are
 * enforced by test rather than by intention:
 *
 *   - no promise or implication of returns, ever
 *   - no "beat the market", no "proven", no "risk-free"
 *   - nothing that reads as personalised financial advice
 *   - no claim about what Gati predicts, because it predicts nothing
 *
 * The tone the brief asks for — confident, intelligent, professional — is
 * reachable without any of those. Confidence in a financial tool comes from
 * being precise about what it does and candid about what it does not, not
 * from adjectives.
 * ═══════════════════════════════════════════════════════════════════════
 */

export const GATI_MEANING = {
  script: 'गति',
  transliteration: 'gati',
  language: 'Sanskrit',
  meaning: 'motion, pace, momentum',
};

export const ABOUT_SECTIONS = [
  {
    id: 'what',
    title: 'What Gati is',
    body:
      'Gati is a momentum analysis tool for the Indian equity market. It ranks stocks by how strongly they are performing against their own benchmark index, selects the five leaders in each size category each month, and keeps an honest record of how that selection has done.',
  },
  {
    id: 'why',
    title: 'Why it was built',
    body:
      'Relative strength is a well-documented way of reading a market, but following it properly means month-end discipline, clean data and a lot of arithmetic. Most people who want to invest this way give up somewhere in that process, not because the idea is difficult but because the bookkeeping is.',
  },
  {
    id: 'problem',
    title: 'The problem it solves',
    body:
      'Doing this by hand means downloading prices, finding the right month-end for every stock, comparing each one against the correct index, and repeating it every month without drifting. Gati does that work the same way every time, and shows its inputs so the result can be checked rather than trusted.',
  },
  {
    id: 'philosophy',
    title: 'The philosophy',
    body:
      'A method you follow consistently is worth more than a better method you abandon. Gati is built around a single rule applied on a fixed schedule, with no discretion, no signals, and nothing that changes because a market felt frightening that week.',
  },
  {
    id: 'honesty',
    title: 'On being honest with numbers',
    body:
      'Gati never fills a gap with an estimate. If a price is missing it says so; if data is stale it says that instead of showing a green dot; if the historical record is too short to mean much, it says that too. A financial interface that looks confident when it should not is worse than one that admits the limit.',
  },
  {
    id: 'clarity',
    title: 'On making it understandable',
    body:
      'Every technical term in the app can be tapped for a one-sentence explanation, and every calculation is written out in full under How Gati works. Sophisticated analysis is only useful if the person reading it knows what they are looking at.',
  },
];

/**
 * The one thing on this page that must never be softened.
 *
 * It sits with the brand statement rather than in a footer, because the
 * sentence above it is the most persuasive text in the application and this
 * is the sentence that qualifies it.
 */
export const ABOUT_DISCLAIMER =
  'Gati is an analysis and record-keeping tool, not financial advice. It does not predict prices, recommend what to buy or sell, or account for your circumstances. Past performance says nothing certain about future results, and every investment decision remains yours.';

export const ABOUT_CREDITS = {
  developerLabel: 'Developed by',
  developer: 'Divyarajsinh Parmar',
  contactLabel: 'Contact / feedback',
  email: 'parmardivyarajsinh999@gmail.com',
};
