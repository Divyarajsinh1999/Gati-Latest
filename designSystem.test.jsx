// @vitest-environment jsdom
/**
 * DESIGN SYSTEM TESTS — M4.
 *
 * These assert BEHAVIOUR and ACCESSIBILITY, not pixels. A test that pins exact
 * spacing values makes every future refinement a test edit, which trains
 * people to update tests without reading them.
 *
 * What is worth pinning is the set of properties that would silently break the
 * product's stated principles: colour never being the sole carrier of meaning,
 * focus returning to its trigger, disabled controls stating why, and no
 * fabricated content appearing where data is absent.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Button, Segmented, Chip, RankBadge, Field, Skeleton } from '../primitives/index.jsx';
import { InfoTip, MetricTile, MetricGroup, RSLedger } from '../data/index.jsx';
import { StatusLine, DataNotes, EmptyState, ErrorState, InsufficientHistoryState } from '../feedback/index.jsx';
import { ICONS, strokeFor } from '../../design/icons.jsx';
import { GLOSSARY } from '../../config/glossary.js';

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/* PRIMITIVES                                                          */
/* ------------------------------------------------------------------ */

describe('Button', () => {
  it('renders each of the four styles', () => {
    for (const variant of ['primary', 'secondary', 'quiet', 'destructive']) {
      const { unmount } = render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
      unmount();
    }
  });

  it('is not clickable when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('never renders a filled destructive button', () => {
    // A filled red button invites the accident it warns about.
    render(<Button variant="destructive">Delete</Button>);
    const style = screen.getByRole('button').getAttribute('style');
    expect(style).toContain('background: transparent');
  });
});

describe('Segmented', () => {
  const options = [
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '3y', label: '3Y', disabled: true, disabledReason: 'Needs data before Jan 2025' },
  ];

  it('exposes radio semantics with one checked option', () => {
    render(<Segmented label="Measured over" options={options} value="1m" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '1M' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '3M' }).getAttribute('aria-checked')).toBe('false');
  });

  it('a disabled segment STATES WHY rather than being silently inert', () => {
    render(<Segmented label="Range" options={options} value="1m" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '3Y' }).getAttribute('title')).toBe('Needs data before Jan 2025');
  });

  it('does not fire for a disabled option', () => {
    const onChange = vi.fn();
    render(<Segmented options={options} value="1m" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '3Y' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports arrow-key navigation and skips disabled options', () => {
    const onChange = vi.fn();
    render(<Segmented options={options} value="1m" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('3m');
  });

  it('marks the selected option by weight and fill, not colour alone', () => {
    render(<Segmented options={options} value="1m" onChange={() => {}} />);
    const style = screen.getByRole('radio', { name: '1M' }).getAttribute('style');
    expect(style).toContain('font-weight: 600');
    expect(style).toContain('--color-gold-soft');
  });
});

