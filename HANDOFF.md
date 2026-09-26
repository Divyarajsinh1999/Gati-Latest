# HANDOFF

## STATUS — v1.2.0-rc.1 · 7 Aug 2026

**M12 complete. RELEASE CANDIDATE.** Awaiting owner review.

```
lint       clean
typecheck  clean (0 errors)
tests      1379 passed (58 files)
build      clean
size       index 42.8 kB · initial 120.9 kB gzip / 200 kB      PASS
perf       heavy 149.2ms · light 0.06ms · sizing 0.04ms        PASS
a11y       0 serious, 0 critical (8 screens + 3 overlays)      PASS
live       month-end 2026-07-31 @ 1307.80, identical to the M9 run
```

### On the version number

**v1.0.0 was tagged at M10**, before Manual Portfolio and Stock Detail existed.
This RC therefore carries two feature milestones beyond it, so `1.2.0-rc.1` is
the honest number. Calling it "RC for v1.0" would understate what has shipped.

### What M12 found

Four defects, three of them things previously reported as working:

- A **duplicated calculation** — the Investment Simulator's sizing existed
  twice, in a selector and in an unused engine
- **Snapshot comparison had never run.** Built M3/M4, fully tested, never
  called. Third instance after keyboard shortcuts and offline
- `/api/market-data`, due for removal after M3, still deployed
- CSV exports rendered on two screens

### No open decisions

D1–D16 are all accepted. The roadmap is complete; anything further is a
targeted fix or refinement rather than new scope.

**D16:** the compute layer stays deliberately unwired as the Web Worker
extension point. A dead-code scan will flag it — that is expected. Do not
delete it, and do not wire it without a measured bottleneck.

### What M11 delivered

The user's own holdings, stored device-locally with mandatory backup. Exactly
one thing crosses between the strategy record and the portfolio: a per-holding
status (*In Top 5* / *No longer in Top 5*). A test asserts no strategy figure
appears on the portfolio screen at all.

The valuation engine needed no changes — it shipped in M3, pure and fully
tested, milestones before any screen existed. M11 is composition plus the store.

**No decisions remain open.** D1–D15 are all accepted and implemented.

### What v1.0 means

The Phase 1–3 restructure is complete. The product answers investor questions
1, 2 and 3 excellently and questions 4 and 5 **not at all — by design**. Manual
Portfolio and What Changed are V2, exactly as Phase 1 specified.

### What M10 found

Three defects that were all silent, and all previously reported as working:

- **Keyboard shortcuts were never wired.** The hook was written in M5 and
  nothing imported it. A hook nobody imports still passes every test written
  against the hook.
- **Offline was never detected.** `OfflineState` shipped in M4 and was only
  ever reachable from the dev gallery.
- **A heading level was skipped** on the record (h1 straight to h3).

Also removed a 14-component dead island superseded by the M4 design system,
including a `MetricGroup` that existed twice in two directories.

### Only D3 remains open

It gates M11 (Manual Portfolio). The pure valuation engine already shipped in
M3, so M11 is largely composition plus the store.

### What M9 delivered

Decision D2 (long-term ranges), the binding series contract, a shared crosshair
between equity and drawdown, and `ChartCard` giving every chart a purpose line
and real empty states.

**Two defects fixed:** the equity axis was formatting an index as rupees, and
the attribution chart was plotting rupee P&L — both reintroducing the account
size decision D1 removed. Attribution is now percentage points, with a test
asserting invariance across a 1000x notional.

**Three charts restored.** Monthly returns, contribution and rank movement fell
out of the product in M7 when the old page was deleted, and nothing referenced
them for two milestones.

**Only D3 remains open**, and it gates M11 only.

### What the refinement delivered

A shared surface vocabulary replacing 176 ad-hoc inline styles, sparklines and
sector badges, a sticky action bar, global search over all 453 constituents
(instant and offline), a hover-expanding desktop rail, a skip link and ARIA
sweep, and four cheap micro-interactions.

