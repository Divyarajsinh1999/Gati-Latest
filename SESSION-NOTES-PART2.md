# Session notes — RS Dashboard Part 2 → Part 3

Carry-forward summary. `HANDOFF.md` is the canonical entry point for the
project; this file records what happened in *this* session specifically and
why, so Part 3 doesn't re-derive it or reopen settled questions.

**Ended at: v0.14.5 · 264 tests passing · lint clean · builds clean**
(started this session at v0.14.1 / 251 tests)

---

## 1. Merged two diverged branches

Part 1 and this session had both moved forward independently:

- **Part 1's zip** had `assertSameConvention` in `momentum.js` — a fourth
  financial-accuracy guard refusing to compute a return when one price is
  `adjClose` and the other raw `close` (251 → 256 tests).
- **This session's tree** had `FORCE_AUTH_TIER` plus three verification
  scripts, which never made it into that zip.

Spec Section 37 forbids parallel versions, so Part 1's zip became the base
and this session's work was re-applied on top. **One tree again** — but
worth knowing this nearly went wrong, and could again if two chats work in
parallel without exchanging zips.

---

## 2. Phase 1 is closed

All four items done; all exit criteria met.

| # | Task | Result |
|---|---|---|
| 1.1 | Yahoo verified live | 14/14 checks |
| 1.2 | Constituent lists real | 453/453 tickers resolve (51/51, 151/151, 251/251) |
| 1.3 | Month-ends / returns match reality | 0 mismatches (v0.12.0) |
| 1.4 | Long ranges not truncated | 394 rows Jan-2025→today, longest gap 4 days |

Also measured: 453 symbols in ~7s at concurrency 6, **zero rate-limiting**.

**Carried into Phase 2, not Phase 1:** every one of those results came from
a *residential* IP. Netlify serves from datacenter ranges Yahoo treats
differently. Untested.

---

## 3. The correction that matters most

I stated in this session — and had written into the docs — that live
verification returned `authTier=simple` everywhere and that the cookie+crumb
fallback had therefore never executed, calling it "the untested branch."

**That was wrong**, in the direction that matters: it described a
load-bearing dependency as dead code.

| Endpoint | Used by | Plain request | Tier in practice |
|---|---|---|---|
| `v8/finance/chart` | `market-data.js` — history | 200 OK | `simple` |
| `v7/finance/quote` | `quote.js` — **live prices** | **401** | **`crumb`** |

Checks 1–9 of `verify-live-data.mjs` all hit the *chart* endpoint, so they
all printed `simple`. The two quote checks printed no tier at all. The
handshake was firing on **every quote request**, invisibly, during the
user's own verification run. Both quote checks now report `authTier`.

**Operational consequence — still live, still unaddressed:** live prices and
historical data now fail **independently**. If `fc.yahoo.com` stops setting
a cookie or `/v1/test/getcrumb` stops issuing crumbs, quotes die while the
backtest keeps working. That's a partial failure that won't look like an
outage. Tracked in `TODO.md`.

---

## 4. A false alarm, worth remembering

`verify-auth-fallback.mjs` reported `0/3 priced` and left an open "defect
requiring investigation" on the books for a full session. The cause: the
script read `body.quotes` as an **array**; it's an **object keyed by
symbol**. `Array.isArray()` yielded an empty list while `quote.js` was
returning correct prices the whole time.

The app was never affected — `YahooFinanceProvider` uses
`Object.entries(payload.quotes)` and had always been right.

**The lesson, recorded because this project has now been bitten by the
inverse three times:** a verification tool that raises a false alarm costs
as much trust as one that misses a real failure. Check the checker.

---

## 5. Two behaviour changes the user asked for directly

### v0.14.4 — no simulated data, ever
Previously a live-data failure was caught and silently re-run against
`MockProvider`, so the dashboard rendered numbers anyway, flagged as
synthetic via a banner. **The user was explicit: an honest error beats a
plausible fake number, however clearly labelled.** The fallback is deleted.
`SampleDataBanner` → `LiveDataErrorNotice`, which renders *only* the error.

