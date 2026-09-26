# Roadmap — phased plan to a trustworthy live app

Companion to `TODO.md` (which tracks individual items). This file is the
*sequence*: what has to be true before the next thing is worth doing.

The ordering principle is simple and comes from the master prompt itself
(Section 39: "Financial accuracy is more important than visual appearance"):
**nothing downstream of the data is trustworthy until the data is.** So
correctness of inputs comes before polish, and anything that could make a
wrong number look authoritative is treated as high severity.

---

## Phase 0 — DONE (v0.1.0 → v0.10.0)

Engine, data layer, UI, PWA scaffold, 210 tests, an end-to-end integration
suite, and three financial-accuracy bugs found and fixed:

| Bug | Impact | Fixed in |
|---|---|---|
| Transaction costs never wired to the backtest | Every "net" figure was silently gross | v0.5.0 |
| Look-ahead bias in the Capital Calculator | Back-dated today's winners; flattered the strategy every month | v0.8.0 |
| Current Momentum compared today's price to itself | All returns 0.00%, ranking collapsed to a tie-break | v0.10.0 |

Also fixed: fabricated "last updated" timestamp, missing Section 21 columns,
CSV malformation and formula injection, unbounded request fan-out.

---

## Phase 1 — Make the real data real  ✅ **CLOSED (v0.14.3)**

**1.1 Verify Yahoo Finance live.** ✅ **14/14**, run against a local
`netlify dev`. Answers to the three questions this step existed to settle:

| Question | Answer |
|---|---|
| Which auth tier fires? | **Both** — see the correction below. |
| Do the index tickers serve? | **Yes**, all three benchmarks. |
| Is `GVT&D.NS` right? | **Yes**. Special characters survive encoding. |

**The correction that came with it.** "Which tier fires" turned out to have
two answers, not one, and assuming otherwise put a false claim in this
project's record for a release:

| Endpoint | Used by | Plain request | Tier |
|---|---|---|---|
| `v8/finance/chart` | history | 200 OK | `simple` |
| `v7/finance/quote` | live prices | **401** | **`crumb`** |

The crumb fallback is not a dormant hedge — it carries every live price. It
looked dormant because checks 1-9 all hit the chart endpoint, and the quote
checks printed no tier at all. Both now report it.

**1.2 Complete the constituent lists.** ✅ **DONE in v0.11.0** — all three
universes hold their full real lists (50 / 150 / 250), and as of v0.14.3
**all 453 configured symbols resolve against live Yahoo** (51/51, 151/151,
251/251 incl. benchmarks). That validates the tickers, not index membership;
provenance stays `'third-party-mirror'` until re-imported from NSE's CSV.

**1.3 Re-verify month-end and percentage accuracy against real prices.**
✅ **DONE in v0.12.0** using real NIFTY 50 history (Jan 2025 - Apr 2026),
validated against 13 known NSE holidays. Month-end detection: 0 mismatches.
Returns: exact.

**1.4 Full-range fetch check.** ✅ **DONE in v0.14.3.** Yahoo does not
truncate or paginate long ranges: 394 rows for a Jan-2025→today pull, first
row 2025-01-01, 19 months covered, longest gap 4 days (a long weekend).
Confirmed for two stocks and all three benchmarks.

**Exit criteria — all met:** ~~verification checks green~~ ✅ 14/14;
~~constituent lists complete~~ ✅; ~~month-end returns cross-checked against
an independent source~~ ✅ (v0.12.0); ~~full-range fetch confirmed~~ ✅.

**Carried into Phase 2:** every result above came from a residential IP.
Netlify serves from datacenter ranges that Yahoo treats differently, and the
quote endpoint already rejects plain requests even from a friendly IP.

---

## Phase 2 — Harden for real use

Only worth doing once Phase 1 proves the inputs are right.

**2.1 Rate-limit resilience.** ✅ **CLOSED in v0.17.1 — verified
unnecessary, not skipped.** The deferred trigger fired: the app was
deployed to Netlify (`gati2.netlify.app`) and tested from Netlify's own
servers for the first time. A full 50-symbol NIFTY 50 batch quote request
came back **50/50 resolved, 0 failures, 1.4 seconds, `authTier: "crumb"`
throughout**. No rate-limiting occurred, so retry-with-backoff isn't being
built — it would defend against a failure that didn't happen. If real 429s
ever show up in production later, that's the new trigger to revisit this.

**2.1b Handle a crumb-handshake failure specifically.** ✅ **DONE in v0.14.7.**
Quotes depend on the cookie+crumb handshake while history doesn't, so they
fail *independently* — confirmed in 1.1's correction. `fetchUniverseBundle`
now isolates the quote fetch: on failure, `quotes` stays an empty Map and
`quotesError` carries the reason, but historical data, rankings and the
backtest still load and render normally, since none of them read a live
quote. `LiveQuotesUnavailableNotice` (Strategy page) and a compact badge
(Dashboard card) surface it — "live prices unavailable, backtest still
shown" — distinct from `LiveDataErrorNotice`'s full-page treatment of a
real historical/benchmark failure.

