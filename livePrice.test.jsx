// @vitest-environment jsdom
/**
 * THE LIVE DOT — when it may appear, and what the price says when it may not.
 *
 * "Live" is the most expensive word this interface can print: a reader who
 * believes a number is live will act on it. These tests pin the conditions
 * so the dot cannot drift into meaning "the market is technically open" or,
 * worse, "a network call succeeded".
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { describePrice, LiveDot } from '../data/LivePrice.jsx';

afterEach(cleanup);

const session = (over = {}) => ({
  status: 'CLOSED',
  isLive: false,
  freshness: 'last close',
  holiday: null,
  ...over,
});

describe('when the market is genuinely live', () => {
  const live = session({ status: 'OPEN', isLive: true, freshness: 'live' });

  it('calls the figure "Price", not "Last price"', () => {
    expect(describePrice({ session: live, priceDate: '07 Aug 2026' }).label).toBe('Price');
  });

  it('says Live in text, so the dot is never the only signal', () => {
    // A reader who cannot distinguish the dot's colour, or who has motion
    // switched off, must lose nothing.
    expect(describePrice({ session: live }).sublabel).toContain('Live');
  });

  it('appends the provider timestamp when there is a trustworthy one', () => {
    expect(describePrice({ session: live, tradeTime: '10:45:00' }).sublabel).toBe('Live · 10:45:00');
  });
});

describe('when the market is shut', () => {
  it('changes the HEADING, not just a caption, at the weekend', () => {
    const result = describePrice({ session: session({ status: 'WEEKEND' }), priceDate: '07 Aug 2026' });
    expect(result.label).toBe('Last price');
    expect(result.sublabel).toBe('Market closed · 07 Aug 2026');
  });

  it('names the holiday rather than saying only "closed"', () => {
    const result = describePrice({
      session: session({ status: 'HOLIDAY', holiday: { name: 'Republic Day' } }),
      priceDate: '23 Jan 2026',
    });
    expect(result.sublabel).toBe('Republic Day · 23 Jan 2026');
  });

  it('states which session the price came from, so it can be checked', () => {
    expect(describePrice({ session: session(), priceDate: '07 Aug 2026' }).sublabel).toContain('07 Aug 2026');
  });

  it('omits the date rather than inventing one when it is unknown', () => {
    const result = describePrice({ session: session(), priceDate: null });
    expect(result.sublabel).toBe('Last close');
    expect(result.sublabel).not.toContain('·');
  });
});

/**
 * THE CASE THE WHOLE GATE EXISTS FOR.
 *
 * A session that is technically OPEN is not sufficient. If the last quote
 * arrived an hour ago and nothing has updated since, the market being open
 * makes the stale number MORE dangerous, not less — the reader has every
 * reason to assume it is current.
 */
describe('an open market with data that is not keeping up', () => {
  it('refuses the live treatment when the data is delayed', () => {
    const result = describePrice({
      session: session({ status: 'OPEN', isLive: false, freshness: 'delayed' }),
      priceDate: '07 Aug 2026',
    });
    expect(result.label).toBe('Last price');
    expect(result.sublabel).toBe('Market open, data delayed · 07 Aug 2026');
  });

  it('refuses it when the device is offline, however open the exchange is', () => {
    const result = describePrice({
      session: session({ status: 'OPEN', isLive: false, freshness: 'cached' }),
      priceDate: '07 Aug 2026',
    });
    expect(result.sublabel).toBe('Offline · 07 Aug 2026');
  });

  it('shouts loudest about sample data, whatever the exchange is doing', () => {
    // Outranks every other state: a mock figure mistaken for a market figure
    // is the worst outcome this app has.
    const result = describePrice({
      session: session({ status: 'OPEN', isLive: false, freshness: 'sample' }),
      priceDate: '07 Aug 2026',
    });
    expect(result.label).toBe('Sample price');
    expect(result.sublabel).toBe('NOT real market data');
    // And never a date, which would lend it the look of a real observation.
    expect(result.sublabel).not.toContain('07 Aug');
  });
});

describe('missing session', () => {
  it('falls back to the cautious reading rather than claiming live', () => {
    // First render, or a caller that forgot to pass one.
    for (const missing of [null, undefined]) {
      const result = describePrice({ session: missing, priceDate: null });
      expect(result.label).toBe('Last price');
    }
  });
});


/**
 * THE DOT ITSELF.
 *
 * These exist because the browser cannot prove it. The dev environment runs
 * the mock provider, and the system correctly refuses to call sample data
 * live — so `session.isLive` is never true there and the dot never renders,
 * however long you wait. Verified here instead, and the gating condition is
 * verified above.
 */
describe('LiveDot rendering', () => {
  it('renders nothing at all when the data is not live', () => {
    const { container } = render(<LiveDot isLive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a pulsing dot when the data is live', () => {
    const { container } = render(<LiveDot isLive />);
    const dot = container.firstChild;
    expect(dot).not.toBeNull();
    expect(dot.className).toContain('gati-status-pulse');
  });

  it('is decorative, because the word "Live" already says it in text', () => {
    // Announcing a dot would only repeat the sublabel a screen reader has
    // just read. Meaning is never carried by the dot alone.
    const { container } = render(<LiveDot isLive />);
    expect(container.firstChild.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a truthy string', ''],
  ])('stays hidden for a non-true value (%s)', (_label, value) => {
    // Fails closed. A missing prop must never be read as "live".
    const { container } = render(<LiveDot isLive={value} />);
    expect(container.firstChild).toBeNull();
  });
});
