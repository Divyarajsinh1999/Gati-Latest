/**
 * METHODOLOGY — the full, unhurried account of how Gati arrives at a number.
 *
 * WHAT THIS OWNS
 *   The eleven sections, each deep-linkable, each stating not only what
 *   happens but WHY it happens that way (decision D14.4).
 *
 * WHAT THIS MUST NEVER DO
 *   Be the only place a caveat appears. This is where a reader goes when they
 *   want the whole picture; the short version stays beside the figure it
 *   qualifies. Moving every caveat here would be hiding, not organising.
 *
 * ALL SECTIONS COLLAPSED ON ARRIVAL, except one reached by deep link — which
 * opens, because someone following a link from a specific caveat wants that
 * paragraph, not a table of contents.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { METHODOLOGY_SECTIONS, METHODOLOGY_VERSION } from '../../config/methodology.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button, Chip } from '../../components/primitives/index.jsx';
import { InfoTip } from '../../components/data/index.jsx';
import { IconChevronDown } from '../../design/icons.jsx';

export function MethodologyScreen() {
  const location = useLocation();
  const anchor = location.hash?.replace('#', '') || null;
  // The deep-linked section is DERIVED as open rather than set in an effect:
  // setting state from an effect renders twice and momentarily shows the
  // section closed, which is exactly what the link was trying to avoid.
  const [open, setOpen] = useState({});
  const [allOpen, setAllOpen] = useState(false);
  const isOpen = (id) => open[id] ?? id === anchor;

  useEffect(() => {
    if (!anchor) return;
    // Scrolling is a genuine side effect and belongs here.
    globalThis.document?.getElementById(anchor)?.scrollIntoView?.({ block: 'start' });
  }, [anchor]);

  const toggleAll = () => {
    const next = !allOpen;
    setAllOpen(next);
    setOpen(next ? Object.fromEntries(METHODOLOGY_SECTIONS.map((s) => [s.id, true])) : {});
  };

  return (
    <>
      <AppBar title="How this is calculated" subtitle={`Methodology v${METHODOLOGY_VERSION}`} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <Chip tone="neutral">v{METHODOLOGY_VERSION}</Chip>
        <InfoTip term="methodologyVersion" />
        <span style={{ marginLeft: 'auto' }}>
          <Button variant="quiet" onClick={toggleAll}>{allOpen ? 'Collapse all' : 'Expand all'}</Button>
        </span>
      </div>

      <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.55, color: 'var(--color-ink-muted)', maxWidth: 620 }}>
        Every number in Gati comes from one rule applied to published prices. This page states the rule, the
        conventions around it, and — just as importantly — what it cannot tell you.
      </p>

      <div style={{ marginTop: 20, border: '1px solid var(--color-line)', borderRadius: 10, overflow: 'hidden', background: 'var(--color-surface)' }}>
        {METHODOLOGY_SECTIONS.map((section, i) => (
          <MethodologySection
            key={section.id}
            section={section}
            isOpen={isOpen(section.id)}
            isLast={i === METHODOLOGY_SECTIONS.length - 1}
            onToggle={() => setOpen((prev) => ({ ...prev, [section.id]: !isOpen(section.id) }))}
          />
        ))}
      </div>
    </>
  );
}

function MethodologySection({ section, isOpen, isLast, onToggle }) {
  return (
    <section id={section.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-line)' }}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
          border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
          {section.title}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-ink-muted)', display: 'inline-flex', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}>
          <IconChevronDown size={18} />
        </span>
      </button>

      {isOpen ? (
        <div style={{ padding: '0 16px 16px' }}>
          {section.body.map((paragraph, i) => (
            <p key={i} style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.6, color: 'var(--color-ink-soft)', maxWidth: 620 }}>
              {paragraph}
            </p>
          ))}

          {/*
            Every section says WHY, not only what (decision D14.4). A rule
            without its reasoning is something to memorise rather than
            something to check.
          */}
          <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--color-surface-raised)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
              Why it works this way
            </span>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-ink-soft)' }}>
              {section.why}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