**2.2 Stale/failed-symbol handling at scale.** ✅ **DONE in v0.14.5, extended
in v0.14.6.** With per-symbol tolerance (v0.14.5), a failed/excluded stock
gets one flagged row plus a summarising `UnavailableSymbolsNotice` ("N of
250 stocks excluded") above the table and a count badge on the dashboard
card — not scattered per-row badges as the only signal. v0.14.6 added a
known-cause/suggested-replacement lookup (`RENAMED_TICKERS`) on top of that
same summary, for the subset of failures that have already been
investigated.

**2.3 Corporate-action spot check.** ✅ **DONE in v0.14.8.**
`scripts/verify-split-adjustment.mjs` scanned all 450 configured symbols and
found **36 split/bonus events since Jan 2025** (BAJFINANCE, HDFCBANK,
KOTAKBANK, NESTLEIND, TRENT, BSE, MCX, TATAINVEST 10:1, ANGELONE 10:1 and
27 more). Spot-checked BAJFINANCE.NS's real 2:1 split (16 Jun 2025) through
the app's own `getMonthEndRecords` + `computeStockRS`, not a
reimplementation: **+2.01% stock vs +3.07% benchmark, RS −1.06pp, zero
flags.**

**The finding, which is worth stating because it wasn't what was assumed:**
Yahoo back-adjusts the raw `close` field too, so there is *no* price cliff
at an Indian split (13 Jun closed 933.10, 16 Jun 938.00 — no ~2x jump), and
`close` and `adjClose` yield the same return to 2dp. `adjClose` still
differs in level, carrying dividend adjustment on top. So the Section 6
preference for adjClose is correct but, **for splits specifically, is
belt-and-braces rather than the only thing preventing a phantom −50%
crash** — good to have established rather than assumed.

The `assertSameConvention` guard was separately re-confirmed on these same
real prices: with `adjClose` removed from one bar, it still refuses to
produce a number rather than mixing bases. Pinned as fixtures in
`realMarketData.test.js` so a future change in Yahoo's adjustment behaviour
trips a test rather than silently altering returns.

---

## Phase 3 — Complete the product surface

**3.1 PWA icons** — ✅ **DONE in v0.16.0.** No longer blocked: the app is
named **Gati** (गति, "momentum") and the full identity is generated from
code in `brand-src/`. Standard + maskable icon sets, apple-touch-icon and
favicons are installed and registered in the manifest. See `docs/BRAND.md`.
Remaining: confirm the maskable crop on a real Android device — folded into
3.3 below.

**3.2 Capital Calculator entry-basis refinement** — ✅ **DONE in v0.15.0.**
The third basis ("as if bought at a date I choose") is in. Picks come from
the last month-end ranking *strictly before* the chosen date, entered at
the next available open — deliberately not today's Top 5 priced backwards,
which would reintroduce the v0.8.0 look-ahead bug. See CHANGELOG v0.15.0.

**3.3 Visual/responsive review on real devices** — audited in code, never
seen rendered. Needs a browser.

---

## Phase 4 — Extend the strategy set

**Groundwork DONE in v0.17.0.** `runBacktest` takes `lookbackMonths`
(default 1, existing results bit-identical) and `src/config/strategies.js`
registers strategies as data. Adding 3/6/12-month momentum is now a
two-line entry there rather than an engine change.

**Deliberately not registered yet:** no longer-lookback variant is live.
Section 25 forbids building them pre-emptively, and each is a distinct
financial claim that should be chosen. *Waiting on a decision about which,
if any, to add.*

Only after Phases 1–2. Master prompt Section 25 lists candidates (3/6/12-month
momentum, dual momentum, 52-week high, MA filter, Minervini). Section 25 is
explicit that these are *not* to be built pre-emptively, and Section 34
requires each to be an independent module. The engine is already shaped for
this: `runBacktest` takes stocks/series/params and knows nothing about which
ranking rule produced the picks.

---

## Standing rules for every phase

From master prompt Sections 35, 37, 38 and 44:

1. Treat the current source as the single source of truth; never rebuild
   from scratch or fork a parallel version.
2. Smallest reliable change; don't rewrite unrelated modules.
3. Verify with `npm run lint && npm test && npm run build` before reporting
   anything as done.
4. Cross-verify any financial calculation that changes.
5. Never fabricate market data; flag gaps instead of computing around them.
6. Update version + CHANGELOG + TODO with every change.
7. If a requirement is financially ambiguous, ask before implementing logic
   that could materially change backtest results.
