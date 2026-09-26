/**
 * IS THIS "TODAY"? — one rule, used by every surface that shows a day move.
 *
 * WHAT THIS OWNS
 *   The decision about whether a daily percentage may be labelled TODAY, and
 *   what to show when it may not.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS TO FIX
 *
 * On a Saturday the stock screen showed "Today −2.28%". There was no
 * trading session on Saturday; that figure was Friday's move, presented as
 * though it had just happened.
 *
 * The cause was that the engine treated "a quote object came back" as
 * "these are live figures". Yahoo returns a quote at the weekend — it is
 * simply the last session's, complete with `regularMarketChangePercent`.
 * The presence of a response says nothing about when the trading happened.
 *
 * THE RULE: a day change may be called TODAY only when the session it
 * describes IS today's session in IST. That is a comparison of two dates,
 * not an inference from whether a network call succeeded.
 *
 *   dailyChangeAsOf   the IST trading date the figure belongs to, from the
 *                     quote's own timestamp, or from the last bar's date
 *   session.tradingDate  today, in IST, from the centralised session
 *
 * Equal -> today. Not equal -> not today, and the honest answer is a dash.
 *
 * WHY A DASH AND NOT THE LAST SESSION'S NUMBER
 * "Today: —" and "Today: −2.28%" are read in a quarter of a second and one
 * of them is false. There is no framing of a number that undoes being under
 * a label that says TODAY. The previous session's move is not lost: it is
 * still on the chart and still in the month figure, where it is true.
 *
 * WHY NOT ZERO
 * 0% is a claim that the stock did not move today. On a Sunday nothing
 * moved because nothing traded, and those are different statements — one is
 * a fact about a stock, the other about the calendar.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { formatPct } from '../utils/formatters.js';

/**
 * Why a day change is not being shown. Used for the sublabel, so the reader
 * gets a reason rather than a bare dash.
 */
const REASON = {
  WEEKEND: 'No trading today',
  HOLIDAY: 'Exchange holiday',
  NO_SESSION: 'No session yet today',
  MISSING: 'Not available',
};

/**
 * @param {object} row               a row carrying dailyChangePct / dailyChangeAsOf
 * @param {object} session           from useMarketSession — the single source of truth
 * @returns {{
 *   applicable: boolean,
 *   pct: number|null,
 *   label: string,
 *   direction: 'gain'|'loss'|null,
 *   isLive: boolean,
 *   reason: string|null,
 * }}
 */
export function resolveTodayChange(row, session) {
  const pct = row?.dailyChangePct ?? null;
  const asOf = row?.dailyChangeAsOf ?? null;

  // No session object (a pure selector called without one, or the very first
  // render) — fall back to NOT claiming today. The safe direction is silence.
  const tradingDate = session?.tradingDate ?? null;

  const notToday = (reason) => ({
    applicable: false,
    pct: null,
    label: '—',
    direction: null,
    isLive: false,
    reason,
  });

  if (session?.status === 'WEEKEND') return notToday(REASON.WEEKEND);
  if (session?.status === 'HOLIDAY') return notToday(REASON.HOLIDAY);
  if (pct == null || !Number.isFinite(pct)) return notToday(REASON.MISSING);

  // The decisive comparison. A weekday before the open lands here too: the
  // newest figure is still yesterday's, and yesterday is not today.
  if (!asOf || !tradingDate || asOf !== tradingDate) return notToday(REASON.NO_SESSION);

  return {
    applicable: true,
    pct,
    label: formatPct(pct),
    direction: pct >= 0 ? 'gain' : 'loss',
    // "Live" is a stronger claim than "today": it also needs the exchange to
    // be trading right now, which only the session can say.
    isLive: Boolean(session?.isLive),
    reason: null,
  };
}
