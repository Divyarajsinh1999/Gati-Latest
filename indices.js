/**
 * THE HOME INDEX STRIP — which indices, and under which symbols.
 *
 * WHAT THIS OWNS
 *   Four verified index tickers and their display names. Data, no behaviour.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EVERY SYMBOL HERE WAS VERIFIED AGAINST YAHOO'S OWN QUOTE PAGE, 8 Aug 2026
 *
 * Standing decision S4 forbids adopting a ticker the app guessed at. A
 * plausible-looking symbol that resolves to a DIFFERENT instrument puts
 * another index's numbers on the home screen under this one's name, and
 * nothing downstream can detect it — the values are well-formed, they are
 * simply the wrong index's.
 *
 * Two of these are genuinely counter-intuitive and would have been guessed
 * wrong:
 *
 *   ^NSMIDCP  is NIFTY NEXT 50, despite reading like a midcap symbol.
 *             NIFTY MIDCAP 50 is a different index at ^NSEMDCP50.
 *   ^CNXAUTO  not ^NSEAUTO, which does not exist.
 *
 * ETF proxies were considered and rejected. JUNIORBEES tracks NIFTY NEXT 50
 * but trades near ₹300 while the index sits near 71,000 — an ETF price is
 * not an index level, and printing one under an index's name would be a
 * fabricated value.
 *
 * VERIFY BEFORE CHANGING. Open finance.yahoo.com/quote/<SYMBOL> and confirm
 * both the name and that the level is the right order of magnitude.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ON QUOTE TIERS: Yahoo labels ^CNXAUTO a real-time quote and ^NSEBANK and
 * ^NSMIDCP delayed. The strip therefore never states a per-index latency of
 * its own — it reports the timestamp Yahoo returns with each quote and lets
 * the session banner make the one live/closed claim. Inventing a uniform
 * "real-time" badge across a mixed set would be the misleading part.
 *
 * ON VOLUME: Yahoo reports volume 0 for these index symbols. The strip does
 * not show a volume figure for an index, rather than showing a zero that
 * looks like "nothing traded".
 */

export const HOME_INDICES = [
  { symbol: '^NSEI', name: 'NIFTY 50', short: 'NIFTY 50' },
  { symbol: '^NSMIDCP', name: 'NIFTY NEXT 50', short: 'NEXT 50' },
  { symbol: '^NSEBANK', name: 'NIFTY BANK', short: 'BANK' },
  { symbol: '^CNXAUTO', name: 'NIFTY AUTO', short: 'AUTO' },
];

/** Symbols only — what the quote request actually sends. */
export const HOME_INDEX_SYMBOLS = HOME_INDICES.map((index) => index.symbol);
