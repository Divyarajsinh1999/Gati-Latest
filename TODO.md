# TODO

Worked in priority order. `DECISIONS.md` records what is already settled;
`CONTRIBUTING.md` records how to work here. Both take precedence over anything
below.

**Current version:** v1.6.6 — M16 COMPLETE + final pre-release audit passed, ready to deploy
**Current milestone:** M16 — owner customisations. COMPLETE.

Remaining work is on-device verification only (see "Needs a real device"
below).

---

## M16 — FIVE OWNER CUSTOMISATIONS — COMPLETE

Requested 27 Aug 2026. Four presentation, one that turned out to be a real
ranking defect. Full detail in CHANGELOG 1.6.1.

1. ✅ "Command Center" → "Dashboard" everywhere
2. ✅ All 11 columns at every viewport; sticky rank/ticker released so the
   whole row scrolls sideways. Verified in Chromium at 320/390/768/1440.
3. ✅ Momentum equity curve on the Dashboard beneath the metric tiles,
   per-universe colour, both legs toggleable from the legend
4. ✅ Info buttons on Stock % and Price, the latter carrying live-or-dated
   state via the new `InfoTip note` prop
5. ✅ Previous month close anchored to the prior calendar month's last
   session, with its date shown
6. ✅ (v1.6.2) Window chip removed from the Dashboard head; universe strip
   rebuilt as a centred three-column control on a phone with a genuinely
   visible selected state (ring contrast 5.90–15.87:1, was 1.26:1 on light)

### What item 5 actually was

A stock whose series stops before the current month had its own last bar
returned as the "month close", divided that bar by itself for a fabricated
0.00% return, and was **ranked on it**. `STALE_PRICE` existed since v1.0.0
and had never been emitted. Now flagged and excluded.

Two further faults surfaced while fixing it, both live in v1.6.0:
- an engine-excluded row appeared in NO list (49 of 50 rows, "0 excluded")
- `browser-qa.mjs` spawned an untracked file outside the repo, so the gate
  had never run anywhere but one machine

### Deliberately NOT changed — CLOSED, owner decision 28 Aug 2026

The engine reads "the current month" from the latest available bar. For a
short period on the 1st of a month, before that day's first bar exists, the
previous month reads as still in progress.

**The owner reviewed this and chose to keep it exactly as it is**, on the
grounds that it avoids look-ahead bias and prevents ranking from using data
that does not yet exist. Do not change it unless a clear calculation error is
demonstrated. This is now a standing decision (D31), not an open item.

---

## Found during M16, not yet fixed

- ✅ **FIXED in v1.6.3.** `stockDetailView` compared mismatched spans: a
  1-month stock return against a window-dependent benchmark return, with a
  window RS beneath them. At 6M and 12M the sign contradicted itself. Both
  legs now come from the window-consistent engine pair, and the card names
  its span. Ranking output verified bit-identical to v1.6.0.

---

## M15 — WHAT AN INVESTOR NEEDS TO SEE — COMPLETE

Six additions, all risk VISIBILITY. Decisions **D21–D26** govern this
milestone and were recorded before any code was written.

**THE HARD BOUNDARY:** ranking, RS, rebalance selection, benchmark mapping and
the execution convention are not touched. Tax and costs are post-processing on
a completed record. Needing a change in `ranking.js`, `momentum.js` or
`backtestEngine.js`'s selection logic means the design is wrong.

**Delivered phase by phase**, at the owner's instruction — a container reset
during the first attempt cost six completed phases held on disk. One phase per
package is the right trade against the standing "don't send files" rule.

### Ordering, and why it is this order

Tax first because it is the one that can change the ANSWER rather than the
presentation. Then the metrics sharing the record's plumbing. Then the two
needing the owner's own positions. The journal last: purely additive, blocks
nothing.

- [x] **P1 · Tax engine.** DONE — v1.5.3. `engine/tax.js`, 17 tests, every
      expected value derived by hand and the important ones also asserted
      NOT to equal the plausible wrong answer.

      **Measured (mock data — illustrative, not the real record):** drag of
      6.06 / 6.49 / 15.72 points across 17 rebalances for large / mid / small.
      No sign flip here; NIFTY 50 was already behind its benchmark gross.

      **The loss set-off earns its complexity.** Large cap: gains 27,225,
      losses 21,982. Naive taxing gives Rs 5,663; per-year netting gives
      Rs 3,031 — the naive model overstates the bill by **87%** (mid 59%,
      small 23%).

      **A pessimistic choice, left visible:** FY2026-27 ended at a net loss
      and owed nothing, and that loss is not carried forward though the law
      allows eight years. `carriesLossesForward: false` is returned so the UI
      states it.

      A scale-invariance test pins D1: the same trades at 10x capital must
      produce an identical drag, or the engine has started assuming an
      account size.
- [x] **P2 · Tax in the record.** DONE — v1.5.4. Settings row (BEFORE/AFTER,
      defaulting BEFORE), always-visible net line under the record headline,
      glossary entry, `afterTax` block on the selector. 13 new tests.

      Verified in Chromium: *"After tax: +9.58% (-7.11%). Estimated at 20.8%
      of net gains, losses set off within each financial year. Not tax
      advice."*

      **Bug found and fixed on the way:** the Settings cost note rendered
      every rate 100x too large — "STT 10.000%" against a real 0.1%. A helper
      multiplied by 100 on values that were already percentages. Backtest
      numbers were never affected (`calculateTradeCost` divides correctly),
      which is exactly why it survived: a wrong sentence nobody reconciles
      against anything. Guarded by `costDisplay.test.js`.

### Reported, not silently fixed

- **Two different minus glyphs on the record screen.** `formatGap` uses
  U+2212 deliberately (documented: a hyphen at small sizes reads as a dash),
  `formatPct` emits an ASCII hyphen. So the outperformance chip shows "−7.0%"
  and the after-tax line two rows below shows "-5.82%". Pre-existing.
  Unifying it means touching `formatPct`: 36 call sites and 24 tests pinning
  the current output. Worth doing as its own change, not inside a tax phase.
