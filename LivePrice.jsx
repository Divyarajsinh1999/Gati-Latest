/**
 * THE LIVE DOT — shown only when the price is genuinely updating.
 *
 * WHAT THIS OWNS
 *   One green dot, and the words beside the price.
 *
 * WHAT THIS MUST NEVER DO
 *   Decide for itself whether anything is live. Every input comes from
 *   `useMarketSession`, which is the single authority, and from the Today
 *   rule that already decided whether the figures belong to today.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * "LIVE" IS THE MOST EXPENSIVE WORD IN A FINANCIAL INTERFACE
 *
 * A reader who believes a number is live will act on it. So the dot needs
 * every one of these to be true at once, and `session.isLive` already
 * carries all four:
 *
 *   the exchange is actually trading      not a weekend, holiday, or 4pm
 *   the device is online                  a cached figure is not a live one
 *   the data is real                      never for sample/mock figures
 *   the newest bar is from today          an open market with stale data is
 *                                         the worst case, and the loudest
 *
 * A session that is technically OPEN is NOT sufficient. If the last quote
 * came back an hour ago and nothing has updated since, the market being
 * open makes the stale number more dangerous, not less.
 *
 * THE ANIMATION IS DELIBERATELY ALMOST NOTHING
 * A 2-second opacity fade between 1 and 0.45, on a 7px dot. It reads as
 * breathing rather than blinking. Anything faster or higher-contrast turns
 * a data-integrity signal into an attention-grab, and this sits beside a
 * number the reader is trying to think about. It also honours
 * prefers-reduced-motion, where it becomes a static dot — the MEANING is
 * carried by the dot's presence and by the word "Live", never by movement.
 * ═══════════════════════════════════════════════════════════════════════
 */

export function LiveDot({ isLive }) {
  if (!isLive) return null;
  return (
    <span
      className="gati-status-pulse"
      // Decorative: the word "Live" in the sublabel carries the same meaning
      // in text, so announcing a dot would only repeat it.
      aria-hidden="true"
      style={{
        width: 7,
        height: 7,
        borderRadius: 999,
        background: 'var(--color-gain-fill)',
        flexShrink: 0,
        // A faint halo so the dot reads as lit rather than as a bullet point.
        boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-gain-fill) 18%, transparent)',
      }}
    />
  );
}

/**
 * The label above the price, and the line beneath it.
 *
 * When the market is shut the heading changes from "Price" to "Last price".
 * That single word does more than any badge: it tells the reader what they
 * are looking at before they read the number, rather than qualifying it
 * afterwards.
 *
 * @param {object} args
 * @param {object} args.session  from useMarketSession
 * @param {string|null} args.priceDate  the session the price is from
 * @param {string|null} args.tradeTime  the provider's own timestamp, if any
 */
export function describePrice({ session, priceDate, tradeTime }) {
  if (session?.isLive) {
    return { label: 'Price', sublabel: tradeTime ? `Live · ${tradeTime}` : 'Live' };
  }

  // Not live. Say which session the number is from, so it can be checked.
  // A date is used rather than a time: the provider's timestamp is reliable
  // to the day but not always to the minute after hours, and a precise-
  // looking time that is wrong is worse than no time at all.
  const when = priceDate ? ` · ${priceDate}` : '';

  if (session?.status === 'WEEKEND') return { label: 'Last price', sublabel: `Market closed${when}` };
  if (session?.status === 'HOLIDAY') {
    return { label: 'Last price', sublabel: `${session.holiday?.name ?? 'Exchange holiday'}${when}` };
  }
  if (session?.freshness === 'sample') return { label: 'Sample price', sublabel: 'NOT real market data' };
  if (session?.freshness === 'cached') return { label: 'Last price', sublabel: `Offline${when}` };
  if (session?.freshness === 'delayed') return { label: 'Last price', sublabel: `Market open, data delayed${when}` };

  return { label: 'Last price', sublabel: `Last close${when}` };
}
