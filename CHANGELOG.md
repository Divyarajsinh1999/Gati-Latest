# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com); versioning is
[semantic](https://semver.org).

## [1.6.6] — 2026-08-29 — Launch splash at native scale

Presentation only. No engine, selector or data change.

### Changed — the splash mark is launch-sized, not poster-sized

`SPLASH_LOGO_SIZE` was `min(56vw, 44vh, 320px)`, which put the mark across
**56% of the screen width on every phone**:

| device | before | after |
|---|---|---|
| iPhone SE 320x568 | 179px (56%) | 90px (28%) |
| iPhone 14 390x844 | 218px (56%) | 109px (28%) |
| Pro Max 430x932 | 241px (56%) | 120px (28%) |
| iPad 768x1024 | 320px (42%) | 128px (17%) |
| desktop 1440x900 | 320px (22%) | 128px (9%) |

Now `min(28vw, 22vh, 128px)`.

The band is drawn from what native launch screens actually do: roughly a
quarter to a third of the narrow axis on a phone — on a 390pt screen
Instagram sits near 90pt, Airbnb near 100pt, most banking apps 80–120pt — and
a fixed mark on desktop, where Slack, VS Code and Figma all land near 128px.
At 320px the mark had stopped reading as a signature and started reading as
artwork the viewer was meant to study, which is the opposite of a splash's
job: be noticed once, then get out of the way.

**One value changed.** Every layer of the composition — the halo's
`inset: -22%`, the glint band, the sweep window — is a percentage of the
stage, so the whole choreography rescaled with it and the proportions are
untouched. Verified in the browser: halo tracks the mark at 119/145/170px
across the four viewports, and the stage stays exactly centred.

Timing is unchanged: sweep at 90ms, animation complete at 1320ms, cross-fade
at 2000ms. The reduced-motion sequence is unaffected.

### Fixed — the sizing test could not have caught this

`responsive sizing` asserted only the SHAPE of the value: that it contained
`vw`, `vh` and some `px`. That passed just as happily at 56vw/320px as at any
other figure, so the thing the owner actually objected to was never covered.

It now resolves the clamp at real device viewports and asserts the rendered
result: a quarter to a third of the width on three phones, never above 160px
on a large monitor, inside 30% of the height in landscape, and never below
72px on the smallest phone — the opposite failure, where a mark shrinks to a
favicon.

### Gates

lint · typecheck · **2,341 tests / 88 files** · build · size 133.5 kB gzip of
200 kB · perf 250 symbols at 127.8 ms of 250 ms · browser QA 56/56.

## [1.6.5] — 2026-08-29 — Final pre-release audit

An adversarial hunt across the data layer, the date labels, the month
transition, the UI and the quality gates themselves. Six defects found and
fixed. **Ranking fingerprint unchanged: `1a2f4ebf010a107827c98422e9f42090`.**

### Fixed — the browser QA gate had been checking empty screens

The most serious finding, because it silently weakened every other guarantee.

`qa:browser` inspected whatever happened to be sitting in `dist/`. `npm run
build` builds against the **Yahoo** provider, so in any environment without
live market access every data screen renders its error state. Measured
against a plain production build:

| route | rows | ⓘ icons | charts |
|---|---|---|---|
| /nifty50 | 0 | 0 | 0 |
| /nifty50/all | 0 | 0 | 0 |
| /nifty50/record | 0 | 0 | 0 |
| /nifty50/stock/WIPRO.NS | 0 | 0 | 0 |

The same routes on a mock build carry 50 table rows, 42 info icons and 5
charts. So "44/44 PASS, no axe violations, no overflow" was, on those runs, a
statement about blank pages: every table, tooltip, chart and long-label
overflow risk went unchecked while the gate reported success.

Three fixes, so it cannot degrade silently again:
- `qa:browser` now **builds its own mock input**, rather than depending on
  whichever build happened to run last
- each data route **declares what it must contain**, and a shortfall is a hard
  failure printed as `EMPTY SCREEN — infoTips 0<6, charts 0<1`
- the fixed 2200ms settle became **a wait for that content**. Time to content
  is 2.5s for NIFTY 50, 3.3s for Midcap 150 and **4.5s for Smallcap 250** — so
  the small-cap dashboard had been measured on its loading skeleton, always,
  on every viewport

The repaired gate immediately failed 4 combinations on exactly that route,
which is the proof it now works.

### Fixed — three screens were never in the gate at all

`/nifty50/stock/:symbol`, `/methodology` and `/about` had never been checked
for accessibility, overflow or touch targets at any viewport. Stock detail is
one tap from the ranking table, carries a chart, a comparison card and two
metric grids — and had just been modified in v1.6.3 with no visual gate
covering the change. Coverage is now **56 combinations, up from 44**.

### Fixed — a date that does not exist became a month-end

`new Date('2026-02-30')` does not throw; it rolls over to 2 March. `monthKey`
parses exactly that way, so a bar dated 30 February was filed under **March**
and became that month's month-end.

Proven on the real engine: a stock with no genuine March bar had its
30-February row adopted as the March reference and was **RANKED on a −76.98%
return** computed from it.

Rejected at the ingestion boundary per D33, by parsing and round-tripping the
string rather than keeping a table of month lengths. 18 regression tests
covering 30 February, 29 February in a common year, 31 April, month 13, month
zero, day 32, unpadded and non-ISO forms — and confirming 29 February 2024 and
every real month-end still pass.

### Fixed — the glossary contradicted the screen it sat on

`rebalanceTiming` read "the Top 5 does not change between rebalances". True of
the **held portfolio**; false of the thing the tooltip actually sits beside —
the Dashboard's live ranking, which recomputes from the latest prices.

Measured on the engine: eight stocks across twenty-one August sessions
produced **fourteen different Top 5 line-ups**. Meanwhile My Portfolio
correctly said "This month is still running, so the Top 5 above can change".
Two screens told the reader opposite things about the same five names.

### Fixed — the Dashboard never said its Top 5 was provisional

The corollary, and the more important half. My Portfolio carried the warning;
the Dashboard, where the reader actually meets the Top 5, carried nothing.

Added beneath the list: *"Ranked on prices up to today, so this list can still
change while the month runs. The strategy acts on the last trading day's
close."* Two facts, no countdown, no prediction — a reader can draw their own
conclusion that a list read late in the month is closer to final than one read
on the 2nd. Asserted at behaviour level so the wording stays improvable.

### Fixed — phone touch targets below the project's own standard

"Expand all" (Methodology), "How Gati works" and the contact link (About), all
32px on every phone viewport. The gate had been reporting them correctly as
24–43px warnings, declining to fail the build over an AAA guideline, and
leaving them to be judged. Judged: on a phone they should be thumb-sized.

Fixed with a class hook plus a touch-only media query; desktop untouched,
where 32px at a mouse pointer is deliberate. The gate's summary line also said
"no small targets" while the table listed under-44 targets — it now says "no
sub-24px targets", matching its own documented two-threshold policy.

### Verified — no change needed

- **Universes:** exactly 50 / 150 / 250, no duplicates, zero cross-universe
  overlap, three distinct correctly-mapped benchmarks, every symbol `.NS`.
- **Month boundaries:** previous month ending on a Sunday resolves to the
  Friday; benchmark missing the month-end; stock halted on it; a month with
  one session; a month starting after several holidays. All correct, and leg
  misalignment is reported rather than repaired.
- **Malformed values:** negative, NaN, undefined, string closes and empty
  series are all excluded. No non-finite figure ever reached a ranked row.
- **Cache determinism:** cold, warm, chronological, reversed and partially
  overlapping inputs all agree. Restated bars adopt newest-write-wins.
- **August → September:** all 21 August sessions anchored to 31 Jul, all 21
  September sessions to 31 Aug, handover exactly at the first September
  session, month-to-date resetting 11.24% → 0.48%. Snapshots key per completed
  month, so no August value can survive into September.
- **Contextual help:** 53 info icons across 10 routes, every one opens with
  real content. Volatility, Sharpe, Sortino, Max drawdown and Longest
  underwater are all explained once their collapsed groups are expanded.
- **Offline PWA:** service worker controls the page, an offline reload renders
  the cached shell, data is labelled "LAST CLOSE — MARKET NOT TRADING", and
  nothing claims to be live.
- **Production smoke:** root redirect, dashboard, rankings, deep link, back,
  refresh through the SPA fallback, unknown route — **no console errors, no
  failed requests**.

### Gates

lint · typecheck · **2,335 tests / 88 files** · build · size 133.2 kB gzip of
200 kB · perf 250 symbols at 110 ms of 250 ms · browser QA **56/56**, screens
verified populated, no serious axe violations, no overflow, no sub-24px
targets.

## [1.6.4] — 2026-08-29 — Cross-check audit

A full audit of the date and comparison logic at the owner's request, run as
an adversarial hunt rather than a re-read. The invariants hold. Three defects
were found in the surrounding data layer and fixed.

**Ranking output is bit-identical to v1.6.0** — re-verified against the
pristine source after these changes: `1a2f4ebf010a107827c98422e9f42090`.

### What was verified

**Universe and benchmark wiring.** 50 / 150 / 250 constituents exactly, zero
duplicates, zero overlap between universes, every symbol `.NS`, every stock
carrying a sector, three distinct benchmarks correctly mapped.

**The month anchor, every session of a month, all three universes.** 450
stocks re-ranked as of each of 21 August sessions — 9,450 stock-sessions:

- the previous month close and its date were **identical on every session**
- both anchored to the last TRADING day of July, in a fixture where **31 July
  was deliberately a holiday** — it resolved to 30 July, as required
- `RS = stock − benchmark` exactly, every row, every session
- every stock measured from the same reference session as its benchmark
- one benchmark return shared by all stocks in a universe
- ranks contiguous 1..n, sorted by RS descending, Top 5 = the first five

**End to end through the real pipeline**, mock provider, all three universes:
one reference date (2026-07-31) shared by every row, one benchmark return per
universe, no RS identity violations, and `ranked + excluded = universe` in all
three.

### Fixed — the same data could rank differently depending on cache state

`barStore.put` sorted and de-duplicated bars, but **only when a record already
existed**. A first write stored the provider's array verbatim. Everything
downstream reads POSITION, not date — `series[series.length - 1]` is "the
latest bar", and `merged[0]`/`merged.at(-1)` are the coverage window that
decides whether to re-fetch at all.

Worse, `results` — not the write-back — is what the engine consumes, so a
cache MISS fed raw provider output straight into the ranking while a cache HIT
fed sorted output. Measured in the audit: a stock whose bars arrived
newest-first was read as having stopped trading in June and **dropped from the
ranking entirely**, then ranked normally on the next load once the cache had
sorted them.

A ranking that changes with cache state is the hardest class of bug to
believe, let alone reproduce. Series are now normalised on ingest by one
shared `normaliseBars`, on both paths.

### Fixed — a price history that contradicts itself was ranked

Two bars for the same session with different closes. The audit's fabricated
₹999 against a true ₹212 produced a **ranked −76.98% return**.

Identical repeats collapse silently — a harmless transport artefact. Genuinely
different closes for one session are an integrity fault with no correct
resolution: which price is real is not a question this app can answer, and
picking one would be a guess presented as a fact. The symbol is now failed
onto the same channel as a dead ticker, appearing in "Could not be ranked"
with its reason.

### Fixed — a two-month move labelled "This month"

`priorMonthEnd` is the newest month-end before the current month, which for a
normally-trading stock is last month. For a stock with a **gap** it is not:
June bars and August bars with no July anchors to 30 June, and August's price
divided by it is a two-month move. Measured at +14.43%.

The ranking was never affected — such a row is already excluded for want of a
reference month — but the stock detail screen renders the figure for any
symbol reachable by URL. Month-to-date now requires the anchor to be the
immediately preceding calendar month, with `previousMonthKey` handling the
December→January roll on the key itself, so there is no timezone to get wrong.

### Tested

17 new tests. The four data-layer ones were **removed-fix verified**: the
normalisation was temporarily deleted and all four failed, then restored and
all four passed.

Covers: sort-ascending from any input order, identical repeats collapsing,
conflicting closes reported, adjusted close used for the comparison,
idempotence, malformed input, cold/warm agreement, the gap case, and the
December→January boundary.

### Gates

lint · typecheck · **2,311 tests / 88 files** · build · size 133.1 kB gzip of
200 kB · perf 250 symbols at 95.7 ms of 250 ms · browser QA 44/44, no axe
violations, no overflow, no small targets.

## [1.6.3] — 2026-08-28 — Like-for-like on the stock detail card

One fix, one confirmation. The stock detail comparison now measures both legs
over the selected window. Ranking, Relative Strength and the Top 5 are
**bit-identical** to v1.6.0 — verified, not assumed (see below).

### Fixed — the comparison card compared different spans

`selectStockDetailView` read three fields off the ranking row:

| shown as | field | span |
|---|---|---|
| stock leg | `row.currentMonthReturnPct` | **always 1 month** |
| benchmark leg | `row.benchmarkReturnPct` | the selected window |
| Outperformance | `row.rs` | the selected window |

At a 1M window all three agree, which is why it shipped and survived. At any
other window the stock leg alone stayed pinned to one month. Measured against
the real engine on a stock rising steadily against a slow benchmark:

| window | stock | benchmark | outperformance | stock − benchmark |
|---|---|---|---|---|
| 1M | +3.87% | +0.95% | +2.92 | +2.92 |
| 3M | +3.87% | +3.25% | +10.39 | +0.62 |
| 6M | +3.87% | +6.66% | +22.74 | **−2.79** |
| 12M | +3.87% | +13.82% | +53.96 | **−9.95** |

Note the **sign flip** at 6M and 12M: the two visible rows implied the stock
had TRAILED its benchmark while the total beneath them said it had beaten it
by 22 points. The card's layout invites checking the subtraction, and a reader
who did got a different answer with a different sign. The stock leg was also
identical at every window — the fingerprint of a field that never depended on
the window at all.

**The fix is in the wiring, not the arithmetic.** `computeStockRS` already
takes both legs from the same reference month-end and runs both to the same
latest bar, with `rs` exactly their difference. The card now reads that pair
instead of substituting one leg from elsewhere. `stockDetailView.js` still
computes nothing, which is the rule at the top of it.

Renamed `stockSinceMonthEndPct` → `stockWindowReturnPct` (and the benchmark
counterpart) deliberately: a field named "since month end" holding a six-month
figure is how this survives a second time.

### Fixed — the card's heading was true only at 1M

It read "Since the previous month-end", with "Both measured from <date> — the
final trading session of last month". Both stayed fixed while the figures
underneath changed with the window. Now: **"Over the last 6M"**, with "Stock
and benchmark both measured from 27 Feb 2026 to the latest price — the same
dates on both sides", where the date is the window's actual reference session.

### Added — window-reference alignment

The engine reported whether the two legs start from the same session for the
**1-month anchor** only (`priorMonthEndAligned`). At 3M and above the RS legs
measure from a different month-end, and nothing reported whether those lined
up. `previousMonthEndAligned` and `benchmarkPreviousMonthEndDate` now do. When
they differ — a stock halted on the reference month's last trading day while
the index traded — the card says so rather than silently subtracting returns
measured over slightly different periods.

### Kept — month-to-date, as its own figure

The "This month" tile is unchanged and correct: window-independent, honestly
labelled, with its own anchor date. It was never the problem; confusing it
with the comparison was.

### Confirmed — core ranking is untouched

Not asserted from reading the diff. A 50-stock universe with deterministic
pseudo-random series was run through `computeCurrentMomentum` at 1M, 3M, 6M
and 12M on **the pristine v1.6.0 source** and on this build, comparing rank
order, every RS value to 10 decimal places, the Top 5 picks and the reference
dates:

```
FINGERPRINT 1a2f4ebf010a107827c98422e9f42090   (v1.6.0)
FINGERPRINT 1a2f4ebf010a107827c98422e9f42090   (v1.6.3)
```

Identical. The engine change was purely additive — two new reported fields,
no existing value altered.

### Month-boundary anchor — unchanged, by owner decision

The engine continues to read "the current month" from the latest available
bar. For a short period on the 1st of a month, before that day's first bar
exists, the previous month reads as still in progress. **Accepted and closed
as intended behaviour** (owner, 28 Aug 2026): it avoids look-ahead bias and
prevents ranking from using data that does not yet exist.

### Tested

16 new tests. Every one of the four windows is covered by:
- the printed subtraction equalling the printed total
- the stock leg being the window return, not month-to-date
- the leg growing with the window rather than sitting still
- the total never contradicting the sign of its own two rows
- the stated start date moving with the window

Plus the edge cases: insufficient history (both legs null, never a partial
comparison), missing benchmark (both legs drop together — a stock return
beside an em-dash benchmark reads as if the stock stood alone), and a stock in
the universe that was never ranked.

The fixtures build their input **through `computeCurrentMomentum`** rather
than hand-written rows, because the defect was a wiring error between two
correct engine outputs — a fixture with numbers typed in by hand could be made
to agree with either behaviour and would prove nothing. 15 of the 16 were
proven to fail against the old code first.

Verified in the browser at all four windows: subtraction matches the total at
each, and the reference date moves 31 Jul 2026 → 29 May 2026 → 27 Feb 2026 →
29 Aug 2025.

### Gates

lint · typecheck · **2,294 tests / 88 files** · build · size 132.8 kB gzip of
200 kB · perf 250 symbols at 98.4 ms of 250 ms · browser QA 44/44, no axe
violations, no overflow, no small targets.

## [1.6.2] — 2026-08-28 — The universe switcher

One owner request, in three parts. Presentation only — no selector, engine or
data change.

### The window chip is gone from the Dashboard

It was the **third statement of one fact** on that screen. The verdict eyebrow
reads "… · 1m window", and the Segmented control beneath it shows the active
window as a selected option — that one is the actual control and it stays. A
gold chip repeating it beside the universe tabs only competed with them for
attention, which is the opposite of what a page head is for.

**Kept on Live Rankings and the Strategy Record.** Neither has that eyebrow or
that control, so there the chip is the only thing naming the window the
figures were measured over. Removing it would delete information rather than
repetition. Asserted per screen, so a later tidy-up cannot "finish the job".

### The strip is a three-column control on a phone

The request was centred and bigger. Enlarging the labels alone produced
neither: at 390px the three came to **395px against 358px** of usable width,
so the strip sat scrolled to its left with "NIFTY Smallcap 250" off the edge.
A row that scrolls cannot be centred — centring a box whose contents overflow
it centres nothing.

Shrinking the type would have undone the request; abbreviating the labels
would have answered it by changing what they say. So the **layout** changed:
three equal columns across the full width, the accent dot moved **above** the
label rather than beside it, and the label free to wrap.

Moving the dot up is what bought the room — inline it cost 15px of a 118px
column, a seventh of the width, on every tab.

Measured in headless Chromium after the change:

| viewport | tab widths | overflow | page overflow |
|---|---|---|---|
| 320 | 90 / 90 / 90 | none | 0px |
| 390 | 113 / 113 / 113 | none | 0px |
| 430 | 127 / 127 / 127 | none | 0px |

Equal columns by construction, so no universe looks more important than
another because its name is longer. **The laptop layout is unchanged** — the
strip stays at the right of the title row, as asked.

### Selection is now visible

The selected tab carried `--color-surface-raised` on `--color-surface`: a
deliberately small step, correct for a card and far too little for the app's
primary filter. Measured at **1.26:1 against the strip on the light theme** —
the three tabs read as one undifferentiated block.

Four signals now: an accent wash, a 1.5px inset ring in that accent, weight
800 rather than 700, and a fully opaque, larger dot.

**The ring is drawn from `--accent-edge`, not `--accent`.** The `-fill` tokens
are pale by design — chip backgrounds meant to sit under dark text — and a
pale cyan ring on the light theme's near-white surface is close to invisible,
which is the exact complaint being answered. The base `--color-uni-*` tokens
are already darkened for light and identical to the fill on dark, so one
declaration is right in both.

Ring contrast against the strip, measured across every universe and theme:

| universe | dark | light |
|---|---|---|
| NIFTY 50 | 15.87:1 | 5.90:1 |
| Midcap 150 | 10.94:1 | 6.77:1 |
| Smallcap 250 | 10.36:1 | 6.46:1 |

WCAG 1.4.11 asks 3:1 for a non-text indicator. Active label text runs
9.57–15.65:1 on its own background, so the wash was kept weak (16%)
deliberately: a heavier one would force dark text and make the selected tab
the brightest object on the screen, louder than the verdict figure.

### Gates

lint · typecheck · **2,278 tests / 88 files** · build · size · perf · browser
QA 44/44, no axe violations, no overflow, no small targets.

Ten new tests, six reading `index.css` as source — jsdom applies no
stylesheet and resolves no media query, so a render test cannot see any of
this, and these are exactly the values a later tidy-up would flatten.

## [1.6.1] — 2026-08-28 — M16: five customisations, and a bug behind one of them

Five changes requested by the owner. Four are presentation; the fifth turned
out to be a genuine ranking defect, and fixing it exposed two more faults that
were live in v1.6.0.

**Ranking, Relative Strength, rebalance selection and benchmark mapping are
otherwise untouched.** The one engine change is an EXCLUSION rule — a stock
that could not honestly be ranked no longer is. No formula was altered.

### Fixed — a stale series was ranked on a fabricated 0.00% return

The owner reported that the previous-month-close date "keeps changing": on
27 August some stocks showed 27 July. Reproduced against the engine:

```
A.NS   priorMonthEndDate = 2026-07-31   mtd =  1.92%   ← healthy
B.NS   priorMonthEndDate = 2026-07-27   mtd =  0.00%   ← series stops 27 Jul
```

The prior month-end was taken as **the stock's own last bar before the current
month**. While a stock trades that is correct and resolves holidays with no
calendar involved. The moment a stock STOPS — halt, suspension, a rename the
fetch layer missed — the same rule silently returns whatever mid-month bar the
data ends on, wearing a month-end's label.

The consequences ran downstream. For such a stock the "current price" and the
"previous month close" were **the same bar**, so:

- month-to-date came out as **0.00%** — a bar divided by itself;
- Relative Strength was computed from that zero;
- the stock was **ranked**, and could displace a real one from the Top 5.

This is the identical divide-by-itself failure documented at the top of
`currentMomentum.js` for the BENCHMARK. It was fixed there and survived here,
per stock, for as long as a symbol has been able to go quiet.

`DATA_QUALITY_FLAGS.STALE_PRICE` had existed since v1.0.0 and **was never once
emitted anywhere in the codebase** — this is the condition it was defined for.
The glossary entry for `priorMonthEnd` already promised the correct behaviour
("if a stock has no data for that month at all it is excluded from the ranking
and flagged"), so the words shipped and the code did not.

- **The rule:** a stock with no bar in the benchmark's current month has no
  current-month price and therefore no current-month return. Not zero —
  absent. Flagged `Stale Price`, left unranked, reason naming the last session
  it has data for.
- **Deliberately not a tolerance in days.** "Has it traded this month" is a
  fact; "is five sessions too many" is a judgement, and a stock halted for a
  week mid-month still has a real price to measure from. Thin trading is a
  liquidity question, answered elsewhere.
- 5 guard tests written first and proven to fail; 26 in the file now. The
  owner's requirement is pinned directly: 31 July's close must read
  identically on every August session and move only when the month does.
  **That block passed before the fix too** — healthy stocks were never
  drifting, only stale ones.

### Fixed — an unranked stock appeared in no list at all

Found while fixing the above, and pre-existing (it applied to `MISSING_DATA`
in v1.6.0). The "Could not be ranked" group was built only from
`unavailableSymbols` — the symbols whose FETCH failed. A row the ENGINE
declined was filtered out of the ordered list and appeared nowhere else: 50
stocks in the universe, 49 rows on screen, footer reading "49 ranked · 0
excluded".

Silent subtraction is the failure this app is least allowed. `ranked +
excluded = universe` is now asserted, the engine's own reason is carried
through ("No price data since 2026-07-27" tells the reader what to check), and
a symbol flagged by both paths is listed once.

### Fixed — the browser QA gate had never run outside one machine

`browser-qa.mjs` spawned `/home/claude/serve.mjs`, an untracked scratch file
outside the repository. Anywhere else it died with `ERR_CONNECTION_REFUSED`. A
gate with a dependency nobody can check out is worse than no gate: it sits in
`package.json` implying a coverage that was not happening. The server now
lives at `scripts/serve-dist.mjs`, 30 lines, with the SPA fallback the deep
routes need. All 44 combinations pass.

### 1. "Command Center" is now "Dashboard"

Sidebar, breadcrumb, screen title, QA route labels. `shell.test.jsx` needed
retargeting rather than renaming: it asserted `not.toContain('Dashboard')`,
which guarded the REMOVED cross-universe overview page from Phase 1 decision
1, not the word. It now checks the destinations — no `/dashboard`, no
`/calculator`, no opinion page, and the surviving Dashboard link must carry a
universe key.

### 2. Every column on an upright phone, and the whole row scrolls

Columns carried a `minWidth` below which they were dropped, so a 320px phone
showed five of eleven. The stated intent was that all eleven stayed
"reachable by scrolling" — **not true**: a dropped column is not in the DOM.
Stock %, Benchmark %, Prev month close, Day volume and Trend did not exist
upright, and turning the phone sideways was the only way to see them.

All eleven now render at every width, at their desktop sizes, with the
scroller carrying the overflow. Rank and Ticker are **no longer sticky** at
the owner's instruction — on a 390px phone they cost 144px to anchor a row
identifiable by its position. Header rows keep their VERTICAL stickiness.

Confirmed in headless Chromium, which jsdom cannot do (it computes no layout):

| viewport | columns | rank cell travelled | page overflow |
|---|---|---|---|
| 320 | 11 | 854px | 0px |
| 390 | 11 | 784px | 0px |
| 768 | 11 | 670px | 0px |
| 1440 | 11 | 0px (all fits) | 0px |

The rank cell moving the full scroll distance is the proof nothing is pinned.

### 3. Momentum equity curve on the Dashboard

Beneath the four metric tiles, per universe, both legs toggleable from the
legend. Verified in Chromium on all three: lime `#d7ff43`, cyan `#7dd3fc`,
magenta `#f0abfc`, each against the same dashed grey benchmark, no page
overflow at 390 or 1440. Hiding a series drops the chart from 2 rendered
lines to 1 and keeps the control that restores it.

- `buildIndexedBenchmarkCurve` **moved** from `recordView.js` to
  `utils/chartData.js`. Two copies of a compounding loop is two chances for
  the Dashboard and the record to disagree about what the benchmark did —
  which would surface as one screen quietly contradicting another, not as a
  failing test. A wiring test now asserts exactly one definition exists.
- `hide` rather than unmounting the `<Line>`: Recharts derives its y-domain
  from mounted series, so unmounting would rescale the axis under the
  survivor and make the remaining line visibly change shape — reading as the
  data changing rather than the view.
- Legend toggles carry state in `aria-pressed`, not opacity alone, and a
  hidden series stays listed. Removing it would leave no way back, and a lone
  strategy line looks like a chart that never had a benchmark.
- **Indexed to 100, not rupees.** The reference build prints "₹62K" on this
  curve; D1 removed exactly that assumption and it does not return because
  the chart changed screens.
- `seriesContract.strategy.name` renamed 'Strategy' → 'Momentum portfolio' so
  the tooltip and the legend stop calling one line two different things.

### 4. Contextual help on Stock % and Price

The last two columns without an info button, and the two most easily misread:
a month-to-date figure beside a day move gets read as a second day move, and a
price read on a Sunday gets taken for a live one.

`InfoTip` gained an optional `note` — one sentence of CURRENT STATE rendered
under the definition. The glossary is static by design and cannot answer "is
this number live or Friday's", which changes by the minute. The rule keeping
this from becoming a second glossary: a note states a fact about this moment;
anything that would read the same tomorrow belongs in `glossary.js` where it
is reviewed against D11.

Both new entries were caught by the house-style tests — circular definition,
and an `inGati` line that read generically — and were **rewritten rather than
exempted**.

### 5. The previous month close now shows its date

The denominator of the stock return two columns away, and until now the only
unauditable figure on the row: nothing on screen said whether it was holding
still through the month or drifting. Rendered small and dim beneath the price
— evidence for the figure above it, not a second figure.

### Also

- Sidebar milestone stamp read **M14 throughout v1.6.0, which was M15**.
  Corrected to M16. `APP_VERSION` is compiled from package.json and cannot
  drift; this label is hand-written and did.
- `m15Wiring.test.js` extended to this release: both curve legs, the universe
  accent key, `priceNote`, `priorMonthEndDateLabel`, one and only one
  benchmark-curve builder, and `STALE_PRICE` having a real emitter.

### Gates

lint · typecheck · **2,268 tests / 88 files** · build · size 132.8 kB gzip of
200 kB · perf 250 symbols at 117.9 ms of 250 ms · browser QA 44/44, no axe
violations, no overflow, no small targets.

### Known issues

- **Month-boundary anchor, unchanged and deliberate.** The engine reads "the
  current month" from the latest available bar, which is what keeps
  look-ahead bias out. For the few hours on the 1st of a month before that
  day's first bar exists, the previous month reads as still in progress. Real
  but narrow, and a design trade rather than a fault — flagged to the owner
  rather than changed quietly, because it would move ranking logic.
- Mixed minus glyphs (`formatGap` emits U+2212, `formatPct` an ASCII hyphen)
  — unchanged, still deferred, 36 call sites and 24 tests pin current output.
- `stockDetailView` pairs a 1-month stock return with a window-dependent
  benchmark return; at windows other than 1M the detail screen compares
  mismatched spans. Found during this review, not yet fixed.
- `v7/finance/quote` returns 401 unauthenticated and always uses the
  cookie+crumb tier; live prices and history can fail independently.

## [1.6.0] — 2026-08-16 — M15: what an investor needs to see

Six additions, all of them risk VISIBILITY (D21–D26). None changed what the
strategy does: ranking, Relative Strength, rebalance selection and benchmark
mapping were not touched. Tax and costs are post-processing on a completed
record.

### Tax — 1.5.3 (engine) and 1.5.4 (in the record)
- `src/engine/tax.js`: short-term capital gains under Section 111A, grouped by
  Indian financial year with losses set off within each year. 17 tests, every
  expected value derived by hand and the important ones asserted NOT to equal
  the plausible wrong answer.
- **The rate is verified, not assumed:** 20% + 4% cess = **20.8% effective**,
  per the Finance (No. 2) Act 2024 for transfers on or after 23 July 2024.
  Roughly half the sources available still print the pre-2024 figure of 15%.
- **Losses are netted, and it matters:** measured on the record, gains 27,225
  against losses 21,982. Taxing every winner and ignoring every loser gives
  Rs 5,663; netting per financial year gives Rs 3,031 — the naive model
  **overstates the bill by 87%**.
- **It errs high, deliberately.** A year ending at a net loss owes nothing and
  that loss is NOT carried forward, though the law allows eight years.
  Carry-forward depends on the reader's own filing, which the app cannot know.
- Settings row (BEFORE / AFTER, defaulting BEFORE) and an **always-visible**
  after-tax line under the record headline, shown whatever the toggles say.
  Includes `flipsVerdict` — the case the feature exists for: a strategy that
  beats its benchmark gross and loses to it net.
- **Fixed:** the Settings cost note showed every rate 100x too large — "STT
  10.000%" against a real 0.1%. No backtest figure was ever affected;
  `calculateTradeCost` divides correctly. The error sat in one sentence nobody
  reconciles against anything.

### Underwater duration — 1.5.5
- `calculateUnderwaterDuration`: the longest run below the previous peak, and
  whether the record is still there. Beside max drawdown: depth, then time.
- **Changed:** the record headline is coloured by its own return, not by
  outperformance. A record making +16.69% while its benchmark made more was
  printed in the loss colour.
- **Fixed:** that change turned the outperformance chip green, because both
  read one `direction` field. Two figures with two meanings now have two.

### Sector concentration — 1.5.6
- A line under the Top 5 naming the largest industry group and how many of the
  five are in it. Amber at three or more. Not a score (D15/C5 stands).
- Unknown sectors are named, never absorbed: three unclassified out of five
  reads "Spread across 2 of 2 known · 3 unclassified", not "Spread across 2
  sectors" — which would be a claim about diversification with no basis.

### Rebalance action list — 1.5.7
- `selectRebalanceActions` on My Portfolio: still ranked, no longer ranked,
  ranked but not held, plus holdings absent from the ranking entirely.
- Subtraction, not advice. No quantities, no order values; a test asserts the
  words "buy" and "sell" never appear in the summary.
- **Fixed during verification:** the list would never have appeared for most
  readers. It was shown only when a universe filter was selected, but that
  filter only appears once holdings span two or more universes.

### Liquidity — 1.5.8
- A position measured against the traded VALUE of the latest session. 10,000
  shares of a Rs 400 stock and 10,000 of a Rs 4,000 stock are two different
  markets; value is what an order competes for.
- Thresholds (1% notice, 5% warn) are exported rather than buried, because
  they are judgement. Missing volume returns null, never "ok".

### Paper log — 1.5.9
- A `journal` IndexedDB store, separate from `portfolio`. DB version 2 → 3;
  the upgrade creates the missing store and touches nothing existing.
- `createdAt` is stamped by the store and never accepted from a caller: the
  entire value of an entry is that it predates the outcome.
- Symbols are deliberately NOT validated against the Top 5 — the months worth
  re-reading are the ones where the owner disagreed with it.

### Gates and wiring — 1.6.0
- **Removed a dead code path:** `assessPortfolioLiquidity` had been wired into
  `selectSizing`, which computes a whole-portfolio allocation that no screen
  renders. Correct, tested, and unreachable.
- **Added `m15Wiring.test.js`:** every M15 engine module must have a consumer,
  and every selector field must be READ by a screen. Proven to fail against
  two deliberately unwired features.
- lint · typecheck · **2,192 tests / 88 files** · build · size 129.7 kB /
  200 kB · perf 115.6 ms at 250 symbols · `qa:browser` across **44
  combinations**: zero axe violations, zero overflow, zero sub-24px targets.

### How the bugs in this milestone were found
Five of them — the 100x cost note, the outperformance chip, the action list
that would never have appeared, the dead liquidity path, and a changelog that
silently recorded nothing — were caught by reading a screenshot, grepping for
consumers, or checking the file afterwards. Not by the suite. Unit tests
verify the pieces; in this codebase the faults live in the joins.

---

## [1.5.2] — 2026-08-14 — Pre-delivery audit of the Terminal reskin

Full source diff against v1.4.0-rc.1 confirmed no module was removed.

- **Fixed: a mistyped URL rendered a completely blank page.** `/nifty5`,
  `/portfolo` — the shell with an empty content area, no message, no redirect.
  Pre-existing, reproduced against the shipped v1.4.0-rc.1 build. React Router
  matches on specificity, so `/:universeKey` beat the `*` catch-all and
  `UnknownRoute` was never reached.
- **Fixed: the redirect explanation never arrived.** A bad path redirects to
  `/`, which redirects again; `<Navigate>` starts with empty state, so the
  notice was dropped on the second hop.
- Added `unknownRoute.test.jsx` — 7 tests through the real route table.

## [1.5.1] — 2026-08-14 — Self-hosted typefaces

- Manrope and DM Mono served from `/fonts/` — six woff2 files, 87 kB —
  precached by the service worker. No request leaves the origin.
- **`latin-ext` is mandatory, not an optimisation:** the rupee sign U+20B9
  sits in latin-ext's U+20AD-20C0, not in latin. Shipping latin alone would
  have left every price taking its most-used glyph from a fallback face.
- DM Mono is not a variable font: 400 and 500 are separate files.
- Verified offline: after the service worker took control, going offline and
  reloading still renders in the real typefaces.

## [1.5.0] — 2026-08-13 — M14: the Terminal reskin

Adopts the visual language and shell of the owner's reference build over
Gati's own content and calculations (D18, D19, D20).

- **Palette:** terminal scheme in both themes; token NAMES unchanged, values
  replaced. 27 pairings measured; four greys from the reference lifted because
  they failed WCAG AA (its section labels sit at 2.76:1).
- **Per-universe accent:** NIFTY 50 lime, Midcap cyan, Smallcap magenta.
- **Type:** Manrope + DM Mono; every figure on the mono face.
- **Shell:** 236px sidebar with WORKSPACE/SYSTEM, topbar with breadcrumb and
  market status, single-line ticker tape, universe tab strip, drawer at 760px.
- **Dark is the default**; light retained and derived, not sampled.
- **Fixed: the drawdown chart had never drawn.** `buildDrawdownSeries` emits
  `Drawdown`; the chart read `dataKey="drawdown"`. Recharts renders nothing
  for an absent key and does not warn.
- **Fixed:** horizontal page overflow on every phone width (78px at 320px).
- Added `/strategies`, a directory read from the registry.

---

## [1.4.0-rc.1] — 2026-08-08 — Home, market data, stock detail & responsive UX

Owner brief of 8 Aug 2026, implemented across eight phases. One real
correctness bug, several honesty fixes, and a table that finally shows the
figures the strategy is built on.

**No calculation changed.** Relative Strength, universe membership, rebalance
logic and benchmark definitions are byte-for-byte what they were.

### Fixed — the market read OPEN when it was closed, for every user in India

`nowInIST()` added the DEVICE's timezone offset to an instant that was already
absolute. In Asia/Kolkata the +5:30 and the −5:30 cancelled and the function
returned plain UTC, so the app reported OPEN from 14:45 to 21:00 IST and
CLOSED through the real session.

CI and every dev container run in UTC, where `getTimezoneOffset()` is 0 and
the fault is arithmetically invisible. 1,466 passing tests could not see it.
The regression test now pins the device clock to five zones — including
Asia/Kolkata and a :45-offset zone — and checks 14,206 instants per zone
against the platform's own tz database. **Verified to fail 25/37 against the
old implementation.**

Related, in the same area:

- `HOLIDAY_COVERAGE_YEARS` — a 2027 date previously answered "not a holiday",
  indistinguishable from a normal trading day. On 1 Jan 2027 every NSE holiday
  would have become a trading day. Status now carries `holidayCalendarKnown`
  and the panel says so.
- `PRE_OPEN` (09:00–09:15 call auction) reported separately: a price during
  the auction is not a traded price.
- The header claimed "15 min" beside data that refreshes every 30 seconds.
  `REFRESH_CADENCE_MS` is now read by both the poller and the UI.

### Fixed — the info panel opened outside the viewport

It was `position: absolute; left: 0; width: 300px` inside the icon's own span,
so an icon in the right-hand half of a phone ran hundreds of pixels past the
edge — widening the page, forcing a sideways scroll to finish a sentence. The
icons in right-aligned numeric columns were the worst affected.

`position: fixed` alone was not enough, and this is the part worth
remembering: a fixed element inside an ancestor carrying `transform` is
positioned against THAT ANCESTOR. Measured in a real browser — a panel
computed at top 281px rendered at 505px on a 568px screen, hanging 212px off
the bottom. Fixed by portalling to `document.body`.

Verified: 155 panels across 5 viewports (from 320px) and 5 routes, every one
fully contained, zero horizontal page scroll added.

### Added

**One market session.** `useMarketSession` — a single module-level ticker.
`AppBar` and `useUniverseHistory` previously derived the session on separate
clocks. The live claim is granted in one place and requires all four of:
exchange trading, online, real data, today's bar.

**Market status pill.** `● LIVE · 30 sec`, tap-to-expand retained, eight-field
panel. The word "Market" is gone — a status dot beside a trading app does not
need to announce which market.

**Index strip** — NIFTY 50, NEXT 50, BANK, AUTO. Every symbol verified against
Yahoo's own quote page: `^NSEI`, `^NSMIDCP`, `^NSEBANK`, `^CNXAUTO`. Two would
have been guessed wrong — `^NSMIDCP` is NIFTY NEXT 50 despite reading like a
midcap symbol, and NIFTY AUTO is `^CNXAUTO`, not `^NSEAUTO`, which does not
exist. ETF proxies were rejected: JUNIORBEES trades near ₹300 against an index
near 71,000, and an ETF price under an index's name is a fabricated value.

**Per-stock investment**, replacing the global "Your amount" box. That control
could only describe a hypothetical — five stocks bought in one transaction at
today's prices — so its share counts belonged to no actual holding. Investment
is now a property of a stock, with real quantities, prices and dates.
Multi-lot already worked: `aggregateLots` was written in M8, so this needed
aggregation, not a new model.

**The eleven-column table.** A real `<table>` with `<th scope="col">` and a
caption, replacing rows of divs that read out to a screen reader as an
undifferentiated stream. Rank and ticker stay pinned; columns are dropped, not
compressed, as width falls — all eleven remain reachable by scrolling at every
size, and type never shrinks.

Relative Strength sits ahead of Price and Day %, against convention. It is the
only number the ranking is built from and the rows are already sorted by it;
leading with the day's move invites reading a stock as strong because it rose
today.

**Stock detail** gained the benchmark leg beside the stock's own — previously
absent, and it is the half that gives the stock's figure meaning. Plus day
volume (labelled a running session total, not a rate), trend reusing the
existing `TREND_BAND_PP` classification, and a 300px chart with 1M–5M ranges
that filter an in-memory array: no refetch, no remount.

### Changed — `pp` is gone from the interface

Owner decision. Relative Strength and outperformance now read as `%`
everywhere, framed as "this much ahead of the benchmark". The arithmetic did
not change — these are still differences between two percentages — so the
distinction moved into the glossary rather than being lost. A repo-wide guard
enforces it, and **caught two live instances during the change**.

Outperformance is no longer called "alpha"; the glossary states plainly that
it is not alpha in the formal sense.

**The info panel's default is one sentence**, down from three labelled
sections. Nothing was deleted — "Why it matters" and "In Gati" moved to the
top of Learn more. Four guards enforce single-sentence, ≤110 characters,
non-circular and jargon-free.

### Accessibility

axe (wcag2a/aa, wcag21a/aa) across 48 page × viewport combinations: **zero
violations, zero page horizontal overflow**. Two faults found and fixed, both
introduced by this work: an `opacity: 0.85` on the status pill dragged a token
that measures 5.00:1 down to 3.94:1, and the index strip scroller was not
keyboard-reachable. Also: a 9px label, 30px chart-range buttons, and `Field`
inputs sized 21px inside a 44px box, so half the apparent target was dead.

### Removed

The hand-rolled list virtualiser. It windowed rows of divs into a fixed 640px
inner scroller; the table scrolls with the page, so the browser's own scroll
restoration applies and is exact. At 250 rows the measured render is well
inside budget, and `npm run perf` is the gate that says so.

## [1.4.0-rc.1] — 2026-08-08 — Home, market data, stock detail & responsive UX

Owner brief of 8 Aug 2026, implemented in the phase order it specified. One
real correctness bug found and fixed; the rest is presentation, data honesty
and personal investment tracking. **No change to ranking, rebalance, universe
or benchmark logic.**

### Fixed

**THE MARKET READ "OPEN" WHEN IT WAS SHUT, FOR EVERY USER IN INDIA.**
`nowInIST()` added the DEVICE's timezone offset to `getTime()`, which is
already an absolute instant. In Asia/Kolkata that −5:30 exactly cancelled the
+5:30 on the next line, so the function returned plain UTC and the header
reported OPEN from 14:45 to 21:00 IST and CLOSED through the real session.

CI and every dev container run in UTC, where `getTimezoneOffset()` is 0 and
the fault is arithmetically invisible — which is why 1,466 passing tests never
saw it. The regression test now pins the device clock to five zones on
purpose, including a `:45` offset, and checks 14,206 instants per zone against
the platform's own tz database. **It fails 25 of 37 against the old code.**

**A 1 MB intermediate was being precached** (v1.2.1), and **the info popup left
the viewport on narrow screens**, and **`Navigation.jsx` had pointed at a
nonexistent `/gati-mark.png` since M5** — all detailed in their own entries.

### Added

**Centralised market session.** `useMarketSession` — one module-level ticker.
`AppBar` and `useUniverseHistory` previously derived the session on separate
clocks; nothing made them agree. The word "live" is granted in exactly one
place and requires all four of: exchange trading, online, real data, and a
newest bar from today.

**Honest refresh cadence.** `REFRESH_CADENCE_MS` is read by both the poller and
the UI. The header said "15 min" beside data refreshing every 30 seconds. When
nothing is polling it says "paused" rather than naming an unused interval.

**`PRE_OPEN`** (09:00–09:15 call auction) is distinct from OPEN — a price
during the auction is not a traded price. **`HOLIDAY_COVERAGE_YEARS`** stops a
2027 date reading as "not a holiday", which was indistinguishable from a normal
trading day.

**Market status pill** — `● LIVE · 30 sec`, tap-to-expand retained, eight-field
panel, colour never the only signal.

**Index strip** — NIFTY 50, NEXT 50, BANK, AUTO. Every symbol verified against
Yahoo's own quote page (S4): `^NSEI`, `^NSMIDCP`, `^NSEBANK`, `^CNXAUTO`.
`^NSMIDCP` is NIFTY NEXT 50 despite reading like a midcap symbol, and would
have been guessed wrong. ETF proxies were rejected — JUNIORBEES trades near
₹300 against an index near 71,000, so it cannot stand in for an index level.
One batched request on the existing cadence; no second polling timer.

**Per-stock investment tracking**, replacing the global "Your amount" box. One
number for the whole Top 5 could only describe a hypothetical portfolio bought
in a single transaction at today's prices, so its share counts belonged to no
actual holding. Multiple lots needed no new model: the store has always kept
one record per purchase and `aggregateLots` has combined them at weighted
average cost since M8.

**The eleven-column table** — a real `<table>`. A div grid cannot express
`<th scope="col">`, so the previous list read to a screen reader as an
undifferentiated stream. Rank and Ticker stay pinned; three sticky columns
would consume 190px of a 320px screen. All eleven columns are always reachable
by scrolling — width changes only which are visible without it, and type never
shrinks to force a fit.

**Larger stock chart** with 1M–5M ranges. Range changes filter an in-memory
array: verified to issue zero API requests.

### Changed

**`pp` → `%` throughout the interface** (owner decision, restated 8 Aug). These
values are arithmetically percentage POINTS; the reasoning is preserved in
`formatGap` and the meaning moved into the glossary, which now states that
+11.4% means 11.4 points ahead rather than 11.4% more. The typographic minus
(U+2212) is preserved so column alignment does not shift. **A repo-wide guard
caught two live instances during the change.**

**"Alpha" is no longer used** for a plain return difference. The glossary says
outright that it is not alpha in the formal sense.

**Info popups: one sentence by default.** "Why it matters" and "In Gati" moved
to the top of Learn more rather than being deleted. Thirteen default sentences
rewritten; four guards enforce single-sentence, ≤110 characters, non-circular
and jargon-free.

**Info popup positioning**, which was `position: absolute; left: 0; width: 300`
inside the icon's own span — so an icon in the right half of a phone put the
explanation past the edge of the document and WIDENED THE PAGE. `fixed` alone
was not enough: a fixed element under a transformed ancestor is positioned
against that ancestor, and this app has transforms on hover rows and route
transitions. Measured — a panel computed at top 281px rendered at 505px on a
568px screen and hung 212px off the bottom. Fixed with a portal to
`document.body` plus viewport clamping against safe-area insets.

### Accessibility

axe (wcag2a/aa, wcag21a/aa) across 48 page×viewport combinations: **zero
violations**. Two faults found, both introduced by this work — an
`opacity: 0.85` that dragged a 5.00:1 token to 3.94:1, and an index strip
scroller that was not keyboard-reachable. Also raised: a 9px label to 10px,
chart range buttons from 30px to 36px, and `Field` inputs that were 21px tall
inside a 44px box, so half the apparent target did nothing.

### Removed

The hand-rolled list virtualiser. It windowed rows of divs into a fixed 640px
scroller; the table scrolls with the page, so the browser's own scroll
restoration applies and is exact. At 250 rows the measured render is well
inside budget, and `npm run perf` says so rather than a component assuming it.

## [1.3.0-rc.1] — 2026-08-08 — Launch splash: Luxury Light Sweep

Owner-specified launch animation, built from the supplied storyboard treated
as a specification rather than as inspiration. Concept #2 of five.

No calculation, no screen and no data path changed. Recorded as **D17**,
because it is a deliberate exception to a principle the codebase states aloud.

### Added

**The splash**, in three files with the animation logic separated from the UI:

| File | Owns |
|---|---|
| `config/splash.js` | every duration, the easing, the colour, the responsive size — pure data |
| `hooks/useSplashSequence.js` | the phase machine, reduced motion, dismissal, chrome-colour restore |
| `components/layout/SplashScreen.jsx` | the layer stack, and nothing else |

Sequence: 90ms of darkness, a 900ms sweep, a halo rising from 700ms and
settling at 1320ms, a 300ms hold, a 380ms cross-fade. The animation completes
at 1320ms — inside the 1.2–1.5s brief — and the app is visible at 2000ms.

**Mounted as a sibling of the router, not a wrapper around it.** The app
mounts, resolves its route and starts fetching on the same frame, unaware
anything is drawn on top. Deleting the component changes when the app becomes
visible and never when it becomes ready.

### The sweep is built from transforms only

The obvious implementation animates `mask-position`, which repaints the masked
element every frame. This one moves the mask without moving the mask: the
masked wrapper slides 1.5 stage-widths right while the artwork inside it
counter-translates 1.5 stage-widths left. On screen the artwork does not move;
the mask crosses it. Every keyframe animates `opacity` or `transform` — no
layout, no paint.

Verified in a headless browser rather than asserted: the rendered artwork's
bounding box is **identical to the pixel** across the sweep once revealed, and
centred to within half a pixel at 390×844. A test asserts the two translations
cancel arithmetically, so a future tweak to one cannot silently make the mark
slide across the screen.

### Two faults the rendered frames caught and the arithmetic did not

**The first geometry was correct and visually wrong.** At 400% wrapper width
and 3 stage-widths of travel, the mark occupied a quarter of the wrapper and
the reveal edge crossed it in roughly 180ms of a 900ms sweep — the remaining
720ms was dead air. Retuned to 250%/1.5 so the edge is arriving at the mark's
left edge on the first frame and clearing its right on the last. A test now
pins the mark at exactly one stage width.

**The specular band washed the card silver.** At 0.62 alpha over a wide band
it read as a light bar rather than a highlight on metal. Narrowed, and pulled
back to 0.42 at the core.

### Fixed

**Android painted a white flash before every launch.** The PWA manifest's
`background_color` was `#F4F5F1` — the light canvas colour. That is what
Android paints for its **own** native splash, before a single line of this app
runs, so a cold start showed white, then the dark splash. Now matches the
splash background.

**A light-theme web load flashed the same way**, between first paint and React
mounting. Handled by a pre-paint inline `<style>` in `index.html`, keyed on a
`data-splash` attribute the hook removes when the splash is genuinely gone —
not when the fade starts, which would show the seam it exists to hide.

### Guards

The splash background now lives in three places that cannot import each other:
`config/splash.js`, the inline `<style>`, and the manifest. A test reads all
three and fails on drift, following the pattern established for the theme
bootstrap in S9. Also asserted: the keyframes animate nothing but `opacity`
and `transform` (verified by reintroducing `background-position` and watching
it fail), the specular band runs on the same clock as the reveal edge, the
asset is a real WebP under 80 kB, and it is precached.

### Degradation

- **Reduced motion** gets a complete alternative, not a truncated one: the
  mark appears, holds, fades. No sweep, no travelling light, no halo.
- **A failed asset** ends the splash on the frame that observes the failure —
  an empty dark rectangle sitting on the app for two seconds is worse than no
  splash. Derived rather than pushed into state, so there is no extra frame.
- **No `mask-image` support** shows the mark without a sweep — plain, not
  broken. Such a browser also lacks WebP, in which case the path above runs.

### Assets

`gati-splash.webp`, 768px, 42 kB, generated by `scripts/generate-icons.py`
alongside the icon set. Measured alternatives at the same size: PNG 541 kB,
lossless WebP 351 kB. Mean channel error against the PNG over opaque pixels is
~2/255. It sits on the critical path of the first paint, before any service
worker exists, which is what the size is chosen for.

### Not changed

Any number, any screen, any engine. The motion block in `src/index.css` is
annotated rather than rewritten: two animations still govern the application,
and the splash is named as the one exception.

## [1.2.1-rc.1] — 2026-08-08 — New app mark

Owner supplied replacement artwork. No behaviour, no calculations, no screens
changed. One real bug surfaced while wiring it.

### Changed

**New identity artwork.** `brand-src/LOGO.png` replaced with the supplied v2
render (948x944): a navy card edged with a thin gold rule, carrying a gold
Devanagari-derived letterform and a gold-and-emerald ascending zigzag. All
seven shipped assets regenerated from it — `icon-192/512`,
`icon-maskable-192/512`, `apple-touch-icon`, `favicon-32`, `gati-mark`.

**`scripts/generate-icons.py` re-measured, not merely re-pointed.** Three
numbers were measured off the new master rather than inherited:

| | v1 artwork | v2 artwork |
|---|---|---|
| crop box | `(181, 178, 843, 845)` | `(8, 9, 938, 934)` |
| card navy | `#0e1b2c` | `#030f1e` |
| maskable scale | `0.78` | **`0.63`** |

The maskable change is the one that matters. The previous artwork had no
visible border, so Android clipping a corner cost a few pixels of navy and was
invisible. This artwork's gold rule traces the card's outline, so the maskable
variants must fit the **whole card** inside Android's 80%-diameter safe circle,
not just the mark:

```
rounded square, side s, radius 0.18s
outermost point = sqrt(2)·(s/2 − 0.18s) + 0.18s = 0.6326s
require 0.6326s ≤ 0.40T  ->  s ≤ 0.632T
```

Shipped at 0.63, reaching 0.3985 of the tile. The script now **asserts** this
rather than trusting the constant, so lowering the radius ratio or raising the
scale fails the run instead of shipping a bitten ring.

The card's own corner radius was fitted from the border contour at ~165px on a
930px card — 0.177, so the existing 0.18 mask still traces the artwork exactly
and needed no change.

### Fixed

**The sidebar mark has been a broken image since M5.** `Navigation.jsx`
referenced `/gati-mark.png`; that file has only ever existed at
`/icons/gati-mark.png`. Icon paths in components are plain strings rather than
ESM imports, so Vite never resolves them and nothing failed at build time —
lint, typecheck, 1379 tests, build, size and perf were all green throughout.
`AppBar.jsx` had the correct path, which is why it was never noticed.

This is the same failure class as the M12 findings (keyboard shortcuts, offline
detection, snapshot comparison): a thing that was written, tested, and not
actually connected.

**Inline mark corner radius.** `AppBar` used 5px at 24px and `Navigation` 6px
at 28px, both larger than the artwork's own 0.18 alpha rounding. Harmless
against a borderless mark; against a gold rule it shaves the corners. Now 4px
and 5px respectively.

**A 1 MB intermediate was being precached.** The generator wrote its
squared-up working card to `public/icons/`. The PWA `includeAssets` glob sweeps
`icons/*.png` and the service worker precaches every match, so that file was
downloaded in full by every user on install. It now goes to `brand-src/`,
outside `public/` entirely. Caught by inspecting the built `sw.js` precache
manifest, not by any gate — the bundle budgets cover JS chunks, not assets.

### Added

**Two guards, for the two classes of bug above.** `icons.test.js` now walks
every `.js/.jsx/.ts/.tsx` file under `src/`, extracts absolute image `src`
paths, and asserts each resolves to a file in `public/`; and asserts
`public/icons` contains nothing but the shipped set. Both were verified by
reintroducing the fault and watching the test fail.

### Removed

**The retired code-generated identity's generators.** `brand-src/build_mark.py`,
`build_lockup.py`, `export_assets.py`, `NotoSansDevanagari.ttf` and
`docs/gati-identity-sheet.png`. That mark was rejected and replaced at v0.19.1,
but the scripts still ran, and a script that still runs is a script a future
session will run. Reasoning for the original mark stays in this changelog.

### Documentation

`docs/BRAND.md` rewritten — the old file described the retired mark as current
in its first half and as superseded in its second. It now records provenance,
the measurements and their derivations, and deliberately does **not** invent a
design rationale for artwork it did not draw. `public/icons/README.md`,
`HANDOFF.md`, `catchup-prompt.md`, `vite.config.js` manifest comment and the
stale `Sidebar.jsx`/`TopBar.jsx` names in `scripts/build-preview.py` all
corrected.

### Not changed

Colour tokens. The new mark's gold (`#e8ab42`) and emerald (`#02895f`) sit
inside the existing `--color-gold-fill` / `--color-gain` families, so no token
moved and no contrast measurement was invalidated. Its navy is darker than
`--color-chrome`; the icon keeps the artwork's own value so repainted corners
match the card, and the chrome keeps its contrast-tested token.

## [1.2.0-rc.1] — 2026-08-07 — M12: Stock Detail, expanded What Changed, RC1

Release candidate. Two roadmap features completed from engines that already
existed, plus the findings of a full regression review.

### Features completed

**Stock Detail** at `/:universe/stock/:symbol` — the route has resolved since
M5 and rendered the universe screen as a placeholder. It now answers the one
question a ranking cannot: **is this stock leading on every horizon, or only on
the one currently selected?** A stock ranked 1st on 1M and 90th on 12M is a
very different proposition from one ranked 3rd on all four, and a ranking makes
them look identical.

Shows price and today's move, the official prior month-end **with its date** so
the month-to-date figure is checkable, Relative Strength on all four windows
with both operands drawn, momentum age, direction, and rank at each recent
rebalance. Reachable from every ranked row and every Top-5 row.

Built on `buildSingleStockRSHistory`, written in M3 and unused until now. No
new calculation, no new source of truth.

**What Changed, expanded.** Entrants now carry *why* they are here — their RS,
the rank they came from (*"up from #47"* is a different story from *"up from
#6"*), their direction and their momentum age. Exits say where they went, and
distinguish *"now #40"* from *"no longer ranked"*, which have different causes.

### Four defects the regression review found

**A duplicated calculation.** `selectors/universeView.js` carried its own
whole-share loop and cash-drag arithmetic while `engine/executionMetrics.js`
sat unused — two implementations of one calculation, which is exactly how two
numbers come to disagree. The selector now delegates. **Every test passed
unchanged afterwards**, confirming the two had not yet drifted.

**Snapshot comparison had never run.** `buildSnapshot`, `compareSnapshot`,
`buildRevision` and `snapshotStore` were built in M3/M4, fully tested, and
**nothing ever called them**. Decisions D7 and D10 were reported as shipped and
never once executed. This is the third instance of the same failure mode after
the keyboard shortcuts and the offline state: engines and stores do not invoke
themselves, and a module nobody imports still passes every test written against
it. Now wired via `useSnapshotAudit`, compare-then-write, with restatements
surfaced in the universe screen's data notes.

**The deprecated `/api/market-data` endpoint**, due for removal after M3, was
still deployed eight milestones later. Removed.

**CSV exports were rendered twice** — on the Strategy Record and in Reports.
M7 parked a copy on the record to avoid dropping the feature; M8 built the real
home and the copy should have gone with it. Two panels producing the same files
is one of them waiting to drift.

### Regression verification against live data

Re-ran the engine against live Yahoo three days after the M9 verification:

```
Previous month-end   2026-07-31 · adjClose 1307.80   ← identical to M9 run
Recomputed 3x        identical every time
RS vs NIFTYBEES      INFY +3.11pp · TCS +2.81pp · HDFCBANK −3.16pp
```

### Quality gates

```
lint       clean      typecheck  clean
tests      1379 passed (58 files)
build      clean
size       index 42.8 kB / 60 kB · initial 120.9 kB / 200 kB   PASS
perf       heavy 149.2ms / 250ms · light 0.06ms · sizing 0.04ms
a11y       0 serious, 0 critical — 8 screens + 3 overlays
```

### Known, deliberately unresolved

`compute/deriveUniverse.js` and `compute/computeScheduler.js` (M3) are complete,
tested, and not wired — `useUniverseData` does the same work in a memo. Their
value was the Web Worker escape hatch. Deleting them at RC removes an approved
extension point; wiring them means refactoring the data path at RC. **Raised
for the owner rather than decided unilaterally.**

## [1.1.0] — 2026-08-04 — M11: manual portfolio

The first genuinely new capability since v1.0. Answers investor question 4 —
*what would my portfolio look like* — which the product previously did not
answer at all, by design.

### D3 accepted

Device-local, no account, no cloud sync, **mandatory export**. Stated directly
in the brief: portfolio data stays "local, lightweight, private, and fully
independent from the historical strategy calculations."

### The separation, which is the whole point

The model's record is capital-independent and describes a RULE. A portfolio
describes one person's money. Blending them destroys both — the record would
stop being comparable across time, and the personal return would stop being
theirs.

So exactly one thing crosses between them: a per-holding **status**. *In Top 5*
or *No longer in Top 5*. Never a recommendation, and never a shared total. A
test asserts no strategy figure — outperformance, drawdown, CAGR, benchmark
return — appears anywhere on the portfolio screen.

### Storage

`data/persistence/portfolioStore.js` on a second IndexedDB object store. The DB
upgrade to version 2 is **additive only**: stores are created if absent and
left alone if present.

**Positions are migrated, never cleared.** Bars may be dropped on a schema bump
because prices are re-fetchable; a purchase price someone typed in is not. A
corrupt record is DROPPED and counted rather than repaired — repairing would
mean inventing a price, which is fabricating a financial value.

**Writes are atomic by construction**: one position, one key, one write. A
failure leaves prior state untouched rather than half a record, and says so.

**Quantity is the stored truth.** The form offers shares OR amount; an amount
is converted to whole shares at the price entered, and only the quantity
persists. Storing the amount would let share counts drift under the user as
prices moved; storing both would let the two disagree.

### Backup is mandatory, not a nicety

With no account and no sync, this data lives in one browser on one device.
Device-local storage with no export path is a data-loss trap, so export ships
in the same milestone as the store rather than "later".

Import **merges by id** rather than replacing: restoring a backup onto a device
that already has positions must not silently delete them. Unreadable records
are skipped and counted. Re-importing the same file is idempotent.

**The disclosure appears before the first save**, not after twenty positions.
Someone who enters their holdings and then discovers the terms has been treated
badly, and the app knew the terms all along.

### Screens

**My portfolio** at `/portfolio`: totals, holdings with a weight bar, Top-5
status, backup and restore, add and delete. Weight is share of CURRENT value —
a position that has doubled carries twice the risk it did at purchase.

**In-universe block** that renders **nothing at all** when the user holds
nothing in that universe. Not an empty card, not a prompt. Someone who does not
want portfolio tracking is never nagged into it.

**Navigation stays at five.** Portfolio lives under Reports; an optional
feature does not earn a permanent destination (Phase 2 Part 5, D15).

### Unpriced holdings

Excluded from the totals and reported, never valued at zero (which fabricates a
total loss) or at cost (which fabricates a break-even). Both misstate the total
with equal confidence.

### Validation

```
lint       clean      typecheck  clean
tests      1364 passed (57 files)   [1319 + 45]
build      clean
size       index 40.5 kB · initial 118.6 kB gzip / 200 kB      PASS
           PortfolioScreen 4 kB, lazily loaded
perf       heavy 148.8ms / 250ms · light 0.06ms · sizing 0.04ms
a11y       0 serious, 0 critical across 7 screens + 3 overlays
```

The valuation engine needed no changes: `engine/portfolioValuation.js` shipped
in M3, pure and fully tested, milestones before any screen existed. M11 is
composition plus the store.

## [1.0.0] — 2026-08-04 — M10: production readiness

The Phase 1–3 restructure is complete. **1.0 means the product answers investor
questions 1, 2 and 3 excellently and questions 4 and 5 not at all — by design.**
Manual Portfolio and What Changed are V2, exactly as Phase 1 specified.

No feature was added in this milestone. It found and fixed what was broken.

### Three real defects, all silent

**Keyboard shortcuts were never wired.** `useKeyboardShortcuts` was written in
M5, complete and correct, and nothing ever imported it. Only `/` appeared to
work, because the shell carried a separate duplicate handler. It was reported
as delivered in M5 and nothing caught it for five milestones — a hook nobody
imports still passes every test written against the hook. Now wired, with a `?`
shortcut sheet, and **nine tests that assert the WIRING rather than the hook**.

**Offline was never detected.** `OfflineState` shipped in M4 and was reachable
only from the dev gallery. Phase 2 specified offline as a designed state and
the product never entered it. Added `useOnlineStatus`; the status line now
outranks every other state with "Offline · showing data from 2 Aug", and a
failed load while offline gets the offline screen rather than "the provider
returned an error" — a confusing and slightly wrong answer that sends the
reader looking for a fault that is not there.

**A heading level was skipped** on the Strategy Record: h1 straight to h3,
which is how a screen-reader user loses the page outline. `ChartCard` now takes
a heading level.

### Accessibility

**Automated auditing added** — axe-core across all six screens, the search
dialog, and the error and loading states. Build fails on any serious or
critical violation. Currently: **zero**.

Plus four structural checks axe cannot make: exactly one `h1` per screen,
no skipped heading levels, an accessible name on every interactive control,
and no interactive control nested inside another.

Axe catches roughly a third to a half of real problems — the mechanical ones.
It cannot judge whether a focus order makes sense or an announcement is useful.
What it guarantees is that the mechanical third never regresses silently, which
is the kind that creeps back during a redesign.

One finding was a **false positive in my own test**: the theme toggle wraps its
input in a `<label>`, which is a valid implicit name. The test was fixed, not
the product — a test that cries wolf is one people learn to override.

### Code quality — a dead island removed

Fourteen components in `common/`, `tables/` and `calculator/` referenced only
each other and stale comments. All were superseded by the M4 design system and
the M6/M7 screens; `MetricGroup` existed twice, in two different directories.

Removed: those fourteen, `PerformanceOverviewChart`'s siblings, `main.preview.jsx`
and two orphaned preview HTML entries. Test count dropped by 9 for deleted
components and rose by 22 for real behaviour — **tests for code that is not in
the product are not test coverage.**

Also fixed: the theme toggle still used typographic glyphs (`☀ ☾ ⌾`), missed
when D6 removed them everywhere else. Three drawn icons added.

### Measurements

```
lint       clean      typecheck  clean
tests      1319 passed (54 files)
build      clean

index                47.5 kB gzip / 60 kB          PASS
initial payload     125.9 kB gzip / 200 kB         PASS
lazy chunks          7 (charts, record, reports, ranking, settings,
                     methodology, exports)

heavy pass  (250 symbols)  117.9 ms / 250 ms       PASS
light pass  (quote tick)     0.05 ms               PASS
sizing      (keystroke)      0.03 ms               PASS
scaling     5x symbols -> 5.08x time               linear
accessibility  0 serious, 0 critical               PASS
```

### Preserved without exception

Relative Strength methodology · every calculation · capital independence of the
record · the no-fabrication rule · layer boundaries · selector and hook
discipline · every approved decision D1–D15.

## [0.33.0] — 2026-08-04 — M9: chart system pass

### D2 — long-term ranges

3M / 6M / 1Y / 3Y / 5Y / All, all **selectable**. Where the data falls short,
the chart shows every point it has and says so — never padded, never rescaled
to fill the axis.

```
Showing all 19 months of verified history. 5Y would need data from Jul 2021,
which does not exist yet — nothing here is stretched or estimated.
```

**The notice is load-bearing, not decoration.** On a 2025-01-01 dataset the 3Y,
5Y and All ranges render an identical chart. A reader who selects 5Y, sees
nothing change and is told nothing would reasonably conclude the control is
broken. The notice is the only thing distinguishing "this range happens to
equal All" from "this button does nothing".

Ranges stay selectable rather than disabled: disabling implies the RANGE is
unavailable, when the range is valid and the DATA is what falls short.

### The series contract, now binding

Strategy **solid gold**, benchmark **dashed grey**, in every chart, never
reversed. It is the crossing motif from the app mark at chart scale, and a
reader who learns it once on the equity curve reads every other chart free.

Legend swatches reproduce the **dash pattern**, not just the colour — a dashed
series shown with a solid swatch teaches the wrong mapping, and the mapping is
all a legend exists to teach.

### Shared crosshair

Equity and drawdown share a `syncId`, so one cursor reads both: hover a dip and
the curve that caused it lines up above. Two charts side by side make the
reader match dates by eye, which is exactly the work a chart removes. They sit
with no gap because they are one object with two panels.

### Two real defects fixed

**The equity axis was formatting an index as rupees.** `formatINR` turned an
index value of 121.3 into "₹121" — a currency figure corresponding to nothing,
on the screen that is capital-independent by decision D1. The axis is now an
index, with the tooltip showing both the level and the percentage.

**The attribution chart plotted rupee P&L**, which encodes whatever notional
the backtest ran with — the account-size assumption D1 removed. It now measures
**percentage points of portfolio return**: a position's own return scaled by
the weight it carried. A new test asserts the figures are identical whether the
backtest ran on ₹10,000 or ₹10,000,000.

### Three charts restored

Monthly returns, contribution and rank movement belonged on the record per the
approved specification and **fell out of the product in M7** when the old page
was deleted — nothing had referenced them for two milestones. Restored,
collapsed by default (D4).

`PerformanceOverviewChart` was deleted: it belonged to the Dashboard, which
went in M5, and nothing has referenced it since.

### Also

`ChartCard` gives every chart a title, a one-line purpose, its range control
and its loading, empty and short-history states. An unexplained chart in a
financial product is worse than no chart — the reader assumes it means
something, cannot tell what, and either invents an interpretation or loses
confidence in the page.

Gridlines horizontal only and dashed; no drawn axis lines; labels drop rather
than rotate; animation off on refresh.

### Validation

```
lint       clean      typecheck  clean
tests      1312 passed (54 files)   [1295 + 17]
build      clean
size       index 46.7 kB · initial 124.8 kB gzip / 200 kB      PASS
           charts 114.2 kB, still lazily loaded and off the first-paint path
perf       heavy 120.1ms / 250ms · light 0.05ms · sizing 0.02ms
```

No engine, methodology or ranking calculation changed. The one calculation that
did change — attribution — moved from rupees to percentage points, which is the
approved D1/A2 basis, and is covered by an invariance test.

## [0.32.0] — 2026-08-04 — UI/UX refinement part 2

D15 resolved: all six recommendations accepted, the approved architecture
stands. No sidebar expansion, no Command Center, no capital in the record, no
opinion system, no composite score, no countdown. Part 2 is everything that
improves the experience without touching any of that.

### Global search

Press `/` anywhere, or use the control beside the status line. Searches all
**453 constituents instantly and offline**, because every one is already in
`config/universes` — loaded with the app.

- **Searches the constituent lists, not live rankings.** Searching rankings
  would mean fetching ~450 symbols across three universes before the box could
  return anything. Someone typing "TITAN" wants to know where TITAN lives, not
  to wait for a backtest. The rank is then shown on the universe screen they
  land on, which is the screen that has legitimately computed it.
- **Prefix matches rank first** — typing "TCS" returns TCS, not the first
  alphabetical company containing those letters.
- Results carry the universe, because which universe a stock belongs to
  determines its benchmark and therefore what its Relative Strength means.
- Arrow keys, Enter, Escape. **Focus returns to whatever opened it** — a
  keyboard user who cannot get back to where they were has been trapped by a
  convenience.
- The `/` shortcut is guarded against text fields; without that guard, typing
  an amount would open search on a stray keystroke.

### Navigation polish, without added complexity

The desktop rail expands from 72px to 200px on hover to reveal full labels.
**The destination count never changes** — only the labels appear. It expands
OVER the content rather than pushing it, because reflowing a dashboard because
a cursor crossed an edge is disorienting.

### Accessibility

- **Skip link** as the first tab stop on every page, visible only when focused.
  A keyboard user is no longer forced through five nav items to reach content.
- `#main` landmark target; search overlay is a labelled `dialog` with
  `aria-modal`, a `listbox` and `option` roles with `aria-selected`.
- Every icon-only control carries an accessible name.

### Micro-interactions

Four rules, all opacity and transform only — compositor properties, so none
triggers layout or paint. Nothing loops; nothing exceeds the 300ms ceiling.

- Route change cross-fades the content while the frame stays still. **No
  slide** — a slide implies spatial adjacency and would suggest a swipe
  navigation that deliberately does not exist.
- Hover lifts the surface one step. **Text colour never changes on hover**: a
  shifting colour on a price reads as the value having changed.
- A value changed by a live refresh cross-fades in place. **Never a count-up** —
  a price animating through values it never held is a lie about market data.
- All disabled under `prefers-reduced-motion`, losing no information.

### Judgement call: no separate strategy-card library

The brief asked for one. The window-comparison matrix in Reports already makes
all twelve strategies reachable in one tap — that was the fix for the
discoverability problem Phase 1 identified. A second directory of the same
twelve would be duplication dressed as a feature, and the brief itself says to
use judgement rather than force an item in.

### Validation

```
lint       clean      typecheck  clean
tests      1294 passed (53 files)   [1278 + 16]
build      clean
size       index 46.7 kB · initial 124.8 kB gzip / 200 kB      PASS
           (+1.3 kB for search, the skip link and micro-interactions)
perf       heavy 122.9ms / 250ms · light 0.06ms · sizing 0.02ms
```

No engine, methodology or calculation changed across either part of this
refinement. Every figure is identical to v0.30.0.

## [0.31.0] — 2026-08-04 — UI/UX refinement pass (part 1 of 2)

A dedicated refinement milestone between M8 and M9. No engine change, no
methodology change, no calculation change — verified: every figure is identical
to v0.30.0.

**Part 1 covers the work that conflicts with nothing.** Six items in the brief
reverse decisions marked FINAL and are held for the owner; see the conflict
register in `DECISIONS.md` under D15.

### The measurement that shaped this pass

**176 separate inline style objects across five screens**, each re-declaring
padding, radius, border and background. Every one individually reasonable, and
collectively drifting — a 10px radius here, 12px padding there, three different
ways to draw the same card.

Inconsistency in a design system is invisible one screen at a time. It reads as
a vague sense that the product is unfinished, and it cannot be fixed screen by
screen because the next screen invents its own again.

### Added — a shared surface vocabulary

`components/primitives/Surface.jsx`: `Card`, `Section`, `Stat`, `Eyebrow`,
`CardRow`, `CardFooter`, `StatGrid`. Universe, Ranking, Record and Reports now
compose from these rather than three near-identical local copies. A spacing
change now happens once.

**The primitive imports nothing from the domain.** Contextual help arrives as
an `info` NODE the screen passes in, so a primitive never has to know what a
Sharpe ratio is. Reaching for the glossary there would have been convenient and
would have made every primitive depend on domain content.

### Added — scan aids

**Sparkline** beside every ranked stock and every Top 5 row. Not a chart: no
axis, no scale, no tooltip, because it does not answer "how much" — the numeric
columns already do that exactly. It answers "what shape", which is the one
thing a column of numbers cannot convey across 250 rows.

- Normalised to its own range, so shape is comparable and magnitude
  deliberately is not
- Coloured by NET direction, first point to last — not by the final tick,
  which would flicker on every live refresh and mean nothing
- A flat series draws a flat line rather than dividing by zero
- Too little history renders nothing, never an invented shape
- **No charting dependency.** The charts bundle is 108 kB gzipped and lazily
  loaded precisely to stay off the path to first paint; pulling it into a table
  row would undo that for a shape that takes twenty lines to draw
- Points are sampled in the SELECTOR from price series already in memory — no
  calculation, no second source of truth

**Sector badge** on every row, deliberately monochrome. Colour in this product
means benchmark, gain, loss or caution; twenty sectors in twenty hues would
either collide with that vocabulary or invent a second one nobody can learn.

### Added — sticky action bar

Search, filters and sort now travel with the reader on the ranking screen. On a
250-row list the controls otherwise scroll away exactly when they become
useful, and getting back to them costs your place in the list.

### Changed — density and hierarchy

Rows breathe slightly more (68 → 72px in the ranking, 12 → 13px padding on Top
5 rows). Sparkline appears at `sm`, the RS Ledger moves to `md`, so a narrow
screen shows shape and a wide one shows both shape and magnitude rather than
cramming both everywhere.

### Validation

```
lint       clean      typecheck  clean
tests      1278 passed (52 files)   [1261 + 17]
build      clean
size       index 45.4 kB · initial 123.5 kB gzip / 200 kB      PASS
           (+1.1 kB for sparklines, badges and the shared vocabulary)
perf       heavy 112.4ms / 250ms · light 0.06ms · sizing 0.02ms
```

Sparklines add no measurable cost to the light pass: the points are sampled
once in the selector and rendered as a 4-element path.

## [0.30.0] — 2026-08-03 — D14 + M8: Reports, Settings, Methodology

### D14 — historical context, momentum direction, methodology versioning

**Momentum direction — Improving · Stable · Weakening.** Derived only from the
trailing RS history already computed. **Descriptive, never predictive.** The
vocabulary is deliberate: *Stable* is the honest reading of a small move on
three data points, not a hedge — calling it a trend would dress noise up as a
signal. A directional word beside a price reads as advice unless the language
refuses it, so the glossary entry says outright that Gati has no view on what
happens next.

**Portfolio change history.** Every rebalance now shows how the portfolio
changed — `2 entered · 3 held` — beside what it returned. A return figure alone
hides whether the strategy traded everything or held steady, which is most of
what a reader wants to know about a month. The first cycle reads *First
rebalance* rather than "0 changed", which would be a claim the data cannot
support.

**Methodology versioning.** `METHODOLOGY_VERSION` is stamped on every report
and shown in Settings with its history. Version 2.0 is the fractional-weight
method; 1.0 was the whole-share record it replaced. The version is bumped only
when a change alters a published number — not for a new chart or a refactor.

### M8 — the three remaining screens

**Reports.** Universe comparison at the active window, the 3 × 4 window matrix,
monthly history per universe, and all seven CSV exports. Every section states
WHY it exists, not just what it shows (D14.4).

**Settings.** Appearance, investing defaults, transaction-cost rates spelled
out, provider and freshness, constituent provenance per universe, cache clear,
and the methodology history. Every control applies immediately — a save step
invites people to change three things and lose two.

**Methodology.** Eleven sections, each deep-linkable and each carrying a *Why
it works this way* panel. Collapsed on arrival, except a section reached by
deep link, which opens — someone following a link from a caveat wants that
paragraph, not a table of contents.

### Engineering decisions

**The window matrix is collapsed by default.** Twelve backtests, roughly 650ms
measured. The price data is already cached and shared with every universe
screen, so nothing re-fetches — but computing it eagerly would make Reports the
slowest screen in the app to serve a section most visits never open.

**It genuinely recomputes rather than reading a cache.** The hook computes one
window per universe; the other three are not calculated anywhere. Re-running
them is the only calculation of those figures, using the same engine on the
same series, so it cannot disagree with the universe screen.

**CSV exports moved from the Strategy Record to Reports**, where the approved
architecture puts them. M7 had parked them on the record to avoid dropping the
feature entirely.

### Three defects caught

**A `<button>` nested inside a `<button>`** — invalid HTML and two overlapping
targets for a keyboard user. Introduced by putting an InfoTip inside the
change-line toggle; the tests surfaced it as a hydration warning.

**The bundle gate was under-reporting the initial payload by more than a
third.** Vite hashes may contain a hyphen (`index-F9t__v-X.js`), and the
chunk-name regex stripped only `[A-Za-z0-9_]+` — so a 44 kB eager chunk was
classified as lazy and excluded from the figure. It now anchors on the hash
LENGTH rather than its character set. Real initial payload: **122.4 kB**, not
the 78.1 kB briefly reported.

**A settings screen reaching into the data layer.** The boundary lint rejected
`barStore` in Settings, correctly — a screen that can reach storage can reach
fetching. Cache clearing now goes through a `useCacheControls` hook, which is
the sanctioned crossing point.

**A setState inside an effect** in the methodology screen, which rendered the
deep-linked section closed for one frame before opening it — precisely what the
link was trying to avoid. Now derived.

### Validation

```
lint       clean      typecheck  clean
tests      1261 passed (51 files)   [1223 + 38]
build      clean
size       index 44.3 kB · initial 122.4 kB gzip / 200 kB     PASS
           7 lazy chunks: reports, settings, methodology, ranking, record,
           exports, charts
perf       heavy 105.7ms / 250ms · light 0.05ms · sizing 0.02ms
```

Navigation now leads somewhere real at all five destinations for the first time.

## [0.29.0] — 2026-08-03 — D13 + M7: momentum continuity, Full Ranking and Strategy Record

### D13 — momentum continuity

**Rebalance summary.** Each universe now shows the latest rebalance in three
numbers: entered, continuing, left. The difference between a quiet month and a
wholesale turnover, which affects both conviction and trading cost.

**Momentum Age.** Each pick shows how many consecutive rebalances it has held
its Top-5 place. A ranking is a snapshot and cannot distinguish a stock that
just broke out from one that has led for six months; those are different
propositions. The number says which situation you are looking at, not which is
better.

**Both come from work already done.** `computeMomentumAge` is one reverse pass
over `backtest.rankingHistory`, which the backtest already produced by ranking
the whole universe at every month-end. No prices re-read, no ranking recomputed,
no second source of truth — the constraint the instruction set, and the right
one.

**The count is consecutive, not cumulative**, and stops at the first gap. A
stock that led in January, vanished, and returned in June has a run of one
month. Counting total appearances would quietly overstate how established the
momentum is — the exact misreading this number exists to prevent.

### M7 — the two depth screens

**Full Ranking** (`/:universe/all`): windowed list at a fixed 68px row height,
sticky search, filter chips with live counts, the ledger key **above** the rows
it explains, Top-5 segment tinted uniformly, and unrankable stocks grouped at
the end with a reason and any rename suggestion. Filter and sort are
preferences, so they carry across universe switches (D12).

*The list is windowed by hand rather than with a library.* One fixed row
height, one scroll container, no dynamic measurement — about forty lines. A
virtualisation dependency brings a measurement system and an API surface to
solve problems this list does not have. Fixed height is also what makes scroll
restoration exact.

**Strategy Record** (`/:universe/record`): sample-size notice (the single
permitted exception to "no disclosure above the answer", because it qualifies
the exact figure beneath it), headline, equity curve with drawdown on a shared
x-domain, Performance visible with Risk and Consistency collapsed (D4), what
the model holds now, every rebalance, the cost toggle, method summary and CSV
exports.

**No rupee figure appears anywhere in the record** — it is capital-independent
by D1, and a rupee amount would reintroduce the assumed account size that
decision removed. The old page showed the current holding as a scaled ₹50,000
position; it is now names and weights.

### Removed

`StrategyPage` and its structure-coupled smoke tests. Both replacements shipped
here. The end-to-end suite was rewritten against the new screens, keeping every
invariant and moving each assertion to whichever screen now owns it.

### Three things caught during implementation

**Two engine helpers return objects, not numbers.** `calculateMaxDrawdown`
returns `{ value, peakIndex, troughIndex }` and `calculateWinLossMonths`
returns named month objects; both were read as scalars and crashed the screen
on real data. Every unit test passed throughout — only the end-to-end suite
caught it. `formatPct` now guards the type rather than just null, so a future
mistake of this shape surfaces as an em-dash rather than a white screen.

**Routing the record away from the old page silently dropped CSV export from
the product.** Caught before shipping; the export panel moved to the record
screen, and moves again to Reports in M8.

**Charts disappeared from the build** — nothing imported recharts once the old
page went, and the record had been built without them. Restored with the
equity curve and drawdown sharing one x-domain, stacked so a dip and its cause
line up vertically.

**A null-ordering bug**, caught by its own test: sorting descending by swapping
comparator arguments also swaps which side nulls fall on, which put unpriced
stocks at the top of a "biggest movers" list.

**The cost toggle originally reloaded the page** to pick up a changed
preference — refetching 250 symbols to recompute something that takes
microseconds. It now recomputes in place.

### Validation

```
lint       clean      typecheck  clean
tests      1199 passed (49 files)   [1152 + 47]
build      clean
size       index 43.7 kB · initial 121.8 kB gzip / 200 kB      PASS
           record 5.8 kB · ranking 3.3 kB · charts 108.3 kB — all lazy
perf       heavy 93.1ms / 250ms · light 0.05ms · sizing 0.02ms
```

## [0.28.0] — 2026-08-03 — M6: the universe screen

The product. Everything before this was preparation.

### The four questions (decision D12)

A universe screen must answer all four within seconds:

| # | Question | Where |
|---|---|---|
| 1 | What are the current Top 5? | The Top 5 card, above the fold |
| 2 | What changed since the last rebalance? | One collapsed line under the verdict |
| 3 | Why are these ranked here? | The RS Ledger on every row, plus the 3-month trend |
| 4 | What action follows? | Per-row status: **new this month** / **held** |

**How question 4 is framed, and why.** Gati states what the *strategy* did,
never what the user should do. Each pick carries a factual status derived
mechanically from comparing the last two completed rankings. "Buy this" would
be advice — unverifiable, unaccountable, and beyond what a Relative Strength
ranking can support. The investor still gets their answer: two names new means
two buys, two exits means two sells. A test asserts no status label ever
contains buy, sell, recommend or should.

### The screen

Section order, fixed by the approved specification: **verdict → what changed →
Top 5 with sizing → view all → performance → data notes → methodology.**

**The Top 5 card IS the Investment Simulator.** The amount field lives in the
card *header*, not a footer, which is what puts it inside thumb reach on a
390px viewport on first load. Each row gains a share count and value; the
footer shows invested, cash left and execution efficiency.

**The verdict is the focal point** — one large signed figure on the single lit
glass surface, with both operands beside it as chips so the subtraction is
checkable rather than trusted.

**Rebalance timing is quiet context**, never a countdown. A monthly strategy
has nothing to do between rebalances, and urgency would manufacture activity
the method cannot justify.

### What moved, and what did not

The three disclosure boxes that used to sit **above** the answer are now a link
at the foot. Nine of twelve metric tiles and five of six charts moved to the
strategy record. Nothing was deleted — the failure this screen fixes was
composition, not content.

**Deleted:** `CapitalCalculatorPage`, its route, and the standalone
`/calculator`. Its replacement shipped in this milestone.

### Cross-universe continuity

The measurement window now carries across universe switches and is visible in
the URL. Comparing large, mid and small caps at the same window is the point of
having three; resetting to a default would silently change what is being
compared. The investment amount carries across too — it is a property of the
user, not of the universe.

### Engineering

- **`selectors/universeView.js`** — the screen holds composition and no logic
  worth testing; 27 assertions cover the selector instead.
- **Headline metrics moved out of the page and into the hook.** They were
  computed inline in `StrategyPage`, which put a financial calculation in a
  component and meant a second screen would have repeated the arithmetic. Two
  copies of one formula is how two screens end up disagreeing about a number.
- **`prefStore` relocated** from `data/cache/` to `preferences/`. The layer
  boundary rejected a screen importing it, correctly: `data/` answers "where do
  market numbers come from", and a remembered chart range is not that.
- **`StrategyPage` is now lazily loaded.** Adding the universe screen pushed
  the index chunk from 35 kB to 54 kB gzipped — within 6 kB of budget, for a
  page most sessions never open. Splitting it returned index to 42.4 kB.
- **The bundle gate now counts only eager chunks.** Previously every new lazy
  route would have inflated the initial-payload figure and looked like a
  regression, which is exactly backwards.

### Validation

```
lint       clean      typecheck  clean
tests      1127 passed (47 files)   [1100 + 27]
build      clean
size       index 42.4 kB · initial 120.5 kB gzip / 200 kB     PASS
perf       heavy 163.9ms / 250ms · light 0.06ms · sizing 0.03ms
```

Sizing is arithmetic on data already in memory: typing an amount triggers no
fetch and does not touch the strategy record, asserted by test at every amount
from ₹0 to ₹50,00,000.

## [0.27.0] — 2026-08-03 — M5: universe-first navigation and the new URL model

Fifth milestone of the Phase 5 roadmap. The Dashboard is gone, navigation leads
with universes, and every URL in the approved model resolves and is shareable.

### The URL model

```
/nifty50                  universe, window from preference
/nifty50/3m               explicit window, shareable
/nifty50/all              full ranking      (window inherited)
/nifty50/record           strategy record   (window inherited)
/nifty50/stock/TITAN.NS   universe with the stock sheet open
/reports  /settings  /methodology
```

The window sits in the path but not on sub-views. Repeating it would produce
`/nifty50/3m/all` and force a decision about what `/nifty50/all` alone means;
sub-views inherit from the active preference instead, so every URL is
unambiguous and short.

`config/routes.js` holds the model as pure string functions over the universe
and strategy registries — testable exhaustively without mounting a router.

### Nothing ever resolves to a blank page

- **Legacy `/strategy/:key` redirects preserve the window.** `/strategy/midcap150-rs-6m`
  lands on `/midcap150/6m`, not the default. Dropping it would silently change
  what a shared link shows, with nothing indicating the substitution. Every one
  of the twelve registered strategies round-trips, asserted.
- **An unknown path keeps the valid half.** A bad window on a real universe
  still lands on that universe; throwing away the part that worked helps nobody.
- **Redirects explain themselves**, carrying a notice on navigation state rather
  than moving the user silently.
- The 1-month rule keeps the bare universe key as its strategy id, so every CSV
  filename and bookmark generated before the multi-window release stays valid.

### Context preservation

- **`data/cache/prefStore.js`** — typed localStorage that never throws. Every
  read is validated, so a stale universe key from an earlier release falls back
  to a default instead of producing a dead route. Remembers last universe,
  window, investment amount, chart range and cost toggle.
- **`navigation/viewState.js`** — scroll, expansion, search and filter per
  route, bounded at 30 entries so browsing 250 stocks does not leak state.
  Session-only by design: a scroll position from three days ago is not context,
  it is confusion, because the data underneath it has changed.
- **`restoreScroll` gives up rather than guessing.** If the page is still too
  short, it stays at the top — landing at an approximate position puts the
  reader somewhere they never were.

### Shell

- **Bottom navigation** (5 destinations) and a **72px desktop icon rail**
  replacing the 240px sidebar, both rendered from the registry.
- **The active state is carried by shape**, a 3px indicator bar plus a weight
  change, with colour only reinforcing.
- **The status line replaces five elements with one.** The old header carried a
  status pill, a delayed badge, a synthetic badge, a "Checked HH:MM" stamp and
  a "Data as of … · fetched …" line — five things answering one question.
  Nothing was discarded; the second timestamp and the provider moved into a
  tap-to-open detail block.
- **App bar compresses on scroll**, 56px to 48px, with a passive listener and a
  guard so it does not re-render the shell on every scrolled pixel. The mark and
  the window chip never disappear.
- **Keyboard shortcuts**: 1/2/3, R, comma, A, V, slash, question mark, Escape.
  Every one duplicates a visible control, and none fires while typing.

### Removed, because their replacements shipped

`Dashboard.jsx`, `Sidebar.jsx`, `TopBar.jsx` and the TopBar test. Phase 1
decision 1 removed the Dashboard; universe-first navigation is its replacement
and it landed here.

`/calculator` is **retained but out of navigation** — Phase 1 decision 3 moves
sizing inside every universe, but the in-universe calculator does not exist
until M6, so deleting it now would remove a working feature and leave nothing
in its place.

### Validation

```
lint       clean      typecheck  clean
tests      1076 passed (46 files)   [1031 + 58 new, 13 removed with TopBar]
build      clean      size  113.1 kB gzip initial / 200 kB    PASS
perf       heavy 118.9ms / 250ms · light 0.05ms · sizing 0.02ms
```

Reports, Settings and Methodology carry honest placeholders naming what will
live there. Shipping nav items that lead nowhere would be worse: a tap that
produces nothing reads as a bug and costs trust in the rest of the interface.

## [0.26.0] — 2026-08-03 — D11: two-tier contextual help; eight standing principles

Owner-directed. Extends D9 and reworks the glossary that M4 shipped.

### D11 — contextual help becomes two tiers

The glossary was a flat `what / why / reading`. That was more text than a
default tooltip should carry, and it had no deeper level for anyone who wanted
one. A single explanation has to choose between the beginner it would overwhelm
and the quant it would bore, and it always ends up failing one of them.

- **Default tier**: `what` · `why` · `inGati` — one short sentence each, under
  170 characters, readable at a glance.
- **Learn more**, collapsed: `detail` · `example` · `limitations` · `formula`.

All 38 entries were rewritten. `reading` became **`inGati`**, which makes
principle 2 structural rather than aspirational: the third field is literally
"what this means for a decision inside this methodology".

### The tests found three real failures

The GATI-anchoring rule rejected `benchmarkReturn`, `sortino` and `thinSample`
as generic — they would have read identically in any other product. Two more,
`priorMonthEnd` and `portfolioWeight`, failed on a second pass. All five were
rewritten rather than the rule being relaxed.

One assertion **was** relaxed: the limitations heuristic used too narrow a word
list and rejected entries that genuinely stated a weakness. Broadening a bad
proxy is right; weakening a rule that caught real problems is not, and the
anchoring rule was left alone.

### Enforced by test

- Default fields under 170 chars, one sentence each, total under 430
- `inGati` must reference a Gati-specific anchor
- `learnMore` mandatory for every entry, with detail, example and limitations
- Examples must contain a real figure — "suppose a stock rises" teaches nothing
- Limitations must actually state a weakness; a metric with none is oversold
- Formula present for `relativeStrength` and `outperformance`, absent for
  `sharpe` and `benchmark`, and on fewer than half of all entries so the tier
  is not padded

### Component

`InfoTip` gained the collapsed second tier, a formula block in mono on a raised
surface, and a reset: **Learn more collapses whenever the panel closes**, so
reopening always starts at the short answer rather than where the last reader
left it.

### Also adopted (principles 3-8)

Beginner-first as a standing rule; accuracy over displaying a number, now
including **rounding into misleading values**; performance first; the permanent
separation of strategy evaluation from execution simulation; every metric
understandable within one tap; and the question asked of every visual element —
*does this help the investor identify, understand or confidently act on
Relative Strength Momentum?*

### Validation

```
lint       clean      typecheck  clean
tests      1031 passed (45 files)   [835 + 196]
build      clean      size  112.4 kB gzip initial / 200 kB    PASS
perf       heavy 100.5ms / 250ms · light 0.04ms · sizing 0.02ms
```

No engine or data-layer code changed.

## [0.25.0] — 2026-08-03 — D10 adopted; M4: the design system

Adopts decision **D10** (no fabricated data, plus a permanent audit trail) and
completes milestone **M4**.

### D10 — no fabricated data, and restatements are now auditable

Financial data is never fabricated, estimated or silently substituted. Where a
value cannot be verified, the app says it is unavailable rather than showing
something that might be wrong. Most of this was already true; what was missing
was the audit trail.

**D7 detected restatements but could not reconstruct them.** The note appeared
once, the new value was written over the old, and the previous figure was gone
— so a user who noted a number in June could be told *that* it changed but not
*what it was*. An audit trail that cannot rebuild the prior state is a
notification, not an audit.

- `buildRevision` captures the **full prior picks**, not just the deltas
- `snapshotStore.appendRevision` is **append-only**; a month restated twice
  keeps both records in order
- `clear()` deliberately does **not** wipe revisions — snapshots are
  reproducible from bars, the record of what was displayed is not
- The cause is recorded as `likelyCause`, never as an observation: the provider
  never tells us a corporate action occurred, it is inferred from the shape

### M4 — the design system

**D5 applied.** `--color-gold` `#8a6a1f → #7d601b` (4.40 → 5.14 on gold-soft)
and `--color-gain` `#0b7d52 → #0a7049` (4.45 → 5.29 on gain-soft). Both shipped
below the WCAG AA floor for several versions, on every selected segment and
every positive chip. A `--color-disabled-ink` token was added per theme,
replacing a per-component convention that let each component invent its own.

**D6 delivered — 25 drawn icons**, 24px grid, outline only, stroke redrawn per
size band (1.5 / 1.75 / 2px) rather than scaled. **Every typographic glyph is
gone** — `◆`, `▲` and `●` resolved to whichever font the platform picked, so
their size and baseline differed per device and could not be made consistent
with anything. The three universe icons are deliberately one family at three
widths, so the navigation reads as a set.

**Components.** Primitives (Button in four styles, Segmented, Chip, RankBadge,
Field, Skeleton); data components (`InfoTip`, MetricTile, MetricGroup, RSLedger
with its key); feedback (StatusLine, DataNotes, EmptyState, ErrorState,
OfflineState, MarketClosedState, InsufficientHistoryState) plus the
illustration system.

**`InfoTip` implements D9.** 14px glyph inside a 44px target, click not hover
(hover-only would be unreachable on touch and would fire constantly across a
dense table), Escape closes **and returns focus to the trigger**, and an
unknown term renders nothing rather than crashing or inventing wording.

**Illustrations** are built from exactly two primitives taken from the mark: a
dashed baseline and a solid arc. The *relationship* between them encodes the
state — arc crossing means working, arc below means not enough evidence,
baseline broken means the connection is, baseline half-absent means the data
is. No people, no mascots, no empty boxes.

**Motion.** Two animations exist in the whole application: the skeleton shimmer
and the live status pulse. Both stop under `prefers-reduced-motion`, and the
reduced-motion path loses no information because neither ever carried any.

**Component gallery** at `/_gallery`, development only — lazily imported and
branch-eliminated in production, verified by the bundle gate showing no new
chunk and an unchanged index size.

### Validation

```
lint       clean      typecheck  clean
tests      835 passed (45 files)   [764 + 71]
build      clean      size  112.4 kB gzip initial / 200 kB    PASS
perf       heavy 100.5ms / 250ms · light 0.04ms · sizing 0.02ms
```

Contrast is now a **test**, not an opinion: every high-traffic pairing in both
themes is measured against the AA floor on every build, along with the
permanent prohibitions (no white on gold-fill, no pure black, no pure-white
page background).

## [0.24.0] — 2026-08-03 — D9: contextual help adopted as a permanent requirement

Owner-directed addition ahead of M4. Gati must stay understandable to someone
returning after months or years, so any metric or term that is not immediately
obvious carries a small information icon explaining what it means, why it
matters, and how to read it here.

### Why this is a principle rather than a feature

The product already claims *clarity over complexity* and *every number must be
checkable*. A number the reader cannot interpret is not checkable however
precisely it was computed — an unexplained Sortino ratio fails in the same way
a wrong one does, just more quietly. It also serves the beginner-first density
baseline: the depth a quant wants stays one tap away without raising the
default density for anyone else.

### Added

- **`config/glossary.js`** — 38 plain-language entries covering the RS concept,
  performance, risk, consistency, the Investment Simulator, transaction costs,
  data honesty and portfolio terms. Each answers three questions: what it is,
  why it matters, how to read it in Gati.
- **`docs/CONTEXTUAL-HELP.md`** — the `InfoTip` component and interaction spec
  M4 implements: 14px outline icon at `ink-muted`, 44px tap target, popover on
  desktop and bottom sheet on mobile, click-not-hover, focus returned to the
  trigger on close, and explicit rules on where icons must and must not appear.
- **271 assertions** enforcing the requirement (764 total, from 493).

### Why the text lives in config rather than in components

Scattered through components these strings would be unreviewable — nobody can
judge whether the product speaks with one voice by reading forty files. In one
module they can be read end to end and improved the same way.

### The enforcement, which is the point

A requirement recorded only in a document decays the first time someone adds a
metric in a hurry, and the decay is invisible: the app still works, it is just
quietly less understandable. So the tests fail the build when an explanation is

- **missing** for a term the UI renders, or **orphaned** with no UI reachability
- **incomplete** — any of the three sections absent
- **circular** — "Relative Strength is a measure of relative strength"
- **jargon-laden** — "risk-adjusted", "standard deviation" and similar are
  rejected inside an explanation
- **falsely cheerful** — exclamation marks, "don't worry", "simply put"
- **dishonest about sample size** — Sharpe, Sortino and CAGR must each warn
  that they mean little on a short track record
- **wrong about units** — RS must be described in percentage points, never
  percent, since that is the most common way to misread the central number

### Validation

```
lint       clean      typecheck  clean
tests      764 passed (43 files)   [493 + 271]
build      clean      size  112.1 kB gzip initial / 200 kB    PASS
perf       heavy 100.5ms / 250ms · light 0.04ms · sizing 0.02ms
```

No engine, data-layer or UI code changed. This release is content, spec and
enforcement.

## [0.23.0] — 2026-08-03 — M3: fractional weighting (D1), RS history, change detection, compute split

Third milestone of the Phase 5 roadmap. Implements decisions **D1** and **D7**,
both approved by the owner, and adds the four engines and the compute layer the
later screens depend on.

### D1 — the historical record is now capital-independent

**Every published historical figure in the app changes with this release.**
That was the approved, expected consequence.

The strategy record uses exact fractional equal weights: 20% in each of the Top
5, no leftover cash, no lot-size artefacts. Measured on identical signals under
the old whole-share flooring, the reported return varied from **5.73% at
₹25,000 to 7.89% at ₹50 crore** — a 2.15pp spread caused by nothing but account
size. The ₹25,000 figure was not merely different, it was misleading: it
reported the strategy underperforming by two points when the strategy had done
nothing of the sort.

Whole-share flooring is not gone; it moved to where it is true. The **Investment
Simulator** (renamed from Calculator, decision S11) computes the real executable
portfolio at the user's own amount and reports idle cash, cash drag, execution
efficiency, per-position drag, minimum viable capital, and the gap between the
ideal strategy return and the executable one.

- `engine/weighting.js` — the two bases, named, with the measurement recorded
  in the source so the reasoning survives the decision
- `engine/portfolio.js` — `buildFractionalPositions` alongside the existing
  flooring path; identical output shape, so mark-to-exit and cost application
  are shared rather than duplicated
- `engine/executionMetrics.js` — drag, efficiency, ideal-vs-executable
- `runBacktest` gains a `weighting` parameter defaulting to fractional, and now
  reports `isCapitalIndependent` and a base-100 `indexValue` per equity point

### D7 — retroactive history changes are surfaced, not swallowed

Yahoo rewrites adjusted closes retroactively on every split, bonus and dividend,
so a past month can legitimately change between two visits with nothing saying
so. Snapshots of completed month-ends are now frozen and compared, and a
mismatch produces a note naming the month and the likely cause. A changed
*selection* is reported as more serious than a restated *value*.

- `engine/snapshots.js`, `data/cache/snapshotStore.js`
- Write-after-compare ordering, asserted by test — writing first would destroy
  the evidence the comparison exists to find

### The RS engine's required capabilities

- **Official previous month-end** — `priorMonthEndPrice` / `priorMonthEndDate` /
  `priorMonthEndKey`, always one month back regardless of the active window,
  taken from the last bar that actually exists in that month. Never estimated,
  never the calendar's last date, so a month ending on a holiday resolves
  correctly with no holiday list involved.
- **Current month-to-date %** — `currentMonthReturnPct`, on the adjusted basis
  on both sides so it survives a corporate action mid-month.
- **Current day %** — from the live quote, falling back to the last two closes
  and flagged via `dailyChangeIsLive` rather than fabricating a zero.
- **Three-month RS history** — `engine/rsHistory.js`, built as a *projection of
  the backtest's existing ranking output* rather than a second pass over the
  data, plus `rsTrend` and `rankChange`. A month with no data leaves a GAP; a
  fabricated 0.0pp would read as "kept pace with the benchmark".
- `priceBasis` is now reported per row, so a fallback to unadjusted close is
  visible rather than silent.

### Performance — the heavy/light split

`compute/deriveUniverse.js` splits the pipeline by what each part depends on:

| Pass | Depends on | Runs when | Measured (250 symbols) |
|---|---|---|---|
| **Heavy** | bars | data or strategy params change | **100.5 ms** |
| **Light** | quotes | every 30s tick | **0.04 ms** |
| **Sizing** | entered amount | every keystroke | **0.02 ms** |

Without the split, every 30-second quote tick would re-run a full 250-symbol
backtest on the render thread — for numbers that cannot possibly have changed,
because RS is measured from the adjusted price series and a quote is
unadjusted. A **2,500x** reduction on the hot path.

`compute/computeScheduler.js` memoises the heavy pass on data identity plus
strategy parameters (quotes and amount deliberately excluded from the key),
de-duplicates concurrent requests, and provides the stable interface behind
which a Web Worker can be enabled as a flag flip rather than a refactor.

### Also added

- `engine/changeDetection.js` — entries, exits, rank moves, trading days to
  rebalance. Baseline is the last completed rebalance: deterministic, identical
  for everyone, no visit tracking.
- `engine/portfolioValuation.js` — pure valuation for manual positions, ahead
  of its screen. An unpriced holding is **excluded and reported**, never valued
  at zero (which fabricates a total loss) or at cost (which fabricates a
  break-even).
- `config/schema/snapshotSchema.js` — the version and key format both layers
  need, in the dependency-free leaf. This exists because the boundary lint
  correctly rejected the data layer importing an engine.

### Validation

```
lint       clean      typecheck  clean
tests      493 passed (42 files)   [409 + 84]
build      clean      size  112.1 kB gzip initial / 200 kB    PASS
perf       heavy 100.5ms / 250ms · light 0.04ms · sizing 0.02ms
```

D1 acceptance: the record's return is identical to 10 decimal places across
notionals from ₹1 to ₹50 crore, asserted. The whole-share path is retained,
still hand-verified, and still demonstrably capital-dependent — which is the
contrast that justified the decision.

### Note on the perf gate

It now measures the **full heavy pass**, not just backtest plus momentum.
Timing only the backtest would have flattered the gate by omitting everything
this milestone added. Light and sizing are reported separately because they run
on entirely different cadences and a single blended number would hide a
regression in either.

## [0.22.0] — 2026-08-03 — M2: data layer rebuilt; the cache actually caches now

Second milestone of the Phase 5 roadmap. Fixes both measured defects from the
technical architecture. No engine file was touched — verified by checksum
against the pre-M1 tree.

### The two defects, and what they cost

**1. The historical cache could not physically fit in localStorage.**
One daily bar is ~120 bytes of JSON; ~390 trading days since the data start
date is ~48 kB per symbol, ~21 MB for all 453. The origin quota is ~5 MB, and
`cacheSet` swallowed the resulting `QuotaExceededError` in an empty catch
block. So caching worked, then stopped, and said nothing.

The new test fills the quota on purpose and reports exactly where it broke:
**writes failed from symbol 96 of 453.** Every load past that point was
refetching most of a universe.

**2. A cold universe load cost 251 serverless invocations.**
`/api/market-data` took one symbol per request. Smallcap 250 issued 251
invocations; all three universes issued 453. The quote path had been batched
months earlier; the history path never was.

### Added

- **`src/data/cache/barStore.js`** — IndexedDB-backed store for price series.
  One record per symbol with a recorded coverage window, so a wider re-fetch
  EXTENDS the entry instead of creating an overlapping duplicate. 6h TTL, LRU
  eviction of whole symbols, schema versioning, corruption treated as a miss
  and deleted rather than repaired.
  - **The weekend trap:** freshness compares against the range that was
    REQUESTED, not against the newest bar returned. Comparing against bar
    dates would miss every weekend and every market holiday forever, because
    a Saturday bar does not exist and never will.
  - **Write failures are counted and logged.** The defect above was invisible
    precisely because its failure path was empty.
- **`src/data/cache/idbBackend.js`** — thin IndexedDB adapter plus an in-memory
  fallback. No dependency; the surface needed is five methods on one store.
- **`netlify/functions/history.js`** — batched endpoint, up to 40 symbols per
  request, per-symbol failure entries with a 200 response, 6h edge cache with
  stale-while-revalidate. Smallcap 250 now costs **7 invocations plus 1 for the
  benchmark: 251 → 8.**
- **`netlify/functions/_shared/yahoo.mjs`** — validation, chunking,
  normalisation and the two-tier auth handshake, shared by both endpoints so
  they cannot drift apart. Pure parts exported separately and unit-tested,
  since the build environment has no network route to Yahoo.
- **`src/data/cache/cacheKeys.js`** — FNV-1a hashing. The quote cache key was
  the joined symbol list (~4 kB for one universe, ~7 kB for three), rebuilt and
  compared on every lookup; it is now under 40 characters and order-independent.
- **48 new tests** (409 total, from 361).

### Changed

- `MarketDataProvider` contract gains `getHistoricalDataBatch` as the primary
  path. Both providers implement it; the single-symbol method is retained and
  expressed in terms of the batch so they cannot diverge.
- `dataService` checks the cache BEFORE batching, so a warm load issues zero
  requests rather than merely fewer. Falls back to per-symbol fetching for
  providers without the batch method — which is why the four test doubles
  guarding the failure-asymmetry behaviour needed no changes at all. Editing
  regression tests to accommodate an implementation change is backwards.
- `netlify/functions/market-data.js` reduced from 195 lines to a 64-line
  deprecated alias over the shared module. **Removal after M3.**
- **Symbol validation added to both endpoints.** Without it the proxy would
  fetch any string a caller supplied, which is an open relay.
- Performance harness now gates on the **best** of 7 runs, not the median.
  Measured during this milestone: the *unchanged* pre-M1 source varied between
  128 ms and 350 ms for an identical workload depending only on machine
  contention — a 2.7x spread with zero code difference. A median gate on that
  signal fails builds at random, and a gate that fails at random is one people
  learn to re-run. The minimum is a lower bound, so it does not weaken the gate.

### Validation

```
lint       clean      typecheck  clean
tests      409 passed (38 files)   [361 + 48]
build      clean      size  111.6 kB gzip initial / 200 kB     PASS
perf       250 symbols 156 ms best / 250 ms budget             PASS
```

Definition of done: cold 250-symbol load = **7 requests** (asserted, was 251) ·
warm load = **0 requests** (asserted) · all 453 symbols fit the store with zero
write failures (asserted) · test count never reduced.

### Not done, deliberately

`quote.js` still carries its own copy of the auth handshake rather than using
the shared module. It is verified-working against live Yahoo, this environment
has no network route to re-verify it, and the duplication is ~40 lines. The
architecture's own rule is not to rewrite working modules without
justification, and "tidier" is not justification for an unverifiable change to
a working financial data path. Tracked in TODO.md.

## [0.21.0] — 2026-08-03 — M1: engineering foundations; layer boundaries now enforced by lint

First milestone of the approved Phase 5 roadmap. **Zero source files were
modified** — this is entirely tooling, types, harnesses and gates. The point is
that the architectural rules stop being documentation and start being something
the build refuses to violate.

### Added

- **Layer boundaries enforced by lint** (`eslint.config.js`). Engines may not
  import React, the data layer, hooks or components. Config is a dependency-free
  leaf. The data layer holds no domain knowledge. Rules for `screens/` and
  `selectors/` are pre-armed so the boundary holds from the first file placed
  there, rather than being retrofitted once the violations are load-bearing.
- **12 architecture tests** (`tests/architecture/layerBoundaries.test.js`) that
  lint hypothetical violating files and assert they are rejected — and that
  legitimate imports are accepted. The milestone's definition of done said "a
  deliberately-introduced layer violation fails the build"; this runs it rather
  than claiming it.
- **TypeScript** per decision D8. Strict on new `.ts`/`.tsx`; `checkJs` off for
  legacy `.js`. Measured before choosing: 1305 errors under strict+checkJs, 128
  non-strict, 0 as configured. Turning checkJs on would have meant editing
  nearly every file, contradicting this milestone's own "zero source changes"
  requirement. The 128 is recorded as a burn-down metric.
- **`src/types/domain.d.ts`** — the six domain types as the single source of
  truth, plus the error contract whose `scope` field fixes the UI treatment of
  every failure. Nullable financial values are `number | null`, never
  optional-and-assumed.
- **Performance gate** (`scripts/perf-baseline.mjs`). Times the heavy pipeline
  on seeded synthetic universes and fails the build over budget. Also reports
  the scaling shape across 50 -> 150 -> 250 symbols, because super-linear growth
  is the signature of an accidental O(n-squared) — the exact trap of rebuilding
  the month-end index inside a ranking loop. It throws if it measures zero work,
  so it can never report a fast, meaningless number.
- **Bundle-size gate** (`scripts/check-bundle-size.mjs`). Per-chunk gzipped
  sizes plus the initial payload excluding the lazily-loaded charts chunk.
- **`perf-budgets.json`** — budgets as data, so changing one is a reviewable
  one-line diff.
- **Test harnesses:** deterministic IST clock; golden-master comparator that
  refuses to auto-update; seeded synthetic series generator; in-memory
  IndexedDB double that can enforce a byte budget, go unavailable, and corrupt
  a record (pre-armed for M2).
- **`npm run verify`** — lint, typecheck, test, build, size, perf, in that
  order. CI runs the identical chain so it can never disagree with a local run.
- `DECISIONS.md`, `CONTRIBUTING.md`, GitHub Actions workflow, PR template.

### Baseline recorded

| Measure | Result | Budget |
|---|---|---|
| Heavy pipeline, 50 symbols | 40.6 ms | 250 ms |
| Heavy pipeline, 150 symbols | 80.2 ms | 250 ms |
| Heavy pipeline, 250 symbols | **128.0 ms** | 250 ms |
| Scaling, 5x symbols | 3.15x time | sub-linear |
| Initial payload (excl. charts) | 109.7 kB gzip | 200 kB |
| charts / vendor / index chunks | 114.2 / 77.7 / 31.6 kB | 140 / 110 / 60 |
| Tests | 361 (349 + 12 new) | never fewer |

### Notes

- Nothing about the financial engine changed. The one approved engine change
  (fractional weighting, D1) belongs to M3 and is still awaiting sign-off.
- `checkJs` being off is a measured decision, not an oversight — see
  `tsconfig.json`, which records all three measurements.

## [0.20.1] — 2026-08-02 — pp/% unit bug fixed; mobile had no logo; preview tooling hardened

Found while building a shareable preview of v0.20.0 and having the user
actually click through it — exactly the case for looking at real output
instead of trusting a description of it.

### Fixed — outperformance and RS rendered as "%pp"
The hero panel appended a `pp` suffix to a string that already ended in
`%`, producing `+18.93%pp`. Not cosmetic: RS and outperformance are
DIFFERENCES between two percentages, so "beat the benchmark by 18.93%"
claims a proportional gain, while "by 18.93pp" states the arithmetic
gap the spec actually defines. Only the second is true.

`formatPct()` gained a `unit` option (`'%'` default, unchanged for every
existing caller) and every RS/outperformance display — the hero, both
metric groups, the desktop table, the phone cards, the Dashboard's Top-5
chips — now passes `unit: 'pp'`. Five tests that had encoded the old
(wrong) `%` output were updated to expect `pp`, and a dedicated
`formatters.test.js` pins the doubled-unit case (`%pp`, `%%`) so it can't
silently return.

### Fixed — no logo at all on mobile
`Sidebar` is `hidden md:flex`; below that breakpoint it renders nothing,
which left the app's primary device with no mark anywhere. Not a preview
artefact — this would have shipped to Netlify. `TopBar` now carries the
mark in a `md:hidden` wrapper, so it appears exactly once regardless of
viewport width. New test asserts both the presence and the breakpoint
guard.

### Added — `scripts/build-preview.py`, `vite.config.preview.js`
A single self-contained HTML build for sharing the UI without a server —
built from a dedicated `main.preview.jsx` (HashRouter instead of
BrowserRouter, plus an on-page error overlay) so it can be opened from
`file://` or a sandboxed iframe.

This shipped broken twice before it worked, both silently:
1. **`BrowserRouter` matches against `window.location.pathname`.** Outside
   a normal web root that path is never `/`, so no route matched and the
   page was blank — no console error, nothing. Fixed with `HashRouter`
   plus an error boundary that prints any render failure onto the page
   instead of leaving a quietly-empty `<div id="root">`.
2. **The icon inliner missed a minifier rewrite.** The source references
   the mark as a plain string (`src="/icons/gati-mark.png"`), which Vite
   doesn't process as an asset; the minifier re-emitted it inside
   backticks, and the first inliner only matched double quotes, so the
   path stayed absolute and 404'd from `file://`.

`build-preview.py` now asserts its own output before finishing: no
external asset reference survives, no bare `/icons/` path survives, hash
routing is present, and at least one icon was actually inlined (matched
quote-agnostically). It fails loudly rather than producing a file that
looks fine until someone opens it — which is what happened twice here.
Preview output is gitignored and excluded from lint; it is build tooling,
not part of the shipped app, and never touches `vite.config.js`.

### Verified
```
npm run lint    → clean
npm test        → 349/349 passing (up from 343)
npm run build   → succeeds, PWA precache 15 entries / 807 KiB
```

## [0.20.0] — 2026-08-02 — Page layout: hero panels, grouped metrics, phone card rankings

The second half of the redesign. v0.19.0 landed tokens and theming;
this lands the layout those tokens were for.

### Added — `HeroPanel` / `HeroFigure` / `HeroChip`
One glass surface per page, and only one. Glass lowers contrast by
design, which is fine for a single focal element and actively harmful
behind a table of prices — so the rule is glass on chrome and one hero,
never on a data surface. The gold glow reproduces the app icon's own
lighting (warm key light from the upper right, cooler emerald wash from
the lower left) so the interface reads as belonging to the icon rather
than merely borrowing its colours. Both glows live in pointer-events-none
layers behind the content.

`HeroFigure` splits a formatted number so leading digits carry full
weight and trailing digits recede — ₹60,700 reads as "sixty thousand"
before "seven hundred". Presentational only; never changes rounding.

**The Strategy hero leads with outperformance, not portfolio value.** A
portfolio up 16% in a market up 20% is a losing strategy, and a
value-first hero would hide exactly that.

### Changed — thirteen flat cards became three named groups
`MetricGroup` splits the Strategy page's metrics into **Performance /
Risk / Consistency**. Thirteen identical cards in one run give every
number equal weight, so the page communicated "here is a lot of data"
rather than "here is how the strategy did". Tiles now share one hairline
grid instead of each carrying its own border, so the group reads as one
object with divisions rather than a mesh of competing edges.

Two metrics moved rather than disappeared, and both are still on the page
(Section 18 requires display, not a particular container):
`Initial Capital` → the hero's "Growth of ₹50,000" plus the sublabel
under Current value; `Benchmark Return` → a hero chip and the sublabel
under Total return, next to the figure it qualifies.

### Added — phone card view for rankings
The desktop table has eleven columns; shrunk to 390px that becomes either
a horizontal scroll with the RS column off-screen by default, or type too
small to read. Neither is acceptable for the app's primary view on its
primary device, so phones get a different component rather than the same
one squeezed. Each card keeps rank, stock, the RS ledger, and **both
operands stated in words** ("Stock +18.6% · Bench −0.2%") so the RS figure
stays checkable. Volume/sector/prev-month-end are dropped as reference
detail. Rendered as a `<ul>`, not a table — announcing eleven column
headers per row would be worse than the crowding it replaces.

### Added — Dashboard hero
Leads with how many universes are beating their own benchmark rather than
a blended return, because a blend across NIFTY 50 / Midcap / Smallcap is
not a number anyone holds — spec Section 3 forbids mixing universes. Each
universe's own figure, including losers, stays on its own card below.

### Fixed / guarded
- **`react-hooks/rules-of-hooks` caught a real bug**: `DashboardHero`
  originally called `useUniverseData` inside `.map()`. Now three fixed
  calls destructured from `UNIVERSE_KEYS` — config-driven, not hardcoded
  — with a new test asserting `UNIVERSE_KEYS.length === 3`, so adding a
  fourth universe fails the build rather than silently under-reporting.
- Test updates here were scoping and label changes, **not** loosened
  assertions. The rankings tests now scope to `getByRole('table')`
  because both views are in the DOM under jsdom (which applies no media
  queries); in a real browser `display:none` keeps each out of the
  accessibility tree, so screen readers never hear both. The
  outperformance identity test still verifies
  `outperformance == total − benchmark` against real computed data — it
  just reads benchmark from its new location.
- Four new tests cover the phone card view directly, including that a
  dead ticker still appears as a flagged card rather than being dropped.

### Verified
```
npm run lint    → clean
npm test        → 343/343 passing (up from 337)
npm run build   → succeeds, PWA precache 15 entries / 807 KiB
```

## [0.19.1] — 2026-08-02 — Real app icon installed; code-generated mark retired

The user supplied finished artwork (`brand-src/LOGO.png`, 1024px): the
Devanagari गति letterform in gold, crossed by an emerald ascent line, on
navy. It replaces the v0.16.0 mark that was generated from code in
`brand-src/`.

- **`scripts/generate-icons.py`** derives the whole set from the master.
  Two measured constants live in it rather than in anyone's memory: the
  crop box that separates the icon from its presentation staging, and the
  maskable safe-area ratio.
- **The master is a presentation render, not an icon** — a rounded card
  floating in a navy field with a gold glow bleeding in from the top
  right. The glow is staging. Shipping the whole frame would put a
  rounded card *inside* the OS's own rounded tile, which reads as an
  amateur mistake, so the card is cropped out and fills the tile.
- **Maskable variants are separate artwork**, scaled to 0.78 on solid
  navy. Android crops maskable icons to a circle of 80% diameter and this
  mark runs nearly edge to edge, so re-tagging the standard icon would
  amputate the arrowhead on every Android home screen — while looking
  perfect in every desktop preview.
- Retired and deleted: `gati-icon.svg`, `gati-mark.svg`,
  `gati-lockup-dark/light.svg`. Removed rather than left in place so no
  stale filename reference can quietly ship the old mark. Sidebar now
  uses `gati-mark.png` (transparent corners).
- **The mark is raster, not vector.** Deliberate: the artwork carries a
  gradient and a soft glow that a hand-trace would only approximate and
  drift from. Every size the app requests is generated from the 1024px
  master. A genuinely resolution-free mark would be a redraw commissioned
  against this artwork, not an upscale.
- Skipped: quantising `icon-512.png` saved only 11% (257KB → 229KB) for a
  real banding risk on gradient artwork. Not worth it.

### Added — `src/config/__tests__/icons.test.js`
Icons are static assets, so nothing else in the build fails when one goes
missing or gets mis-wired; the app just ships a broken home-screen tile.
Eight guards: every referenced icon exists, none is truncated, all are
real PNGs (not renamed SVGs), the manifest declares both purposes, and —
the important one — **maskable icons are asserted to be different bytes
from their same-size standard counterparts**, which is the exact
regression that looks fine everywhere except an actual Android device.

### Fixed
`Sidebar.jsx` nav links used literal `text-white` / `bg-white/10`. Not
broken today (chrome stays dark in both themes) but it would break
silently the moment anyone lightened the chrome. Now uses
`--color-chrome-ink`, the token that already existed for the job.

### Verified
```
npm run lint    → clean
npm test        → 337/337 passing (up from 329; 8 new icon guards)
npm run build   → succeeds, PWA precache 15 entries / 796 KiB
```

## [0.19.0] — 2026-08-02 — Design system rebuilt from the app icon; real dark/light theming

Visual direction agreed with the user after reviewing three sources: the
Stitch "GATI Quantum" spec, an Emergent "Performance Pro" build, and a
glassmorphic dashboard reference. This release lands the foundation layer
— tokens, theming, typography and the signature component. Page-level
layout work (bento grids, hero panels) is deliberately NOT in this
release; it depends on this layer being right first.

### Added — dark / light / system theming
- **`src/index.css` rewritten.** Same token NAMES as before, so no
  component needed changing to gain a dark mode — new values, plus a
  `[data-theme="dark"]` block that re-declares every one of them. No
  component in this codebase carries a `dark:` variant; the cascade does
  the work.
- **Palette is sampled from the app icon**, not invented: navy ground,
  gold letterform, emerald ascent. Each colour now has one fixed meaning
  — gold = benchmark/brand/rank (never decoration), emerald = ahead of
  benchmark, red = behind, navy = chrome. Dark mode is deep navy
  (`#080f19`), not black: dense tabular numerals on pure black halate.
- **`src/utils/theme.js`** — single source of truth for the storage key,
  media query, theme-colors and resolution logic.
  **`src/hooks/useTheme.js`** — three states, and "system" genuinely
  follows the OS live via a `matchMedia` listener rather than resolving
  once at load. **`ThemeToggle.jsx`** in the top bar, built as radios
  (one choice of three) rather than buttons.
- **Pre-paint bootstrap in `index.html`** sets the theme attribute before
  first paint, so a dark-mode user never sees a white flash. It
  necessarily duplicates four constants from `theme.js` (an inline script
  can't import without becoming async) — `theme.test.js` now reads
  `index.html` and fails the build if the two copies drift, which is
  otherwise a subtle, hard-to-attribute bug.

### Fixed — three contrast bugs dark mode would have exposed
All pre-existing; found by auditing what happens when tokens invert:
1. **`Sidebar.jsx` used `--color-ink` as a BACKGROUND.** That token means
   "primary text colour" and inverts to near-white in dark mode — the
   sidebar would have rendered white-on-white. Now uses a dedicated
   `--color-chrome`, which stays dark in both themes by design.
2. **`RankBadge` was white text on gold** — ~3.2:1, below the 4.5:1 WCAG
   AA floor. New `--color-on-gold` dark ink measures ~9:1.
3. **~20 hardcoded `bg-black/5` values** (hovers, skeletons, the neutral
   badge) are invisible over a dark surface. All replaced with
   `--color-surface-raised` / `--color-line-strong`.

### Changed — typography
Urbanist (display + body, light weights for large figures) and JetBrains
Mono (every number, ticker and timestamp). Replaces Space Grotesk / Inter
/ IBM Plex Mono — three families down to two. New `.figure` /
`.figure-dim` utilities render large numbers with the leading digits at
full weight and trailing digits receding, so magnitude reads before
precision.

### Changed — the RS bar became the RS Ledger
`RankingTable.jsx`'s signature component now draws **both operands**, not
just their difference: the stock's return as a solid bar, its benchmark's
return as a hatched ghost bar, sharing one centreline. **The visible gap
between them is the RS number in the next column**, which makes the
metric checkable at a glance instead of something the reader has to take
on trust. The benchmark is hatched rather than a second solid colour
specifically so it reads as a baseline, not a competing quantity. A
legend under the table names both bars — an unexplained chart element in
a financial table is worse than none. Scale clips rather than rescales:
one runaway stock must not silently make every other row incomparable.

### Added — `src/components/charts/chartTheme.js`
Recharts writes colours into raw SVG presentation attributes from JS
props and its defaults are hardcoded light-mode greys, so tick labels and
tooltips do not inherit from CSS and would stay light on a dark page. The
hook resolves the *same* tokens from the live document (so `index.css`
remains the only palette definition) and re-reads on theme change via a
`MutationObserver`. Applied across all six charts.

### Verified
```
npm run lint    → clean
npm test        → 329/329 passing (up from 314; 15 new theme tests)
npm run build   → succeeds, PWA precache 14 entries / 794 KiB
```

## [0.18.0] — 2026-08-02 — Phase 4 shipped for real: 3/6/12-month strategies, verified this time

**A note on why this version number is being reused.** An earlier session
also produced a "v0.18.0" — a full CHANGELOG entry, HANDOFF banner and TODO
list describing dark/light theming and these same 12 strategies as shipped.
None of it was actually written to any file: no theme code existed anywhere
in the tree, `strategies.js` still registered exactly 3 strategies, and
`computeCurrentMomentum` had no `lookbackMonths` parameter at all. That
work was discarded entirely rather than repaired — this entry describes
what was actually built and verified in this session, from the real
v0.17.1 source, with every number below coming from an actual test run.
Nothing here should be trusted more than the `npm run lint && npm test &&
npm run build` output that follows it in this project's history.

### Added — 12 strategies (4 rules × 3 universes)
Registered by explicit user decision (2 Aug 2026) after being asked
directly, per spec Section 25's requirement that longer-lookback variants
not be built pre-emptively:
- `src/config/strategies.js` now registers 1/3/6/12-month Relative Strength
  rules for NIFTY 50, Midcap 150 and Smallcap 250. The 1-month rule keeps
  the bare universe key as its strategy key (`nifty50`, `midcap150`,
  `smallcap250`), so every existing route, bookmark and CSV filename for
  the original strategy is byte-for-byte unchanged. The three new rules get
  a suffixed key (`nifty50-rs-3m`, `nifty50-rs-6m`, `nifty50-rs-12m`, …).
- `computeCurrentMomentum()` gained a `lookbackMonths` parameter (default
  1, bit-identical to omitting it — asserted in
  `currentMomentum.test.js`), so a strategy's live "Current Momentum"
  ranking now measures over the SAME window as the backtest above it,
  rather than always silently being a 1-month view regardless of which
  strategy page it's on.
- Routing: `App.jsx`'s route param renamed `:universeKey` → `:strategyKey`.
  `StrategyPage` resolves the key via `findStrategy()` (returns `undefined`
  instead of throwing) and redirects home via `<Navigate>` for an unknown
  key, rather than crashing on a stale bookmark.
- New `StrategyRuleSwitcher` component: plain, real, bookmarkable links
  between a universe's four windows, living on the strategy page itself.
  The global sidebar/mobile tab bar deliberately stay at 3 entries
  (unchanged) — 12 links don't belong in permanent navigation or on a
  phone.
- `CapitalCalculatorPanel` now accepts `lookbackMonths`/`topN` props so
  "Strategy's open position" reflects whichever window's strategy page
  it's embedded on, instead of always showing the 1-month position
  regardless of context. Defaults preserve the standalone Capital
  Calculator page's original 1-month behaviour exactly.
- CSV exports on the Strategy page are now keyed on the **strategy**
  (e.g. `nifty50-rs-3m-monthly-history.csv`), not the universe — otherwise
  the 1-month and 12-month exports for the same universe would collide on
  the same filename.

### Added — sample-size honesty check
New `src/engine/historySufficiency.js` / `assessHistorySufficiency()`.
A k-month window needs k+1 month-ends before its first signal, so with
~19-20 month-ends available since `DATA_START_DATE` (2025-01-01), the
12-month rule currently produces only a handful of completed rebalances —
confirmed directly in this session's real end-to-end test against the
Mock provider's actual date range (not just the hand-computed unit test).
Three levels: `insufficient` (0 cycles), `thin` (<12 cycles), `ok`
(12+). Surfaced via the new `InsufficientHistoryNotice` component, placed
**above** the metrics it qualifies, not hidden below them — a thin-sample
CAGR/Sharpe shown with no caveat is exactly the "technically correct but
misleading" output spec Sections 39/41 warn against.

### Verified, not claimed
```
npm run lint    → clean
npm test        → 314/314 passing (up from 295; every new/changed test is
                   new in this session, none pre-existed)
npm run build   → succeeds, PWA precache generates (14 entries, 786 KiB)
```
Real end-to-end coverage (against the actual Mock-provider stack, not
mocked components) added for: a 3-month strategy rendering correctly with
real backtest numbers, real CSV exports and a working window switcher; and
the 12-month strategy's thin-sample notice actually firing against real
generated data, not just an isolated unit test.

### Explicitly not done in this release
Dark/light theming (the other half of the previous session's false
"v0.18.0" claim) was NOT touched — by the user's own direction, theming
and general visual/UI design work is deferred to a separate pass. Nothing
in `index.html`, `index.css`, or any component's visual styling changed in
this release beyond reusing tokens that already existed (e.g. the same
warn-colour classes `Disclosures` already used). The window switcher and
sufficiency notice are functional, not designed — expect them to be
restyled once theming work starts.

## [0.17.1] — 2026-08-01 — Phase 2.1 closed: verified live on Netlify, not deferred anymore

The trigger this had been waiting on since v0.14.8 finally happened: the app
got deployed (`gati2.netlify.app`), and the live-data path was tested
**from Netlify's own servers**, not a residential IP, for the first time.

### Verified, from outside this sandbox, against the real deployment
- Site serves correctly — title, manifest, theme all confirm the right
  build (`Gati`, not a stale one).
- `/api/quote` — real prices for individual symbols, HTTP 200.
- `/api/market-data` — full Jan-2025-onward history, real OHLC + adjClose.
- **The test that mattered: all 50 NIFTY 50 symbols in a single batched
  quote request, direct from Netlify.** Result: **50/50 resolved, 0
  failures, 1.4 seconds, `authTier: "crumb"` throughout.** This is the
  exact condition Phase 2.1 was deferred pending — see CHANGELOG v0.14.8's
  closing note and every "🔔 deferred" mention since.
- Every quote correctly carried `isStale: true` with a Friday-31-July
  timestamp, since 1 Aug 2026 is a Saturday. That's the app behaving
  exactly as designed (Section 22) — showing the last real close rather
  than fabricating a live tick when markets are shut, not a defect.

### Decision: retry-with-backoff is NOT being built
Every deferred trigger required evidence of actual rate-limiting from
Netlify's IP range before building speculative hardening. That evidence
now exists to check against, and it came back clean: zero failures across
a full 50-symbol universe batch. Building backoff now would be solving a
problem that didn't occur. **Phase 2.1 is closed as "verified unnecessary,"
not "skipped."** If real 429s ever show up in production later, that's the
new trigger to revisit this — not before.

### Not part of this app's code
This release has no source changes — it's a verification result. The
deploy itself surfaced real GitHub/Netlify workflow friction (upload
batch-size limits, an accidentally-deleted `vite.config.js`, password
protection left on by default) that cost real time, but all of it was
GitHub/Netlify mechanics, not a defect in this repository — the finished
site required zero code changes once every file actually arrived.

## [0.17.0] — 2026-08-01 — Phase 4 groundwork: strategies become data

Phase 4 opens. Section 25 is explicit that the longer-lookback variants are
**not** to be built pre-emptively, and Section 34 requires each to be an
independent module. This release builds the seam and stops there — no new
strategy is registered.

### Changed — `runBacktest` accepts a measurement window
`lookbackMonths` (default **1**) replaces the hardcoded one-month window.
It changes only the window a return is measured over; the rebalance cadence
stays monthly, which is what "3-month momentum, rebalanced monthly"
conventionally means.

The load-bearing guarantee is that **nothing already computed moves**. The
first new test asserts deep equality between the default call and an
explicit `lookbackMonths: 1` — `cycles`, `equityCurve` and `rankingHistory`
compared whole, not spot-checked. A parameterisation that quietly shifted
existing backtest results would be worse than no parameterisation at all
(Section 38). All 286 prior tests pass untouched.

A window longer than the available history now returns flagged-empty rather
than a misleading partial result (Section 41), and the previously missing
`rankingHistory: []` was added to that early-return shape.

### Added — `src/config/strategies.js`
A strategy is a (universe × ranking rule) pair. The three shipped ones are
registered as data; `runBacktest` already knew nothing about which rule
produced its picks, so a rule reduces to parameters it accepts. Adding
3/6/12-month momentum is now an entry in this file, not an engine change.

**No 3/6/12-month entries are registered, deliberately.** The plumbing
accepts them and is tested, but registering one would be the pre-emptive
build Section 25 forbids — and each is a distinct financial claim that
should be chosen rather than defaulted into existence.

Strategy keys for the 1-month rule are the bare universe keys, so existing
routes, bookmarked URLs and CSV filenames stay valid; a future rule gets a
suffixed key.

### Tests
9 new (295 total, was 286). Beyond the identity guarantee: that a longer
window skips more early months, that it picks a genuinely *different* winner
rather than just fewer, and that the registry contains exactly one strategy
per universe — a guard against a variant being registered pre-emptively.

**A note on the fixture**, since it nearly produced a fake pass: the first
version generated prices from a formula whose late spurt (+60% over three
months) happened to win the 1-month *and* 3-month window, so
"different winner" was asserted and failed. The prices are now written out
explicitly and hand-verified in a comment. A fixture that can't separate the
two windows proves nothing about the parameter.

## [0.16.0] — 2026-08-01 — the app is now **Gati**

Name and identity decided and shipped. This closes ROADMAP 3.1, which had
been blocked on branding since the project began (spec Section 43: don't
invent the logo, ask when it's needed).

### Named
**Gati** — Sanskrit **गति**, "motion / pace / momentum". Chosen 1 Aug 2026.
Supersedes the earlier "My Dashboard" / keep-current-name question entirely;
the draft "MD" mark is retired and was never wired in.

### Added — full identity, generated rather than drawn
Artwork is produced by code in `brand-src/` and is fully reproducible
(`python3 export_assets.py`). Rationale and asset table in `docs/BRAND.md`;
a one-page identity sheet in `docs/gati-identity-sheet.png`.

**The idea the mark carries.** This app measures a stock *against its
benchmark* — Relative Strength is a signed deviation from a baseline, not
raw speed. So the mark is two elements and the meaning is in their
relationship: a level, unmoving **baseline** (the benchmark), and an
**ascent** that starts below it, crosses it, and accelerates away. The
crossing point is the strategy in one gesture. A generic up-arrow would
have said "number go up", which is both the wrong idea and the one every
fintech logo already owns.

- **Acceleration is drawn, not implied.** The ascent is a cubic Bézier
  sampled and offset along its normals with an eased width function
  (20px tail → 54px head), closed as a filled polygon. No SVG strokes, so
  weight never drifts under scaling.
- **Quiet reference.** The baseline is weighted and proportioned as a
  Devanagari *shirorekha* — the head-line every letter of गति hangs from.
  Reads as a benchmark line to everyone else; neither reading needs the other.
- **Palette taken from the running app**, not invented beside it: ink
  `#0e1b2c`, gold `#ad8a3d`, gain `#1e8e5a`, canvas `#f4f5f1`.
- Verified legible down to **16px** — that constraint, not taste, set the
  minimum baseline weight (raised 11px → 12.5px after the first raster test).

### Changed — branding applied
- `vite.config.js` — manifest `name` → "Gati — Relative Strength Momentum",
  `short_name` → "Gati", and the real icon set registered.
  **`maskable` entries are separate files, deliberately.** Android crops
  maskable icons to an 80%-diameter circle; the mark's far corner sits 237px
  from centre against a 205px safe radius, so those variants scale the mark
  to 0.812. Re-tagging the standard icon would have clipped the arrowhead on
  every Android home screen — the kind of defect that only shows up on a real
  device, which is exactly what this project can't test from here.
- `index.html` — title, SVG favicon, 32px PNG fallback, apple-touch-icon.
- `Sidebar.jsx` — the actual mark and "Gati" wordmark replace the old
  "Momentum Dashboard" text.
- `package.json` — name → `gati`.

286 tests passing, lint clean, build clean; manifest verified in `dist/`.

### Not done
The identity has been rendered and inspected as raster output, but **never
seen in a real browser or on a real home screen** — same gap as ROADMAP 3.3.
Installing the PWA on an actual Android and iOS device is the remaining
check, particularly for the maskable crop.

## [0.15.0] — 2026-08-01 — Capital Calculator: "what if I'd bought on…"

Phase 3.2. Minor bump rather than patch: this is the first new user-facing
capability since v0.14.0, not a fix.

### Added — third entry basis: "Bought on a date"
The calculator had two bases (buy today's Top 5; the strategy's open
position). This adds the third ROADMAP called a genuine nice-to-have: pick
any date since Jan 2025 and see what that purchase would look like today.

**The hard part is which five stocks, not which prices.** The obvious
implementation — take today's Top 5 and price them at the chosen past date
— is *exactly* the look-ahead bug that got the old "held since last
month-end" mode deleted in v0.8.0. Today's Top 5 are today's Top 5 because
they rose since that date; back-dating their entry manufactures a gain
nobody could have captured, and it would flatter every date the user picks.

So `holdingsFromChosenDate` takes the Top 5 from the last month-end ranking
**strictly before** the chosen date — the most recent selection actually
knowable that morning — and enters at the first available `open` on or
after it, the same Section 15 execution convention the backtest uses. A
weekend or holiday rolls forward to the next real trading bar.

- `engine/calculator.js` — new `holdingsFromChosenDate({ rankingHistory,
  priceSeriesMap, currentPriceBySymbol, date, topN })`, returning
  `{ holdings, signalMonthKey, entryDate, reason }`. `reason` is populated
  on every refusal path (no date chosen; no ranking predates the date; no
  eligible picks) so the UI explains itself instead of rendering an empty
  table (Section 41). Unpriced holdings are still dropped by
  `computeCalculatorResult`, keeping that rule in one place.
- `CapitalCalculatorPanel.jsx` — third toggle plus a date input bounded to
  `[DATA_START_DATE, today]`, shown only for this basis. An inline note
  names the source ranking and entry date, and states explicitly that these
  are *not* today's Top 5 priced backwards — the reasoning belongs in front
  of the user, not just in a comment.
- 6 new tests. The load-bearing one is negative: with a chosen date between
  the Jan and Feb signals, a stock that ranked 1st in *February* must not
  appear, because that was not knowable yet. Also covers open-not-close
  entry, weekend roll-forward, both refusal paths, and end-to-end P&L.

286 tests passing (was 280), lint clean, build clean.

### Phase 3 status
3.2 done. **3.1 (PWA icons) stays blocked** — still awaiting a final,
non-draft logo; the app keeps its current name either way (decided
1 Aug 2026). **3.3 (visual/responsive review on real devices)** cannot be
done from here: it needs a human with a browser and a phone. Everything to
date is audited in code and never seen rendered.

## [0.14.8] — 2026-08-01 — a real split, checked against real prices

Phase 2.3, closed. ROADMAP called the adjusted-close convention "the
assumption most likely to be quietly wrong with real data" — so it was
checked against real data rather than reasoned about.

### Added — `scripts/verify-split-adjustment.mjs`
Scans all 450 configured symbols for split/bonus events since Jan 2025 via
Yahoo's `events=split`, then spot-checks the first one found end-to-end
using the app's **own** `getMonthEndRecords` and `computeStockRS` — not a
reimplementation of the return math, which would only prove the script
agrees with itself. Also fetches the matching benchmark, since RS needs
both (Section 9).

**Result: 36 split/bonus events found** (BAJFINANCE, HDFCBANK, KOTAKBANK,
NESTLEIND, TRENT ×2, BSE, MCX, COFORGE, NAUKRI, TATAINVEST 10:1,
ANGELONE 10:1, ZFCVINDIA 6:1 and 24 more). BAJFINANCE.NS's 2:1 split of
16 Jun 2025 spot-checked in full: **+2.01% stock vs +3.07% benchmark,
RS −1.06pp, zero data-quality flags.** Phase 2.3: PASSED.

### The finding — worth recording, because it corrects an assumption
Yahoo **back-adjusts the raw `close` field too**, not just `adjClose`. So
there is no price cliff at an Indian split (BAJFINANCE closed 933.10 on
13 Jun and 938.00 on 16 Jun — no ~2x jump), and `close` and `adjClose`
produce the same return to 2dp across it. `adjClose` still differs in
*level* because it additionally carries dividend adjustment.

Practical consequence: the Section 6 preference for `adjClose` is correct
and stays, but **for splits specifically it is belt-and-braces rather than
the only thing standing between the app and a phantom −50% crash**. Better
to have established that than to keep assuming it.

### Verified, not changed — the mixed-convention guard
A correction to an earlier note in this session: the `assertSameConvention`
guard was described mid-session as possibly lacking a regression test. It
does not — `momentum.test.js` has covered it since v0.14.2 with five tests
(both mismatch directions, the benchmark ratio, the consistent-fallback
case, and field reporting). An earlier grep used terms that don't appear
literally in that file; the tests match on `/cannot compare/i` instead. No
gap existed and no production code changed here.

### Added — real-split regression fixtures
What *was* genuinely missing: fixtures from a real split. Four tests added
to `realMarketData.test.js` pinning BAJFINANCE.NS's actual month-end bars
either side of 16 Jun 2025 plus the matching NIFTYBEES.NS bars —
sane unflagged RS, `close`-vs-`adjClose` agreement, absence of a ~2x cliff,
and the guard still refusing to compute when `adjClose` is stripped from
one bar of that same real split. If Yahoo ever stops back-adjusting raw
closes, these trip rather than silently changing every return.

280 tests passing (was 276), lint clean, build clean.

### Phase 2 status
2.1b, 2.2 and 2.3 done. Only **2.1** remains (retry-with-backoff under real
rate-limiting) — and it stays open honestly: every measurement so far,
including today's 450-symbol scan in 5.5s at concurrency 8, has come from a
non-Netlify IP. Nothing has yet reproduced the condition backoff would be
for.

## [0.14.7] — 2026-08-01 — a dead crumb handshake no longer takes the whole page down

Phase 2.1b, closed. First real Phase 2 item since Phase 1's close — this is
the "more precise version" of the crumb-handshake question TODO.md had
flagged as still open after v0.14.4.

### Fixed — quote failure and historical failure now fail independently, in the code too
`fetchUniverseBundle` awaited historical data, then quotes, with no
isolation between them. Since 1.1's correction (CHANGELOG v0.14.3) already
established that `v7/finance/quote` needs the cookie+crumb handshake while
`v8/finance/chart` doesn't, the two were already failing independently *in
practice* — the code just didn't reflect it. A broken crumb handshake threw
from `getLatestQuotes`, and with no isolation that rejected the whole
bundle exactly like a historical/benchmark failure, even though the
backtest and month-end rankings (spec Sections 8-19) never read a live
quote at all.

- `dataService.js` — the quote fetch inside `fetchUniverseBundle` is now
  wrapped in its own try/catch. On failure, `quotes` stays an empty `Map`
  and the new `quotesError` field carries the reason; historical data,
  `priceSeriesMap`, rankings and the backtest are returned exactly as if
  quotes had succeeded. Nothing downstream breaks on an empty quotes map —
  `computeCurrentMomentum` already fell back to each stock's last
  historical close when a quote was missing (the price-convention note
  in `currentMomentum.js`, unchanged since v0.5.0).
- `LiveQuotesUnavailableNotice.jsx` — new, non-blocking notice for the
  Strategy page: what failed, and an explicit reassurance that rankings
  and the backtest below are unaffected. Deliberately distinct from
  `LiveDataErrorNotice`, which still blocks the whole page for an actual
  historical/benchmark failure — that asymmetry is the entire point.
- `Dashboard.jsx` — a compact "Live prices unavailable" badge next to the
  existing exclusion-count badge, since a dashboard card has no room for
  prose (Section 23).
- 8 new tests: 4 in `quoteIndependentFailure.test.js` (bundle resolves
  rather than rejects, `quotesError`/`quotes` shape, historical data still
  full-sized, no regression on normal operation) + 4 covering the new
  notice component. 276 tests passing (was 270), lint clean, build clean.

### Note
Per-symbol tolerance (v0.14.5) and this are the same idea applied at two
different scopes: one dead stock among 250 doesn't cost the other 249, and
now one dead *endpoint* (quotes) doesn't cost the other (history). Neither
changes the "no fabricated data" rule from v0.14.4 — an empty quotes map is
an honest "we don't have this," not a synthetic substitute.

### ROADMAP note
2.2 ("stale/failed-symbol handling at scale") is also marked done in
ROADMAP.md on review — it was substantively completed by v0.14.5's
`UnavailableSymbolsNotice` and v0.14.6's suggestion lookup, just not
checked off at the time. Remaining in Phase 2: 2.1 (retry/backoff under
real rate-limiting) and 2.3 (corporate-action spot check).

## [0.14.6] — 2026-08-01 — a suggested (never adopted) replacement for a known dead ticker

### Added — `RENAMED_TICKERS` config + surfaced suggestion
Closes the "detects but doesn't suggest" gap left open by v0.14.5. A new
`src/config/renamedTickers.js` maps a known dead/renamed symbol to either a
suggested replacement or an explicit "confirmed dead, no fix needed" note —
looked up by `dataService.js` whenever a symbol fails, and threaded through
`computeCurrentMomentum` onto the row as `unavailableSuggestion`.

**The app still never adopts a replacement itself.** This is exactly the
standing decision from TODO.md: guessing wrong risks pulling a *different*
company's prices into the rankings with full confidence, which spec
Sections 40/41 rank as worse than an honest gap. What changed is only that
a human reviewing a failed symbol now sees whatever is already known about
it (in `RankingTable`'s per-row message and `UnavailableSymbolsNotice`'s
summary) instead of always seeing the same generic "may have been renamed"
line, even for a case that's already been investigated.

- Seeded with `TATAMOTORS.NS` (retired by the 2025 demerger, confirmed no
  config fix needed — NIFTY 50 already carries the correct successor,
  `TMPV.NS`), which also keeps serving as a live regression fixture.
- `getRenameSuggestion(symbol)` returns `null` uniformly for both "not in
  the map" and "no entry" — most real failures will hit this honest
  default, since most tickers that break won't be pre-investigated.
- 4 new tests (`renamedTickers.test.js`) + 2 more in
  `perSymbolTolerance.test.js` covering the threading through
  `computeCurrentMomentum`. 270 tests passing (was 264), lint clean, build
  clean.

### Product decisions — branding, resolved for now
Asked directly and answered:
- The supplied "MD" logo/wordmark is **still a draft** — not wired in.
- **If/when it is finalized, the app keeps its current name** and only the
  square mark gets used for PWA icon assets; no rename to "My Dashboard"
  across the header, manifest, or `<title>`. Recorded so this doesn't need
  re-asking; the PWA-icons item in TODO.md remains blocked only on
  receiving a final (non-draft) asset.

## [0.14.5] — 2026-07-31 — one dead ticker no longer blanks a universe

Resolves the corollary v0.14.4 knowingly left open. Removing the sample-data
fallback was correct, but it made a pre-existing flaw visible: a single
failing symbol rejected the entire universe fetch, so one renamed ticker
took down a whole dashboard.

### Fixed — per-symbol failure tolerance
`getUniverseHistoricalData` fetched all ~250 symbols through
`mapWithConcurrency` and let any rejection propagate, so `Promise.all`
semantics meant **one bad symbol failed all of them**. Each fetch now
resolves to either its series or a recorded failure. The failing stock is
left out of `priceSeriesMap`, listed in a new `unavailableSymbols`, and the
other 249 are computed normally.

### The failure asymmetry — deliberate, and tested
Not everything should degrade gracefully. Three cases, three behaviours:

| What fails | Result | Why |
|---|---|---|
| One stock | That row flagged; universe fine | Losing 1 of 250 costs one row |
| **The benchmark** | **Universe-wide error** | RS is *stock minus benchmark* (Section 9). No benchmark, no ranking for anyone — a table of nulls dressed up as a result would be worse than an error |
| **Every stock** | **Universe-wide error** | 250/250 failing is an outage, not 250 independent renames |

### How it surfaces (three levels, deliberately)
- **In the row** — the ranking table shows *"⚠ Data not available — ticker
  may have been renamed or delisted"* directly beneath that stock's ticker,
  with the row tinted. One dead ticker reads as one dead row.
- **Above the table** — `UnavailableSymbolsNotice` summarises *"N of 250
  stocks excluded"* with each symbol and its reason, so a handful of
  failures in a 250-row table are findable without scrolling. Renders
  nothing when all is well, rather than a reassuring "0 excluded" line that
  trains people to stop reading it.
- **On the dashboard card** — a compact *"1 of 50 unavailable"* badge, so a
  card showing normal-looking numbers can't hide that some stocks are
  missing from the ranking those numbers came from.

### Added
- `DATA_QUALITY_FLAGS.SYMBOL_UNAVAILABLE` — kept **distinct** from
  `MISSING_DATA` on purpose. `MISSING_DATA` = "we have this series, it just
  doesn't reach the dates we need." `SYMBOL_UNAVAILABLE` = "the fetch itself
  failed for this symbol." Different causes, different fixes: one needs more
  history, the other needs the ticker corrected in `config/universes.js`.
- `UnavailableSymbolsNotice.jsx`.
- `perSymbolTolerance.test.js` — 8 tests: healthy stocks still rank, the
  dead ticker stays **visible** as an unranked row rather than silently
  disappearing from the universe, the two flags don't get conflated, Top 5
  still selects from survivors, and both asymmetry guards (benchmark
  failure, total failure) still escalate.
- Verified end-to-end by rendering the real Dashboard with one symbol
  hard-failing: content renders, the total-failure notice does **not**
  appear, and the exclusion badge does.

### Note
Stocks that fail are excluded from ranking rather than assigned a neutral
value — spec Section 41 ("do not silently calculate around it"). They cannot
enter the Top 5, since they have no computable RS.

**Groundwork for, but not yet, the ticker-rename map.** The app now detects
and reports a dead ticker precisely; it still doesn't suggest a replacement.
That remains a config edit, per the standing decision that auto-adopting a
guessed symbol risks pulling a different company's prices into the rankings.

264 tests passing (was 256), lint clean, build clean.

## [0.14.4] — 2026-07-31 — removed the sample-data fallback entirely

### Changed — CRITICAL behaviour reversal, on explicit user direction

Since v0.13.0, a live-data failure was caught and silently re-run against
`MockProvider`, so the dashboard kept rendering numbers — loudly flagged as
synthetic via `SampleDataBanner`, but numbers all the same. The user was
explicit: **never show fabricated data on a real failure, however clearly
labelled. Show an honest error instead.** That is a stricter, and correct,
reading of spec Section 35 #11 ("do not fabricate unavailable market data")
than this project had previously implemented.

- `dataService.js` — `fetchUniverseBundle` no longer catches a live-provider
  failure and retries against Mock. It lets the error propagate. Removed
  `fallbackProvider` entirely.
- `SampleDataBanner.jsx` — deleted. Replaced by `LiveDataErrorNotice.jsx`,
  which renders **only** an explicit error (what failed, and why) — there is
  no data underneath it to worry about mixing up with real prices, because
  none was fetched.
- `Dashboard.jsx` / `StrategyPage.jsx` — on `isError` (or a missing bundle),
  both now render `LiveDataErrorNotice` with the real error message, instead
  of the old one-line "Couldn't load X" placeholder or (on Dashboard) a
  banner that still let the rest of the page render on fake numbers.
- Bundle shape simplified: `liveDataError` and the from-provider-tagged
  `providerId` on failure no longer exist as concepts — on success the
  bundle just carries the real `providerId` ('yahoo' or intentionally
  'mock'), and on failure there is no bundle at all.
- `dataFallback.test.js` renamed to `dataFailureHandling.test.js` and
  rewritten: it now asserts the *opposite* of what it asserted before
  (rejection, not silent substitution) — kept as one file with a changed
  meaning rather than a new file, so its history stays attached.
- Manually verified end-to-end: a simulated total Yahoo failure renders the
  explicit notice with the real reason text, and no "sample data" language,
  no synthetic badge, and no currency-formatted numbers appear anywhere on
  the page.

### Known corollary — not yet resolved, worth naming so it isn't a surprise
`mapWithConcurrency` inside `getUniverseHistoricalData` currently means a
**single** failing symbol (e.g. a renamed/delisted ticker) throws for the
**entire** universe, since one rejected promise fails the whole
`Promise.all`. That is the correct direction per the instruction above
(honest error over fake data) but coarser than ideal — one bad ticker now
blanks a whole universe's dashboard rather than just flagging that one row.
Excluding just the failing symbol and flagging it individually is exactly
the ticker-rename detection item already sitting in `TODO.md`, not yet
built. Not addressed here to keep this change to what was actually asked.

### Note
Intentional Mock-provider mode (`VITE_DATA_PROVIDER=mock`, or dev default)
is unaffected — that's a deliberate choice, not a masked failure, and
already surfaces via the existing "⚠ Synthetic sample data" header badge
(`useDataFreshness` / `describeDataFreshness`), which was never driven by
the fallback path and needed no change.

256 tests still pass (test count unchanged — the rewritten suite has the
same 5 cases with reversed assertions), lint clean, build clean.

## [0.14.3] — 2026-07-31 — live verification, and a correction to the record

Yahoo Finance is verified end-to-end. Phase 1 is closed. But the headline
finding is a **correction**, not a confirmation, so it goes first.

### Corrected — the crumb fallback was never dormant; it carries every live price

v0.14.2's record stated that live verification returned `authTier=simple` on
every check and that the cookie+crumb fallback had therefore never executed —
"the untested branch." **That was wrong**, and wrong in the direction that
matters: it described a load-bearing dependency as dead code.

The two Yahoo endpoints do not behave the same way:

| Endpoint | Used by | Plain request | Tier in practice |
|---|---|---|---|
| `v8/finance/chart` | `market-data.js` (history) | **200 OK** | `simple` |
| `v7/finance/quote` | `quote.js` (live prices) | **401** | **`crumb`** |

Checks 1–9 of `verify-live-data.mjs` all exercise the *chart* endpoint, so
they all printed `simple`. The two quote checks never printed `authTier` at
all — so the crumb handshake was firing on every quote request, during the
user's own verification run, invisibly.

Operational consequence worth internalising: **live prices and historical
data now fail independently.** If `fc.yahoo.com` stops issuing a cookie or
`/v1/test/getcrumb` stops issuing a crumb, quotes break while the backtest
keeps working — a partial failure, not an obvious outage.

Both quote checks now report `authTier`, so this cannot hide again.

### Fixed — `verify-auth-fallback.mjs` reported a phantom defect
The script read `body.quotes` as an array. It is an **object keyed by
symbol**. `Array.isArray()` therefore yielded an empty list and the check
reported `0/3 priced` while `quote.js` was returning correct prices the whole
time. Left an open "defect requiring investigation" on the books for a full
session.

The app itself was never affected — `YahooFinanceProvider` uses
`Object.entries(payload.quotes)` and has always been right. This was purely a
faulty checker, which is its own lesson: a verification tool that reports a
false positive costs as much trust as one that misses a real failure.

### Verified live — Phase 1.1 and 1.4 both closed
- **`verify-live-data.mjs`: 14/14** against a local `netlify dev`.
- **Full Jan-2025→today range (Phase 1.4, `scripts/verify-full-range.mjs`)**
  — no truncation and no pagination weirdness: 394 rows for `ADANIENT.NS`
  and `BSE.NS`, 393/388/389 for the three benchmarks, 19 months covered,
  first row 2025-01-01, longest gap 4 days (a long weekend). This was the
  last unknown in Phase 1.
- **All 453 configured tickers resolve** (`scripts/verify-constituent-symbols.mjs`)
  — 51/51, 151/151, 251/251 including benchmarks. Meaningful because the
  Midcap/Smallcap lists came from a third-party mirror and had never been
  checked against reality. It confirms the tickers are real, correctly
  spelled and still quoted; it does **not** confirm index *membership*.
- **453 symbols in ~7s at concurrency 6, zero rate-limiting** — far stronger
  evidence than the earlier 8-request burst, though still a residential IP
  rather than Netlify's datacenter range.
- **`GVT&D.NS` confirmed**; special characters survive encoding.

### Added
- `FORCE_AUTH_TIER=crumb` in `market-data.js` and `quote.js` — exercises the
  fallback deliberately instead of discovering its condition mid-incident.
- `scripts/verify-auth-fallback.mjs` — runs both functions under both tiers.
  4/4 passing. Deliberately unmocked: a mock proves the branch is reachable,
  which was never in doubt; only Yahoo can confirm the handshake still
  behaves as assumed.
- `scripts/verify-full-range.mjs` — long-range truncation/gap check. Draws
  its symbols from `universes.js` rather than hardcoding them, after a
  hardcoded `TATAMOTORS.NS` produced a spurious failure (the 2025 demerger
  retired that ticker — a useful reminder that Indian tickers churn).
- `scripts/verify-constituent-symbols.mjs` — validates every configured
  ticker against live Yahoo at the app's own concurrency cap.

### Note
No engine or UI code changed. 256 tests still pass, lint clean, build clean.

## [0.14.2] — 2026-07-30

### Fixed — CRITICAL: mixed adjusted/unadjusted prices produced fabricated returns
Fourth financial-accuracy bug found, while attempting the Phase 2.3
corporate-action check.

`resolveReturnPrice` picks `adjClose` when present and falls back to `close`
otherwise — **per record, independently**. So when a provider supplies
adjusted data for one bar of a comparison but not the other, the engine
computed a ratio across two different price bases and reported it as a real
return, behind nothing but a soft warning badge.

The impact is severe, not cosmetic. With a 1:5 split between two month-ends:
- older bar raw (5000) vs newer adjusted (1050) → **-79%** reported for a
  stock that actually rose 5%. That stock ranks dead last and can never be
  selected.
- the same mix reversed → roughly **+425%**, which would sit at rank 1 and
  dominate the Top 5 every month it occurred.

Spec Section 6 forbids silently mixing price conventions and Section 41
requires suspicious data to be flagged rather than calculated around. A
warning was not enough here because the number itself is meaningless, so
`computeStockRS` now **refuses to produce a value** when the two prices in a
ratio come from different fields, returning `null` with an explicit
explanation. Guarded for the benchmark ratio as well as the stock.

A consistent fallback (both bars on `close`) still computes normally — the
basis is uniform, so the ratio is valid; it just carries a flag.

`resolveReturnPrice` now also returns the `field` it used, so callers can
inspect the basis rather than infer it.

5 regression tests added, including both directions of the mix and the
benchmark-side case.

### Note on Phase 2.3
The intended check was to validate adjusted-close handling against a real
Indian stock split. The available datasets turned out to be unsuitable (the
splits file covers the index, which never splits; the multi-ticker set is US
equities). That dead end led directly to this bug, which is the more
important finding: the risk was never splits themselves — `adjClose` handles
those — it was **partial adjusted-data coverage** across a comparison.

Tests: 251 → 256.

## [0.14.1] — 2026-07-30

### Fixed — the verification script was knocking on the wrong door
First real-world run of `verify-live-data.mjs` returned 12 failures that
looked like data-provider problems but were entirely self-inflicted.

The functions declare custom routes (`export const config = { path:
'/api/market-data' }`), so Netlify serves them at `/api/*`. The script
defaulted to the legacy `/.netlify/functions/*` path, so every request got
Netlify's plain-text **"Function not found"** — which the script then tried
to parse as JSON, producing the cryptic `Unexpected token 'F'`. A 38ms burst
time was the tell: nothing had left the machine, so the run said nothing
about Yahoo either way.

- The script now **probes both paths** and uses whichever returns parseable
  JSON, so a routing mismatch can never again be mistaken for a provider
  failure.
- When neither responds it exits with an actionable message naming both
  paths tried and how to pass a custom port, rather than a wall of red.

### Fixed — a false pass that made the report misleading
Check 10 ("invalid symbol handled cleanly") **passed during a run where the
endpoint was unreachable**, because an unreachable endpoint rejects every
symbol, including invalid ones. It now requires a parseable body before
counting as a pass — an unreachable endpoint is a failure, not a success.

### Verified
Re-proved end to end against the mock harness, which now mirrors real
`netlify dev` routing (serving only `/api/*`, replying "Function not found"
elsewhere): **14/14 pass with no URL argument**, and the no-server case
produces the intended guidance instead of a crash.

## [0.14.0] — 2026-07-30 — real-time quotes, batched properly

Directly acting on user feedback: request all symbols together, refresh
often but responsibly, and evaluate whether a better data source exists.

### Fixed — the request volume that would have gotten the app blocked
`quote.js` previously called Yahoo's chart endpoint **once per symbol**. A
full refresh across all three universes is 453 symbols, so at a 30-second
interval that was **906 requests/minute — 54,360/hour** against a free,
unofficial, unrate-limited-by-contract endpoint. That would have triggered
an IP block within minutes.

Confirmed via research (not assumed) that Yahoo's `v7/finance/quote`
endpoint accepts **many symbols in a single request**
(`?symbols=A,B,C,...`), verified working with `.NS` tickers specifically.
`quote.js` now groups symbols into batches of 50 and issues one Yahoo
request per batch:

**453 requests → ~10 requests per refresh.**

Proven against the real function code (not just described): the mock-server
harness now emulates Yahoo's v7 quote response shape, and a 10-symbol test
confirms all 10 come back priced from a **single** batch call.

### Added — market-hours-aware polling
Live quotes now refresh every 30 seconds, but **only while the market is
actually open** — `refetchInterval` re-evaluates market status on every
tick, so polling starts automatically at market open and stops automatically
at close, weekends and holidays, with no manual toggle. A closed market
can't produce new prices, so polling then would be pure waste against a
provider with no capacity guarantee.

30 seconds is documented as a considered floor, not an arbitrary number:
batching is what makes it safe at all, and going faster wouldn't usefully
track a monthly-rebalance strategy while it would raise the odds of
tripping Yahoo's undocumented abuse detection.

### Investigated — is there a better free data source than Yahoo?
Researched fresh rather than reused prior findings. Conclusion: no single
free source is a straightforward full replacement for ~450 Indian equities
refreshed live.

- **Twelve Data** is the one alternative with confirmed real NSE exchange
  listing, but its free tier (800 requests/day total, 8/minute) can't
  refresh 450 symbols live — a full pass alone would take roughly an hour.
  Recommended instead as a **future, opt-in accuracy cross-check**: sample
  ~20 symbols periodically and compare against Yahoo's numbers. Not built
  yet — needs the user's own free API key first.
- **NSE's own website** is the most authoritative source by definition, but
  aggressively bot-protected and known to block cloud/datacenter IPs
  (relevant since this deploys to Netlify) — more accurate in principle,
  less reliable operationally.
- **Broker APIs** (Zerodha Kite Connect, Upstox, Angel One) are official,
  licensed and generous, but require opening a real trading/demat account
  (KYC) — a materially bigger commitment than an API signup, not simply "free."

Tests: still 251 (quote.js and the polling hook are exercised via the
existing live-data-verification harness and the mock-server proof above,
rather than new unit tests, since their behavior is inherently
network/timing-shaped).

## [0.13.0] — 2026-07-30 — deployable without a local setup

Prompted by a good question: can the zip just be uploaded to Netlify and
work? Investigating that surfaced two real deployment risks, both now fixed.

### Fixed — a deploy could have looked simply "broken"
A production build defaults to the live Yahoo provider, and that path has
never been exercised against the real upstream. If it failed on Netlify,
every fetch threw and the user saw nothing but error cards — the app would
appear broken rather than degraded, with no indication of why.

`fetchUniverseBundle` now falls back to sample data when the live provider
fails, and the failure is surfaced **loudly**: a full-width `role="alert"`
banner stating *"Showing sample data — these are NOT real market prices"*,
with the underlying error printed beneath it, plus the existing header badge.

The loudness is the point. Spec Section 35 forbids fabricating market data
(#11) and requires live/delayed/historical data to be clearly distinguished
(#12) — a quiet badge is not sufficient when every number on the page is
synthetic. Sample data shown prominently is useful; sample data shown quietly
would be a lie. 5 tests cover this, including that the fallback does **not**
swallow errors when already on the sample provider, which would hide a real
bug behind an infinite fallback.

### Fixed — pinned the Node version for Netlify builds
`netlify.toml` now sets `NODE_VERSION = "22"` (plus a `.nvmrc`). Netlify's
default Node can lag behind what the build toolchain needs, and that failure
mode produces an error message that looks nothing like its actual cause.

### Changed (architecture — spec Section 34)
Data orchestration moved out of the React hook into
`dataService.fetchUniverseBundle`, so the data layer owns "where do the
numbers come from" end to end and the fallback is testable without rendering.

### Added
- `DEPLOY.md` — a browser-only path to a live site (GitHub upload → Netlify
  auto-build), requiring nothing installed locally, plus an honest account of
  what to expect if Yahoo is unreachable and a troubleshooting table.

Tests: 246 → 251.

## [0.12.1] — 2026-07-30

### Fixed
- Identified the unexplained 15 Jan 2026 market closure found empirically in
  v0.12.0: **Municipal Corporation Election (Maharashtra)**, confirmed by the
  user against the official NSE calendar. It is missing from the general
  holiday circular because it is an ad-hoc civic closure rather than a
  religious or national holiday — NSE and BSE are both in Mumbai, so a
  Maharashtra election closes the exchanges.
- Worth recording as a design validation: no hardcoded list of standard
  festivals would ever have contained this date. It is precisely why
  month-end detection reads actual trading data rather than a calendar
  (spec Section 8, "Do not assume the calendar month's final date is a
  trading day"), and why the holiday list only drives the live
  market-status pill, never any backtest maths.

### Added
- `SETUP.md` — a step-by-step guide for running the app on a laptop,
  written for someone who has not used a terminal before.

## [0.12.0] — 2026-07-30 — Phase 1.3: engine validated against REAL market data

Until now every engine test used synthetic or hand-built prices, which proves
internal consistency but not correctness against how the Indian market
actually trades. Yahoo is still unreachable from this environment, but Phase
1.3 only needs *real prices from a trustworthy source* — and GitHub is
reachable. Imported genuine NIFTY 50 index history (Jan 2025 – Apr 2026).

### Dataset validated before use
All **13** weekday gaps in its 2025 data map exactly onto real NSE holidays —
Mahashivratri, Holi, Id-Ul-Fitr, Mahavir Jayanti, Ambedkar Jayanti, Good
Friday, Maharashtra Day, Independence Day, Ganesh Chaturthi, Gandhi Jayanti,
Diwali Balipratipada, Guru Nanak Jayanti, Christmas. It also correctly
contains a bar for **Saturday 1 Feb 2025**, NSE's real special Budget-day
session — a detail a fabricated dataset would not have.

### Results — the engine is correct on real data
- **Month-end detection: 0 mismatches** against an independent scan of all
  316 real bars. Never selects a weekend.
- Correctly picks **28 Mar 2025** over 31 Mar (a normal Monday, but
  Id-Ul-Fitr) and **30 Mar 2026** over 31 Mar (Mahavir Jayanti). Anything
  assuming "last weekday of the month" gets both wrong.
- **Monthly returns match independent calculation exactly**, including real
  moves like Feb 2025 −5.89% and Mar 2026 −11.31%.
- **The v0.10.0 current-momentum fix is confirmed on real data.** The
  fixture ends 13 Apr 2026 (April incomplete — the exact bug condition). The
  engine anchors to 30 Mar and reports **+6.7674% MTD**, matching independent
  calculation to 4dp. Before the fix it would have reported 0.0000%.

### Holiday config cross-validated
All 5 testable 2026 holidays from the NSE circular are confirmed by real
gaps, **0 contradictions**. One additional weekday closure was discovered
empirically — **15 Jan 2026** — which is absent from the circular list this
project used. Added with an explicitly honest label: the closure is certain
(no bar exists in validated real data) but the official reason is not, so it
is not given a guessed name.

### Added
- `src/engine/__tests__/realMarketData.test.js` — 10 regression tests pinned
  to genuine NIFTY 50 month-end closes, so future refactors are checked
  against real market behaviour rather than only against synthetic fixtures.

Tests: 236 → 246.

## [0.11.0] — 2026-07-30 — Phase 1.2 complete: all constituent lists filled

### Added — Midcap 150 and Smallcap 250 are now complete (36/150 and 37/250 -> 150/150 and 250/250)

This had been the longest-standing gap in the project. It was recorded as
blocked on network access, so the first step was to actually **test** that
assumption rather than inherit it: `curl` confirmed the egress proxy returns
`x-deny-reason: host_not_allowed` for niftyindices.com and Yahoo — genuinely
blocked — but that **GitHub is reachable**, which opened a viable route.

Midcap 150 is **derived**, not copied:
`Nifty Midcap 150 = Nifty MidSmallcap 400 - Nifty Smallcap 250`, an identity
that holds by index construction. The importer asserts it yields exactly 150
names, which is a strong integrity check in its own right — stale or corrupt
inputs essentially never satisfy it.

**Validation before the data was accepted** (all passed): exact counts
50/250/400/500; no duplicates; Smallcap 250 fully contained in MidSmallcap
400; derived Midcap 150 exactly 150; zero overlap between any two universes;
all tickers well-formed. Decisively, the source's NIFTY 50 list matched this
project's independently-verified official list **50/50**, and it
independently confirmed the MCX / Laurus Labs placement in Midcap 150 that
had earlier been resolved from official factsheets.

- `scripts/import-constituents.mjs` — a real, runnable importer that
  performs every check above and **refuses to emit anything if one fails**,
  so a bad refresh can't silently produce a plausible-but-wrong universe.
  Re-running after each semi-annual reconstitution is one command.
- `src/config/constituents.generated.js` — generated output, not hand-edited.
- **26 config integrity tests** pinning counts, uniqueness, ticker format,
  mutual exclusivity (Section 3), distinct benchmarks that are never also
  constituents (Section 17), and nine specific stock placements verified
  from official factsheets — so a future regeneration that moves them has to
  be deliberate rather than unnoticed drift.

### Honesty about provenance
The lists come from a third-party mirror, not NSE's own CSV, and the app
says so: universes carry `provenance: 'third-party-mirror'` and the strategy
page displays a note explaining what was validated and advising re-import
from niftyindices.com to be certain the list is current. Synthetic padding
is now gone entirely — every ticker in every universe is a real one.

Tests: 210 -> 236.

## [0.10.0] — 2026-07-30

### Fixed — CRITICAL: Current Momentum compared today's price against itself
The Current Momentum Dashboard (spec Section 20) — one of the app's two
headline features — was computing every stock's return as **exactly 0.00%**,
and every RS as exactly 0.

Cause: `getMonthEndRecords()` returns the last available bar of *every*
month, including the current, still-incomplete one. `computeCurrentMomentum`
took that final entry as the "previous month-end" reference, so mid-month it
divided today's price by today's price. With all RS values identical, the
ranking silently collapsed onto the alphabetical tie-break — it looked like
a working leaderboard while carrying no momentum information at all.

Section 20 is explicit that the reference is the **Previous Month-End
Price**; the fix anchors to the last month-end strictly *before* the month
the latest bar falls in.

Why it survived a build, a lint pass and 189 tests: the defect only appears
mid-month, and `computeCurrentMomentum` was module-private inside a React
hook that every page test mocked out. It is now `engine/currentMomentum.js`
with **13 dedicated tests**, including month-boundary behaviour (latest bar
*is* a month-end), month gaps, and a refusal to report 0% when no completed
month exists to measure against.

The backtest was checked and is unaffected: it breaks out of the loop at the
incomplete month because no execution day follows it, so no cycle is ever
built from partial data.

### Added — end-to-end integration tests (8, mocking nothing)
Every previous component test stubbed `useUniverseData`, so the seams
between MockProvider → dataService → runBacktest → computeCurrentMomentum →
React Query → the page had never been exercised together. A shape mismatch
anywhere along that path would have passed all 189 tests.

The new suite drives the real stack and asserts invariants that must hold
whatever the prices are:
- **current-month RS values are not all zero, and differ from one another** —
  the assertion that directly catches the bug above;
- rankings are ordered by descending RS with rank 1 highest;
- displayed Outperformance equals Total Return minus Benchmark Return;
- max drawdown is non-positive;
- the portfolio reconciles;
- switching transaction costs ON makes net strictly worse than gross;
- the mandated disclosures render with real data, not just fixtures.

### Fixed (found by those tests)
- **Two headings both named "Current Portfolio"** on the strategy page — the
  strategy's live position and the Capital Calculator's hypothetical one —
  which is ambiguous for screen-reader users. `PortfolioTable` now takes a
  `title`, and the calculator's is "Your Calculated Portfolio".
- All three tables now carry distinct accessible names.

Tests: 189 → 210.

## [0.9.0] — 2026-07-30

### Changed (architecture — spec Section 34)
- **Extracted every chart's data transform** into `utils/chartData.js`:
  equity comparison zip, drawdown accumulation, monthly returns mapping,
  ranking-history series building, and P&L attribution aggregation. All five
  chart components are now purely presentational. The five transforms were
  previously module-private inside `.jsx` files and therefore untestable.

### Added
- **24 tests on the chart transforms**, asserting the numbers the charts
  actually plot rather than that they merely mount:
  - drawdown is never positive (the peak is monotonic), recovers to exactly
    0 on a new high, and preserves one row in / one row out;
  - the equity zip yields `null` for a short benchmark curve so a gap
    renders as a gap instead of silently dropping a rebalance;
  - ranking history charts only stocks that reached the Top N, prefers those
    with the most appearances when capped, breaks ties alphabetically for
    determinism (Section 39), and gives `null` — not a fabricated rank — for
    months a stock was absent;
  - attribution sums a stock's P&L across every cycle it was held rather
    than listing it repeatedly, **skips** picks with a missing exit value
    instead of scoring them as break-even, and selects by absolute impact so
    a large detractor can't be hidden behind a small winner.

### Investigated and deliberately not done
Chart **geometry** assertions (axis ranges, plotted positions) remain out of
reach under jsdom. Recharts 3.x measures layout through its own
ResizeObserver; stubbing both `ResizeObserver` and `getBoundingClientRect`
gets the X-axis and legend to render, but the main plot surface still
resolves to zero size so no series draw. Closing that needs vitest browser
mode plus Playwright, which is a heavy dependency for marginal extra
assurance now that the transforms are directly tested — and the master
prompt says explicitly not to over-engineer. Recorded in TODO.md with the
findings so the decision can be revisited rather than rediscovered.

Tests: 165 → 189.

## [0.8.0] — 2026-07-30

### Fixed — look-ahead bias in the Capital Calculator (spec Section 40)
The "held since last month-end" entry basis added in v0.5.0 was quietly
wrong, and reviewing the TODO item for it is what surfaced the problem.

It took **today's** Top 5 and priced them at the **previous month-end**
close. But today's Top 5 are today's Top 5 *precisely because* they rose
this month — so back-dating their entry manufactures a gain that was never
capturable, and would have flattered the strategy every single month. That
is textbook look-ahead bias, which spec Section 40 forbids outright ("Never
introduce look-ahead bias", "future-price leakage").

Replaced with a **"Strategy's open position"** basis that uses the position
the backtest *actually* holds: chosen from the PRIOR month-end ranking and
entered at the following trading day's price, per the Section 15 execution
convention. Marking that to current prices gives a real, achievable
month-to-date figure. The "buy today's Top 5" basis is unchanged and still
correctly reports zero P&L for a purchase not yet made.

- `computeCalculatorResult` is now basis-**agnostic**: it takes holdings
  already carrying `entryPrice`/`markPrice` and only sizes and marks them.
  Deciding what those prices mean is the caller's job, because that choice
  is exactly where look-ahead creeps in and it deserves to be explicit at
  the call site rather than hidden behind a flag. Two named builders —
  `holdingsFromCurrentPicks` and `holdingsFromStrategyPosition` — make each
  basis auditable on its own.
- Added a **regression guard test** asserting the strategy basis reads
  `entryPrice` from the position itself and never consults a month-end
  price field, so this cannot silently come back.

### Added
- **Annualised volatility** (spec Section 18's remaining optional metric),
  gated behind the same 12-month sample floor as Sharpe and Sortino, and
  using the same population-sd × √12 annualisation so the three stay
  comparable — mixing sample and population estimators between them would
  make them quietly incommensurate. 4 tests, including that it's invariant
  to a shift in the mean (dispersion, not direction) and exactly 0 for a
  constant series.

Tests: 157 → 165.

## [0.7.0] — 2026-07-30

Completes the test-coverage push: every component and utility now has at
least smoke coverage. 98 → 157 tests across 18 files.

### Fixed (real bugs found while writing the tests)
- **CSV quoting missed bare carriage returns.** The escape pattern was
  `/[",\n]/`, so a value containing `\r` but no `\n` was emitted unquoted
  and split the row in most parsers. Now quotes on `"`, `,`, `\r` and `\n`
  per RFC 4180, and terminates lines with CRLF as the spec prescribes.
- **Spreadsheet formula injection.** Company names and sectors arrive from
  an external market-data provider, and a field beginning with `=` or `@` is
  executed as a formula by Excel and Google Sheets on open. Those are now
  prefixed with an apostrophe. `-` and `+` are deliberately left alone
  despite being on the usual injection list — this file's entire job is
  exporting signed numbers like `-3.85`, and guarding those would corrupt
  every negative return and stop the column parsing as numeric.
- **Columns could be silently dropped.** Headers came from
  `Object.keys(rows[0])`, so any field present only on later rows vanished.
  Now the union of keys across all rows, with missing values as empty fields.
- **Added a UTF-8 BOM** so Excel on Windows renders accented company names
  (Nestlé India) correctly instead of mojibake.

### Changed (architecture — spec Section 34, again)
- Split `toCSV()` (pure) from `downloadCSV()` (DOM side effects), and split
  every `exportX()` into a pure `buildXRows()` plus a thin download wrapper.
  The row shaping is where "exported values must match displayed values"
  (Section 28) can actually break, so it needed to be testable without a DOM.

### Added (tests)
- `csvExport`: 13 tests on escaping and assembly, including the `\r` case,
  formula-injection guards, the deliberate non-guarding of signed numbers,
  and that `0` exports as `0` rather than an empty field.
- `strategyExports`: 13 tests across all eight builders, including a direct
  cross-check that export rounding agrees with what `formatPct` renders
  on screen, that missing values become empty strings rather than
  `"null"`/`"NaN"`, and that the benchmark column is named after the actual
  benchmark symbol so the wrong one can't be implied.
- `TopBar`: 10 tests — real data date rather than clock time, loading state
  instead of a fabricated timestamp, the delayed-feed warning firing only
  when the market is open with stale data, synthetic-data badging, and all
  four market-status labels.
- `StrategyPage` / `Dashboard`: 13 smoke tests covering loading and error
  states, and asserting the spec-mandated disclosures actually render — the
  survivorship-bias limitation (Section 40), the execution convention
  (Section 15), the partial-constituent warning, all eleven Section 18
  metrics, the cost toggle (Section 16), and all seven CSV exports
  (Section 28). These are the guards that stop a required disclosure from
  quietly disappearing in a refactor.
- Charts: 10 smoke tests over all five components, covering populated and
  empty data, a stock unranked in some months, and a pick with a missing
  exit value being skipped rather than counted as zero P&L.

### Note on chart test depth
Recharts measures its container, which is zero-sized under jsdom, so these
tests exercise the data transforms and mounting but cannot assert on plotted
geometry. That limitation is recorded in TODO.md rather than papered over.

## [0.6.0] — 2026-07-30

Closes the top TODO item: the UI/wiring layer had **zero** test coverage,
which the 2026-07-30 audit showed was exactly where every defect lived.
61 → 98 tests.

### Changed (architecture — spec Section 34)
- **Moved two financial calculations out of components.** Spec Section 34
  explicitly lists "UI components performing financial calculations" as
  something to avoid, and both offenders were introduced in v0.5.0:
  - Capital-calculator P&L math → `engine/calculator.js`
    (`computeCalculatorResult`), now with 10 tests covering both entry
    bases, exact capital reconciliation, leftover-cash handling, and
    exclusion of picks with missing/zero prices rather than dividing by them.
  - Header staleness logic → `utils/freshness.js` (`describeDataFreshness`),
    now with 7 tests. This is the highest-consequence display claim in the
    app ("is what you're looking at current?") and it had already been
    gotten wrong once, so burying it in JSX was the wrong place for it.

### Added (tests)
- `RankingTable`: asserts a column header exists for **every** field
  Section 21 enumerates — the regression guard for the gap fixed in v0.5.0 —
  plus that values actually render, that negatives carry signs (Section 30's
  "don't rely on colour alone"), that missing values render an em-dash
  rather than "null"/"NaN", and that synthetic placeholder tickers are
  marked so they can't be mistaken for real companies.
- `CapitalCalculatorPanel`: control-wiring tests — switching entry basis
  actually changes the displayed P&L (+0.00% → +10.00% on a hand-checked
  fixture), presets resize positions, and `aria-pressed` tracks state.
- `useDataFreshness`: reads real freshness from the query cache, reports the
  *newest* `dataAsOf` across universes rather than whichever landed last,
  ignores unrelated cache entries, and — importantly — returns a
  **referentially stable** snapshot when nothing changed. That last one
  guards `useSyncExternalStore` against an infinite render loop, which is an
  unpleasant way to discover a regression in production.
- Test infrastructure: jsdom + React Testing Library, applied per-file via
  `// @vitest-environment jsdom` so the pure engine suite keeps running in
  the faster node environment.

### Fixed
- **Duplicate "Capital" label** in the calculator — the input and a summary
  card shared the same accessible name, which the new test tripped over
  before a user could. The input is now "Investment amount", which is also
  plainer language for the beginner-friendly requirement (Section 29).
- The calculator summary is now a labelled `<section>` (`role="region"`),
  making it navigable by assistive tech and unambiguous to query.

## [0.5.0] — 2026-07-30

Fixes every HIGH and most MEDIUM findings from the 2026-07-30
spec-compliance audit. The audit's own lesson — that all findings sat in
untested UI/wiring code — shaped the fixes: each one is either covered by
a new test or made structurally impossible to regress.

### Fixed (audit findings)
- **Fabricated "last updated" timestamp.** `AppShell` was passing
  `new Date().toISOString()`, so the header always displayed the current
  clock time no matter how stale the data was — precisely the "pretending
  data is live" failure Section 22 forbids. Replaced with a real
  `useDataFreshness` hook reading React Query's own `dataUpdatedAt` plus
  the date of the newest price bar actually held. The header now reports
  "data as of <date>" separately from "fetched <time>", flags a delayed
  feed when the market is open but the newest bar predates today, and
  badges synthetic mock data as such.
- **Transaction costs were unreachable dead code.** `TRANSACTION_COSTS`
  was imported by nothing and `runBacktest` was never passed a
  `costConfig`, so every "net" number was silently gross despite 6 passing
  unit tests on the cost formulas. Now wired end-to-end with an ON/OFF
  toggle per Section 16, total costs surfaced in the UI and in exports,
  and **two new integration tests** asserting net < gross, that per-cycle
  costs are non-zero when enabled, that an explicitly-disabled config is
  byte-identical to gross, and that the drag lands in a plausible
  0.05–5% band rather than being a rounding error.
- **Section 21's missing columns.** Added Current Price, Daily Change %,
  Previous Month-End Price, Volume and Sector to the rankings table. All
  of this data was already being fetched or configured and then discarded
  — 123 `sector:` fields had zero UI references. Reference columns collapse
  below `lg` so phones keep the decision-relevant columns without
  horizontal scrolling.
- **Survivorship-bias limitation now shown in the product**, not just the
  README, alongside the execution convention — Section 40 and Section 15
  both ask for these to be displayed where the backtest is presented.
- **CSV exports: 3 → 7**, covering Section 28's full list (current
  rankings, Top 5, monthly rankings, monthly performance, trades, backtest
  results, benchmark comparison). Moved into `utils/strategyExports.js` so
  the "exports must match what's displayed" rule has one place to enforce
  it instead of being inlined in JSX.
- **Section 18 gaps:** Losing Months and Sortino now displayed (Sortino was
  computed *and tested* but never rendered).
- **Capital Calculator** now shows Portfolio Value, Profit/Loss and
  Return %, with an explicit entry-basis toggle. "Buy today" reports P&L of
  zero — honest for a fresh purchase — while "Held since month-end" marks
  each pick from its previous month-end close to now, which answers the
  question users actually mean. Rendering three permanently-zero cards
  would have been technically compliant and useless.

### Changed (architecture)
- **Split the data fetch from the strategy computation.**
  `useUniverseHistory` is keyed only on `universeKey`; `useUniverseData`
  applies capital / topN / cost settings in a `useMemo`. Previously
  `capital` sat in the query key, so changing it would refetch all ~250
  symbols — which is why the Strategy page had frozen it in a setterless
  `useState`. That dead state is gone and the cost toggle is now free.
- **Bounded both unbounded fan-outs.** `quote.js` did
  `Promise.all(symbols.map(...))`, firing ~251 simultaneous requests at an
  endpoint with no published quota; now capped at 8 concurrent with a short
  inter-chunk pause, plus symbol de-duplication and a `failed` count in the
  response. `dataService.getUniverseHistoricalData` had the identical
  problem with larger payloads; now capped at 6 via a new
  `mapWithConcurrency` helper, with the benchmark fetched first and alone
  since every calculation depends on it. That helper has **4 dedicated
  tests** — it returns results in input order, and callers zip its output
  against the stock list by index, so an order leak would silently attach
  the wrong price series to the wrong ticker and corrupt every downstream
  return and ranking. Worth testing rather than trusting.

### Withdrawn
- One audit finding was **retracted after closer inspection** rather than
  quietly dropped: "Current Momentum uses the last historical bar, not the
  live quote" is not a bug. A current-day daily bar is an in-progress bar
  whose close tracks the live price, and critically it shares the
  adjusted-close basis of the month-end it's divided by. Swapping in the
  raw quote would mix unadjusted and adjusted prices and break across any
  split — the exact convention-mixing Section 6 forbids. The original code
  was right; the live quote is now used for display columns only, with the
  reasoning documented at the function. See TODO.md.

### Self-caught during this work
ESLint flagged three issues in the *new* code before it shipped: a
`setState` inside an effect body in the freshness hook (rewritten with
`useSyncExternalStore` and a reference-stable snapshot, which is the
correct primitive for subscribing to an external store), an unused
destructured variable, and an `?? []` literal that would have invalidated
the calculator's `useMemo` on every render.

## [0.4.0] — 2026-07-29

### Added
- Complete, officially-sourced NSE 2026 holiday list (was 7 dates with
  documented gaps; now all 15 weekday closures). Found NSE's own circular
  PDF directly and cross-checked it against 5+ independent aggregators —
  all agreed. One additional source found during the search gave
  systematically different (shifted-earlier) dates for nearly every
  lunar-calendar holiday, consistent with simply showing a stale (likely
  2025) calendar rather than a real conflict — identified and disregarded
  rather than averaged in or silently trusted. This also corrected the
  previous placeholder Ganesh Chaturthi guess (was "Aug 19, approx —
  verify"; is actually Sept 14). Every date cross-checked against its
  stated day-of-week for internal consistency before shipping. New test
  imports the real shipped `NSE_HOLIDAYS_2026` (not just an inline test
  fixture) as a regression guard.
- Landmark structure: major page regions (performance summary, charts,
  current momentum, current portfolio, monthly history, universe
  summaries) wrapped in labelled `<section>` elements, giving
  assistive-tech users landmark-based navigation independent of heading
  depth — chosen over trying to force a perfectly nested heading outline
  across components that are reused at different logical depths, which
  would have been fragile.
- Code-level responsive-layout audit (grids, fixed widths, table overflow
  handling, sidebar/mobile-nav breakpoint complementarity) — found no
  bugs, but explicitly documented as a code review, not a visual one,
  since this environment has no way to render and screenshot the app.

### Fixed
- Nothing broken this round — pure additions, re-verified with lint +
  tests + build after each change.

### Process change
- Added `TODO.md` as the single, maintained source of truth for outstanding
  work, replacing informal "next steps" notes that were starting to
  duplicate (and drift) across README and CHANGELOG. Going forward: work
  through it in priority order, keep it in sync, only stop to ask when a
  real decision or blocker requires the user's input.

### Added
- Capital Calculator embedded directly in each Strategy page (spec Section
  24 lists it as one of a strategy's own sections; previously it only
  existed as the separate `/calculator` route). Extracted into a shared
  `CapitalCalculatorPanel` component reused by both the standalone page
  and the embedded version — the embedded copy costs no extra network
  fetch or backtest recomputation, since it deliberately shares its React
  Query cache key with the page's own default-capital data.
- Dashboard-level cross-universe performance chart (spec Section 23's
  "major performance charts", the one thing the Dashboard couldn't show
  that individual Strategy pages already could): total return vs
  benchmark, all three universes side by side, one chart per Section 23's
  own "don't overcrowd" caution.
- Minimal ESLint setup (flat config: core recommended rules +
  eslint-plugin-react-hooks). Caught two real, pre-existing issues on its
  first run: a dead variable assignment in the backtest engine
  (harmless, but genuine dead code) and a mutable render-time accumulator
  in `DrawdownChart` (rewritten as a non-mutating reduce). Also caught,
  live, a mistake made *while writing this very changelog entry's code* —
  an unused import reintroduced during a refactor — confirming the
  tooling earns its keep immediately.
- Accessibility pass: normalized all card-title headings from an
  inconsistent h2/h3 mix to a consistent h2 (page titles remain h1);
  added `scope="col"` to every table header cell; added screen-reader-only
  labels to icon-only header cells (the data-quality-flag columns);
  confirmed capital calculator inputs are properly label-associated and
  preset buttons expose `aria-pressed`.

### Known, deliberately deferred (see TODO.md)
- Deeper nested `<section>`/heading structure — this pass made the
  heading *levels* consistent, not the full document outline.
- Visual responsive-layout review — no browser preview available in this
  build environment; breakpoints applied by convention, not eyeballed.

### Added
- `scripts/verify-live-data.mjs` — an automated 13-check live-data
  verification script, turning "go verify Yahoo Finance live" into a fixed
  ~10-minute task (`netlify dev` + one command) instead of an open-ended
  one. Covers the basic fetch mechanism, special-character tickers
  (`M&M.NS`, `BAJAJ-AUTO.NS`), the one ticker derived rather than
  independently confirmed (`GVT&D.NS`), all three benchmark symbols,
  partial-history stocks, invalid-symbol error handling, the quote
  endpoint, cache headers, and a small burst-request probe. Writes a
  diffable JSON results file each run.
- `scripts/verify-live-data-checklist.md` — the human-readable companion:
  what each check is for, what "done" looks like, and what to do for each
  specific failure pattern.
- The script was self-tested (not just written and assumed correct) by
  building a mock server around the actual shipped `market-data.js`/
  `quote.js` code — once with everything behaving correctly (13/13
  passed) and once with two specific things deliberately broken
  (11/13 passed, exactly the two broken checks flagged, everything else
  still correct). This caught a real bug: the failure-diagnostic hints
  originally printed unconditionally regardless of which checks actually
  failed; fixed to target only the relevant hint(s).

### Changed
- README's Yahoo Finance section now points at the checklist instead of a
  single ad-hoc `curl` suggestion.

### Added
- Midcap 150 constituents: 30 → 36 verified (of 150), from fetching the
  official NSE factsheet PDF directly (which turned out to expose a fuller
  top-10-by-weight table than its search snippet showed) plus the "Nifty
  Midcap Select" factsheet — a 25-stock liquid subset drawn from Midcap 150
  by construction, so its members are Midcap 150 members by definition.
- Smallcap 250 constituents: 29 → 37 verified (of 250), same method plus
  the "Smallcap250 Momentum Quality 100" factsheet (also a by-construction
  subset).
- A second, independent instance of the MCX/Laurus Labs cross-index pattern
  surfaced (a smallcap-derived sub-index listed both as eligible-universe
  members). Two same-dated (30 Jun 2026) official main-index factsheets
  agree both sit in Midcap 150, so this is most likely the derived
  sub-index's own review cycle lagging its parent, not a live contradiction
  — noted in `universes.js` rather than treated as unresolved.

### Changed
- README constituent-count references updated to match.

### Added
- Midcap 150 constituents: 8 → 30 verified (of 150), sourced from the
  official niftyindices.com factsheet plus Screener.in's constituent page
  (fetched as far as robots.txt allows — further pages blocked and that
  block respected rather than worked around).
- Smallcap 250 constituents: 0 → 29 verified (of 250), same method plus a
  TradingView snapshot. One cross-index conflict found (MCX, Laurus Labs
  appeared in both a Smallcap 250 and a Midcap 150 source) — resolved in
  favour of the more authoritative official factsheet and documented in
  `universes.js` rather than silently merged.
- GE Vernova T&D India's exact NSE ticker resolved (`GVT&D.NS`), closing a
  gap flagged in v0.1.0.
- New unit test file for the transaction cost module (was previously
  untested code) — 6 tests covering the enabled/disabled toggle, buy-only
  stamp duty, and the GST base calculation.
- Verified transaction cost rates against current sources: STT (0.1%
  delivery, confirmed unchanged by Budget 2026), stamp duty (0.015%,
  buy-side only), SEBI turnover fee (0.0001%), and GST base (18% on
  brokerage + exchange charges + SEBI fee only) all confirmed current.
  Exchange transaction charge documented as a ~0.003%–0.0035% range across
  sources rather than asserted as a single precise figure.
- `rankingHistory` added to the backtest engine's output — a lightweight
  rank+RS snapshot per signal date, independent of whether that signal was
  ever executed as a trade. Additive change, covered by a new test; all
  previously-passing tests unaffected.
- Ranking History chart (spec Section 27) — rank-over-time for whichever
  stocks reached the Top 5 at least once, capped to avoid a 150-line
  spaghetti chart.
- Top 5 Performance / attribution chart (spec Section 27) — aggregate ₹
  P&L contribution per stock across every cycle it was held, not just its
  most recent appearance.
- Yahoo Finance fetch functions (`market-data`, `quote`) rewritten to a
  two-tier strategy: try a plain request first, only perform the
  cookie+crumb handshake if that's rejected. Prompted by conflicting,
  differently-dated research evidence on whether the crumb is currently
  required for this endpoint — this hedges both ways instead of committing
  to one. Response now includes an `authTier` field so a real request
  (once network access allows testing it) reveals which path actually fired.

### Changed
- README's data-quality caveats updated to match the new verified counts
  and the revised Yahoo Finance strategy.

### Still known-partial (see README "Known gaps")
- Midcap 150 (30/150) and Smallcap 250 (29/250) constituent lists remain
  incomplete — better, not done.
- Yahoo Finance fetch still not live-tested end-to-end (no network path to
  finance.yahoo.com from this build's sandbox).
- PWA icons still pending the user's logo.

## [0.1.0] — 2026-07-29

### Added
- Project scaffold: Vite + React + Tailwind v4 + React Router + TanStack Query, Vitest.
- Engine (`src/engine`): trading calendar / month-end detection, return & RS
  calculations, ranking with documented tie-break, equal-weight portfolio
  sizing with whole-share flooring, monthly rebalancing backtest engine
  (signal-at-month-end / execute-next-trading-day convention, pooled cash
  carry-forward), performance metrics (CAGR, max drawdown, win/loss months,
  Sharpe/Sortino with sample-size gating), configurable transaction cost
  model (off by default).
- 46 unit/integration tests covering every engine module, including a fully
  hand-computed 3-cycle backtest scenario. All passing.
- Data layer: provider abstraction, Mock (offline, deterministic synthetic
  data) and Yahoo Finance (via Netlify Functions implementing the
  cookie+crumb handshake) providers, `dataService.js` orchestration with
  localStorage caching.
- Netlify Functions: `market-data` (historical OHLC) and `quote` (latest
  price), both proxying Yahoo Finance server-side.
- UI: app shell with sidebar/mobile tab nav, Dashboard, Strategy page
  (shared across all three universes), Capital Calculator, ranking table
  with diverging RS-bar visual, portfolio table, monthly history table,
  equity curve / drawdown / monthly returns charts, CSV export, market
  status pill, PWA manifest.
- Config: NIFTY 50 full verified constituent list; Midcap 150 (partial,
  8/150 verified) and Smallcap 250 (partial, 0/250 verified) with an
  honest `meta.constituentStatus` flag, a documented completion path
  (`scripts/import-constituents.md`), and synthetic padding so the UI/engine
  can still be exercised at full 150/250-row scale in the meantime.
- NSE 2026 holiday calendar (partial — only well-corroborated fixed dates
  included; lunar-calendar holidays intentionally left for annual
  verification rather than guessed).

### Known issues / gaps (see README "Known gaps" for detail)
- Yahoo Finance fetch logic could not be exercised against a live response
  from this build's sandboxed network — verify with `netlify dev` before
  depending on it.
- Midcap 150 / Smallcap 250 constituent lists are incomplete.
- Transaction cost rates are best-effort approximations, not verified
  against current STT/stamp-duty circulars.
- Sharpe/Sortino risk-free-rate assumption (6.5% annualised) is a
  placeholder.
- No automated visual/UI test coverage yet (engine is unit-tested; UI is
  not, beyond a production build check).