- [x] **P3 · Underwater duration.** DONE — v1.5.5. `calculateUnderwaterDuration`
      in `metrics.js`, 8 hand-derived tests. Risk section, directly beside max
      drawdown, with a sublabel saying whether it has recovered.

      Verified in Chromium: NIFTY 50 "7 months / Still down — 4 months so
      far"; Midcap "4 months / Recovered"; Smallcap "3 months / Still down".

      **Headline colour fixed (owner's call):** coloured by the strategy
      return, not by outperformance. A record making +16.69% while its
      benchmark made more was printed in the loss colour.

      **A bug I introduced fixing it, caught by a screenshot rather than by a
      test:** the outperformance chip read the same `direction` field, so it
      turned GREEN while showing −7.0%. One misreading traded for another. The
      guard test I had written asserted the chip's LABEL and passed anyway.
      Two figures with two meanings now have two fields, and the test checks
      the tone.
- [x] **P4 · Sector concentration.** DONE — v1.5.6. `selectSectorConcentration`
      over the current picks, one line under the Top 5. 10 tests, glossary
      entry. Amber with a warning glyph at three or more of five; muted grey
      otherwise, so the colour keeps its meaning.

      Verified in Chromium: all three universes currently read "Spread across
      4/5/5 sectors" on mock data — no concentration to flag today, which is
      the correct quiet state. The amber path is covered by test rather than
      by screenshot, because mock data never produces it.

      **Unknown sectors are named, never absorbed.** Three unclassified out of
      five would otherwise report "Spread across 2 sectors" — true of what the
      data shows, and a claim about diversification with no basis, since a
      concentration could be hiding in the three it cannot classify. Reads
      "Spread across 2 of 2 known · 3 unclassified" instead.
- [x] **P5 · Rebalance action list.** DONE — v1.5.7. `selectRebalanceActions`
      joining lots to the current Top 5, rendered on My Portfolio only (D26).
      10 tests. Verified in Chromium with seeded holdings:

      *"2 of your 2 still ranked · 0 no longer ranked · 3 ranked but not
      held"*, then the three groups, then the provisional notice.

      **A real flaw caught in the browser, not by any test.** The first
      version showed the list only when `universeFilter !== 'all'` — but the
      filter strip itself only appears once holdings span two or more
      universes. A reader holding five large caps, which is the ordinary case
      and exactly the reader this is for, had no filter to select and so never
      saw the list at all. Every unit test passed, because they call the
      selector directly and never meet the filter. The rule is now "is the
      comparison unambiguous", not "has a filter been clicked".

      Also fixed: a held position whose name was never filled in carries the
      symbol as its name, so the chip printed "WIPRO.NS WIPRO.NS". The ticker
      now renders only when it adds something.
- [x] **P6 · Liquidity.** DONE — v1.5.8. `engine/liquidity.js`, 11 tests,
      glossary entry. Verified in Chromium: a Rs 5.7 crore position in a stock
      trading Rs 43 crore a day reads *"This position is 13.2% of the last
      session's traded value"* in amber with a warning glyph.

      **D26's placement was stale and is corrected here.** It named the
      "Investment Simulator", but v1.4.0 removed the whole-portfolio simulator
      and made investment a property of a STOCK, entered on its detail screen.
      The line therefore lives on `InvestmentCard`, where an amount is
      actually decided. The decision's intent is unchanged; only the screen it
      named had ceased to exist.

      **Measured against traded VALUE, not share count.** 10,000 shares of a
      Rs 400 stock and 10,000 of a Rs 4,000 stock are two different markets;
      value is the only comparable figure and is what the order competes for.

      Thresholds (1% notice, 5% warn) are exported rather than buried, because
      they are judgement rather than fact. Missing volume returns null, never
      "ok" — a stock this cannot measure is not a stock it may call liquid.
- [x] **P7 · Paper-trade log.** DONE — v1.5.9. New `journal` store (DB v2 → v3;
      the upgrade path was already non-destructive, so a reader keeps every
      position), `useJournal` hook, `/paper-log` screen under SYSTEM. 16 tests.

      Verified end to end in Chromium: filled the form, saved, and the entry
      **survived a full page reload** — proving it reached IndexedDB rather
      than living in React state.

      **The screen shows no performance at all.** Not a return, not a value.
      Every number on it would be a recomputation of something the strategy
      record already owns, and a second copy is a second chance to disagree.

      **`createdAt` is stamped by the store and never accepted from the
      caller.** The entire value of an entry is that it predates the outcome;
      a caller-supplied timestamp would let hindsight be backdated into it.
      Only the note can be edited afterwards — month, universe and symbols are
      fixed once written.

      Symbols are deliberately NOT validated against the Top 5: the months
      worth re-reading are the ones where the owner disagreed with it.
- [x] **P8 · Responsive, a11y and gates.** DONE — v1.6.0. Everything green:
      lint, typecheck, **2,192 tests / 88 files**, build, size, perf, and
      `qa:browser` across **44 combinations** (11 screens x 4 viewports) with
      **zero axe violations, zero horizontal overflow, zero sub-24px touch
      targets**. Both new screens checked at 390px: no overflow, no clipping.

      **A dead code path found and removed.** `assessPortfolioLiquidity` had
      been wired into `selectSizing` — which computes a whole-portfolio
      allocation that NO SCREEN RENDERS, because v1.4.0 moved investment onto
      the stock. Correct, tested, and unreachable. The live path is the
      per-stock one on `InvestmentCard`.

      **`m15Wiring.test.js` now guards the whole class of failure** — every
      M15 engine module must have a consumer, and every selector field must be
      READ by a screen. Proven to fail against two deliberately unwired
      features.

      That guard was itself wrong first: it checked whether a screen's text
      CONTAINED the field name, and passed with `sectorConcentration`
      deliberately unwired, because the same word appears in an `InfoTip
      term=` glossary reference. A guard that passes for the wrong reason is
      worse than none — it certifies the exact thing it cannot see. It now
      matches the data flow.

### Still needs a real device — nothing in a container can settle these

- The live Yahoo path and the auth tier reported in Settings.
- The green live-price dot (cannot appear on mock data, by design).
- Android/iOS hardware back, and the exit confirmation.
- The maskable icon under Android's circular crop.
- **Whether tax flips the verdict on the REAL record.** On mock data the drag
  was 6.06 / 6.49 / 15.72 points and no sign flipped, but NIFTY 50 was already
  behind its benchmark gross. The live answer may differ, and it is the single
  most decision-relevant number in this release.

### Known traps, recorded so the rebuild does not re-learn them

- Screens may NOT import from `engine/` — lint enforces it. Anything a screen
  needs from the tax engine goes through a selector.
- In `PortfolioScreen`, `ranked` is FLAT across all three universes. Rank is
  not unique across them, so `rank <= 5` over the flat list describes fifteen
  stocks. The action list needs rows per universe.
- `MetricTile` already accepts `sublabel`. Do not invent a parallel `note`
  prop that renders nowhere.
- The glossary has hard constraints (D9/D11): default tier under ~170 chars
  per field, `inGati` must name something specific to this product, `what`
  must not restate the term, and `learnMore.example` must contain a figure.
- Formatters emit U+2212 MINUS SIGN, not a hyphen. Tests asserting on '-'
  will fail correctly.

---

## M14 — THE TERMINAL RESKIN — COMPLETE

Adopt the visual language and shell of `gaati.netlify.app` v1.0.0 (JUL 2026)
over Gati's own content, features and calculations. Decisions **D18, D19, D20**
govern this milestone and were recorded before any code was touched.

**The one rule for this milestone:** no engine, selector, ranking, benchmark,
rebalance or data-layer code is touched. If a test breaks, the reskin is wrong.
Guard tests are retargeted only where their subject genuinely moves — never
deleted, never weakened.

### Source material — extracted and verified, not guessed

| Asset | How it was obtained |
|---|---|
| Full custom stylesheet | 20,736 bytes lifted from `index-BvareQgb.css`, both breakpoints intact |
| Chart configuration | Read out of `index-D7aOm50S.js` — tension .35, no points, 1.5px stroke, bar radius 5, donut cutout 72% |
| Per-universe accents | `#d7ff43` / `#7dd3fc` / `#f0abfc`, found on the universe registry in the bundle |
| Every screen, 2 viewports | Driven in headless Chromium, 14 full-page captures |

The source app is **not** an ancestor of this codebase: TanStack Start,
Chart.js, and hardcoded demonstration rows with no fetch layer. Nothing is
being restored.

### Destination map — what fills each slot in the borrowed shell

| Source destination | Gati content | Route |
|---|---|---|
| Command Center | Universe screen, relaid out. Per-universe, driven by the tab strip | `/:universeKey` |
| Live Rankings | Full Ranking screen | `/:universeKey/all` |
| Strategies | **New page** — universe cards + the 12-strategy window matrix, read from the existing registry. No new calculation | `/strategies` |
| Portfolio Lab | **Renamed to My Portfolio.** The source's Portfolio Lab is a capital *planner* — enter an amount, see the whole-share split across the Top 5. In Gati that is the Investment Simulator (M6, S11), which lives inside the universe screen next to the Top 5 it plans against. This route is the reader's *real holdings*, which the source has no equivalent of. Borrowing the label would put a planner's name on a records screen and quietly undo D1. | `/portfolio` |
| Reports | Reports screen | `/reports` |
| ~~Divu's Opinion~~ | **Dropped — D20.** WORKSPACE carries five, not six | — |
| Data engine card | Real provider status: live / last close, auth tier | sidebar SYSTEM |
| — | How it works, linking on to Methodology and About | `/how-it-works` |
| Settings | Settings screen | `/settings` |

The Investment Simulator stays inside the universe screen's Top 5 card where
M6 and S11 put it, restyled with the source's capital-input and donut grammar.
`/calculator` is not resurrected.

### Phases

- [x] **P0 · Tokens.** Terminal palette into `index.css` for both themes.
      Derive the light variant (D19). Per-universe accent as a token triplet.
      Contrast gate green in both themes before anything else proceeds.
- [x] **P1 · Type.** Manrope + DM Mono; `.figure` moved onto the mono face.
      Two latent synthesised-weight bugs fixed on the way (`.figure` at 300
      and `.figure-dim` at 200 were weights never requested from either
      family, so the browser was faking them).
      Self-hosting followed separately in v1.5.1 — deliberately not bundled
      with the palette swap, since it changes the precache manifest.
- [x] **P2 · Shell.** Sidebar (236px, WORKSPACE/SYSTEM), topbar with
      breadcrumb + market status + search, ticker tape, universe tab strip.
      Mobile drawer at ≤760px.
- [x] **P3 · Surfaces.** `.panel`, `.metric-strip`, cards, buttons, chips,
      pills — expressed through the shared surface vocabulary from v0.31.0,
      so this is one file rather than 176 edits.
- [x] **P4 · Tables.** Ranking table density and treatment. Gati's real
      `<table>`, 11 columns, sticky rank + ticker, all retained.
- [x] **P5 · Charts.** Restyle Recharts to reproduce the source's Chart.js
      output. **No library swap** — same pixels, no risk to a working layer.
- [x] **P6 · Screens.** Command Center, Live Rankings, Strategies, Portfolio
      Lab, Reports, Settings, How it works, Stock Detail, Record.
- [x] **P7 · Mobile.** 390px pass, drawer nav, bottom-clearance guard
      retargeted from the bottom bar to the drawer.
- [x] **P8 · Gates.** All green: lint, typecheck, **2,008 tests / 76 files**,
      build, size (127.8kB / 200kB), perf, and a new
      **`npm run qa:browser`** — 40 combinations (10 screens × 4 viewports)
      in headless Chromium with axe. **Zero serious/critical violations,
      zero horizontal overflow, zero sub-24px targets.**

      `qa:browser` is deliberately NOT in `npm run verify`: it needs a built
      site and a running server, so it is a separate command rather than a
      gate that fails for environmental reasons and gets ignored.

### Bugs found during the reskin — all pre-existing

1. **The drawdown chart had never drawn.** `buildDrawdownSeries` emits rows
   keyed `Drawdown`; `DrawdownChart` read `dataKey="drawdown"`. Recharts
   renders nothing for a dataKey absent from the data — no path, no ticks, no
   warning. The panel drew its title, grid and zero line and stayed empty.
   Measured in Chromium: 140px surface, zero paths, zero y-axis ticks, while
   the equity surface above it had two curves with 497- and 533-character path
   data. Two green tests sat either side of the broken join — the builder test
   asserts `r.Drawdown` and is right; the chart test asserts it does not throw,
   and an empty chart does not throw. Fixed, and `chartSeriesContract.test.js`
   now spans the seam (proven to fail against the bug before being kept).

2. **`inert` on the sidebar would have made desktop navigation
   keyboard-unreachable.** Caught before it shipped. `open` means "drawer
   open", which is false on desktop where the sidebar is permanently visible —
   so the attribute would have removed all seven destinations from the tab
   order at every width above 760px. The condition is a viewport width, so it
   moved to a media query (`visibility: hidden` inside the drawer breakpoint).
   Verified in Chromium at both widths: desktop `visible` and focusable,
   mobile closed `hidden` and not focusable, mobile open `visible` and
   focusable.

3. **`parsePath` did not know three of its own routes.** `/portfolio`,
   `/how-it-works` and `/about` were missing from `TOP_LEVEL`, so the parser
   answered "not a universe" for real destinations. Invisible because the only
   caller was the catch-all, which those paths never reach.

4. **Horizontal page overflow on every phone width.** 78px at 320px, 8px at
   390px, from the universe tab strip: a flex item's default `min-width` is
   its content, so `overflow-x: auto` on the strip never bound and the strip
   widened the document instead of scrolling itself.

   A separate 1px overflow survived that fix and turned out to be older:
   `InfoTip` reaches its 44px touch target with `margin: -15px` around a 14px
   glyph, so the hit area overhangs its box by 15px. Against a 14px gutter it
   spilled 1px past the viewport. The gutter is now 16px — it must be at
   least as wide as the largest hit-area overhang.

5. **The strategy-card watermark failed contrast at 1.14:1.** Introduced in
   P6 and caught by axe. It was a `<span aria-hidden>`, and `aria-hidden`
   exempts nothing from 1.4.3. Since the number carries no information it is
   now a CSS pseudo-element — genuinely incidental ornament, which is what
   1.4.3 exempts, rather than a decoration darkened until a rule stopped
   objecting.

6. **A 17px-tall disclosure control** ("More charts") on the record screen.
   Pre-existing. Now 44px through padding.

7. **The Data engine card printed the exchange session under a data heading.**
   Introduced in P2 and caught in the first screenshot: a bold "LIVE" beside a
   red dot on mock data. Now keyed on `freshness`, sharing wording with
   `MarketStatusPill`.

### Carried, not forgotten

- [x] **Self-host Manrope and DM Mono.** Done in v1.5.1. Six woff2 files,
      87 kB, precached; zero external requests; offline reload verified in
      Chromium. `latin-ext` turned out to be mandatory — the rupee sign lives
      there. Guarded by `src/design/__tests__/fonts.test.js`.

### Needs a real device — nothing in a container can settle these

- The live Yahoo path: real tickers, quote timestamps, auth tier in Settings.
  Run `node scripts/verify-live-data.mjs <deployed-url>` and check the
  reported `authTier`.
- The green live-price dot. It cannot appear on mock data, by design.
- Android/iOS hardware back, and the exit confirmation.
- The maskable icon once Android applies its circular crop. Geometry was set
  for the 80%-diameter safe zone and the files are unchanged from the
  deployed build, so there is no reason to expect a problem — but it is
  unverified rather than confirmed.
- Dark default on a device whose OS is set to light.

### Open risk, flagged not buried

Dropping the bottom bar for a hamburger drawer on mobile reverses M5 and puts
every destination one tap further away on the device this PWA is mostly used
on. The owner chose the full shell with the hybrid option visible, so it is
being built as chosen — behind a single shell constant, so reverting is one
line rather than a rewrite.

---

## M13 — HOME, MARKET DATA, STOCK DETAIL & RESPONSIVE UX — COMPLETE

Owner brief, 8 Aug 2026. Worked in the owner's phase order.
**Rule for this brief:** extend, don't rebuild. No second design system, no
duplicated fetching, no change to ranking/rebalance/benchmark logic.

### Audit — what already exists and is being reused, not rebuilt

| Requirement | Already exists | Verdict |
|---|---|---|
| Central fetch | `dataService.fetchUniverseBundle`, React Query `['universe-data', key]` | Reuse. One query per universe; no per-component fetching found. |
| Refresh cadence | `LIVE_REFRESH_MS = 30_000`, polls only while OPEN | Reuse. The UI must stop implying any other number. |
| Market status | `engine/tradingCalendar.js` + `config/holidays.js` + `useMarketStatus` | **Had a real bug — fixed below.** |
| Holiday calendar | 15 NSE 2026 dates from the official circular | Sound, but 2026-only. Coverage now declared. |
| Investment tracking | `persistence/portfolioStore.js` — id + symbol + qty + price + date, IndexedDB, export path | Reuse. **Already lot-shaped**: one record per purchase, so multiple lots need no new model. |
| Info system | `components/data/index.jsx` `InfoTip` + `config/glossary.js` | Reuse component; rewrite content, fix positioning. |
| Trend classification | `engine/rsHistory.js` `TREND_BAND_PP` → improving/stable/slipping | **Already exists.** Reuse; do not invent thresholds. |
| Prev-month close | `getMonthEndRecords` reads the last bar actually present | Already correct — not a calendar date, not 30 days. |
| "What changed" | `engine/changeDetection.js` + universe section | Leave alone per brief §6. |

### Phase 1 — Data foundation

- [x] **Fix `nowInIST()`.** It added the *device's* timezone offset to an
      instant that was already absolute. In Asia/Kolkata the +5:30 and the
      −5:30 cancelled and it returned plain UTC, so the market read OPEN from
      14:45 to 21:00 IST and CLOSED through the real session. This is the
      reported "shows Market Open when it's closed" bug. CI runs in UTC, where
      the fault is arithmetically invisible — which is why 1,466 passing tests
      never saw it.
- [x] Regression test across 5 device zones (incl. Asia/Kolkata and a :45
      zone), 14k instants each, checked against the platform tz database.
      **Verified it fails 25/37 against the old implementation.**
- [x] `HOLIDAY_COVERAGE_YEARS` — a 2027 date previously answered "not a
      holiday", indistinguishable from a normal trading day. Status now
      carries `holidayCalendarKnown`.
- [x] `PRE_OPEN` (09:00–09:15 call auction) reported separately: a price
      during the auction is not a traded price.
- [x] `getMarketStatus` now returns `tradingDate` and the named `holiday`.
- [x] One `useMarketSession()` — a single module-level ticker. `AppBar` and
      `useUniverseHistory` previously derived the session on separate clocks.
- [x] `REFRESH_CADENCE_MS` read by both the poller and the UI. Says "paused"
      when nothing is polling, rather than naming an unused interval.
- [x] Symbols verified against Yahoo's own quote pages: `^NSEI`, `^NSMIDCP`
      (NEXT 50 — reads like a midcap symbol, would have been guessed wrong),
      `^NSEBANK`, `^CNXAUTO`.

### Phase 2 — Terminology — DONE
- [x] User-visible `pp` → `%` everywhere, via one `formatGap`. Preserves the
      typographic minus (U+2212) so column alignment does not shift.
- [x] Repo-wide guard test. **Caught two live instances in the dev gallery.**
- [x] Internal names untouched (`TREND_BAND_PP`, `outperformancePct`).
- [x] "Alpha" removed as a label; glossary states it is not formal alpha.

### Phase 3 — Market UI — DONE
- [x] `MarketStatusPill` — `● LIVE · 30 sec`, tap-to-expand retained, colour
      never the only signal.
- [x] Expanded panel with all eight fields, plus a note when the holiday
      calendar cannot speak for the year.
- [x] `IndexStrip` — one batched request, existing cadence, "LAST CLOSE" when
      not live, "unavailable" rather than a dash for a missing index.

### Phase 4 — Investment model — DONE
- [x] Global "Your amount" box removed; the screen's own header comment no
      longer describes a simulator that is not there.
- [x] `InvestmentCard` — add / edit / delete, over the existing lot store.
- [x] Multi-lot already worked: `aggregateLots` was written in M8. 18 tests,
      including that aggregating then valuing equals valuing then summing.

### Phase 5 — Stock detail — DONE
- [x] Both legs of the comparison shown together — the benchmark's move over
      the same dates was previously absent, which is the half that gives the
      stock's figure meaning.
- [x] Day volume, labelled as a running session total, not a rate.
- [x] Trend reuses the existing `TREND_BAND_PP` classification.
- [x] `StockChart` — 300px, second on the screen, 1M–5M + All. Range changes
      filter an in-memory array: no refetch, no remount.

### Phase 6 — Stock table — DONE
- [x] Real `<table>`, 11 columns, `<th scope="col">` + caption. Rank and
      ticker sticky (three sticky columns would eat 190px of a 320px screen).
- [x] Columns dropped, never compressed: all 11 reachable by scrolling at
      every width, type never shrinks.
- [x] RS placed ahead of Price and Day % — it is the only number the ranking
      uses, and the rows are already sorted by it.
- [x] Measured in Chromium at 8 viewports: 5 → 11 columns, sticky holds to
      within 1px when scrolled fully right, 0px page h-scroll everywhere.
- [x] Hand-rolled virtualiser removed; page scroll gives exact restoration.

### Phase 7 — Info system
- [x] **Popup positioning fixed.** `usePopoverPosition` computes viewport
      coordinates, clamped to safe areas exposed as CSS custom properties.
- [x] **Portalled to `document.body`.** `fixed` alone was not enough: a fixed
      element under a transformed ancestor is positioned against THAT
      ancestor. Measured — computed top 281px rendered at 505px on a 568px
      screen, hanging 212px off the bottom. Found in a real browser; jsdom
      cannot see it.
- [x] Verified: 155 panels across 5 viewports (320px up) and 5 routes, all
      fully contained, zero horizontal page scroll added.
- [x] Default tier is now ONE unlabelled sentence. "Why it matters" and
      "In Gati" moved to the top of Learn more — relocated, not deleted.
- [x] 13 sentences rewritten for plainness; 4 guards enforce single-sentence,
      ≤110 chars, non-circular, jargon-free.

### Phase 8 — QA — DONE
- [x] axe (wcag2a/aa, wcag21a/aa) over 48 page × viewport combinations:
      **zero violations, zero page horizontal overflow.**
- [x] Two a11y faults found and fixed, both introduced by this work: an
      `opacity: 0.85` that dragged a 5.00:1 token to 3.94:1, and a scroller
      no keyboard could reach.
- [x] Touch targets, text size, focus rings, clipping swept at 8 viewports.
- [x] Functional regression: 46/46 checks in a real browser.
- [x] Full gates: lint, typecheck, 1,733 tests, build, size, perf — all green.

### Open questions for the owner
1. **`pp` → `%` on Relative Strength.** RS is a *difference of two
   percentages*. "+18.8%" invites "18.8% better", which overstates it — the
   reason `pp` was chosen (see `utils/formatters.js`). Proceeding as
   instructed; the info tip will carry the distinction.
2. **NIFTY AUTO / NEXT 50 index values** need verified Yahoo symbols. ETF
   proxies trade near ₹300, not index level, so they cannot stand in.

---

## BLOCKED ON THE OWNER — remaining decisions

D1, D5, D6, D7, D9 and D10 are **ACCEPTED** and implemented. Three remain, and
**none of them blocks M5.**

| # | Decision | Blocks |
|---|---|---|
| D4 | Beginner-first density baseline | M6 |
| D2 | 3Y/5Y ranges disabled with a reason | M9 |
| D3 | Device-local portfolio storage + mandatory export | M11 |

---

## NEXT — release, then post-RC decisions

**Before tagging:**
- [ ] Real-device pass on Android and iOS at 390x844 — the one gate no
      automated check can stand in for
- [ ] Verify `/api/quote` and `/api/history` respond from Netlify's IPs
- [ ] Confirm the auth tier shown in Settings on the deployed site

**Settled (D16):** the compute layer stays unwired as a retained extension
point. Not dead code. Do not wire it without a measured bottleneck.

**The roadmap is complete.** Anything further is a targeted bug fix or a
production refinement, not new scope.

---

## LATER — remaining roadmap

| Milestone | Scope | Gate |
|---|---|---|
| M4 | Design system: palette fix, icon set, primitives, illustrations, component gallery | **D5, D6** |
| M5 | Shell, universe-first nav, full URL model, legacy redirects | M4 |
| M6 | **The universe screen** — verdict, Top 5 with integrated sizing, view-all, performance | M2, M3, M4, M5, **D4** |
| M7 | Full Ranking - Strategy Record | M6 |
| M8 | Reports - Settings - Methodology | M7 |
| M9 | Chart system pass | M7, M8, **D2** |
| M10 | States - resilience - accessibility - PWA hardening -> **v1.0** | M9 |
| M11 | Manual Portfolio (post-1.0) | v1.0, **D3** |
| M12 | Stock Detail - What Changed | M11 |
| M13 | Sector Strength | M12 |

---

## CARRIED FORWARD — still open, not milestone-blocking

### Verify Yahoo works from Netlify's datacenter IP
Everything to date was verified from a residential connection. Yahoo's
anti-bot posture is known to vary by IP/ASN reputation. Tier 2 (cookie+crumb)
is confirmed functional, so the fallback exists — but whether tier 1 still wins
from a datacenter address is unverified.
**Run `scripts/verify-live-data.mjs` against the deployed URL and check the
reported `authTier`.** M2's batching materially reduces the exposure either way.

### `DATA_START_DATE` — move back to ~2023?
Currently 2025-01-01, which is why 3Y/5Y ranges have no data (D2). Moving it
back gives a longer track record and more rebalance cycles, at a real fetch-cost
across 453 symbols. Separate from D2 and deliberately deferred.

### Ticker-rename detection could name the likely cause
`renamedTickers.js` flags and suggests correctly. When a symbol fails and looks
like a known rename pattern, the message could say so explicitly rather than
leaving the user to infer it. Small, genuinely useful. **Never auto-adopt.**

### Chart geometry assertions
Deliberately not tested — recorded as decision S8. jsdom supplies no
`ResizeObserver`, so the plot surface resolves to zero size even with stubs.
Every chart's data transform *is* unit-tested. Revisit only if charts gain
interactive behaviour, which M9 may change.

### `quote.js` still duplicates the auth handshake
`history.js` and the deprecated `market-data.js` alias both use
`_shared/yahoo.mjs`. `quote.js` was deliberately left alone in M2: it is
verified-working against live Yahoo, that build environment had no network
route to re-verify a change, and ~40 lines of duplication does not justify an
unverifiable edit to a working financial data path. Fold it in during a
milestone that can be verified live.

### `/api/market-data` alias removal
Deprecated in v0.22.0. M3 has shipped, so this is now **due for removal** in the
next milestone that touches the serverless functions.

### Web Worker for the heavy compute pass — not yet needed
`computeScheduler` has both implementations behind one interface. The heavy
pass measures ~100ms at 250 symbols against a 250ms budget, so sync is fine.
Enable the worker if the budget is ever breached; it is a flag flip, not a
refactor.

### Transaction-cost rates are approximations
The rates in `config/constants.js` are reasonable but not verified against this
month's STT and stamp-duty circulars. Treat "net of costs" as illustrative
until checked. Surfaced in-product.

### Constituent lists will go stale at the next NSE reconstitution
453/453 tickers currently resolve. Indices reconstitute semi-annually and the
lists come from a third-party mirror. Provenance and `asOf` are recorded;
`asOf` should be visible in Settings (M8) so the user can watch it age.

---

## DONE — M12 - Stock Detail, What Changed, RC1 (v1.2.0-rc.1)

- [x] Stock Detail: RS on all four windows, prior month-end with its date,
      momentum age, direction, rank history. Uses `buildSingleStockRSHistory`
      (M3, unused until now) — no new calculation
- [x] Deep links from every ranked row and every Top-5 row
- [x] What Changed expanded: entrants carry RS, previous rank, direction, age
- [x] **Fixed: duplicated sizing calculation** — selector now delegates to
      `executionMetrics`; all tests passed unchanged, so they had not drifted
- [x] **Fixed: snapshot comparison (D7/D10) had never run** — built M3/M4,
      never called. Third instance of this failure mode
- [x] **Removed:** deprecated `/api/market-data`, duplicated export panel
- [x] Regression verified against live Yahoo: month-end identical to M9 run
- [x] 15 new tests (1379 total); accessibility gate extended to 8 screens

## DONE — M11 - Manual Portfolio (v1.1.0)

- [x] **D3 accepted**: device-local, no account, mandatory export
- [x] `portfolioStore` on a second IndexedDB store; additive DB upgrade;
      records migrated never cleared; atomic single-key writes
- [x] Corrupt records dropped and counted, never repaired
- [x] Quantity is the stored truth; amount converted at entry
- [x] Export / import with merge-by-id, idempotent, skips unreadable records
- [x] Storage disclosure BEFORE the first save
- [x] My portfolio screen + in-universe block that renders nothing when empty
- [x] Unpriced holdings excluded and reported, never zeroed
- [x] Separation asserted by test: no strategy figure on the portfolio screen
- [x] Accessibility gate extended to the new screen and its dialog
- [x] 45 new tests (1364 total)

## DONE — M10 - Production readiness (v1.0.0)

- [x] **Fixed: keyboard shortcuts were never wired** — written M5, never
      imported, reported as delivered. Now wired, with a `?` sheet and 9 tests
      asserting the wiring rather than the hook
- [x] **Fixed: offline was never detected** — `OfflineState` was reachable only
      from the dev gallery. `useOnlineStatus` added and wired
- [x] **Fixed: skipped heading level** on the record (h1 -> h3)
- [x] **Fixed: theme toggle still used typographic glyphs**, missed by D6
- [x] axe-core audit across 6 screens + overlays + degraded states; 0 serious,
      0 critical; build fails on regression
- [x] 4 structural a11y checks axe cannot make
- [x] Deleted a 14-component dead island, `main.preview.jsx`, 2 preview HTMLs
- [x] 1319 tests; every budget green

## DONE — M9 - Chart System Pass (v0.33.0)

- [x] **D2**: 3Y/5Y stay selectable; short data shows all verified history with
      an explicit notice naming what is missing and from when
- [x] Series contract binding everywhere: strategy solid gold, benchmark dashed
      grey; legend swatches reproduce the dash pattern
- [x] Equity and drawdown share one crosshair via `syncId`, no gap between them
- [x] `ChartCard`: title, purpose line, range control, loading/empty/short states
- [x] **Fixed**: equity axis formatted an index as rupees (₹121 for 121.3)
- [x] **Fixed**: attribution plotted rupee P&L; now percentage points, with an
      invariance test across a 1000x notional
- [x] Restored the three charts lost in M7; deleted the orphaned Dashboard chart
- [x] 17 new tests (1312 total)

## DONE — UI/UX refinement, parts 1 and 2 (v0.31.0, v0.32.0)

- [x] D15 resolved: approved architecture stands; six reversals declined
- [x] Shared surface vocabulary replacing 176 ad-hoc inline style objects
- [x] Sparklines and sector badges on every ranked row (no chart dependency)
- [x] Sticky action bar on the ranking
- [x] Global search — 453 stocks, instant, offline, keyboard-complete
- [x] Desktop rail hover-expands to labels; destination count unchanged
- [x] Skip link, dialog/listbox roles, accessible names on icon controls
- [x] Four micro-interactions, all compositor-only, reduced-motion aware
- [x] 33 new tests (1294 total)
- [x] **No engine, methodology or calculation touched**

### Deliberately not done
- Separate strategy-card library — the window matrix already makes all twelve
  reachable in one tap; a second directory would be duplication.

## DONE — D14 + M8 - Reports, Settings & Methodology (v0.30.0)

- [x] D14: momentum direction (Improving / Stable / Weakening), descriptive only
- [x] D14: portfolio-change history on every rebalance row
- [x] D14: `METHODOLOGY_VERSION` stamped on reports, history in Settings
- [x] Reports: universe comparison, 3x4 window matrix (collapsed — 650ms),
      monthly history, all seven CSV exports moved here from the record
- [x] Settings: appearance, defaults, cost rates, provenance, cache, versions
- [x] Methodology: eleven deep-linkable sections, each with a "why" panel
- [x] Placeholders deleted; all five nav destinations now lead somewhere real
- [x] Fixed: nested `<button>`, bundle gate under-reporting by a third,
      screen reaching into the data layer, setState-in-effect
- [x] 38 new tests (1261 total)

## DONE — D13 + M7 - Momentum continuity, Ranking & Record (v0.29.0)

- [x] D13: rebalance summary (entered / continuing / left) and Momentum Age
- [x] `computeMomentumAge` — one reverse pass over existing rankingHistory,
      consecutive not cumulative, stops at the first gap
- [x] Full Ranking: hand-written windowing, search, filters with counts,
      ledger key above the rows, unrankable stocks grouped at the end
- [x] Strategy Record: sample-size notice, equity curve + drawdown on a shared
      x-domain, collapsed metric groups, holdings without rupee figures
- [x] Filter and sort carry across universes (D12)
- [x] `StrategyPage` deleted; end-to-end suite rewritten against both screens
- [x] Fixed: two engine helpers read as scalars (crashed on real data),
      dropped CSV exports, missing charts, null sort ordering, reload-on-toggle
- [x] 47 new tests (1199 total)

## DONE — M6 - The Universe Screen (v0.28.0)

- [x] D12 adopted; D4 confirmed accepted by standing instruction
- [x] All four questions answered on one screen
- [x] Top 5 card **is** the Investment Simulator; amount in the header
- [x] Verdict block with both operands; rebalance timing as quiet context
- [x] Disclosures moved out of the reading path
- [x] Window and amount carry across universe switches
- [x] `CapitalCalculatorPage` and `/calculator` deleted
- [x] `prefStore` moved out of `data/` after the boundary lint caught it
- [x] `StrategyPage` lazily loaded; index chunk 54 -> 42.4 kB
- [x] Bundle gate now counts eager chunks only
- [x] 27 new tests (1127 total)

## DONE — M5 - Shell, Navigation & Routing (v0.27.0)

- [x] Universe-first URL model; every Phase 2 path resolves and is shareable
- [x] Legacy `/strategy/:key` redirects **with the window preserved**, all 12
      strategies round-tripped by test
- [x] No path produces a blank page; unknown routes keep the valid half and
      explain the redirect
- [x] `prefStore` — validated localStorage, never throws, ignores stale values
- [x] `viewState` — scroll/expansion/search/filter per route, bounded, session-only
- [x] Bottom nav + 72px icon rail replacing the 240px sidebar
- [x] Status line: five header elements consolidated into one, detail on tap
- [x] App bar scroll compression; keyboard shortcuts
- [x] Dashboard, Sidebar and TopBar deleted
- [x] 58 new tests (1076 total)

## DONE — D11 - Two-tier contextual help (v0.26.0)

- [x] All 38 glossary entries rewritten into default + Learn more tiers
- [x] `reading` -> `inGati`, making principle 2 structural
- [x] `InfoTip` gained the collapsed second tier and a reset on close
- [x] Anchoring test caught 5 entries that read generically — all rewritten
- [x] 196 new assertions (1031 total)

## DONE — D10 + M4 - Design system (v0.25.0)

- [x] **D10**: append-only revision audit trail; full prior state captured, not
      just deltas; `clear()` never wipes revisions
- [x] **D5**: two palette corrections applied; `disabled-ink` token added
- [x] **D6**: 25 drawn icons on the 24px grid; every typographic glyph removed
- [x] Primitives, data components, feedback components, illustration system
- [x] **`InfoTip`** implementing D9 — 44px target, click not hover, focus
      returned on Escape, nothing rendered for an unknown term
- [x] Motion: two animations only, both reduced-motion aware
- [x] Component gallery at `/_gallery`, dev-only and branch-eliminated
- [x] Contrast is now a build gate, both themes
- [x] 71 new tests (835 total)

## DONE — D9 - Contextual help adopted (v0.24.0)

- [x] `config/glossary.js` — 38 plain-language entries (what / why / how to read)
- [x] `docs/CONTEXTUAL-HELP.md` — InfoTip component and interaction spec for M4
- [x] 271 enforcement assertions: coverage, completeness, no circularity, no
      jargon, no false cheer, honest about short samples, correct RS units
- [x] Design Rule 53; no engine, data or UI code touched

The enforcement is the point. A documented-only requirement decays invisibly.

## DONE — M3 - Engine Consolidation & New Engines (v0.23.0)

- [x] **D1**: fractional equal weights for the record; whole-share confined to
      the Investment Simulator. Every historical figure changed, as approved.
- [x] `executionMetrics` — idle cash, drag, efficiency, ideal-vs-executable,
      minimum viable capital
- [x] **D7**: snapshot store with write-after-compare; notes name the month and
      the likely cause; selection changes ranked above value restatements
- [x] `rsHistory` — 3-month trailing RS as a projection of existing backtest
      output, plus single-stock across all four windows for Stock Detail
- [x] RS engine now exposes official prior month-end price AND date,
      current-month %, day % with live/fallback flag, and price basis
- [x] `changeDetection` — entries, exits, rank moves, days to rebalance
- [x] `portfolioValuation` — pure, ahead of its screen (M11)
- [x] `deriveUniverse` heavy/light/sizing split; `computeScheduler` with
      memoisation, de-duplication and the worker seam
- [x] 84 new tests (493 total)

**Measured:** heavy 100.5ms / light **0.04ms** / sizing **0.02ms** at 250
symbols. A quote tick costs 1/2500th of a heavy pass.

**D1 acceptance:** record return identical to 10 decimal places from ₹1 to
₹50 crore.

## DONE — M2 - Data Layer Rebuild (v0.22.0)

- [x] IndexedDB bar store: coverage-aware extension, 6h TTL, LRU, schema
      versioning, corruption tolerance, honest degradation
- [x] Batched `GET /api/history` — up to 40 symbols, per-symbol failures,
      symbol validation, 6h edge cache
- [x] `dataService` checks cache before batching; zero requests on a warm load
- [x] Provider contract gains `getHistoricalDataBatch`; both providers implement
      it; legacy per-symbol path retained so no regression test needed editing
- [x] Quote cache key hashed (~4 kB -> under 40 chars)
- [x] `market-data.js` reduced to a 64-line deprecated alias
- [x] Perf gate switched to best-of-7 after measuring 2.7x contention noise on
      unchanged source
- [x] 48 new tests (409 total)

**Measured:** cold 250-symbol load **251 -> 7 requests**. Warm load **0**. The
old cache's writes failed from **symbol 96 of 453** — every load past that
point refetched most of a universe.

## DONE — M1 - Engineering Foundations (v0.21.0)

- [x] TypeScript adopted per D8 — strict on new `.ts`/`.tsx`, `checkJs` off for
      legacy JS. **Measured first:** 1305 errors strict+checkJs, 128 non-strict,
      0 as configured. The 128 is now a burn-down metric.
- [x] Six domain types in `src/types/domain.d.ts` as the single source of truth
- [x] **Layer boundaries enforced by lint** — engine purity, config-as-leaf,
      data layer free of domain knowledge; `screens/` and `selectors/` pre-armed
- [x] **12 architecture tests proving the boundaries actually fail the build** —
      the DoD item is run, not claimed
- [x] Performance harness with real baselines (50/150/250 symbols)
- [x] Bundle-size gate, per chunk and for the initial payload
- [x] `perf-budgets.json` — budgets as reviewable data
- [x] Test harnesses: fixed clock, golden master, synthetic series, fake
      IndexedDB (pre-armed for M2)
- [x] `npm run verify` — the one command; CI runs the same chain in the same order
- [x] `DECISIONS.md`, `CONTRIBUTING.md`, PR template, CI workflow
- [x] Zero source files modified

**Baseline recorded at M1:** heavy pipeline 40.6 / 80.2 / 128.0 ms for
50 / 150 / 250 symbols against a 250 ms budget, scaling sub-linear (5x symbols ->
3.15x time). Initial payload 109.7 kB gzip against a 200 kB budget.
