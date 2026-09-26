/**
 * HOW GATI WORKS — the beginner's account, as data.
 *
 * WHAT THIS OWNS
 *   Plain-English explanations of what the app does, grouped into chapters.
 *   Content only; the screen decides how it looks.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT THE METHODOLOGY PAGE
 *
 * `/methodology` already exists and is deliberately unhurried: eleven
 * sections stating not just what happens but why, written for a reader
 * checking the app's work. It is the right page and it is not changing.
 *
 * It is also the wrong first thing to hand somebody who has just installed
 * a momentum app and does not yet know what a benchmark is. This page is
 * for them. Every topic answers in one or two plain sentences, and where a
 * fuller technical account exists, it LINKS to methodology rather than
 * paraphrasing it — two accounts of the same rule drift apart, and the one
 * a reader happens to find becomes the one they believe.
 *
 * THE HARD RULE: nothing here describes behaviour the app does not have.
 * Every claim below is traceable to code — the engine, the session, or the
 * store. Where Gati deliberately does NOT do something (predict, advise,
 * recommend), that is stated too, because a reader's assumption about a
 * financial tool is as dangerous as a false claim in it.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `glossary` attaches an InfoTip so a term can be checked in place.
 * `methodology` deep-links the technical section, e.g. '#what-is-rs'.
 */

