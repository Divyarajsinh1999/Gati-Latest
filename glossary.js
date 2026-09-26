/**
 * GLOSSARY — plain-language explanations, in two tiers.
 *
 * WHAT THIS OWNS
 *   The words. Every explanation the information icons display.
 *
 * WHAT THIS MUST NEVER DO
 *   Define a term the way a textbook would. Decision D11: every explanation
 *   says how the metric affects a decision INSIDE this methodology — the Top 5,
 *   the monthly rebalance, the benchmark comparison, the Investment Simulator.
 *   The goal is better decisions, not defined terms.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE TWO TIERS, AND WHY
 *
 *   DEFAULT     what · why · inGati — one short sentence each.
 *   LEARN MORE  detail · example · limitations · formula (optional).
 *
 * A single explanation has to choose between the beginner it would overwhelm
 * and the quant it would bore, and it always ends up failing one of them.
 * Splitting lets the default be genuinely short without losing the depth, and
 * the reader picks. THE DEFAULT MUST NEVER OVERWHELM — if it takes more than a
 * glance, it belongs in Learn more.
 *
 * HOUSE STYLE, enforced by test:
 *   - Default fields: one sentence, under 170 characters. No exceptions.
 *   - `inGati` must reference something specific to this product. An entry
 *     that reads identically in any other app has failed principle 2.
 *   - No jargon inside the explanation of jargon.
 *   - `example` uses concrete figures, never "suppose X".
 *   - `limitations` is mandatory. A metric with no stated weakness is being
 *     oversold, and an unqualified number invites more confidence than the
 *     data supports.
 *   - `formula` only where the formula IS the meaning. RS is a subtraction and
 *     showing it clarifies; Sharpe's denominator helps nobody decide anything.
 *   - No exclamation marks, no reassurance, no false cheer.
 * ═════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {object} LearnMore
 * @property {string} detail       a fuller explanation
 * @property {string} example      concrete numbers, not hypotheticals
 * @property {string} limitations  where it misleads — mandatory
 * @property {string} [formula]    only where the formula is the meaning
 *
 * @typedef {object} GlossaryEntry
 * @property {string} term
 * @property {string} what     one short sentence
 * @property {string} why      one short sentence
 * @property {string} inGati   one short sentence, specific to this product
 * @property {LearnMore} [learnMore]
 * @property {string} [seeAlso]
 * @property {string} [methodology]
 */