**D15 was resolved in favour of the approved architecture.** Six items in the
refinement brief reversed decisions marked FINAL — an 8-item sidebar, a Command
Center dashboard, a Portfolio Value headline, an opinion system, a composite
health score and a rebalance countdown. All six were declined by the owner, and
a standing rule now says the approved architecture wins over any future
inspiration document unless the owner explicitly says otherwise.

**No engine, methodology or calculation changed.** Every figure is identical to
v0.30.0.

### What part 1 delivered

A shared surface vocabulary replacing 176 ad-hoc inline style objects across
five screens, sparklines and sector badges on every ranked row, a sticky action
bar on the ranking, and a density pass. **No engine, methodology or calculation
changed** — every figure is identical to v0.30.0.

### What is blocked

**D15 — six items in the refinement brief reverse decisions marked FINAL**:
the left sidebar, the Command Center dashboard, a Portfolio Value headline,
"Divu's Opinion", a Portfolio Health Score, and a rebalance countdown. Each is
listed in `DECISIONS.md` with the decision it contradicts and a recommendation.
The brief itself says "Do NOT remove existing decisions", so these need the
owner rather than a guess.

**D2 still gates M9** (3Y/5Y chart ranges against a 2025-01-01 data start).
**D3 gates M11.**

### What M8 delivered

All five navigation destinations now lead somewhere real for the first time.
Reports carries the cross-universe and cross-window comparisons plus every CSV
export; Settings carries preferences, data provenance and the methodology
history; Methodology carries eleven deep-linkable sections that each explain
why the rule works that way, not only what it is.

Decision D14 also landed: momentum direction (Improving / Stable / Weakening,
descriptive only), portfolio-change history on every rebalance, and a
methodology version stamped on every report.

**Note on the bundle gate.** It had been under-reporting the initial payload by
more than a third, because Vite hashes can contain a hyphen and the chunk-name
regex stripped only alphanumerics and underscores. Fixed; the real figure is
122.4 kB, and earlier reported numbers from M7 onward were optimistic.

**One open decision blocks M9: D2** — how the 3Y and 5Y chart ranges should
behave against a 2025-01-01 data start. D3 (portfolio storage) gates M11.

### What M7 delivered

Both depth screens, plus decision D13 (rebalance summary and Momentum Age,
derived from the existing ranking history rather than recomputed).

`StrategyPage` is deleted — both its replacements shipped. The end-to-end suite
was rewritten against the new screens, keeping every invariant.

**CSV exports currently live on the Strategy Record**, not Reports. Routing the
record away from the old page had silently dropped them from the product; they
move to Reports in M8, which is where the approved architecture puts them.

**Two open decisions remain**, neither blocking M8: D2 (chart ranges, gates M9)
and D3 (portfolio storage, gates M11).

### What M6 delivered

The universe screen: verdict, what changed, the Top 5 card that **is** the
Investment Simulator, view-all, three metrics, and the methodology link. The
three disclosure boxes that used to sit above the answer are now a link at the
foot.

`CapitalCalculatorPage` and `/calculator` are deleted — their replacement
shipped here. `/:universe/all` and `/:universe/record` still render the old
page until M7 builds them, so no content is missing.

**Two open decisions remain**, neither blocking M7: D2 (chart ranges, gates M9)
and D3 (portfolio storage, gates M11).

### What M5 changed

Navigation is universe-first; the Dashboard, Sidebar and TopBar are deleted.
URLs follow the approved model (`/nifty50`, `/nifty50/3m`, `/nifty50/all`,
`/nifty50/record`, `/nifty50/stock/SYMBOL`), every legacy `/strategy/:key`
bookmark redirects **with its window preserved**, and no path anywhere produces
a blank page.

Preferences and per-route view state are remembered, so the app opens where you
left off and back navigation does not lose your place.

**`StrategyPage` still renders the universe screens.** Only its entry point was
rebound, from a strategy key to a universe plus window. M6 replaces the screen
itself — migrating the shell first is what lets that happen without the app
being broken in between.

### What M4 delivered