export const HOW_IT_WORKS = [
  {
    id: 'start-here',
    title: 'Start here',
    summary: 'What Gati is, and what it deliberately is not.',
    topics: [
      {
        term: 'What Gati is',
        plain:
          'Gati ranks Indian stocks by how strongly they are performing compared with their own benchmark index, and shows you the five leading names in each size category.',
      },
      {
        term: 'The idea behind it',
        plain:
          'Stocks that have been outperforming their index have often kept doing so for a while. Gati measures that, month by month, and never guesses at it.',
        detail:
          'This is called momentum investing. It is a long-studied pattern, not a law — it fails in sharp reversals, and Gati shows you the months it lost as plainly as the months it won.',
      },
      {
        term: 'What Gati does NOT do',
        plain:
          'It does not predict prices, recommend what to buy, or tell you when to sell. It measures what has already happened and shows it clearly.',
        detail:
          'Every number is backward-looking. A stock ranked first is the one that HAS performed best against its benchmark, not the one that will.',
      },
    ],
  },

  {
    id: 'the-ranking',
    title: 'How stocks get ranked',
    summary: 'The one calculation everything else rests on.',
    topics: [
      {
        term: 'Universes',
        plain:
          'Stocks are split into Large Cap, Mid Cap and Small Cap, and never compete across those groups.',
        detail:
          'A small company and a giant one move for different reasons and against different indices. Comparing them directly would rank the volatile one top almost every month.',
      },
      {
        term: 'Benchmark',
        plain: 'Each group is measured against its own index, so a stock is judged against genuine peers.',
        glossary: 'benchmark',
      },
      {
        term: 'Relative Strength',
        plain:
          "The stock's return minus its benchmark's return over the same dates. A positive number means it is ahead of the market it belongs to.",
        detail:
          'Shown with a % sign so it reads plainly. Strictly it is a difference between two percentages, so +18.8% means 18.8 points ahead — not 18.8% more.',
        glossary: 'relativeStrength',
        methodology: 'what-is-rs',
      },
      {
        term: 'Rank',
        plain: 'Every stock in a group is sorted by Relative Strength. Rank 1 is the strongest against its benchmark.',
        glossary: 'rank',
      },
      {
        term: 'Top 5',
        plain: 'The five highest-ranked stocks in each group.',
        glossary: 'topFive',
        methodology: 'selection',
      },
      {
        term: 'Outperformance vs benchmark',
        plain: 'How far ahead of, or behind, its benchmark something finished.',
        detail:
          'Gati calls this outperformance rather than alpha. Formal alpha adjusts for how much risk was taken to earn the excess; this is a plain subtraction, and naming it alpha would claim a rigour it does not have.',
        glossary: 'outperformance',
      },
    ],
  },

  {
    id: 'the-numbers',
    title: 'The numbers on a stock',
    summary: 'What each figure on a stock screen actually means.',
    topics: [
      {
        term: 'Previous month close',
        plain:
          "The closing price from the last trading session of last month. Every monthly figure is measured from it.",
        detail:
          'Not thirty days ago and not the last date on the calendar. Gati reads the last price bar that actually exists in the month, so a month ending on a Saturday or a holiday resolves correctly. The date it used is shown beside the price so you can check it.',
        glossary: 'priorMonthEnd',
      },
      {
        term: "Today's change",
        plain: "How much the price has moved during today's trading session.",
        detail:
          'Shown only when there has genuinely been a session today. On a weekend or an exchange holiday it shows a dash — the last session\'s move is real, but it did not happen today, and presenting it under "Today" would be false.',
        glossary: 'todaysChange',
      },
      {
        term: 'This month',
        plain: 'How much the price has moved since the previous month close.',
      },
      {
        term: 'Trend',
        plain:
          'Whether the stock\'s strength against its benchmark has been improving, holding steady, or weakening over recent months.',
        detail:
          'Deliberately worded as what the number DID, not what it will do. "Bullish" would be a forecast, and Gati does not make forecasts.',
        glossary: 'momentumDirection',
      },
      {
        term: 'Day volume',
        plain: 'The total number of shares traded in the stock so far today.',
        detail:
          'A running total since the opening bell, not a rate. It is shown for context and is never an input to the ranking.',
        glossary: 'dayVolume',
      },
    ],
  },

  {
    id: 'each-month',
    title: 'What happens each month',
    summary: 'Gati reviews once a month, not continuously.',
    topics: [
      {
        term: 'Rebalancing',
        plain:
          'At each month end the rankings are recalculated and a new Top 5 is chosen. That is the only moment the selection changes.',
        glossary: 'rebalance',
        methodology: 'weighting',
      },
      {
        term: 'What changed',
        plain: 'Which stocks joined the Top 5 at the last review, and which dropped out.',
        glossary: 'rebalanceSummary',
      },
      {
        term: 'New entries',
        plain: 'A stock appearing in the Top 5 for the first time at the latest review.',
      },
      {
        term: 'Stocks leaving',
        plain:
          'A stock that was in the Top 5 and is not any more — its strength relative to its benchmark fell behind four others.',
      },
      {
        term: 'Monthly performance',
        plain: 'What the strategy returned in each individual month, next to what the benchmark returned.',
        detail:
          'Both the winning and the losing months are shown. A strategy that only displayed its good months would be a brochure, not a record.',
      },
      {
        term: 'Full stock list',
        plain: 'Every stock in the group, ranked, not just the top five — so you can see where a name you follow actually sits.',
      },
    ],
  },

  {
    id: 'your-money',
    title: 'Tracking your own investment',
    summary: 'Optional, private to this device, and kept entirely separate from the strategy record.',
    topics: [
      {
        term: 'Personal investment tracking',
        plain:
          'You can record what you actually bought — how many shares, at what price, on what date — and Gati values it against the current price.',
        detail:
          'This is yours alone. It never affects the rankings, the Top 5, or the strategy record, which stay independent of how much anybody invested.',
      },
      {
        term: 'Multiple purchases',
        plain:
          'If you buy the same stock more than once, each purchase is kept separately and combined into one holding at its weighted average cost.',
        detail:
          'Weighted by size, not a plain average of the prices: 10 shares at ₹1,000 and 15 at ₹1,100 average to ₹1,060, not ₹1,050.',
      },
      {
        term: 'How gain and loss are worked out',
        plain:
          'Invested is your quantity times what you paid; current value is that same quantity at the latest price. The difference between them is your gain or loss.',
        detail:
          'If no current price is available, Gati shows your cost and says the value is unavailable. It will not mark the holding at cost or at zero — both would be invented numbers.',
        glossary: 'unrealisedPnl',
      },
    ],
  },

  {
    id: 'the-data',
    title: 'Market data and honesty',
    summary: 'When numbers are live, when they are not, and how you can tell.',
    topics: [
      {
        term: 'Market status',
        plain:
          'The dot at the top of every screen shows whether the exchange is trading right now, using the NSE calendar in Indian time.',
        detail:
          'Weekends and exchange holidays are recognised, and the status is worked out from the Indian trading day regardless of where your phone thinks it is.',
      },
      {
        term: 'Data refresh',
        plain:
          'While the market is open, prices refresh every 30 seconds. When it closes, refreshing stops — a shut exchange cannot produce a new price.',
        glossary: 'dataAsOf',
      },
      {
        term: 'When something says "Live"',
        plain:
          'Only when all of four things are true: the exchange is trading, you are online, the data is real, and the newest price is from today.',
        detail:
          'An open market with stale data is the most dangerous case, so it is labelled as delayed rather than live.',
      },
      {
        term: 'Why weekends show no Today %',
        plain:
          'There was no trading session, so there is no move to report. A dash is the honest answer; a zero would claim the stock stood still.',
      },
      {
        term: 'What Gati will never do',
        plain:
          'It never fills a gap with an estimate. If a price is missing, it says so rather than showing a plausible-looking number.',
        methodology: 'data',
      },
      {
        term: 'Survivorship bias',
        plain:
          "The backtest uses today's index members, including for months before some of them joined — which flatters the record.",
        detail: 'Stated because it matters when reading the historical numbers, not buried.',
        glossary: 'survivorshipBias',
        methodology: 'survivorship',
      },
    ],
  },
];

/** Every glossary key referenced, for the orphan check in the test suite. */
export const HOW_IT_WORKS_GLOSSARY_KEYS = HOW_IT_WORKS.flatMap((chapter) =>
  chapter.topics.map((topic) => topic.glossary).filter(Boolean),
);
