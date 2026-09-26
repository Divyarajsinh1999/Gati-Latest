/**
 * HOW GATI WORKS — the content, held to the rules that make it trustworthy.
 *
 * WHAT THESE GUARD
 *   That the page stays a beginner's page (short answers), that it does not
 *   drift into a second methodology, and that every term it decorates with
 *   an InfoTip and every methodology link it offers actually exists.
 *
 * The last one matters most: a dead deep-link sends a reader who wanted the
 * technical detail to the top of a page of eleven collapsed sections, and
 * nothing in a build catches a broken anchor.
 */

import { describe, it, expect } from 'vitest';
import { HOW_IT_WORKS, HOW_IT_WORKS_GLOSSARY_KEYS } from '../howItWorks.js';
import { GLOSSARY } from '../glossary.js';
import { METHODOLOGY_SECTIONS } from '../methodology.js';

const allTopics = HOW_IT_WORKS.flatMap((chapter) =>
  chapter.topics.map((topic) => [`${chapter.id}/${topic.term}`, topic]),
);

describe('structure', () => {
  it('has chapters, each with topics', () => {
    expect(HOW_IT_WORKS.length).toBeGreaterThanOrEqual(5);
    for (const chapter of HOW_IT_WORKS) {
      expect(chapter.topics.length, `${chapter.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('uses unique chapter ids, because they are DOM ids and aria targets', () => {
    const ids = HOW_IT_WORKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every chapter a summary, so a collapsed page still says what it holds', () => {
    for (const chapter of HOW_IT_WORKS) {
      expect(chapter.summary, `${chapter.id}`).toBeTruthy();
      expect(chapter.summary.length).toBeLessThanOrEqual(110);
    }
  });
});

describe('it stays a beginner page', () => {
  it.each(allTopics)('%s answers in one or two short sentences', (_key, topic) => {
    // The brief's rule, and the reason this page exists separately from
    // methodology. Anything longer belongs in `detail`, which is optional
    // and visually secondary.
    expect(topic.plain).toBeTruthy();
    expect(topic.plain.length).toBeLessThanOrEqual(230);
    const sentences = topic.plain.split(/\.\s/).filter(Boolean);
    expect(sentences.length, `"${topic.plain}"`).toBeLessThanOrEqual(2);
  });

  it.each(allTopics)('%s keeps its optional detail to a short paragraph', (_key, topic) => {
    if (!topic.detail) return;
    expect(topic.detail.length).toBeLessThanOrEqual(330);
  });

  it.each(allTopics)('%s avoids jargon a beginner would have to look up first', (_key, topic) => {
    const jargon = ['annualised', 'standard deviation', 'peak-to-trough', 'basis point', 'stochastic'];
    for (const word of jargon) {
      expect(topic.plain.toLowerCase(), `uses "${word}"`).not.toContain(word);
    }
  });
});

describe('every reference resolves', () => {
  it('points only at glossary terms that exist', () => {
    // A missing key renders an InfoTip that opens onto nothing.
    for (const key of HOW_IT_WORKS_GLOSSARY_KEYS) {
      expect(GLOSSARY[key], `glossary term "${key}" does not exist`).toBeTruthy();
    }
  });

  it('deep-links only to methodology sections that exist', () => {
    const sectionIds = new Set(METHODOLOGY_SECTIONS.map((s) => s.id));
    for (const [key, topic] of allTopics) {
      if (!topic.methodology) continue;
      expect(sectionIds.has(topic.methodology), `${key} links to #${topic.methodology}, which is not a section`).toBe(true);
    }
  });
});

describe('honesty', () => {
  /**
   * A page explaining a financial tool is exactly where an over-claim does
   * the most damage: the reader has arrived precisely because they do not
   * yet know enough to catch it.
   */
  it('promises no returns and predicts nothing', () => {
    const forbidden = [
      'guarantee',
      'guaranteed',
      'will rise',
      'will outperform',
      'assured',
      'risk-free',
      'best stocks to buy',
      'you should buy',
    ];
    for (const [key, topic] of allTopics) {
      const text = `${topic.plain} ${topic.detail ?? ''}`.toLowerCase();
      for (const phrase of forbidden) {
        expect(text, `${key} contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it('says outright that Gati does not predict or advise', () => {
    const text = JSON.stringify(HOW_IT_WORKS).toLowerCase();
    expect(text).toContain('does not predict');
    expect(text).toContain('backward-looking');
  });

  it('states the survivorship-bias limitation rather than omitting it', () => {
    // Easy to leave out of a friendly page. It changes how the historical
    // numbers should be read, so it belongs in the friendly page most.
    expect(JSON.stringify(HOW_IT_WORKS).toLowerCase()).toContain('survivorship');
  });

  it('explains why a weekend shows no Today %', () => {
    const text = JSON.stringify(HOW_IT_WORKS).toLowerCase();
    expect(text).toContain('no trading session');
  });

  it('never reintroduces "pp" as a unit', () => {
    expect(JSON.stringify(HOW_IT_WORKS)).not.toMatch(/\d\s?pp\b/);
  });

  it('does not call outperformance "alpha" without disowning the term', () => {
    const alpha = allTopics.find(([, t]) => `${t.plain} ${t.detail ?? ''}`.toLowerCase().includes('alpha'));
    if (!alpha) return;
    expect(`${alpha[1].plain} ${alpha[1].detail}`.toLowerCase()).toContain('rather than alpha');
  });
});