The palette corrections (two tokens that shipped below WCAG AA for several
versions), 25 drawn icons replacing every typographic glyph, the full primitive
and feedback component libraries, the `InfoTip` contextual-help control, the
illustration system, and a dev-only component gallery at `/_gallery`.

**Contrast is now a build gate rather than an opinion** — every high-traffic
pairing in both themes is measured on every build.

### D10 — the audit trail

D7 detected restatements but could not reconstruct them: the note appeared
once and the old value was overwritten. Revisions are now append-only and
capture the full prior state, so what the app displayed in June can be rebuilt
in August. `clear()` deliberately never wipes them.

### D9 — contextual help is now permanent

Any metric or term that is not immediately obvious carries an information icon
explaining what it means, why it matters, and how to read it here. 38
explanations live in `config/glossary.js`; the component spec is in
`docs/CONTEXTUAL-HELP.md`; 271 tests enforce coverage and house style, so a
metric added without an explanation fails the build.

### What is blocking

**D5 and D6 block M4.** D6 (the drawn icon set) has commission lead time and
should be started regardless of when M4 begins. D4, D2 and D3 block later
milestones.

### One thing to be careful about

Absolute performance numbers from this environment are unreliable — the
*unchanged* source measured between 128ms and 350ms for an identical workload
depending purely on machine load. The gate takes the best of 7 runs for that
reason. Treat it as a regression detector, not a benchmark.

### Where to look first

1. `DECISIONS.md` — what is settled, what is not
2. `TODO.md` — milestone order and the carried-forward backlog
3. `CONTRIBUTING.md` — how to work here, and what gets a change rejected
4. `CHANGELOG.md` — what happened and why

**Trust the code, not the documentation.** If they disagree, the code is right
and the discrepancy should be reported loudly.

---

Context for picking this project up in a fresh conversation, where none of
the prior discussion carries over.

**Superseded by the status block at the top of this file.** Kept below for
history: prior version v0.20.1, 349 tests passing.
· **Phase 1 closed · Phase 2 FULLY closed · Phase 3: only 3.3 left
· Phase 4 SHIPPED — 12 strategies, verified
· Design system + theming SHIPPED (v0.19.0) · Layout SHIPPED (v0.20.0–.1)**

## ⚠️ READ THIS FIRST — the visual layer is being restructured, on user feedback

The user reviewed a real, running build of v0.20.1 (via the single-file
preview — see below) and gave direct feedback, verbatim in substance:
**"it is beautiful, it is good, but it's really not good from a user
perspective... too messy, too choppy."** They intend to give a detailed
restructuring prompt in the NEXT conversation and asked for this project
to be handed off there.

**What that does and doesn't mean:**
- Does NOT mean the v0.19–v0.20 foundation was wasted. The tokens, the
  dark/light theming, the palette-from-the-icon, the RS Ledger — none of
  that was the complaint, and none of it was flagged as wrong. Keep it.
- DOES mean the page-level composition and information density are the
  problem: likely too many simultaneous focal points, unclear reading
  order, or too much on one screen at once. That's exactly the kind of
  thing that's easy to get wrong when building screen-by-screen without
  stepping back to look at the whole flow — which is what happened here.
- The user has NOT yet said what the restructure should look like. Do not
  guess and start rebuilding before their detailed prompt arrives. Ask if
  it doesn't arrive with enough specificity to act on safely.

**Before touching layout again:** actually load the app (the preview
build, or `npm run dev`) and look at it — screen by screen, at both
mobile and desktop width — before making changes. The mistake worth not
repeating is designing components in isolation (one hero here, one metric
group there) without ever assembling them and asking "does this whole
page make sense to someone who's never seen it."

## The design system (v0.19.0) — read before touching any UI

**The palette is sampled from the app icon and every colour has one fixed
meaning.** This is not decorative; breaking it makes the UI lie:

| Token | Means | Never used for |
|---|---|---|
| `--color-gold*` | benchmark, brand, rank | making something merely look important |
| `--color-gain*` | ahead of the benchmark | any unsigned value |
| `--color-loss*` | behind the benchmark | any unsigned value |
| `--color-chrome` | the dark navy frame | ordinary card surfaces |

