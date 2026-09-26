/**
 * GLOSSARY TESTS — the enforcement mechanism for decision D9.
 *
 * D9 makes contextual help a permanent product requirement. A requirement
 * recorded only in a document decays the first time someone adds a metric in a
 * hurry, and the decay is invisible: the app still works, it is just quietly
 * less understandable than it was.
 *
 * So these tests fail the build when an explanation is missing, incomplete, or
 * written in the jargon it is supposed to be explaining.
 */

import { describe, it, expect } from 'vitest';
import { GLOSSARY, GLOSSARY_KEYS, getGlossaryEntry, hasLearnMore } from '../glossary.js';

/**
 * Every metric the app is known to display. Adding a metric to the UI without
 * adding it here — or adding it here without writing an entry — fails.
 *
 * This list is deliberately maintained by hand rather than scraped from
 * components. Scraping would silently pass whenever a label changed shape,
 * which defeats the purpose.
 */
const TERMS_THE_UI_RENDERS = [
  // Core concept
  'relativeStrength', 'benchmark', 'rank', 'topFive', 'lookbackWindow', 'rebalance',
  'rebalanceTiming', 'positionStatus', 'momentumAge', 'rebalanceSummary', 'momentumDirection', 'methodologyVersion',
  // Performance
  'totalReturn', 'benchmarkReturn', 'outperformance', 'cagr',
  // Costs the reader actually pays
  'transactionCosts', 'capitalGainsTax',
  // Risk the reader has to sit through
  'underwaterDuration', 'sectorConcentration', 'liquidity',
  // Risk
  'maxDrawdown', 'volatility', 'sharpe', 'sortino',
  // Consistency
  'winRate', 'monthsWon', 'monthsLost', 'bestMonth', 'worstMonth',
  // Investment Simulator
  'executionEfficiency', 'cashDrag', 'idleCash', 'minimumViableCapital',
  'idealVsExecutable', 'capitalIndependent',
  // Costs
  'transactionCosts', 'slippage', 'grossVsNet',
  // Data honesty
  'adjustedClose', 'corporateAction', 'survivorshipBias', 'thinSample',
  'lookAheadBias', 'dataAsOf', 'priorMonthEnd',
  // The ranking table's remaining two unexplained columns (v1.6.1)
  'stockReturn', 'livePrice',
  // Portfolio
  'portfolioWeight', 'unrealisedPnl', 'todaysChange',
  // Stock detail (M13)
  'dayVolume',
  // Universe performance (M14)
  'monthlyPerformance',
];

describe('coverage — D9 requires an explanation for every displayed term', () => {
  it.each(TERMS_THE_UI_RENDERS)('has an entry for "%s"', (key) => {
    expect(GLOSSARY[key], `No glossary entry for "${key}". D9 requires one before it can be displayed.`).toBeDefined();
  });

  it('has no orphaned entries the UI never shows', () => {
    // Not a failure of understanding, but dead weight: an entry nobody can
    // reach is text that will never be corrected when it goes out of date.
    const orphans = GLOSSARY_KEYS.filter((k) => !TERMS_THE_UI_RENDERS.includes(k));
    expect(orphans).toEqual([]);
  });
});

