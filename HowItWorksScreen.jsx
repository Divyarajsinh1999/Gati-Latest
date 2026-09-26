/**
 * HOW GATI WORKS — the page you hand somebody on day one.
 *
 * WHAT THIS OWNS
 *   Presentation of `config/howItWorks.js`. No content lives here.
 *
 * WHAT THIS MUST NEVER DO
 *   Restate methodology. Where a fuller technical account exists, a topic
 *   links to `/methodology#section`. Two prose accounts of the same rule
 *   drift apart, and the one a reader happens to find becomes the one they
 *   believe.
 *
 * CHAPTERS COLLAPSED ON ARRIVAL, except the first.
 *
 * Six chapters open at once is the wall of text the brief rules out — and a
 * reader who opens this page is usually after one thing, not all of it. The
 * first chapter opens because a page that is entirely shut looks broken and
 * gives no sense of what the rest contains.
 *
 * The DEPTH is optional within a topic too: every one answers in a sentence
 * or two, and only some carry a "More" line underneath. A reader can finish
 * a chapter having read six sentences, which is the point.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOW_IT_WORKS } from '../../config/howItWorks.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button } from '../../components/primitives/index.jsx';
import { InfoTip } from '../../components/data/index.jsx';
import { IconChevronDown } from '../../design/icons.jsx';

export function HowItWorksScreen() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => new Set([HOW_IT_WORKS[0].id]));

  const toggle = useCallback((id) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <>
      {/* Top-level destination since M14 — see PortfolioScreen for why the
          back control went. */}
      <AppBar eyebrow="ORIENTATION" title="How Gati works" />

      <p
        style={{
          margin: '4px 0 20px',
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--color-ink-soft)',
          maxWidth: 620,
        }}
      >
        Gati measures how strongly a stock is performing against its own benchmark, and shows you the
        leaders. Everything below explains a number you will see somewhere in the app.
      </p>

      {HOW_IT_WORKS.map((chapter) => {
        const isOpen = open.has(chapter.id);
        return (
          <section key={chapter.id} style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => toggle(chapter.id)}
              aria-expanded={isOpen}
              aria-controls={`chapter-${chapter.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                minHeight: 60,
                padding: '12px 16px',
                textAlign: 'left',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
                borderRadius: isOpen ? '10px 10px 0 0' : 10,
                cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                  }}
                >
                  {chapter.title}
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 2,
                    fontFamily: 'var(--font-display)',
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {chapter.summary}
                </span>
              </span>
              <IconChevronDown
                size={16}
                style={{
                  flexShrink: 0,
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 160ms ease',
                  color: 'var(--color-ink-muted)',
                }}
              />
            </button>

            {isOpen ? (
              <div
                id={`chapter-${chapter.id}`}
                style={{
                  border: '1px solid var(--color-line)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  background: 'var(--color-surface)',
                }}
              >
                {chapter.topics.map((topic, index) => (
                  <Topic
                    key={topic.term}
                    topic={topic}
                    isLast={index === chapter.topics.length - 1}
                    onMethodology={(id) => navigate(`/methodology#${id}`)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}

      <div style={{ marginTop: 20 }}>
        <Button variant="quiet" onClick={() => navigate('/methodology')}>
          The full technical methodology →
        </Button>
      </div>
    </>
  );
}

function Topic({ topic, isLast, onMethodology }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-line)',
      }}
    >
      <h3
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--color-ink)',
        }}
      >
        {topic.term}
        {/* The same tooltip as everywhere else — one definition, one place. */}
        {topic.glossary ? <InfoTip term={topic.glossary} /> : null}
      </h3>

      <p
        style={{
          margin: '5px 0 0',
          fontFamily: 'var(--font-display)',
          fontSize: 13.5,
          lineHeight: 1.6,
          color: 'var(--color-ink-soft)',
          maxWidth: 620,
        }}
      >
        {topic.plain}
      </p>

      {/* Optional second layer. A reader can stop after the sentence above. */}
      {topic.detail ? (
        <p
          style={{
            margin: '7px 0 0',
            paddingLeft: 10,
            borderLeft: '2px solid var(--color-line)',
            fontFamily: 'var(--font-display)',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'var(--color-ink-muted)',
            maxWidth: 620,
          }}
        >
          {topic.detail}
        </p>
      ) : null}

      {topic.methodology ? (
        <button
          type="button"
          onClick={() => onMethodology(topic.methodology)}
          style={{
            marginTop: 8,
            minHeight: 32,
            padding: '0 2px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.04em',
            color: 'var(--color-gold)',
          }}
        >
          TECHNICAL DETAIL →
        </button>
      ) : null}
    </div>
  );
}