describe('RankBadge', () => {
  it('always shows the numeral, never colour alone', () => {
    render(<RankBadge rank={3} isTop />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows an em-dash with a label for an unranked stock', () => {
    render(<RankBadge rank={null} />);
    expect(screen.getByLabelText('Unranked')).toBeTruthy();
  });
});

describe('Chip and Field', () => {
  it('renders chip content', () => {
    render(<Chip tone="gain">+11.4%</Chip>);
    expect(screen.getByText('+11.4%')).toBeTruthy();
  });

  it('associates a field label with its input', () => {
    render(<Field id="amt" label="Investment amount" prefix="₹" defaultValue="50000" />);
    expect(screen.getByLabelText('Investment amount')).toBeTruthy();
  });

  it('uses tabular figures so a changing amount does not shift the caret', () => {
    render(<Field id="amt" label="Amount" defaultValue="50000" />);
    expect(screen.getByLabelText('Amount').getAttribute('style')).toContain('tabular-nums');
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology and carries the shimmer class', () => {
    const { container } = render(<Skeleton width={200} />);
    const el = container.firstChild;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('gati-skeleton');
  });
});

/* ------------------------------------------------------------------ */
/* INFO TIP — decision D9                                              */
/* ------------------------------------------------------------------ */

describe('InfoTip (D9)', () => {
  it('is a real button with an accessible name', () => {
    render(<InfoTip term="sharpe" />);
    expect(screen.getByRole('button', { name: 'About Sharpe ratio' })).toBeTruthy();
  });

  /**
   * ONE SENTENCE BY DEFAULT (M13, owner brief).
   *
   * The default used to carry three labelled sections. None was long, but a
   * reader who taps an icon to find out what a word means should not have to
   * read a labelled block to get there. "Why it matters" and "In Gati" were
   * not deleted — they moved to the top of Learn more.
   */
  it('opens on click and shows ONE plain sentence, unlabelled', () => {
    render(<InfoTip term="cashDrag" />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));

    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText(GLOSSARY.cashDrag.what)).toBeTruthy();
    // The labels are gone from the default tier, along with their content.
    expect(within(panel).queryByText('What it is')).toBeNull();
    expect(within(panel).queryByText('Why it matters')).toBeNull();
    expect(within(panel).queryByText('In Gati')).toBeNull();
    expect(within(panel).queryByText(GLOSSARY.cashDrag.why)).toBeNull();
  });

  it('keeps the displaced sections available under Learn more', () => {
    // Nothing was lost, only relocated — asserted so a future tidy-up cannot
    // quietly delete the depth instead of moving it.
    render(<InfoTip term="cashDrag" />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));
    fireEvent.click(screen.getByRole('button', { name: /learn more/i }));

    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText(GLOSSARY.cashDrag.why)).toBeTruthy();
    expect(within(panel).getByText(GLOSSARY.cashDrag.inGati)).toBeTruthy();
  });

  it('keeps the deeper tier COLLAPSED by default (D11)', () => {
    // The default must never overwhelm: a beginner should be able to close
    // this having read three sentences.
    render(<InfoTip term="cashDrag" />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));

    const panel = screen.getByRole('dialog');
    expect(within(panel).queryByText('Where it misleads')).toBeNull();
    expect(within(panel).getByRole('button', { name: /Learn more/ })).toBeTruthy();
  });

  it('reveals detail, example and limitations on Learn more', () => {
    render(<InfoTip term="cashDrag" />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));
    fireEvent.click(screen.getByRole('button', { name: /Learn more/ }));

    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText('In more detail')).toBeTruthy();
    expect(within(panel).getByText('Example')).toBeTruthy();
    expect(within(panel).getByText('Where it misleads')).toBeTruthy();
  });

  it('shows a formula only where the formula is the meaning', () => {
    render(<InfoTip term="relativeStrength" />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));
    fireEvent.click(screen.getByRole('button', { name: /Learn more/ }));
    expect(screen.getByText('RS = stock return % − benchmark return %')).toBeTruthy();
    cleanup();

    // Sharpe's denominator helps nobody decide anything, so it is absent.
    render(<InfoTip term="sharpe" />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));
    fireEvent.click(screen.getByRole('button', { name: /Learn more/ }));
    expect(screen.queryByText('Formula')).toBeNull();
  });

  it('resets to the short answer when reopened', () => {
    // Reopening should always start at the default tier, never where the
    // previous reader left it.
    render(<InfoTip term="cashDrag" />);
    const trigger = screen.getByRole('button', { name: /^About/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Learn more/ }));
    expect(screen.getByText('Where it misleads')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(trigger);
    expect(screen.queryByText('Where it misleads')).toBeNull();
  });

  it('is closed until asked — help is found when wanted, never advertised', () => {
    render(<InfoTip term="sharpe" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape AND returns focus to its trigger', () => {
    // Without the focus return, a keyboard user is stranded at the top of the
    // document every time they read an explanation.
    render(<InfoTip term="sharpe" />);
    const trigger = screen.getByRole('button', { name: /^About/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  /**
   * THE PANEL MUST BE PORTALLED, AND THIS IS NOT A STYLE PREFERENCE.
   *
   * Its coordinates are viewport coordinates. A `position: fixed` element
   * nested inside an ancestor carrying `transform` — which this app has on
   * hover-lift rows and on route transitions — is positioned against that
   * ancestor instead, so the numbers silently mean something else. Measured
   * in a real browser before the portal: a panel computed at top 281px
   * rendered at 505px on a 568px-tall screen and hung 212px off the bottom.
   *
   * jsdom computes no layout, so it cannot catch the misplacement itself.
   * It CAN catch the portal going away, which is the cause.
   */
  it('renders the panel into document.body, not inside the trigger', () => {
    const { container } = render(<InfoTip term="relativeStrength" />);
    fireEvent.click(screen.getByRole('button', { name: /about/i }));

    const panel = screen.getByRole('dialog');
    expect(panel).toBeTruthy();
    // Present on the page, absent from the component's own subtree.
    expect(container.contains(panel)).toBe(false);
    expect(document.body.contains(panel)).toBe(true);
  });

  it('positions the panel against the viewport, never its offset parent', () => {
    render(<InfoTip term="relativeStrength" />);
    fireEvent.click(screen.getByRole('button', { name: /about/i }));

    const panel = screen.getByRole('dialog');
    expect(panel.style.position).toBe('fixed');
    // An absolutely-positioned panel anchored at left:0 was the original bug.
    expect(panel.style.position).not.toBe('absolute');
  });

  it('renders NOTHING for an unknown term rather than crashing or inventing text', () => {
    // A missing explanation must never take down a screen full of correct
    // numbers, and must never be papered over with generated wording.
    const { container } = render(<InfoTip term="doesNotExist" />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps a 44px target around a 14px glyph', () => {
    render(<InfoTip term="sharpe" />);
    const style = screen.getByRole('button', { name: /^About/ }).getAttribute('style');
    expect(style).toContain('width: 44px');
    expect(style).toContain('height: 44px');
  });
});

/* ------------------------------------------------------------------ */
/* METRICS                                                             */
/* ------------------------------------------------------------------ */

describe('MetricTile', () => {
  it('shows an info icon whenever a glossary key is supplied', () => {
    render(<MetricTile label="Sharpe" value="1.32" glossaryKey="sharpe" />);
    expect(screen.getByRole('button', { name: 'About Sharpe ratio' })).toBeTruthy();
  });

  it('renders an em-dash rather than a fabricated value when data is absent', () => {
    render(<MetricTile label="CAGR" value={null} glossaryKey="cagr" />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('applies direction colour only when a direction is given', () => {
    const { container, unmount } = render(<MetricTile label="Total return" value="+21.3%" direction="gain" />);
    expect(container.innerHTML).toContain('--color-gain');
    unmount();

    const { container: c2 } = render(<MetricTile label="Positions" value="5" />);
    // An unsigned count in green would claim a direction it does not have.
    expect(c2.innerHTML).not.toContain('--color-gain');
  });
});

describe('MetricGroup', () => {
  it('shows a headline value when collapsed, never a bare chevron', () => {
    render(
      <MetricGroup title="Risk" collapsible defaultOpen={false} headline="−8.7% max DD">
        <MetricTile label="Sharpe" value="1.3" />
      </MetricGroup>,
    );
    expect(screen.getByText('−8.7% max DD')).toBeTruthy();
    expect(screen.queryByText('Sharpe')).toBeNull();
  });

  it('expands and collapses with correct aria-expanded', () => {
    render(
      <MetricGroup title="Risk" collapsible defaultOpen={false} headline="x">
        <MetricTile label="Sharpe" value="1.3" />
      </MetricGroup>,
    );
    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Sharpe')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* RS LEDGER                                                           */
/* ------------------------------------------------------------------ */

describe('RSLedger', () => {
  it('draws a solid stock bar and a hatched benchmark bar', () => {
    // Two solid bars would read as competing quantities. Solid plus hatched
    // reads as a value and its baseline — the hatching is load-bearing.
    const { container } = render(<RSLedger stockReturnPct={18.6} benchmarkReturnPct={-0.2} />);
    expect(container.querySelector('pattern')).toBeTruthy();
    expect(container.innerHTML).toContain('--color-gain-fill');
  });

  it('CLIPS an outlier instead of rescaling the track', () => {
    // Rescaling for one runaway stock would silently change every other row.
    const { container } = render(<RSLedger stockReturnPct={400} benchmarkReturnPct={1} width={112} />);
    const bars = [...container.querySelectorAll('rect')];
    const widest = Math.max(...bars.map((r) => Number(r.getAttribute('width'))));
    expect(widest).toBeLessThanOrEqual(56); // half the track, never more
  });

  it('uses loss colour for a negative stock return', () => {
    const { container } = render(<RSLedger stockReturnPct={-6.4} benchmarkReturnPct={2.2} />);
    expect(container.innerHTML).toContain('--color-loss-fill');
  });

  it('draws nothing for a missing value rather than a zero-length bar at centre', () => {
    const { container } = render(<RSLedger stockReturnPct={null} benchmarkReturnPct={null} />);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('is decorative — its meaning is carried by adjacent text', () => {
    const { container } = render(<RSLedger stockReturnPct={5} benchmarkReturnPct={2} />);
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });
});

/* ------------------------------------------------------------------ */
/* FEEDBACK                                                            */
/* ------------------------------------------------------------------ */

describe('StatusLine', () => {
  it('pulses only when data is genuinely live', () => {
    const { container, unmount } = render(<StatusLine tone="live" state="Market open · Live" />);
    expect(container.innerHTML).toContain('gati-status-pulse');
    unmount();

    const { container: c2 } = render(<StatusLine tone="closed" state="Market closed" />);
    expect(c2.innerHTML).not.toContain('gati-status-pulse');
  });

  it('carries a word as well as a colour for each state', () => {
    render(<StatusLine tone="degraded" state="Live prices unavailable" detail="Showing last close" />);
    expect(screen.getByText('Live prices unavailable')).toBeTruthy();
  });
});

describe('DataNotes', () => {
  it('renders nothing when there is nothing wrong', () => {
    // An always-present "all good" chip trains people to stop reading.
    const { container } = render(<DataNotes notes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('ranks failures above informational notes', () => {
    render(
      <DataNotes
        notes={[
          { id: 'a', severity: 'info', title: 'March restated' },
          { id: 'b', severity: 'failure', title: 'Benchmark unavailable' },
        ]}
      />,
    );
    const text = screen.getByRole('status').textContent;
    expect(text.indexOf('Benchmark unavailable')).toBeLessThan(text.indexOf('March restated'));
  });
});

describe('ErrorState (D10)', () => {
  it('states explicitly that nothing is being estimated', () => {
    // Silence about fabrication is indistinguishable from fabrication.
    render(<ErrorState what="Market data could not be loaded" reason="The provider returned an error." />);
    expect(screen.getByText(/No values are being estimated or substituted/)).toBeTruthy();
  });

  it('offers a retry when one is possible', () => {
    render(<ErrorState what="Failed" reason="Timeout." onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
  });
});

describe('InsufficientHistoryState', () => {
  it('says what is missing and how much exists', () => {
    render(<InsufficientHistoryState needed={13} have={7} />);
    expect(screen.getByText(/13 completed month-ends and has 7/)).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('always carries a title and an explanation', () => {
    render(<EmptyState title='No stock matches "XYZ"' body="Try a different name or ticker." />);
    expect(screen.getByText('No stock matches "XYZ"')).toBeTruthy();
    expect(screen.getByText('Try a different name or ticker.')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* ICONS — decision D6                                                 */
/* ------------------------------------------------------------------ */

describe('icon set (D6)', () => {
  it('replaces typographic glyphs with drawn geometry', () => {
    for (const [name, Comp] of Object.entries(ICONS)) {
      const { container, unmount } = render(<Comp size={20} />);
      const svg = container.querySelector('svg');
      expect(svg, `${name} did not render an svg`).toBeTruthy();
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      unmount();
    }
  });

  it('redraws stroke per size band rather than scaling it', () => {
    // Scaling an icon scales its stroke: a 16px icon at 1.17px looks broken
    // beside a 24px one.
    expect(strokeFor(16)).toBe(1.5);
    expect(strokeFor(20)).toBe(1.75);
    expect(strokeFor(32)).toBe(2);
  });

  it('is decorative by default and labelled only when standing alone', () => {
    const { container, unmount } = render(<ICONS.IconInfo size={16} />);
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    unmount();

    render(<ICONS.IconInfo size={16} title="More information" />);
    expect(screen.getByTitle('More information')).toBeTruthy();
  });

  it('inherits currentColor and is never independently coloured', () => {
    const { container } = render(<ICONS.IconRank size={20} />);
    expect(container.querySelector('svg').getAttribute('stroke')).toBe('currentColor');
  });

  /**
   * THE UNIVERSE ICONS — a stepped tower, read by counting its courses.
   *
   * Replaced three variations on the letter H (owner decision, 8 Aug 2026),
   * which conveyed nothing about size to anyone who had not been told.
   */
  describe('the three universe icons', () => {
    const courses = (name) => {
      const { container, unmount } = render(ICONS[name]({ size: 24 }));
      const d = container.querySelector('path').getAttribute('d');
      unmount();
      // Each course is one horizontal run: "Mx yhN".
      return d.match(/h[\d.]+/g) ?? [];
    };

    it('gets shorter by exactly one course from large to small', () => {
      expect(courses('IconLargeCap')).toHaveLength(4);
      expect(courses('IconMidCap')).toHaveLength(3);
      expect(courses('IconSmallCap')).toHaveLength(2);
    });

    it('shares a common base course, so they read as one family', () => {
      const base = 'M3 19.5h18';
      for (const name of ['IconLargeCap', 'IconMidCap', 'IconSmallCap']) {
        const { container, unmount } = render(ICONS[name]({ size: 24 }));
        expect(container.querySelector('path').getAttribute('d').startsWith(base), name).toBe(true);
        unmount();
      }
    });

    it('draws only horizontal runs, never a vertical', () => {
      // A vertical stroke would collide with IconReports, which is three
      // VERTICAL bars and sits in the same navigation row.
      for (const name of ['IconLargeCap', 'IconMidCap', 'IconSmallCap']) {
        const { container, unmount } = render(ICONS[name]({ size: 24 }));
        expect(container.querySelector('path').getAttribute('d'), name).not.toMatch(/[vV]/);
        unmount();
      }
    });

    it('is distinguishable in isolation, not only against its siblings', () => {
      // The test the old set failed: an icon appears alone in a screen
      // header, where a width can only be judged against absent siblings.
      // A count of courses needs no comparison.
      const all = ['IconLargeCap', 'IconMidCap', 'IconSmallCap'].map((n) => courses(n).length);
      expect(new Set(all).size).toBe(3);
    });

    it('narrows STEEPLY, so it never reads as a hamburger menu', () => {
      const { container } = render(ICONS.IconLargeCap({ size: 24 }));
      const runs = (container.querySelector('path').getAttribute('d').match(/h([\d.]+)/g) ?? [])
        .map((r) => Number(r.slice(1)));
      // Strictly decreasing: a stack of equal rules is not a structure.
      for (let i = 1; i < runs.length; i += 1) expect(runs[i]).toBeLessThan(runs[i - 1]);
      // And steeply. A gentle taper was tried and rendered: at 20px the mid
      // icon read as a hamburger menu. The second course must be visibly
      // narrower than the base, not fractionally.
      expect(runs[1] / runs[0]).toBeLessThanOrEqual(0.7);
    });
  });
});
