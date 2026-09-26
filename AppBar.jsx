/**
 * PAGE HEAD — the eyebrow, title and context row that opens every screen.
 *
 * WHAT THIS OWNS
 *   Naming the screen the reader is on, and hosting the universe tab strip.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * M14 (D18) TURNED A STICKY BAR INTO A PAGE HEAD, and the reason is arithmetic
 * rather than taste.
 *
 * The terminal shell already has a sticky topbar (66px) and a sticky ticker
 * tape (31px). Keeping this sticky too would have put THREE fixed bars above
 * every screen — 153px of permanent chrome on a 844px phone, or 18% of the
 * viewport, to say things two of the three already said. The topbar carries
 * identity and the breadcrumb names the screen, so the brand mark and the
 * sticky behaviour both became duplication.
 *
 * WHAT WAS KEPT RATHER THAN DROPPED WITH THE BAR:
 *   - the title and subtitle, now at page-head scale
 *   - the window chip, which is the only place the active measurement window
 *     is stated on a universe screen
 *   - `onBack`, still a real 44px control on the eleven screens that pass it
 *
 * WHAT WENT: the scroll-compression logic and its scroll listener. A head
 * that does not stick has nothing to compress, so the listener would have
 * been a re-render on every scroll frame in exchange for nothing. The brand
 * mark went with it — it is in the sidebar on every screen now.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { IconChevronLeft } from '../../design/icons.jsx';

/**
 * @param {object}    props
 * @param {string}    props.title
 * @param {string}   [props.subtitle]   benchmark, or a one-line description
 * @param {string}   [props.eyebrow]    small mono label above the title
 * @param {string}   [props.context]    appended to the ACCESSIBLE NAME only
 * @param {React.ReactNode} [props.windowChip]
 * @param {React.ReactNode} [props.aside] right-hand slot — the universe tabs
 * @param {() => void} [props.onBack]
 */
export function AppBar({ title, subtitle, eyebrow, context, windowChip, aside, onBack }) {
  return (
    <header className="gati-page-head">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, marginLeft: -12, border: 'none',
              background: 'transparent', cursor: 'pointer', color: 'var(--color-ink)',
              flexShrink: 0,
            }}
          >
            <IconChevronLeft size={20} />
          </button>
        ) : null}

        <div style={{ minWidth: 0 }}>
          {eyebrow ? <div className="gati-eyebrow">{eyebrow}</div> : null}
          {/*
            THE HEADING NAMES THE UNIVERSE EVEN WHEN THE VISIBLE TITLE DOES NOT.

            The reference build's h1 names the screen and nothing else, with
            the universe living only in the tab strip. That works there
            because it has one URL. Gati has three, and a screen-reader user
            landing on /midcap150 would otherwise hear exactly what they hear
            on /nifty50 — the h1 would stop identifying the page.

            `context` is appended inside the h1 and hidden visually, so the
            accessible name is "Dashboard — NIFTY 50" while the visible title
            stays as designed. The visible text remains a prefix of the
            accessible name, which is what WCAG 2.5.3 requires.
          */}
          <h1>
            {title}
            {context ? <span className="gati-visually-hidden"> — {context}</span> : null}
          </h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      {/*
        Right-hand slot. Wraps beneath the title on a narrow screen rather
        than squeezing it, which is what `flex-wrap` on the head is for — and
        once it has wrapped it takes the full width and CENTRES, so the
        universe strip lands in the middle of a phone rather than hanging off
        the left edge under the subtitle (owner, 28 Aug 2026). See
        `.gati-page-head-aside` in index.css.
      */}
      {(aside || windowChip) ? (
        <div className="gati-page-head-aside">
          {windowChip ?? null}
          {aside ?? null}
        </div>
      ) : null}
    </header>
  );
}