⚠ **Do not re-add a fallback "for robustness" without asking.** This was a
considered instruction, not an oversight.

*(Intentional `VITE_DATA_PROVIDER=mock` mode is unaffected — that's a
deliberate choice, not a masked failure.)*

### v0.14.5 — one dead ticker ≠ dead dashboard
v0.14.4 exposed a pre-existing flaw: one failing symbol rejected the whole
universe fetch. Now each fetch resolves to either its series or a recorded
failure.

**The asymmetry is deliberate and tested — don't flatten it:**

| What fails | Result | Why |
|---|---|---|
| One stock | Row flagged, universe fine | Losing 1 of 250 costs one row |
| **Benchmark** | **Universe-wide error** | RS is stock *minus benchmark*; without it there's no ranking for anyone |
| **Every stock** | **Universe-wide error** | 250/250 is an outage, not 250 renames |

A failed stock stays **visible** as an unranked row — silently dropping it
from the universe would be its own kind of lie. Flagged with
`SYMBOL_UNAVAILABLE`, kept distinct from `MISSING_DATA` because the fixes
differ: one needs more history, the other needs the ticker corrected.

---

## 6. Tickers change — the standing rule

Confirmed live: the 2025 Tata Motors demerger **retired `TATAMOTORS.NS`**
(404s today). It produced two listings:

| Symbol | Rows | History starts | In a universe? |
|---|---|---|---|
| `TMCV.NS` | 180 | 2025-11-12 | No |
| `TMPV.NS` | 394 | 2025-01-01 | **Yes — NIFTY 50, already correct** |

Resolved: the config was already right. `TMPV.NS` kept the continuous
pre-demerger series. **No change was needed** — recorded so it isn't
reopened.

**Standing decision, not to be relitigated:** the app must never
auto-adopt a replacement ticker it found by itself. That risks pulling a
*different company's* prices into the rankings, presented with full
confidence — the worst failure this project can produce (Sections 40/41).
Flag it; suggest-and-confirm is acceptable; silent adoption is not.

`TATAMOTORS.NS` is a genuinely 404-ing NSE ticker, which makes it the
natural real fixture for testing rename-flagging.

---

## 7. Open items for Part 3

**Blocked on the user:**
- **The logo.** Asked three times, still unanswered. A candidate was
  supplied (an "MD" bar-chart mark, wordmark + square app icon). Two
  questions: (a) final or draft? (b) the wordmark reads **"My Dashboard"** —
  does the app get renamed to that everywhere (header, PWA
  `name`/`short_name`, `<title>`), or does it keep its current name with
  only the square mark used as the icon? Renaming touches
  `vite.config.js`, `index.html` and the app shell, so it isn't worth
  guessing.

**Ready to build:**
1. **Deploy and test from Netlify** — the last unknown about whether Yahoo
   behaves the same from a datacenter IP. Highest value per effort.
2. **Ticker-rename map** — v0.14.5 detects and reports a dead ticker
   precisely but doesn't suggest a replacement. A `RENAMED_TICKERS` map in
   `src/config/` makes a known change a one-line edit.
3. **Quote-only failure handling** — "live prices unavailable, backtest
   still valid" is a usable state and shouldn't look like total failure.
4. **Retry/backoff** (Phase 2.1) and **chart geometry assertions**
   (deferred with reasoning, see `TODO.md`).

---

## 8. Working conventions that held all session

1. Single source of truth — never rebuild or fork.
2. Smallest reliable change.
3. `npm run lint && npm test && npm run build` **before** reporting anything
   done. Held every time this session.
4. Never fabricate market data — now enforced in the product, not just
   documented.
5. Update version + `CHANGELOG.md` + `TODO.md` with every change.
6. Ask before implementing logic that could materially change backtest
   results.