describe('completeness — the default tier answers all three questions', () => {
  it.each(GLOSSARY_KEYS)('"%s" says what it is, why it matters, and what it means in Gati', (key) => {
    const entry = GLOSSARY[key];
    for (const field of ['term', 'what', 'why', 'inGati']) {
      expect(entry[field], `${key}.${field} is missing`).toBeTruthy();
      expect(typeof entry[field]).toBe('string');
    }
  });

  it.each(GLOSSARY_KEYS)('"%s" keeps the DEFAULT tier extremely short (D11)', (key) => {
    const entry = GLOSSARY[key];
    // One sentence each. The default must never overwhelm — anything longer
    // belongs behind Learn more, which is the entire reason it exists.
    for (const field of ['what', 'why', 'inGati']) {
      expect(entry[field].length, `${key}.${field} is ${entry[field].length} chars — too long for the default tier`).toBeLessThan(170);
      expect(entry[field].length).toBeGreaterThan(20);
    }
    const total = entry.what.length + entry.why.length + entry.inGati.length;
    expect(total, `${key} default tier is ${total} chars`).toBeLessThan(430);
  });

  it.each(GLOSSARY_KEYS)('"%s" is one sentence per default field', (key) => {
    const entry = GLOSSARY[key];
    for (const field of ['what', 'why', 'inGati']) {
      // Decimals and abbreviations are excluded before counting sentence ends.
      const sentences = entry[field]
        .replace(/\d\.\d/g, '')
        .split(/[.?][\s"']|[.?]$/)
        .filter((part) => part.trim().length > 0);
      expect(sentences.length, `${key}.${field} reads as ${sentences.length} sentences`).toBeLessThanOrEqual(2);
    }
  });

  it.each(GLOSSARY_KEYS)('"%s" points only at terms that exist', (key) => {
    const entry = GLOSSARY[key];
    if (entry.seeAlso) {
      expect(GLOSSARY[entry.seeAlso], `${key}.seeAlso points at missing "${entry.seeAlso}"`).toBeDefined();
      expect(entry.seeAlso).not.toBe(key);
    }
  });
});

describe('Learn more — the deeper tier (D11)', () => {
  it('exists for every entry, since every metric has a limitation worth stating', () => {
    const missing = GLOSSARY_KEYS.filter((k) => !hasLearnMore(k));
    expect(missing).toEqual([]);
  });

  it.each(GLOSSARY_KEYS)('"%s" gives detail, a concrete example and limitations', (key) => {
    const lm = GLOSSARY[key].learnMore;
    for (const field of ['detail', 'example', 'limitations']) {
      expect(lm[field], `${key}.learnMore.${field} is missing`).toBeTruthy();
      expect(lm[field].length).toBeGreaterThan(40);
    }
  });

  it.each(GLOSSARY_KEYS)('"%s" uses real figures in its example, not hypotheticals', (key) => {
    // "Suppose a stock rises" teaches nothing. A number does.
    const example = GLOSSARY[key].learnMore.example;
    expect(/\d/.test(example), `${key}.learnMore.example has no concrete figure`).toBe(true);
  });

  it.each(GLOSSARY_KEYS)('"%s" states a limitation rather than overselling the metric', (key) => {
    // A metric with no stated weakness invites more confidence than the data
    // supports. This field is mandatory for exactly that reason.
    const lim = GLOSSARY[key].learnMore.limitations.toLowerCase();
    expect(
      /\bnot\b|never|cannot|can't|only|ignore|says nothing|hides|no |bias|caution|differ|vary|unavoidable|estimate|indicative|small|short|will not|may |might |rarely|beyond|worse|fail|risk|assum|approxim|imprecise|unreliable|overstat|flatter/.test(lim),
      `${key}.learnMore.limitations does not actually state a limitation`,
    ).toBe(true);
  });

  it('includes a formula only where the formula IS the meaning', () => {
    // RS is a subtraction and showing it clarifies. Sharpe's denominator
    // helps nobody decide anything, so it is deliberately absent.
    const withFormula = GLOSSARY_KEYS.filter((k) => GLOSSARY[k].learnMore.formula);
    expect(withFormula).toContain('relativeStrength');
    expect(withFormula).toContain('outperformance');
    expect(withFormula).not.toContain('sharpe');
    expect(withFormula).not.toContain('benchmark');
    // A formula everywhere would mean the tier is being padded.
    expect(withFormula.length).toBeLessThan(GLOSSARY_KEYS.length / 2);
  });
});

describe('principle 2 — every explanation relates back to Gati', () => {
  // The product-specific field must actually be product-specific. An entry
  // that reads identically in any other app is a textbook definition wearing
  // a costume.
  const GATI_ANCHORS = [
    'gati', 'top five', 'top 5', 'rebalance', 'universe', 'benchmark',
    'relative strength', 'investment simulator', 'month-end', 'window',
    'ranking', 'rank', 'strategy record', 'record', 'simulator', 'settings',
    'strategy', 'signal', 'portfolio',
  ];

  it.each(GLOSSARY_KEYS)('"%s".inGati references something specific to this product', (key) => {
    const text = GLOSSARY[key].inGati.toLowerCase();
    const anchored = GATI_ANCHORS.some((a) => text.includes(a));
    expect(anchored, `${key}.inGati reads like a generic definition`).toBe(true);
  });
});

describe('house style — plain language, enforced', () => {
  it.each(GLOSSARY_KEYS)('"%s" avoids circular self-definition', (key) => {
    const entry = GLOSSARY[key];
    // "Relative Strength is a measure of relative strength" explains nothing.
    const firstWord = entry.term.split(' ')[0].toLowerCase();
    if (firstWord.length > 4) {
      const opening = entry.what.slice(0, entry.term.length + 20).toLowerCase();
      const isCircular = opening.startsWith(entry.term.toLowerCase() + ' is');
      expect(isCircular, `${key}.what restates its own term`).toBe(false);
    }
  });

  it.each(GLOSSARY_KEYS)('"%s" contains no exclamation marks or false cheer', (key) => {
    const e = GLOSSARY[key];
    const text = [e.what, e.why, e.inGati, e.learnMore.detail, e.learnMore.example, e.learnMore.limitations].join(' ');
    expect(text).not.toMatch(/!/);
    expect(text.toLowerCase()).not.toMatch(/don't worry|no need to worry|simply put|it's easy/);
  });

  it.each(GLOSSARY_KEYS)('"%s" explains jargon rather than using it undefined', (key) => {
    const entry = GLOSSARY[key];
    const text = [entry.what, entry.why, entry.inGati, entry.learnMore.detail].join(' ').toLowerCase();
    // Terms that must never appear inside an explanation without being the
    // subject of that entry — using them would just move the confusion.
    const jargon = ['risk-adjusted', 'standard deviation', 'stochastic', 'heteroskedastic', 'ex-ante', 'ex-post'];
    for (const word of jargon) {
      expect(text.includes(word), `${key} uses undefined jargon "${word}"`).toBe(false);
    }
  });

  /**
   * The display convention changed by owner decision on 8 Aug 2026: these
   * values now read as `%` everywhere in the interface, because `pp` is a
   * barrier for the beginner Gati is built for.
   *
   * The arithmetic did not change — Relative Strength is still a difference
   * between two percentages, so "+18.8%" means 18.8 points ahead and NOT
   * 18.8% more. That is the single most common way to misread the product's
   * central number, so the explanation now has to carry what the suffix used
   * to. These tests are what stop it being quietly dropped.
   */
  it('explains that a Relative Strength figure is a gap, not a multiplier', () => {
    const text = [GLOSSARY.relativeStrength.learnMore.note, GLOSSARY.relativeStrength.learnMore.detail]
      .join(' ')
      .toLowerCase();
    expect(text).toContain('ahead');
    expect(text).toMatch(/points ahead|difference between two percentages/);
  });

  it('says plainly that outperformance is not formal alpha', () => {
    // The owner's instruction: never label a plain return difference "alpha".
    const outperf = GLOSSARY.outperformance;
    expect(`${outperf.what} ${outperf.why} ${outperf.inGati}`.toLowerCase()).not.toContain('alpha');
    expect(outperf.learnMore.detail.toLowerCase()).toContain('not alpha');
  });

  it('shows no "pp" suffix in any user-facing string', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      const text = JSON.stringify(entry);
      expect(text, `${key} still renders a pp suffix`).not.toMatch(/\d\s?pp\b/);
    }
  });

  /**
   * THE DEFAULT TIER IS ONE SENTENCE, AND IT IS THE ONLY THING MOST READERS
   * WILL SEE (M13, owner brief 8 Aug 2026).
   *
   * `what` is now rendered alone and unlabelled when an icon is tapped;
   * `why` and `inGati` moved behind Learn more. So `what` has to carry the
   * whole job by itself: a beginner reads it, understands the number, and
   * closes the panel. These bounds are what stop it drifting back into a
   * definition written for someone who already knew.
   */
  describe('the one-sentence default', () => {
    it.each(Object.entries(GLOSSARY))('%s reads as a single sentence', (key, entry) => {
      // One terminal full stop, at the end. A semicolon is allowed — it joins
      // a contrast ("Gross ignores costs; net subtracts them") rather than
      // starting a second thought.
      const inner = entry.what.slice(0, -1);
      expect(entry.what.endsWith('.'), `${key} should end in a full stop`).toBe(true);
      expect(inner.match(/\. /g) ?? [], `${key} contains more than one sentence`).toEqual([]);
    });

    it.each(Object.entries(GLOSSARY))('%s stays short enough to read at a glance', (key, entry) => {
      expect(entry.what.length, `${key}: "${entry.what}"`).toBeLessThanOrEqual(110);
    });

    /**
     * Two entries name their own term on purpose, and both are right to.
     * "Gross vs net" IS a contrast between two named things — a sentence
     * that avoided both words would be describing something else. And
     * "Adjusted close" earns the word by immediately saying what the
     * adjustment does and why, which is the opposite of circular.
     *
     * Listed rather than the rule loosened: an allowlist of two is auditable,
     * a weaker rule silently permits the next twenty.
     */
    const NAMES_ITSELF_DELIBERATELY = new Set([
      'grossVsNet',
      'adjustedClose',
      // "Month by month" is not jargon being restated — "month" is an
      // ordinary English noun, and an explanation of a monthly chart that
      // avoided the word would be contorted to satisfy a lint rule. The
      // check exists to catch "Relative Strength is the relative strength
      // of...", which this is not.
      'monthlyPerformance',
    ]);

    it.each(Object.entries(GLOSSARY))('%s defines the term without using it', (key, entry) => {
      // "Relative Strength is the relative strength of..." helps nobody. The
      // first word of the term is enough to catch the circular ones.
      if (NAMES_ITSELF_DELIBERATELY.has(key)) return;
      const head = entry.term.split(/[\s/]/)[0].toLowerCase();
      if (head.length < 5) return; // "Rank", "Trend" — unavoidable and fine
      expect(entry.what.toLowerCase(), `${key} defines itself circularly`).not.toContain(head);
    });

    it.each(Object.entries(GLOSSARY))('%s avoids finance jargon in the default sentence', (key, entry) => {
      // Terms a beginner would have to look up to understand the lookup.
      const jargon = ['peak-to-trough', 'unit of', 'annualised', 'arithmetic mean', 'standard deviation', 'basis point'];
      for (const word of jargon) {
        expect(entry.what.toLowerCase(), `${key} uses "${word}" in its one-line answer`).not.toContain(word);
      }
    });
  });

  it('is honest about metrics that need a long sample', () => {
    for (const key of ['sharpe', 'sortino', 'cagr']) {
      const e = GLOSSARY[key];
      const text = [e.why, e.inGati, e.learnMore.limitations].join(' ').toLowerCase();
      expect(
        /short|caution|needs a lot|few months|meaningful number/.test(text),
        `${key} should warn that it is unreliable on a short track record`,
      ).toBe(true);
    }
  });
});

