/**
 * ABOUT GATI — the copy, held to the constraints that keep it honest.
 *
 * This is the one screen written about the PRODUCT rather than about a
 * number, which makes it the easiest place in the app to over-claim. A
 * reader arriving here is deciding whether to trust Gati with real money,
 * and marketing prose is exactly the register in which a promise slips in
 * unnoticed.
 *
 * So the rules are enforced rather than intended. Copy is easy to edit and
 * a forbidden phrase is easy to add back in a hurry.
 */

import { describe, it, expect } from 'vitest';
import { ABOUT_SECTIONS, ABOUT_DISCLAIMER, ABOUT_CREDITS, GATI_MEANING } from '../about.js';

const allProse = [...ABOUT_SECTIONS.map((s) => s.body), ABOUT_DISCLAIMER].join(' ').toLowerCase();

describe('structure', () => {
  it('covers what the brief asks a brand statement to cover', () => {
    const ids = ABOUT_SECTIONS.map((s) => s.id);
    for (const required of ['what', 'why', 'problem', 'philosophy']) {
      expect(ids, `missing the "${required}" section`).toContain(required);
    }
  });

  it('uses unique ids and gives every section a title and a body', () => {
    const ids = ABOUT_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of ABOUT_SECTIONS) {
      expect(section.title, section.id).toBeTruthy();
      expect(section.body.length, section.id).toBeGreaterThan(60);
    }
  });

  it('keeps each section to a short paragraph', () => {
    // A brand statement nobody finishes is a brand statement nobody read.
    for (const section of ABOUT_SECTIONS) {
      expect(section.body.length, `${section.id} is too long`).toBeLessThanOrEqual(340);
    }
  });
});

/**
 * THE CONSTRAINT THAT MATTERS MOST.
 *
 * None of these phrases is one anybody sets out to write. They arrive when
 * copy is being made to sound confident, which is exactly what this page is
 * for — hence a test rather than a note in a style guide.
 */
describe('no financial over-claim', () => {
  const FORBIDDEN = [
    'guarantee',
    'guaranteed',
    'assured',
    'risk-free',
    'riskless',
    'beat the market',
    'outperform the market',
    'proven strategy',
    'consistent returns',
    'high returns',
    'maximise your',
    'maximize your',
    'grow your wealth',
    'you should buy',
    'you should sell',
    'best stocks to buy',
    'sure thing',
    'no risk',
  ];

  it.each(FORBIDDEN)('never says "%s"', (phrase) => {
    expect(allProse).not.toContain(phrase);
  });

  it('makes no claim about future prices', () => {
    for (const bad of ['will rise', 'will grow', 'will increase', 'predicts']) {
      expect(allProse, `contains "${bad}"`).not.toContain(bad);
    }
  });

  it('does not describe itself as advice', () => {
    // "Advice" appears once, in the disclaimer, and only as a denial.
    for (const section of ABOUT_SECTIONS) {
      expect(section.body.toLowerCase()).not.toContain('advice');
    }
  });
});

describe('the disclaimer', () => {
  it('exists and is specific rather than boilerplate', () => {
    expect(ABOUT_DISCLAIMER.length).toBeGreaterThan(120);
  });

  it('denies each of the four things a reader might assume', () => {
    const text = ABOUT_DISCLAIMER.toLowerCase();
    expect(text, 'must say it is not advice').toContain('not financial advice');
    expect(text, 'must deny prediction').toContain('does not predict');
    expect(text, 'must disclaim past performance').toContain('past performance');
    expect(text, 'must leave the decision with the reader').toMatch(/remains yours|your own/);
  });
});

describe('credits', () => {
  it('names the developer as given', () => {
    expect(ABOUT_CREDITS.developer).toBe('Divyarajsinh Parmar');
  });

  it('carries a valid contact address', () => {
    expect(ABOUT_CREDITS.email).toBe('parmardivyarajsinh999@gmail.com');
    // Rendered as a real mailto: link, so it must survive being put in an href.
    expect(ABOUT_CREDITS.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(ABOUT_CREDITS.email).not.toMatch(/\s/);
  });
});

describe('the name', () => {
  it('states what Gati means, in its own script', () => {
    expect(GATI_MEANING.script).toBe('गति');
    expect(GATI_MEANING.meaning).toContain('momentum');
    expect(GATI_MEANING.language).toBe('Sanskrit');
  });
});
