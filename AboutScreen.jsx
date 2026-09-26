/**
 * ABOUT GATI.
 *
 * WHAT THIS OWNS
 *   Presentation of `config/about.js`. No copy lives here.
 *
 * NOT COLLAPSIBLE, unlike How Gati works.
 *
 * That page is a reference someone returns to for one topic, so hiding five
 * of six chapters serves them. This is six short paragraphs read once, in
 * order, and collapsing a brand statement into accordions would make a
 * reader work to find out what the product is.
 *
 * The disclaimer sits INSIDE the reading path, directly after the prose and
 * before the credits — not in a footer under a horizontal rule where it
 * reads as boilerplate to be skipped. It is the sentence that qualifies the
 * most persuasive text in the application, so it goes where that text is.
 */

import { useNavigate } from 'react-router-dom';
import { ABOUT_SECTIONS, ABOUT_DISCLAIMER, ABOUT_CREDITS, GATI_MEANING } from '../../config/about.js';
import { METHODOLOGY_VERSION } from '../../config/methodology.js';
import { AppBar } from '../../components/layout/AppBar.jsx';
import { Button } from '../../components/primitives/index.jsx';

export function AboutScreen() {
  const navigate = useNavigate();

  return (
    <>
      <AppBar title="About Gati" onBack={() => navigate('/settings')} />

      {/* The name, and what it means. The Devanagari is the mark's own
          letterform, so the page opens on the thing the icon has been
          showing the reader since they installed it. */}
      <section
        style={{
          padding: '20px 16px',
          borderRadius: 12,
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-line)',
        }}
      >
        <div
          lang="sa"
          style={{
            fontSize: 34,
            lineHeight: 1.1,
            color: 'var(--color-gold)',
            letterSpacing: '-0.01em',
          }}
        >
          {GATI_MEANING.script}
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)',
          }}
        >
          <strong style={{ color: 'var(--color-ink)' }}>{GATI_MEANING.transliteration}</strong> —{' '}
          {GATI_MEANING.language} for {GATI_MEANING.meaning}.
        </p>
      </section>

      {ABOUT_SECTIONS.map((section) => (
        <section key={section.id} style={{ marginTop: 24 }}>
          <h2
            style={{
              margin: '0 0 6px',
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-ink)',
            }}
          >
            {section.title}
          </h2>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 13.5,
              lineHeight: 1.65,
              color: 'var(--color-ink-soft)',
              maxWidth: 620,
            }}
          >
            {section.body}
          </p>
        </section>
      ))}

      {/* In the reading path, not a footnote. */}
      <section
        style={{
          marginTop: 28,
          padding: 16,
          borderRadius: 10,
          background: 'var(--color-warn-soft)',
          border: '1px solid var(--color-line)',
        }}
      >
        <h2
          style={{
            margin: '0 0 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
          }}
        >
          Important
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--color-ink)',
            maxWidth: 620,
          }}
        >
          {ABOUT_DISCLAIMER}
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <div
          style={{
            border: '1px solid var(--color-line)',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--color-surface)',
          }}
        >
          <Credit label={ABOUT_CREDITS.developerLabel} value={ABOUT_CREDITS.developer} />
          <Credit label={ABOUT_CREDITS.contactLabel}>
            {/*
              A real mailto, not text to be copied by hand. `noreferrer` on a
              mail link costs nothing and keeps the habit consistent with
              every other outbound link in the app.
            */}
            <a
              href={`mailto:${ABOUT_CREDITS.email}`}
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                /*
                  44px, not 32. The one control on this screen a reader is
                  actually likely to tap on a phone is the one that opens
                  their mail app — raised in the v1.6.5 audit, which found it
                  at 217x32 on every phone viewport.
                */
                minHeight: 44,
                paddingBlock: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--color-gold)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                wordBreak: 'break-all',
              }}
            >
              {ABOUT_CREDITS.email}
            </a>
          </Credit>
          <Credit label="Methodology version" value={`v${METHODOLOGY_VERSION}`} isLast />
        </div>
      </section>

      <div style={{ marginTop: 20 }}>
        <Button variant="quiet" onClick={() => navigate('/how-it-works')}>
          How Gati works →
        </Button>
      </div>
    </>
  );
}

function Credit({ label, value, children, isLast }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-line)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          color: 'var(--color-ink-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ marginLeft: 'auto', minWidth: 0 }}>
        {children ?? (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, color: 'var(--color-ink)' }}>
            {value}
          </span>
        )}
      </span>
    </div>
  );
}