**Two traps worth not re-learning:**
- `--color-ink` is a **text** colour. It inverts to near-white in dark
  mode. Using it as a background renders white-on-white — that exact bug
  shipped in `Sidebar.jsx` and was fixed in v0.19.0. Use `--color-chrome`.
- White on `--color-gold-fill` is ~3.2:1 and **fails WCAG AA**. Anything
  sitting on a gold fill uses `--color-on-gold`.

**No component carries a `dark:` variant, and none should.** Both themes
are declared as the same token names in `src/index.css`; the cascade does
the work. If you find yourself writing `dark:`, the token is missing.

**Recharts is the one exception** — it writes colours into raw SVG
attributes from JS props and inherits nothing from CSS. Chart colours go
through `components/charts/chartTheme.js`, which reads the same tokens
from the live document so the palette still has exactly one definition.

**Signature component — the RS Ledger** (`RankingTable.jsx`). Draws the
stock's return as a solid bar and its benchmark's return as a hatched
ghost bar from one shared centreline; the visible gap *is* RS. Keep the
benchmark hatched — two solid bars read as two competing values rather
than a value and its baseline. Keep the legend.

**Theme constants are duplicated on purpose.** `index.html` carries an
inline pre-paint copy of four values from `src/utils/theme.js`, because
an inline script can't import a module without becoming async and
reintroducing the white flash. `utils/__tests__/theme.test.js` reads
`index.html` and fails the build if they drift — don't "clean up" the
duplication, it's load-bearing and it's guarded.

**Layout shipped in v0.20.0.** Hero panels (one glass surface per page,
lit like the icon), metrics grouped Performance/Risk/Consistency, phone
card view for rankings, Dashboard hero. Two rules worth keeping:
*one* hero per page — a second glass panel means one of them is wrong;
and the Strategy hero leads with **outperformance, not portfolio value**,
because a portfolio up 16% in a market up 20% is a losing strategy.

**Still to do on the visual side:** the slim icon rail to replace the
60-wide desktop sidebar, and moving drawdown onto the equity curve's
shared time axis. Both are in TODO.md.

## ⚠️ A previous "v0.18.0" was never real — discarded, not repaired

A prior session produced a full CHANGELOG entry, this file's own banner,
and a TODO list describing dark/light theming and these same 12 strategies
as already shipped. On inspection (2 Aug 2026) none of it existed in the
actual source: no theme code anywhere in `src/` or `index.html`,
`strategies.js` still registered exactly 3 strategies, and
`computeCurrentMomentum` had no `lookbackMonths` parameter. That version
was discarded entirely. **This v0.18.0 is a different, independently
verified build from the real v0.17.1 source** — see CHANGELOG v0.18.0 for
exactly what changed and the actual `lint`/`test`/`build` output. If a
future session ever finds documentation that doesn't match what's on disk
again, trust the disk, not the doc, and say so loudly rather than building
on top of it.

## The app is named **Gati**

गति — Sanskrit for motion / pace / momentum. Decided 1 Aug 2026, final.
This **supersedes** every earlier naming question in this file's history:
the "My Dashboard" / keep-current-name decision is void, and the draft "MD"
mark is retired (it was never wired in).

Identity is **owner-supplied finished artwork** (v2, 8 Aug 2026), held at
`brand-src/LOGO.png` and processed into every shipped size by
`python3 scripts/generate-icons.py`. The code-generated first mark and its
generators are retired and deleted. Rationale, measurements and asset
table: `docs/BRAND.md`.

**Gotcha worth not re-learning:** the `maskable` icons are separate artwork,
not the same PNGs re-tagged. Android crops maskable icons to an 80%-diameter
circle, and this artwork carries a thin gold rule around the card's outline,
so those variants must fit the *whole card* inside the circle — derived
maximum 0.632 of the tile, shipped at **0.63**. Re-tagging the standard icon
ships a visibly bitten gold ring on every Android home screen.

