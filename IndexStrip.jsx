/**
 * THE TICKER TAPE — four indices, one line, above everything else.
 *
 * WHAT THIS OWNS
 *   Presentation. The symbols are verified in `config/indices.js`, the fetch
 *   is one batched request in `useIndexQuotes`, and the live/closed claim
 *   belongs to `useMarketSession`. This file decides only what it looks like.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * M14 (D18) TURNED FOUR CARDS INTO A TAPE.
 *
 * The cards were 132px each and 62px tall — roughly 250px of vertical space
 * on a phone, above the fold, for context rather than content. The reference
 * build's tape is 31px and puts the same four levels on one mono line, which
 * is what an exchange board actually looks like and gives the screen its
 * height back.
 *
 * THE HONESTY RULES SURVIVED THE FORMAT CHANGE, and they are the reason this
 * is not just a CSS edit:
 *   - the "last close" note is still said ONCE for the session, not four
 *     times, because it is a property of the session and not of any index;
 *   - a missing index still says so in words. A dash on a tape next to three
 *     live levels reads as "unchanged", which is a claim about the market
 *     rather than about the request that failed.
 *
 * WHY IT STILL SCROLLS RATHER THAN COMPRESSES
 *   Four five-figure levels do not fit 390px. Scrolling keeps every number
 *   at a readable size and costs a gesture the reader already knows. The
 *   reference build's answer was `display:none` on everything past the
 *   second — which is not a smaller tape, it is a shorter one, and the two
 *   hidden indices are gone with no way to reach them.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { useIndexQuotes } from '../../hooks/useIndexQuotes.js';
import { useMarketSession } from '../../hooks/useMarketSession.js';
import { formatNumber, formatPct } from '../../utils/formatters.js';

export function IndexStrip() {
  const { indices, isLoading, isError } = useIndexQuotes();
  const { isLive } = useMarketSession();

  return (
    <section aria-label="Market indices" className="gati-tape-wrap">
      {/*
        SAID ONCE, NOT FOUR TIMES.

        Every card used to carry its own "LAST CLOSE" tag. Four identical
        labels in a row of four cards is a pattern the eye stops reading, and
        it competed with the figures it was qualifying. It is a property of
        the SESSION, not of any one index, so it belongs above them — where
        it also reads as a single honest statement rather than a repeated
        disclaimer.
      */}
      <div
        /*
          A scrollable region has to be focusable, or a keyboard user can
          reach the cards before the fold and never the ones past it — there
          is no other way to move the scrollport. Named as well, so the focus
          stop announces what it is rather than "group".
        */
        tabIndex={0}
        role="group"
        aria-label="Index levels — scroll sideways for more"
        style={{
          // The tape is a horizontal scroller inside a vertically scrolling
          // page. Without this, a slightly-diagonal swipe steals the gesture
          // from the page and the whole screen feels stuck.
          touchAction: 'pan-x',
        }}
        className="gati-ticker-tape gati-no-scrollbar"
      >
        {indices.map((index) => (
          <IndexTick key={index.symbol} index={index} isLoading={isLoading} isError={isError} />
        ))}

        {/*
          SAID ONCE, NOT FOUR TIMES. Every card used to carry its own "LAST
          CLOSE" tag; four identical labels in a row is a pattern the eye
          stops reading, and it competed with the figures it qualified. It is
          a property of the SESSION, so it sits at the end of the tape as a
          single honest statement rather than a repeated disclaimer.
        */}
        {!isLive && !isLoading ? (
          <span className="gati-tape-note">LAST CLOSE — MARKET NOT TRADING</span>
        ) : null}
      </div>
    </section>
  );
}

function IndexTick({ index, isLoading, isError }) {
  const { changePct, value, isMissing } = index;
  const direction = changePct == null ? null : changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat';

  const colour =
    direction === 'up' ? 'var(--color-gain)' : direction === 'down' ? 'var(--color-loss)' : 'var(--color-ink-muted)';

  return (
    <span className="gati-tick">
      <b>{index.name}</b>

      {isLoading && value == null ? (
        <span className="gati-skeleton" aria-hidden="true" style={{ display: 'inline-block', width: 54, height: 9 }} />
      ) : isMissing ? (
        /*
          Not a dash. A dash on a tape beside three live levels reads as
          "unchanged", which is a claim about the market rather than about
          the request.
        */
        <em style={{ color: 'var(--color-ink-muted)' }}>{isError ? 'unavailable' : 'no data'}</em>
      ) : (
        <>
          {formatNumber(Number(value.toFixed(2)))}
          <em style={{ color: colour }}>
            {/* A glyph as well as a colour — the direction survives without it. */}
            <span aria-hidden="true">{direction === 'up' ? '\u25b2' : direction === 'down' ? '\u25bc' : '\u25a0'}</span>
            {formatPct(changePct)}
          </em>
        </>
      )}
    </span>
  );
}