/** @type {Record<string, GlossaryEntry>} */
export const GLOSSARY = {
  /* ---------------- The core idea ---------------- */

  relativeStrength: {
    term: 'Relative Strength',
    what: 'How strongly a stock is performing compared with its benchmark.',
    why: 'A stock up 8% is only impressive if the market did not do better.',
    inGati: 'Gati ranks every stock by this one number, and the top five become the portfolio for the coming month.',
    learnMore: {
      detail:
        'Both returns cover the same window and the same dates, so the market move cancels out and what remains is the stock outpacing or lagging its peers. It is the only ranking input Gati uses — there is no scoring model layered on top and nothing hidden to reverse-engineer.',
      example:
        'A stock rises 18.6% while NIFTYBEES falls 0.2%. Its Relative Strength is +18.8%, near the top of the large-cap list.',
      limitations:
        'It says nothing about valuation, quality, or why the stock moved — a stock can rank first because it rebounded from a collapse. It also looks backwards: strength that already happened is not a promise of more.',
      formula: 'RS = stock return % − benchmark return %',
      note: 'Shown with a % sign so it reads plainly as "this much ahead of the benchmark". Strictly it is a difference between two percentages, so read +18.8% as 18.8 points ahead rather than as 18.8% more.',
    },
    seeAlso: 'benchmark',
    methodology: 'what-is-rs',
  },

  benchmark: {
    term: 'Benchmark',
    what: 'The index a stock is measured against.',
    why: 'Compare against the wrong index and you learn about the market, not the stock.',
    inGati: 'Each universe uses its own — NIFTYBEES for large caps, Midcap 150 for mid, Smallcap 250 for small — and they are never mixed.',
    learnMore: {
      detail:
        'Small caps and large caps move on different cycles. Measuring a small cap against a large-cap index would make it look brilliant in a small-cap rally and hopeless in a large-cap one, without the stock itself changing at all.',
      example:
        'In a month where the Smallcap 250 rose 6%, a small cap up 5% has negative Relative Strength: it lagged its own peers even though it made money.',
      limitations:
        'An index-relative view cannot tell you whether the market itself is worth being in: in a falling market it simply rewards the least-bad stock, which may still be down heavily.',
    },
    methodology: 'benchmarks',
  },

  rank: {
    term: 'Rank',
    what: 'Where a stock sits when the universe is sorted by Relative Strength.',
    why: 'Rank is what the strategy acts on — not price, not size, not popularity.',
    inGati: 'Ranks are rebuilt from scratch at each month-end; the top five are bought and everything below is ignored.',
    learnMore: {
      detail:
        'Ranking is a total order with deterministic tie-breaks — higher RS first, then higher raw return, then alphabetically — so the same data always produces the same list on any machine.',
      example: 'A stock at rank 1 in June can sit at rank 80 in July. That is the strategy working, not a fault.',
      limitations:
        'Rank says nothing about absolute return. In a weak month the top-ranked stock may have lost money and simply lost less than its index.',
    },
  },

  topFive: {
    term: 'Top 5',
    what: 'The five stocks with the highest Relative Strength in this universe.',
    why: 'These are the stocks the strategy would hold right now.',
    inGati: 'Chosen at each month-end and held in equal weight until the next rebalance — this is the whole output of the method.',
    learnMore: {
      detail:
        'Equal weight, five names, one universe. Gati does not size by conviction or volatility: every pick gets the same share, because the ranking already expressed the only view the strategy has.',
      example: 'At ₹50,000 that is ₹10,000 per stock before whole-share rounding.',
      limitations:
        'Five stocks is concentrated: one bad name is a fifth of the portfolio, and momentum strategies do not diversify by design — they often hold correlated stocks from the same sector at once.',
    },
  },

  lookbackWindow: {
    term: 'Measurement window',
    what: 'How far back returns are measured when ranking: 1, 3, 6 or 12 months.',
    why: 'A short window reacts quickly; a long one is steadier but slower to notice fading strength.',
    inGati: 'Changing it re-ranks everything instantly, but the portfolio still rebalances monthly either way.',
    learnMore: {
      detail:
        'Only the measurement period changes, never the trading cadence. A 3-month window means rank on three months of relative return and rebalance monthly, which is the conventional reading of 3-month momentum.',
      example: 'A stock that surged last month but drifted for six will rank high on 1M and poorly on 6M.',
      limitations:
        'Gati has data from January 2025, so longer windows have far fewer completed rebalances behind them. A 12-month record here is a handful of cycles, not a history.',
    },
    seeAlso: 'thinSample',
  },

  rebalance: {
    term: 'Rebalance',
    what: 'The monthly point where the strategy re-ranks, sells what dropped out and buys what entered.',
    why: 'Momentum fades, and rebalancing is how the rule lets go without you having to decide.',
    inGati: "The signal is taken at the month-end close; trades are priced at the next trading day's open.",
    learnMore: {
      detail:
        'That one-day gap is deliberate. A closing price cannot be known before the close, so a backtest that buys at the same close it ranked on is using information that did not exist — the most common way a backtest flatters itself.',
      example:
        'March 2025 ranked on the 28th, because the 31st was a holiday and no trading happened. Execution priced at the next open.',
      limitations:
        'The next open can gap well away from the close that triggered the signal, so real results differ from any backtest for this reason alone.',
    },
    methodology: 'execution-convention',
  },


  rebalanceTiming: {
    term: 'Rebalance timing',
    what: 'The date the current holdings were selected, and when the next review falls.',
    why: 'A monthly strategy only acts once a month; the rest of the time there is nothing to do.',
    inGati: 'Quiet context, never a countdown. The ranking above is live and can still change; the strategy acts at the month-end close.',
    learnMore: {
      detail:
        'The next review is the last trading day of the current month, counted from the actual price series rather than the calendar, so weekends and market holidays are handled without a holiday list. The Top 5 you are holding stays put until then; the Top 5 on screen is the ranking as it stands today and moves with prices.',
      example: 'Last rebalanced 31 Jul, next review 29 Aug — 18 trading sessions away.',
      limitations: 'The count is only as current as the price data behind it; if the newest bar is stale, so is the remaining-days figure.',
    },
    seeAlso: 'rebalance',
  },

  positionStatus: {
    term: 'Held, new, or dropped',
    what: 'Whether a stock was already in the Top 5 last month, has just entered, or has just left.',
    why: 'It is the difference between a position you keep and a trade you would place.',
    inGati: 'Derived by comparing the last two completed rankings — Gati reports what the strategy did, never what you should do.',
    learnMore: {
      detail:
        'Two names entering means two buys and two sells at the rebalance. Gati supplies the facts and the arithmetic; the decision stays yours, because a Relative Strength ranking cannot support a recommendation and should not imply one.',
      example: '3 held and 2 new means 2 buys and 2 sells at the rebalance, not 5 of each.',
      limitations: 'It compares completed rebalances only. A stock climbing fast mid-month shows no status change until the next month-end signal.',
    },
    seeAlso: 'rebalance',
  },

  momentumAge: {
    term: 'Momentum Age',
    what: 'How many consecutive monthly rebalances a stock has held its place in the Top 5.',
    why: 'A rank cannot tell you whether momentum just started or has been running for months.',
    inGati: 'Counted from completed rebalances only, and reset the moment a stock drops out of the Top 5 even once.',
    learnMore: {
      detail:
        'Newly emerging momentum is less established and more easily noise; a long run is more established and, on the same evidence, closer to whatever mean reversion eventually arrives. The number does not say which is better — it says which situation you are looking at, which a rank alone hides.',
      example: 'A stock showing 4 months has led its universe at four consecutive month-ends; a new entrant shows 1.',
      limitations:
        'It is a fact about the strategy\'s own history, not a signal, and it says nothing about what happens next. It also cannot exceed the number of completed rebalances, which is small on the short history available.',
    },
    seeAlso: 'rebalance',
  },

  rebalanceSummary: {
    term: 'This month\'s changes',
    what: 'How many stocks entered the Top 5, how many continued, and how many left.',
    why: 'It is the difference between a quiet month and a wholesale turnover.',
    inGati: 'Taken from comparing the last two completed rankings, so entries and exits always pair up at a rebalance.',
    learnMore: {
      detail:
        'High turnover means the strategy would have traded most of the portfolio, which costs more in brokerage and slippage than a month where three names simply stayed put.',
      example: '2 entered, 3 continuing, 2 left: two buys and two sells, not five of each.',
      limitations: 'It counts only completed rebalances, so a stock climbing fast mid-month shows nothing here until the next month-end signal.',
    },
    seeAlso: 'positionStatus',
  },

  momentumDirection: {
    term: 'Momentum direction',
    what: 'Whether a stock\'s Relative Strength has risen, held steady or fallen across recent rebalances.',
    why: 'A single rank cannot tell you whether a stock is gaining ground or losing it.',
    inGati: 'Derived only from the trailing RS history already shown — it describes what happened, and Gati has no view on what happens next.',
    learnMore: {
      detail:
        'Improving means relative strength rose across the months observed; Weakening means it fell. Stable means the change was too small to distinguish from month-to-month wobble on three data points — an honest reading, not a hedge.',
      example: 'A stock going +2%, +5%, +9% reads as Improving. One going +6%, +4%, +6% reads as Stable.',
      limitations:
        'It is descriptive, never predictive, and it is not a buy or sell instruction. Three points cannot establish a shape, so a stock that fell then recovered reads as Stable rather than as a reversal.',
    },
    seeAlso: 'momentumAge',
  },

  methodologyVersion: {
    term: 'Methodology version',
    what: 'Which version of the calculation produced the figures on this report.',
    why: 'If the method changes, results from before and after should not be silently blended.',
    inGati: 'Stamped on every Gati report, so a figure you noted months ago stays comparable with the strategy record shown today.',
    learnMore: {
      detail:
        'The version is bumped only when a change alters a published number — the weighting basis, the price or execution convention, the ranking rule or the tie-break. A new chart or a refactor that leaves every figure identical does not bump it.',
      example: 'Version 2.0 moved the record to exact fractional equal weights, which changed every historical percentage from version 1.0.',
      limitations: 'It tells you the method differed; it cannot restate an old figure under the new method, because the old figure was not kept.',
    },
    seeAlso: 'capitalIndependent',
  },

  /* ---------------- Performance ---------------- */

  totalReturn: {
    term: 'Total return',
    what: 'What the strategy gained or lost across the whole period shown.',
    why: 'The simplest measure of whether the method made money.',
    inGati: 'Shown as a percentage with no rupee figure, because the record does not assume any account size.',
    learnMore: {
      detail:
        'Compounded across every completed rebalance on exact equal weights, so it describes the strategy itself rather than one particular investor running it.',
      example: 'Six rebalances of roughly +3.5% each compound to about +23%, not +21%.',
      limitations:
        'A single number hides the path. Two strategies with the same total return can have had completely different drawdowns along the way.',
    },
    seeAlso: 'capitalIndependent',
  },

  benchmarkReturn: {
    term: 'Benchmark return',
    what: 'What the index itself did over the same period, with no stock-picking.',
    why: 'You could have bought the index instead, cheaply and with no effort.',
    inGati: 'Shown beside the strategy return on every universe screen, because that pair is the whole verdict.',
    learnMore: {
      detail:
        'Measured on the same dates and the same adjusted-price basis as the strategy, so the comparison is like for like rather than an approximation.',
      example: 'Strategy +21.3%, benchmark +9.9% — the strategy added 11.4 points.',
      limitations:
        'An index fund has costs too, though far lower ones. And a strategy beating its index in a rising market has not yet been tested by a falling one.',
    },
  },

  outperformance: {
    term: 'Outperformance',
    what: 'How much more — or less — the strategy gained than its benchmark.',
    why: 'It answers the only question that matters: did the effort beat doing nothing?',
    inGati: 'This is the headline figure on every universe screen, because it is the verdict on the method.',
    learnMore: {
      detail:
        'It is a subtraction, not a ratio: +11.4% here means the strategy finished 11.4 points of return ahead of the benchmark, not that it earned 11.4% more than it did. It is also NOT alpha in the formal sense, which adjusts for how much market risk was taken; Gati shows the plain difference and calls it that.',
      example: 'Strategy +21.3%, benchmark +9.9%, outperformance +11.4%.',
      limitations:
        'Positive outperformance over a short period can be luck, and it ignores whether the extra return arrived with far more volatility.',
      formula: 'Outperformance = strategy return % − benchmark return %',
    },
    seeAlso: 'benchmark',
  },

  cagr: {
    term: 'CAGR',
    what: 'The one steady yearly rate that would have produced the same result.',
    why: 'It makes periods of different lengths comparable at a glance.',
    inGati: 'Useful once there are a few years of rebalances; treat it cautiously on the short history available today.',
    learnMore: {
      detail:
        'A smoothed rate, not what any single year looked like. It answers what constant annual return would land in the same place, which is a fair summary and a poor description.',
      example: 'A 30% gain over three years is about 9.1% a year compounded, not 10%.',
      limitations:
        'Over a period shorter than a year it is an extrapolation, and annualising a good few months makes them look like a good decade. Gati has data from January 2025, so read it with real caution.',
      formula: 'CAGR = (end ÷ start) ^ (1 ÷ years) − 1',
    },
    seeAlso: 'thinSample',
  },

  /* ---------------- Risk ---------------- */

  maxDrawdown: {
    term: 'Maximum drawdown',
    what: 'How far the strategy fell from its highest point before recovering.',
    why: 'This is the pain you would have had to sit through.',
    inGati: 'The best guide to whether you could have held this strategy long enough to get its return.',
    learnMore: {
      detail:
        'Most people abandon a strategy during a drawdown rather than because of a bad final number — so a strategy you cannot hold has an effective return of whatever it had when you quit.',
      example: 'A 20% maximum drawdown means ₹1,00,000 fell to ₹80,000 at some point before recovering.',
      limitations:
        'It reports only the single worst episode and says nothing about how long recovery took. A short sample has probably not yet seen its worst.',
    },
  },

  volatility: {
    term: 'Volatility',
    what: 'How much the monthly returns swing up and down from month to month.',
    why: 'Two strategies can reach the same place by very different roads.',
    inGati: 'A concentrated five-stock momentum portfolio is usually bumpier than the index it is measured against.',
    learnMore: {
      detail: 'Computed from monthly returns and expressed as an annual figure, so it is comparable with quoted market volatility.',
      example: 'Annual volatility of 14% means monthly moves of a few percent in either direction are ordinary.',
      limitations:
        'It counts upward moves as risk, which few investors mind. Read it beside maximum drawdown, which counts only the falls.',
    },
    seeAlso: 'maxDrawdown',
  },

  sharpe: {
    term: 'Sharpe ratio',
    what: 'How much return the strategy earned for the ups and downs it put you through.',
    why: 'It stops an erratic strategy looking good purely because it ended high.',
    inGati: 'Most useful for comparing the same universe across measurement windows — which window earned its swings.',
    learnMore: {
      detail: 'Two strategies with identical returns are not equal if one got there far more erratically. Sharpe puts them on the same footing.',
      example: 'Above 1 is generally considered good; below 0.5 suggests the returns did not justify the ride.',
      limitations:
        'It needs many months to mean anything, and Gati has a short history. It also penalises sharp gains as though they were risk, which is why Sortino sits beside it.',
    },
    seeAlso: 'sortino',
  },

  sortino: {
    term: 'Sortino ratio',
    what: 'Like Sharpe, but it only counts the falls as risk — not the rises.',
    why: 'Nobody minds a strategy rising sharply; they mind it falling sharply.',
    inGati: 'Usually the fairer of the two for a five-stock momentum portfolio, which produces occasional large gains.',
    learnMore: {
      detail: 'It asks how much return you got for the losses you had to endure, ignoring upside swings entirely.',
      example: 'A Sortino of 1.9 against a Sharpe of 1.3 means most of the movement was upward, not painful.',
      limitations: 'Same caution as Sharpe — on a short track record it is a hint, not a verdict.',
    },
    seeAlso: 'sharpe',
  },

  /* ---------------- Consistency ---------------- */

  winRate: {
    term: 'Win rate',
    what: 'The share of completed months that finished with a gain.',
    why: 'A strategy can be profitable overall while losing most months.',
    inGati: 'Tells you what a typical month feels like, which matters for whether you keep going between rebalances.',
    learnMore: {
      detail: 'Momentum strategies often win less than half the time and still make money, because the winners run further than the losers fall.',
      example: 'Nine wins from fifteen months is a 60% win rate.',
      limitations: 'It ignores size entirely. Many small wins and one severe loss can still add up to a loss.',
      formula: 'Win rate = winning months ÷ completed months',
    },
    seeAlso: 'worstMonth',
  },

  monthsWon: {
    term: 'Months won',
    what: 'How many completed rebalances finished with a gain.',
    why: 'Gives a feel for consistency that a total return cannot.',
    inGati: 'Counted only from completed rebalances — the in-progress month is never included.',
    learnMore: {
      detail: 'A completed rebalance has both an entry and an exit. Open positions are shown separately and never counted as history.',
      example: '9 wins from 15 completed rebalances means 6 months finished lower.',
      limitations: 'Small numbers on a short track record. Do not read a pattern into a handful of months.',
    },
    seeAlso: 'winRate',
  },

  monthsLost: {
    term: 'Months lost',
    what: 'How many completed rebalances finished with a loss.',
    why: 'Losing months are normal; what matters is whether they were shallow or severe.',
    inGati: 'Read beside the worst month figure to see which kind this strategy produces.',
    learnMore: {
      detail: 'A high count with a mild worst month is a very different proposition from a low count with a severe one.',
      example: 'Six losing months whose worst was −4% is far easier to hold than two whose worst was −18%.',
      limitations: 'It says nothing about the order they arrived in. Three consecutive losses feel worse than six scattered ones.',
    },
    seeAlso: 'worstMonth',
  },

  bestMonth: {
    term: 'Best month',
    what: 'The largest single-month gain in the period.',
    why: 'Shows how much of the total came from one good stretch.',
    inGati: 'If it dominates the total return, the record rests on one month rather than on steady performance.',
    learnMore: {
      detail: 'Momentum returns are often concentrated in a few strong months, so this figure is usually large relative to the average.',
      example: 'A +14% month inside a +21% total means most of the period came from four weeks.',
      limitations: 'One exceptional month is not repeatable and should never be projected forward.',
    },
  },

  worstMonth: {
    term: 'Worst month',
    what: 'The largest single-month loss in the period.',
    why: 'A realistic preview of a bad month, easier to picture than a volatility figure.',
    inGati: 'The most useful honesty check before committing: would you have placed the next rebalance after this one?',
    learnMore: {
      detail: 'Because the strategy holds only five stocks, a bad month here tends to be worse than the index had.',
      example: 'A −9% month on ₹50,000 is roughly ₹4,500 gone in four weeks.',
      limitations: 'The worst month so far is not the worst possible. A short history has probably not seen a real market shock.',
    },
    seeAlso: 'maxDrawdown',
  },

  /* ---------------- Investment Simulator ---------------- */

  executionEfficiency: {
    term: 'Execution efficiency',
    what: 'The share of your money that actually ends up invested.',
    why: 'You cannot buy a third of a share, so some money always stays behind.',
    inGati: 'Shown only in the Investment Simulator once you enter an amount — the strategy record never assumes one.',
    learnMore: {
      detail:
        'Each of the five slots buys whole shares and the remainder sits in cash. Efficiency rises as your amount grows, because the leftovers become a smaller share of the total.',
      example: 'A ₹10,000 slot buying a ₹3,500 share takes two shares for ₹7,000 and leaves ₹3,000 idle — 70% efficient in that slot.',
      limitations: 'It measures deployment, not quality. Fully invested in five weak stocks is 100% efficient and still a poor month.',
      formula: 'Efficiency = invested ÷ amount entered',
    },
    seeAlso: 'cashDrag',
  },

  cashDrag: {
    term: 'Cash drag',
    what: 'The return you lose because some money could not be invested.',
    why: 'Idle cash does not participate in the strategy at all.',
    inGati: 'At smaller amounts this is why your result trails the strategy figure, and Gati shows exactly what it costs.',
    learnMore: {
      detail:
        'This is why the historical record uses exact equal weights and no assumed account size. Publishing a whole-share return would bake one investor’s cash drag into everyone’s track record.',
      example:
        'Measured on real signals: at ₹25,000 an average 20.6% of capital sat idle and the return came in 2.15 points below the strategy. At ₹5,00,000 the gap nearly vanished.',
      limitations: 'It shifts with the prices of whichever stocks rank top that month, so it is not stable from one rebalance to the next.',
    },
    seeAlso: 'executionEfficiency',
  },

  idleCash: {
    term: 'Idle cash',
    what: 'Rupees left over after buying whole shares.',
    why: 'It is real money you still hold, but it is not working.',
    inGati: 'Carried forward to the next rebalance rather than discarded, so nothing is lost — only unused.',
    learnMore: {
      detail: 'Shown per position as well as in total, so you can see which holding is causing it.',
      example: 'Five slots of ₹10,000 that invest ₹9,262 leave ₹738 idle.',
      limitations: 'Small leftovers are unavoidable. Large ones mean your amount is small relative to this universe’s share prices.',
    },
    seeAlso: 'minimumViableCapital',
  },

  minimumViableCapital: {
    term: 'Minimum for full execution',
    what: 'The smallest amount at which all five picks are affordable.',
    why: 'Below it, at least one position cannot be bought at all.',
    inGati: 'Under this figure you are running four fifths of the strategy, not the strategy.',
    learnMore: {
      detail: 'Set by the most expensive share in the current top five, because equal weighting means every slot has to clear that price.',
      example: 'If the priciest pick is ₹3,500, full execution needs ₹17,500.',
      limitations: 'It changes every month as the picks change, and small caps can include some surprisingly expensive shares.',
    },
  },

  idealVsExecutable: {
    term: 'Ideal vs your amount',
    what: 'The gap between the strategy on paper and what you could actually have bought.',
    why: 'The record deliberately ignores account size; this puts yours back in.',
    inGati: 'The same signals re-run with whole-share rounding at your figure — nothing else changes.',
    learnMore: {
      detail:
        'Because every other input is identical, the entire difference is attributable to lot sizes. That makes it a clean answer to whether your amount is big enough for this strategy.',
      example: 'Strategy +7.89%, your ₹25,000 +5.73% — a 2.16 point shortfall, all of it cash drag.',
      limitations: 'It uses the same historical signals, so it is still a backtest and cannot account for slippage, liquidity, or the trades you would actually have placed.',
    },
    seeAlso: 'cashDrag',
  },

  capitalIndependent: {
    term: 'Why there are no rupee figures here',
    what: 'The historical record is shown in percentages, with no assumed investment amount.',
    why: 'Whole-share buying makes the same strategy report different returns at different account sizes.',
    inGati: 'Enter an amount in the Investment Simulator to see what your own money would have done.',
    learnMore: {
      detail:
        'Measured on identical signals: 5.73% at ₹25,000 against 7.89% at a large amount, from lot sizes alone. Publishing one of those as the return would mean picking a number and hoping it matched you.',
      example: 'The percentages here are the strategy itself, unaffected by whether you would invest ₹25,000 or ₹25,00,000.',
      limitations: 'The record will therefore flatter most real accounts slightly, because it cannot know your amount; the Simulator exists to close that gap rather than hide it.',
    },
    seeAlso: 'idealVsExecutable',
  },

  /* ---------------- Costs ---------------- */

  liquidity: {
    term: 'Liquidity',
    what: 'How much of a normal day\u2019s trading your position would represent.',
    why: 'A position worth a large slice of a day\u2019s turnover moves the price against you when you sell.',
    inGati: 'Gati flags this on the stock screen once a holding passes 1% of the last session\u2019s traded value.',
    learnMore: {
      detail:
        'Shares traded is not comparable across stocks: 10,000 shares of a 400-rupee stock and 10,000 of a 4,000-rupee stock are two completely different markets. Gati measures traded VALUE, which is what your order actually competes for. It matters far more in smallcaps than in the NIFTY 50, and far more at large amounts than small ones.',
      example:
        'A 5,00,000-rupee holding in a stock trading 40 lakh a day is 12.5% of the session. Getting out could take several days, or a worse price today.',
      limitations:
        'Based on the latest session only, not an average \u2014 a quiet day understates liquidity and a news day overstates it. It cannot predict the day you actually sell, and says nothing about spreads or market depth.',
    },
  },

  sectorConcentration: {
    term: 'Sector concentration',
    what: 'How many of the current Top 5 come from the same industry — banks, IT, pharma and so on.',
    why: 'Momentum does not spread risk: when one part of the market runs, the ranking fills with it.',
    inGati: 'A line under the Top 5 names the largest group, and turns amber at three or more of five.',
    learnMore: {
      detail:
        'Relative Strength ranks on price movement alone and knows nothing about industries, so nothing stops all five picks landing in one. Three of five in banks is not a momentum portfolio, it is a bet on banks — which may be exactly what you want, provided you know you are holding it.',
      example:
        'A Top 5 of 3 Financials, 1 IT and 1 Auto puts 60% of the portfolio in one group, so a single bad quarter for banks moves most of it at once.',
      limitations:
        'Labels come with the constituent list and are broad; two companies under one label can behave very differently. Stocks whose industry is unknown are counted separately and never folded into a category.',
    },
  },

  underwaterDuration: {
    term: 'Longest underwater',
    what: 'The most months the record spent below its previous high before recovering.',
    why: 'Depth is what gets quoted; time is what gets endured, and long stretches are what make people quit.',
    inGati: 'Sits beside max drawdown in the strategy record, and says whether it has recovered or is still down.',
    learnMore: {
      detail:
        'Max drawdown says how far the record fell. This says how long it stayed down. A 20% fall that recovers in two months is very different from 6% that grinds on for eight, even though the first looks worse on paper.',
      example:
        'A record peaking at 130 in January, drifting to 118 by August and only passing 130 again in September was underwater for 8 months — even though it never fell more than 9%.',
      limitations:
        'Measured in completed rebalances, so with a short record the longest stretch may simply be most of the record. It says nothing about how long a future drawdown would last.',
    },
  },

  capitalGainsTax: {
    term: 'Capital gains tax',
    what: 'Tax on your profit when you sell — 20.8% of net gains if held under a year.',
    why: 'Rebalancing monthly makes almost every gain short-term, so this is the biggest cost the strategy pays.',
    inGati: 'The strategy record always shows an after-tax line under the headline, whatever Settings says.',
    learnMore: {
      detail:
        'Losses are set off against gains within the same financial year (1 April to 31 March), so a losing month reduces the bill rather than being ignored. A year ending in a net loss owes nothing, and Gati does not carry that loss into the next year even though the law allows eight years of carry-forward — which makes the estimate err high rather than low.',
      example:
        'Gains of 30,000, a loss of 12,000 and a gain of 10,000 in one year net to 28,000. Tax is 20% of that plus 4% cess: 5,824. Taxing each winner and ignoring the loser would give 8,320 — nearly half as much again.',
      limitations:
        'An estimate, not tax advice. It excludes surcharge, the Section 87A rebate, long-term gains and their exemption, losses carried in from earlier years, and everything specific to you. Rates change: this one changed in July 2024, and many websites still print the old 15%.',
    },
  },

  transactionCosts: {
    term: 'Transaction costs',
    what: 'Brokerage, STT, exchange fees, GST, stamp duty and slippage on every trade.',
    why: 'A strategy that trades monthly pays these twelve times a year.',
    inGati: 'Toggle them on to see net performance; the record shows gross by default so the two are never confused.',
    learnMore: {
      detail:
        'Applied as a round trip at each rebalance — once to exit the old five, once to enter the new. Monthly rebalancing makes this materially larger than for buy-and-hold.',
      example: 'Roughly 0.2–0.4% per round trip, which over twelve rebalances is a real bite out of an annual return.',
      limitations: 'The rates are reasonable estimates, not your broker’s exact schedule, so treat net figures as indicative.',
    },
    seeAlso: 'grossVsNet',
  },

  slippage: {
    term: 'Slippage',
    what: 'The small difference between the price you expected and the price you actually got.',
    why: 'Real orders rarely fill exactly where you saw them.',
    inGati: 'Included in the cost model because the strategy executes at the open, when spreads are widest.',
    learnMore: {
      detail: 'Wider in small caps than large caps, and wider again at the open than mid-session.',
      example: 'A 0.05% assumption on a ₹10,000 order is ₹5 each way.',
      limitations: 'A single fixed percentage cannot capture how much worse this gets in illiquid small caps or volatile markets.',
    },
  },

  grossVsNet: {
    term: 'Gross vs net',
    what: 'Gross ignores trading costs; net subtracts them.',
    why: 'Gross shows whether the idea works; net shows whether it survives a broker.',
    inGati: 'Check net before concluding a window is worth running — the gap widens the more often it trades.',
    learnMore: {
      detail: 'The 1-month window trades most and is hit hardest; the 12-month window is affected far less by the same assumptions.',
      example: 'A 21.3% gross return might be roughly 17–18% net after twelve monthly round trips.',
      limitations: 'Net figures depend on cost assumptions you can change in Settings, so they are only a model and will not match your contract note exactly.',
    },
    seeAlso: 'transactionCosts',
  },

  /* ---------------- Data honesty ---------------- */

  adjustedClose: {
    term: 'Adjusted close',
    what: 'A past closing price adjusted so splits and dividends do not look like real moves.',
    why: 'Without it, a 1:5 split would look like an 80% crash.',
    inGati: 'Every return and every ranking uses adjusted prices, so corporate actions never masquerade as performance.',
    learnMore: {
      detail:
        'Gati refuses to form a ratio from one adjusted and one unadjusted price, returning an error rather than a number — a mixed pair would report a 5% gain as a 79% fall and rank that stock last permanently.',
      example: 'A ₹2,500 share splitting 1:5 becomes ₹500; adjusted history restates the earlier prices to match.',
      limitations: 'Providers restate adjusted history retroactively, so a figure you noted last month may change later without any error having occurred.',
    },
    seeAlso: 'corporateAction',
  },

  corporateAction: {
    term: 'Corporate action',
    what: 'A split, bonus or dividend that changes a price mechanically rather than through performance.',
    why: 'Providers restate past prices when one occurs, quietly changing figures you already saw.',
    inGati: 'When a past month changes, Gati names the month and keeps a record of what it previously showed.',
    learnMore: {
      detail:
        'Completed month-ends are frozen and compared on every recompute. A changed selection is flagged as more serious than a restated value, because it means the strategy would have bought something different.',
      example: 'A note reading "March 2025: relative-strength values have been restated for TITAN", with the earlier figures still on record.',
      limitations: 'The provider never tells us an action occurred, so the cause is stated as the most likely explanation rather than an observed fact.',
    },
  },

  survivorshipBias: {
    term: 'Survivorship bias',
    what: 'Testing a strategy on the companies in the index TODAY, including years before some of them joined.',
    why: "Today's members are disproportionately the ones that did well.",
    inGati: 'Gati uses current constituent lists and labels this wherever a backtest appears — the record is indicative, not exact.',
    learnMore: {
      detail:
        'Historical index membership is not freely available for Indian indices, so the alternative to this limitation is having no backtest at all. Stating it plainly is the honest compromise.',
      example: 'A stock added to the Midcap 150 in 2026 still appears in the January 2025 ranking, though it was not a member then.',
      limitations: 'It biases results upward by an unknown amount. Treat outperformance figures as flattering rather than precise.',
    },
  },

  thinSample: {
    term: 'Thin sample',
    what: 'There have been too few months so far for these statistics to mean much yet.',
    why: 'Seven rebalances is an early read, not a track record.',
    inGati: 'Gati still shows the figures with their rebalance count beside them, rather than hiding them or dressing them up.',
    learnMore: {
      detail: 'Ratios like Sharpe and Sortino are least reliable on short samples, because one unusual month moves them a long way.',
      example: 'A 12-month window on data starting January 2025 has only a handful of completed cycles behind it.',
      limitations: 'There is no threshold at which a sample becomes definitively sufficient. More months help; they never fully settle it.',
    },
    seeAlso: 'lookbackWindow',
  },

  lookAheadBias: {
    term: 'Look-ahead bias',
    what: 'A backtest that peeked at information nobody had yet when the decision was made.',
    why: 'It is the most common way a backtest lies.',
    inGati: "Signals are taken at the month-end close and executed at the next day's open, so no trade uses an unknowable price.",
    learnMore: {
      detail:
        'Buying at the same closing price the decision depended on manufactures a profit nobody could have captured. Gati resolves the execution day from the trading calendar and prices at the open.',
      example: 'A March signal at the 28th close executes at the 31st open, not the 28th close.',
      limitations: 'Avoiding look-ahead does not remove other backtest weaknesses — survivorship bias and cost assumptions remain.',
    },
    methodology: 'execution-convention',
  },

  dataAsOf: {
    term: 'Data as of',
    what: 'The date of the most recent price data in view.',
    why: "Tells you whether you are seeing today's market or a stale snapshot.",
    inGati: 'During market hours this should be today; if it is older, Gati says so rather than implying the figures are live.',
    learnMore: {
      detail: 'Prices refresh every 30 seconds while the market is open and stop entirely when it closes, because there is nothing new to fetch.',
      example: '"Market open · Live · Data as of 3 Aug" versus "Offline · showing data from 2 Aug, 15:31".',
      limitations: 'A fresh timestamp confirms the fetch succeeded, not that every one of the 453 symbols returned.',
    },
  },

  /**
   * THE TWO COLUMNS THAT HAD NO EXPLANATION (owner, 27 Aug 2026).
   *
   * Every other figure in the ranking table carried an icon. "Stock %" and
   * "Price" did not — the two a beginner is most likely to read first, and
   * the two most easily misread: a month-to-date figure mistaken for a day
   * move, and a price mistaken for a live one when the market is shut.
   */
  stockReturn: {
    term: 'Stock %',
    what: "How far this company has moved since last month's final close, up to the latest figure available.",
    why: 'It is one half of Relative Strength — the half describing the company rather than the market.',
    inGati: 'Subtract the benchmark column beside it and you have the Rel. strength the ranking is sorted by.',
    learnMore: {
      detail:
        'Measured from the previous month-end close to the most recent close, on adjusted figures at both ends so a split or bonus in between does not fabricate a move. It is month-to-date, not a rolling thirty days, and it resets when the month does.',
      example: 'A stock at ₹102 against a ₹100 close on 31 July shows +2.00%, whatever day of August you look.',
      limitations:
        'A large number early in the month rests on very few sessions. It also says nothing alone — a stock up 6% in a market up 8% is a laggard, which is why the ranking uses the difference and not this.',
    },
    seeAlso: 'relativeStrength',
  },

  livePrice: {
    term: 'Price',
    what: 'The most recent figure Gati holds for this stock.',
    why: 'Everything else on the row is measured up to it, so whether it is current changes what the row means.',
    inGati: 'Live during the session and the last close when the market is shut — never an input to the ranking either way.',
    learnMore: {
      detail:
        'A live quote drives this column and the day move only. It never enters Relative Strength, because live quotes are unadjusted and dividing one by an adjusted month-end close would break across any corporate action since.',
      example: 'At 11:20 on a Tuesday this is live; at 11:20 on a Sunday it is Friday\u2019s close, dated as such.',
      limitations:
        'Quotes are delayed by up to 30 seconds and can fail for one stock while the rest of the universe updates, in which case this falls back to the last close rather than showing nothing.',
    },
    seeAlso: 'dataAsOf',
  },

  priorMonthEnd: {
    term: 'Previous month-end price',
    what: 'The official close on the last day the market actually traded last month.',
    why: 'Every current-month return is measured from it, so it has to be exact.',
    inGati: 'Gati takes it from real data, never estimated, and shows its date beside the ranking so you can check it.',
    learnMore: {
      detail:
        'Month-ends are found from which dates exist in the price series rather than by calendar arithmetic, so holidays and weekends are handled with no holiday list involved.',
      example: 'March 2025 ended on the 28th, because the 31st was Id-Ul-Fitr and the market was closed.',
      limitations: 'If a stock has no data for that month at all it is excluded from the ranking and flagged, never compared against a different period.',
    },
  },

  /* ---------------- Portfolio ---------------- */

  portfolioWeight: {
    term: 'Weight',
    what: "A holding's share of your portfolio's current value.",
    why: 'A position that has doubled now carries twice the risk it did when you bought it.',
    inGati: 'Computed on current value across your own portfolio, so it shows where your risk sits rather than what you originally allocated.',
    learnMore: {
      detail: 'The strategy buys equal weights, but they drift apart immediately as prices move and only reset at the next rebalance.',
      example: 'Five equal ₹10,000 positions where one doubles becomes a 33% weight in that stock.',
      limitations: 'Weights are computed only across holdings Gati can price; anything unpriced is excluded and reported separately.',
    },
  },

  unrealisedPnl: {
    term: 'Profit / loss',
    what: 'The difference between what a holding is worth now and what you paid.',
    why: 'The plainest measure of how a position is doing.',
    inGati: "Calculated from positions you entered yourself, and never mixed into the strategy's own record.",
    learnMore: {
      detail: 'Your holdings and the model’s record are two different numbers answering two different questions, so Gati keeps them strictly apart.',
      example: '10 shares bought at ₹100, now ₹120: ₹200 profit, 20%.',
      limitations: 'Unrealised until you sell, and before tax. The percentage matters more than the rupee figure when comparing different-sized positions.',
    },
  },

  todaysChange: {
    term: "Today's change",
    what: 'How much a holding or portfolio moved during the current session.',
    why: 'Useful context, but one day says little about a monthly strategy.',
    inGati: 'A display figure only — it never enters a ranking, because live prices are unadjusted.',
    learnMore: {
      detail:
        'Live quotes are raw, unadjusted prices. Dividing one by an adjusted month-end close would break across any corporate action since, so Gati uses the price series for all return maths.',
      example: 'A stock up 2% today can still be the worst-ranked name in its universe this month.',
      limitations: "When the market is closed this shows the last session's move, not a live figure.",
    },
  },

  monthlyPerformance: {
    term: 'Month by month',
    what: 'How the strategy did in each individual month, next to its benchmark.',
    why: 'A single total hides the ride — two strategies with the same return can feel completely different to hold.',
    inGati: 'One bar per completed rebalance. 0% is the neutral line: above it the month made money, below it the month lost.',
    learnMore: {
      detail:
        'The scale is deliberately symmetric around zero, so a small losing month is drawn at its true size rather than magnified to fill the frame. The benchmark sits behind each month in a neutral tone because it is what the strategy is measured against, not a competitor.',
      example: 'A +4.1% bar beside a +1.2% benchmark bar means the strategy finished that month 2.9 points ahead.',
      limitations:
        'Only completed rebalances appear, so the current month is absent until it ends. Months where a return could not be computed are left out rather than drawn as zero — a missing month and a flat month are different facts.',
    },
  },

  dayVolume: {
    term: 'Day volume',
    what: 'The total number of shares traded in this stock so far today.',
    why: 'A big move on very little volume rests on fewer buyers than it appears to.',
    inGati: 'Shown for context beside the ranking — it is never an input to Relative Strength or to the Top 5.',
    learnMore: {
      detail:
        'It is a RUNNING TOTAL since the opening bell, not a rate. The figure only rises through the session, so the same number at 10am and at 3pm means trading stopped, not that it is stuck. After the close it is the completed session total.',
      example: 'A stock showing 24.5L has had 2,450,000 shares change hands today.',
      limitations:
        'It counts shares, not rupees, so it is not comparable between a ₹200 stock and a ₹4,000 one. A single large block trade can also make a quiet day look busy.',
    },
  },
};

/** Every glossary key, for enumeration and coverage checks. */
export const GLOSSARY_KEYS = Object.freeze(Object.keys(GLOSSARY));

/**
 * Look up an explanation.
 *
 * Returns null for an unknown key rather than throwing or inventing text: a
 * missing explanation should surface as a quietly absent icon, never a crash
 * on a screen full of correct numbers. The build-time coverage test is what
 * stops one going missing in the first place.
 */
export function getGlossaryEntry(key) {
  return GLOSSARY[key] ?? null;
}

/** Whether an entry offers a deeper tier. */
export function hasLearnMore(key) {
  return Boolean(GLOSSARY[key]?.learnMore);
}