**Second gotcha, found while replacing the mark:** `Navigation.jsx` pointed
at `/gati-mark.png` for several milestones. That file has only ever existed
at `/icons/gati-mark.png`, so the desktop sidebar rendered a broken image
while every gate stayed green — icon paths are plain strings, not ESM
imports, so nothing resolves them at build time. Fixed, and now guarded by a
test that walks `src/` and checks every absolute image path against
`public/`.

**PHASE 4 — SHIPPED (v0.18.0), verified.** 12 strategies (1/3/6/12-month ×
NIFTY 50/Midcap 150/Smallcap 250), registered by explicit user decision
after being asked directly. The live "Current Momentum" ranking now
measures over the same window as its backtest (`lookbackMonths` threaded
into `computeCurrentMomentum`). A new sample-size honesty check
(`assessHistorySufficiency`) flags the 12-month window as thin — confirmed
against real generated data in a new end-to-end test, not just a unit test.
See CHANGELOG v0.18.0 for the full list and exactly what was verified.
**Theming/visual design was deliberately NOT touched in this release** —
that's separate, later work by the user's own direction; every new UI bit
(window switcher, sufficiency notice) reuses existing tokens rather than
introducing new styling.

**PHASE 2.1 — CLOSED (v0.17.1), verified unnecessary rather than skipped.**
The deferred trigger fired 1 Aug 2026: the app was deployed to Netlify
(`gati2.netlify.app`) and tested from Netlify's own servers, not a
residential IP, for the first time. A full 50-symbol NIFTY 50 batch quote
request came back **50/50 resolved, 0 failures, 1.4 seconds,
`authTier: "crumb"` throughout**. No rate-limiting occurred, so
retry-with-backoff was not built — it would harden against a failure that
didn't happen. If real 429s ever appear in production, that's the new
trigger to pick this back up.

**Phase 2 status:** 2.1b, 2.2, 2.3 done (v0.14.5–v0.14.8) — one dead stock
no longer blanks its universe; one dead endpoint (live quotes, via the
crumb handshake) no longer blanks the bundle; both failure modes get a
summarising notice; and the adjusted-close convention is verified against a
**real** 2:1 split (BAJFINANCE.NS, 16 Jun 2025 — 36 split/bonus events
found across 450 symbols). Key finding: Yahoo back-adjusts raw `close` too,
so for splits the adjClose preference is belt-and-braces, not the only
guard. See CHANGELOG v0.14.8.