describe('getGlossaryEntry', () => {
  it('returns the entry for a known key', () => {
    expect(getGlossaryEntry('cagr').term).toBe('CAGR');
  });

  it('returns null for an unknown key rather than throwing or inventing text', () => {
    // A missing explanation should be a quietly absent icon, never a crash on
    // a screen full of correct numbers.
    expect(getGlossaryEntry('nonexistent')).toBeNull();
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * THE GLOSSARY MUST NOT CONTRADICT THE SCREEN IT SITS ON (v1.6.5 audit).
 *
 * `rebalanceTiming` read "the Top 5 does not change between rebalances". That
 * is true of the HELD portfolio and false of the thing the tooltip actually
 * sits beside: the Dashboard's live ranking, which recomputes from the latest
 * prices on every load.
 *
 * Measured on the real engine — 8 stocks over 21 August sessions produced
 * FOURTEEN different Top 5 line-ups. Meanwhile My Portfolio correctly says
 * "This month is still running, so the Top 5 above can change". Two screens
 * were telling the reader opposite things about the same five names.
 *
 * The distinction is the single most important thing a reader has to grasp
 * about this app — what is on screen today is provisional; the strategy acts
 * on the month-end close — so it is asserted rather than left to prose.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('the live ranking is never described as fixed', () => {
  const timing = GLOSSARY.rebalanceTiming;
  const all = [timing.what, timing.why, timing.inGati, timing.learnMore?.detail].filter(Boolean).join(' ');

  it('does not claim the Top 5 stays put between rebalances', () => {
    expect(all).not.toMatch(/Top 5 does not change/i);
    expect(all).not.toMatch(/does not change between rebalances/i);
  });

  it('distinguishes the live ranking from what is actually held', () => {
    expect(all).toMatch(/live|in progress|provisional|can still change|settles/i);
  });

  it('still says when the strategy acts, which is the point of the term', () => {
    expect(all).toMatch(/month-end|last trading day/i);
  });

  it('makes no prediction about what the ranking will do next', () => {
    const banned = /\b(will rise|guaranteed|sure winner|buy this|bullish|should buy|outperform next)\b/i;
    expect(all).not.toMatch(banned);
    expect(GLOSSARY.topFive.what + GLOSSARY.topFive.why + GLOSSARY.topFive.inGati).not.toMatch(banned);
  });
});
