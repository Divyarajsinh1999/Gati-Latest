/**
 * Known ticker renames/delistings, keyed by the OLD symbol as it appears
 * (or appeared) in universes.js.
 *
 * This is DISPLAY-ONLY. It exists so a failed fetch can show a human a
 * *suggestion* to verify, not so the app can silently swap symbols itself.
 *
 * Standing decision (recorded in TODO.md, not to be relitigated): the app
 * must NEVER auto-adopt a guessed replacement ticker. Indian corporate
 * actions (demergers, name changes) can produce two or more successor
 * listings, and guessing wrong means confidently pulling a DIFFERENT
 * company's prices into the rankings — spec Sections 40/41 rank that as
 * the worst failure this project can produce, worse than an honest gap.
 * A suggestion shown to a human for them to confirm and paste into
 * universes.js is fine; the app doing it unattended is not.
 *
 * `suggestedReplacement: null` is itself meaningful — it means "confirmed
 * dead, and confirmed that no fix is needed" (see TATAMOTORS.NS below),
 * as distinct from a symbol that just isn't in this map at all, which
 * means "unrecognised failure, no known cause yet."
 */
export const RENAMED_TICKERS = {
  'TATAMOTORS.NS': {
    suggestedReplacement: null,
    note:
      'Retired by the 2025 Tata Motors demerger. Two successor listings ' +
      'exist (TMCV.NS, TMPV.NS); NIFTY 50 already carries TMPV.NS (the ' +
      'continuing/passenger-vehicle entity), which has the unbroken ' +
      '2025-01-01-onward series. Confirmed 31 Jul 2026 — no config change ' +
      'needed. Kept here as a live, real-world regression fixture for this ' +
      'flagging behaviour, not because anything is currently broken.',
  },
};

/**
 * Look up a known rename/delisting for a symbol. Returns null (not
 * undefined) when nothing is known, so callers can treat "no suggestion"
 * uniformly whether the map has no entry or an explicit null replacement.
 */
export function getRenameSuggestion(symbol) {
  return RENAMED_TICKERS[symbol] ?? null;
}