**Phase 3 status:** 3.1 done (v0.16.0 — Gati identity, icons installed and
registered) and 3.2 done (v0.15.0 — the Capital Calculator's third entry
basis, "bought on a date I choose", built so the picks come from the ranking
that predates the chosen date rather than today's Top 5 priced backwards).

**Only 3.3 remains, and it genuinely cannot be done from here.** Every
layout decision in this app — and now the icons too — has been audited in
code and rendered to raster, but **never once seen in a real browser or on a
real phone**. That is the single largest untested surface in the project.
It needs a human with a device.

---

## What this is

An Indian-market momentum dashboard built to the spec in
`RS_Dashboard_Prompt.txt` (45 sections). It ranks NIFTY 50, Midcap 150 and
Smallcap 250 stocks by Relative Strength against their own benchmarks,
selects a Top 5 per universe, and backtests a monthly-rebalance portfolio.

**Read these, in order:** `SESSION-NOTES-PART2.md` (what happened most
recently, and why) → `ROADMAP.md` (phases) → `TODO.md` (open items) →
`CHANGELOG.md` (what changed and why). `SETUP.md` and `DEPLOY.md` are
written for a non-technical user.

---

## Phase 1 is closed — Yahoo Finance is verified

14/14 checks pass, the full Jan-2025→today range fetches without truncation
(394 rows), and all 453 configured tickers resolve against live Yahoo.

**Read this part carefully, because the obvious summary is wrong.**

The two Yahoo endpoints behave differently, and an earlier version of this
file said otherwise:

| Endpoint | Used by | Plain request | Tier in practice |
|---|---|---|---|
| `v8/finance/chart` | `market-data.js` (history) | 200 OK | `simple` |
| `v7/finance/quote` | `quote.js` (live prices) | **401** | **`crumb`** |

So the cookie+crumb handshake is **not** a dormant hedge. It carries every
live price the dashboard displays. It went unnoticed because checks 1-9 all
hit the chart endpoint and printed `simple`, while the quote checks printed
no tier at all. Both now report it.

**What this means operationally:** live prices and historical data fail
*independently*. If `fc.yahoo.com` stops setting a cookie or
`/v1/test/getcrumb` stops issuing crumbs, quotes die while the backtest keeps
working. That's a partial failure that won't look like an outage.

Run `node scripts/verify-auth-fallback.mjs` to exercise both tiers on demand
(`FORCE_AUTH_TIER=crumb` forces the fallback). Currently 4/4.

**Still genuinely unproven:** behaviour from Netlify's datacenter IPs. All
verification so far ran from a residential connection, and Yahoo's anti-bot
posture is IP-reputation-sensitive. 453 symbols in ~7s with zero throttling
is encouraging, not conclusive. Phase 2.1 stands.

---

## A behaviour reversal, not a bug — but just as important to not undo

**As of v0.14.4, this app never shows fabricated data on a live-data
failure.** User directive, 31 Jul 2026, overriding this project's own
earlier v0.13.0 design: a failed fetch used to be caught and silently
re-run against `MockProvider`, so the dashboard rendered numbers anyway —
loudly flagged as synthetic, but numbers all the same. That fallback is now
deleted. On failure, the error propagates and the UI shows only
`LiveDataErrorNotice` — the reason, and nothing else. No charts, no
rankings, no numbers of any kind, however clearly labelled as fake they'd
have been.

**If you're tempted to add a fallback back "for robustness" — don't,
without asking first.** This was an explicit, considered instruction, not
an oversight to quietly fix.

**Per-symbol tolerance was added in v0.14.5**, so "no fake data" does NOT
mean "one bad ticker kills the page". The asymmetry is deliberate and
tested — don't flatten it:

| What fails | Result |
|---|---|
| One stock | That row flagged, universe fine |
| **The benchmark** | **Universe-wide error** — RS is stock *minus benchmark*, so there's no ranking for anyone without it |
| **Every stock** | **Universe-wide error** — that's an outage, not many renames |

A failed stock stays **visible** as an unranked row with a specific flag
(`SYMBOL_UNAVAILABLE`, distinct from `MISSING_DATA`), because silently
dropping it from the universe would be its own kind of lie.

## Four real bugs found and fixed — do not reintroduce

These were all financial-accuracy defects that passed builds, lint and a
full green test suite. Each now has a dedicated regression test.

1. **Current Momentum compared today's price against itself** (v0.10.0).
   `getMonthEndRecords()` returns the last bar of *every* month including the
   in-progress one, so mid-month the "previous month-end" resolved to today.
   Every stock reported exactly 0.00% and RS 0; ranking silently collapsed to
   the alphabetical tie-break. Fix: anchor to the last month-end strictly
   *before* the current month. See `engine/currentMomentum.js`.

2. **Look-ahead bias in the Capital Calculator** (v0.8.0). A "held since last
   month-end" mode priced *today's* Top 5 at last month-end — but they are
   today's Top 5 *because* they rose, so it manufactured unearnable gains.
   Replaced with the strategy's actual open position at its real entry price.

3. **Transaction costs were unreachable dead code** (v0.5.0). The module had
   6 passing unit tests but nothing ever passed a `costConfig` into
   `runBacktest`, so every "net" figure was silently gross.

4. **Mixed adjusted/unadjusted prices fabricated returns** (v0.14.2). Price
   field is resolved per record, so partial `adjClose` coverage let the
   engine divide a raw price by an adjusted one — a split then read as a
   -79% crash, or +425% in reverse, dominating the Top 5. `computeStockRS`
   now refuses to compute a mixed-basis ratio instead of flagging it.

**The pattern worth remembering:** every one of these lived in UI/wiring code
or in a module-private function that tests mocked around. Green tests proved
internal consistency, not correctness.

---

## Non-obvious decisions, already settled

- **Dead tickers get flagged, never auto-substituted, never simulated.**
  *(User requirement, 31 Jul 2026.)* Indian tickers change — the 2025 Tata
  Motors demerger retired `TATAMOTORS.NS`, confirmed 404 live. When a symbol
  fails, the app must name it and say the ticker may have changed. It must
  **not** quietly swap in sample data for that case; the user was explicit
  that an honest error beats a plausible fake number. And it must not
  auto-adopt a replacement symbol it found by itself — that risks pulling a
  *different company's* prices into the rankings, presented with full
  confidence. Suggest-and-confirm is fine; silent adoption is not. Known
  renames live in a config map. See `TODO.md` for the full item.
  The Tata Motors case is **closed**: NIFTY 50 already carries `TMPV.NS`,
  which kept the continuous pre-demerger history (394 rows from 2025-01-01).
  `TMCV.NS` is in no universe. Retired `TATAMOTORS.NS` is kept in mind as a
  real 404 fixture for testing the flagging behaviour.

- **Month-ends come from actual trading data, never a calendar.** Validated
  against real NIFTY 50 history: correctly picks 28 Mar 2025 (31st was
  Id-Ul-Fitr) and 30 Mar 2026 (Mahavir Jayanti). A real closure for a
  *Maharashtra municipal election* (15 Jan 2026) proves no festival list
  could ever be sufficient.
- **RS uses the price series, not the live quote.** The current-day bar
  already tracks the live price and shares the adjusted-close basis of the
  month-end it divides by. Substituting a raw quote would mix unadjusted and
  adjusted prices — broken across any split (spec Section 6).
- **Execution convention:** signal at month-end close, fill at the *next*
  trading day's open. No look-ahead (Section 15).
- **Quotes are batched**, ~50 symbols per Yahoo request: 453 requests → ~10.
  Polling is 30s and **only while the market is open**.
- **Constituent lists are complete (50/150/250) but from a third-party
  mirror**, not NSE's CSV. Validated structurally (exact counts, zero
  cross-universe overlap, NIFTY 50 matched an official list 50/50). Labelled
  `provenance: 'third-party-mirror'` and disclosed in the UI.
- **Live-data failure degrades loudly**, never silently: falls back to sample
  data behind a full-width warning banner (Sections 35 #11/#12).

---

## Still needed from the user

| What | Why | Urgency |
|---|---|---|
| A browser + a phone, for Phase 3.3 | Layout/responsiveness/icons audited in code, never seen rendered | The single largest untested surface in the project |
| Free Twelve Data API key | Optional daily accuracy cross-check vs Yahoo | Optional |
| Whether to pull `DATA_START_DATE` back (e.g. to ~2023) | Would give the 12-month strategy real rebalance history instead of a thin sample | Optional — has fetch-cost/provider implications, so it's a real decision, not a default |
| Theming / visual design direction | Deliberately deferred by the user's own instruction (2 Aug 2026) — see Phase 4 note above | Whenever the user is ready |

~~Output of `verify-live-data.mjs`~~ — **received, 14/14.**
~~Full-range fetch check~~ — **done in-environment; Phase 1.4 closed.**
~~Confirmation on the supplied logo~~ — **resolved 1 Aug 2026: the app is
Gati, generated from code. See the banner at the top of this file.**

---

## Working conventions

From spec Sections 35/37/38/44, and followed throughout:

1. This source is the single source of truth — never rebuild from scratch or
   fork a parallel version.
2. Smallest reliable change; don't rewrite unrelated modules.
3. Verify with `npm run lint && npm test && npm run build` **before**
   reporting anything done.
4. Never fabricate market data — flag gaps instead of computing around them.
5. Keep financial calculations out of React components (Section 34).
6. Update version + `CHANGELOG.md` + `TODO.md` with every change.
7. Ask before implementing logic that could materially change backtest
   results.
